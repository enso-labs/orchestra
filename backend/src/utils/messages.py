from langchain_core.messages import (
    HumanMessage,
    BaseMessage,
    AIMessage,
    SystemMessage,
    ToolMessage,
)


def from_message_to_dict(messages) -> list[BaseMessage]:
    # Convert API messages to LangChain message objects
    converted: list[dict] = []
    for message in messages:
        converted.append(message.model_dump())
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
        elif role == "system":
            converted.append(SystemMessage(content=content))
        elif role == "tool":
            converted.append(ToolMessage(content=content))
        else:
            raise ValueError(f"Unsupported role: {role}")
    return converted
