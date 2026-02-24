from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import date, datetime, timedelta
from app.infrastructure.database.models import ScoreORM, AIDecisionORM, NotificationORM


class ScoreRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_daily(self, user_id: int, score_date: date) -> Optional[ScoreORM]:
        return self.db.query(ScoreORM).filter(
            ScoreORM.user_id == user_id,
            ScoreORM.score_date == score_date,
            ScoreORM.score_type == "daily"
        ).first()

    def create_or_update(self, user_id: int, score_date: date, score_type: str, data: dict) -> ScoreORM:
        existing = self.db.query(ScoreORM).filter(
            ScoreORM.user_id == user_id,
            ScoreORM.score_date == score_date,
            ScoreORM.score_type == score_type
        ).first()
        if existing:
            for k, v in data.items():
                setattr(existing, k, v)
            self.db.commit()
            self.db.refresh(existing)
            return existing
        score = ScoreORM(user_id=user_id, score_date=score_date, score_type=score_type, **data)
        self.db.add(score)
        self.db.commit()
        self.db.refresh(score)
        return score

    def get_last_n_days(self, user_id: int, n: int = 30) -> List[ScoreORM]:
        since = date.today() - timedelta(days=n)
        return self.db.query(ScoreORM).filter(
            ScoreORM.user_id == user_id,
            ScoreORM.score_date >= since,
            ScoreORM.score_type == "daily"
        ).order_by(ScoreORM.score_date).all()


class AIDecisionRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, data: dict) -> AIDecisionORM:
        decision = AIDecisionORM(**data)
        self.db.add(decision)
        self.db.commit()
        self.db.refresh(decision)
        return decision

    def list_for_task(self, task_id: int) -> List[AIDecisionORM]:
        return self.db.query(AIDecisionORM).filter(AIDecisionORM.task_id == task_id).all()

    def update_acceptance(self, decision_id: int, accepted: bool):
        decision = self.db.query(AIDecisionORM).filter(AIDecisionORM.id == decision_id).first()
        if decision:
            decision.accepted_by_user = accepted
            self.db.commit()


class NotificationRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, user_id: int, data: dict) -> NotificationORM:
        notif = NotificationORM(user_id=user_id, **data)
        self.db.add(notif)
        self.db.commit()
        self.db.refresh(notif)
        return notif

    def list_for_user(self, user_id: int, unread_only: bool = False) -> List[NotificationORM]:
        q = self.db.query(NotificationORM).filter(NotificationORM.user_id == user_id)
        if unread_only:
            q = q.filter(NotificationORM.is_read == False)
        return q.order_by(NotificationORM.created_at.desc()).all()

    def mark_read(self, notif_id: int, user_id: int):
        notif = self.db.query(NotificationORM).filter(
            NotificationORM.id == notif_id,
            NotificationORM.user_id == user_id
        ).first()
        if notif:
            notif.is_read = True
            self.db.commit()
