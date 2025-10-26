import ujson
from typing import List
from langgraph.types import StreamMode

from src.contexts.service import ServiceContext
from src.schemas.entities import LLMRequest
from src.constants import APP_LOG_LEVEL
from src.flows import construct_agent
from src.services.db import get_checkpoint_db
from src.utils.messages import from_langchain_messages_to_dict
from langchain_core.messages import (
    AIMessage,
    AIMessageChunk,
    ToolMessage,
)
from src.utils.logger import log_to_file, logger
from src.utils.format import get_time


###########################################################################
## Handlers
###########################################################################
def handle_tasks_mode(payload: dict):
    converted: List[dict] = []

    if "input" in payload:
        input = payload["input"]
        if "messages" in payload["input"]:
            for message in input["messages"]:
                converted.append(message.model_dump())
            input["messages"] = converted
        return payload

    if "result" in payload:
        messages = payload["result"][0][1]
        for message in messages:
            converted.append(message.model_dump())
        payload["result"][0] = [payload["result"][0][0], converted]

    return payload


def handle_messages_mode(payload: dict):
    if isinstance(payload, tuple):
        return [payload[0].model_dump(), payload[1]]

    converted: List[dict] = []

    if "messages" in payload:
        for message in payload["messages"]:
            converted.append(message.model_dump())
        payload["messages"] = converted

    return payload


def handle_debug_mode(payload: dict):
    converted: List[dict] = []

    if "payload" in payload:
        if "input" in payload["payload"]:
            input = payload["payload"]["input"]

            if "messages" in input:
                for message in input.get("messages"):
                    converted.append(message.model_dump())
                payload["payload"]["input"]["messages"] = converted
                return payload

            if "args" in input[0]:
                return payload

        if payload.get("payload", {}).get("result"):
            messages = payload.get("payload", {}).get("result")[0][1]
            for message in messages:
                converted.append(message.model_dump())
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
        converted.append(message.model_dump())
    return converted


def handle_values_mode(payload: dict):
    converted: List[dict] = []
    messages = payload.get("messages", [])
    for message in messages:
        converted.append(message.model_dump())
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
            chunk[1]["messages"] = from_langchain_messages_to_dict(chunk[1]["messages"])
            return chunk

        if "messages" in chunk:
            i0, i1 = chunk[0], chunk[1]
            msg = i1[0]

            if isinstance(msg, ToolMessage):
                return (i0, (msg.model_dump(), i1[1] or None))

            if isinstance(msg, AIMessageChunk):
                stop = (
                    msg.response_metadata.get("finish_reason")
                    or msg.response_metadata.get("stop_reasoning")
                    or msg.response_metadata.get("stop_reason")
                )
                content = msg.content or msg.additional_kwargs.get("reasoning_content")
                if msg.tool_calls or msg.tool_call_chunks or stop or content:
                    return (i0, (msg.model_dump(), i1[1] or None))
                logger.warning(f"No content: {chunk}")
                return None

        logger.error(f"Invalid chunk: {chunk}")
    except Exception as e:
        logger.error(f"Error in handle_multi_mode: {e}")
    return None


async def stream_generator(
    params: LLMRequest,
    service_context: ServiceContext,
):
    async with get_checkpoint_db() as checkpointer:
        try:
            params.metadata.user_id = service_context.user_id
            agent = await construct_agent(
                params=params,
                checkpointer=checkpointer,
                store=service_context.store,
            )
            async for chunk in agent.astream(
                {"messages": params.to_langchain_messages()},
                stream_mode=["messages", "values"],
            ):
                # Serialize and yield each chunk as SSE
                stream_chunk = handle_multi_mode(chunk)
                if stream_chunk:
                    data = ujson.dumps(stream_chunk)
                    log_to_file(str(data), params.model) and APP_LOG_LEVEL == "DEBUG"
                    logger.debug(f"data: {str(data)}")
                    yield f"data: {data}\n\n"

        except Exception as e:
            # Yield error as SSE if streaming fails
            logger.exception("Error in event_generator: %s", e)
            # raise HTTPException(status_code=500, detail=str(e))
            error_msg = ujson.dumps(("error", str(e)))
            yield f"data: {error_msg}\n\n"
        finally:
            if service_context.user_id and checkpointer:
                final_state = await agent.aget_state()
                messages = final_state.values.get("messages")
                last_message = messages[-1] if messages else None
                if isinstance(last_message, AIMessage):
                    last_message.model = params.model
                    new_config = await agent.graph.aupdate_state(
                        config=final_state.config,
                        values={"messages": messages},
                    )
                    configurable = new_config.get("configurable")
                    thread_id = configurable.get("thread_id")
                    checkpoint_id = configurable.get("checkpoint_id")

                    if params.metadata.assistant_id:
                        service_context.thread_service.assistant_id = (
                            params.metadata.assistant_id
                        )

                    await service_context.thread_service.update(
                        thread_id=thread_id,
                        data={
                            "thread_id": thread_id,
                            "checkpoint_id": checkpoint_id,
                            "messages": [last_message.model_dump()],
                            "updated_at": get_time(),
                        },
                    )
                # Log the update for debugging
                logger.info(f"final_state Updated: {str(new_config)}")
