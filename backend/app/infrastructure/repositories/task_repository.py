from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import date, datetime
from app.infrastructure.database.models import TaskORM, TaskExecutionORM, ScheduledSlotORM


class TaskRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, task_id: int, user_id: int) -> Optional[TaskORM]:
        return self.db.query(TaskORM).filter(
            TaskORM.id == task_id, TaskORM.user_id == user_id
        ).first()

    def list_by_user(self, user_id: int, status: str = None, priority: str = None) -> List[TaskORM]:
        q = self.db.query(TaskORM).filter(TaskORM.user_id == user_id)
        if status:
            q = q.filter(TaskORM.status == status)
        if priority:
            q = q.filter(TaskORM.priority == priority)
        return q.order_by(TaskORM.created_at.desc()).all()

    def create(self, user_id: int, data: dict) -> TaskORM:
        task = TaskORM(user_id=user_id, **data)
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task

    def update(self, task: TaskORM) -> TaskORM:
        task.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(task)
        return task

    def delete(self, task_id: int, user_id: int):
        task = self.get_by_id(task_id, user_id)
        if task:
            self.db.delete(task)
            self.db.commit()

    def get_pending_tasks(self, user_id: int) -> List[TaskORM]:
        return self.db.query(TaskORM).filter(
            TaskORM.user_id == user_id,
            TaskORM.status.in_(["pending", "postponed"])
        ).all()

    def get_tasks_for_date(self, user_id: int, target_date: date) -> List[TaskORM]:
        return self.db.query(TaskORM).filter(
            TaskORM.user_id == user_id,
            TaskORM.due_date == target_date
        ).all()

    def create_execution(self, user_id: int, task_id: int, data: dict) -> TaskExecutionORM:
        exec_obj = TaskExecutionORM(user_id=user_id, task_id=task_id, **data)
        self.db.add(exec_obj)
        self.db.commit()
        self.db.refresh(exec_obj)
        return exec_obj

    def get_executions(self, user_id: int, task_id: int) -> List[TaskExecutionORM]:
        return self.db.query(TaskExecutionORM).filter(
            TaskExecutionORM.user_id == user_id,
            TaskExecutionORM.task_id == task_id
        ).all()

    def get_scheduled_slots(self, user_id: int, day: date) -> List[ScheduledSlotORM]:
        start = datetime.combine(day, datetime.min.time())
        end = datetime.combine(day, datetime.max.time())
        return self.db.query(ScheduledSlotORM).filter(
            ScheduledSlotORM.user_id == user_id,
            ScheduledSlotORM.start_at >= start,
            ScheduledSlotORM.end_at <= end
        ).order_by(ScheduledSlotORM.start_at).all()

    def create_scheduled_slot(self, data: dict) -> ScheduledSlotORM:
        slot = ScheduledSlotORM(**data)
        self.db.add(slot)
        self.db.commit()
        self.db.refresh(slot)
        return slot

    def delete_slots_for_day(self, user_id: int, day: date):
        start = datetime.combine(day, datetime.min.time())
        end = datetime.combine(day, datetime.max.time())
        self.db.query(ScheduledSlotORM).filter(
            ScheduledSlotORM.user_id == user_id,
            ScheduledSlotORM.start_at >= start,
            ScheduledSlotORM.end_at <= end
        ).delete()
        self.db.commit()
