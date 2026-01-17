"""
Stream utilities for LLM streaming.

This module provides the stream_generator function for SSE streaming
and the stream_from_redis consumer for distributed workers.
"""

import asyncio
from typing import Awaitable, Callable, Optional, Union

from deepagents import SubAgent
from langchain.agents.middleware import PIIDetectionError
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import BaseTool

from src.constants import APP_LOG_LEVEL
from src.contexts.service import ServiceContext
from src.schemas.entities import LLMInput
from src.schemas.events.stream import ErrorEvent, MetadataEvent
from src.services.db import get_checkpoint_db
from src.services.streaming import StreamingService
from src.utils.logger import log_to_file, logger
from src.utils.stream_formatter import StreamFormatter

# Module-level formatter instance
_formatter = StreamFormatter()


# Type alias for disconnect checker - supports both sync and async
DisconnectChecker = Union[Callable[[], bool], Callable[[], Awaitable[bool]]]


async def stream_generator(
    input: LLMInput,
    model: str,
    system_prompt: str,
    tools: list[BaseTool],
    subagents: list[SubAgent],
    config: RunnableConfig,
    service_context: ServiceContext,
    instructions: Optional[str] = None,
    is_disconnected: Optional[DisconnectChecker] = None,
):
    """
    Generate SSE stream events for LLM streaming.

    Lifecycle phases:
    1. Setup - Initialize services and construct agent
    2. Metadata - Send initial metadata event
    3. Stream - Process and yield message/values events
    4. Finalize - Update store with final state

    Args:
        is_disconnected: Optional callable that returns True if client disconnected.
                        Supports both sync and async callables.
                        Used to detect early disconnection and clean up resources.
    """
    # --- SETUP PHASE ---
    metadata = config.get("metadata", {}) or {}
    files_map = metadata.get("files", {}) or input.file_system or {}
    todos_list = metadata.get("todos", [])
    configurable = config.get("configurable", {}) or {}
    thread_id = configurable.get("thread_id", "unknown")

    streaming_service = StreamingService(
        user_id=service_context.user_id or "",
        store=service_context.store,
        config=config,
        service_context=service_context,
    )

    agent = None
    async with get_checkpoint_db() as checkpointer:
        try:
            runtime = streaming_service.init_runtime(
                model=model, files=files_map, tool_call_id="tc"
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

            # --- METADATA PHASE ---
            yield MetadataEvent(
                thread_id=configurable.get("thread_id"),
                assistant_id=configurable.get("assistant_id"),
                project_id=configurable.get("project_id"),
            ).to_sse()

            # --- STREAM PHASE ---
            ctx = streaming_service.init_context(model)
            async for chunk in agent.astream(
                input, stream_mode=["messages", "values"], config=config, context=ctx
            ):
                # Check for client disconnect
                if is_disconnected:
                    result = is_disconnected()
                    # Handle both sync and async disconnect checkers
                    if asyncio.iscoroutine(result):
                        disconnected = await result
                    else:
                        disconnected = result
                    if disconnected:
                        logger.info(
                            f"Client disconnected during stream: thread_id={thread_id}"
                        )
                        break

                event = _formatter.format_chunk(chunk)
                if event:
                    if hasattr(event, "files") and event.files:
                        files_map = {**files_map, **event.files}
                    if hasattr(event, "todos") and event.todos:
                        todos_list = event.todos
                    log_to_file(
                        event.to_sse(), agent.model
                    ) and APP_LOG_LEVEL == "DEBUG"
                    yield event.to_sse()

        except asyncio.CancelledError:
            logger.info(f"Stream cancelled: thread_id={thread_id}")
            raise  # Re-raise to propagate cancellation

        except PIIDetectionError as e:
            logger.warning(f"Sensitive data detected: {e}")
            yield ErrorEvent(message=str(e), code="PII_DETECTED").to_sse()

        except Exception as e:
            logger.exception("Error in stream_generator: %s", e)
            yield ErrorEvent(message=str(e)).to_sse()

        finally:
            # --- FINALIZE PHASE ---
            # Always update store, even on cancellation
            if service_context.user_id and agent:
                await streaming_service.update_store(
                    agent=agent, config=config, files=files_map, todos=todos_list
                )


###########################################################################
## Distributed Stream Consumer
###########################################################################
async def stream_from_redis(thread_id: str):
    """
    Consume Redis stream and yield SSE events for distributed workers.

    This function reads from a Redis Stream that the worker is writing to,
    and yields SSE-formatted events for the client. Uses StreamEvent types
    for consistency with sync streaming.

    Configuration is obtained from StreamingService.get_redis_stream_config():
    - timeout_ms: How long to block waiting for messages (default 60s)
    - keepalive_ms: Interval for keep-alive comments (default 30s)

    Args:
        thread_id: The thread ID to stream results for.

    Yields:
        SSE-formatted strings in the form "data: {...}\\n\\n"
    """
    import redis.asyncio as redis

    from src.schemas.events.stream import DoneEvent, ErrorEvent
    from src.services.streaming import StreamingService
    from src.workers.broker import REDIS_URL

    # Get configuration from StreamingService
    config = StreamingService.get_redis_stream_config()
    timeout_ms = config["timeout_ms"]
    keepalive_ms = config["keepalive_ms"]

    stream_key = f"agent:stream:{thread_id}"
    redis_client = redis.from_url(REDIS_URL)
    last_id = "0"

    try:
        while True:
            # Block for configured timeout waiting for messages
            messages = await redis_client.xread(
                {stream_key: last_id},
                block=keepalive_ms,  # Use keepalive interval for block timeout
            )

            if not messages:
                # No messages yet, yield a keep-alive comment
                yield ": keep-alive\n\n"
                continue

            for stream, entries in messages:
                for entry_id, data in entries:
                    last_id = entry_id

                    if b"done" in data:
                        yield DoneEvent().to_sse()
                        return
                    if b"error" in data:
                        error_msg = data[b"error"].decode()
                        # Use ErrorEvent for consistent error format
                        yield ErrorEvent(message=error_msg).to_sse()
                        yield DoneEvent().to_sse()
                        return
                    if b"data" in data:
                        yield f"data: {data[b'data'].decode()}\n\n"
    except Exception as e:
        logger.exception(f"Error in stream_from_redis: {e}")
        # Use ErrorEvent for consistent error format
        yield ErrorEvent(message=str(e)).to_sse()
        yield DoneEvent().to_sse()
    finally:
        await redis_client.aclose()
