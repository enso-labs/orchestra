"""Unit tests for StreamFormatter - verifies LangGraph stream format processing.

These tests verify StreamFormatter correctly processes agent.astream chunks
and returns typed StreamEvent objects.
"""

import pytest
import ujson
from langchain_core.messages import AIMessageChunk, HumanMessage, ToolMessage

from src.schemas.events.stream import MessageEvent, ValuesEvent
from src.utils.stream_formatter import StreamFormatter


class TestStreamFormatterMessagesFormat:
    """Tests for messages mode formatting."""

    @pytest.fixture
    def formatter(self):
        return StreamFormatter()

    def test_returns_message_event_for_ai_message_with_content(self, formatter):
        """AI message with content returns MessageEvent."""
        chunk = (
            "messages",
            [
                AIMessageChunk(content="Hello", id="test-id"),
                {"user_id": "123", "thread_id": "456"},
            ],
        )

        result = formatter.format_chunk(chunk)

        assert result is not None
        assert isinstance(result, MessageEvent)
        assert result.message["content"] == "Hello"
        assert result.metadata["user_id"] == "123"

    def test_returns_none_for_empty_ai_message(self, formatter):
        """AI message without content/tool_calls/stop returns None."""
        chunk = (
            "messages",
            [
                AIMessageChunk(content="", id="test-id"),
                {"user_id": "123"},
            ],
        )

        result = formatter.format_chunk(chunk)
        assert result is None

    def test_returns_message_event_for_tool_message(self, formatter):
        """ToolMessage returns MessageEvent."""
        chunk = (
            "messages",
            [
                ToolMessage(content="Result", tool_call_id="call-123"),
                {"user_id": "123"},
            ],
        )

        result = formatter.format_chunk(chunk)

        assert result is not None
        assert isinstance(result, MessageEvent)
        assert result.message["type"] == "tool"

    def test_returns_message_event_for_ai_message_with_tool_calls(self, formatter):
        """AI message with tool_calls returns MessageEvent."""
        chunk = (
            "messages",
            [
                AIMessageChunk(
                    content="",
                    id="test-id",
                    tool_calls=[{"name": "search", "args": {}, "id": "call-1"}],
                ),
                {"user_id": "123"},
            ],
        )

        result = formatter.format_chunk(chunk)
        assert result is not None
        assert isinstance(result, MessageEvent)

    def test_returns_message_event_for_finish_reason(self, formatter):
        """AI message with finish_reason returns MessageEvent."""
        msg = AIMessageChunk(content="", id="test-id")
        msg.response_metadata = {"finish_reason": "stop"}

        chunk = ("messages", [msg, {"user_id": "123"}])

        result = formatter.format_chunk(chunk)
        assert result is not None
        assert isinstance(result, MessageEvent)

    def test_returns_message_event_for_stop_reason(self, formatter):
        """AI message with stop_reason returns MessageEvent."""
        msg = AIMessageChunk(content="", id="test-id")
        msg.response_metadata = {"stop_reason": "end_turn"}

        chunk = ("messages", [msg, {"user_id": "123"}])

        result = formatter.format_chunk(chunk)
        assert result is not None
        assert isinstance(result, MessageEvent)

    def test_returns_message_event_for_tool_call_chunks(self, formatter):
        """AI message with tool_call_chunks returns MessageEvent."""
        chunk = (
            "messages",
            [
                AIMessageChunk(
                    content="",
                    id="test-id",
                    tool_call_chunks=[
                        {"name": "search", "args": "{}", "id": "call-1", "index": 0}
                    ],
                ),
                {"user_id": "123"},
            ],
        )

        result = formatter.format_chunk(chunk)
        assert result is not None
        assert isinstance(result, MessageEvent)


class TestStreamFormatterValuesFormat:
    """Tests for values mode formatting."""

    @pytest.fixture
    def formatter(self):
        return StreamFormatter()

    def test_returns_values_event_with_messages_converted(self, formatter):
        """Values mode chunks return ValuesEvent with messages converted."""
        chunk = (
            "values",
            {
                "messages": [HumanMessage(content="Hi")],
                "files": {},
                "todos": [],
            },
        )

        result = formatter.format_chunk(chunk)

        assert result is not None
        assert isinstance(result, ValuesEvent)
        # Messages should be converted to dicts
        assert isinstance(result.messages, list)
        assert len(result.messages) == 1
        assert result.messages[0]["content"] == "Hi"


class TestStreamFormatterEdgeCases:
    """Edge case tests for StreamFormatter."""

    @pytest.fixture
    def formatter(self):
        return StreamFormatter()

    def test_handles_invalid_chunk_gracefully(self, formatter):
        """Invalid chunks return None without raising."""
        result = formatter.format_chunk({"invalid": "chunk"})
        assert result is None

    def test_handles_anthropic_reasoning_content(self, formatter):
        """Anthropic extended thinking with reasoning_content works."""
        msg = AIMessageChunk(content="", id="test-id")
        msg.additional_kwargs = {"reasoning_content": "Thinking..."}

        chunk = ("messages", [msg, {"ls_provider": "anthropic"}])

        result = formatter.format_chunk(chunk)
        assert result is not None
        assert isinstance(result, MessageEvent)

    def test_metadata_preserved_in_output(self, formatter):
        """Metadata from chunk is preserved in MessageEvent."""
        metadata = {
            "user_id": "user-123",
            "thread_id": "thread-456",
            "langgraph_step": 5,
            "ls_provider": "openai",
        }
        chunk = (
            "messages",
            [
                AIMessageChunk(content="Test", id="test-id"),
                metadata,
            ],
        )

        result = formatter.format_chunk(chunk)

        assert result is not None
        assert isinstance(result, MessageEvent)
        assert result.metadata == metadata

    def test_output_is_json_serializable(self, formatter):
        """StreamEvent output can be serialized to JSON via to_sse()."""
        chunk = (
            "messages",
            [
                AIMessageChunk(content="Serializable", id="test"),
                {"thread_id": "123"},
            ],
        )

        result = formatter.format_chunk(chunk)

        # to_sse() should not raise
        sse_output = result.to_sse()
        assert isinstance(sse_output, str)
        assert sse_output.startswith("data: ")
        assert sse_output.endswith("\n\n")

        # Parse the SSE data
        data_str = sse_output[6:-2]  # Remove "data: " prefix and "\n\n" suffix
        parsed = ujson.loads(data_str)
        assert parsed[0] == "messages"

    def test_values_with_empty_messages(self, formatter):
        """Values mode with empty messages list works."""
        chunk = (
            "values",
            {
                "messages": [],
                "files": {},
                "todos": [],
            },
        )

        result = formatter.format_chunk(chunk)

        assert result is not None
        assert isinstance(result, ValuesEvent)
        assert result.messages == []
