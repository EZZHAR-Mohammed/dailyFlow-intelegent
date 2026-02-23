from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Optional
from enum import Enum


class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TaskStatus(str, Enum):
    PENDING = "pending"
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    POSTPONED = "postponed"
    CANCELLED = "cancelled"


class EnergyRequired(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


@dataclass
class Task:
    id: Optional[int]
    user_id: int
    title: str
    description: Optional[str]
    priority: TaskPriority
    status: TaskStatus
    energy_required: EnergyRequired
    estimated_duration_minutes: int
    due_date: Optional[date]
    scheduled_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    postpone_count: int = 0
    tags: str = ""  # comma-separated
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    # ──── Business Rules ────────────────────────────────────────────
    def priority_weight(self) -> float:
        weights = {
            TaskPriority.LOW: 1.0,
            TaskPriority.MEDIUM: 2.0,
            TaskPriority.HIGH: 3.5,
            TaskPriority.CRITICAL: 5.0,
        }
        return weights[self.priority]

    def postpone_penalty(self) -> float:
        """Each postpone reduces effective score."""
        return max(0.0, 1.0 - self.postpone_count * 0.15)

    def urgency_score(self) -> float:
        """Urgency increases as due_date approaches."""
        if not self.due_date:
            return 0.5
        days_left = (self.due_date - date.today()).days
        if days_left <= 0:
            return 2.0
        if days_left <= 1:
            return 1.8
        if days_left <= 3:
            return 1.4
        if days_left <= 7:
            return 1.1
        return 1.0

    def composite_score(self) -> float:
        return self.priority_weight() * self.urgency_score() * self.postpone_penalty()

    def mark_done(self):
        self.status = TaskStatus.DONE
        self.completed_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def postpone(self):
        self.status = TaskStatus.POSTPONED
        self.postpone_count += 1
        self.scheduled_at = None
        self.updated_at = datetime.utcnow()

    def is_overdue(self) -> bool:
        if not self.due_date:
            return False
        return date.today() > self.due_date and self.status != TaskStatus.DONE

    def requires_high_energy(self) -> bool:
        return self.energy_required == EnergyRequired.HIGH
