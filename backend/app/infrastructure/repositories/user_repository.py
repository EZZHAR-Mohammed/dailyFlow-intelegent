from sqlalchemy.orm import Session
from typing import Optional, List
from app.infrastructure.database.models import UserORM, RefreshTokenORM, AuditLogORM
from datetime import datetime


class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, user_id: int) -> Optional[UserORM]:
        return self.db.query(UserORM).filter(UserORM.id == user_id, UserORM.is_active == True).first()

    def get_by_email(self, email: str) -> Optional[UserORM]:
        return self.db.query(UserORM).filter(UserORM.email == email).first()

    def get_by_username(self, username: str) -> Optional[UserORM]:
        return self.db.query(UserORM).filter(UserORM.username == username).first()

    def create(self, email: str, username: str, hashed_password: str) -> UserORM:
        user = UserORM(email=email, username=username, hashed_password=hashed_password)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def update(self, user: UserORM) -> UserORM:
        user.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(user)
        return user

    def delete(self, user_id: int):
        user = self.get_by_id(user_id)
        if user:
            self.db.delete(user)
            self.db.commit()

    def save_refresh_token(self, user_id: int, token: str, expires_at: datetime) -> RefreshTokenORM:
        # Always strip token to avoid whitespace mismatch on retrieval
        token = token.strip()
        rt = RefreshTokenORM(user_id=user_id, token=token, expires_at=expires_at)
        self.db.add(rt)
        self.db.commit()
        return rt

    def get_refresh_token(self, token: str) -> Optional[RefreshTokenORM]:
        # Strip token before DB lookup — prevents mismatch from whitespace/newlines
        token = token.strip()
        return self.db.query(RefreshTokenORM).filter(
            RefreshTokenORM.token == token,
            RefreshTokenORM.revoked == False,
            RefreshTokenORM.expires_at > datetime.utcnow()
        ).first()

    def revoke_refresh_token(self, token: str):
        token = token.strip()
        rt = self.db.query(RefreshTokenORM).filter(RefreshTokenORM.token == token).first()
        if rt:
            rt.revoked = True
            self.db.commit()

    def create_audit_log(self, user_id: Optional[int], action: str, resource: str = None,
                         resource_id: int = None, details: dict = None, ip_address: str = None):
        log = AuditLogORM(
            user_id=user_id,
            action=action,
            resource=resource,
            resource_id=resource_id,
            details=details,
            ip_address=ip_address
        )
        self.db.add(log)
        self.db.commit()