from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.infrastructure.database.session import get_db
from app.infrastructure.repositories.task_repository import TaskRepository
from app.infrastructure.database.models import UserORM
from app.api.dependencies.auth import get_current_user
from app.api.schemas import (
    TaskCreate, TaskUpdate, TaskResponse,
    ExecutionCreate, ExecutionResponse, MessageResponse
)
from app.core.logging import get_logger

router = APIRouter(prefix="/tasks", tags=["Tasks"])
logger = get_logger(__name__)


@router.get("", response_model=List[TaskResponse])
def list_tasks(
    status: Optional[str] = Query(None, description="Filter by status"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user)
):
    """List all tasks for authenticated user."""
    repo = TaskRepository(db)
    return repo.list_by_user(current_user.id, status=status, priority=priority)


@router.post("", response_model=TaskResponse, status_code=201)
def create_task(
    data: TaskCreate,
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user)
):
    """Create a new task."""
    repo = TaskRepository(db)
    task_data = data.model_dump()
    task_data["status"] = "pending"
    task = repo.create(current_user.id, task_data)
    logger.info("Task created", task_id=task.id, user_id=current_user.id)
    return task


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user)
):
    """Get a specific task by ID."""
    repo = TaskRepository(db)
    task = repo.get_by_id(task_id, current_user.id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.patch("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    data: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user)
):
    """Update task fields."""
    repo = TaskRepository(db)
    task = repo.get_by_id(task_id, current_user.id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(task, field, value)
    return repo.update(task)


@router.delete("/{task_id}", response_model=MessageResponse)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user)
):
    """Delete a task."""
    repo = TaskRepository(db)
    task = repo.get_by_id(task_id, current_user.id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    repo.delete(task_id, current_user.id)
    return MessageResponse(message="Task deleted")


@router.post("/{task_id}/done", response_model=TaskResponse)
def mark_done(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user)
):
    """Mark task as done."""
    repo = TaskRepository(db)
    task = repo.get_by_id(task_id, current_user.id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    from datetime import datetime
    task.status = "done"
    task.completed_at = datetime.utcnow()
    return repo.update(task)


@router.post("/{task_id}/postpone", response_model=TaskResponse)
def postpone_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user)
):
    """Postpone a task (increases postpone_count)."""
    repo = TaskRepository(db)
    task = repo.get_by_id(task_id, current_user.id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.status = "postponed"
    task.postpone_count += 1
    task.scheduled_at = None
    return repo.update(task)


# ──── Task Executions ─────────────────────────────────────────────────────────
@router.post("/{task_id}/executions", response_model=ExecutionResponse, status_code=201)
def create_execution(
    task_id: int,
    data: ExecutionCreate,
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user)
):
    """Log a task execution session."""
    repo = TaskRepository(db)
    task = repo.get_by_id(task_id, current_user.id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    exec_obj = repo.create_execution(current_user.id, task_id, data.model_dump())
    return exec_obj


@router.get("/{task_id}/executions", response_model=List[ExecutionResponse])
def list_executions(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user)
):
    """List execution sessions for a task."""
    repo = TaskRepository(db)
    task = repo.get_by_id(task_id, current_user.id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return repo.get_executions(current_user.id, task_id)
