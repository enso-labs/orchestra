import sqlalchemy as sa
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, UUID, text
from sqlalchemy.orm import relationship
import json

from src.services.db import Base

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