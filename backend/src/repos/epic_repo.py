from datetime import datetime
from typing import Optional
from uuid import uuid4

from langgraph.store.base import BaseStore, SearchItem

from src.repos.base_repo import BaseRepo
from src.schemas.entities import SearchFilter
from src.schemas.entities.store import Epic
from src.services.db import get_store_in_memory
from src.utils.logger import logger


class EpicRepo(BaseRepo):
    def __init__(self, user_id: str, store: Optional[BaseStore] = None):
        store = store or get_store_in_memory()
        super().__init__(user_id=user_id, store=store, entity_type="epics")

    async def create(self, epic: Epic) -> Epic:
        try:
            epic.id = str(uuid4())
            epic.created_at = datetime.now()
            epic.updated_at = datetime.now()
            created = await self._set(key=epic.id, value=epic)
            if created:
                return epic
            else:
                raise Exception("Failed to create epic")
        except Exception as e:
            logger.error(f"Error creating epic: {e}")
            raise e

    async def get(self, epic_id: str) -> Optional[Epic]:
        item = await self._get(epic_id)
        if item is None:
            return None
        return Epic.model_validate(item.value)

    async def update(self, epic_id: str, data: dict) -> Epic:
        """Update an existing epic with new data."""
        existing = await self._get(epic_id)
        if not existing:
            raise ValueError(f"Epic {epic_id} not found")

        current_epic = Epic.model_validate(existing.value)
        updated_data = current_epic.model_dump(exclude_none=True)

        allowed_fields = {"name", "description", "status"}
        for key, value in data.items():
            if key in allowed_fields:
                updated_data[key] = value

        updated_data["updated_at"] = datetime.now()

        updated_epic = Epic.model_validate(updated_data)
        await self._set(key=epic_id, value=updated_epic)
        return updated_epic

    async def search(self, search_filter: SearchFilter) -> list[Epic]:
        items: list[SearchItem] = await self._search(search_filter)
        return [Epic.model_validate(item.value) for item in items]

    async def delete(self, epic_id: str) -> bool:
        existing = await self._get(epic_id)
        if not existing:
            return False
        await self._delete(epic_id)
        return True
