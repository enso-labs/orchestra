import asyncio
from langgraph.store.base import BaseStore, SearchItem
from langgraph.store.memory import InMemoryStore
from langgraph.store.postgres.aio import AsyncPostgresStore

from src.services.db import get_store_in_memory
from src.schemas.entities import SearchFilter
from src.constants import THREAD_SNAPSHOT_MESSAGE_COUNT
from src.repos.base_repo import BaseRepo
from src.schemas.entities.store import ThreadSnapshot
from src.utils.logger import logger
from src.utils.format import format_xml_thread
from src.utils.messages import from_message_to_dict


FIELDS = ["messages"]

class ThreadRepo(BaseRepo):
    def __init__(self, user_id: str, store: BaseStore = get_store_in_memory(fields=FIELDS)):
        ## Add fields to the store (if supported)
        self.user_id = user_id
        self.store: BaseStore = store
        
        try:
            self.store.fields = FIELDS
        except AttributeError:
            pass
        super().__init__(user_id=user_id, store=store, entity_type="threads")
        

    async def search(
        self,
        search_filter: SearchFilter,
    ) -> list[dict]:
        try:
            max_retries = 3
            retry_delay = 1  # seconds

            for attempt in range(max_retries):
                try:
                    async with self.store as store:
                        if search_filter.query:
                            queried_threads: list[SearchItem] = await store.asearch(
                                self._get_namespace(), 
                                limit=search_filter.limit, 
                                filter=search_filter.filter,
                                query=search_filter.query,
                            )
                            return [
                                ThreadSnapshot(
                                    id=thread.key, 
                                    messages=thread.value.get("messages", []), 
                                    files=thread.value.get("files", []), 
                                    score=thread.score, 
                                    updated_at=thread.updated_at
                                ).model_dump(exclude_none=True) for thread in queried_threads
                            ]
                        threads = await store.asearch(
                            self._get_namespace(), 
                            limit=search_filter.limit, 
                            filter=search_filter.filter,
                        )
                        return sorted(
                            [thread.dict() for thread in threads],
                            key=lambda x: x.get("updated_at"),
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
        except Exception as e:
            logger.error(f"Error searching threads: {e}")
            return []
        
    async def update(self, thread_id: str, data: dict):

        # Extract last human message for storage
        messages = data.get("messages", [])
        messages = from_message_to_dict(messages, include_tool_calls=False)
        recent_messages = (
            messages[-THREAD_SNAPSHOT_MESSAGE_COUNT:]
            if len(messages) > THREAD_SNAPSHOT_MESSAGE_COUNT
            else messages
        )
        
        data["messages"] = recent_messages
        
        await self.store.aput(
            namespace=self._get_namespace(), key=thread_id, value=data
        )

        return True
        
        
    async def get(self, thread_id: str) -> dict:
        return await self._get(thread_id)
        
    async def delete(self, thread_id: str) -> bool:
        try:
            await self._delete(thread_id)
            logger.info(f"Thread {thread_id} deleted successfully")
            return True
        except Exception as e:
            logger.error(f"Error deleting thread: {e}")
            return False

    async def _upsert_snapshot(self, thread_id: str, messages: list) -> bool:
        """Create or update a thread snapshot with recent messages.
        
        Note: messages should already be filtered to recent messages before calling this method.
        """
        try:
            # Extract recent messages for snapshot (last N messages)
            recent_messages = (
                messages[-THREAD_SNAPSHOT_MESSAGE_COUNT:]
                if len(messages) > THREAD_SNAPSHOT_MESSAGE_COUNT
                else messages
            )
            
            # Format messages as "Role: content" pairs
            page_content = format_xml_thread(recent_messages, include_tool_calls=False)

            # Create snapshot with metadata
            snapshot = ThreadSnapshot(
                thread_id=thread_id,
                page_content=page_content,
                metadata={
                    "thread_id": thread_id,
                    "message_count": len(messages),
                }
            )

            await self._set(thread_id, snapshot)
            return True

        except Exception as e:
            logger.error(f"Failed to upsert thread snapshot for {thread_id}: {e}")
            return False
        