from typing import Optional
from langgraph.pregel.main import BaseCheckpointSaver
from src.services.checkpoint import CheckpointService
from src.services.thread import ThreadService
from src.services.assistant import AssistantService
from src.services.prompt import PromptService
from langgraph.store.base import BaseStore
from src.utils.logger import logger
from langgraph.store.memory import InMemoryStore
from src.services.memory import MemoryService

IN_MEMORY_STORE = InMemoryStore()

class ServiceContext:
	def __init__(
		self, 
		user_id: str = None, 
		store: BaseStore = None, 
		checkpointer: Optional[BaseCheckpointSaver] = None,
	):
		self.user_id = user_id
		self.store = store or IN_MEMORY_STORE
		self.checkpointer = checkpointer
		self.memory_service = MemoryService(user_id=user_id, store=store)
		self.thread_service = ThreadService(user_id=user_id, store=store)
		self.prompt_service = PromptService(user_id=user_id, store=store)
		self.assistant_service = AssistantService(user_id=user_id, store=store)
  
  
		if checkpointer:
			self.checkpoint_service = CheckpointService(user_id=user_id, checkpointer=checkpointer)
  
	async def delete_thread(self, thread_id: str):
		try:
			deleted_checkpoints = await self.checkpoint_service.delete_checkpoints_for_thread(thread_id)
			if not deleted_checkpoints:
				raise ValueError(f"Failed to delete checkpoints for thread {thread_id}")
			deleted_thread = await self.thread_service.delete(thread_id)
			if not deleted_thread:
				raise ValueError(f"Failed to delete thread {thread_id}")
			return True
		except Exception as e:
			logger.error(e)
			return e