import asyncio
import inspect
import os
from langchain.agents.middleware import PIIDetectionError
from langchain.tools import ToolRuntime
import ujson
from langchain_core.language_models import BaseChatModel
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import BaseTool
from typing import List
from langgraph.types import StreamMode
from deepagents import SubAgent

from src.schemas.contexts import ContextSchema
from src.contexts.service import ServiceContext
from src.schemas.entities import LLMInput
from src.constants import APP_LOG_LEVEL
from src.agents import (
    construct_agent,
    resolve_sandbox_backend,
    prepare_memory_files,
    is_daytona_error,
    _create_state_backend,
)
from src.services.db import get_checkpoint_db
from src.services.context_files import resolve_context_files, select_memory_sources
from src.utils.messages import from_message_to_dict
from langchain_core.messages import (
    AIMessageChunk,
    ToolMessage,
)
from src.utils.logger import log_to_file, logger
from src.utils.format import get_time

# Configurable stream timeout (default 60 seconds)
STREAM_TIMEOUT_MS = int(os.getenv("STREAM_TIMEOUT_MS", "60000"))
STREAM_KEY_TTL_SECONDS = 300
# Max lifetime for a stream_from_redis consumer (default 10 minutes)
MAX_STREAM_LIFETIME_SECONDS = int(os.getenv("MAX_STREAM_LIFETIME_SECONDS", "600"))
# After this many consecutive empty XREAD results, assume worker is dead
MAX_CONSECUTIVE_EMPTY = int(os.getenv("MAX_STREAM_CONSECUTIVE_EMPTY", "5"))


def get_distributed_stream_key(thread_id: str, run_id: str) -> str:
    return f"agent:stream:{thread_id}:{run_id}"


async def distributed_stream_exists(thread_id: str, run_id: str) -> bool:
    import redis.asyncio as redis
    from src.workers.broker import REDIS_URL

    redis_client = redis.from_url(REDIS_URL)
    try:
        return bool(await redis_client.exists(get_distributed_stream_key(thread_id, run_id)))
    finally:
        await redis_client.aclose()


###########################################################################
## Handlers
###########################################################################
def _to_dict(message) -> dict:
    """Convert a message to dict, handling both Pydantic models and plain dicts."""
    if isinstance(message, dict):
        d = message
    else:
        d = message.model_dump()
    # Promote lc_agent_name → agent_name for frontend consumption
    if "lc_agent_name" in d and "agent_name" not in d:
        d["agent_name"] = d["lc_agent_name"]
    return d


def handle_tasks_mode(payload: dict):
    converted: List[dict] = []

    if "input" in payload:
        input = payload["input"]
        if "messages" in payload["input"]:
            for message in input["messages"]:
                converted.append(_to_dict(message))
            input["messages"] = converted
        return payload

    if "result" in payload:
        messages = payload["result"][0][1]
        for message in messages:
            converted.append(_to_dict(message))
        payload["result"][0] = [payload["result"][0][0], converted]

    return payload


def handle_messages_mode(payload: dict):
    if isinstance(payload, tuple):
        return [_to_dict(payload[0]), payload[1]]

    converted: List[dict] = []

    if "messages" in payload:
        for message in payload["messages"]:
            converted.append(_to_dict(message))
        payload["messages"] = converted

    return payload


def handle_debug_mode(payload: dict):
    converted: List[dict] = []

    if "payload" in payload:
        if "input" in payload["payload"]:
            input = payload["payload"]["input"]

            if "messages" in input:
                for message in input.get("messages"):
                    converted.append(_to_dict(message))
                payload["payload"]["input"]["messages"] = converted
                return payload

            if "args" in input[0]:
                return payload

        if payload.get("payload", {}).get("result"):
            messages = payload.get("payload", {}).get("result")[0][1]
            for message in messages:
                converted.append(_to_dict(message))
            payload["payload"]["result"][0] = [
                payload["payload"]["result"][0][0],
                converted,
            ]
            return payload


def handle_updates_mode(payload: dict):
    converted: List[dict] = []

    if payload.get("agent"):
        messages = payload.get("agent", {}).get("messages", [])

    if payload.get("tools"):
        messages = payload.get("tools", {}).get("messages", [])

    for message in messages:
        converted.append(_to_dict(message))
    return converted


def handle_values_mode(payload: dict):
    converted: List[dict] = []
    messages = payload.get("messages", [])
    for message in messages:
        converted.append(_to_dict(message))
    payload["messages"] = converted
    return payload


###########################################################################
## Message Conversion
###########################################################################
def convert_messages(payload: dict, stream_mode: StreamMode):
    if stream_mode == "tasks":
        return handle_tasks_mode(payload)

    if stream_mode == "debug":
        return handle_debug_mode(payload)

    if stream_mode == "messages":
        return handle_messages_mode(payload)

    if stream_mode == "updates":
        return handle_updates_mode(payload)

    if stream_mode == "values":
        return handle_values_mode(payload)

    raise ValueError(f"Invalid stream mode: {stream_mode}")


def handle_multi_mode(chunk: dict):
    try:
        if "values" in chunk:
            chunk[1]["messages"] = from_message_to_dict(chunk[1]["messages"])
            return chunk

        if "messages" in chunk:
            i0, i1 = chunk[0], chunk[1]
            msg = i1[0]
            current_agent = None

            if agent_name := dict(msg).get("lc_agent_name"):
                if agent_name != current_agent:
                    logger.warning(f"🤖 {agent_name}: ")

            if isinstance(msg, ToolMessage):
                return (i0, (_to_dict(msg), i1[1] or None))

            if isinstance(msg, AIMessageChunk):
                stop = (
                    msg.response_metadata.get("finish_reason")
                    or msg.response_metadata.get("stop_reasoning")
                    or msg.response_metadata.get("stop_reason")
                )
                content = msg.content or msg.additional_kwargs.get("reasoning_content")
                if msg.tool_calls or msg.tool_call_chunks or stop or content:
                    return (i0, (_to_dict(msg), i1[1] or None))
                logger.warning(f"No content: {chunk}")
                return None

        logger.error(f"Invalid chunk: {chunk}")
    except Exception as e:
        logger.error(f"Error in handle_multi_mode: {e}")
    return None


async def stream_generator(
    input: LLMInput,
    model: BaseChatModel,
    system_prompt: str,
    tools: list[BaseTool],
    subagents: list[SubAgent],
    config: RunnableConfig,
    service_context: ServiceContext,
    instructions: str = None,
    api_key: str | None = None,
    sandbox_type: str | None = None,
):
    """Stream agent responses as Server-Sent Events.

    Automatically loads user memories via ``prepare_memory_files()`` and merges
    them into the files map before agent construction. User-provided files take
    precedence over memory files. The resulting memory sources are passed to
    ``construct_agent()`` so that MemoryMiddleware is activated.
    """
    explicit_files = {
        **(config["metadata"].get("files", {}) or {}),
        **(input.files or {}),
    }
    todos_list = config["metadata"].get("todos", [])
    memory_files, _memory_sources = await prepare_memory_files(service_context.user_id, service_context.memory_service)
    memory_sources = select_memory_sources(
        explicit_files=explicit_files,
        memory_files=memory_files,
    )
    selected_memory_files = {path: memory_files[path] for path in (memory_sources or [])}
    files_map = await resolve_context_files(
        user_id=service_context.user_id,
        store=service_context.store,
        memory_files=selected_memory_files,
        explicit_files=explicit_files,
    )
    async with get_checkpoint_db() as checkpointer:
        agent = None
        try:
            ctx = ContextSchema(
                model=model,
                user_id=service_context.user_id,
            )
            runtime = ToolRuntime(
                state={"messages": [], "files": files_map},
                context=ctx,
                tool_call_id="tc",
                store=service_context.store,
                stream_writer=lambda _: None,
                config=config,
            )
            backend, _sandbox, effective_type = resolve_sandbox_backend(runtime, sandbox_type=sandbox_type)
            agent = await construct_agent(
                instructions=instructions,
                system_prompt=system_prompt,
                model=model,
                tools=tools,
                subagents=subagents,
                checkpointer=checkpointer,
                backend=backend,
                service_context=service_context,
                api_key=api_key,
                memory=memory_sources,
            )
            input.messages[-1].model = agent.model
            # Send metadata event with thread_id at the start of the stream
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
            yield f"data: {metadata_event}\n\n"
            astream_kwargs = {
                "stream_mode": ["messages", "values"],
                "config": config,
                "context": ctx,
            }
            try:
                if "subgraphs" in inspect.signature(agent.astream).parameters:
                    astream_kwargs["subgraphs"] = True
            except Exception:
                # Be conservative if signature inspection fails.
                pass

            async for chunk in agent.astream(
                input,
                **astream_kwargs,
            ):
                # Serialize and yield each chunk as SSE
                stream_chunk = handle_multi_mode(chunk)
                if stream_chunk:
                    stream_type = stream_chunk[0]
                    chunk_data = stream_chunk[1]
                    if stream_type == "values" and "files" in chunk_data:
                        files_map = {**files_map, **chunk_data["files"]}
                    if stream_type == "values" and "todos" in chunk_data:
                        todos_list = chunk_data["todos"]
                    data = ujson.dumps(stream_chunk)
                    log_to_file(str(data), agent.model) and APP_LOG_LEVEL == "DEBUG"
                    logger.debug(f"data: {str(data)}")
                    yield f"data: {data}\n\n"
        except PIIDetectionError as e:
            # Yield error as SSE if streaming fails
            logger.warning(f"Sensitive data detected in the query: {e}")
            error_msg = ujson.dumps(("error", str(e)))
            yield f"data: {error_msg}\n\n"

        except Exception as e:
            if is_daytona_error(e):
                if sandbox_type == "daytona":
                    # Explicit daytona mode: surface the detailed error
                    logger.error(f"Daytona sandbox error (daytona mode): {e}")
                    error_msg = ujson.dumps(("error", f"Daytona sandbox error: {e}"))
                    yield f"data: {error_msg}\n\n"
                elif sandbox_type in (None, "auto") and effective_type == "daytona":
                    # Auto mode: fallback to local StateBackend and retry
                    logger.warning(f"Daytona sandbox error in auto mode, falling back to local: {e}")
                    try:
                        fallback_backend, _ = _create_state_backend(runtime)
                        agent = await construct_agent(
                            instructions=instructions,
                            system_prompt=system_prompt,
                            model=model,
                            tools=tools,
                            subagents=subagents,
                            checkpointer=checkpointer,
                            backend=fallback_backend,
                            service_context=service_context,
                            api_key=api_key,
                            memory=memory_sources,
                        )
                        async for chunk in agent.astream(
                            input,
                            **astream_kwargs,
                        ):
                            stream_chunk = handle_multi_mode(chunk)
                            if stream_chunk:
                                stream_type = stream_chunk[0]
                                chunk_data = stream_chunk[1]
                                if stream_type == "values" and "files" in chunk_data:
                                    files_map = {**files_map, **chunk_data["files"]}
                                if stream_type == "values" and "todos" in chunk_data:
                                    todos_list = chunk_data["todos"]
                                data = ujson.dumps(stream_chunk)
                                log_to_file(str(data), agent.model) and APP_LOG_LEVEL == "DEBUG"
                                logger.debug(f"data: {str(data)}")
                                yield f"data: {data}\n\n"
                    except Exception as fallback_err:
                        logger.exception("Fallback also failed in stream_generator: %s", fallback_err)
                        error_msg = ujson.dumps(("error", str(fallback_err)))
                        yield f"data: {error_msg}\n\n"
                else:
                    logger.exception("Error in stream_generator: %s", e)
                    error_msg = ujson.dumps(("error", str(e)))
                    yield f"data: {error_msg}\n\n"
            else:
                # Non-Daytona error: original behavior
                logger.exception("Error in stream_generator: %s", e)
                error_msg = ujson.dumps(("error", str(e)))
                yield f"data: {error_msg}\n\n"
        finally:
            try:
                if service_context.user_id and checkpointer and agent:
                    final_state = await agent.graph.aget_state(config)
                    configurable = {
                        **final_state.config.get("configurable", {}),
                        **config["configurable"],
                    }
                    messages = final_state.values.get("messages", [])

                    # Update the store with the final messages and files
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
                    # Log the update for debugging
                    logger.info(f"checkpoint: {ujson.dumps(configurable)}")
            except Exception as e:
                logger.exception("Failed to persist final checkpoint state: %s", e)

        # Ensure frontend gets an explicit terminal signal to clear loading state.
        yield "data: [DONE]\n\n"


###########################################################################
## Distributed Stream Consumer
###########################################################################
async def stream_from_redis(thread_id: str, run_id: str, after: str = "0"):
    """
    Consume Redis stream and yield SSE events for distributed workers.

    This function reads from a Redis Stream that the worker is writing to,
    and yields SSE-formatted events for the client.

    Args:
        thread_id: The thread ID to stream results for.
        run_id: The run ID for the specific distributed turn.
        after: Redis stream entry ID to resume after.

    Yields:
        SSE-formatted strings in the form "data: {...}\\n\\n"
    """
    import redis.asyncio as redis
    from src.workers.broker import REDIS_URL

    import time

    stream_key = get_distributed_stream_key(thread_id, run_id)
    redis_client = redis.from_url(REDIS_URL)
    last_id = after or "0"

    try:
        # Wait for stream to appear (worker may still be initializing)
        max_wait_seconds = 30
        poll_interval = 1.0
        waited = 0.0
        while not await redis_client.exists(stream_key):
            if waited >= max_wait_seconds:
                raise FileNotFoundError(f"Distributed stream not found for thread={thread_id} run={run_id}")
            yield ": waiting\n\n"
            await asyncio.sleep(poll_interval)
            waited += poll_interval

        # Fix 3: Track lifetime and consecutive empty reads
        start_time = time.monotonic()
        consecutive_empty = 0

        while True:
            # Check max lifetime
            elapsed = time.monotonic() - start_time
            if elapsed > MAX_STREAM_LIFETIME_SECONDS:
                logger.warning(
                    f"stream_from_redis exceeded max lifetime ({MAX_STREAM_LIFETIME_SECONDS}s) "
                    f"for thread={thread_id} run={run_id}"
                )
                yield f'data: ["error", {{"error": "Stream timed out after {MAX_STREAM_LIFETIME_SECONDS}s"}}]\n\n'
                yield "data: [DONE]\n\n"
                return

            # Block for configurable time waiting for messages (default 60s)
            messages = await redis_client.xread(
                {stream_key: last_id},
                block=STREAM_TIMEOUT_MS,
            )

            if not messages:
                consecutive_empty += 1
                if consecutive_empty >= MAX_CONSECUTIVE_EMPTY:
                    logger.warning(
                        f"stream_from_redis: {consecutive_empty} consecutive empty reads "
                        f"for thread={thread_id} run={run_id} — worker likely crashed"
                    )
                    yield 'data: ["error", {"error": "Stream stalled — worker may have crashed"}]\n\n'
                    yield "data: [DONE]\n\n"
                    return
                # No messages yet, yield a keep-alive comment
                yield ": keep-alive\n\n"
                continue

            # Reset consecutive empty counter on successful read
            consecutive_empty = 0

            for stream, entries in messages:
                for entry_id, data in entries:
                    last_id = entry_id
                    event_id = entry_id.decode() if isinstance(entry_id, bytes) else str(entry_id)

                    if b"done" in data:
                        yield f"id: {event_id}\ndata: [DONE]\n\n"
                        return
                    if b"error" in data:
                        error_msg = data[b"error"].decode()
                        yield f'id: {event_id}\ndata: ["error", {{"error": {ujson.dumps(error_msg)}}}]\n\n'
                        yield f"id: {event_id}\ndata: [DONE]\n\n"
                        return
                    if b"data" in data:
                        yield f"id: {event_id}\ndata: {data[b'data'].decode()}\n\n"
    except Exception as e:
        logger.exception(f"Error in stream_from_redis: {e}")
        yield f'data: ["error", {{"error": {ujson.dumps(str(e))}}}]\n\n'
        yield "data: [DONE]\n\n"
    finally:
        await redis_client.aclose()
