import sqlalchemy as sa
from sqlalchemy import Column, String, Text, Boolean, DateTime, func, ForeignKey, UUID
from sqlalchemy.orm import relationship
import json

from src.services.db import Base

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