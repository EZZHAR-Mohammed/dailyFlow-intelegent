from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime, date, time
from enum import Enum


# ──── Auth ────────────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshRequest(BaseModel):
    refresh_token: str

class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    role: str
    is_active: bool
    ai_enabled: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ──── Task ────────────────────────────────────────────────────────────────────
class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    priority: str = Field(default="medium", pattern="^(low|medium|high|critical)$")
    energy_required: str = Field(default="medium", pattern="^(low|medium|high)$")
    estimated_duration_minutes: int = Field(..., ge=5, le=480)
    due_date: Optional[date] = None
    tags: Optional[str] = ""

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    energy_required: Optional[str] = None
    estimated_duration_minutes: Optional[int] = None
    due_date: Optional[date] = None
    status: Optional[str] = None
    tags: Optional[str] = None

class TaskResponse(BaseModel):
    id: int
    user_id: int
    title: str
    description: Optional[str]
    priority: str
    status: str
    energy_required: str
    estimated_duration_minutes: int
    due_date: Optional[date]
    scheduled_at: Optional[datetime]
    completed_at: Optional[datetime]
    postpone_count: int
    tags: str
    created_at: datetime

    class Config:
        from_attributes = True


# ──── Availability ────────────────────────────────────────────────────────────
class AvailabilityCreate(BaseModel):
    day_of_week: str = Field(..., pattern="^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$")
    start_time: time
    end_time: time

class AvailabilityResponse(BaseModel):
    id: int
    user_id: int
    day_of_week: str
    start_time: time
    end_time: time
    is_active: bool

    class Config:
        from_attributes = True


# ──── Energy Profile ──────────────────────────────────────────────────────────
class EnergyProfileCreate(BaseModel):
    period: str = Field(..., pattern="^(morning|afternoon|evening|night)$")
    energy_level: int = Field(..., ge=1, le=10)

class EnergyProfileResponse(BaseModel):
    id: int
    period: str
    energy_level: int
    updated_at: datetime

    class Config:
        from_attributes = True


# ──── Planning ────────────────────────────────────────────────────────────────
class PlanRequest(BaseModel):
    target_date: date
    earliest_start: Optional[datetime] = None   # for AI multi-task: start after previous task ends

class SlotResponse(BaseModel):
    task_id: Optional[int]
    task_title: Optional[str]
    start_at: datetime
    end_at: datetime
    is_break: bool
    ai_generated: bool

class PlanResponse(BaseModel):
    date: date
    slots: List[SlotResponse]
    overload: Dict[str, Any]

class AIRecommendationResponse(BaseModel):
    task_id: int
    recommended_slot_start: datetime
    recommended_slot_end: datetime
    confidence_score: float
    criteria_used: Dict[str, Any]
    explanation: str
    model_version: str


# ──── Task Execution ──────────────────────────────────────────────────────────
class ExecutionCreate(BaseModel):
    started_at: datetime
    ended_at: Optional[datetime] = None
    actual_duration_minutes: Optional[int] = None
    energy_level_during: Optional[int] = Field(None, ge=1, le=10)
    focus_score: Optional[int] = Field(None, ge=1, le=10)
    notes: Optional[str] = None

class ExecutionResponse(BaseModel):
    id: int
    task_id: int
    started_at: datetime
    ended_at: Optional[datetime]
    actual_duration_minutes: Optional[int]
    energy_level_during: Optional[int]
    focus_score: Optional[int]
    notes: Optional[str]

    class Config:
        from_attributes = True


# ──── Scores ──────────────────────────────────────────────────────────────────
class ScoreResponse(BaseModel):
    id: int
    score_date: date
    score_type: str
    total_score: float
    discipline_score: float
    focus_score: float
    energy_alignment_rate: float
    completion_rate: float
    burnout_risk_index: float
    tasks_completed: int
    tasks_postponed: int
    tasks_total: int
    burnout_label: str

    class Config:
        from_attributes = True


# ──── Notifications ───────────────────────────────────────────────────────────
class NotificationResponse(BaseModel):
    id: int
    notification_type: str
    title: str
    body: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ──── Generic ─────────────────────────────────────────────────────────────────
class MessageResponse(BaseModel):
    message: str

class PaginatedResponse(BaseModel):
    total: int
    items: List[Any]


# ──── Manual Planning ─────────────────────────────────────────────────────────
class ManualSlotInput(BaseModel):
    task_id: Optional[int] = None
    start_at: datetime
    end_at: datetime
    is_break: bool = False
    ai_generated: bool = False

class SaveManualPlanRequest(BaseModel):
    target_date: date
    slots: List[ManualSlotInput]
    source: str = "manual"   # "manual" | "ai" — determines which slots to replace
