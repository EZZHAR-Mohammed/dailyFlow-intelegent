from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Optional, Dict, Any
from enum import Enum


# ──── Schedule ────────────────────────────────────────────────────────────────
@dataclass
class ScheduledSlot:
    id: Optional[int]
    user_id: int
    task_id: int
    start_at: datetime
    end_at: datetime
    is_break: bool = False
    ai_generated: bool = False
    created_at: datetime = field(default_factory=datetime.utcnow)

    def duration_minutes(self) -> int:
        return int((self.end_at - self.start_at).total_seconds() / 60)

    def overlaps_with(self, other: "ScheduledSlot") -> bool:
        return self.start_at < other.end_at and other.start_at < self.end_at


# ──── Task Execution ──────────────────────────────────────────────────────────
@dataclass
class TaskExecution:
    id: Optional[int]
    user_id: int
    task_id: int
    started_at: datetime
    ended_at: Optional[datetime]
    actual_duration_minutes: Optional[int]
    energy_level_during: Optional[int]  # 1-10
    focus_score: Optional[int]          # 1-10
    notes: Optional[str]
    created_at: datetime = field(default_factory=datetime.utcnow)

    def efficiency_ratio(self, estimated_minutes: int) -> float:
        if not self.actual_duration_minutes or estimated_minutes == 0:
            return 0.0
        return estimated_minutes / self.actual_duration_minutes


# ──── Score ───────────────────────────────────────────────────────────────────
class ScoreType(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"


@dataclass
class Score:
    id: Optional[int]
    user_id: int
    score_date: date
    score_type: ScoreType
    total_score: float
    discipline_score: float
    focus_score: float
    energy_alignment_rate: float
    completion_rate: float
    burnout_risk_index: float
    tasks_completed: int
    tasks_postponed: int
    tasks_total: int
    created_at: datetime = field(default_factory=datetime.utcnow)

    def burnout_risk_label(self) -> str:
        if self.burnout_risk_index >= 0.75:
            return "HIGH"
        elif self.burnout_risk_index >= 0.45:
            return "MEDIUM"
        return "LOW"


# ──── Notification ────────────────────────────────────────────────────────────
class NotificationType(str, Enum):
    REMINDER = "reminder"
    PLANNING = "planning"
    ACHIEVEMENT = "achievement"
    WARNING = "warning"
    BURNOUT_ALERT = "burnout_alert"


@dataclass
class Notification:
    id: Optional[int]
    user_id: int
    notification_type: NotificationType
    title: str
    body: str
    is_read: bool = False
    sent_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.utcnow)


# ──── AI Decision ─────────────────────────────────────────────────────────────
@dataclass
class AIDecision:
    id: Optional[int]
    user_id: int
    task_id: int
    model_version: str
    recommended_slot_start: datetime
    recommended_slot_end: datetime
    confidence_score: float          # 0-1
    criteria_used: Dict[str, Any]    # e.g. {"energy_match": 0.9, "priority": 5.0}
    explanation: str
    accepted_by_user: Optional[bool] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
