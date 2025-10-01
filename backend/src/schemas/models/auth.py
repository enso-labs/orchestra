from typing import Optional
from datetime import datetime
import sqlalchemy as sa
from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy.orm import relationship, Mapped, mapped_column
import uuid
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .thread import Thread
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

    threads: Mapped[list["Thread"]] = relationship(
        "Thread", back_populates="user_relation"
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


class Token(Base):
    __tablename__ = "tokens"

    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    key = Column(String, primary_key=True)
    value = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    @staticmethod
    def encrypt_value(value: str, secret_key: str) -> str:
        from cryptography.fernet import Fernet

        f = Fernet(secret_key.encode())
        return f.encrypt(value.encode()).decode()

    @staticmethod
    def decrypt_value(encrypted_value: str, secret_key: str) -> str:
        from cryptography.fernet import Fernet

        f = Fernet(secret_key.encode())
        return f.decrypt(encrypted_value.encode()).decode()
