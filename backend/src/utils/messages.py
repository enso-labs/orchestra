from langchain_core.messages import (
    HumanMessage,
    BaseMessage,
    AIMessage,
    SystemMessage,
    ToolMessage,
)


def from_message_to_dict(messages, include_tool_calls: bool = True) -> list[dict]:
    # Convert API messages to LangChain message objects
    converted: list[dict] = []
    for message in messages:
        if not include_tool_calls and isinstance(message, ToolMessage):
            continue
        # Handle both Pydantic models and plain dicts
        if isinstance(message, dict):
            d = message
        else:
            d = message.model_dump()
        # Promote lc_agent_name → agent_name for frontend consumption
        if "lc_agent_name" in d and "agent_name" not in d:
            d["agent_name"] = d["lc_agent_name"]
        converted.append(d)
    return converted


def from_dict_to_message(messages) -> list[BaseMessage]:
    # Convert API messages to LangChain message objects
    converted: list[BaseMessage] = []
    for message in messages:
        role = message.role
        content = message.content
        if role == "user":
            converted.append(HumanMessage(content=content))
        elif role == "assistant":
            converted.append(AIMessage(content=content))
        elif role == "tool":
            converted.append(ToolMessage(content=content))
        elif role == "system":
            converted.append(SystemMessage(content=content))
        else:
            raise ValueError(f"Unsupported role: {role}")
    return converted
