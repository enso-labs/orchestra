from typing import Any
from langgraph.store.memory import InMemoryStore
from langgraph.store.base import BaseStore
from src.utils.logger import logger
from src.constants import TEST_USER_ID

IN_MEMORY_STORE = InMemoryStore()


class ThreadService:
    def __init__(
        self,
        user_id: str = None,
        assistant_id: str = None,
        store: BaseStore = IN_MEMORY_STORE,
    ):
        self.user_id = user_id or TEST_USER_ID
        self.assistant_id = assistant_id
        self.store: BaseStore = store

    def _get_namespace(self):
        if self.assistant_id:
            return ("threads", self.user_id, self.assistant_id)
        else:
            return ("threads", self.user_id)

    async def update(self, thread_id: str, data: dict):
        namespace = self._get_namespace()
        await self.store.aput(namespace=namespace, key=thread_id, value=data)
        return True

    async def get(self, key: str) -> Any:
        namespace = self._get_namespace()
        return await self.store.aget(namespace, key)

    async def delete(self, key: str) -> bool:
        try:
            namespace = self._get_namespace()
            await self.store.adelete(namespace, key)
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
