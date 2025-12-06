from typing import Literal, Optional, TypedDict
from dataclasses import dataclass
from fastapi.openapi.models import Example
from langchain_core.runnables import RunnableConfig
from langgraph.store.base import BaseStore, SearchItem
from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field
from datetime import datetime

from src.services.db import get_store_in_memory
from src.utils.logger import logger
from src.utils.security import encrypt_value, decrypt_value
from src.tools import TOOL_LIBRARY
from src.utils.tools import create_api_tool


@dataclass
class ToolExamples:
    EXAMPLES = {
        'webhook_marketing_channel': Example(
            name="webhook_marketing_channel",
            base_tool="send_webhook_to_channel",
            description="Send a message to the GridSite Microsoft Teams channel.",
            type="default",
            metadata={},
            env={"TEST_WEBHOOK_URL": "https://example.com/webhook"},
            tags=["example"],
            verbose=False,
            disabled=False,
            public=False,
        ),
        'get_server_health': Example(
            name="get_server_health",
            description="Use this to get the health of the server and app version.",
            config={
                'api_tool': {
                    'base_url': 'https://chat.enso.sh/api',
                    'method': 'GET',
                    'endpoint': '/info/health',
                }
            },
            type="api",
            metadata={},
            env={},
            tags=["health"],
        ),
    }


class ApiConfig(BaseModel):
    base_url: str
    method: str
    endpoint: str
    args_schema: Optional[dict] = None
    headers: Optional[dict] = None

class ToolConfig(BaseModel):
    base_tool: Optional[str] = None
    api_tool: Optional[ApiConfig] = None

class SavedTool(BaseModel):
    name: str
    config: ToolConfig
    description: str = Field(default="")
    type: Literal["default", "mcp", "a2a", "api", "workflow"]
    metadata: dict = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)
    env: Optional[dict] = None
    verbose: bool = Field(default=False)
    disabled: bool = Field(default=False)
    public: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    @classmethod
    def validate(cls, value):
        # Support for BaseModel-style validation hooks
        if isinstance(value, dict):
            type_val = value.get("type")
        else:
            type_val = getattr(value, "type", None)
        if type_val in {"mcp", "a2a", "workflow"}:
            raise NotImplementedError(f"Tool type '{type_val}' is not yet implemented.")
        return value

    @classmethod
    def __get_validators__(cls):
        yield cls.validate
        yield from super().__get_validators__()
    

    def to_structured_tool(self) -> StructuredTool:
        if self.type == "api":
            api_config = self.config.api_tool.model_dump()
            tool = create_api_tool(
                name=self.name, 
                description=self.description, 
                base_url=api_config["base_url"],
                method=api_config.get("method", "GET"),
                endpoint=api_config["endpoint"],
                args_schema=api_config.get("args_schema", None),
                headers=api_config.get("headers", {}),
            )
            tool.metadata = {
                **self.metadata, 
                "type": "api", 
                "env": self.env,
                "api_config": api_config
            }
            tool.tags = self.tags
            return tool
        
        found_tool = next(
            (tool for tool in TOOL_LIBRARY if tool.name == self.config.base_tool), None
        )
        if not found_tool:
            raise ValueError(f"Tool {self.config.base_tool} not found")
        tool_data = {**found_tool.model_dump(), **self.model_dump()}
        structured_tool = StructuredTool.from_function(**tool_data)
        structured_tool.metadata = {
            **self.metadata,
            "base_tool": self.config.base_tool,
            "env": self.env,
        }
        return structured_tool


class ToolRepo:
    def __init__(
        self,
        user_id: str = None,
        store: BaseStore = get_store_in_memory(),
        config: RunnableConfig = None,
    ):
        self.user_id = user_id
        self.store: BaseStore = store

    def _get_namespace(self):
        return (self.user_id, "tools")

    async def create(self, tool: SavedTool, ttl: int | None = None) -> bool:
        tool_data = tool.model_dump()
        if "env" in tool_data:
            tool_data["env"] = encrypt_value(tool_data["env"])
        if "created_at" in tool_data:
            tool_data["created_at"] = tool_data["created_at"].isoformat()
        if "updated_at" in tool_data:
            tool_data["updated_at"] = tool_data["updated_at"].isoformat()
        await self.store.aput(
            namespace=self._get_namespace(), key=tool.name, value=tool_data, ttl=ttl
        )
        return True

    def _format_tools(self, tools: list[SearchItem]) -> list[StructuredTool]:
        decrypted_tools = []
        logger.info(f"Formatting {len(tools)} tools")
        for tool in tools:
            if "env" in tool.value:
                tool.value["env"] = decrypt_value(tool.value["env"])
            saved_tool = SavedTool.model_validate(tool.value)
            decrypted_tools.append(saved_tool.to_structured_tool())
        return decrypted_tools

    async def search(
        self,
        query: str = None,
        filter: dict = {},
        limit: int = 100,
        offset: int = 0,
    ) -> list[StructuredTool]:
        try:
            results = await self.store.asearch(
                self._get_namespace(),
                query=query,
                filter=filter,
                limit=limit,
                offset=offset,
            )
            return self._format_tools(results)
        except Exception as e:
            logger.exception(f"Error searching tools: {e}")
            return []

    async def delete(
        self,
        name: str,
    ) -> bool:
        await self.store.adelete(
            namespace=self._get_namespace(),
            key=name,
        )
        return True
