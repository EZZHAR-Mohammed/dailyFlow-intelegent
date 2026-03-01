from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Date, Time,
    Float, Text, ForeignKey, Enum as SAEnum, JSON
)
from sqlalchemy.orm import relationship
from datetime import datetime
from app.infrastructure.database.session import Base


class UserORM(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(SAEnum("user", "admin"), default="user")
    is_active = Column(Boolean, default=True)
    ai_enabled = Column(Boolean, default=True)
    email_verified = Column(Boolean, default=False)          # must verify email before login
    email_verify_token = Column(String(255), nullable=True)  # one-time token sent by email
    terms_accepted = Column(Boolean, default=False)          # user accepted CGU at register
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tasks = relationship("TaskORM", back_populates="user", cascade="all, delete-orphan")
    scores = relationship("ScoreORM", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("NotificationORM", back_populates="user", cascade="all, delete-orphan")
    refresh_tokens = relationship("RefreshTokenORM", back_populates="user", cascade="all, delete-orphan")
    energy_profiles = relationship("EnergyProfileORM", back_populates="user", cascade="all, delete-orphan")
    availabilities = relationship("AvailabilityORM", back_populates="user", cascade="all, delete-orphan")


class RefreshTokenORM(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(Text, nullable=False, index=False)
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("UserORM", back_populates="refresh_tokens")


class AuditLogORM(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False)
    resource = Column(String(100))
    resource_id = Column(Integer)
    details = Column(JSON)
    ip_address = Column(String(45))
    created_at = Column(DateTime, default=datetime.utcnow)


class TaskORM(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    priority = Column(SAEnum("low", "medium", "high", "critical"), default="medium")
    status = Column(SAEnum("pending", "scheduled", "in_progress", "done", "postponed", "cancelled"), default="pending")
    energy_required = Column(SAEnum("low", "medium", "high"), default="medium")
    estimated_duration_minutes = Column(Integer, nullable=False)
    due_date = Column(Date)
    scheduled_at = Column(DateTime)
    completed_at = Column(DateTime)
    postpone_count = Column(Integer, default=0)
    tags = Column(String(500), default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("UserORM", back_populates="tasks")
    executions = relationship("TaskExecutionORM", back_populates="task", cascade="all, delete-orphan")
    scheduled_slots = relationship("ScheduledSlotORM", back_populates="task", cascade="all, delete-orphan")
    ai_decisions = relationship("AIDecisionORM", back_populates="task", cascade="all, delete-orphan")


class AvailabilityORM(Base):
    __tablename__ = "availabilities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    day_of_week = Column(SAEnum("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"))
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("UserORM", back_populates="availabilities")


class EnergyProfileORM(Base):
    __tablename__ = "energy_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    period = Column(SAEnum("morning", "afternoon", "evening", "night"), nullable=False)
    energy_level = Column(Integer, nullable=False)  # 1-10
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("UserORM", back_populates="energy_profiles")


class ScheduledSlotORM(Base):
    __tablename__ = "scheduled_slots"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)
    start_at = Column(DateTime, nullable=False)
    end_at = Column(DateTime, nullable=False)
    is_break = Column(Boolean, default=False)
    ai_generated = Column(Boolean, default=False)
    # source: 'manual' | 'ai' | 'auto' (classic engine)
    source = Column(SAEnum("manual", "ai", "auto"), default="manual")
    # notification_sent: True once the start reminder has been fired
    notification_sent = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("TaskORM", back_populates="scheduled_slots", foreign_keys="ScheduledSlotORM.task_id")


class TaskExecutionORM(Base):
    __tablename__ = "task_executions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    started_at = Column(DateTime, nullable=False)
    ended_at = Column(DateTime)
    actual_duration_minutes = Column(Integer)
    energy_level_during = Column(Integer)
    focus_score = Column(Integer)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("TaskORM", back_populates="executions")


class ScoreORM(Base):
    __tablename__ = "scores"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    score_date = Column(Date, nullable=False)
    score_type = Column(SAEnum("daily", "weekly"), default="daily")
    total_score = Column(Float, default=0.0)
    discipline_score = Column(Float, default=0.0)
    focus_score = Column(Float, default=0.0)
    energy_alignment_rate = Column(Float, default=0.0)
    completion_rate = Column(Float, default=0.0)
    burnout_risk_index = Column(Float, default=0.0)
    tasks_completed = Column(Integer, default=0)
    tasks_postponed = Column(Integer, default=0)
    tasks_total = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("UserORM", back_populates="scores")


class NotificationORM(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    notification_type = Column(SAEnum("reminder", "planning", "achievement", "warning", "burnout_alert"))
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    sent_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("UserORM", back_populates="notifications")


class AIDecisionORM(Base):
    __tablename__ = "ai_decisions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    model_version = Column(String(50), default="heuristic-v1")
    recommended_slot_start = Column(DateTime, nullable=False)
    recommended_slot_end = Column(DateTime, nullable=False)
    confidence_score = Column(Float, default=0.0)
    criteria_used = Column(JSON)
    explanation = Column(Text)
    accepted_by_user = Column(Boolean)
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("TaskORM", back_populates="ai_decisions")
