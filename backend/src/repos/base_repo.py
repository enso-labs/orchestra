from typing import Any
from langgraph.store.base import BaseStore, SearchItem
from langchain_core.documents import Document

from src.schemas.entities import SearchFilter
from src.services.db import get_store_in_memory
from src.schemas.entities.store import Source, Project, Document
from src.utils.logger import logger

class BaseRepo:
	def __init__(self, 
		user_id: str, 
		store: BaseStore,
		entity_type: str,
  
	):
		self.user_id = user_id
		self.entity_type = entity_type
		self.store: BaseStore = store or get_store_in_memory()

	def _get_namespace(self):
		return (self.user_id, self.entity_type)

	def _filter(self, metadata: dict) -> dict:
		return {
			"metadata": metadata,
		}

	async def _set(self, key: str, value: Source | Project | Document, ttl: int | None = None) -> bool:
		await self.store.aput(
			namespace=self._get_namespace(), key=key, value=value.model_dump(exclude_none=True), ttl=ttl
		)
		logger.info(f"Set {self.entity_type} {key} successfully")
		return True

	async def _delete(self, key: str) -> bool:
		await self.store.adelete(self._get_namespace(), key)
		return True

	async def _get(self, key: str) -> Any:
		return await self.store.aget(self._get_namespace(), key)

	async def _search(
		self, 
		search_filter: SearchFilter,
	) -> list[SearchItem]:
		return await self.store.asearch(
			self._get_namespace(), 
   			query=search_filter.query, 
      		limit=search_filter.limit, 
        	offset=search_filter.offset, 
        	filter=search_filter.filter,
		)