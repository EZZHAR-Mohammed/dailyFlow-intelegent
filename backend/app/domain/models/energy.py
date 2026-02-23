from dataclasses import dataclass, field
from datetime import datetime, time
from typing import Optional
from enum import Enum


class DayOfWeek(str, Enum):
    MONDAY = "monday"
    TUESDAY = "tuesday"
    WEDNESDAY = "wednesday"
    THURSDAY = "thursday"
    FRIDAY = "friday"
    SATURDAY = "saturday"
    SUNDAY = "sunday"


@dataclass
class Availability:
    """Recurring time slot where user is available to work."""
    id: Optional[int]
    user_id: int
    day_of_week: DayOfWeek
    start_time: time
    end_time: time
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)

    def duration_minutes(self) -> int:
        start = datetime.combine(datetime.today(), self.start_time)
        end = datetime.combine(datetime.today(), self.end_time)
        return int((end - start).total_seconds() / 60)

    def overlaps_with(self, other: "Availability") -> bool:
        if self.day_of_week != other.day_of_week:
            return False
        return self.start_time < other.end_time and other.start_time < self.end_time


class EnergyPeriod(str, Enum):
    MORNING = "morning"      # 06-12
    AFTERNOON = "afternoon"  # 12-18
    EVENING = "evening"      # 18-22
    NIGHT = "night"          # 22-06


@dataclass
class EnergyProfile:
    """User's typical energy level per period."""
    id: Optional[int]
    user_id: int
    period: EnergyPeriod
    energy_level: int  # 1-10
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def matches_task_energy(self, required: str) -> bool:
        mapping = {"low": (1, 4), "medium": (4, 7), "high": (7, 10)}
        lo, hi = mapping.get(required, (1, 10))
        return lo <= self.energy_level <= hi

    @staticmethod
    def hour_to_period(hour: int) -> EnergyPeriod:
        if 6 <= hour < 12:
            return EnergyPeriod.MORNING
        elif 12 <= hour < 18:
            return EnergyPeriod.AFTERNOON
        elif 18 <= hour < 22:
            return EnergyPeriod.EVENING
        else:
            return EnergyPeriod.NIGHT
