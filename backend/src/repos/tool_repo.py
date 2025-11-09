
from typing import Any, Literal
from langgraph.store.base import BaseStore, SearchItem
from pydantic import BaseModel, Field
from datetime import datetime

from src.services.db import get_store_in_memory
from src.utils.logger import logger
from src.utils.security import encrypt_value, decrypt_value


class SavedTool(BaseModel):
	name: str
	base_tool: str
	description: str = Field(default="")
	type: Literal["default", "mcp", "a2a", "api"]
	args: dict = Field(default_factory=dict)
	metadata: dict = Field(default_factory=dict)
	tags: list[str] = Field(default_factory=list)
	verbose: bool = Field(default=False)
	disabled: bool = Field(default=False)
	public: bool = Field(default=False)
	created_at: datetime = Field(default_factory=datetime.now)
	updated_at: datetime = Field(default_factory=datetime.now)

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
		if "env" in tool.metadata:
			tool.metadata["env"] = encrypt_value(tool.metadata["env"])
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
			if "env" in tool.value["metadata"]:
				tool.value["metadata"]["env"] = decrypt_value(tool.value["metadata"]["env"])
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