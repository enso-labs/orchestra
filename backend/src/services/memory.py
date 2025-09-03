from typing import Any
from langgraph.store.memory import InMemoryStore

in_memory_store = InMemoryStore()


class MemoryService:
    def __init__(self, store: InMemoryStore = in_memory_store):
        self.store = store

    async def set(self, key: str, value: Any, ttl: int | None = None) -> bool:
        await self.store.aput(namespace=("memories",), key=key, value=value, ttl=ttl)
        return True

    async def get(self, key: str) -> Any:
        return await self.store.aget(("memories",), key)

    async def delete(self, key: str) -> bool:
        await self.store.adelete(("memories",), key)
        return True

    async def search(self) -> Any:
        return await self.store.asearch(("memories",))


memory_service = MemoryService()
