import sqlalchemy as sa
from sqlalchemy import Column, DateTime,  ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from src.services.db import get_db_base

class Thread(get_db_base()):
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
    user_relation = relationship("User", back_populates="threads")
    agent_relation = relationship("Agent", backref="agent_threads")
    
    def to_dict(self) -> dict:
        return {
            "user": str(self.user),
            "thread": str(self.thread),
            "agent": str(self.agent) if self.agent else None,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }