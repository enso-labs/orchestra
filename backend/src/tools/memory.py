import uuid
from typing import List, TypedDict
from langchain_core.tools import tool
from langchain_core.documents import Document
from langchain_core.runnables import RunnableConfig
from src.services.db import get_store_db
from src.utils.tools import get_user_id


class Memory(TypedDict):
	memory: str
	ttl: int = 10_080 # 1 week

@tool
async def save_recall_memory(
    memory: str, 
    ttl: int = 1440, 
    config: RunnableConfig = None
) -> str:
	"""Save memory to vectorstore for later semantic retrieval."""
	memory_id = str(uuid.uuid4())
	async with get_store_db() as store:
		await store.aput(("memories", get_user_id(config)), memory_id, {"memory": memory}, ttl=ttl)
	return f"Memory ID {memory_id} saved."

@tool
async def delete_recall_memory(memory_id: str, config: RunnableConfig) -> str:
	"""Delete a specific memory for the current thread."""
	
	async with get_store_db() as store:
		await store.adelete(("memories", get_user_id(config)), memory_id)
	return f"Memory ID {memory_id} deleted."

## TODO: Not sure if this works correctly, does not appear that way.
@tool
async def search_recall_memories(query: str, config: RunnableConfig) -> List[str]:
	"""Search for relevant memories."""
	user_id = get_user_id(config)

	def _filter_function(doc: Document) -> bool:
		return doc.metadata.get("user_id") == user_id

	async with get_store_db() as store:
		documents = await store.asearch(("memories", get_user_id(config)), query, limit=3, filter=_filter_function)
		return [str(document.dict()) for document in documents]