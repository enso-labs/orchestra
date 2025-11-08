from typing import Any, Literal
from langgraph.store.base import BaseStore, SearchItem
from pydantic import BaseModel, Field
from datetime import datetime
from src.services.db import get_store_in_memory


class SavedTool(BaseModel):
    name: str
    description: str = Field(default="")
    type: Literal["default", "mcp", "a2a", "api"]
    args: dict = Field(default_factory=dict)
    config: dict = Field(default_factory=dict)
    env: dict = Field(default_factory=dict)
    metadata: dict = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)
    verbose: bool = Field(default=False)
    disabled: bool = Field(default=False)
    public: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

class ToolRepo:
    _instance = None

    def __new__(cls, user_id: str = None, store: BaseStore = get_store_in_memory()):
        if cls._instance is None:
            cls._instance = super(ToolRepo, cls).__new__(cls)
            cls._instance.user_id = user_id
            cls._instance.store = store
        return cls._instance

    def _get_namespace(self):
        return (self.user_id, "tools")

    async def create(
        self, 
        tool: SavedTool, 
        ttl: int | None = None
    ) -> bool:
        await self.store.aput(
            namespace=self._get_namespace(), 
            key=tool.name, 
            value=tool.model_dump(), 
            ttl=ttl
        )
        return True

    async def search(
        self, 
        query: str = None, 
        limit: int = 20,
        filter: dict = {}
    ) -> list[SavedTool]:
        return await self.store.asearch(
            namespace=self._get_namespace(), 
            query=query, 
            limit=limit,
            filter=filter
        )

