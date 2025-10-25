from typing import Optional, Any
from pydantic import BaseModel, field_serializer, Field
from datetime import datetime


class MemorySearch(BaseModel):
    limit: int = 200
    offset: int = 0
    sort: str = "updated_at"
    sort_order: str = "desc"
    filter: dict = {}
    query: Optional[str] = None


class Memory(BaseModel):
    id: Optional[str] = None
    key: str
    value: Any
    ttl: Optional[int] = None
    metadata: dict = Field(default_factory=dict)
    updated_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    @field_serializer("created_at", "updated_at")
    def serialize_dt(self, dt: Optional[datetime], _):
        return dt.isoformat() if dt else None

