from langgraph.store.base import BaseStore, SearchItem

from src.services.db import get_store_in_memory
from src.schemas.entities import SearchFilter
from src.constants import THREAD_SNAPSHOT_MESSAGE_COUNT
from src.repos.base_repo import BaseRepo
from src.schemas.entities.store import Thread
from src.utils.format import format_content
from src.utils.logger import logger
from src.utils.messages import from_message_to_dict
from src.utils.retry import retry_db_operation


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

    def _format(self, item: SearchItem) -> Thread:
        title = item.value.get("title")
        if not title:
            messages = item.value.get("messages", [])
            for msg in reversed(messages):
                if isinstance(msg, dict) and msg.get("type") in ("human", "user"):
                    title = format_content(msg.get("content", ""))[:100]
                    break
        return Thread(
            id=item.key,
            title=title,
            messages=item.value.get("messages", []),
            files=item.value.get("files", []),
            todos=item.value.get("todos", []),
            assistant_id=item.value.get("assistant_id"),
            project_id=item.value.get("project_id"),
            head_checkpoint_id=item.value.get("head_checkpoint_id") or item.value.get("checkpoint_id"),
            checkpoint_count=item.value.get("checkpoint_count"),
            score=getattr(item, "score", None),
            updated_at=getattr(item, "updated_at", None),
        )

    @retry_db_operation(tries=3, delay=1, backoff=2, exceptions=(Exception,))
    async def search(
        self,
        search_filter: SearchFilter,
    ) -> list[dict]:
        try:
            if search_filter.query:
                queried_threads: list[SearchItem] = await self.store.asearch(
                    self._get_namespace(),
                    limit=search_filter.limit,
                    filter=search_filter.filter,
                    query=search_filter.query,
                )
                return [self._format(thread) for thread in queried_threads]
            threads = await self.store.asearch(
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
            logger.error(f"Error searching threads: {e}")
            return []

    async def update(self, thread_id: str, data: dict):
        # Extract last human message for storage
        messages = data.get("messages", [])
        messages = from_message_to_dict(messages, include_tool_calls=False)
        recent_messages = (
            messages[-THREAD_SNAPSHOT_MESSAGE_COUNT:] if len(messages) > THREAD_SNAPSHOT_MESSAGE_COUNT else messages
        )

        data["messages"] = recent_messages

        await self.store.aput(namespace=self._get_namespace(), key=thread_id, value=data)

        return True

    async def get(self, thread_id: str) -> dict:
        item = await self._get(thread_id)
        if not item:
            return None
        return self._format(item)

    async def delete(self, thread_id: str) -> bool:
        try:
            await self._delete(thread_id)
            logger.info(f"Thread {thread_id} deleted successfully")
            return True
        except Exception as e:
            logger.error(f"Error deleting thread: {e}")
            return False

    # async def _upsert_snapshot(self, thread_id: str, messages: list) -> bool:
    #     """Create or update a thread snapshot with recent messages.

    #     Note: messages should already be filtered to recent messages before calling this method.
    #     """
    #     try:
    #         # Extract recent messages for snapshot (last N messages)
    #         recent_messages = (
    #             messages[-THREAD_SNAPSHOT_MESSAGE_COUNT:]
    #             if len(messages) > THREAD_SNAPSHOT_MESSAGE_COUNT
    #             else messages
    #         )

    #         # Format messages as "Role: content" pairs
    #         page_content = format_xml_thread(recent_messages, include_tool_calls=False)

    #         # Create snapshot with metadata
    #         snapshot = ThreadSnapshot(
    #             thread_id=thread_id,
    #             page_content=page_content,
    #             metadata={
    #                 "thread_id": thread_id,
    #                 "message_count": len(messages),
    #             },
    #         )

    #         await self._set(thread_id, snapshot)
    #         return True

    #     except Exception as e:
    #         logger.error(f"Failed to upsert thread snapshot for {thread_id}: {e}")
    #         return False
