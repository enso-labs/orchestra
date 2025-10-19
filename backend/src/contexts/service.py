from src.services.thread import ThreadService
from src.services.assistant import AssistantService
from src.services.prompt import PromptService
from langgraph.store.base import BaseStore
from src.schemas.models.assistant import Assistant

class ServiceContext:
	
	def __init__(self, user_id: str, store: BaseStore):
		self.user_id = user_id
		self.store = store
		self.thread_service = ThreadService(user_id=user_id, store=store)
		self.assistant_service = AssistantService(user_id=user_id, store=store)
		self.prompt_service = PromptService(user_id=user_id, store=store)