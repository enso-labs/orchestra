from pydantic import BaseModel
from typing import Optional, Union
from datetime import datetime
from langchain_core.documents import Document
from pydantic import field_serializer


class BaseEntity(BaseModel):
    id: Optional[str] = None
    updated_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    @field_serializer("created_at", "updated_at")
    def serialize_dt(self, dt: Optional[datetime], _):
        if dt is None:
            return None
        if isinstance(dt, datetime):
            return dt.isoformat()
        # Assume it's already a string (e.g., loaded from db or elsewhere), return as-is
        return dt


class Source(BaseEntity):
    type: str
    content: dict = {}
    metadata: Optional[dict] = None
    documents: Optional[list[Union[Document, str]]] = None


class Project(BaseEntity):
    name: str
    description: Optional[str] = None
    sources: Optional[list[Source]] = None
