from langchain_core.messages import (
    AnyMessage,
    HumanMessage,
    BaseMessage,
    AIMessage,
    SystemMessage,
    ToolMessage,
)
from src.utils.format import get_base64_image


def construct_messages(
    query: str, images: list[str] = None, base64_encode: bool = False
) -> list[AnyMessage]:
    # Create message content based on whether images are present
    if images:
        content = [{"type": "text", "text": query}]

        for image in images:
            if base64_encode:
                encoded_image = get_base64_image(image)
                if encoded_image:  # Only add if encoding was successful
                    content.append(
                        {
                            "type": "image_url",
                            "image_url": {"url": encoded_image, "detail": "auto"},
                        }
                    )
            else:
                content.append(
                    {"type": "image_url", "image_url": {"url": image, "detail": "auto"}}
                )
    else:
        content = query

    messages = [HumanMessage(content=content)]
    return messages


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
