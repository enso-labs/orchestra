"""Unit tests for handle_multi_mode - verifies LangGraph stream format.

Phase 1 TDD: These tests verify the existing `handle_multi_mode` output format
before any distributed changes. The function is IMMUTABLE and should not be modified.
"""

import pytest
from langchain_core.messages import AIMessageChunk, ToolMessage, HumanMessage


class TestHandleMultiModeMessagesFormat:
    """Tests for messages mode output format."""

    def test_returns_tuple_for_ai_message_with_content(self):
        """AI message with content returns (stream_type, (message_dict, metadata))."""
        from src.utils.stream import handle_multi_mode

        chunk = (
            "messages",
            [
                AIMessageChunk(content="Hello", id="test-id"),
                {"user_id": "123", "thread_id": "456"},
            ],
        )

        result = handle_multi_mode(chunk)

        assert result is not None
        assert result[0] == "messages"
        assert isinstance(result[1], tuple)
        assert result[1][0]["content"] == "Hello"
        assert result[1][1]["user_id"] == "123"

    def test_returns_none_for_empty_ai_message(self):
        """AI message without content/tool_calls/stop returns None."""
        from src.utils.stream import handle_multi_mode

        chunk = (
            "messages",
            [
                AIMessageChunk(content="", id="test-id"),
                {"user_id": "123"},
            ],
        )

        result = handle_multi_mode(chunk)
        assert result is None

    def test_returns_tuple_for_tool_message(self):
        """ToolMessage returns serialized format."""
        from src.utils.stream import handle_multi_mode

        chunk = (
            "messages",
            [
                ToolMessage(content="Result", tool_call_id="call-123"),
                {"user_id": "123"},
            ],
        )

        result = handle_multi_mode(chunk)

        assert result is not None
        assert result[0] == "messages"
        assert result[1][0]["type"] == "tool"

    def test_returns_tuple_for_ai_message_with_tool_calls(self):
        """AI message with tool_calls returns tuple."""
        from src.utils.stream import handle_multi_mode

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

        result = handle_multi_mode(chunk)
        assert result is not None

    def test_returns_tuple_for_finish_reason(self):
        """AI message with finish_reason returns tuple."""
        from src.utils.stream import handle_multi_mode

        msg = AIMessageChunk(content="", id="test-id")
        msg.response_metadata = {"finish_reason": "stop"}

        chunk = ("messages", [msg, {"user_id": "123"}])

        result = handle_multi_mode(chunk)
        assert result is not None

    def test_returns_tuple_for_stop_reason(self):
        """AI message with stop_reason returns tuple."""
        from src.utils.stream import handle_multi_mode

        msg = AIMessageChunk(content="", id="test-id")
        msg.response_metadata = {"stop_reason": "end_turn"}

        chunk = ("messages", [msg, {"user_id": "123"}])

        result = handle_multi_mode(chunk)
        assert result is not None

    def test_returns_tuple_for_tool_call_chunks(self):
        """AI message with tool_call_chunks returns tuple."""
        from src.utils.stream import handle_multi_mode

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

        result = handle_multi_mode(chunk)
        assert result is not None


class TestHandleMultiModeValuesFormat:
    """Tests for values mode output format."""

    def test_returns_values_chunk_with_messages_converted(self):
        """Values mode chunks pass through with messages converted."""
        from src.utils.stream import handle_multi_mode

        chunk = (
            "values",
            {
                "messages": [HumanMessage(content="Hi")],
                "files": {},
                "todos": [],
            },
        )

        result = handle_multi_mode(chunk)

        assert result is not None
        assert result[0] == "values"
        # Messages should be converted to dicts
        assert isinstance(result[1]["messages"], list)


class TestHandleMultiModeEdgeCases:
    """Edge case tests for handle_multi_mode."""

    def test_handles_invalid_chunk_gracefully(self):
        """Invalid chunks return None without raising."""
        from src.utils.stream import handle_multi_mode

        result = handle_multi_mode({"invalid": "chunk"})
        assert result is None

    def test_handles_anthropic_reasoning_content(self):
        """Anthropic extended thinking with reasoning_content works."""
        from src.utils.stream import handle_multi_mode

        msg = AIMessageChunk(content="", id="test-id")
        msg.additional_kwargs = {"reasoning_content": "Thinking..."}

        chunk = ("messages", [msg, {"ls_provider": "anthropic"}])

        result = handle_multi_mode(chunk)
        assert result is not None

    def test_metadata_preserved_in_output(self):
        """Metadata from chunk is preserved in output."""
        from src.utils.stream import handle_multi_mode

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

        result = handle_multi_mode(chunk)

        assert result is not None
        assert result[1][1] == metadata

    def test_output_is_json_serializable(self):
        """handle_multi_mode output can be serialized to JSON."""
        import ujson
        from src.utils.stream import handle_multi_mode

        chunk = (
            "messages",
            [
                AIMessageChunk(content="Serializable", id="test"),
                {"thread_id": "123"},
            ],
        )

        result = handle_multi_mode(chunk)

        # Should not raise
        serialized = ujson.dumps(result)
        assert isinstance(serialized, str)

        # Should round-trip
        deserialized = ujson.loads(serialized)
        assert deserialized[0] == "messages"

    def test_values_with_empty_messages(self):
        """Values mode with empty messages list works."""
        from src.utils.stream import handle_multi_mode

        chunk = (
            "values",
            {
                "messages": [],
                "files": {},
                "todos": [],
            },
        )

        result = handle_multi_mode(chunk)

        assert result is not None
        assert result[0] == "values"
        assert result[1]["messages"] == []
