from typing import Any
from langgraph.store.memory import InMemoryStore

in_memory_store = InMemoryStore()


class ThreadService:
    def __init__(self, store: InMemoryStore = in_memory_store):
        self.store = store

    async def update(self, thread_id: str, data: dict):
        await self.store.aput(namespace=("threads",), key=thread_id, value=data)
        return True

    async def get(self, key: str) -> Any:
        return await self.store.aget(("threads",), key)

    async def delete(self, key: str) -> bool:
        await self.store.adelete(("threads",), key)
        return True

    async def search(
        self,
    ) -> list[dict]:
        threads = await self.store.asearch(("threads",))
        return [thread.dict() for thread in threads]


thread_service = ThreadService()
