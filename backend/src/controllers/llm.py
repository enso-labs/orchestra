import ujson

from langgraph.store.base import BaseStore
from langchain_core.runnables import RunnableConfig

from src.schemas.contexts import ContextSchema
from src.schemas.entities.schedule import ScheduleCreate
from src.schemas.entities import LLMRequest
from src.schemas.models import ProtectedUser
from src.contexts.service import ServiceContext
from src.flows import construct_agent, init_config
from src.services.db import get_checkpoint_db
from src.utils.stream import stream_generator
from src.flows import Orchestra
from src.utils.logger import logger
from src.utils.format import get_time

class LLMController:
	def __init__(self, user: ProtectedUser, store: BaseStore, config: RunnableConfig):
		self.user = user
		self.store = store
		self.service_context = ServiceContext(user_id=self.user.id, store=self.store, config=config)
	
	async def _update_store(self, agent: Orchestra, config: RunnableConfig) -> None:
		final_state = await agent.graph.aget_state(config)
		configurable = {
			**final_state.config.get("configurable", {}),
			**config["configurable"],
		}
		messages = final_state.values.get("messages", [])
		self.service_context.store.fields = ["messages", "files"]
		await self.service_context.thread_service.update(
			thread_id=configurable.get("thread_id"),
			data={
				"thread_id": configurable.get("thread_id"),
				"checkpoint_id": configurable.get("checkpoint_id"),
				"assistant_id": configurable.get("assistant_id"),
				"project_id": configurable.get("project_id"),
				"messages": messages,
				"updated_at": get_time(),
			},
		)
		logger.info(f"checkpoint: {ujson.dumps(configurable)}")
  
  
	async def llm_invoke(self, params: LLMRequest):
		try:
			config = init_config(params, self.user.id)
			params = await self.service_context.llm_service.assistant(params)
			async with get_checkpoint_db() as checkpointer:
				agent: Orchestra = await construct_agent(
					params, 
					checkpointer, 
					service_context=self.service_context,
				)
				response = await agent.invoke(
        			params.input, 
           			config=config, 
              		context=ContextSchema(model=params.model, user_id=self.user.id)
                )
				return response
		except Exception as e:
			logger.exception(f"Error in llm_invoke: {e}")
			await self._update_store(agent, config)
			raise e
		finally:
			if self.service_context.user_id and self.service_context.checkpointer:
				await self._update_store(agent, config)

	async def llm_stream(self, params: LLMRequest):
		assistant = await self.service_context.llm_service.assistant(params)
		return stream_generator(
			input=assistant.input,
			model=assistant.model,
			system_prompt=assistant.system_prompt,
			tools=assistant.tools,
			subagents=assistant.subagents,
			config=self.service_context.config,
			service_context=self.service_context,
			instructions=assistant.instructions,
		)
  
	async def llm_task(self, job: ScheduleCreate):
		schedule = self.service_context.schedule_service.create_job(job)
		return schedule