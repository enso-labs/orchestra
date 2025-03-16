from typing import Optional
from sqlalchemy.orm import Session
from src.models import User, Token
from src.constants import APP_SECRET_KEY

class UserRepo:
    def __init__(self, db: Session, user_id: str = None):
        self.db = db
        self.user_id = user_id

    def get_by_id(self) -> Optional[User]:
        """Get user by ID."""
        user_id = self.user_id
        return self.db.query(User).filter(User.id == user_id).first()

    def get_by_email(self, email: str) -> Optional[User]:
        """Get user by email."""
        return self.db.query(User).filter(User.email == email).first()

    def get_by_username(self, username: str) -> Optional[User]:
        """Get user by username."""
        return self.db.query(User).filter(User.username == username).first()

    def get_token(self, key: str = None) -> Optional[str]:
        """
        Get decrypted token value for a user by key.
        Returns None if token doesn't exist.
        """
        user_id = self.user_id
        token = self.db.query(Token).filter(
            Token.user_id == user_id,
            Token.key == key
        ).first()

        if token:
            return Token.decrypt_value(token.value, APP_SECRET_KEY)
        return None

    def get_all_tokens(self) -> list[dict]:
        """Get all tokens for a user."""
        user_id = self.user_id
        tokens = self.db.query(Token).filter(Token.user_id == user_id).all()
        return [
            {
                "key": token.key,
                "value": Token.decrypt_value(token.value, APP_SECRET_KEY)
            }
            for token in tokens
        ]

    def create(self, user_data: dict) -> User:
        """Create a new user."""
        user = User(**user_data)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def update(self, user_data: dict = None) -> Optional[User]:
        """Update user data."""
        user_id = self.user_id
        user = self.get_by_id(user_id)
        if user:
            for key, value in user_data.items():
                setattr(user, key, value)
            self.db.commit()
            self.db.refresh(user)
        return user

    def delete(self) -> bool:
        """Delete a user."""
        user_id = self.user_id
        user = self.get_by_id(user_id)
        if user:
            self.db.delete(user)
            self.db.commit()
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