"""
Typed stream event models for SSE responses.

These events provide a consistent interface for serializing streaming
data to SSE format with predictable output.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Literal, Optional, Union

import ujson
from pydantic import BaseModel, Field


class StreamEvent(BaseModel, ABC):
    """Base class for all stream events."""

    @abstractmethod
    def to_sse(self) -> str:
        """
        Convert the event to SSE format.

        Returns:
            SSE-formatted string: "data: {...}\\n\\n"
        """
        pass


class MetadataEvent(StreamEvent):
    """
    Initial metadata event sent at the start of a stream.

    Contains identifiers for the current streaming session.
    """

    event_type: Literal["metadata"] = "metadata"
    thread_id: Optional[str] = Field(default=None, description="The thread ID")
    assistant_id: Optional[str] = Field(default=None, description="The assistant ID")
    project_id: Optional[str] = Field(default=None, description="The project ID")

    def to_sse(self) -> str:
        """Convert to SSE format as a tuple: ('metadata', {...})"""
        payload = {
            "thread_id": self.thread_id,
            "assistant_id": self.assistant_id,
            "project_id": self.project_id,
        }
        data = ujson.dumps(("metadata", payload))
        return f"data: {data}\n\n"


class MessageEvent(StreamEvent):
    """
    Message chunk event for streaming message content.

    Used for AIMessageChunk and ToolMessage chunks.
    """

    event_type: Literal["messages"] = "messages"
    message: Dict[str, Any] = Field(description="The message content as a dictionary")
    metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional metadata associated with the message chunk",
    )

    def to_sse(self) -> str:
        """Convert to SSE format as a tuple: ('messages', (message_dict, metadata))"""
        data = ujson.dumps(("messages", (self.message, self.metadata)))
        return f"data: {data}\n\n"


class ValuesEvent(StreamEvent):
    """
    Values event for streaming state values.

    Contains the full state snapshot including messages, files, and todos.
    """

    event_type: Literal["values"] = "values"
    messages: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="List of messages in the current state",
    )
    files: Optional[Dict[str, Any]] = Field(
        default=None,
        description="File system state (file path -> content)",
    )
    todos: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Todo list items",
    )
    extra: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Additional state values",
    )

    def to_sse(self) -> str:
        """Convert to SSE format as a tuple: ('values', {...})"""
        payload: Dict[str, Any] = {"messages": self.messages}
        if self.files is not None:
            payload["files"] = self.files
        if self.todos is not None:
            payload["todos"] = self.todos
        if self.extra is not None:
            payload.update(self.extra)
        data = ujson.dumps(("values", payload))
        return f"data: {data}\n\n"


class ErrorEvent(StreamEvent):
    """
    Error event for streaming errors.

    Sent when an error occurs during streaming.
    """

    event_type: Literal["error"] = "error"
    message: str = Field(description="The error message")
    code: Optional[str] = Field(
        default=None,
        description="Optional error code for categorization",
    )
    details: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional additional error details",
    )

    def to_sse(self) -> str:
        """Convert to SSE format as a tuple: ('error', message) or ('error', {...})"""
        # For backward compatibility, simple errors are just the message string
        if self.code is None and self.details is None:
            data = ujson.dumps(("error", self.message))
        else:
            payload: Dict[str, Any] = {"message": self.message}
            if self.code is not None:
                payload["code"] = self.code
            if self.details is not None:
                payload["details"] = self.details
            data = ujson.dumps(("error", payload))
        return f"data: {data}\n\n"


class DoneEvent(StreamEvent):
    """
    Done event marking the end of a stream.

    Sent as the final event when streaming completes.
    """

    event_type: Literal["done"] = "done"

    def to_sse(self) -> str:
        """Convert to SSE format: 'data: [DONE]\\n\\n'"""
        return "data: [DONE]\n\n"


# Type alias for any stream event
StreamEventType = Union[
    MetadataEvent,
    MessageEvent,
    ValuesEvent,
    ErrorEvent,
    DoneEvent,
]
