from typing import Literal, Optional
from dataclasses import dataclass
from fastapi.openapi.models import Example
from langchain_core.runnables import RunnableConfig
from langgraph.store.base import BaseStore, SearchItem
from langchain_core.tools import StructuredTool
from langchain_mcp_adapters.client import MultiServerMCPClient
from pydantic import BaseModel, Field
from datetime import datetime

from src.schemas.entities.a2a import A2AServers
from src.services.db import get_store_in_memory
from src.utils.logger import logger
from src.utils.security import encrypt_value, decrypt_value
from src.tools import TOOL_LIBRARY
from src.utils.tools import create_api_tool


@dataclass
class ToolExamples:
    EXAMPLES = {
        "webhook_marketing_channel": Example(
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
        "get_server_health": Example(
            name="get_server_health",
            description="Use this to get the health of the server and app version.",
            config={
                "api_tool": {
                    "base_url": "https://chat.ruska.ai/api",
                    "method": "GET",
                    "endpoint": "/info/health",
                }
            },
            type="api",
            metadata={},
            env={},
            tags=["health"],
        ),
    }


class APIConfig(BaseModel):
    base_url: str
    method: str
    endpoint: str
    args_schema: Optional[dict] = None
    headers: Optional[dict] = None

    def __init__(self, **data):
        super().__init__(**data)
        if self.args_schema is not None:
            self.args_schema = self._coerce_args_schema_types(self.args_schema)

    @staticmethod
    def _coerce_args_schema_types(args_schema):
        """
        Recursively converts 'type' values in args_schema from JS types ('string', 'number', 'array', etc.)
        to Python types ('str', 'int'/'float', 'list', etc.).
        """
        type_mapping = {
            "string": "str",
            "number": "float",
            "integer": "int",
            "array": "list",
            "object": "dict",
            "boolean": "bool",
        }

        def coerce(schema):
            if isinstance(schema, dict):
                coerced = schema.copy()
                # If this is a schema field with a "type"
                if "type" in coerced and isinstance(coerced["type"], str):
                    js_type = coerced["type"].lower()
                    coerced["type"] = type_mapping.get(js_type, coerced["type"])  # fallback to original
                # Recurse into nested schemas
                for key, value in coerced.items():
                    if isinstance(value, dict):
                        coerced[key] = coerce(value)
                    elif isinstance(value, list):
                        coerced[key] = [coerce(item) for item in value]
                return coerced
            elif isinstance(schema, list):
                return [coerce(item) for item in schema]
            else:
                return schema

        return coerce(args_schema)


class MCPConfig(BaseModel):
    transport: Literal["sse", "streamable_http", "stdio"]
    url: str
    headers: dict[str, str]


class A2AConfig(BaseModel):
    base_url: str
    agent_card_path: str


class ToolConfig(BaseModel):
    base_tool: Optional[str] = None
    api_tool: Optional[APIConfig] = None
    mcp_tool: Optional[dict[str, dict]] = None  # mcp_tool is always a dict (after MCPConfig.model_dump)
    a2a_tool: Optional[dict[str, A2AConfig]] = None

    @staticmethod
    def mcp_tool_as_dict(
        mcp_tool: Optional[dict[str, MCPConfig]],
    ) -> Optional[dict[str, dict]]:
        if mcp_tool is None:
            return None
        # Return a dict where values are model_dump() representations of MCPConfig
        return {k: v.model_dump() if isinstance(v, MCPConfig) else v for k, v in mcp_tool.items()}

    def dict(self, *args, **kwargs):
        data = super().dict(*args, **kwargs)
        # Ensure mcp_tool is always dict-like, with any MCPConfig model_dumped
        if "mcp_tool" in data and data["mcp_tool"] is not None:
            data["mcp_tool"] = self.mcp_tool_as_dict(self.mcp_tool)
        return data

    def model_dump(self, *args, **kwargs):
        # Same behavior as .dict(), for pydantic v2 compat
        return self.dict(*args, **kwargs)


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
        if type_val in {"a2a", "workflow"}:
            raise NotImplementedError(f"Tool type '{type_val}' is not yet implemented.")
        return value

    @classmethod
    def __get_validators__(cls):
        yield cls.validate
        yield from super().__get_validators__()

    def to_api_tool(self) -> StructuredTool:
        api_config = self.config.api_tool.model_dump()
        tool = create_api_tool(
            name=self.name,
            description=self.description,
            base_url=api_config["base_url"],
            method=api_config.get("method", "GET"),
            endpoint=api_config["endpoint"],
            args_schema=api_config.get("args_schema"),
            headers=api_config.get("headers"),
        )
        tool.metadata = {
            **self.metadata,
            "type": "api",
            "env": self.env,
            "api_config": api_config,
        }
        tool.tags = self.tags + ["api_tool"]
        return tool

    def to_base_tool(self) -> StructuredTool:
        found_tool = next((tool for tool in TOOL_LIBRARY if tool.name == self.config.base_tool), None)
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

    async def to_mcp_tools(self, server_name: Optional[str] = None) -> list[StructuredTool]:
        mcp_client = MultiServerMCPClient(self.config.mcp_tool)
        tools = await mcp_client.get_tools(server_name=server_name)
        for tool in tools:
            tags = list(getattr(tool, "tags", []) or [])
            if "mcp_tool" not in tags:
                tags.append("mcp_tool")
            tool.tags = tags
        return tools

    async def to_a2a_tools(self, thread_id: str) -> list[StructuredTool]:
        a2a_config = self.config.a2a_tool.model_dump()
        a2a_client = A2AServers(a2a=a2a_config)
        tools = a2a_client.fetch_agent_cards_as_tools(thread_id)
        return tools

    async def to_structured_tools(self) -> list[StructuredTool]:
        if self.type == "api":
            return [self.to_api_tool()]
        elif self.type == "mcp":
            # return await self.to_mcp_tools()
            return []
        elif self.type == "a2a":
            # return self.to_a2a_tools()
            return []
        else:
            return [self.to_base_tool()]


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
        await self.store.aput(namespace=self._get_namespace(), key=tool.name, value=tool_data, ttl=ttl)
        return True

    async def edit(self, tool_name: str, tool: SavedTool):
        try:
            del tool.created_at
            del tool.updated_at
            del tool.name
            tool_data = tool.model_dump()
            if "env" in tool_data:
                tool_data["env"] = encrypt_value(tool_data["env"])
            if "created_at" in tool_data:
                tool_data["created_at"] = tool_data["created_at"].isoformat()
            if "updated_at" in tool_data:
                tool_data["updated_at"] = tool_data["updated_at"].isoformat()
            await self.store.aput(namespace=self._get_namespace(), key=tool_name, value=tool_data)
            return True
        except Exception as e:
            logger.exception(f"Error updating {self._get_store_key()} {tool_name}: {e}")
            return False

        return True

    async def _format_tools(self, tools: list[SearchItem]) -> list[StructuredTool]:
        decrypted_tools = []
        logger.info(f"Formatting {len(tools)} tools")
        for tool in tools:
            if "env" in tool.value:
                tool.value["env"] = decrypt_value(tool.value["env"])
            saved_tool = SavedTool.model_validate(tool.value)
            decrypted_tools.extend(await saved_tool.to_structured_tools())
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
            return await self._format_tools(results)
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
