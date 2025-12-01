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

    def _get_namespace(self):
        return (self.user_id, "threads")

    async def update(self, thread_id: str, data: dict):
        if self.assistant_id:
            data["assistant_id"] = self.assistant_id
        
        # Extract last human message for storage
        messages = data.get("messages", [])
        last_human_message = None
        for message in reversed(messages):
            if isinstance(message, HumanMessage):
                last_human_message = message
                break
        
        # Create a copy of data with only the last human message for storage
        storage_data = data.copy()
        storage_data["messages"] = [last_human_message.model_dump()] if last_human_message else []
        
        await self.store.aput(
            namespace=self._get_namespace(), key=thread_id, value=storage_data
        )

        # Update thread snapshot for search (non-blocking)
        try:
            if messages:
                await self.thread_snapshot_repo.upsert_snapshot(thread_id, messages)
        except Exception as e:
            logger.error(f"Failed to update thread snapshot for {thread_id}: {e}")

        return True

    async def get(self, thread_id: str) -> Any:
        return await self.thread_repo.get(thread_id)

    async def delete(self, thread_id: str) -> bool:
        return await self.thread_repo.delete(thread_id)

    async def search(self, search_filter: SearchFilter) -> list[dict]:
        return await self.thread_repo.search(search_filter)


thread_service = ThreadService()
