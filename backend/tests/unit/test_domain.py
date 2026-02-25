"""
Unit tests for domain models and services.
No database, no framework — pure Python.
"""
import pytest
from datetime import date, datetime, time, timedelta
from unittest.mock import MagicMock

from app.domain.models.task import Task, TaskPriority, TaskStatus, EnergyRequired
from app.domain.models.energy import Availability, EnergyProfile, EnergyPeriod, DayOfWeek
from app.domain.services.planning_engine import ClassicPlanningEngine
from app.domain.services.score_calculator import ScoreCalculator


# ──── Task domain tests ───────────────────────────────────────────────────────
class TestTaskDomain:

    def make_task(self, priority=TaskPriority.HIGH, due_days=3, postpone=0):
        return Task(
            id=1, user_id=1, title="Test Task",
            description=None,
            priority=priority,
            status=TaskStatus.PENDING,
            energy_required=EnergyRequired.HIGH,
            estimated_duration_minutes=60,
            due_date=date.today() + timedelta(days=due_days),
            postpone_count=postpone
        )

    def test_priority_weight_critical_highest(self):
        t = self.make_task(TaskPriority.CRITICAL)
        assert t.priority_weight() == 5.0

    def test_postpone_penalty_reduces_score(self):
        t_clean = self.make_task(postpone=0)
        t_postponed = self.make_task(postpone=3)
        assert t_clean.postpone_penalty() > t_postponed.postpone_penalty()

    def test_urgency_increases_near_deadline(self):
        urgent = self.make_task(due_days=0)
        far = self.make_task(due_days=30)
        assert urgent.urgency_score() > far.urgency_score()

    def test_composite_score_combines_all(self):
        t = self.make_task(priority=TaskPriority.CRITICAL, due_days=1, postpone=0)
        assert t.composite_score() > 5.0

    def test_mark_done(self):
        t = self.make_task()
        t.mark_done()
        assert t.status == TaskStatus.DONE
        assert t.completed_at is not None

    def test_postpone_increments_count(self):
        t = self.make_task()
        original_count = t.postpone_count
        t.postpone()
        assert t.postpone_count == original_count + 1
        assert t.status == TaskStatus.POSTPONED

    def test_is_overdue(self):
        t = self.make_task(due_days=-1)
        assert t.is_overdue()

    def test_not_overdue_if_done(self):
        t = self.make_task(due_days=-1)
        t.status = TaskStatus.DONE
        assert not t.is_overdue()


# ──── Planning engine tests ───────────────────────────────────────────────────
class TestPlanningEngine:

    def make_availability(self, day="monday", start_h=9, end_h=17):
        return Availability(
            id=1, user_id=1,
            day_of_week=DayOfWeek(day),
            start_time=time(start_h, 0),
            end_time=time(end_h, 0),
        )

    def make_energy(self, period=EnergyPeriod.MORNING, level=8):
        return EnergyProfile(id=1, user_id=1, period=period, energy_level=level)

    def make_task(self, duration=60, priority=TaskPriority.MEDIUM, energy=EnergyRequired.MEDIUM):
        return Task(
            id=1, user_id=1, title="Task",
            description=None, priority=priority,
            status=TaskStatus.PENDING, energy_required=energy,
            estimated_duration_minutes=duration,
            due_date=date.today() + timedelta(days=3),
            tags=""
        )

    def test_generates_plan_for_monday(self):
        monday = date(2025, 1, 6)  # known Monday
        avail = self.make_availability("monday", 9, 12)
        energy = self.make_energy(EnergyPeriod.MORNING, 8)
        tasks = [self.make_task(60)]

        engine = ClassicPlanningEngine([avail], [energy])
        plan = engine.generate_day_plan(tasks, monday)

        assert len(plan) >= 1
        task_slots = [s for s in plan if not s.is_break]
        assert len(task_slots) >= 1

    def test_no_plan_for_wrong_day(self):
        tuesday = date(2025, 1, 7)
        avail = self.make_availability("monday", 9, 17)
        engine = ClassicPlanningEngine([avail], [])
        plan = engine.generate_day_plan([self.make_task()], tuesday)
        assert plan == []

    def test_overload_detection(self):
        avail = self.make_availability("monday", 9, 10)  # 60 min available
        engine = ClassicPlanningEngine([avail], [])
        tasks = [self.make_task(45), self.make_task(45)]  # 90 min needed
        result = engine.detect_overload(tasks, [avail])
        assert result["overloaded"] is True
        assert result["excess_minutes"] > 0

    def test_break_insertion(self):
        monday = date(2025, 1, 6)
        avail = self.make_availability("monday", 8, 18)  # 10 hours
        energy = self.make_energy()
        tasks = [Task(
            id=i, user_id=1, title=f"Task {i}",
            description=None, priority=TaskPriority.MEDIUM,
            status=TaskStatus.PENDING, energy_required=EnergyRequired.LOW,
            estimated_duration_minutes=50,
            due_date=date.today() + timedelta(days=3), tags=""
        ) for i in range(1, 8)]

        engine = ClassicPlanningEngine([avail], [energy])
        plan = engine.generate_day_plan(tasks, monday)

        breaks = [s for s in plan if s.is_break]
        assert len(breaks) >= 1

    def test_tasks_sorted_by_composite_score(self):
        t_low = Task(
            id=1, user_id=1, title="Low", description=None,
            priority=TaskPriority.LOW, status=TaskStatus.PENDING,
            energy_required=EnergyRequired.LOW,
            estimated_duration_minutes=30,
            due_date=date.today() + timedelta(days=30), tags=""
        )
        t_critical = Task(
            id=2, user_id=1, title="Critical", description=None,
            priority=TaskPriority.CRITICAL, status=TaskStatus.PENDING,
            energy_required=EnergyRequired.HIGH,
            estimated_duration_minutes=30,
            due_date=date.today() + timedelta(days=1), tags=""
        )
        monday = date(2025, 1, 6)
        avail = self.make_availability("monday", 9, 12)
        engine = ClassicPlanningEngine([avail], [])
        plan = engine.generate_day_plan([t_low, t_critical], monday)

        task_slots = [s for s in plan if not s.is_break and s.task]
        if len(task_slots) >= 2:
            assert task_slots[0].task.title == "Critical"


# ──── Score Calculator tests ──────────────────────────────────────────────────
class TestScoreCalculator:

    def make_task_orm(self, status="done"):
        t = MagicMock()
        t.status = status
        t.due_date = date.today()
        t.completed_at = datetime.utcnow() if status == "done" else None
        return t

    def make_execution(self, focus=8, energy=7):
        e = MagicMock()
        e.focus_score = focus
        e.energy_level_during = energy
        e.started_at = datetime.utcnow()
        return e

    def test_perfect_day_score(self):
        calc = ScoreCalculator()
        tasks = [self.make_task_orm("done")] * 5
        executions = [self.make_execution(9, 8)] * 5
        score = calc.compute_daily_score(tasks, executions, date.today())
        assert score["completion_rate"] == 1.0
        assert score["total_score"] > 70

    def test_empty_day(self):
        calc = ScoreCalculator()
        score = calc.compute_daily_score([], [], date.today())
        assert score["total_score"] == 0.0

    def test_postponed_tasks_penalize_discipline(self):
        calc = ScoreCalculator()
        tasks = [self.make_task_orm("postponed")] * 3 + [self.make_task_orm("done")]
        score = calc.compute_daily_score(tasks, [], date.today())
        assert score["discipline_score"] < 7.0

    def test_burnout_risk_increases_with_postponements(self):
        calc = ScoreCalculator()
        good = calc.compute_daily_score(
            [self.make_task_orm("done")] * 5, [], date.today()
        )
        bad = calc.compute_daily_score(
            [self.make_task_orm("postponed")] * 5, [], date.today()
        )
        assert bad["burnout_risk_index"] > good["burnout_risk_index"]

    def test_weekly_score_averages(self):
        calc = ScoreCalculator()
        daily = [{"total_score": 80, "discipline_score": 7, "focus_score": 8,
                  "energy_alignment_rate": 0.8, "completion_rate": 0.9,
                  "burnout_risk_index": 0.1, "tasks_completed": 5,
                  "tasks_postponed": 0, "tasks_total": 5}] * 7
        weekly = calc.compute_weekly_score(daily)
        assert weekly["total_score"] == 80.0
        assert weekly["tasks_completed"] == 35
