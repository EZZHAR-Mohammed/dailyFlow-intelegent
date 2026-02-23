"""
Classic Planning Engine — Pure domain logic, no framework dependency.
Sorts tasks by composite score, aligns with energy, adds micro-breaks.
"""
from datetime import datetime, timedelta, time, date
from typing import List, Tuple, Dict, Optional
from app.domain.models.task import Task, EnergyRequired
from app.domain.models.energy import Availability, EnergyProfile, EnergyPeriod
from app.infrastructure.database.models import ScheduledSlotORM

BREAK_AFTER_MINUTES = 90   # Insert a 10-min break after every 90 min of work
BREAK_DURATION_MINUTES = 10


class PlanningSlot:
    def __init__(self, start: datetime, end: datetime, task: Optional[Task] = None, is_break: bool = False):
        self.start = start
        self.end = end
        self.task = task
        self.is_break = is_break

    def duration_minutes(self) -> int:
        return int((self.end - self.start).total_seconds() / 60)


class ClassicPlanningEngine:
    def __init__(self, availabilities: List[Availability], energy_profiles: List[EnergyProfile]):
        self.availabilities = [a for a in availabilities if a.is_active]
        self.energy_map: Dict[EnergyPeriod, int] = {
            ep.period: ep.energy_level for ep in energy_profiles
        }

    # ──── Public API ──────────────────────────────────────────────────────────
    def generate_day_plan(
        self,
        tasks: List[Task],
        target_date: date,
        existing_slots: List = None
    ) -> List[PlanningSlot]:
        """
        Returns a list of PlanningSlots for target_date.
        """
        day_name = target_date.strftime("%A").lower()
        windows = self._get_time_windows(day_name, target_date)
        if not windows:
            return []

        sorted_tasks = self._sort_tasks(tasks)
        plan = self._assign_tasks(sorted_tasks, windows)
        return plan

    # ──── Private helpers ─────────────────────────────────────────────────────
    def _get_time_windows(self, day_name: str, target_date: date) -> List[Tuple[datetime, datetime]]:
        windows = []
        for avail in self.availabilities:
            if avail.day_of_week.value == day_name:
                start_dt = datetime.combine(target_date, avail.start_time)
                end_dt = datetime.combine(target_date, avail.end_time)
                windows.append((start_dt, end_dt))
        windows.sort(key=lambda x: x[0])
        return windows

    def _sort_tasks(self, tasks: List[Task]) -> List[Task]:
        return sorted(tasks, key=lambda t: t.composite_score(), reverse=True)

    def _energy_level_at(self, dt: datetime) -> int:
        period = EnergyProfile.hour_to_period(dt.hour)
        return self.energy_map.get(period, 5)

    def _energy_matches_task(self, task: Task, dt: datetime) -> bool:
        energy_at = self._energy_level_at(dt)
        required = task.energy_required.value
        thresholds = {"high": 7, "medium": 4, "low": 1}
        return energy_at >= thresholds.get(required, 1)

    def _assign_tasks(
        self, tasks: List[Task], windows: List[Tuple[datetime, datetime]]
    ) -> List[PlanningSlot]:
        plan: List[PlanningSlot] = []
        unscheduled = list(tasks)
        cumulative_work = 0  # minutes since last break

        for win_start, win_end in windows:
            cursor = win_start

            while cursor < win_end and unscheduled:
                # Insert break if needed
                if cumulative_work >= BREAK_AFTER_MINUTES:
                    break_end = cursor + timedelta(minutes=BREAK_DURATION_MINUTES)
                    if break_end <= win_end:
                        plan.append(PlanningSlot(cursor, break_end, is_break=True))
                        cursor = break_end
                        cumulative_work = 0
                    else:
                        break

                # Find best task for this moment
                best = self._pick_best_task(unscheduled, cursor)
                if not best:
                    cursor += timedelta(minutes=15)
                    continue

                task_end = cursor + timedelta(minutes=best.estimated_duration_minutes)

                # Detect overload
                if task_end > win_end:
                    # Try to fit a shorter pending task
                    remaining = int((win_end - cursor).total_seconds() / 60)
                    shorter = next(
                        (t for t in unscheduled if t.estimated_duration_minutes <= remaining and t != best),
                        None
                    )
                    if shorter:
                        best = shorter
                        task_end = cursor + timedelta(minutes=best.estimated_duration_minutes)
                    else:
                        break  # No task fits in remaining window

                plan.append(PlanningSlot(cursor, task_end, task=best))
                unscheduled.remove(best)
                cumulative_work += best.estimated_duration_minutes
                cursor = task_end

        return plan

    def _pick_best_task(self, tasks: List[Task], at: datetime) -> Optional[Task]:
        """Pick the highest-score task that matches current energy."""
        energy_matched = [t for t in tasks if self._energy_matches_task(t, at)]
        if energy_matched:
            return energy_matched[0]
        # Fallback: pick highest score regardless of energy
        return tasks[0] if tasks else None

    def detect_overload(self, tasks: List[Task], availabilities: List[Availability]) -> Dict:
        total_task_minutes = sum(t.estimated_duration_minutes for t in tasks)
        total_available_minutes = sum(a.duration_minutes() for a in availabilities if a.is_active)
        overloaded = total_task_minutes > total_available_minutes
        return {
            "overloaded": overloaded,
            "total_task_minutes": total_task_minutes,
            "total_available_minutes": total_available_minutes,
            "excess_minutes": max(0, total_task_minutes - total_available_minutes)
        }
