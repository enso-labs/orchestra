from deepagents.backends import CompositeBackend, StateBackend, StoreBackend
from langchain.tools import ToolRuntime
import ujson

from langgraph.store.base import BaseStore
from langchain_core.runnables import RunnableConfig

from src.schemas.contexts import ContextSchema
from src.schemas.entities.schedule import ScheduleCreate
from src.schemas.entities import LLMRequest
from src.contexts.service import ServiceContext
from src.agents import construct_agent, init_config
from src.services.db import get_checkpoint_db
from src.utils.stream import stream_generator
from src.agents import Orchestra
from src.repos.user_settings_repo import UserSettingsRepo
from src.utils.llm import resolve_api_key
from src.utils.logger import logger
from src.utils.format import get_time


class LLMController:
    def __init__(self, user_id: str | None, store: BaseStore, config: RunnableConfig):
        self.user_id = user_id
        self.store = store
        self.service_context = ServiceContext(
            user_id=self.user_id, store=self.store, config=config
        )

    def _init_context(self, request: LLMRequest) -> ContextSchema:
        return ContextSchema(model=request.model, user_id=self.user_id)

    def _init_runtime(self, request: LLMRequest) -> ToolRuntime:
        return ToolRuntime(
            state={"messages": [], "files": request.input.files or {}},
            context=self._init_context(request),
            tool_call_id="tc_runtime_init",
            store=self.store,
            stream_writer=lambda _: None,
            config=self.service_context.config,
        )

    def init_backend(self, request: LLMRequest) -> CompositeBackend:
        runtime = self._init_runtime(request)
        store_backend = StoreBackend(runtime)
        built_routes = {
            f"/users/{runtime.context.user_id}/memories/": store_backend,
            f"/users/{runtime.context.user_id}/config/": store_backend,
        }
        return CompositeBackend(default=StateBackend(runtime), routes=built_routes)

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

    async def _resolve_user_settings(self, model: str) -> tuple[str, str | None]:
        """Resolve user default model and API key.

        Returns (model, api_key) where model may be overridden by user default
        and api_key is the resolved key for the provider.
        """
        if not self.user_id:
            return model, None

        settings_repo = UserSettingsRepo(self.user_id, self.store)
        settings = await settings_repo._get_or_create()
        user_keys = settings_repo._decrypt_keys(settings)

        # Apply user default model when request has no explicit model
        if not model and settings.default_model:
            model = settings.default_model

        # Guard against None model before resolving API key
        if not model:
            return model, None

        api_key = resolve_api_key(model, user_keys if user_keys else None)
        return model, api_key

    async def llm_invoke(self, params: LLMRequest):
        agent = None
        config = None
        try:
            config = init_config(params, user_id=self.user_id)
            params = await self.service_context.llm_service.assistant(params)

            # Merge assistant-level files as base, request files override
            assistant_files = getattr(params, "files", None)
            params.input.files = {
                **(assistant_files or {}),
                **(params.input.files or {}),
            }

            # Resolve user-configured API key and default model
            params.model, api_key = await self._resolve_user_settings(params.model)

            async with get_checkpoint_db() as checkpointer:
                backend = self.init_backend(params)
                agent: Orchestra = await construct_agent(
                    instructions=params.instructions,
                    system_prompt=params.system_prompt,
                    model=params.model,
                    tools=params.tools,
                    subagents=params.subagents,
                    skills=params.skills,
                    checkpointer=checkpointer,
                    backend=backend,
                    service_context=self.service_context,
                    api_key=api_key,
                )
                response = await agent.invoke(
                    params.input,
                    config=config,
                    context=self._init_context(params),
                )
                return response
        except Exception as e:
            logger.exception(f"Error in llm_invoke: {e}")
            if agent and config:
                await self._update_store(agent, config)
            raise e
        finally:
            if self.service_context.user_id and self.service_context.checkpointer:
                if agent and config:
                    await self._update_store(agent, config)

    async def llm_stream(self, params: LLMRequest):
        assistant = await self.service_context.llm_service.assistant(params)

        # Resolve user-configured API key and default model
        assistant.model, api_key = await self._resolve_user_settings(assistant.model)

        return stream_generator(
            input=assistant.input,
            model=assistant.model,
            system_prompt=assistant.system_prompt,
            tools=assistant.tools,
            subagents=assistant.subagents,
            config=self.service_context.config,
            service_context=self.service_context,
            instructions=assistant.instructions,
            api_key=api_key,
            files=getattr(assistant, "files", None),
            skills=assistant.skills,
        )

    async def llm_task(self, job: ScheduleCreate):
        schedule = self.service_context.schedule_service.create_job(job)
        return schedule
