from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.models import Thread, User, Token
from src.constants import APP_SECRET_KEY

class UserRepo:
    def __init__(self, db: AsyncSession = None, user_id: str = None):
        self.db = db
        self.user_id = user_id

    async def get_by_id(self) -> Optional[User]:
        """Get user by ID."""
        user_id = self.user_id
        result = await self.db.execute(
            select(User).filter(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_token(self, key: str = None) -> Optional[str]:
        """
        Get decrypted token value for a user by key.
        Returns None if token doesn't exist.
        """
        user_id = self.user_id
        
        if not isinstance(self.db, AsyncSession):
            raise TypeError("Expected AsyncSession but got regular Session")
            
        result = await self.db.execute(
            select(Token).filter(
                Token.user_id == user_id,
                Token.key == key
            )
        )
        token = result.scalar_one_or_none()

        if token:
            return Token.decrypt_value(token.value, APP_SECRET_KEY)
        return None

    async def get_all_tokens(self) -> list[dict]:
        """Get all tokens for a user."""
        user_id = self.user_id
        result = await self.db.execute(
            select(Token).filter(Token.user_id == user_id)
        )
        tokens = result.scalars().all()
        return [
            {
                "key": token.key,
                "value": Token.decrypt_value(token.value, APP_SECRET_KEY)
            }
            for token in tokens
        ]

    async def create(self, user_data: dict) -> User:
        """Create a new user."""
        user = User(**user_data)
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def update(self, user_data: dict = None) -> Optional[User]:
        """Update user data."""
        user_id = self.user_id
        user = await self.get_by_id()
        if user:
            for key, value in user_data.items():
                setattr(user, key, value)
            await self.db.commit()
            await self.db.refresh(user)
        return user

    async def delete(self) -> bool:
        """Delete a user."""
        user_id = self.user_id
        user = await self.get_by_id()
        if user:
            await self.db.delete(user)
            await self.db.commit()
            return True
        return False
    
    @staticmethod
    def _get_key_name(key: str = None) -> Optional[str]:
        if key == "openai":
            return "OPENAI_API_KEY"
        elif key == "anthropic":
            return "ANTHROPIC_API_KEY"
        elif key == "ollama":
            return "OLLAMA_BASE_URL"
        elif key == "groq":
            return "GROQ_API_KEY"
        elif key == "gemini":
            return "GEMINI_API_KEY"
        
    @staticmethod
    def get_provider(model_name: str = None) -> Optional[str]:
        if model_name:
            return model_name.split(':', 1)[0]
        return None

    def get_token_by_provider(self, model_name: str = None) -> Optional[str]:
        """
        Get decrypted token value for a user by key.
        Returns None if token doesn't exist.
        
        The key is expected to be in format 'provider:model', 
        and we'll match on the provider part only.
        """
        if model_name:
            provider = self.get_provider(model_name)
            key_name = self._get_key_name(provider)
            token = self.get_token(key_name)
            if token:
                return Token.decrypt_value(token.value, APP_SECRET_KEY)
        return None

    async def threads(self, page=1, per_page=20, sort_order='desc', agent=None):
        """Get all threads for a user."""
        query = select(Thread).filter(Thread.user == self.user_id)
        
        if agent:
            query = query.filter(Thread.agent == agent)
        
        # Apply sort order
        if sort_order.lower() == 'asc':
            query = query.order_by(Thread.created_at.asc())
        else:
            query = query.order_by(Thread.created_at.desc())
            
        query = query.offset((page - 1) * per_page).limit(per_page)
            
        result = await self.db.execute(query)
        return result.scalars().all()
