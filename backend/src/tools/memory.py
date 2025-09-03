from uuid import uuid4
from langchain_core.tools import tool
from src.services.memory import memory_service


@tool
async def upsert_memory(memory: str) -> str:
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
    await memory_service.set(memory_id, {"memory": memory}, ttl=None)
    return f"Memory ID {memory_id} saved."


@tool
async def delete_memory(memory_id: str) -> str:
    """
    Toolkit: Memory
    Description: Delete memory from vectorstore.
    Args:
        memory_id: The ID of the memory to delete.
        config: The config for the memory.
    Returns:
        Deleted message.
    """
    await memory_service.delete(memory_id)
    return f"Memory ID {memory_id} deleted."


# TODO: Implement search memory
# @tool
# async def search_memory(
#     query: str,
#     config: RunnableConfig | None = None
# ) -> str:
# 	"""
#     Toolkit: Memory
#     Description: Search for memories based on a query.
# 	Args:
# 		query: The query to search for.
# 		config: The config for the memory.
# 	Returns:
# 		The memories (documents).
# 	"""
# 	return await memory_service.search()

MEMORY_TOOLS = [upsert_memory, delete_memory]
