from typing import Literal, Optional
from langgraph.store.base import BaseStore, SearchItem
from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field
from datetime import datetime

from src.services.db import get_store_in_memory
from src.utils.logger import logger
from src.utils.security import encrypt_value, decrypt_value
from src.tools import TOOL_LIBRARY


class SavedTool(BaseModel):
	name: str
	base_tool: str
	description: str = Field(default="")
	type: Literal["default", "mcp", "a2a", "api"]
	metadata: dict = Field(default_factory=dict)
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
	_instance: "ToolRepo" = None
	user_id: str = None
	store: BaseStore = None

	def __new__(
		cls, 
		user_id: str = None, 
		store: BaseStore = get_store_in_memory()
	) -> "ToolRepo":
		if cls._instance is None:
			cls._instance = super(ToolRepo, cls).__new__(cls)
			cls._instance.user_id = user_id
			cls._instance.store: BaseStore = store
		return cls._instance

	def _get_namespace(self):
		return (self.user_id, "tools")

	async def create(
		self, 
		tool: SavedTool, 
		ttl: int | None = None
	) -> bool:
		if tool.env:
			tool.env = encrypt_value(tool.env)
		await self.store.aput(
			namespace=self._get_namespace(), 
			key=tool.name, 
			value=tool.model_dump(), 
			ttl=ttl
		)
		return True

	def _format_tools(self, tools: list[SearchItem]) -> list[SavedTool]:
		decrypted_tools = []
		logger.info(f"Formatting {len(tools)} tools")
		for tool in tools:
			if "env" in tool.value:
				tool.value["env"] = decrypt_value(tool.value["env"])
			saved_tool = SavedTool.model_validate(tool.value)
			decrypted_tools.append(saved_tool)
		return decrypted_tools

	async def search(
		self, 
		query: str = None,
		filter: dict = {},
		limit: int = 100,
		offset: int = 0,
	) -> list[SavedTool]:
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