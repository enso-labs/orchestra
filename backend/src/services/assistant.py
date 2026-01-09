import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any, Optional
from langgraph.store.memory import InMemoryStore
from langgraph.store.base import BaseStore
from langgraph.store.base import SearchItem

from src.schemas.entities.llm import *
from src.utils.logger import logger
from src.constants.examples import Examples
from src.services.db import get_store_in_memory
from src.schemas.entities.llm import Assistant

STORE_KEY = "assistants"


class AssistantService:
    def __init__(self, user_id: str = None, store: BaseStore = get_store_in_memory()):
        self.user_id = user_id
        self.store: BaseStore = store

    def _get_store_key(self):
        return STORE_KEY

    def _get_namespace(self, public: bool = False):
        """Get namespace tuple for store operations."""
        if public:
            return ("public", self._get_store_key())
        return (self.user_id, self._get_store_key())

    @staticmethod
    def _is_valid_uuid(value: str) -> bool:
        """Validate string is a proper UUID to prevent injection."""
        try:
            uuid.UUID(value, version=4)
            return True
        except (ValueError, AttributeError, TypeError):
            return False

    async def update(self, assistant_id: str, data: dict):
        """Update assistant and sync to public namespace if public."""
        try:
            await self.store.aput(
                namespace=self._get_namespace(), key=assistant_id, value=data
            )

            # Sync to public namespace if assistant is public
            if data.get("public", False):
                await self.store.aput(
                    namespace=self._get_namespace(public=True),
                    key=assistant_id,
                    value=data,
                )
            return True
        except Exception as e:
            logger.exception(
                f"Error updating {self._get_store_key()} {assistant_id}: {e}"
            )
            return False

    async def get(self, key: str) -> Any:
        assistant_raw = await self.store.aget(self._get_namespace(), key)
        if assistant_raw:
            return self._format_assistant([assistant_raw])[0]
        return None

    async def get_public(self, assistant_id: str) -> Optional[Assistant]:
        """Retrieve a public assistant by ID from the public namespace."""
        if not self._is_valid_uuid(assistant_id):
            return None

        try:
            assistant_raw = await self.store.aget(
                self._get_namespace(public=True), assistant_id
            )
            if assistant_raw:
                return self._format_assistant([assistant_raw])[0]
            return None
        except Exception as e:
            logger.exception(f"Error getting public assistant {assistant_id}: {e}")
            return None

    async def publish(self, assistant_id: str) -> bool:
        """Copy assistant to public namespace and mark as public."""
        try:
            # Get from user's namespace
            assistant = await self.get(assistant_id)
            if not assistant:
                logger.warning(
                    f"Publish failed: assistant {assistant_id} not found for user {self.user_id}"
                )
                return False

            # Already public check (idempotent)
            if assistant.public:
                return True

            # Update assistant data
            assistant_data = assistant.model_dump()
            assistant_data["public"] = True
            assistant_data["owner_id"] = self.user_id
            assistant_data["published_at"] = datetime.now(timezone.utc).isoformat()

            # Save to user namespace (update public flag)
            await self.store.aput(
                namespace=self._get_namespace(),
                key=assistant_id,
                value=assistant_data,
            )

            # Save to public namespace
            await self.store.aput(
                namespace=self._get_namespace(public=True),
                key=assistant_id,
                value=assistant_data,
            )

            logger.info(f"Published assistant {assistant_id} by user {self.user_id}")
            return True
        except Exception as e:
            logger.exception(f"Error publishing assistant {assistant_id}: {e}")
            return False

    async def unpublish(self, assistant_id: str) -> bool:
        """Remove assistant from public namespace and mark as private."""
        try:
            # Get from user's namespace
            assistant = await self.get(assistant_id)
            if not assistant:
                logger.warning(
                    f"Unpublish failed: assistant {assistant_id} not found for user {self.user_id}"
                )
                return False

            # Already private (idempotent)
            if not assistant.public:
                return True

            # Update assistant data
            assistant_data = assistant.model_dump()
            assistant_data["public"] = False
            assistant_data["published_at"] = None

            # Save to user namespace (update public flag)
            await self.store.aput(
                namespace=self._get_namespace(),
                key=assistant_id,
                value=assistant_data,
            )

            # Remove from public namespace
            await self.store.adelete(self._get_namespace(public=True), assistant_id)

            logger.info(f"Unpublished assistant {assistant_id} by user {self.user_id}")
            return True
        except Exception as e:
            logger.exception(f"Error unpublishing assistant {assistant_id}: {e}")
            return False

    async def search_public(self, limit: int = 100, offset: int = 0) -> list[Assistant]:
        """Search all public assistants."""
        try:
            if isinstance(self.store, InMemoryStore):
                items = await self.store.asearch(
                    self._get_namespace(public=True), limit=limit + offset
                )
                sorted_items = sorted(
                    [item for item in items],
                    key=lambda x: x.updated_at,
                    reverse=True,
                )
                return self._format_assistant(sorted_items[offset : offset + limit])
            else:
                async with self.store as store:
                    items = await store.asearch(
                        self._get_namespace(public=True), limit=limit + offset
                    )
                    sorted_items = sorted(
                        [item for item in items],
                        key=lambda x: x.updated_at,
                        reverse=True,
                    )
                    return self._format_assistant(sorted_items[offset : offset + limit])
        except Exception as e:
            logger.error(f"Error searching public assistants: {e}")
            return []

    async def delete(self, key: str) -> bool:
        try:
            # Also delete from public namespace if it exists there
            assistant = await self.get(key)
            if assistant and assistant.public:
                await self.store.adelete(self._get_namespace(public=True), key)

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
