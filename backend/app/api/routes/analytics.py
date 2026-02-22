from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date, datetime, timedelta
from typing import List, Dict, Any
from app.infrastructure.database.session import get_db
from app.infrastructure.database.models import UserORM, TaskORM, TaskExecutionORM
from app.infrastructure.repositories.score_repository import ScoreRepository
from app.domain.services.score_calculator import ScoreCalculator
from app.api.dependencies.auth import get_current_user
from app.api.schemas import ScoreResponse, MessageResponse
from app.core.logging import get_logger

router = APIRouter(prefix="/analytics", tags=["Analytics & Scores"])
logger = get_logger(__name__)


def _compute_and_save(user_id: int, target_date: date, db: Session) -> ScoreResponse:
    tasks = db.query(TaskORM).filter(TaskORM.user_id == user_id).all()
    day_tasks = [t for t in tasks if t.due_date == target_date or (
        t.completed_at and t.completed_at.date() == target_date
    )]
    executions = db.query(TaskExecutionORM).filter(
        TaskExecutionORM.user_id == user_id,
        TaskExecutionORM.started_at >= datetime.combine(target_date, datetime.min.time()),
        TaskExecutionORM.started_at <= datetime.combine(target_date, datetime.max.time()),
    ).all()

    calc = ScoreCalculator()
    score_data = calc.compute_daily_score(day_tasks, executions, target_date)

    repo = ScoreRepository(db)
    score_orm = repo.create_or_update(user_id, target_date, "daily", score_data)

    return ScoreResponse(
        id=score_orm.id,
        score_date=score_orm.score_date,
        score_type=score_orm.score_type,
        total_score=score_orm.total_score,
        discipline_score=score_orm.discipline_score,
        focus_score=score_orm.focus_score,
        energy_alignment_rate=score_orm.energy_alignment_rate,
        completion_rate=score_orm.completion_rate,
        burnout_risk_index=score_orm.burnout_risk_index,
        tasks_completed=score_orm.tasks_completed,
        tasks_postponed=score_orm.tasks_postponed,
        tasks_total=score_orm.tasks_total,
        burnout_label="HIGH" if score_orm.burnout_risk_index >= 0.75 else (
            "MEDIUM" if score_orm.burnout_risk_index >= 0.45 else "LOW"
        )
    )


@router.get("/daily", response_model=ScoreResponse)
def get_daily_score(
    target_date: date = Query(default_factory=date.today),
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user)
):
    """Compute and return the daily score for a given date."""
    return _compute_and_save(current_user.id, target_date, db)


@router.get("/weekly", response_model=Dict[str, Any])
def get_weekly_score(
    week_start: date = Query(default_factory=lambda: date.today() - timedelta(days=date.today().weekday())),
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user)
):
    """Compute weekly aggregated scores."""
    daily_scores = []
    calc = ScoreCalculator()

    for i in range(7):
        day = week_start + timedelta(days=i)
        score_resp = _compute_and_save(current_user.id, day, db)
        daily_scores.append({
            "total_score": score_resp.total_score,
            "discipline_score": score_resp.discipline_score,
            "focus_score": score_resp.focus_score,
            "energy_alignment_rate": score_resp.energy_alignment_rate,
            "completion_rate": score_resp.completion_rate,
            "burnout_risk_index": score_resp.burnout_risk_index,
            "tasks_completed": score_resp.tasks_completed,
            "tasks_postponed": score_resp.tasks_postponed,
            "tasks_total": score_resp.tasks_total,
        })

    weekly = calc.compute_weekly_score(daily_scores)
    weekly["week_start"] = str(week_start)
    weekly["week_end"] = str(week_start + timedelta(days=6))
    weekly["burnout_label"] = "HIGH" if weekly["burnout_risk_index"] >= 0.75 else (
        "MEDIUM" if weekly["burnout_risk_index"] >= 0.45 else "LOW"
    )
    return weekly


@router.get("/trends", response_model=List[Dict[str, Any]])
def get_trends(
    days: int = Query(default=30, ge=7, le=90),
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user)
):
    """Get score trends for the last N days."""
    repo = ScoreRepository(db)
    scores = repo.get_last_n_days(current_user.id, days)
    return [
        {
            "date": str(s.score_date),
            "total_score": s.total_score,
            "discipline_score": s.discipline_score,
            "burnout_risk_index": s.burnout_risk_index,
            "completion_rate": s.completion_rate,
            "burnout_label": "HIGH" if s.burnout_risk_index >= 0.75 else (
                "MEDIUM" if s.burnout_risk_index >= 0.45 else "LOW"
            )
        }
        for s in scores
    ]


@router.get("/burnout-prediction", response_model=Dict[str, Any])
def predict_burnout(
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user)
):
    """Predict future burnout risk based on recent trends."""
    repo = ScoreRepository(db)
    last_14 = repo.get_last_n_days(current_user.id, 14)

    if not last_14:
        return {"prediction": "insufficient_data", "risk_level": "UNKNOWN", "message": "Not enough data yet"}

    avg_burnout = sum(s.burnout_risk_index for s in last_14) / len(last_14)
    recent_5 = last_14[-5:] if len(last_14) >= 5 else last_14
    trend = sum(s.burnout_risk_index for s in recent_5) / len(recent_5) - avg_burnout

    predicted = min(1.0, avg_burnout + trend * 2)

    label = "HIGH" if predicted >= 0.75 else ("MEDIUM" if predicted >= 0.45 else "LOW")
    recommendation = {
        "HIGH": "⚠️ Risque élevé d'épuisement. Réduisez votre charge de travail immédiatement.",
        "MEDIUM": "⚡ Attention. Prenez des pauses régulières et limitez les tâches critiques.",
        "LOW": "✅ Vous êtes sur une bonne trajectoire. Continuez ainsi !",
    }

    return {
        "predicted_burnout_risk": round(predicted, 2),
        "risk_level": label,
        "trend": "increasing" if trend > 0.05 else ("decreasing" if trend < -0.05 else "stable"),
        "recommendation": recommendation[label],
        "based_on_days": len(last_14)
    }
