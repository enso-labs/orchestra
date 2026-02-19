from langchain_core.tools import tool
from langgraph.prebuilt import ToolRuntime

from src.schemas.entities import SearchFilter, Thread
from src.services.thread import ThreadService
from src.utils.logger import logger


@tool
async def search_threads(query: str, runtime: ToolRuntime, limit: int = 5) -> list[dict]:
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
    user_id = runtime.config["metadata"].get("user_id", None)
    if not user_id:
        raise ValueError("User ID is required to search threads.")

    try:
        service = ThreadService(user_id=user_id, store=runtime.store)

        search_filter = SearchFilter(query=query, limit=limit)
        results: list[Thread] = await service.search(search_filter)

        payload = [r.model_dump() for r in results]
        for item in payload:
            item.pop("files", None)

        return payload
    except Exception as e:
        logger.error(f"Error searching threads: {e}")
        return []


THREAD_SEARCH_TOOLS = [search_threads]
