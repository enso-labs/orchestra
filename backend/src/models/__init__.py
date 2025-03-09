import json
from typing import Optional
from datetime import datetime
import sqlalchemy as sa
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy.orm import relationship
from sqlalchemy.sql import text

Base = sa.orm.declarative_base()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class ProtectedUser(BaseModel):
    id: str
    username: str
    email: str
    name: str
    created_at: datetime
    updated_at: Optional[datetime] = None

class User(Base):
    __tablename__ = "users"
    
    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        index=True,
        server_default=sa.text("uuid_generate_v4()")
    )
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    hashed_password = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    @staticmethod
    def get_password_hash(password: str) -> str:
        return pwd_context.hash(password)

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)

    def protected(self) -> ProtectedUser:
        """Return a dictionary representation of user without sensitive data."""
        return ProtectedUser(
            id=str(self.id),
            username=self.username,
            email=self.email,
            name=self.name,
            created_at=self.created_at,
            updated_at=self.updated_at
        )

class Token(Base):
    __tablename__ = "tokens"
    
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey('users.id', ondelete='CASCADE'),
        primary_key=True
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

class Settings(Base):
    __tablename__ = "settings"
    
    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=sa.text("gen_random_uuid()")
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey('users.id', ondelete='CASCADE'),
        primary_key=True
    )
    name = Column(String, nullable=False)
    slug = Column(String, nullable=False, unique=True, index=True)
    value = Column(sa.JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "name": self.name,
            "slug": self.slug,
            "value": self.value
        }

    @staticmethod
    def generate_slug(name: str) -> str:
        """Generate a URL-friendly slug from the name."""
        import re
        # Convert to lowercase and replace spaces with dashes
        slug = name.lower().strip().replace(' ', '-')
        # Remove special characters
        slug = re.sub(r'[^a-z0-9-]', '', slug)
        # Replace multiple dashes with single dash
        slug = re.sub(r'-+', '-', slug)
        return slug

    def __init__(self, name: str, value: dict, **kwargs):
        """Initialize a new setting with auto-generated slug."""
        super().__init__(**kwargs)
        self.name = name
        self.value = value
        if 'slug' not in kwargs:
            self.slug = self.generate_slug(name)

class Agent(Base):
    __tablename__ = "agents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey('users.id', ondelete='CASCADE'),
        primary_key=True
    )
    name = Column(String, nullable=False)
    slug = Column(String, nullable=False, unique=True)
    description = Column(String)
    public = Column(Boolean, nullable=False, server_default='false')
    settings_id = Column(UUID(as_uuid=True), ForeignKey("settings.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=text("now()"), onupdate=text("now()"), nullable=False)
    
    # Relationship with lazy="select" (the default) will not load settings when querying agents
    # But will allow loading the relationship when accessing agent.setting
    setting = relationship("Settings", lazy="select")
    
    def to_dict(self, include_setting: bool = True) -> dict:
        return {
            "id": str(self.id),
            "name": self.name,
            "slug": self.slug,
            "description": self.description,
            "public": self.public,
            "settings": self.setting.to_dict() if include_setting else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
    
    def to_json(self) -> str:
        return json.dumps(self.to_dict())

    @staticmethod
    def generate_slug(name: str) -> str:
        """Generate a URL-friendly slug from the name."""
        import re
        # Convert to lowercase and replace spaces with dashes
        slug = name.lower().strip().replace(' ', '-')
        # Remove special characters
        slug = re.sub(r'[^a-z0-9-]', '', slug)
        # Replace multiple dashes with single dash
        slug = re.sub(r'-+', '-', slug)
        return slug

    def __init__(self, name: str, description: str, public: bool, **kwargs):
        """Initialize a new setting with auto-generated slug."""
        super().__init__(**kwargs)
        self.name = name
        self.description = description
        self.public = public
        if 'slug' not in kwargs:
            self.slug = self.generate_slug(name)