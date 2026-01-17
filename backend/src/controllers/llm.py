from typing import Awaitable, Callable, Optional, Union

from langgraph.store.base import BaseStore
from langchain_core.runnables import RunnableConfig

from src.schemas.entities.schedule import ScheduleCreate
from src.schemas.entities import LLMRequest
from src.contexts.service import ServiceContext
from src.flows import init_config
from src.services.db import get_checkpoint_db
from src.services.streaming import StreamingService
from src.utils.stream import stream_generator
from src.flows import Orchestra
from src.utils.logger import logger


class LLMController:
    def __init__(self, user_id: str | None, store: BaseStore, config: RunnableConfig):
        self.user_id = user_id
        self.store = store
        self.config = config
        self.service_context = ServiceContext(
            user_id=self.user_id, store=self.store, config=config
        )
        self.streaming_service = StreamingService(
            user_id=self.user_id,
            store=self.store,
            config=config,
            service_context=self.service_context,
        )

    async def llm_invoke(self, params: LLMRequest):
        agent: Orchestra = None
        config = None
        try:
            config = init_config(params, user_id=self.user_id)
            params = await self.service_context.llm_service.assistant(params)
            async with get_checkpoint_db() as checkpointer:
                runtime = self.streaming_service.init_runtime(
                    model=params.model,
                    files=params.input.files or {},
                )
                backend = self.streaming_service.init_backend(runtime)
                agent = await self.streaming_service.construct_agent(
                    instructions=params.instructions,
                    system_prompt=params.system_prompt,
                    model=params.model,
                    tools=params.tools,
                    subagents=params.subagents,
                    checkpointer=checkpointer,
                    backend=backend,
                )
                response = await agent.invoke(
                    params.input,
                    config=config,
                    context=self.streaming_service.init_context(params.model),
                )
                return response
        except Exception as e:
            logger.exception(f"Error in llm_invoke: {e}")
            if agent and config:
                await self.streaming_service.update_store(agent, config)
            raise e
        finally:
            if self.service_context.user_id and self.service_context.checkpointer:
                if agent and config:
                    await self.streaming_service.update_store(agent, config)

    async def llm_stream(
        self,
        params: LLMRequest,
        is_disconnected: Optional[
            Union[Callable[[], bool], Callable[[], Awaitable[bool]]]
        ] = None,
    ):
        """
        Stream LLM responses as SSE events.

        Args:
            params: The LLM request parameters.
            is_disconnected: Optional callable that returns True if client disconnected.
                            Supports both sync and async callables.
        """
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
            is_disconnected=is_disconnected,
        )

    async def llm_task(self, job: ScheduleCreate):
        schedule = self.service_context.schedule_service.create_job(job)
        return schedule
