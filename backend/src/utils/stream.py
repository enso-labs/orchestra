from typing import List
from langgraph.types import StreamMode


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
