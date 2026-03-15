"""TaskIQ task definitions for distributed agent execution.

This module defines background tasks that can be executed by TaskIQ workers.
The main task is `run_agent_stream` which handles agent execution and streams
results to Redis for SSE consumption.

Pattern mirrors existing `scheduled_llm_invoke` in services/schedule.py:
- Reconstructs all objects from serializable dicts
- Creates fresh DB connections inside the task (or uses worker-level checkpointer)
- Uses handle_multi_mode for LangGraph format consistency
- Writes streaming output to Redis stream

When CHECKPOINT_USE_RESILIENT is enabled:
- Uses worker-level checkpointer singleton for better connection reuse
- Handles checkpoint errors gracefully without failing the entire task
"""

import ujson
import redis.asyncio as redis
from src.contexts.service import ServiceContext
from src.schemas.entities import LLMRequest
from src.workers.broker import broker
from src.constants.redis import REDIS_URL
from src.utils.stream import get_distributed_stream_key, STREAM_KEY_TTL_SECONDS


class _RunScopedStore:
    """Thin proxy around a shared store that isolates mutable attributes per-run.

    The singleton ``AsyncPostgresStore`` in ``WorkerState`` is shared across
    concurrent task executions.  Downstream code (``ThreadRepo``, ``LLMController``)
    mutates ``store.fields`` to control which columns are returned.  Without
    isolation those mutations leak across tasks.

    This proxy captures ``fields`` on a per-run basis while delegating every
    other attribute access to the underlying store.
    """

    __slots__ = ("_store", "fields")

    def __init__(self, store):
        object.__setattr__(self, "_store", store)
        object.__setattr__(self, "fields", getattr(store, "fields", []))

    def __getattr__(self, name):
        return getattr(object.__getattribute__(self, "_store"), name)

    def __setattr__(self, name, value):
        if name in ("fields",):
            object.__setattr__(self, name, value)
        else:
            setattr(object.__getattribute__(self, "_store"), name, value)


def _build_stream_metadata(
    *,
    run_id: str,
    status: str,
    started_at: str | None,
    finished_at: str | None,
    error: str | None,
) -> dict[str, str | None]:
    return {
        "stream_status": status,
        "active_run_id": run_id,
        "active_stream_started_at": started_at,
        "active_stream_finished_at": finished_at,
        "active_stream_error": error,
    }


async def _update_thread_stream_state(
    *,
    service_context: ServiceContext,
    thread_id: str,
    config,
    files_map,
    todos_list,
    metadata: dict[str, str | None],
) -> None:
    from src.utils.format import get_time

    await service_context.thread_service.update(
        thread_id=thread_id,
        data={
            "thread_id": thread_id,
            "assistant_id": config["configurable"].get("assistant_id"),
            "project_id": config["configurable"].get("project_id"),
            "files": files_map,
            "todos": todos_list,
            "updated_at": get_time(),
            "metadata": metadata,
        },
    )


@broker.task(task_name="run_agent_stream")
async def run_agent_stream(
    task_dict: dict,
    user_id: str,
    thread_id: str,
    run_id: str,
    stream_mode: list[str] | None = None,
) -> dict:
    """
    Execute agent and stream results via Redis Streams.

    This task is designed to run in a separate worker process. It:
    1. Reconstructs the LLMRequest from the serialized dict
    2. Gets checkpointer (worker-level if resilient mode, per-task otherwise)
    3. Creates fresh store connection per task
    4. Constructs and runs the agent
    5. Streams each chunk to a Redis stream for SSE consumption
    6. Signals completion with a done marker
    7. Checks for abort signals before and during execution

    Args:
        task_dict: Serialized LLMRequest as dict
        user_id: User ID for context
        thread_id: Thread ID for the conversation
        run_id: Run ID for this specific streamed turn

    Returns:
        dict with status and stream_key
    """
    from src.schemas.entities import LLMRequest
    from src.agents import init_config
    from src.services.db import get_checkpoint_db, get_store_db
    from src.contexts.service import ServiceContext
    from src.utils.logger import logger
    from src.constants import CHECKPOINT_USE_RESILIENT
    from src.services.errors import CheckpointConnectionError
    from src.services.abort import AbortService

    stream_key = get_distributed_stream_key(thread_id, run_id)
    redis_client = redis.from_url(REDIS_URL)

    config = None
    files_map = {}
    todos_list = []
    service_context = None

    try:
        # Write initializing event immediately so clients waiting for the stream
        # see activity before the heavy init work (model loading, DB connections, etc.)
        await redis_client.xadd(stream_key, {"data": ujson.dumps(("initializing", {"run_id": run_id}))})
        await redis_client.expire(stream_key, STREAM_KEY_TTL_SECONDS)

        # Pre-start abort check: Handle race condition where abort arrives before task starts
        if await AbortService.check_abort_signal(thread_id, expected_user_id=user_id):
            logger.info(
                "task_pre_aborted",
                extra={
                    "event": "task_pre_aborted",
                    "thread_id": thread_id,
                    "user_id": user_id,
                },
            )
            # Write abort marker to stream for any listening clients
            await redis_client.xadd(
                stream_key,
                {"data": ujson.dumps(("aborted", {"reason": "pre_aborted"}))},
            )
            await redis_client.xadd(stream_key, {"done": "true"})
            await redis_client.expire(stream_key, STREAM_KEY_TTL_SECONDS)
            # Clear the abort signal
            await AbortService.clear_abort_signal(thread_id)
            return {"status": "aborted", "stream_key": stream_key}
        # Reconstruct request from dict
        params = LLMRequest(**task_dict)
        params.metadata.user_id = user_id
        params.metadata.thread_id = thread_id
        params.metadata.run_id = run_id

        logger.info(f"Starting distributed agent task for thread: {thread_id}, run: {run_id}")

        # Initialize config
        config = init_config(params, user_id)
        files_map = config["configurable"].get("files", {})
        todos_list = config["configurable"].get("todos", [])

        # Get checkpointer based on mode
        if CHECKPOINT_USE_RESILIENT:
            # Use worker-level singletons (persistent per worker)
            from src.workers.state import get_worker_checkpointer, get_worker_store

            checkpointer = await get_worker_checkpointer()
            store = _RunScopedStore(await get_worker_store())
            service_context = ServiceContext(
                user_id=user_id,
                store=store,
                config=config,
                checkpointer=checkpointer,
            )
            return await _execute_agent_stream(
                params=params,
                config=config,
                files_map=files_map,
                todos_list=todos_list,
                service_context=service_context,
                checkpointer=checkpointer,
                user_id=user_id,
                thread_id=thread_id,
                run_id=run_id,
                stream_key=stream_key,
                redis_client=redis_client,
                stream_mode=stream_mode,
            )
        else:
            # Legacy mode: per-task checkpointer
            async with (
                get_store_db() as store,
                get_checkpoint_db() as checkpointer,
            ):
                service_context = ServiceContext(
                    user_id=user_id,
                    store=store,
                    config=config,
                    checkpointer=checkpointer,
                )
                return await _execute_agent_stream(
                    params=params,
                    config=config,
                    files_map=files_map,
                    todos_list=todos_list,
                    service_context=service_context,
                    checkpointer=checkpointer,
                    user_id=user_id,
                    thread_id=thread_id,
                    run_id=run_id,
                    stream_key=stream_key,
                    redis_client=redis_client,
                    stream_mode=stream_mode,
                )

    except CheckpointConnectionError as e:
        logger.error(
            "checkpoint_connection_error_in_task",
            extra={
                "event": "checkpoint_connection_error_in_task",
                "thread_id": thread_id,
                "error": str(e),
            },
        )
        await redis_client.xadd(stream_key, {"error": f"Checkpoint error: {e}", "done": "true"})
        await redis_client.expire(stream_key, STREAM_KEY_TTL_SECONDS)
        if service_context and config:
            await _update_thread_stream_state(
                service_context=service_context,
                thread_id=thread_id,
                config=config,
                files_map=files_map,
                todos_list=todos_list,
                metadata=_build_stream_metadata(
                    run_id=run_id,
                    status="error",
                    started_at=None,
                    finished_at=None,
                    error=f"Checkpoint error: {e}",
                ),
            )
        raise

    except Exception as e:
        logger.exception(f"Task failed for thread {thread_id}: {e}")
        try:
            await redis_client.xadd(stream_key, {"error": str(e), "done": "true"})
            await redis_client.expire(stream_key, STREAM_KEY_TTL_SECONDS)
        except Exception as redis_err:
            logger.error(f"Failed to send error to Redis for thread {thread_id}: {redis_err}")
        if service_context and config:
            await _update_thread_stream_state(
                service_context=service_context,
                thread_id=thread_id,
                config=config,
                files_map=files_map,
                todos_list=todos_list,
                metadata=_build_stream_metadata(
                    run_id=run_id,
                    status="error",
                    started_at=None,
                    finished_at=None,
                    error=str(e),
                ),
            )
        raise
    finally:
        await redis_client.aclose()


async def _stream_chunks_to_redis(
    *,
    agent,
    input,
    stream_mode: list[str] | None = None,
    config,
    ctx_schema,
    files_map: dict,
    todos_list: list,
    redis_client,
    stream_key: str,
    service_context: ServiceContext,
    thread_id: str,
    user_id: str,
    run_id: str,
    started_at: str,
) -> dict | None:
    """Stream agent chunks to Redis, checking for abort signals.

    Returns an abort result dict if the user requested cancellation,
    or None if streaming completed normally. Updates files_map and
    todos_list in-place as values chunks arrive.
    """
    from src.utils.stream import handle_multi_mode
    from src.utils.format import get_time
    from src.utils.logger import logger
    from src.services.abort import AbortService

    async for chunk in agent.astream(
        input,
        stream_mode=stream_mode or ["messages", "values"],
        config=config,
        context=ctx_schema,
    ):
        if await AbortService.check_abort_signal(thread_id, expected_user_id=user_id):
            logger.info(
                "task_aborted_by_user",
                extra={
                    "event": "task_aborted_by_user",
                    "thread_id": thread_id,
                    "user_id": user_id,
                },
            )
            await redis_client.xadd(
                stream_key,
                {"data": ujson.dumps(("aborted", {"reason": "user_requested"}))},
            )
            await redis_client.xadd(stream_key, {"done": "true"})
            await redis_client.expire(stream_key, STREAM_KEY_TTL_SECONDS)
            await AbortService.clear_abort_signal(thread_id)
            await _update_thread_stream_state(
                service_context=service_context,
                thread_id=thread_id,
                config=config,
                files_map=files_map,
                todos_list=todos_list,
                metadata=_build_stream_metadata(
                    run_id=run_id,
                    status="aborted",
                    started_at=started_at,
                    finished_at=get_time(),
                    error=None,
                ),
            )
            return {"status": "aborted", "stream_key": stream_key}

        stream_chunk = handle_multi_mode(chunk)
        if stream_chunk:
            stream_type = stream_chunk[0]
            chunk_data = stream_chunk[1]
            if stream_type == "values" and chunk_data.get("files"):
                files_map.update(chunk_data["files"])
            if stream_type == "values" and "todos" in chunk_data:
                todos_list.clear()
                todos_list.extend(chunk_data["todos"])
            data = ujson.dumps(stream_chunk)
            await redis_client.xadd(stream_key, {"data": data})
    return None


async def _execute_agent_stream(
    params: LLMRequest,
    config,
    files_map,
    todos_list,
    service_context: ServiceContext,
    checkpointer,
    user_id,
    thread_id,
    run_id,
    stream_key,
    redis_client,
    stream_mode: list[str] | None = None,
) -> dict:
    """Execute the agent stream logic with abort signal checking.

    Extracted to reduce duplication between resilient and legacy modes.
    Checks for abort signals on every chunk for responsive cancellation.

    Automatically loads user memories via ``prepare_memory_files()`` and merges
    them into the files map before agent construction. User-provided files take
    precedence over memory files. The resulting memory sources are passed to
    ``construct_agent()`` so that MemoryMiddleware is activated.
    """
    from langchain.tools import ToolRuntime
    from src.schemas.contexts import ContextSchema
    from src.agents import (
        construct_agent,
        resolve_sandbox_backend,
        prepare_memory_files,
        is_daytona_error,
        _create_state_backend,
    )
    from src.utils.format import get_time
    from src.utils.logger import logger
    from src.services.errors import CheckpointConnectionError
    from src.services.context_files import select_memory_sources

    started_at = get_time()

    # Get assistant config if needed
    params = await service_context.llm_service.assistant(params)

    # Resolve user default model and API key (mirrors LLMController._resolve_user_settings)
    from src.repos.user_settings_repo import UserSettingsRepo
    from src.utils.llm import resolve_api_key
    from src.constants.llm import DEFAULT_CHAT_MODEL

    api_key = None
    default_sandbox = None
    if user_id:
        settings_repo = UserSettingsRepo(user_id, service_context.store)
        settings = await settings_repo._get_or_create()
        user_keys = settings_repo._decrypt_keys(settings)
        default_sandbox = getattr(settings, "default_sandbox", None)
        if not params.model and settings.default_model:
            params.model = settings.default_model
        if not params.model:
            params.model = DEFAULT_CHAT_MODEL
        if params.model:
            api_key = resolve_api_key(params.model, user_keys if user_keys else None)
    else:
        if not params.model:
            params.model = DEFAULT_CHAT_MODEL

    # Load only memory-backed files that were explicitly submitted in the request.
    memory_files, _memory_sources = await prepare_memory_files(user_id, service_context.memory_service)
    memory_sources = select_memory_sources(
        explicit_files=files_map,
        memory_files=memory_files,
    )
    selected_memory_files = {path: memory_files[path] for path in (memory_sources or [])}
    files_map = {**selected_memory_files, **files_map}

    # Initialize ToolRuntime and Backend
    ctx_schema = ContextSchema(model=params.model or "", user_id=user_id)
    runtime = ToolRuntime(
        state={"messages": [], "files": files_map},
        context=ctx_schema,
        tool_call_id="tc_worker",
        store=service_context.store,
        stream_writer=lambda _: None,
        config=config,
    )
    backend, _sandbox, effective_type = resolve_sandbox_backend(runtime, sandbox_type=default_sandbox)

    agent = await construct_agent(
        instructions=params.instructions,
        system_prompt=params.system_prompt,
        tools=params.tools,
        model=params.model,
        subagents=params.subagents,
        checkpointer=checkpointer,
        service_context=service_context,
        backend=backend,
        memory=memory_sources,
        api_key=api_key,
    )
    params.input.messages[-1].model = agent.model

    await _update_thread_stream_state(
        service_context=service_context,
        thread_id=thread_id,
        config=config,
        files_map=files_map,
        todos_list=todos_list,
        metadata=_build_stream_metadata(
            run_id=run_id,
            status="running",
            started_at=started_at,
            finished_at=None,
            error=None,
        ),
    )

    # Send metadata event first
    metadata_event = ujson.dumps(
        (
            "metadata",
            {
                "thread_id": config["configurable"].get("thread_id"),
                "run_id": config["configurable"].get("run_id"),
                "assistant_id": config["configurable"].get("assistant_id"),
                "project_id": config["configurable"].get("project_id"),
            },
        )
    )
    await redis_client.xadd(stream_key, {"data": metadata_event})

    # Stream to Redis using handle_multi_mode for format consistency
    try:
        abort_result = await _stream_chunks_to_redis(
            agent=agent,
            input=params.input,
            stream_mode=stream_mode,
            config=config,
            ctx_schema=ctx_schema,
            files_map=files_map,
            todos_list=todos_list,
            redis_client=redis_client,
            stream_key=stream_key,
            service_context=service_context,
            thread_id=thread_id,
            user_id=user_id,
            run_id=run_id,
            started_at=started_at,
        )
        if abort_result:
            return abort_result
    except Exception as e:
        if is_daytona_error(e):
            if default_sandbox == "daytona":
                logger.error(f"Daytona sandbox error (daytona mode) in worker: {e}")
                error_msg = ujson.dumps(("error", f"Daytona sandbox error: {e}"))
                await redis_client.xadd(stream_key, {"data": error_msg})
                await redis_client.xadd(stream_key, {"done": "true"})
                await redis_client.expire(stream_key, STREAM_KEY_TTL_SECONDS)
                await _update_thread_stream_state(
                    service_context=service_context,
                    thread_id=thread_id,
                    config=config,
                    files_map=files_map,
                    todos_list=todos_list,
                    metadata=_build_stream_metadata(
                        run_id=run_id,
                        status="error",
                        started_at=started_at,
                        finished_at=get_time(),
                        error=f"Daytona sandbox error: {e}",
                    ),
                )
                return {"status": "error", "stream_key": stream_key}
            elif default_sandbox in (None, "auto") and effective_type == "daytona":
                logger.warning(f"Daytona sandbox error in auto mode worker, falling back to local: {e}")
                fallback_backend, _ = _create_state_backend(runtime)
                agent = await construct_agent(
                    instructions=params.instructions,
                    system_prompt=params.system_prompt,
                    tools=params.tools,
                    model=params.model,
                    subagents=params.subagents,
                    checkpointer=checkpointer,
                    service_context=service_context,
                    backend=fallback_backend,
                    memory=memory_sources,
                    api_key=api_key,
                )
                await _stream_chunks_to_redis(
                    agent=agent,
                    input=params.input,
                    stream_mode=stream_mode,
                    config=config,
                    ctx_schema=ctx_schema,
                    files_map=files_map,
                    todos_list=todos_list,
                    redis_client=redis_client,
                    stream_key=stream_key,
                    service_context=service_context,
                    thread_id=thread_id,
                    user_id=user_id,
                    run_id=run_id,
                    started_at=started_at,
                )
            else:
                raise
        else:
            raise

    # Signal completion
    await redis_client.xadd(stream_key, {"done": "true"})
    await redis_client.expire(stream_key, STREAM_KEY_TTL_SECONDS)

    logger.info(f"Distributed agent task completed for thread: {thread_id}, run: {run_id}")

    # Update thread state with graceful checkpoint error handling
    if service_context.user_id and checkpointer:
        try:
            final_state = await agent.graph.aget_state(config)

            if not final_state or not final_state.values.get("messages"):
                logger.warning(f"Checkpoint update resulted in empty state for thread {thread_id}")

            configurable = {
                **final_state.config.get("configurable", {}),
                **config["configurable"],
            }
            messages = final_state.values.get("messages", [])
            if messages:
                messages[-1].model = agent.model

            service_context.store.fields = ["messages", "files"]
            await service_context.thread_service.update(
                thread_id=configurable.get("thread_id"),
                data={
                    "thread_id": configurable.get("thread_id"),
                    "checkpoint_id": configurable.get("checkpoint_id"),
                    "assistant_id": configurable.get("assistant_id"),
                    "project_id": configurable.get("project_id"),
                    "messages": messages,
                    "todos": todos_list,
                    "files": files_map,
                    "updated_at": get_time(),
                },
            )
            logger.info(f"checkpoint: {ujson.dumps(configurable)}")
        except CheckpointConnectionError as e:
            # Log but don't fail - the stream was successful
            logger.warning(
                "checkpoint_final_update_failed",
                extra={
                    "event": "checkpoint_final_update_failed",
                    "thread_id": thread_id,
                    "error": str(e),
                },
            )

    await _update_thread_stream_state(
        service_context=service_context,
        thread_id=thread_id,
        config=config,
        files_map=files_map,
        todos_list=todos_list,
        metadata=_build_stream_metadata(
            run_id=run_id,
            status="completed",
            started_at=started_at,
            finished_at=get_time(),
            error=None,
        ),
    )

    return {"status": "complete", "stream_key": stream_key}
