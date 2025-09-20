from typing import List
from langgraph.types import StreamMode
from src.utils.messages import from_message_to_dict
from langchain_core.messages import (
    AIMessageChunk,
    ToolMessage,
    BaseMessage,
    BaseMessageChunk,
)
from src.utils.logger import logger


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


def handle_stream_variance(chunk: dict):
    if "values" in chunk:
        chunk[1]["messages"] = from_message_to_dict(chunk[1]["messages"])
        return chunk
    if "messages" in chunk:
        # content_type = type(chunk[1][0])
        content = chunk[1][0].content
        reasoning_content = chunk[1][0].additional_kwargs.get("reasoning_content", "")
        if content or reasoning_content:
            # print(f"{content_type}: {content or reasoning_content}")
            return chunk


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


# def handle_multi_mode(chunk: dict):
#     try:
#         if 'values' in chunk:
#             chunk[1]['messages'] = from_message_to_dict(chunk[1]['messages'])
#             return chunk
#         if 'messages' in chunk:
#             message: BaseMessage|BaseMessageChunk = chunk[1][0]
#             if isinstance(message, ToolMessage):
#                 return message.model_dump()
#             if isinstance(message, AIMessageChunk):

#                 stop_reason = message.response_metadata.get('finish_reason') \
#                     or message.response_metadata.get('finish_reason')

#                 # Tool Input
#                 if message.tool_calls or message.tool_call_chunks or stop_reason:
#                     return (chunk[0], (chunk[1][0].model_dump(), chunk[1][1] if chunk[1][1] else None))

#                 # Final Content
#                 content = message.content
#                 reasoning_content = message.additional_kwargs.get('reasoning_content', "")
#                 if content or reasoning_content:
#                     return (chunk[0], (chunk[1][0].model_dump(), chunk[1][1] if chunk[1][1] else None))
#                 else:
#                     logger.warning(f"No content: {chunk}")
#                     return None

#         logger.error(f"Invalid chunk: {chunk}")
#         return None
#     except Exception as e:
#         logger.error(f"Error in handle_multi_mode: {e}")
#         return None


def handle_multi_mode(chunk: dict):
    try:
        if "values" in chunk:
            chunk[1]["messages"] = from_message_to_dict(chunk[1]["messages"])
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
