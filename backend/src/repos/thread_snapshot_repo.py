from typing import Any
from langgraph.store.base import SearchItem

from src.constants import THREAD_SNAPSHOT_MESSAGE_COUNT
from src.repos.base_repo import BaseRepo
from src.schemas.entities.store import ThreadSnapshot
from src.utils.logger import logger


class ThreadSnapshotRepo(BaseRepo):
    def __init__(self, user_id: str, store=None):
        super().__init__(user_id, store, "thread_snapshots")

    async def upsert_snapshot(self, thread_id: str, messages: list) -> bool:
        """Create or update a thread snapshot with recent messages."""
        try:
            # Extract last N messages
            recent_messages = messages[-THREAD_SNAPSHOT_MESSAGE_COUNT:] if len(messages) > THREAD_SNAPSHOT_MESSAGE_COUNT else messages

            # Format messages as "Role: content" pairs
            formatted_messages = []
            for msg in recent_messages:
                role = "User" if msg.get("type") == "human" else "Assistant"
                content = msg.get("content", "")
                formatted_messages.append(f"{role}: {content}")

            page_content = "\n".join(formatted_messages)

            # Create snapshot with metadata
            snapshot = ThreadSnapshot(
                thread_id=thread_id,
                page_content=page_content,
                metadata={
                    "thread_id": thread_id,
                    "message_count": len(recent_messages),
                }
            )

            await self._set(thread_id, snapshot)
            return True

        except Exception as e:
            logger.error(f"Failed to upsert thread snapshot for {thread_id}: {e}")
            return False

    async def search(
        self, query: str, limit: int = 10, assistant_id: str | None = None
    ) -> list[dict[str, Any]]:
        """Search thread snapshots using semantic similarity."""
        try:
            # Build filter
            filter_dict = {}
            if assistant_id:
                filter_dict["metadata.assistant_id"] = assistant_id

            # Use SearchFilter from base_repo
            from src.schemas.entities import SearchFilter
            search_filter = SearchFilter(
                query=query,
                filter=filter_dict,
                limit=min(limit, 50),  # Cap at 50
                offset=0,
            )

            # Perform search
            results = await self._search(search_filter)

            # Format results
            formatted_results = []
            for item in results:
                snapshot_data = item.value
                excerpt = snapshot_data.get("page_content", "")
                if len(excerpt) > 200:
                    excerpt = excerpt[:200] + "..."

                formatted_results.append({
                    "thread_id": snapshot_data.get("metadata", {}).get("thread_id"),
                    "excerpt": excerpt,
                    "score": item.score if hasattr(item, "score") else 0.0,
                    "updated_at": item.updated_at.isoformat() if hasattr(item, "updated_at") and item.updated_at else None,
                })

            return formatted_results

        except Exception as e:
            logger.error(f"Failed to search thread snapshots: {e}")
            return []
