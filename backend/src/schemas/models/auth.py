import uuid
import sqlalchemy as sa
from typing import Optional
from datetime import datetime
from sqlalchemy import String, DateTime
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy.orm import Mapped, mapped_column

from src.services.db import get_db_base

Base = get_db_base()
pwd_context = CryptContext(schemes=["argon2", "bcrypt"], deprecated="auto")


class ProtectedUser(BaseModel):
    id: str
    username: str
    email: str
    name: str
    created_at: datetime
    updated_at: Optional[datetime] = None


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        index=True,
        server_default=sa.text("uuid_generate_v4()"),
    )
    username: Mapped[str] = mapped_column(String, unique=True, index=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String)
    hashed_password: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )

    @staticmethod
    def get_password_hash(password: str) -> str:
        # Always hash with the default scheme, which is argon2 if set in CryptContext
        return pwd_context.hash(password)

    @staticmethod
    def verify_and_upgrade_password(
        plain_password: str, stored_hash: str
    ) -> tuple[bool, str | None]:
        """
        Returns (ok, new_hash_or_None).
        If ok and the stored hash is deprecated/old, returns an upgraded hash using Argon2.
        """
        ok = pwd_context.verify(plain_password, stored_hash)
        if not ok:
            return False, None
        if pwd_context.needs_update(stored_hash):
            # Rehash using the default, which will be Argon2
            return True, pwd_context.hash(plain_password)
        return True, None

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)

    def protected(self) -> ProtectedUser:
        return ProtectedUser(
            id=str(self.id),
            username=self.username,
            email=self.email,
            name=self.name,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )
