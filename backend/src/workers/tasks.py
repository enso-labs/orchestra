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
from src.services.idempotency import claim_run
from src.utils.stream import get_distributed_stream_key, STREAM_KEY_TTL_SECONDS

# Sentinel embedded in a user message to deterministically force a permanent
# failure, exercising the DLQ record+surface+replay path end-to-end without a
# real provider/auth fault. Used by the resiliency DLQ probe and the frontend
# replay e2e — never emitted by normal traffic.
_DLQ_TRIGGER_SENTINEL = "__DLQ_TRIGGER__"


def _extract_user_message_text(task_dict: dict) -> str:
    """Concatenate the text of all user messages in a serialized LLMRequest dict.

    Mirrors the ``input.messages[*].content`` shape (string or multimodal list)
    without reconstructing the full ``LLMRequest`` model, so the DLQ fault
    injection can run before any heavyweight init work.
    """
    try:
        messages = (task_dict or {}).get("input", {}).get("messages", []) or []
    except AttributeError:
        return ""
    parts: list[str] = []
    for message in messages:
        if not isinstance(message, dict):
            continue
        content = message.get("content", "")
        if isinstance(content, str):
            parts.append(content)
        elif isinstance(content, list):
            for block in content:
                if isinstance(block, dict):
                    parts.append(str(block.get("text", "")))
                else:
                    parts.append(str(block))
    return " ".join(parts)


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
    # Graceful drain: if this worker is draining (shutting down), refuse NEW
    # work immediately — before the idempotency claim or any side effect — so a
    # mid-flight restart never silently swallows a freshly-dispatched run. The
    # task stays on the queue (no claim, no DLQ) for another worker to pick up.
    from src.workers.state import WorkerState

    if WorkerState.is_draining():
        from src.utils.logger import logger

        logger.info(
            "run_agent_stream_draining_refused",
            extra={
                "event": "run_agent_stream_draining_refused",
                "run_id": run_id,
                "thread_id": thread_id,
                "user_id": user_id,
            },
        )
        return {"status": "draining", "run_id": run_id}

    from src.schemas.entities import LLMRequest
    from src.agents import init_config
    from src.services.db import get_checkpoint_db, get_store_db
    from src.contexts.service import ServiceContext
    from src.utils.logger import logger
    from src.constants import CHECKPOINT_USE_RESILIENT
    from src.services.errors import (
        CheckpointConnectionError,
        PermanentCheckpointError,
        is_retryable_error,
    )
    from src.services.abort import AbortService
    from src.workers.dlq import write_dlq
    from src.utils.correlation import set_correlation_id, reset_correlation_id

    stream_key = get_distributed_stream_key(thread_id, run_id)
    redis_client = redis.from_url(REDIS_URL)

    config = None
    files_map = {}
    todos_list = []
    service_context = None

    # Bind the run_id as the correlation ID for this task so every structured log
    # line emitted during the run can be traced back to the originating request.
    # Reset in the finally below to avoid leaking the value across worker tasks.
    _correlation_token = set_correlation_id(run_id)

    try:
        # Idempotency guard: claim this run_id atomically before any work.
        # A duplicate dispatch (at-least-once redelivery, double-click, etc.)
        # will find the key already set and short-circuit here.
        if not await claim_run(run_id, redis_client=redis_client):
            from src.utils.logger import logger

            logger.info(
                "run_agent_stream_duplicate_skipped",
                extra={
                    "event": "run_agent_stream_duplicate_skipped",
                    "run_id": run_id,
                    "thread_id": thread_id,
                    "user_id": user_id,
                },
            )
            return {"status": "duplicate", "stream_key": stream_key}

        # Deterministic fault injection (e2e DLQ trigger): if the user message
        # carries the sentinel, raise a PERMANENT error so the DLQ path below
        # records + surfaces + makes the run replayable. Kept inside the try so
        # the permanent-error handler dead-letters it like any real failure.
        if _DLQ_TRIGGER_SENTINEL in _extract_user_message_text(task_dict):
            raise PermanentCheckpointError("forced permanent failure (e2e DLQ trigger)")

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
        # CheckpointConnectionError means retries are exhausted with no fallback.
        # Classify it: a retryable underlying cause is re-raised for the broker;
        # a permanent one is dead-lettered (recorded + replayable) instead.
        if is_retryable_error(e):
            raise
        await write_dlq(
            redis_client,
            run_id,
            task_dict=task_dict,
            user_id=user_id,
            thread_id=thread_id,
            error=e,
        )
        return {"status": "error", "stream_key": stream_key, "dead_lettered": True}

    except Exception as e:
        logger.exception(f"Task failed for thread {thread_id}: {e}")
        # Classify the failure. Retryable errors are re-raised so the TaskIQ
        # broker retries them. Permanent errors are dead-lettered: recorded to
        # the DLQ, surfaced to SSE clients, and made replayable — NOT re-raised
        # (re-raising would trigger broker retries that defeat the DLQ).
        retryable = is_retryable_error(e)
        if retryable:
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

        # Permanent failure → dead-letter it.
        await write_dlq(
            redis_client,
            run_id,
            task_dict=task_dict,
            user_id=user_id,
            thread_id=thread_id,
            error=e,
        )
        try:
            # Surface to SSE clients: recoverable=True signals the UI can offer a
            # replay action for this dead-lettered run.
            await redis_client.xadd(
                stream_key,
                {"data": ujson.dumps(("error", {"run_id": run_id, "error": str(e), "recoverable": True}))},
            )
            await redis_client.xadd(stream_key, {"done": "true"})
            await redis_client.expire(stream_key, STREAM_KEY_TTL_SECONDS)
        except Exception as redis_err:
            logger.error(f"Failed to send DLQ error to Redis for thread {thread_id}: {redis_err}")
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
        return {"status": "error", "stream_key": stream_key, "dead_lettered": True}
    finally:
        reset_correlation_id(_correlation_token)
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
        is_mcp_sandbox_error,
        MCP_SANDBOX_UNREACHABLE,
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
    mcp_api_key = None
    if user_id:
        settings_repo = UserSettingsRepo(user_id, service_context.store)
        settings = await settings_repo._get_or_create()
        user_keys = settings_repo._decrypt_keys(settings)
        default_sandbox = getattr(settings, "default_sandbox", None)
        mcp_sandbox_url = getattr(settings, "default_mcp_sandbox_url", None)
        mcp_api_key = user_keys.get("MCP_SANDBOX_API_KEY") if user_keys else None
        if not params.model and settings.default_model:
            params.model = settings.default_model
        if not params.model:
            params.model = DEFAULT_CHAT_MODEL
        if params.model:
            api_key = resolve_api_key(params.model, user_keys if user_keys else None)
    else:
        mcp_sandbox_url = None
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
    backend, _sandbox, effective_type = resolve_sandbox_backend(
        runtime, sandbox_type=default_sandbox, mcp_sandbox_url=mcp_sandbox_url, mcp_api_key=mcp_api_key
    )

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
        elif is_mcp_sandbox_error(e):
            if default_sandbox == "mcp":
                logger.error(f"MCP sandbox error (mcp mode) in worker: {e}")
                error_msg = ujson.dumps((MCP_SANDBOX_UNREACHABLE, f"MCP sandbox unreachable: {e}"))
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
                        error=f"MCP sandbox unreachable: {e}",
                    ),
                )
                return {"status": "error", "stream_key": stream_key}
            elif default_sandbox in (None, "auto") and effective_type == "mcp":
                logger.warning(f"MCP sandbox error in auto mode worker, falling back to local: {e}")
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

    # Dispatch trajectory extraction (fire-and-forget)
    try:
        assistant_id = config.get("configurable", {}).get("assistant_id")
        if service_context.user_id and thread_id and assistant_id:
            await extract_trajectory.kiq(
                thread_id=thread_id,
                user_id=service_context.user_id,
                assistant_id=assistant_id,
            )
            logger.info(f"trajectory extraction dispatched: thread={thread_id} assistant={assistant_id}")
    except Exception as e:
        logger.warning("Failed to dispatch trajectory extraction: %s", e)

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


def _extract_text_content(content) -> str:
    """Extract plain text from message content (handles string and multimodal list formats)."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return " ".join(block.get("text", "") if isinstance(block, dict) else str(block) for block in content)
    return str(content) if content else ""


@broker.task(task_name="extract_trajectory")
async def extract_trajectory(thread_id: str, user_id: str, assistant_id: str) -> dict:
    """Extract AnnotatedTrajectory from a completed conversation and store it.

    Loads the thread's messages, converts them to the langmem AnnotatedTrajectory
    format, derives quality signals (conversation length, tool success rate, HITL
    rejections), and stores the trajectory in the AsyncPostgresStore under the
    ``(user_id, "trajectories", assistant_id)`` namespace.

    All exceptions are caught and logged — extraction failures never propagate.

    Args:
        thread_id: Thread containing the conversation messages.
        user_id: Owner of the thread / target namespace for trajectory storage.
        assistant_id: Assistant whose conversation is being extracted.

    Returns:
        dict with ``status`` ("success", "skipped", or "error") and details.
    """
    import uuid

    from langmem.prompts.types import AnnotatedTrajectory

    from src.services.db import get_store_db
    from src.services.thread import ThreadService
    from src.utils.logger import logger

    try:
        async with get_store_db() as store:
            # 1. Load conversation messages from thread
            thread_service = ThreadService(user_id=user_id, store=store)
            thread = await thread_service.get(thread_id)

            if not thread or not getattr(thread, "messages", None):
                logger.info(
                    "trajectory_skip_no_messages",
                    extra={"event": "trajectory_skip_no_messages", "thread_id": thread_id},
                )
                return {"status": "skipped", "reason": "no_messages"}

            messages: list = thread.messages if isinstance(thread.messages, list) else []

            # 2. Convert messages to AnnotatedTrajectory format and derive quality signals
            trajectory_messages: list[dict] = []
            tool_messages_total = 0
            tool_messages_error = 0
            hitl_rejections = 0

            for msg in messages:
                if isinstance(msg, dict):
                    msg_type = msg.get("type", "")
                    content = msg.get("content", "")
                else:
                    msg_type = getattr(msg, "type", "")
                    content = getattr(msg, "content", "")

                text = _extract_text_content(content)

                if msg_type in ("human", "user"):
                    trajectory_messages.append({"role": "user", "content": text})
                    # Detect HITL rejection responses
                    if "rejected this action" in text.lower():
                        hitl_rejections += 1

                elif msg_type in ("ai", "assistant"):
                    trajectory_messages.append({"role": "assistant", "content": text})

                elif msg_type == "tool":
                    tool_messages_total += 1
                    lower_text = text.lower()
                    if any(indicator in lower_text for indicator in ("error", "exception", "traceback", "failed")):
                        tool_messages_error += 1

            if not trajectory_messages:
                logger.info(
                    "trajectory_skip_empty",
                    extra={"event": "trajectory_skip_empty", "thread_id": thread_id},
                )
                return {"status": "skipped", "reason": "no_trajectory_messages"}

            # 3. Build feedback dict with quality signals
            conversation_length = len(trajectory_messages)
            tool_success_rate = (
                (tool_messages_total - tool_messages_error) / tool_messages_total if tool_messages_total > 0 else None
            )

            feedback: dict = {"conversation_length": conversation_length}
            if tool_success_rate is not None:
                feedback["tool_success_rate"] = round(tool_success_rate, 3)
            if hitl_rejections > 0:
                feedback["hitl_rejections"] = hitl_rejections

            # 4. Format as AnnotatedTrajectory
            trajectory = AnnotatedTrajectory(messages=trajectory_messages, feedback=feedback)

            # 5. Store in (user_id, "trajectories", assistant_id) namespace
            trajectory_id = str(uuid.uuid4())
            namespace = (user_id, "trajectories", assistant_id)
            await store.aput(namespace=namespace, key=trajectory_id, value=trajectory._asdict())

            logger.info(
                "trajectory_extracted",
                extra={
                    "event": "trajectory_extracted",
                    "thread_id": thread_id,
                    "user_id": user_id,
                    "assistant_id": assistant_id,
                    "trajectory_id": trajectory_id,
                    "conversation_length": conversation_length,
                    "tool_success_rate": tool_success_rate,
                    "hitl_rejections": hitl_rejections,
                },
            )

            return {
                "status": "success",
                "trajectory_id": trajectory_id,
                "conversation_length": conversation_length,
            }

    except Exception as e:
        logger.error(
            "trajectory_extraction_failed",
            extra={
                "event": "trajectory_extraction_failed",
                "thread_id": thread_id,
                "user_id": user_id,
                "assistant_id": assistant_id,
                "error": str(e),
            },
        )
        return {"status": "error", "error": str(e)}
