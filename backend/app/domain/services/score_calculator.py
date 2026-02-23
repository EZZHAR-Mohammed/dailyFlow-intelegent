"""
Score Calculator — pure domain logic.
Computes daily/weekly scores from task executions.
"""
from datetime import date, timedelta
from typing import List, Dict
from app.infrastructure.database.models import TaskORM, TaskExecutionORM


class ScoreCalculator:

    def compute_daily_score(
        self,
        tasks: List[TaskORM],
        executions: List[TaskExecutionORM],
        target_date: date
    ) -> Dict:
        if not tasks:
            return self._empty_score(target_date)

        total = len(tasks)
        completed = [t for t in tasks if t.status == "done"]
        postponed = [t for t in tasks if t.status == "postponed"]

        completion_rate = len(completed) / total if total else 0.0

        # Discipline score: penalize postponements
        postpone_ratio = len(postponed) / total if total else 0.0
        discipline_score = max(0.0, 1.0 - postpone_ratio * 1.5) * 10

        # Focus score from executions
        focus_scores = [e.focus_score for e in executions if e.focus_score]
        focus_score = (sum(focus_scores) / len(focus_scores)) if focus_scores else 5.0

        # Energy alignment rate
        energy_scores = [e.energy_level_during for e in executions if e.energy_level_during]
        avg_energy = (sum(energy_scores) / len(energy_scores)) if energy_scores else 5.0
        energy_alignment_rate = min(1.0, avg_energy / 10.0)

        # Burnout risk index — based on overload + postponement + energy depletion
        burnout_risk = self._compute_burnout_risk(
            completion_rate, postpone_ratio, avg_energy, executions
        )

        # Total score (0-100)
        total_score = (
            completion_rate * 40 +
            (discipline_score / 10) * 25 +
            (focus_score / 10) * 20 +
            energy_alignment_rate * 15
        )

        return {
            "total_score": round(total_score, 2),
            "discipline_score": round(discipline_score, 2),
            "focus_score": round(focus_score, 2),
            "energy_alignment_rate": round(energy_alignment_rate, 2),
            "completion_rate": round(completion_rate, 2),
            "burnout_risk_index": round(burnout_risk, 2),
            "tasks_completed": len(completed),
            "tasks_postponed": len(postponed),
            "tasks_total": total,
        }

    def _compute_burnout_risk(
        self, completion_rate: float, postpone_ratio: float,
        avg_energy: float, executions: List[TaskExecutionORM]
    ) -> float:
        # High postponement + low energy = higher burnout risk
        low_energy = max(0.0, (5.0 - avg_energy) / 5.0)
        risk = (postpone_ratio * 0.4) + (low_energy * 0.4) + ((1 - completion_rate) * 0.2)
        return min(1.0, risk)

    def _empty_score(self, target_date: date) -> Dict:
        return {
            "total_score": 0.0,
            "discipline_score": 0.0,
            "focus_score": 0.0,
            "energy_alignment_rate": 0.0,
            "completion_rate": 0.0,
            "burnout_risk_index": 0.0,
            "tasks_completed": 0,
            "tasks_postponed": 0,
            "tasks_total": 0,
        }

    def compute_weekly_score(self, daily_scores: List[Dict]) -> Dict:
        if not daily_scores:
            return self._empty_score(date.today())
        keys = ["total_score", "discipline_score", "focus_score",
                "energy_alignment_rate", "completion_rate", "burnout_risk_index"]
        averaged = {k: round(sum(d[k] for d in daily_scores) / len(daily_scores), 2) for k in keys}
        averaged["tasks_completed"] = sum(d["tasks_completed"] for d in daily_scores)
        averaged["tasks_postponed"] = sum(d["tasks_postponed"] for d in daily_scores)
        averaged["tasks_total"] = sum(d["tasks_total"] for d in daily_scores)
        return averaged
