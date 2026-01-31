from uuid import uuid4
from datetime import datetime
from typing import Optional

from langgraph.store.base import BaseStore, SearchItem

from src.repos.base_repo import BaseRepo
from src.services.db import get_store_in_memory
from src.schemas.entities.memory import Memory
from src.schemas.entities import SearchFilter


class MemoryRepo(BaseRepo):
    def __init__(self, user_id: str, store: Optional[BaseStore] = None):
        store = store or get_store_in_memory()
        super().__init__(user_id=user_id, store=store, entity_type="memories")

    async def create(self, content: str, metadata: Optional[dict] = None) -> Memory:
        memory_id = f"memory_{uuid4()}"
        now = datetime.now()
        memory = Memory(
            id=memory_id,
            content=content,
            metadata=metadata or {},
            created_at=now,
            updated_at=now,
        )
        await self._set(key=memory_id, value=memory)
        return memory

    async def get(self, memory_id: str) -> Optional[Memory]:
        item = await self._get(memory_id)
        if item is None:
            return None
        return Memory.model_validate(item.value)

    async def update(
        self, memory_id: str, content: str, metadata: Optional[dict] = None
    ) -> Optional[Memory]:
        existing = await self.get(memory_id)
        if existing is None:
            return None
        now = datetime.now()
        updated = Memory(
            id=memory_id,
            content=content,
            metadata=metadata if metadata is not None else existing.metadata,
            created_at=existing.created_at,
            updated_at=now,
        )
        await self._set(key=memory_id, value=updated)
        return updated

    async def delete(self, memory_id: str) -> bool:
        existing = await self.get(memory_id)
        if existing is None:
            return False
        await self._delete(memory_id)
        return True

    async def list(
        self, limit: int = 10, offset: int = 0, query: str = ""
    ) -> tuple[list[Memory], int]:
        search_filter = SearchFilter(
            query=query,
            limit=limit,
            offset=offset,
        )
        items: list[SearchItem] = await self._search(search_filter)
        memories = [Memory.model_validate(item.value) for item in items]
        # Sort by updated_at descending
        memories.sort(key=lambda m: m.updated_at or datetime.min, reverse=True)
        # Get total count with a large limit search
        total_filter = SearchFilter(query=query, limit=1000, offset=0)
        total_items = await self._search(total_filter)
        total = len(total_items)
        return memories, total
