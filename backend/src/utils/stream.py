import os
from langchain.agents.middleware import PIIDetectionError
import ujson
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import BaseTool
from typing import List
from langgraph.types import StreamMode
from deepagents import SubAgent

from src.contexts.service import ServiceContext
from src.schemas.entities import LLMInput
from src.constants import APP_LOG_LEVEL
from src.services.db import get_checkpoint_db
from src.services.streaming import StreamingService
from src.utils.messages import from_message_to_dict
from langchain_core.messages import (
    AIMessageChunk,
    ToolMessage,
)
from src.utils.logger import log_to_file, logger

# Configurable stream timeout (default 60 seconds)
STREAM_TIMEOUT_MS = int(os.getenv("STREAM_TIMEOUT_MS", "60000"))


###########################################################################
## Handlers
###########################################################################
def _to_dict(message) -> dict:
    """Convert a message to dict, handling both Pydantic models and plain dicts."""
    if isinstance(message, dict):
        return message
    return message.model_dump()


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
    model: str,
    system_prompt: str,
    tools: list[BaseTool],
    subagents: list[SubAgent],
    config: RunnableConfig,
    service_context: ServiceContext,
    instructions: str = None,
):
    """
    Generate SSE stream events for LLM streaming.

    Uses StreamingService for runtime/backend initialization and store updates,
    ensuring consistent behavior between controller and stream module.
    """
    files_map = config["metadata"].get("files", {}) or input.file_system or {}
    todos_list = config["metadata"].get("todos", [])

    streaming_service = StreamingService(
        user_id=service_context.user_id,
        store=service_context.store,
        config=config,
        service_context=service_context,
    )

    agent = None
    async with get_checkpoint_db() as checkpointer:
        try:
            runtime = streaming_service.init_runtime(
                model=model,
                files=files_map,
                tool_call_id="tc",
            )
            backend = streaming_service.init_backend(runtime)
            agent = await streaming_service.construct_agent(
                instructions=instructions,
                system_prompt=system_prompt,
                model=model,
                tools=tools,
                subagents=subagents,
                checkpointer=checkpointer,
                backend=backend,
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

            ctx = streaming_service.init_context(model)
            async for chunk in agent.astream(
                input,
                stream_mode=["messages", "values"],
                config=config,
                context=ctx,
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
            # Yield error as SSE if streaming fails
            logger.exception("Error in stream_generator: %s", e)
            error_msg = ujson.dumps(("error", str(e)))
            yield f"data: {error_msg}\n\n"
        finally:
            if service_context.user_id and agent:
                await streaming_service.update_store(
                    agent=agent,
                    config=config,
                    files=files_map,
                    todos=todos_list,
                )


###########################################################################
## Distributed Stream Consumer
###########################################################################
async def stream_from_redis(thread_id: str):
    """
    Consume Redis stream and yield SSE events for distributed workers.

    This function reads from a Redis Stream that the worker is writing to,
    and yields SSE-formatted events for the client.

    Args:
        thread_id: The thread ID to stream results for.

    Yields:
        SSE-formatted strings in the form "data: {...}\\n\\n"
    """
    import redis.asyncio as redis
    from src.workers.broker import REDIS_URL

    stream_key = f"agent:stream:{thread_id}"
    redis_client = redis.from_url(REDIS_URL)
    last_id = "0"

    try:
        while True:
            # Block for configurable time waiting for messages (default 60s)
            messages = await redis_client.xread(
                {stream_key: last_id},
                block=STREAM_TIMEOUT_MS,
            )

            if not messages:
                # No messages yet, yield a keep-alive comment
                yield ": keep-alive\n\n"
                continue

            for stream, entries in messages:
                for entry_id, data in entries:
                    last_id = entry_id

                    if b"done" in data:
                        yield "data: [DONE]\n\n"
                        return
                    if b"error" in data:
                        error_msg = data[b"error"].decode()
                        yield f'data: {{"error": "{error_msg}"}}\n\n'
                        yield "data: [DONE]\n\n"
                        return
                    if b"data" in data:
                        yield f"data: {data[b'data'].decode()}\n\n"
    except Exception as e:
        logger.exception(f"Error in stream_from_redis: {e}")
        yield f'data: {{"error": "{str(e)}"}}\n\n'
        yield "data: [DONE]\n\n"
    finally:
        await redis_client.aclose()
