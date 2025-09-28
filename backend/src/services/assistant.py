from typing import Any
from langgraph.store.memory import InMemoryStore
from langgraph.store.base import BaseStore
from src.utils.logger import logger
from src.schemas.models.assistant import *
from langgraph.store.base import SearchItem
from src.constants.examples import Examples

IN_MEMORY_STORE = InMemoryStore()
STORE_KEY = "assistants"


class AssistantService:
    def __init__(self, user_id: str = None, store: BaseStore = IN_MEMORY_STORE):
        self.user_id = user_id
        self.store: BaseStore = store

    async def update(self, assistant_id: str, data: dict):
        try:
            await self.store.aput(
                namespace=(STORE_KEY, self.user_id), key=assistant_id, value=data
            )
            return True
        except Exception as e:
            logger.exception(f"Error updating {STORE_KEY} {assistant_id}: {e}")
            return False

        return True

    async def get(self, key: str) -> Any:
        return await self.store.aget((STORE_KEY, self.user_id), key)

    async def delete(self, key: str) -> bool:
        try:
            await self.store.adelete((STORE_KEY, self.user_id), key)
            return True
        except Exception as e:
            logger.exception(f"Error deleting {STORE_KEY} {key}: {e}")
            return False

    ###########################################################################
    ## Search
    ###########################################################################
    async def _in_memory_search(self, limit: int = 1000) -> list[dict]:
        items = await self.store.asearch((STORE_KEY, self.user_id), limit=limit)
        return sorted(
            [item for item in items],
            key=lambda x: x.updated_at,
            reverse=True,
        )

    async def _postgres_search(self, limit: int = 1000) -> list[dict]:
        async with self.store as store:
            items = await store.asearch((STORE_KEY, self.user_id), limit=limit)
            return sorted(
                [item for item in items],
                key=lambda x: x.updated_at,
                reverse=True,
            )

    def _format_assistant(self, items: list[SearchItem]) -> list[Assistant]:
        assistants = []
        for item in items:
            assistant = Assistant(**item.dict()["value"])
            assistant.id = item.key
            assistant.updated_at = item.updated_at
            assistant.created_at = item.created_at
            assistants.append(assistant.model_dump())
        return assistants

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
            logger.error(f"Error searching {STORE_KEY}: {e}")
            return []


assistant_service = AssistantService()

ASSISTANT_EXAMPLES = {"currency_agent": Examples.ASSISTANT_EXAMPLES["currency_agent"]}
