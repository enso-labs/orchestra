from langchain_core.messages import (
    HumanMessage,
    BaseMessage,
    AIMessage,
    SystemMessage,
    ToolMessage,
)


def from_langchain_messages_to_dict(messages: list[BaseMessage]) -> list[dict]:
    # Convert API messages to LangChain message objects
    converted: list[dict] = []
    for message in messages:
        converted.append(message.model_dump())
    return converted


def from_dict_to_langchain_messages(messages: list[dict]) -> list[BaseMessage]:
    # Convert API messages to LangChain message objects
    converted: list[BaseMessage] = []
    for message in messages:
        role = message.get("role")
        if role == "user":
            converted.append(HumanMessage(**message))
        elif role == "assistant":
            converted.append(AIMessage(**message))
        elif role == "system":
            converted.append(SystemMessage(**message))
        elif role == "tool":
            converted.append(ToolMessage(**message))
        else:
            raise ValueError(f"Unsupported role: {role}")
    return converted
