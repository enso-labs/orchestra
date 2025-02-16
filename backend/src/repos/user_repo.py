from typing import Optional
from sqlalchemy.orm import Session
from src.models import User, Token
from src.constants import APP_SECRET_KEY

class UserRepo:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, user_id: str) -> Optional[User]:
        """Get user by ID."""
        return self.db.query(User).filter(User.id == user_id).first()

    def get_by_email(self, email: str) -> Optional[User]:
        """Get user by email."""
        return self.db.query(User).filter(User.email == email).first()

    def get_by_username(self, username: str) -> Optional[User]:
        """Get user by username."""
        return self.db.query(User).filter(User.username == username).first()

    def get_token(self, user_id: str, key: str) -> Optional[str]:
        """
        Get decrypted token value for a user by key.
        Returns None if token doesn't exist.
        """
        token = self.db.query(Token).filter(
            Token.user_id == user_id,
            Token.key == key
        ).first()

        if token:
            return Token.decrypt_value(token.value, APP_SECRET_KEY)
        return None

    def get_all_tokens(self, user_id: str) -> list[dict]:
        """Get all tokens for a user."""
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

    def update(self, user_id: str, user_data: dict) -> Optional[User]:
        """Update user data."""
        user = self.get_by_id(user_id)
        if user:
            for key, value in user_data.items():
                setattr(user, key, value)
            self.db.commit()
            self.db.refresh(user)
        return user

    def delete(self, user_id: str) -> bool:
        """Delete a user."""
        user = self.get_by_id(user_id)
        if user:
            self.db.delete(user)
            self.db.commit()
            return True
        return False
