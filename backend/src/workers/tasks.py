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
from src.workers.broker import broker, REDIS_URL


@broker.task(task_name="run_agent_stream")
async def run_agent_stream(
    task_dict: dict,
    user_id: str,
    thread_id: str,
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

    stream_key = f"agent:stream:{thread_id}"
    redis_client = redis.from_url(REDIS_URL)

    # Clear any existing stream from previous turns on this thread
    await redis_client.delete(stream_key)

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
        await redis_client.expire(stream_key, 300)
        # Clear the abort signal
        await AbortService.clear_abort_signal(thread_id)
        await redis_client.aclose()
        return {"status": "aborted", "stream_key": stream_key}

    try:
        # Reconstruct request from dict
        params = LLMRequest(**task_dict)
        params.metadata.user_id = user_id
        params.metadata.thread_id = thread_id

        logger.info(f"Starting distributed agent task for thread: {thread_id}")

        # Initialize config
        config = init_config(params, user_id)
        files_map = config["configurable"].get("files", {})
        todos_list = config["configurable"].get("todos", [])

        # Get checkpointer based on mode
        if CHECKPOINT_USE_RESILIENT:
            # Use worker-level checkpointer (persistent per worker)
            from src.workers.state import get_worker_checkpointer

            checkpointer = await get_worker_checkpointer()
            # Store still uses per-task context manager
            async with get_store_db() as store:
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
                    stream_key=stream_key,
                    redis_client=redis_client,
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
                    stream_key=stream_key,
                    redis_client=redis_client,
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
        await redis_client.xadd(
            stream_key, {"error": f"Checkpoint error: {e}", "done": "true"}
        )
        await redis_client.expire(stream_key, 300)
        raise

    except Exception as e:
        logger.exception(f"Task failed for thread {thread_id}: {e}")
        try:
            await redis_client.xadd(stream_key, {"error": str(e), "done": "true"})
            await redis_client.expire(stream_key, 300)
        except Exception as redis_err:
            logger.error(
                f"Failed to send error to Redis for thread {thread_id}: {redis_err}"
            )
        raise
    finally:
        await redis_client.aclose()


async def _execute_agent_stream(
    params: LLMRequest,
    config,
    files_map,
    todos_list,
    service_context: ServiceContext,
    checkpointer,
    user_id,
    thread_id,
    stream_key,
    redis_client,
) -> dict:
    """Execute the agent stream logic with abort signal checking.

    Extracted to reduce duplication between resilient and legacy modes.
    Checks for abort signals on every chunk for responsive cancellation.

    Automatically loads user memories via ``prepare_memory_files()`` and merges
    them into the files map before agent construction. User-provided files take
    precedence over memory files. The resulting memory sources are passed to
    ``construct_agent()`` so that MemoryMiddleware is activated.
    """
    from deepagents.backends import StoreBackend
    from langchain.tools import ToolRuntime
    from src.schemas.contexts import ContextSchema
    from src.agents import construct_agent, resolve_sandbox_backend, prepare_memory_files
    from src.utils.stream import handle_multi_mode
    from src.utils.format import get_time
    from src.utils.logger import logger
    from src.services.errors import CheckpointConnectionError
    from src.services.abort import AbortService

    # Get assistant config if needed
    params = await service_context.llm_service.assistant(params)

    # Load user memories and merge into files_map
    memory_files, memory_sources = await prepare_memory_files(
        user_id, service_context.memory_service
    )
    files_map = {**memory_files, **files_map}

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
    store_backend = StoreBackend(runtime)
    routes = {
        f"/users/{user_id}/memories/": store_backend,
        f"/users/{user_id}/config/": store_backend,
    }
    backend, _sandbox = resolve_sandbox_backend(runtime, routes=routes)

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
    )
    params.input.messages[-1].model = agent.model

    # Send metadata event first
    metadata_event = ujson.dumps(
        (
            "metadata",
            {
                "thread_id": config["configurable"].get("thread_id"),
                "assistant_id": config["configurable"].get("assistant_id"),
                "project_id": config["configurable"].get("project_id"),
            },
        )
    )
    await redis_client.xadd(stream_key, {"data": metadata_event})

    # Stream to Redis using handle_multi_mode for format consistency
    async for chunk in agent.astream(
        params.input,
        stream_mode=["messages", "values"],
        config=config,
        context=ctx_schema,
    ):
        # Check for abort signal on every chunk for responsive cancellation
        if await AbortService.check_abort_signal(thread_id, expected_user_id=user_id):
            logger.info(
                "task_aborted_by_user",
                extra={
                    "event": "task_aborted_by_user",
                    "thread_id": thread_id,
                    "user_id": user_id,
                },
            )
            # Send abort acknowledgment to client
            await redis_client.xadd(
                stream_key,
                {"data": ujson.dumps(("aborted", {"reason": "user_requested"}))},
            )
            await redis_client.xadd(stream_key, {"done": "true"})
            await redis_client.expire(stream_key, 300)
            # Clear abort signal
            await AbortService.clear_abort_signal(thread_id)
            return {"status": "aborted", "stream_key": stream_key}

        stream_chunk = handle_multi_mode(chunk)
        if stream_chunk:
            stream_type = stream_chunk[0]
            chunk_data = stream_chunk[1]
            if stream_type == "values" and chunk_data.get("files"):
                files_map = {**files_map, **chunk_data["files"]}
            if stream_type == "values" and "todos" in chunk_data:
                todos_list = chunk_data["todos"]
            # Serialize to JSON and push to Redis stream
            data = ujson.dumps(stream_chunk)
            await redis_client.xadd(stream_key, {"data": data})

    # Signal completion
    await redis_client.xadd(stream_key, {"done": "true"})
    await redis_client.expire(stream_key, 300)

    logger.info(f"Distributed agent task completed for thread: {thread_id}")

    # Update thread state with graceful checkpoint error handling
    if service_context.user_id and checkpointer:
        try:
            final_state = await agent.graph.aget_state(config)

            if not final_state or not final_state.values.get("messages"):
                logger.warning(
                    f"Checkpoint update resulted in empty state for thread {thread_id}"
                )

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

    return {"status": "complete", "stream_key": stream_key}
