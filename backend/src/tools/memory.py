from uuid import uuid4
from langchain_core.tools import tool
from langgraph.store.base import SearchItem
from langchain_core.runnables import RunnableConfig

from src.services.memory import memory_service


@tool
async def upsert_memory(memory: str, config: RunnableConfig) -> str:
    """
    Toolkit: Memory
    Description: Upsert memory to vectorstore for later semantic retrieval.
    Args:
            memory: The memory to upsert.
            ttl: The time to live for the memory.
            config: The config for the memory.
    Returns:
            The memory ID.
    """
    memory_id = f"memory_{str(uuid4())}"
    user_id = config["configurable"].get("user_id")
    if not user_id:
        raise ValueError("User ID is required to upsert memory.")
    memory_service.user_id = user_id
    await memory_service.set(memory_id, {"memory": memory}, ttl=None)
    return f"Memory ID {memory_id} saved."


@tool
async def delete_memory(memory_id: str, config: RunnableConfig) -> str:
    """
    Toolkit: Memory
    Description: Delete memory from vectorstore.
    Args:
            memory_id: The ID of the memory to delete.
            config: The config for the memory.
    Returns:
            Deleted message.
    """
    user_id = config["configurable"].get("user_id")
    if not user_id:
        raise ValueError("User ID is required to delete memory.")
    memory_service.user_id = user_id
    await memory_service.delete(memory_id)
    return f"Memory ID {memory_id} deleted."


@tool
async def search_memory(
    query: str,
    config: RunnableConfig,
) -> list[dict]:
    """
    Toolkit: Memory
    Description: Search for memories based on a query.
    Args:
            query: The query to search for.
            config: The config for the memory.
    Returns:
            The memories (documents).
    """
    user_id = config["configurable"].get("user_id")
    if not user_id:
        raise ValueError("User ID is required to search memory.")
    memory_service.user_id = user_id
    memories: list[SearchItem] = await memory_service.search(query)
    return [memory.dict() for memory in memories]


@tool
async def update_memory(memory_id: str, memory: str, config: RunnableConfig) -> str:
    """
    Toolkit: Memory
    Description: Update an existing memory in the vectorstore.
    Args:
            memory_id: The ID of the memory to update.
            memory: The new memory content.
            config: The config for the memory.
    Returns:
            Updated memory confirmation.
    """
    user_id = config["configurable"].get("user_id")
    if not user_id:
        raise ValueError("User ID is required to update memory.")
    memory_service.user_id = user_id
    existing = await memory_service.get(memory_id)
    if not existing:
        raise ValueError(f"Memory ID {memory_id} not found.")
    await memory_service.set(memory_id, {"memory": memory}, ttl=None)
    return f"Memory ID {memory_id} updated."


MEMORY_TOOLS = [upsert_memory, delete_memory, search_memory, update_memory]
