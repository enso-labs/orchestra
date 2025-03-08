from typing import Optional, List
from datetime import datetime
import sqlalchemy as sa
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Boolean, Integer, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from passlib.context import CryptContext
from pydantic import BaseModel, Field

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
    
    # Add relationship to agents
    agents = relationship("Agent", back_populates="user")

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
    name = Column(String, nullable=False)
    slug = Column(String, nullable=False, unique=True, index=True)
    value = Column(sa.JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Add relationship to agent revisions
    agent_revisions = relationship("AgentRevision", back_populates="settings")

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

# New model for Agent
class Agent(Base):
    __tablename__ = "agents"
    
    id = Column(
        UUID(as_uuid=True), 
        primary_key=True,
        server_default=sa.text("gen_random_uuid()")
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey('users.id', ondelete='CASCADE'),
        nullable=False
    )
    name = Column(String, nullable=False)
    slug = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)
    visibility = Column(
        String, 
        nullable=False, 
        server_default='private'
    )
    is_active = Column(Boolean, nullable=False, server_default='true')
    current_revision_id = Column(
        UUID(as_uuid=True),
        ForeignKey('agent_revisions.id', ondelete='SET NULL'),
        nullable=True
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Fix relationship directions
    user = relationship("User", back_populates="agents")
    # One-to-many relationship
    revisions = relationship(
        "AgentRevision", 
        foreign_keys="AgentRevision.agent_id", 
        back_populates="agent", 
        cascade="all, delete-orphan"
    )
    # Many-to-one relationship with extra handling for circular reference
    current_revision = relationship(
        "AgentRevision", 
        foreign_keys=[current_revision_id], 
        post_update=True
    )
    threads = relationship("UserThread", back_populates="agent")
    
    __table_args__ = (
        sa.UniqueConstraint('user_id', 'slug', name='uq_user_agent_slug'),
    )
    
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
    
    def __init__(self, name: str, user_id: str, **kwargs):
        """Initialize a new agent with auto-generated slug."""
        super().__init__(**kwargs)
        self.name = name
        self.user_id = user_id
        if 'slug' not in kwargs:
            self.slug = self.generate_slug(name)
            
    def to_dict(self):
        """Convert agent to dictionary for API responses."""
        return {
            "id": str(self.id),
            "name": self.name,
            "slug": self.slug,
            "description": self.description,
            "visibility": self.visibility,
            "is_active": self.is_active,
            "current_revision_id": str(self.current_revision_id) if self.current_revision_id else None,
            "user_id": str(self.user_id),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

# New model for AgentRevision
class AgentRevision(Base):
    __tablename__ = "agent_revisions"
    
    id = Column(
        UUID(as_uuid=True),
        primary_key=True, 
        server_default=sa.text("gen_random_uuid()")
    )
    agent_id = Column(
        UUID(as_uuid=True),
        ForeignKey('agents.id', ondelete='CASCADE'),
        nullable=False
    )
    settings_id = Column(
        UUID(as_uuid=True),
        ForeignKey('settings.id', ondelete='CASCADE'),
        nullable=False
    )
    version_number = Column(Integer, nullable=False)
    revision_name = Column(String, nullable=True)
    change_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Fix relationship to properly define many-to-one
    agent = relationship("Agent", foreign_keys=[agent_id], back_populates="revisions")
    settings = relationship("Settings", back_populates="agent_revisions")
    threads = relationship("UserThread", back_populates="agent_revision")
    
    __table_args__ = (
        sa.UniqueConstraint('agent_id', 'version_number', name='uq_agent_version_number'),
    )
    
    def to_dict(self):
        """Convert agent revision to dictionary for API responses."""
        return {
            "id": str(self.id),
            "agent_id": str(self.agent_id),
            "settings_id": str(self.settings_id),
            "version_number": self.version_number,
            "revision_name": self.revision_name,
            "change_notes": self.change_notes,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

# Assuming UserThread is an existing model, we need to update it
class UserThread(Base):
    __tablename__ = "user_threads"
    
    user = Column(
        UUID(as_uuid=True),
        ForeignKey('users.id', ondelete='CASCADE'),
        primary_key=True
    )
    thread = Column(
        UUID(as_uuid=True),
        primary_key=True
    )
    # Add new columns for agent relationships
    agent_id = Column(
        UUID(as_uuid=True),
        ForeignKey('agents.id', ondelete='SET NULL'),
        nullable=True
    )
    agent_revision_id = Column(
        UUID(as_uuid=True),
        ForeignKey('agent_revisions.id', ondelete='SET NULL'),
        nullable=True
    )
    created_at = Column(
        DateTime(timezone=True),
        server_default=sa.text('now()'),
        nullable=False
    )
    
    # Define relationships with agents
    agent = relationship("Agent", back_populates="threads")
    agent_revision = relationship("AgentRevision", back_populates="threads")
