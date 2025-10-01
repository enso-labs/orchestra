from typing import Optional
from src.utils.format import slugify
from pydantic import BaseModel, computed_field, field_serializer, Field
from datetime import datetime


class AssistantSearch(BaseModel):
    limit: int = 200
    offset: int = 0
    sort: str = "updated_at"
    sort_order: str = "desc"
    filter: dict = {}


class Assistant(BaseModel):
    id: Optional[str] = None
    name: str
    description: str = Field(default="Helpful AI Assistant.")
    model: Optional[str] = None
    prompt: str = Field(default="You are a helpful assistant.")
    tools: list[str]
    subagents: Optional[list["Assistant"]] = []
    mcp: Optional[dict] = {}
    a2a: Optional[dict] = {}
    metadata: dict = {}
    updated_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    @computed_field
    @property
    def slug(self) -> str:
        return slugify(self.name)

    @field_serializer("created_at", "updated_at")
    def serialize_dt(self, dt: Optional[datetime], _):
        return dt.isoformat() if dt else None
