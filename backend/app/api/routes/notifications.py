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


@router.get("/upcoming-tasks", response_model=List[NotificationResponse])
def get_upcoming_task_reminders(
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user)
):
    """
    Returns notifications for tasks starting within the next 5 minutes.
    Also marks those slots as notification_sent=True so they don't repeat.
    Used by the frontend to show browser notifications.
    """
    from datetime import datetime, timedelta
    from app.infrastructure.database.models import ScheduledSlotORM
    
    now_dt = datetime.utcnow()
    window_start = now_dt
    window_end = now_dt + timedelta(minutes=5)
    
    # Find slots starting soon that haven't been notified yet
    upcoming = db.query(ScheduledSlotORM).filter(
        ScheduledSlotORM.user_id == current_user.id,
        ScheduledSlotORM.start_at >= window_start,
        ScheduledSlotORM.start_at <= window_end,
        ScheduledSlotORM.is_break == False,
        ScheduledSlotORM.notification_sent == False,
        ScheduledSlotORM.task_id != None,
    ).all()
    
    created = []
    for slot in upcoming:
        # Mark as sent
        slot.notification_sent = True
        
        task_title = slot.task.title if slot.task else "Tâche"
        start_str = slot.start_at.strftime("%H:%M")
        
        repo = NotificationRepository(db)
        notif = repo.create(current_user.id, {
            "notification_type": "reminder",
            "title": f"🔔 {task_title}",
            "body": f"Commence à {start_str} — C'est l'heure !",
        })
        created.append(notif)
    
    db.commit()
    return created
