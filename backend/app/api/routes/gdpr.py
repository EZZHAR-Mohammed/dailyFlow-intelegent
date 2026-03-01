from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime
from app.infrastructure.database.session import get_db
from app.infrastructure.database.models import (
    UserORM, TaskORM, ScoreORM, NotificationORM, TaskExecutionORM,
    AvailabilityORM, EnergyProfileORM
)
from app.api.dependencies.auth import get_current_user
from app.api.schemas import MessageResponse

router = APIRouter(prefix="/gdpr", tags=["GDPR & Privacy"])


@router.get("/export")
def export_my_data(
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user)
):
    """Export all personal data (GDPR Article 20 - Data Portability)."""
    tasks = db.query(TaskORM).filter(TaskORM.user_id == current_user.id).all()
    scores = db.query(ScoreORM).filter(ScoreORM.user_id == current_user.id).all()
    executions = db.query(TaskExecutionORM).filter(TaskExecutionORM.user_id == current_user.id).all()
    availabilities = db.query(AvailabilityORM).filter(AvailabilityORM.user_id == current_user.id).all()
    energy_profiles = db.query(EnergyProfileORM).filter(EnergyProfileORM.user_id == current_user.id).all()

    export = {
        "exported_at": datetime.utcnow().isoformat(),
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "username": current_user.username,
            "created_at": current_user.created_at.isoformat(),
            "ai_enabled": getattr(current_user, "ai_enabled", False),
        },
        "tasks": [
            {
                "id": t.id, "title": t.title, "status": t.status,
                "priority": t.priority, "due_date": str(t.due_date) if t.due_date else None,
                "estimated_duration_minutes": t.estimated_duration_minutes,
                "created_at": t.created_at.isoformat()
            } for t in tasks
        ],
        "scores": [
            {
                "date": str(s.score_date), "total_score": s.total_score,
                "burnout_risk": s.burnout_risk_index
            } for s in scores
        ],
        "executions": [
            {
                "task_id": e.task_id, "started_at": e.started_at.isoformat(),
                "focus_score": e.focus_score, "energy_level": e.energy_level_during
            } for e in executions
        ],
        "availabilities": [
            {
                "id": a.id, "day_of_week": a.day_of_week,
                "start_time": a.start_time.strftime("%H:%M") if a.start_time else None, "end_time": a.end_time.strftime("%H:%M") if a.end_time else None
            } for a in availabilities
        ],
        "energy_profiles": [
            {
                "id": e.id, "period": e.period, "energy_level": e.energy_level
            } for e in energy_profiles
        ]
    }
    return JSONResponse(content=export)


@router.delete("/delete-account", response_model=MessageResponse)
def delete_account(
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user)
):
    """
    Permanently delete account and all associated data (GDPR Article 17 - Right to Erasure).
    This action is irreversible.
    """
    user_id = current_user.id
    db.delete(current_user)  # cascade deletes all related data
    db.commit()
    return MessageResponse(message=f"Account {user_id} permanently deleted. All data erased.")
