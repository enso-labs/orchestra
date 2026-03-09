from typing import Any
from langgraph.store.base import BaseStore
from src.services.db import get_store_in_memory
from src.schemas.entities import SearchFilter
from src.constants import TEST_USER_ID
from src.repos.thread_repo import ThreadRepo
from src.schemas.entities.store import Thread
from src.utils.format import get_time


class ThreadService:
    def __init__(
        self,
        user_id: str = None,
        assistant_id: str = None,
        store: BaseStore = None,
        thread_repo: ThreadRepo = None,
    ):
        self.user_id = user_id or TEST_USER_ID
        self.assistant_id = assistant_id
        self.store: BaseStore = store
        self.thread_id = None

        if not store:
            self.store = get_store_in_memory()
        self.thread_repo = thread_repo or ThreadRepo(self.user_id, self.store)

    async def create(self, thread: Thread):
        return await self.thread_repo.create(thread)

    async def update(self, thread_id: str, data: dict):
        return await self.thread_repo.update(thread_id, data)

    async def update_checkpoint_snapshot(
        self,
        thread_id: str,
        *,
        messages: list[Any],
        checkpoint_id: str | None,
        assistant_id: str | None = None,
        project_id: str | None = None,
        files: Any = None,
        todos: Any = None,
        title: str | None = None,
        checkpoint_count: int | None = None,
    ) -> bool:
        existing = await self.get(thread_id)
        existing_data = existing.model_dump(exclude_none=True) if existing else {}
        existing_count = existing.checkpoint_count if existing else None

        if checkpoint_count is None:
            checkpoint_count = (existing_count + 1) if existing_count is not None else None

        data = {
            **existing_data,
            "thread_id": thread_id,
            "checkpoint_id": checkpoint_id,
            "head_checkpoint_id": checkpoint_id,
            "assistant_id": assistant_id,
            "project_id": project_id,
            "messages": messages,
            "updated_at": get_time(),
        }

        if title is not None:
            data["title"] = title
        if files is not None:
            data["files"] = files
        if todos is not None:
            data["todos"] = todos
        if checkpoint_count is not None:
            data["checkpoint_count"] = checkpoint_count

        return await self.thread_repo.update(thread_id, data)

    async def get(self, thread_id: str) -> Any:
        return await self.thread_repo.get(thread_id)

    async def delete(self, thread_id: str) -> bool:
        return await self.thread_repo.delete(thread_id)

    async def search(self, search_filter: SearchFilter) -> list[dict]:
        return await self.thread_repo.search(search_filter)


thread_service = ThreadService()
