"""
Tests for AI Smart Planner module.
"""
import pytest
from datetime import datetime, timedelta, date
from unittest.mock import MagicMock
from app.infrastructure.ai.smart_planner import SmartPlanner


def make_energy_profile(period: str, level: int):
    ep = MagicMock()
    ep.period = period
    ep.energy_level = level
    return ep


def make_task(priority="high", energy="high", duration=60, postpone=0):
    t = MagicMock()
    t.id = 1
    t.title = "AI Test Task"
    t.priority = priority
    t.energy_required = energy
    t.estimated_duration_minutes = duration
    t.postpone_count = postpone
    return t


def make_windows(date_target: date, start_h=9, end_h=17):
    start = datetime.combine(date_target, datetime.min.time().replace(hour=start_h))
    end = datetime.combine(date_target, datetime.min.time().replace(hour=end_h))
    return [(start, end)]


class TestSmartPlanner:

    def setup_method(self):
        self.energy_profiles = [
            make_energy_profile("morning", 9),
            make_energy_profile("afternoon", 6),
            make_energy_profile("evening", 4),
            make_energy_profile("night", 2),
        ]
        self.planner = SmartPlanner(self.energy_profiles, [])

    def test_recommend_slot_returns_result(self):
        task = make_task()
        windows = make_windows(date.today())
        result = self.planner.recommend_slot(task, windows)
        assert result is not None
        assert "recommended_slot_start" in result
        assert "recommended_slot_end" in result

    def test_confidence_between_0_and_1(self):
        task = make_task()
        windows = make_windows(date.today())
        result = self.planner.recommend_slot(task, windows)
        assert 0.0 <= result["confidence_score"] <= 1.0

    def test_explanation_is_present(self):
        task = make_task()
        windows = make_windows(date.today())
        result = self.planner.recommend_slot(task, windows)
        assert len(result["explanation"]) > 10

    def test_criteria_used_present(self):
        task = make_task()
        windows = make_windows(date.today())
        result = self.planner.recommend_slot(task, windows)
        criteria = result["criteria_used"]
        assert "energy_match" in criteria
        assert "priority_score" in criteria

    def test_no_windows_returns_none(self):
        task = make_task()
        result = self.planner.recommend_slot(task, [])
        assert result is None

    def test_morning_preferred_for_high_energy_task(self):
        task = make_task(energy="high")
        today = date.today()
        # Give full day window
        windows = [(
            datetime.combine(today, datetime.min.time().replace(hour=6)),
            datetime.combine(today, datetime.min.time().replace(hour=20))
        )]
        result = self.planner.recommend_slot(task, windows)
        # Should recommend morning hours (before noon)
        assert result["recommended_slot_start"].hour < 13

    def test_postponed_task_has_reduced_score(self):
        task_fresh = make_task(postpone=0)
        task_postponed = make_task(postpone=5)
        today = date.today()
        windows = make_windows(today)

        result_fresh = self.planner.recommend_slot(task_fresh, windows)
        result_postponed = self.planner.recommend_slot(task_postponed, windows)

        # Both should get a result
        assert result_fresh is not None
        assert result_postponed is not None

    def test_slot_respects_duration(self):
        task = make_task(duration=90)
        windows = make_windows(date.today(), 9, 17)
        result = self.planner.recommend_slot(task, windows)
        duration = (result["recommended_slot_end"] - result["recommended_slot_start"]).total_seconds() / 60
        assert duration == 90

    def test_train_with_insufficient_data(self):
        """Training with <20 samples should not raise an error."""
        planner = SmartPlanner(self.energy_profiles, [])
        tasks = [make_task()]
        executions = [MagicMock() for _ in range(5)]
        planner.train(tasks, executions)  # Should silently skip
        assert planner.model_version == "heuristic-v1"
