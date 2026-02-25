"""
Integration tests for DAILFOW API.
Uses an in-memory SQLite DB to avoid needing MySQL for testing.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import date, timedelta

from app.main import app
from app.infrastructure.database.session import Base, get_db

# Use SQLite for tests
TEST_DATABASE_URL = "sqlite:///./test_dailfow.db"

engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


# ──── Helpers ─────────────────────────────────────────────────────────────────
def register_and_login(email="test@dailfow.com", password="securepass123"):
    client.post("/api/v1/auth/register", json={
        "email": email, "username": "testuser", "password": password
    })
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


def auth_headers(token: str):
    return {"Authorization": f"Bearer {token}"}


# ──── Auth Tests ──────────────────────────────────────────────────────────────
class TestAuth:

    def test_register_success(self):
        r = client.post("/api/v1/auth/register", json={
            "email": "new@test.com", "username": "newuser", "password": "password123"
        })
        assert r.status_code == 201
        assert r.json()["email"] == "new@test.com"

    def test_register_duplicate_email(self):
        data = {"email": "dup@test.com", "username": "user1", "password": "pass1234"}
        client.post("/api/v1/auth/register", json=data)
        data2 = {"email": "dup@test.com", "username": "user2", "password": "pass1234"}
        r = client.post("/api/v1/auth/register", json=data2)
        assert r.status_code == 400

    def test_login_success(self):
        client.post("/api/v1/auth/register", json={
            "email": "login@test.com", "username": "loginuser", "password": "mypassword"
        })
        r = client.post("/api/v1/auth/login", json={
            "email": "login@test.com", "password": "mypassword"
        })
        assert r.status_code == 200
        assert "access_token" in r.json()
        assert "refresh_token" in r.json()

    def test_login_wrong_password(self):
        client.post("/api/v1/auth/register", json={
            "email": "wp@test.com", "username": "wpuser", "password": "correct"
        })
        r = client.post("/api/v1/auth/login", json={
            "email": "wp@test.com", "password": "wrong"
        })
        assert r.status_code == 401

    def test_get_me(self):
        token = register_and_login("me@test.com")
        r = client.get("/api/v1/auth/me", headers=auth_headers(token))
        assert r.status_code == 200
        assert r.json()["email"] == "me@test.com"

    def test_get_me_unauthorized(self):
        r = client.get("/api/v1/auth/me")
        assert r.status_code == 403  # no bearer token

    def test_refresh_token(self):
        client.post("/api/v1/auth/register", json={
            "email": "refresh@test.com", "username": "rfuser", "password": "pass1234"
        })
        login_r = client.post("/api/v1/auth/login", json={
            "email": "refresh@test.com", "password": "pass1234"
        })
        refresh_token = login_r.json()["refresh_token"]
        r = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
        assert r.status_code == 200
        assert "access_token" in r.json()


# ──── Task Tests ──────────────────────────────────────────────────────────────
class TestTasks:

    def test_create_task(self):
        token = register_and_login("tasks@test.com")
        r = client.post("/api/v1/tasks", headers=auth_headers(token), json={
            "title": "Buy groceries",
            "priority": "medium",
            "energy_required": "low",
            "estimated_duration_minutes": 45,
            "due_date": str(date.today() + timedelta(days=2))
        })
        assert r.status_code == 201
        assert r.json()["title"] == "Buy groceries"
        assert r.json()["status"] == "pending"

    def test_list_tasks(self):
        token = register_and_login("list@test.com")
        h = auth_headers(token)
        client.post("/api/v1/tasks", headers=h, json={
            "title": "Task A", "priority": "high",
            "energy_required": "high", "estimated_duration_minutes": 60
        })
        r = client.get("/api/v1/tasks", headers=h)
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_mark_done(self):
        token = register_and_login("done@test.com")
        h = auth_headers(token)
        create_r = client.post("/api/v1/tasks", headers=h, json={
            "title": "Finish report", "priority": "critical",
            "energy_required": "high", "estimated_duration_minutes": 120
        })
        task_id = create_r.json()["id"]
        done_r = client.post(f"/api/v1/tasks/{task_id}/done", headers=h)
        assert done_r.status_code == 200
        assert done_r.json()["status"] == "done"

    def test_postpone_task(self):
        token = register_and_login("postpone@test.com")
        h = auth_headers(token)
        create_r = client.post("/api/v1/tasks", headers=h, json={
            "title": "Exercise", "priority": "medium",
            "energy_required": "high", "estimated_duration_minutes": 30
        })
        task_id = create_r.json()["id"]
        r = client.post(f"/api/v1/tasks/{task_id}/postpone", headers=h)
        assert r.status_code == 200
        assert r.json()["status"] == "postponed"
        assert r.json()["postpone_count"] == 1

    def test_delete_task(self):
        token = register_and_login("delete@test.com")
        h = auth_headers(token)
        create_r = client.post("/api/v1/tasks", headers=h, json={
            "title": "Delete me", "priority": "low",
            "energy_required": "low", "estimated_duration_minutes": 15
        })
        task_id = create_r.json()["id"]
        del_r = client.delete(f"/api/v1/tasks/{task_id}", headers=h)
        assert del_r.status_code == 200
        get_r = client.get(f"/api/v1/tasks/{task_id}", headers=h)
        assert get_r.status_code == 404

    def test_filter_tasks_by_status(self):
        token = register_and_login("filter@test.com")
        h = auth_headers(token)
        for i in range(3):
            client.post("/api/v1/tasks", headers=h, json={
                "title": f"Task {i}", "priority": "low",
                "energy_required": "low", "estimated_duration_minutes": 20
            })
        r = client.get("/api/v1/tasks?status=pending", headers=h)
        assert r.status_code == 200
        assert all(t["status"] == "pending" for t in r.json())


# ──── Planning Tests ──────────────────────────────────────────────────────────
class TestPlanning:

    def test_create_availability(self):
        token = register_and_login("avail@test.com")
        h = auth_headers(token)
        r = client.post("/api/v1/planning/availabilities", headers=h, json={
            "day_of_week": "monday",
            "start_time": "09:00:00",
            "end_time": "17:00:00"
        })
        assert r.status_code == 201
        assert r.json()["day_of_week"] == "monday"

    def test_energy_profile_upsert(self):
        token = register_and_login("energy@test.com")
        h = auth_headers(token)
        r = client.post("/api/v1/planning/energy", headers=h, json={
            "period": "morning", "energy_level": 9
        })
        assert r.status_code == 201
        # Upsert same period
        r2 = client.post("/api/v1/planning/energy", headers=h, json={
            "period": "morning", "energy_level": 7
        })
        assert r2.status_code == 201
        assert r2.json()["energy_level"] == 7

    def test_generate_plan(self):
        token = register_and_login("plan@test.com")
        h = auth_headers(token)

        # Setup availability for next Monday
        today = date.today()
        days_ahead = (0 - today.weekday()) % 7 or 7
        next_monday = today + timedelta(days=days_ahead)
        day_name = next_monday.strftime("%A").lower()

        client.post("/api/v1/planning/availabilities", headers=h, json={
            "day_of_week": day_name,
            "start_time": "09:00:00", "end_time": "17:00:00"
        })
        client.post("/api/v1/planning/energy", headers=h, json={
            "period": "morning", "energy_level": 8
        })
        client.post("/api/v1/tasks", headers=h, json={
            "title": "Important task", "priority": "high",
            "energy_required": "high", "estimated_duration_minutes": 60
        })

        r = client.post("/api/v1/planning/generate", headers=h, json={
            "target_date": str(next_monday)
        })
        assert r.status_code == 200
        assert "slots" in r.json()
        assert "overload" in r.json()


# ──── Analytics Tests ─────────────────────────────────────────────────────────
class TestAnalytics:

    def test_daily_score(self):
        token = register_and_login("score@test.com")
        h = auth_headers(token)
        r = client.get(f"/api/v1/analytics/daily?target_date={date.today()}", headers=h)
        assert r.status_code == 200
        data = r.json()
        assert "total_score" in data
        assert "burnout_label" in data

    def test_trends(self):
        token = register_and_login("trends@test.com")
        h = auth_headers(token)
        r = client.get("/api/v1/analytics/trends?days=7", headers=h)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_burnout_prediction(self):
        token = register_and_login("burnout@test.com")
        h = auth_headers(token)
        r = client.get("/api/v1/analytics/burnout-prediction", headers=h)
        assert r.status_code == 200
        assert "risk_level" in r.json()


# ──── Notifications Tests ─────────────────────────────────────────────────────
class TestNotifications:

    def test_send_and_read_notification(self):
        token = register_and_login("notif@test.com")
        h = auth_headers(token)
        # Send test notification
        r = client.post("/api/v1/notifications/send-test", headers=h)
        assert r.status_code == 200
        notif_id = r.json()["id"]

        # List
        r2 = client.get("/api/v1/notifications", headers=h)
        assert len(r2.json()) >= 1

        # Mark read
        r3 = client.patch(f"/api/v1/notifications/{notif_id}/read", headers=h)
        assert r3.status_code == 200


# ──── GDPR Tests ──────────────────────────────────────────────────────────────
class TestGDPR:

    def test_export_data(self):
        token = register_and_login("gdpr@test.com")
        r = client.get("/api/v1/gdpr/export", headers=auth_headers(token))
        assert r.status_code == 200
        data = r.json()
        assert "user" in data
        assert "tasks" in data
        assert "exported_at" in data

    def test_delete_account(self):
        token = register_and_login("delete_me@test.com")
        r = client.delete("/api/v1/gdpr/delete-account", headers=auth_headers(token))
        assert r.status_code == 200
        # After deletion, /me should fail
        r2 = client.get("/api/v1/auth/me", headers=auth_headers(token))
        assert r2.status_code == 401


# ──── Health check ────────────────────────────────────────────────────────────
def test_health_check():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
