from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
from enum import Enum


class UserRole(str, Enum):
    USER = "user"
    ADMIN = "admin"


class EnergyLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


@dataclass
class User:
    id: Optional[int]
    email: str
    username: str
    hashed_password: str
    role: UserRole = UserRole.USER
    is_active: bool = True
    ai_enabled: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def deactivate(self):
        self.is_active = False
        self.updated_at = datetime.utcnow()

    def disable_ai(self):
        self.ai_enabled = False

    def enable_ai(self):
        self.ai_enabled = True

    def is_admin(self) -> bool:
        return self.role == UserRole.ADMIN
