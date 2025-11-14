from typing import Any
from langgraph.store.base import BaseStore, SearchItem
from src.services.db import get_store_in_memory

class MemoryService:
    def __init__(self, user_id: str = None, store: BaseStore = get_store_in_memory()):
        self.user_id = user_id
        self.store: BaseStore = store

    def _get_namespace(self):
        return (self.user_id, "memories")

    async def set(self, key: str, value: Any, ttl: int | None = None) -> bool:
        await self.store.aput(
            namespace=self._get_namespace(), key=key, value=value, ttl=ttl
        )
        return True

    async def get(self, key: str) -> Any:
        return await self.store.aget(self._get_namespace(), key)

    async def delete(self, key: str) -> bool:
        await self.store.adelete(self._get_namespace(), key)
        return True

    async def search(self, query: str = None, limit: int = 20) -> list[SearchItem]:
        return await self.store.asearch(self._get_namespace(), query=query, limit=limit)


memory_service = MemoryService()
