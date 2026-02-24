"""
AI Smart Planner — Phase 1: Heuristic scoring + Phase 2: ML prediction.
Fully explainable decisions with confidence scores.
"""
from datetime import datetime, timedelta, date
from typing import List, Dict, Optional, Tuple
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
import pickle
import os
from app.core.logging import get_logger
from app.infrastructure.database.models import TaskORM, TaskExecutionORM, EnergyProfileORM

logger = get_logger(__name__)

MODEL_PATH = "/tmp/dailfow_ai_model.pkl"


class SmartPlanner:
    """
    AI-powered task scheduler.
    Falls back to heuristic when not enough training data.
    """

    def __init__(self, energy_profiles: List[EnergyProfileORM], executions: List[TaskExecutionORM]):
        self.energy_profiles = energy_profiles
        self.executions = executions
        self.model: Optional[RandomForestRegressor] = self._load_model()
        self.model_version = "heuristic-v1"

    # ──── Public ──────────────────────────────────────────────────────────────

    def recommend_slot(
        self,
        task: TaskORM,
        available_windows: List[Tuple[datetime, datetime]],
    ) -> Optional[Dict]:
        """
        Returns a recommendation dict with explanation and confidence.
        """
        if not available_windows:
            return None

        candidates = self._generate_candidates(available_windows, task.estimated_duration_minutes)
        if not candidates:
            return None

        # Score each candidate
        scored = [(slot, self._score_candidate(slot, task)) for slot in candidates]
        scored.sort(key=lambda x: x[1]["total"], reverse=True)

        best_slot, best_scores = scored[0]

        # Confidence: how much better best is vs second
        if len(scored) > 1:
            gap = best_scores["total"] - scored[1][1]["total"]
            confidence = min(1.0, 0.5 + gap * 0.5)
        else:
            confidence = 0.7

        start, end = best_slot
        explanation = self._build_explanation(best_scores, task)

        return {
            "recommended_slot_start": start,
            "recommended_slot_end": end,
            "confidence_score": round(confidence, 2),
            "criteria_used": best_scores,
            "explanation": explanation,
            "model_version": self.model_version,
        }

    def train(self, tasks: List[TaskORM], executions: List[TaskExecutionORM]):
        """Train ML model from historical execution data."""
        if len(executions) < 20:
            logger.info("Not enough data to train ML model", count=len(executions))
            return

        X, y = [], []
        for exec in executions:
            task = next((t for t in tasks if t.id == exec.task_id), None)
            if not task or not exec.focus_score:
                continue
            features = self._extract_features(task, exec.started_at)
            X.append(features)
            y.append(exec.focus_score)

        if len(X) < 20:
            return

        X = np.array(X)
        y = np.array(y)
        model = RandomForestRegressor(n_estimators=50, random_state=42)
        model.fit(X, y)
        self.model = model
        self.model_version = "rf-v1"
        self._save_model(model)
        logger.info("AI model trained", samples=len(X))

    # ──── Private ─────────────────────────────────────────────────────────────

    def _generate_candidates(
        self,
        windows: List[Tuple[datetime, datetime]],
        duration_minutes: int
    ) -> List[Tuple[datetime, datetime]]:
        candidates = []
        for win_start, win_end in windows:
            cursor = win_start
            step = timedelta(minutes=15)
            while cursor + timedelta(minutes=duration_minutes) <= win_end:
                candidates.append((cursor, cursor + timedelta(minutes=duration_minutes)))
                cursor += step
        return candidates

    def _get_energy_at(self, dt: datetime) -> int:
        hour = dt.hour
        if 6 <= hour < 12:
            period = "morning"
        elif 12 <= hour < 18:
            period = "afternoon"
        elif 18 <= hour < 22:
            period = "evening"
        else:
            period = "night"
        for ep in self.energy_profiles:
            if ep.period == period:
                return ep.energy_level
        return 5

    def _score_candidate(self, slot: Tuple[datetime, datetime], task: TaskORM) -> Dict:
        start, end = slot
        energy_level = self._get_energy_at(start)
        required = task.energy_required

        # Energy match score (0-1)
        thresholds = {"high": 7, "medium": 4, "low": 1}
        required_min = thresholds.get(required, 1)
        energy_match = min(1.0, energy_level / max(required_min, 7)) if required == "high" else (
            1.0 if energy_level >= required_min else energy_level / required_min
        )

        # Priority weight (normalized 0-1)
        priority_map = {"low": 0.2, "medium": 0.5, "high": 0.8, "critical": 1.0}
        priority_score = priority_map.get(task.priority, 0.5)

        # Postpone penalty
        postpone_penalty = max(0.0, 1.0 - task.postpone_count * 0.15)

        # Morning bonus (most people focus better in morning)
        hour = start.hour
        morning_bonus = 0.2 if 8 <= hour < 12 else 0.0

        # ML boost if model is available
        ml_boost = 0.0
        if self.model and self.model_version != "heuristic-v1":
            features = self._extract_features(task, start)
            predicted_focus = self.model.predict([features])[0]
            ml_boost = (predicted_focus - 5.0) / 10.0  # normalize
            self.model_version = "rf-v1"

        total = (
            energy_match * 0.35 +
            priority_score * 0.30 +
            postpone_penalty * 0.15 +
            morning_bonus +
            ml_boost * 0.20
        )

        return {
            "energy_match": round(energy_match, 2),
            "priority_score": round(priority_score, 2),
            "postpone_penalty": round(postpone_penalty, 2),
            "morning_bonus": round(morning_bonus, 2),
            "ml_boost": round(ml_boost, 2),
            "total": round(total, 3),
        }

    def _extract_features(self, task: TaskORM, start: datetime) -> List[float]:
        priority_map = {"low": 1, "medium": 2, "high": 3, "critical": 4}
        energy_map = {"low": 1, "medium": 2, "high": 3}
        return [
            start.hour,
            start.weekday(),
            task.estimated_duration_minutes,
            priority_map.get(task.priority, 2),
            energy_map.get(task.energy_required, 2),
            task.postpone_count,
            self._get_energy_at(start),
        ]

    def _build_explanation(self, scores: Dict, task: TaskORM) -> str:
        lines = [
            f"Tâche '{task.title}' planifiée selon les critères suivants :",
            f"• Alignement énergie : {scores['energy_match'] * 100:.0f}%",
            f"• Score priorité : {scores['priority_score'] * 100:.0f}%",
            f"• Pénalité reports : {scores['postpone_penalty'] * 100:.0f}%",
        ]
        if scores.get("morning_bonus"):
            lines.append("• Bonus créneau matinal appliqué")
        if scores.get("ml_boost") and abs(scores["ml_boost"]) > 0.01:
            lines.append(f"• Ajustement ML : {scores['ml_boost']:+.2f}")
        lines.append(f"• Score total : {scores['total']:.3f}")
        return "\n".join(lines)

    def _load_model(self) -> Optional[RandomForestRegressor]:
        if os.path.exists(MODEL_PATH):
            with open(MODEL_PATH, "rb") as f:
                return pickle.load(f)
        return None

    def _save_model(self, model: RandomForestRegressor):
        with open(MODEL_PATH, "wb") as f:
            pickle.dump(model, f)
