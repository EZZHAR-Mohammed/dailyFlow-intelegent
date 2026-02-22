from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.infrastructure.database.session import get_db
from app.infrastructure.database.models import UserORM
from app.infrastructure.repositories.score_repository import NotificationRepository
from app.api.dependencies.auth import get_current_user
from app.api.schemas import NotificationResponse, MessageResponse

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=List[NotificationResponse])
def list_notifications(
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user)
):
    """List notifications. Use ?unread_only=true to filter."""
    repo = NotificationRepository(db)
    return repo.list_for_user(current_user.id, unread_only)


@router.patch("/{notif_id}/read", response_model=MessageResponse)
def mark_read(
    notif_id: int,
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user)
):
    """Mark a notification as read."""
    repo = NotificationRepository(db)
    repo.mark_read(notif_id, current_user.id)
    return MessageResponse(message="Notification marked as read")


@router.post("/send-test", response_model=NotificationResponse)
def send_test_notification(
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user)
):
    """Send a test notification to the current user."""
    repo = NotificationRepository(db)
    notif = repo.create(current_user.id, {
        "notification_type": "planning",
        "title": "🧪 Test DAILFOW",
        "body": "Votre système de notifications fonctionne parfaitement !",
    })
    return notif
