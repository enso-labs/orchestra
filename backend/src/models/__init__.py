import json
from typing import Optional
from datetime import datetime
import sqlalchemy as sa
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from passlib.context import CryptContext
from sqlalchemy.orm import relationship
from sqlalchemy.sql import text
from pydantic import BaseModel

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
    
    # Only relationship to Revisions, not directly to Agents
    revisions = relationship("Revision", back_populates="setting", passive_deletes=True)
    
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
        nullable=False
    )
    name = Column(String, nullable=False)
    slug = Column(String, nullable=False, unique=True)
    description = Column(String, nullable=True)
    public = Column(Boolean, nullable=False, server_default='false')
    revision_number = Column(sa.Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=text("now()"), onupdate=text("now()"), nullable=False)
    
    # No direct relationship to Settings anymore
    # Only a relationship to Revisions
    revisions = relationship("Revision", back_populates="agent", cascade="all, delete-orphan")
    
    # New method to get the current settings via the active revision
    @property
    def active_revision(self):
        # Find the revision that matches the current revision_number
        for revision in self.revisions:
            if revision.revision_number == self.revision_number:
                return revision
        return None
    
    @property
    def settings(self):
        revision = self.active_revision
        if revision:
            return revision.setting
        return None
    
    def to_dict(self, include_setting: bool = True) -> dict:
        result = {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "name": self.name,
            "slug": self.slug,
            "description": self.description,
            "public": self.public,
            "revision_number": self.revision_number,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_setting and self.settings:
            result["setting"] = self.settings.to_dict()
            
        return result
    
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

class Revision(Base):
    __tablename__ = "revisions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    agent_id = Column(UUID(as_uuid=True), ForeignKey('agents.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    settings_id = Column(UUID(as_uuid=True), ForeignKey('settings.id', ondelete='CASCADE'), nullable=False)
    revision_number = Column(sa.Integer, nullable=False)
    name = Column(String, nullable=True)
    description = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=text("now()"), onupdate=text("now()"), nullable=False)
    
    # Relationships
    agent = relationship("Agent", back_populates="revisions")
    setting = relationship("Settings", back_populates="revisions", foreign_keys=[settings_id])
    
    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "agent_id": str(self.agent_id),
            "user_id": str(self.user_id),
            "settings_id": str(self.settings_id),
            "revision_number": self.revision_number,
            "name": self.name,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

class Thread(Base):
    __tablename__ = "threads"
    
    user = Column(
        UUID(as_uuid=True),
        ForeignKey('users.id', ondelete='CASCADE'),
        primary_key=True,
        nullable=False
    )
    thread = Column(
        UUID(as_uuid=True),
        primary_key=True,
        nullable=False
    )
    agent = Column(
        UUID(as_uuid=True),
        ForeignKey('agents.id', ondelete='CASCADE'),
        nullable=True
    )
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    
    # Add relationships
    user_relation = relationship("User", backref="threads")
    agent_relation = relationship("Agent", backref="threads")
    
    def to_dict(self) -> dict:
        return {
            "user": str(self.user),
            "thread": str(self.thread),
            "agent": str(self.agent) if self.agent else None,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class Server(Base):
    __tablename__ = "servers"
    
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
    slug = Column(String, nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    type = Column(String, nullable=False)  # 'mcp' or 'a2a'
    config = Column(sa.JSON, nullable=False)
    documentation = Column(Text, nullable=True)  # Markdown documentation
    documentation_url = Column(String, nullable=True)  # External documentation URL
    public = Column(Boolean, nullable=False, server_default='false')
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # User relationship
    user = relationship("User", backref="servers")
    
    def to_dict(self, include_config: bool = True) -> dict:
        result = {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "name": self.name,
            "slug": self.slug,
            "description": self.description,
            "type": self.type,
            "public": self.public,
            "documentation": self.documentation,
            "documentation_url": self.documentation_url,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_config:
            result["config"] = self.config
            
        return result
    
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

    def __init__(self, name: str, type: str, config: dict, description: str = None, 
                 documentation: str = None, documentation_url: str = None, 
                 public: bool = False, **kwargs):
        """Initialize a new server with auto-generated slug."""
        super().__init__(**kwargs)
        self.name = name
        self.type = type
        self.config = config
        self.description = description
        self.documentation = documentation
        self.documentation_url = documentation_url
        self.public = public
        if 'slug' not in kwargs:
            self.slug = self.generate_slug(name)