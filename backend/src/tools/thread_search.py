from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig

from src.schemas.entities import SearchFilter
from src.services.thread import ThreadService
from src.utils.logger import logger

thread_service = ThreadService()


def _extract_excerpt(thread) -> str:
    """Extract a short excerpt from the last message in a thread."""
    if not thread.messages:
        return ""
    last_msg = thread.messages[-1]
    if isinstance(last_msg, dict):
        content = last_msg.get("content", "")
    else:
        content = getattr(last_msg, "content", "")
    return content[:200] if content else ""


@tool
async def search_threads(query: str, config: RunnableConfig, limit: int = 5) -> list[dict]:
    """
    Toolkit: Thread Search
    Description: Search past conversation threads by semantic similarity. Use this to find relevant
    previous conversations based on a natural language query.
    Args:
        query: The search query to find relevant threads.
        limit: Maximum number of results to return (default 5).
        config: The runnable config for user context.
    Returns:
        A list of matching threads with thread_id, title, excerpt, and score.
    """
    user_id = config["configurable"].get("user_id")
    if not user_id:
        raise ValueError("User ID is required to search threads.")

    try:
        thread_service.user_id = user_id
        thread_service.thread_repo.user_id = user_id

        search_filter = SearchFilter(query=query, limit=limit)
        results = await thread_service.search(search_filter)

        formatted = []
        for thread in results:
            # Results are Thread pydantic models when query is provided
            if hasattr(thread, "id"):
                formatted.append(
                    {
                        "thread_id": thread.id,
                        "title": thread.title or "Untitled Thread",
                        "excerpt": _extract_excerpt(thread),
                        "score": thread.score or 0.0,
                    }
                )
            elif isinstance(thread, dict):
                formatted.append(
                    {
                        "thread_id": thread.get("key", thread.get("thread_id", "")),
                        "title": thread.get("value", {}).get("title", "Untitled Thread")
                        if isinstance(thread.get("value"), dict)
                        else "Untitled Thread",
                        "excerpt": "",
                        "score": thread.get("score", 0.0),
                    }
                )

        return formatted
    except Exception as e:
        logger.error(f"Error searching threads: {e}")
        return []


THREAD_SEARCH_TOOLS = [search_threads]
