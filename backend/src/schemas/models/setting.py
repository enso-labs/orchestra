import sqlalchemy as sa
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from src.services.db import get_db_base

class Settings(get_db_base()):
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