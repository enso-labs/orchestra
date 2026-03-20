from langchain.tools import ToolRuntime
import ujson

from langgraph.store.base import BaseStore
from langchain_core.runnables import RunnableConfig

from src.schemas.contexts import ContextSchema
from src.schemas.entities.schedule import ScheduleCreate
from src.schemas.entities import LLMRequest
from src.contexts.service import ServiceContext
from src.agents import (
    construct_agent,
    init_config,
    is_daytona_error,
    is_mcp_sandbox_error,
    prepare_memory_files,
    resolve_sandbox_backend,
    _create_state_backend,
)
from src.services.db import get_checkpoint_db
from src.utils.stream import stream_generator
from src.agents import Orchestra
from src.repos.user_settings_repo import UserSettingsRepo
from src.services.context_files import resolve_context_files, select_memory_sources
from src.utils.llm import resolve_api_key
from src.utils.logger import logger
from src.utils.format import get_time
from src.constants.llm import DEFAULT_CHAT_MODEL


class LLMController:
    def __init__(self, user_id: str | None, store: BaseStore, config: RunnableConfig):
        self.user_id = user_id
        self.store = store
        self.service_context = ServiceContext(user_id=self.user_id, store=self.store, config=config)

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

    async def _resolve_user_settings(self, model: str) -> tuple[str, str | None, str | None, str | None, str | None]:
        """Resolve user default model, API key, sandbox preference, MCP URL, and MCP API key.

        Returns (model, api_key, default_sandbox, mcp_sandbox_url, mcp_api_key).
        """
        if not self.user_id:
            if not model:
                model = DEFAULT_CHAT_MODEL
            return model, None, None, None, None

        settings_repo = UserSettingsRepo(self.user_id, self.store)
        settings = await settings_repo._get_or_create()
        user_keys = settings_repo._decrypt_keys(settings)

        if not model and settings.default_model:
            model = settings.default_model
        if not model:
            model = DEFAULT_CHAT_MODEL

        default_sandbox = getattr(settings, "default_sandbox", None)
        mcp_sandbox_url = getattr(settings, "default_mcp_sandbox_url", None)
        mcp_api_key = user_keys.get("MCP_SANDBOX_API_KEY") if user_keys else None

        if not model:
            return model, None, default_sandbox, mcp_sandbox_url, mcp_api_key

        api_key = resolve_api_key(model, user_keys if user_keys else None)
        return model, api_key, default_sandbox, mcp_sandbox_url, mcp_api_key

    async def llm_invoke(self, params: LLMRequest):
        """Invoke the agent synchronously and return the final response.

        Automatically loads user memories via ``prepare_memory_files()`` and
        merges them into ``params.input.files`` before backend initialisation.
        Existing user files take precedence over memory files. The resulting
        memory sources are passed to ``construct_agent()`` so that
        MemoryMiddleware is activated.
        """
        agent = None
        config = None
        try:
            config = init_config(params, user_id=self.user_id)
            params = await self.service_context.llm_service.assistant(params)

            # Resolve user-configured API key, default model, sandbox, MCP URL, and MCP API key
            params.model, api_key, default_sandbox, mcp_sandbox_url, mcp_api_key = await self._resolve_user_settings(
                params.model
            )

            # Load user memories into files_map for MemoryMiddleware
            memory_files, _memory_sources = await prepare_memory_files(
                self.user_id, self.service_context.memory_service
            )
            explicit_files = params.input.files or {}
            memory_sources = select_memory_sources(
                explicit_files=explicit_files,
                memory_files=memory_files,
            )
            selected_memory_files = {path: memory_files[path] for path in (memory_sources or [])}
            params.input.files = await resolve_context_files(
                user_id=self.user_id,
                store=self.store,
                memory_files=selected_memory_files,
                explicit_files=explicit_files,
            )

            async with get_checkpoint_db() as checkpointer:
                runtime = self._init_runtime(params)
                backend, _sandbox, effective_type = resolve_sandbox_backend(
                    runtime, sandbox_type=default_sandbox, mcp_sandbox_url=mcp_sandbox_url, mcp_api_key=mcp_api_key
                )
                agent: Orchestra = await construct_agent(
                    instructions=params.instructions,
                    system_prompt=params.system_prompt,
                    model=params.model,
                    tools=params.tools,
                    subagents=params.subagents,
                    checkpointer=checkpointer,
                    backend=backend,
                    service_context=self.service_context,
                    api_key=api_key,
                    memory=memory_sources,
                )
                response = await agent.invoke(
                    params.input,
                    config=config,
                    context=self._init_context(params),
                )
                return response
        except Exception as e:
            if is_daytona_error(e):
                if default_sandbox == "daytona":
                    logger.error(f"Daytona sandbox error (daytona mode): {e}")
                    if agent and config:
                        await self._update_store(agent, config)
                    raise
                elif default_sandbox in (None, "auto") and effective_type == "daytona":
                    logger.warning(f"Daytona sandbox error in auto mode, falling back to local: {e}")
                    try:
                        fallback_backend, _ = _create_state_backend(runtime)
                        agent = await construct_agent(
                            instructions=params.instructions,
                            system_prompt=params.system_prompt,
                            model=params.model,
                            tools=params.tools,
                            subagents=params.subagents,
                            checkpointer=checkpointer,
                            backend=fallback_backend,
                            service_context=self.service_context,
                            api_key=api_key,
                            memory=memory_sources,
                        )
                        response = await agent.invoke(
                            params.input,
                            config=config,
                            context=self._init_context(params),
                        )
                        return response
                    except Exception as fallback_err:
                        logger.exception(f"Fallback also failed in llm_invoke: {fallback_err}")
                        if agent and config:
                            await self._update_store(agent, config)
                        raise fallback_err

            if is_mcp_sandbox_error(e):
                if default_sandbox == "mcp":
                    logger.error(f"MCP sandbox error (mcp mode): {e}")
                    if agent and config:
                        await self._update_store(agent, config)
                    raise
                elif default_sandbox in (None, "auto") and effective_type == "mcp":
                    logger.warning(f"MCP sandbox error in auto mode, falling back to local: {e}")
                    try:
                        fallback_backend, _ = _create_state_backend(runtime)
                        agent = await construct_agent(
                            instructions=params.instructions,
                            system_prompt=params.system_prompt,
                            model=params.model,
                            tools=params.tools,
                            subagents=params.subagents,
                            checkpointer=checkpointer,
                            backend=fallback_backend,
                            service_context=self.service_context,
                            api_key=api_key,
                            memory=memory_sources,
                        )
                        response = await agent.invoke(
                            params.input,
                            config=config,
                            context=self._init_context(params),
                        )
                        return response
                    except Exception as fallback_err:
                        logger.exception(f"MCP fallback also failed in llm_invoke: {fallback_err}")
                        if agent and config:
                            await self._update_store(agent, config)
                        raise fallback_err

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

        # Resolve user-configured API key, default model, sandbox, MCP URL, and MCP API key
        assistant.model, api_key, default_sandbox, mcp_sandbox_url, mcp_api_key = await self._resolve_user_settings(
            assistant.model
        )

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
            sandbox_type=default_sandbox,
            mcp_sandbox_url=mcp_sandbox_url,
            mcp_api_key=mcp_api_key,
            stream_mode=assistant.resolved_stream_mode,
        )

    async def llm_task(self, job: ScheduleCreate):
        schedule = self.service_context.schedule_service.create_job(job)
        return schedule
