from pydantic import BaseModel, Field, field_serializer
from typing import Optional
from datetime import datetime, timezone
from src.schemas.entities.store import BaseEntity


class ShareToken(BaseEntity):
    """Represents a share link for a thread."""

    token_hash: str = Field(..., description="SHA-256 hash of the share token")
    token_prefix: str = Field(
        ..., description="First 12 chars of token for display (shr_xxxx...)"
    )
    thread_id: str = Field(..., description="ID of the thread being shared")
    owner_id: str = Field(..., description="ID of the user who owns the thread")
    allow_follow_up: bool = Field(
        default=True, description="Allow anonymous users to continue conversation"
    )
    follow_up_model: Optional[str] = Field(
        None, description="Model to use for anonymous follow-up (cheap model)"
    )
    expires_at: Optional[datetime] = Field(
        None, description="When the share link expires"
    )
    revoked_at: Optional[datetime] = Field(
        None, description="When the share was revoked (soft delete)"
    )
    view_count: int = Field(default=0, description="Number of times share was accessed")

    @property
    def is_valid(self) -> bool:
        """Check if share is currently valid."""
        if self.revoked_at:
            return False
        if self.expires_at and self.expires_at < datetime.now(timezone.utc):
            return False
        return True

    @field_serializer("expires_at", "revoked_at")
    def serialize_datetime(self, dt: Optional[datetime], _):
        if dt is None:
            return None
        if isinstance(dt, datetime):
            return dt.isoformat()
        return dt


class CreateShareRequest(BaseModel):
    """Request to create a share link for a thread."""

    expires_in_hours: Optional[int] = Field(
        default=168,
        ge=1,
        le=8760,
        description="Hours until expiration (default 7 days)",
    )
    allow_follow_up: bool = Field(
        default=True, description="Allow anonymous continuation"
    )
    follow_up_model: Optional[str] = Field(
        None, description="Model for anonymous follow-up (defaults to low-cost)"
    )


class ShareResponse(BaseModel):
    """Response when creating a share link."""

    token: str = Field(..., description="Full share token (returned only once)")
    prefix: str = Field(..., description="Token prefix for display")
    thread_id: str = Field(..., description="ID of shared thread")
    share_url: str = Field(..., description="URL path to access shared thread")
    expires_at: Optional[datetime] = Field(None, description="Expiration timestamp")
    allow_follow_up: bool = Field(..., description="Whether follow-up is allowed")

    @field_serializer("expires_at")
    def serialize_expires_at(self, dt: Optional[datetime], _):
        if dt is None:
            return None
        if isinstance(dt, datetime):
            return dt.isoformat()
        return dt


class SharedThreadResponse(BaseModel):
    """Public thread data returned to anonymous users."""

    thread_id: str
    title: Optional[str] = None
    messages: list[dict] = Field(default_factory=list)
    files: Optional[dict] = None
    todos: Optional[list] = None
    shared_at: Optional[datetime] = None
    allow_follow_up: bool = True
    follow_up_model: Optional[str] = None

    @field_serializer("shared_at")
    def serialize_shared_at(self, dt: Optional[datetime], _):
        if dt is None:
            return None
        if isinstance(dt, datetime):
            return dt.isoformat()
        return dt
