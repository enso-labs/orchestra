from langchain_core.messages import BaseMessage
from pydantic import BaseModel
from typing import Optional, Union, Any
from datetime import datetime
from langchain_core.documents import Document
from pydantic import field_serializer, Field


class BaseEntity(BaseModel):
    id: Optional[str] = None
    metadata: Optional[dict] = None
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
    documents: Optional[list[Union[Document, str]]] = None


class Project(BaseEntity):
    name: str
    description: Optional[str] = None
    sources: Optional[list[Source]] = None


class ProjectUpdate(BaseModel):
    """Schema for partial project updates. All fields are optional."""

    name: Optional[str] = None
    description: Optional[str] = None


class Thread(BaseEntity):
    title: Optional[str] = None
    messages: list[Union[BaseMessage, dict]] = Field(default_factory=list)
    files: Optional[Any] = None
    todos: Optional[Any] = None
    score: float | None = None


class Epic(BaseEntity):
    name: str
    description: Optional[str] = None
    status: Optional[str] = "active"


class EpicUpdate(BaseModel):
    """Schema for partial epic updates. All fields are optional."""

    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


class Task(BaseEntity):
    epic_id: str
    title: str
    description: Optional[str] = None
    status: Optional[str] = "todo"
    assignee: Optional[str] = None
    blockers: list[str] = Field(default_factory=list)


class TaskUpdate(BaseModel):
    """Schema for partial task updates. All fields are optional."""

    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    assignee: Optional[str] = None
    blockers: Optional[list[str]] = None
