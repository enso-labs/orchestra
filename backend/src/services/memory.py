import asyncio
from typing import Any
from langgraph.store.memory import InMemoryStore
from langgraph.store.base import BaseStore, SearchItem
from src.utils.logger import logger
from src.schemas.models.memory import Memory

IN_MEMORY_STORE = InMemoryStore()
STORE_KEY = "memories"


class MemoryService:
    def __init__(
        self, 
        user_id: str = None,
        store: BaseStore = IN_MEMORY_STORE
    ):
        self.user_id = user_id
        self.store: BaseStore = store

    def _get_namespace(self):
        return (self.user_id, STORE_KEY)

    async def update(self, key: str, data: dict, ttl: int | None = None) -> bool:
        try:
            await self.store.aput(
                namespace=self._get_namespace(), 
                key=key, 
                value=data,
                ttl=ttl
            )
            return True
        except Exception as e:
            logger.exception(f"Error updating {STORE_KEY} {key}: {e}")
            return False

    async def get(self, key: str) -> Any:
        memory_raw = await self.store.aget(self._get_namespace(), key)
        if memory_raw:
            return self._format_memory([memory_raw])[0]
        return None

    async def delete(self, key: str) -> bool:
        try:
            await self.store.adelete(self._get_namespace(), key)
            return True
        except Exception as e:
            logger.exception(f"Error deleting {STORE_KEY} {key}: {e}")
            return False

    async def search(
        self,
        query: str = None,
        limit: int = 1000,
    ) -> list[Memory]:
        try:
            memories = []
            if isinstance(self.store, InMemoryStore):
                memories = await self._in_memory_search(query, limit)
            else:
                memories = await self._postgres_search(query, limit)
            return self._format_memory(memories)
        except Exception as e:
            logger.error(f"Error searching {STORE_KEY}: {e}")
            return []

    ###########################################################################
    ## Search
    ###########################################################################
    async def _in_memory_search(self, query: str = None, limit: int = 1000) -> list[SearchItem]:
        items = await self.store.asearch(self._get_namespace(), query=query, limit=limit)
        return sorted(
            [item for item in items],
            key=lambda x: x.updated_at,
            reverse=True,
        )

    async def _postgres_search(self, query: str = None, limit: int = 1000) -> list[SearchItem]:
        max_retries = 3
        retry_delay = 1  # seconds

        for attempt in range(max_retries):
            try:
                async with self.store as store:
                    items = await store.asearch(self._get_namespace(), query=query, limit=limit)
                    return sorted(
                        [item for item in items],
                        key=lambda x: x.updated_at,
                        reverse=True,
                    )
            except Exception as e:
                error_msg = str(e).lower()
                if "connection" in error_msg and "closed" in error_msg:
                    logger.warning(
                        f"Store connection closed on attempt {attempt + 1}/{max_retries}: {e}"
                    )
                    if attempt < max_retries - 1:
                        await asyncio.sleep(
                            retry_delay * (2**attempt)
                        )  # Exponential backoff
                        continue
                raise e

    def _format_memory(self, items: list[SearchItem]) -> list[Memory]:
        memories = []
        for item in items:
            memory_data = item.dict()["value"]
            memory = Memory(
                key=item.key,
                value=memory_data.get("value") if isinstance(memory_data, dict) else memory_data,
                ttl=memory_data.get("ttl") if isinstance(memory_data, dict) else None,
                metadata=memory_data.get("metadata", {}) if isinstance(memory_data, dict) else {},
            )
            memory.id = item.key
            memory.updated_at = item.updated_at
            memory.created_at = item.created_at
            memories.append(memory)
        return memories


memory_service = MemoryService()
