from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, date
from typing import List
from app.infrastructure.database.session import get_db
from app.infrastructure.database.models import (
    UserORM, AvailabilityORM, EnergyProfileORM, TaskORM
)
from app.infrastructure.repositories.task_repository import TaskRepository
from app.infrastructure.repositories.score_repository import AIDecisionRepository
from app.infrastructure.ai.smart_planner import SmartPlanner
from app.domain.services.planning_engine import ClassicPlanningEngine
from app.domain.models.energy import Availability, EnergyProfile, EnergyPeriod, DayOfWeek
from app.api.dependencies.auth import get_current_user
from app.api.schemas import (
    PlanRequest, PlanResponse, SlotResponse,
    AvailabilityCreate, AvailabilityResponse,
    EnergyProfileCreate, EnergyProfileResponse,
    AIRecommendationResponse, MessageResponse
)
from app.core.logging import get_logger

router = APIRouter(prefix="/planning", tags=["Planning"])
logger = get_logger(__name__)


# ──── Availability ────────────────────────────────────────────────────────────
@router.get("/availabilities", response_model=List[AvailabilityResponse])
def list_availabilities(db: Session = Depends(get_db), current_user: UserORM = Depends(get_current_user)):
    """List user's weekly availabilities."""
    return db.query(AvailabilityORM).filter(AvailabilityORM.user_id == current_user.id).all()


@router.post("/availabilities", response_model=AvailabilityResponse, status_code=201)
def create_availability(
    data: AvailabilityCreate,
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user)
):
    """Add a new weekly availability slot."""
    avail = AvailabilityORM(user_id=current_user.id, **data.model_dump())
    db.add(avail)
    db.commit()
    db.refresh(avail)
    return avail


@router.delete("/availabilities/{avail_id}", response_model=MessageResponse)
def delete_availability(
    avail_id: int,
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user)
):
    """Delete an availability slot."""
    avail = db.query(AvailabilityORM).filter(
        AvailabilityORM.id == avail_id, AvailabilityORM.user_id == current_user.id
    ).first()
    if not avail:
        raise HTTPException(status_code=404, detail="Availability not found")
    db.delete(avail)
    db.commit()
    return MessageResponse(message="Availability deleted")


# ──── Energy Profile ──────────────────────────────────────────────────────────
@router.get("/energy", response_model=List[EnergyProfileResponse])
def list_energy_profiles(db: Session = Depends(get_db), current_user: UserORM = Depends(get_current_user)):
    """List user's energy profiles per period."""
    return db.query(EnergyProfileORM).filter(EnergyProfileORM.user_id == current_user.id).all()


@router.post("/energy", response_model=EnergyProfileResponse, status_code=201)
def upsert_energy_profile(
    data: EnergyProfileCreate,
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user)
):
    """Create or update energy level for a specific period."""
    existing = db.query(EnergyProfileORM).filter(
        EnergyProfileORM.user_id == current_user.id,
        EnergyProfileORM.period == data.period
    ).first()
    if existing:
        existing.energy_level = data.energy_level
        db.commit()
        db.refresh(existing)
        return existing
    profile = EnergyProfileORM(user_id=current_user.id, **data.model_dump())
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


# ──── Classic Plan ────────────────────────────────────────────────────────────
@router.post("/generate", response_model=PlanResponse)
def generate_plan(
    data: PlanRequest,
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user)
):
    """
    Generate a classic (heuristic) daily plan for a given date.
    Sorts tasks by priority, aligns with energy, adds micro-breaks.
    """
    task_repo = TaskRepository(db)
    pending_tasks = task_repo.get_pending_tasks(current_user.id)

    availabilities_orm = db.query(AvailabilityORM).filter(
        AvailabilityORM.user_id == current_user.id, AvailabilityORM.is_active == True
    ).all()

    energy_profiles_orm = db.query(EnergyProfileORM).filter(
        EnergyProfileORM.user_id == current_user.id
    ).all()

    # Map ORM to domain models
    availabilities = [
        Availability(
            id=a.id, user_id=a.user_id,
            day_of_week=DayOfWeek(a.day_of_week),
            start_time=a.start_time, end_time=a.end_time
        ) for a in availabilities_orm
    ]
    energy_profiles = [
        EnergyProfile(
            id=e.id, user_id=e.user_id,
            period=EnergyPeriod(e.period),
            energy_level=e.energy_level
        ) for e in energy_profiles_orm
    ]

    # Map tasks to domain models
    from app.domain.models.task import Task, TaskPriority, TaskStatus, EnergyRequired
    domain_tasks = [
        Task(
            id=t.id, user_id=t.user_id, title=t.title,
            description=t.description,
            priority=TaskPriority(t.priority),
            status=TaskStatus(t.status),
            energy_required=EnergyRequired(t.energy_required),
            estimated_duration_minutes=t.estimated_duration_minutes,
            due_date=t.due_date,
            postpone_count=t.postpone_count,
            tags=t.tags or ""
        ) for t in pending_tasks
    ]

    engine = ClassicPlanningEngine(availabilities, energy_profiles)
    plan = engine.generate_day_plan(domain_tasks, data.target_date)
    overload = engine.detect_overload(domain_tasks, availabilities)

    # Persist slots
    task_repo.delete_slots_for_day(current_user.id, data.target_date)
    slots_response = []
    for slot in plan:
        slot_data = {
            "user_id": current_user.id,
            "task_id": slot.task.id if slot.task else None,
            "start_at": slot.start,
            "end_at": slot.end,
            "is_break": slot.is_break,
            "ai_generated": False
        }
        if slot.task:  # only persist task slots (not breaks without task id)
            task_repo.create_scheduled_slot(slot_data)

        slots_response.append(SlotResponse(
            task_id=slot.task.id if slot.task else None,
            task_title=slot.task.title if slot.task else "☕ Break",
            start_at=slot.start,
            end_at=slot.end,
            is_break=slot.is_break,
            ai_generated=False
        ))

    return PlanResponse(date=data.target_date, slots=slots_response, overload=overload)


# ──── AI Plan ─────────────────────────────────────────────────────────────────
@router.post("/ai/recommend/{task_id}", response_model=AIRecommendationResponse)
def ai_recommend(
    task_id: int,
    data: PlanRequest,
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user)
):
    """
    Use AI to recommend the best time slot for a specific task.
    Returns explanation and confidence score.
    """
    if not current_user.ai_enabled:
        raise HTTPException(status_code=403, detail="AI is disabled for this account")

    task = db.query(TaskORM).filter(TaskORM.id == task_id, TaskORM.user_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    energy_profiles_orm = db.query(EnergyProfileORM).filter(
        EnergyProfileORM.user_id == current_user.id
    ).all()
    availabilities_orm = db.query(AvailabilityORM).filter(
        AvailabilityORM.user_id == current_user.id, AvailabilityORM.is_active == True
    ).all()

    # Build windows for target_date
    day_name = data.target_date.strftime("%A").lower()
    windows = []
    for a in availabilities_orm:
        if a.day_of_week == day_name:
            start_dt = datetime.combine(data.target_date, a.start_time)
            end_dt = datetime.combine(data.target_date, a.end_time)
            windows.append((start_dt, end_dt))

    if not windows:
        raise HTTPException(status_code=400, detail="No availability found for this date")

    planner = SmartPlanner(energy_profiles_orm, [])
    recommendation = planner.recommend_slot(task, windows)
    if not recommendation:
        raise HTTPException(status_code=400, detail="Could not generate recommendation")

    # Persist AI decision
    ai_repo = AIDecisionRepository(db)
    ai_repo.create({
        "user_id": current_user.id,
        "task_id": task_id,
        "model_version": recommendation["model_version"],
        "recommended_slot_start": recommendation["recommended_slot_start"],
        "recommended_slot_end": recommendation["recommended_slot_end"],
        "confidence_score": recommendation["confidence_score"],
        "criteria_used": recommendation["criteria_used"],
        "explanation": recommendation["explanation"],
    })

    return AIRecommendationResponse(task_id=task_id, **{
        k: recommendation[k] for k in recommendation if k != "model_version"
    }, model_version=recommendation["model_version"])


@router.get("/schedule/{target_date}", response_model=List[SlotResponse])
def get_schedule(
    target_date: date,
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user)
):
    """Get the existing scheduled slots for a specific date."""
    task_repo = TaskRepository(db)
    slots = task_repo.get_scheduled_slots(current_user.id, target_date)
    return [
        SlotResponse(
            task_id=s.task_id,
            task_title=s.task.title if s.task else None,
            start_at=s.start_at,
            end_at=s.end_at,
            is_break=s.is_break,
            ai_generated=s.ai_generated
        ) for s in slots
    ]
