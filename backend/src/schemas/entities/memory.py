from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class Memory(BaseModel):
    id: str
    content: str
    enabled: bool = True
    metadata: Optional[dict] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class MemoryCreate(BaseModel):
    content: str = Field(..., min_length=1)
    path: str = Field(..., min_length=1)
    metadata: Optional[dict] = None


class MemoryUpdate(BaseModel):
    content: str = Field(..., min_length=1)
    metadata: Optional[dict] = None
    enabled: Optional[bool] = None


class MemoryListResponse(BaseModel):
    memories: list[Memory]
    total: int
    limit: int
    offset: int
