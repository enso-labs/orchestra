from typing import Any
from langgraph.store.memory import InMemoryStore
from langgraph.store.base import BaseStore, SearchItem

IN_MEMORY_STORE = InMemoryStore()

class MemoryService:
    def __init__(
        self, 
        user_id: str = None,
        store: BaseStore = IN_MEMORY_STORE
    ):
        if user_id is None:
            raise ValueError("User ID is required for memory_service")
        self.user_id = user_id
        self.store: BaseStore = store

    def _get_namespace(self):
        return (self.user_id, "memories")

    async def set(self, key: str, value: Any, ttl: int | None = None) -> bool:
        await self.store.aput(namespace=self._get_namespace(), key=key, value=value, ttl=ttl)
        return True

    async def get(self, key: str) -> Any:
        return await self.store.aget(self._get_namespace(), key)

    async def delete(self, key: str) -> bool:
        await self.store.adelete(self._get_namespace(), key)
        return True

    async def search(self, query: str) -> list[SearchItem]:
        return await self.store.asearch(self._get_namespace(), query=query)


memory_service = MemoryService()
