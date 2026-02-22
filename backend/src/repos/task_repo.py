from datetime import datetime
from typing import Optional
from uuid import uuid4

from langgraph.store.base import BaseStore, SearchItem

from src.repos.base_repo import BaseRepo
from src.schemas.entities import SearchFilter
from src.schemas.entities.store import Task
from src.services.db import get_store_in_memory
from src.utils.logger import logger


class TaskRepo(BaseRepo):
    def __init__(self, user_id: str, store: Optional[BaseStore] = None):
        store = store or get_store_in_memory()
        super().__init__(user_id=user_id, store=store, entity_type="tasks")

    async def create(self, task: Task) -> Task:
        try:
            task.id = str(uuid4())
            task.created_at = datetime.now()
            task.updated_at = datetime.now()
            task.metadata = {"epic_id": task.epic_id}
            created = await self._set(key=task.id, value=task)
            if created:
                return task
            else:
                raise Exception("Failed to create task")
        except Exception as e:
            logger.error(f"Error creating task: {e}")
            raise e

    async def get(self, task_id: str) -> Optional[Task]:
        item = await self._get(task_id)
        if item is None:
            return None
        return Task.model_validate(item.value)

    async def update(self, task_id: str, data: dict) -> Task:
        """Update an existing task with new data."""
        existing = await self._get(task_id)
        if not existing:
            raise ValueError(f"Task {task_id} not found")

        current_task = Task.model_validate(existing.value)
        updated_data = current_task.model_dump(exclude_none=True)

        allowed_fields = {"title", "description", "status", "assignee", "blockers"}
        for key, value in data.items():
            if key in allowed_fields:
                updated_data[key] = value

        updated_data["updated_at"] = datetime.now()

        updated_task = Task.model_validate(updated_data)
        await self._set(key=task_id, value=updated_task)
        return updated_task

    async def list_by_epic(self, epic_id: str) -> list[Task]:
        """Filter tasks by epic_id using metadata filter."""
        search_filter = SearchFilter(
            query="",
            filter={"epic_id": epic_id},
            limit=100,
            offset=0,
        )
        items: list[SearchItem] = await self._search(search_filter)
        return [Task.model_validate(item.value) for item in items]

    async def search(self, search_filter: SearchFilter) -> list[Task]:
        items: list[SearchItem] = await self._search(search_filter)
        return [Task.model_validate(item.value) for item in items]

    async def delete(self, task_id: str) -> bool:
        existing = await self._get(task_id)
        if not existing:
            return False
        await self._delete(task_id)
        return True
