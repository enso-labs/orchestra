import asyncio
from typing import Any
from langgraph.store.memory import InMemoryStore
from langgraph.store.base import BaseStore
from langgraph.store.base import SearchItem

from src.schemas.entities.llm import *
from src.utils.logger import logger
from src.constants.examples import Examples
from src.services.db import get_store_in_memory


class AssistantService:
    def __init__(self, user_id: str = None, store: BaseStore = get_store_in_memory()):
        self.user_id = user_id
        self.store: BaseStore = store

    def _get_store_key(self):
        return "assistants"

    def _get_namespace(self):
        return (self.user_id, self._get_store_key())

    async def update(self, assistant_id: str, data: dict):
        try:
            await self.store.aput(
                namespace=self._get_namespace(), key=assistant_id, value=data
            )
            return True
        except Exception as e:
            logger.exception(
                f"Error updating {self._get_store_key()} {assistant_id}: {e}"
            )
            return False

        return True

    async def get(self, key: str) -> Any:
        assistant_raw = await self.store.aget(self._get_namespace(), key)
        if assistant_raw:
            return self._format_assistant([assistant_raw])[0]
        return None

    async def delete(self, key: str) -> bool:
        try:
            await self.store.adelete(self._get_namespace(), key)
            return True
        except Exception as e:
            logger.exception(f"Error deleting {self._get_store_key()} {key}: {e}")
            return False

    async def search(
        self,
        limit: int = 1000,
    ) -> list[dict]:
        try:
            assistants = []
            if isinstance(self.store, InMemoryStore):
                assistants = await self._in_memory_search(limit)
            else:
                assistants = await self._postgres_search(limit)
            return self._format_assistant(assistants)
        except Exception as e:
            logger.error(f"Error searching {self._get_store_key()}: {e}")
            return []

    ###########################################################################
    ## Search
    ###########################################################################
    async def _in_memory_search(self, limit: int = 1000) -> list[dict]:
        items = await self.store.asearch(self._get_namespace(), limit=limit)
        return sorted(
            [item for item in items],
            key=lambda x: x.updated_at,
            reverse=True,
        )

    async def _postgres_search(self, limit: int = 1000) -> list[dict]:
        max_retries = 3
        retry_delay = 1  # seconds

        for attempt in range(max_retries):
            try:
                async with self.store as store:
                    items = await store.asearch(self._get_namespace(), limit=limit)
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

    def _format_assistant(self, items: list[SearchItem]) -> list[Assistant]:
        assistants = []
        for item in items:
            assistant = Assistant(**item.dict()["value"])
            assistant.id = item.key
            assistant.updated_at = item.updated_at
            assistant.created_at = item.created_at
            assistants.append(assistant)
        return assistants


assistant_service = AssistantService()

ASSISTANT_EXAMPLES = {"currency_agent": Examples.ASSISTANT_EXAMPLES["currency_agent"]}
