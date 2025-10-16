from typing import Optional, TYPE_CHECKING
from langchain_core.messages import BaseMessage
from src.utils.format import slugify
from pydantic import BaseModel, computed_field, field_serializer, Field
from datetime import datetime

if TYPE_CHECKING:
    from src.schemas.entities import Config
    from src.schemas.entities import LLMRequest


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
    subagents: Optional[list[dict]] = []
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

    def to_llm_request(
        self,
        messages: list[BaseMessage],
        prompt: str = None, 
        model: str = None,
        metadata: "Config" = None,
    ) -> "LLMRequest":
        from src.schemas.entities import Config
        from src.schemas.entities import LLMRequest
        if metadata and isinstance(metadata, Config):
            metadata = metadata.model_dump()
        return LLMRequest(
            model=model or self.model,
            system=prompt or self.prompt,
            tools=self.tools,
            a2a=self.a2a,
            mcp=self.mcp,
            subagents=self.subagents,
            metadata=metadata or self.metadata,
            messages=messages
        )