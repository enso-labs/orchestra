"""
StreamFormatter: Handles serialization of stream chunks to typed events.

This module separates formatting/serialization logic from stream orchestration,
making it independently testable.
"""

from typing import Any, Dict, Optional

from langchain_core.messages import AIMessageChunk, ToolMessage

from src.schemas.events.stream import (
    MessageEvent,
    StreamEventType,
    ValuesEvent,
)
from src.utils.logger import logger
from src.utils.messages import from_message_to_dict


class StreamFormatter:
    """
    Formats raw stream chunks into typed StreamEvent objects.

    The formatter handles the multi-mode stream format (messages + values)
    used by the LLM streaming endpoint.
    """

    @staticmethod
    def _to_dict(message: Any) -> Dict[str, Any]:
        """
        Convert a message to dict, handling both Pydantic models and plain dicts.

        Args:
            message: A message object (dict or Pydantic model)

        Returns:
            Dictionary representation of the message
        """
        if isinstance(message, dict):
            return message
        return message.model_dump()

    def format_messages_chunk(
        self,
        message: Any,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[MessageEvent]:
        """
        Format a messages-mode chunk into a MessageEvent.

        Handles AIMessageChunk and ToolMessage types, filtering out
        empty chunks that don't contain meaningful content.

        Args:
            message: The message to format (AIMessageChunk or ToolMessage)
            metadata: Optional metadata associated with the message

        Returns:
            MessageEvent if the message has content, None otherwise
        """
        if isinstance(message, ToolMessage):
            return MessageEvent(
                message=self._to_dict(message),
                metadata=metadata,
            )

        if isinstance(message, AIMessageChunk):
            # Check for stop conditions or content
            stop = (
                message.response_metadata.get("finish_reason")
                or message.response_metadata.get("stop_reasoning")
                or message.response_metadata.get("stop_reason")
            )
            content = message.content or message.additional_kwargs.get(
                "reasoning_content"
            )

            # Only emit event if there's meaningful content
            if message.tool_calls or message.tool_call_chunks or stop or content:
                return MessageEvent(
                    message=self._to_dict(message),
                    metadata=metadata,
                )

            logger.warning(f"No content in AIMessageChunk: {message}")
            return None

        logger.warning(f"Unexpected message type: {type(message)}")
        return None

    def format_values_chunk(
        self,
        values: Dict[str, Any],
    ) -> ValuesEvent:
        """
        Format a values-mode chunk into a ValuesEvent.

        Converts messages to dict format and extracts files/todos.

        Args:
            values: The values dictionary from the stream

        Returns:
            ValuesEvent with formatted messages, files, and todos
        """
        messages = values.get("messages", [])
        converted_messages = from_message_to_dict(messages)

        return ValuesEvent(
            messages=converted_messages,
            files=values.get("files"),
            todos=values.get("todos"),
            extra={
                k: v
                for k, v in values.items()
                if k not in ("messages", "files", "todos")
            }
            or None,
        )

    def format_chunk(
        self,
        chunk: Any,
    ) -> Optional[StreamEventType]:
        """
        Format a raw stream chunk into a typed StreamEvent.

        This method handles the multi-mode stream format where chunks
        are tuples of (mode_name, payload).

        Args:
            chunk: Raw chunk from agent.astream() with stream_mode=["messages", "values"]

        Returns:
            A StreamEvent (MessageEvent or ValuesEvent), or None if chunk should be skipped
        """
        try:
            # Multi-mode chunks are tuples: (mode_name, payload)
            if not isinstance(chunk, (tuple, list)) or len(chunk) != 2:
                logger.error(f"Invalid chunk format: {chunk}")
                return None

            mode_name, payload = chunk

            if mode_name == "values":
                return self.format_values_chunk(payload)

            if mode_name == "messages":
                # Messages payload is (message, metadata)
                if isinstance(payload, (tuple, list)) and len(payload) >= 1:
                    message = payload[0]
                    metadata = payload[1] if len(payload) > 1 else None
                    return self.format_messages_chunk(message, metadata)
                else:
                    logger.error(f"Invalid messages payload: {payload}")
                    return None

            logger.error(f"Unknown mode in chunk: {mode_name}")
            return None

        except Exception as e:
            logger.error(f"Error formatting chunk: {e}")
            return None


# Module-level instance for convenience
formatter = StreamFormatter()
