from typing import Any
from langgraph.store.memory import InMemoryStore
from langgraph.store.base import BaseStore
from src.utils.logger import logger
from src.constants import TEST_USER_ID

IN_MEMORY_STORE = InMemoryStore()


class ThreadService:
    def __init__(self, user_id: str = None, store: BaseStore = IN_MEMORY_STORE):
        self.user_id = user_id or TEST_USER_ID
        self.store: BaseStore = store

    async def update(self, thread_id: str, data: dict, assistant_id: str = None):
        if assistant_id:
            namespace = ("threads", self.user_id, assistant_id)
        else:
            namespace = ("threads", self.user_id)
        await self.store.aput(namespace=namespace, key=thread_id, value=data)
        return True

    async def get(self, key: str) -> Any:
        return await self.store.aget(("threads", self.user_id), key)

    async def delete(self, key: str) -> bool:
        try:
            await self.store.adelete(("threads", self.user_id), key)
            return True
        except Exception as e:
            logger.exception(f"Error deleting thread: {e}")
            return False

    async def search(
        self,
        limit: int = 1000,
        filter: dict = {},
    ) -> list[dict]:
        try:
            default_namespace = ("threads", self.user_id)
            if "assistant_id" in filter:
                default_namespace = ("threads", self.user_id, filter["assistant_id"])
            async with self.store as store:
                threads = await store.asearch(default_namespace, limit=limit)
                return sorted(
                    [thread.dict() for thread in threads],
                    key=lambda x: x.get("updated_at"),
                    reverse=True,
                )
        except Exception as e:
            logger.error(f"Error searching threads: {e}")
            return []


thread_service = ThreadService()
