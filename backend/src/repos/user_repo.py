from typing import Optional
from pydantic import EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.schemas.entities.auth import UserCreate
from src.schemas.models import User


class UserRepo:
    def __init__(self, db: AsyncSession, user_id: str | None = None):
        self.db = db
        self.user_id = user_id

    async def get_by_id(self) -> Optional[User]:
        """Get user by ID."""
        user_id = self.user_id
        result = await self.db.execute(select(User).filter(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: EmailStr) -> Optional[User]:
        """Get user by email."""
        result = await self.db.execute(select(User).filter(User.email == email))
        return result.scalar_one_or_none()

    async def get_by_username(self, username: str) -> Optional[User]:
        """Get user by username."""
        result = await self.db.execute(select(User).filter(User.username == username))
        return result.scalar_one_or_none()

    async def create(self, user_data: UserCreate) -> User:
        """Create a new user."""
        user = User(
            email=user_data.email,
            username=user_data.username,
            name=user_data.name,
            hashed_password=User.get_password_hash(user_data.password),
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def update(self, user_data: dict) -> Optional[User]:
        """Update user data."""
        user = await self.get_by_id()
        if user:
            for key, value in user_data.items():
                setattr(user, key, value)
            await self.db.commit()
            await self.db.refresh(user)
        return user

    async def delete(self) -> bool:
        """Delete a user."""
        user = await self.get_by_id()
        if user:
            await self.db.delete(user)
            await self.db.commit()
            return True
        return False
