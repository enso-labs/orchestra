
from langgraph.store.base import BaseStore
from langchain_core.runnables import RunnableConfig

from src.schemas.entities import LLMRequest
from src.schemas.models import ProtectedUser
from src.contexts.service import ServiceContext
from src.flows import construct_agent
from src.services.db import get_checkpoint_db
from src.utils.stream import stream_generator
from src.flows import Orchestra


class LLMController:
	def __init__(self, user: ProtectedUser, store: BaseStore, config: RunnableConfig):
		self.user = user
		self.store = store
		self.service_context = ServiceContext(user_id=self.user.id, store=self.store, config=config)
	
	async def llm_invoke(self, params: LLMRequest):
		params = await self.service_context.llm_service.assistant(params)
		async with get_checkpoint_db() as checkpointer:
			agent: Orchestra = await construct_agent(
				params, 
				checkpointer, 
				service_context=self.service_context,
			)
			response = await agent.invoke(params.input)
			return response
			
	async def llm_stream(self, params: LLMRequest):
		assistant = await self.service_context.llm_service.assistant(params)
		return stream_generator(
			input=assistant.input,
			model=assistant.model,
			system_prompt=assistant.system,
			tools=assistant.tools,
			subagents=assistant.subagents,
			config=self.service_context.config,
			service_context=self.service_context,
			instructions=assistant.instructions,
		)