"""TaskIQ task definitions for distributed agent execution.

This module defines background tasks that can be executed by TaskIQ workers.
The main task is `run_agent_stream` which handles agent execution and streams
results to Redis for SSE consumption.

Pattern mirrors existing `scheduled_llm_invoke` in services/schedule.py:
- Reconstructs all objects from serializable dicts
- Creates fresh DB connections inside the task
- Uses handle_multi_mode for LangGraph format consistency
- Writes streaming output to Redis stream
"""

import ujson
import redis.asyncio as redis
from langgraph.types import Interrupt
from src.workers.broker import broker, REDIS_URL


def contains_interrupt(obj):
    """Recursively check if an object contains an Interrupt instance."""
    if isinstance(obj, Interrupt):
        return obj
    if isinstance(obj, dict):
        for v in obj.values():
            result = contains_interrupt(v)
            if result:
                return result
    if isinstance(obj, (list, tuple)):
        for item in obj:
            result = contains_interrupt(item)
            if result:
                return result
    return None


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
    2. Creates fresh database connections per task
    3. Constructs and runs the agent
    4. Streams each chunk to a Redis stream for SSE consumption
    5. Signals completion with a done marker

    Args:
        task_dict: Serialized LLMRequest as dict
        user_id: User ID for context
        thread_id: Thread ID for the conversation

    Returns:
        dict with status and stream_key
    """
    from deepagents.backends import StoreBackend
    from langchain.tools import ToolRuntime
    from src.schemas.entities import LLMRequest
    from src.schemas.contexts import ContextSchema
    from src.flows import construct_agent, init_config, init_backend
    from src.services.db import get_checkpoint_db, get_store_db
    from src.contexts.service import ServiceContext
    from src.utils.stream import handle_multi_mode  # CRITICAL: Use existing formatter
    from src.utils.logger import logger
    from src.utils.format import get_time

    stream_key = f"agent:stream:{thread_id}"
    redis_client = redis.from_url(REDIS_URL)

    # Clear any existing stream from previous turns on this thread
    # This prevents the consumer from reading stale data
    await redis_client.delete(stream_key)

    try:
        # Reconstruct request from dict (same pattern as scheduled_llm_invoke)
        params = LLMRequest(**task_dict)
        params.metadata.user_id = user_id
        params.metadata.thread_id = thread_id

        logger.info(f"🚀 Starting distributed agent task for thread: {thread_id}")

        # Initialize config
        config = init_config(params, user_id)
        files_map = config["configurable"].get("files", {})
        todos_list = config["configurable"].get("todos", [])

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

            # Get assistant config if needed
            params = await service_context.llm_service.assistant(params)

            # Initialize ToolRuntime and Backend (CRITICAL: mirrors sync path in stream.py)
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
            backend = init_backend(runtime, routes=routes)

            agent = await construct_agent(
                instructions=params.instructions,
                system_prompt=params.system_prompt,
                tools=params.tools,
                model=params.model,
                subagents=params.subagents,
                checkpointer=checkpointer,
                service_context=service_context,
                backend=backend,
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
                # Check if chunk contains an Interrupt (HITL)
                if isinstance(chunk, Interrupt):
                    # Convert Interrupt to JSON-serializable format
                    interrupt_data = {
                        "type": "interrupt",
                        "interrupt_id": chunk.id,
                        "value": chunk.value,
                        "thread_id": thread_id,
                        "checkpoint_id": config["configurable"].get("checkpoint_id"),
                    }
                    data = ujson.dumps(("interrupt", interrupt_data))
                    await redis_client.xadd(stream_key, {"data": data})
                    logger.info(f"🛑 HITL interrupt sent for thread: {thread_id}")
                    continue

                # CRITICAL: Use handle_multi_mode to maintain LangGraph format
                stream_chunk = handle_multi_mode(chunk)
                if stream_chunk:
                    # Check for nested Interrupt objects (HITL)
                    nested_interrupt = contains_interrupt(stream_chunk)
                    if nested_interrupt:
                        # Convert nested Interrupt to JSON-serializable format
                        interrupt_data = {
                            "type": "interrupt",
                            "interrupt_id": nested_interrupt.id,
                            "value": nested_interrupt.value,
                            "thread_id": thread_id,
                            "checkpoint_id": config["configurable"].get(
                                "checkpoint_id"
                            ),
                        }
                        data = ujson.dumps(("interrupt", interrupt_data))
                        await redis_client.xadd(stream_key, {"data": data})
                        logger.info(f"🛑 HITL interrupt sent for thread: {thread_id}")
                        continue

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
            await redis_client.expire(stream_key, 300)  # 5 min TTL

            logger.info(f"✓ Distributed agent task completed for thread: {thread_id}")

            # Update thread state (same as stream_generator finally block)
            if service_context.user_id and checkpointer:
                final_state = await agent.graph.aget_state(config)

                # Validate checkpoint state before update
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

        return {"status": "complete", "stream_key": stream_key}

    except Exception as e:
        logger.exception(f"Task failed for thread {thread_id}: {e}")
        try:
            await redis_client.xadd(stream_key, {"error": str(e), "done": "true"})
            await redis_client.expire(stream_key, 300)  # 5 min TTL even on error
        except Exception as redis_err:
            logger.error(
                f"Failed to send error to Redis for thread {thread_id}: {redis_err}"
            )
        raise
    finally:
        await redis_client.aclose()
