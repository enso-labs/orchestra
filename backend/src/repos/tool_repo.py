from typing import Literal, Optional
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

@dataclass
class ToolExamples:
    CREATE_EXAMPLE = Example(
		name="webhook_marketing_channel",
		base_tool="send_webhook_to_channel",
		description="Send a message to the GridSite Microsoft Teams channel.",
		type="default",
		metadata={},
		env={
			"TEST_WEBHOOK_URL": "https://example.com/webhook"
		},
		tags=["example"],
		verbose=False,
		disabled=False,
		public=False,
	)

class SavedTool(BaseModel):
	name: str
	base_tool: str
	description: str = Field(default="")
	type: Literal["default", "mcp", "a2a", "api"]
	metadata: dict = Field(default_factory=dict)
	tags: list[str] = Field(default_factory=list)
	env: Optional[dict] = None
	verbose: bool = Field(default=False)
	disabled: bool = Field(default=False)
	public: bool = Field(default=False)
	created_at: datetime = Field(default_factory=datetime.now)
	updated_at: datetime = Field(default_factory=datetime.now)
 
	def to_structured_tool(self) -> StructuredTool:
		found_tool = next((tool for tool in TOOL_LIBRARY if tool.name == self.base_tool), None)
		if not found_tool:
			raise ValueError(f"Tool {self.base_tool} not found")
		tool_data = {**found_tool.model_dump(), **self.model_dump()}
		structured_tool = StructuredTool.from_function(**tool_data)
		structured_tool.metadata = {
      		**self.metadata,
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

	async def create(
		self, 
		tool: SavedTool, 
		ttl: int | None = None
	) -> bool:
		tool_data = tool.model_dump()
		if "env" in tool_data:
			tool_data["env"] = encrypt_value(tool_data["env"])
		if "created_at" in tool_data:
			tool_data["created_at"] = tool_data["created_at"].isoformat()
		if "updated_at" in tool_data:
			tool_data["updated_at"] = tool_data["updated_at"].isoformat()
		await self.store.aput(
			namespace=self._get_namespace(), 
			key=tool.name, 
			value=tool_data, 
			ttl=ttl
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