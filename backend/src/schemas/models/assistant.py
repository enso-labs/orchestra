from typing import Optional
from src.utils.format import slugify
from pydantic import BaseModel, computed_field


class AssistantSearch(BaseModel):
    limit: int = 200
    offset: int = 0
    sort: str = "updated_at"
    sort_order: str = "desc"
    filter: dict = {}


class Assistant(BaseModel):
    id: Optional[str] = None
    name: str
    description: str
    model: str
    prompt: str
    tools: list[str]
    mcp: Optional[dict] = None
    a2a: Optional[dict] = None
    metadata: Optional[dict] = None
    updated_at: Optional[str] = None
    created_at: Optional[str] = None

    @computed_field
    @property
    def slug(self) -> str:
        return slugify(self.name)
