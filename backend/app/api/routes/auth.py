from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.infrastructure.database.session import get_db
from app.infrastructure.repositories.user_repository import UserRepository
from app.infrastructure.security.jwt import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_token
)
from app.api.schemas import (
    RegisterRequest, LoginRequest, TokenResponse,
    RefreshRequest, UserResponse, MessageResponse
)
from app.api.dependencies.auth import get_current_user
from app.infrastructure.database.models import UserORM
from app.core.config import settings
from app.core.logging import get_logger

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = get_logger(__name__)


@router.post("/register", response_model=UserResponse, status_code=201)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user account."""
    repo = UserRepository(db)
    if repo.get_by_email(data.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    if repo.get_by_username(data.username):
        raise HTTPException(status_code=400, detail="Username already taken")

    user = repo.create(
        email=data.email,
        username=data.username,
        hashed_password=hash_password(data.password)
    )
    repo.create_audit_log(user.id, "USER_REGISTER", "user", user.id)
    logger.info("User registered", user_id=user.id, email=user.email)
    return user


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """Authenticate and receive JWT tokens."""
    repo = UserRepository(db)
    user = repo.get_by_email(data.email)
    if not user or not verify_password(data.password, user.hashed_password):
        repo.create_audit_log(None, "LOGIN_FAILED", details={"email": data.email})
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account deactivated")

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    expires_at = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    repo.save_refresh_token(user.id, refresh_token, expires_at)
    repo.create_audit_log(user.id, "LOGIN_SUCCESS", "user", user.id,
                          ip_address=request.client.host if request.client else None)

    logger.info("User logged in", user_id=user.id)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(data: RefreshRequest, db: Session = Depends(get_db)):
    """Refresh access token using a valid refresh token."""
    payload = decode_token(data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    repo = UserRepository(db)
    rt = repo.get_refresh_token(data.refresh_token)
    if not rt:
        raise HTTPException(status_code=401, detail="Refresh token expired or revoked")

    repo.revoke_refresh_token(data.refresh_token)
    user_id = int(payload["sub"])

    new_access = create_access_token({"sub": str(user_id)})
    new_refresh = create_refresh_token({"sub": str(user_id)})
    expires_at = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    repo.save_refresh_token(user_id, new_refresh, expires_at)

    return TokenResponse(access_token=new_access, refresh_token=new_refresh)


@router.post("/logout", response_model=MessageResponse)
def logout(data: RefreshRequest, db: Session = Depends(get_db)):
    """Revoke the refresh token (logout)."""
    repo = UserRepository(db)
    repo.revoke_refresh_token(data.refresh_token)
    return MessageResponse(message="Logged out successfully")


@router.get("/me", response_model=UserResponse)
def get_me(current_user: UserORM = Depends(get_current_user)):
    """Get current authenticated user profile."""
    return current_user


@router.patch("/me/ai", response_model=MessageResponse)
def toggle_ai(
    enabled: bool,
    db: Session = Depends(get_db),
    current_user: UserORM = Depends(get_current_user)
):
    """Enable or disable AI planning for current user (GDPR)."""
    current_user.ai_enabled = enabled
    db.commit()
    return MessageResponse(message=f"AI {'enabled' if enabled else 'disabled'}")
