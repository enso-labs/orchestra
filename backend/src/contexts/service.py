from typing import Optional
from langgraph.pregel.main import BaseCheckpointSaver
from src.services.checkpoint import CheckpointService
from src.services.thread import ThreadService
from src.services.assistant import AssistantService
from src.services.prompt import PromptService
from langgraph.store.base import BaseStore
from src.schemas.models.assistant import Assistant

class ServiceContext:
	
	def __init__(self, user_id: str, store: BaseStore, checkpointer: Optional[BaseCheckpointSaver] = None):
		self.user_id = user_id
		self.store = store
		self.checkpointer = checkpointer
  
		self.thread_service = ThreadService(user_id=user_id, store=store)
		self.assistant_service = AssistantService(user_id=user_id, store=store)
		self.prompt_service = PromptService(user_id=user_id, store=store)
  
		if checkpointer:
			self.checkpoint_service = CheckpointService(user_id=user_id, checkpointer=checkpointer)
  