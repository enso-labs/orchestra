import asyncio
from typing import Any
from langchain_core.messages import HumanMessage
from langgraph.store.memory import InMemoryStore
from langgraph.store.base import BaseStore
from src.schemas.entities import SearchFilter
from src.utils.logger import logger
from src.constants import TEST_USER_ID
from src.repos.thread_repo import ThreadRepo

IN_MEMORY_STORE = InMemoryStore()


class ThreadService:
    def __init__(
        self,
        user_id: str = None,
        assistant_id: str = None,
        store: BaseStore = IN_MEMORY_STORE,
        thread_repo: ThreadRepo = None,
    ):
        self.user_id = user_id or TEST_USER_ID
        self.assistant_id = assistant_id
        self.store: BaseStore = store
        self.thread_id = None
        self.thread_repo = thread_repo or ThreadRepo(
            self.user_id, store
        )

    async def update(self, thread_id: str, data: dict):
        return await self.thread_repo.update(thread_id, data)

    async def get(self, thread_id: str) -> Any:
        return await self.thread_repo.get(thread_id)

    async def delete(self, thread_id: str) -> bool:
        return await self.thread_repo.delete(thread_id)

    async def search(self, search_filter: SearchFilter) -> list[dict]:
        return await self.thread_repo.search(search_filter)


thread_service = ThreadService()
