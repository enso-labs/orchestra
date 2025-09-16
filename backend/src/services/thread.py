from typing import Any
from langgraph.store.memory import InMemoryStore


class ThreadService:
    def __init__(self, user_id: str = None):
        self.user_id = user_id
        self.store = InMemoryStore()

    async def update(self, thread_id: str, data: dict):
        await self.store.aput(
            namespace=("threads", self.user_id), key=thread_id, value=data
        )
        return True

    async def get(self, key: str) -> Any:
        return await self.store.aget(("threads", self.user_id), key)

    async def delete(self, key: str) -> bool:
        await self.store.adelete(("threads", self.user_id), key)
        return True

    async def search(
        self,
        limit: int = 1000,
    ) -> list[dict]:
        threads = await self.store.asearch(("threads", self.user_id), limit=limit)
        return sorted(
            [thread.dict() for thread in threads],
            key=lambda x: x.get("updated_at"),
            reverse=True,
        )


thread_service = ThreadService()
