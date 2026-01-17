"""Unit tests for StreamFormatter - verifies LangGraph stream format processing.

These tests verify StreamFormatter correctly processes agent.astream chunks
and returns typed StreamEvent objects.

Acceptance Criteria Coverage:
- Test message chunk formatting (AIMessageChunk, ToolMessage)
- Test values chunk formatting (files, todos, messages)
- Test edge cases (empty content, missing fields)
"""

import pytest
import ujson
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage, ToolMessage

from src.schemas.events.stream import MessageEvent, ValuesEvent
from src.utils.stream_formatter import StreamFormatter


class TestStreamFormatterMessagesFormat:
    """Tests for messages mode formatting - AIMessageChunk and ToolMessage handling."""

    @pytest.fixture
    def formatter(self):
        return StreamFormatter()

    # --- AIMessageChunk Tests ---

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
        assert result.metadata is not None
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

    def test_returns_message_event_for_stop_reasoning(self, formatter):
        """AI message with stop_reasoning returns MessageEvent."""
        msg = AIMessageChunk(content="", id="test-id")
        msg.response_metadata = {"stop_reasoning": "done"}

        chunk = ("messages", [msg, {"user_id": "123"}])

        result = formatter.format_chunk(chunk)
        assert result is not None
        assert isinstance(result, MessageEvent)

    def test_handles_anthropic_reasoning_content(self, formatter):
        """Anthropic extended thinking with reasoning_content works."""
        msg = AIMessageChunk(content="", id="test-id")
        msg.additional_kwargs = {"reasoning_content": "Thinking..."}

        chunk = ("messages", [msg, {"ls_provider": "anthropic"}])

        result = formatter.format_chunk(chunk)
        assert result is not None
        assert isinstance(result, MessageEvent)

    # --- ToolMessage Tests ---

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

    def test_tool_message_with_json_string_content(self, formatter):
        """ToolMessage with JSON string content is handled correctly."""
        json_content = '{"result": "success", "data": [1, 2, 3]}'
        chunk = (
            "messages",
            [
                ToolMessage(
                    content=json_content,
                    tool_call_id="call-456",
                ),
                {"user_id": "123"},
            ],
        )

        result = formatter.format_chunk(chunk)

        assert result is not None
        assert isinstance(result, MessageEvent)
        assert result.message["content"] == json_content

    def test_tool_message_preserves_tool_call_id(self, formatter):
        """ToolMessage preserves tool_call_id in output."""
        chunk = (
            "messages",
            [
                ToolMessage(content="Done", tool_call_id="call-789"),
                None,
            ],
        )

        result = formatter.format_chunk(chunk)

        assert result is not None
        assert isinstance(result, MessageEvent)
        assert result.message["tool_call_id"] == "call-789"

    # --- Metadata Tests ---

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

    def test_metadata_can_be_none(self, formatter):
        """Message event handles None metadata gracefully."""
        chunk = (
            "messages",
            [
                AIMessageChunk(content="Test", id="test-id"),
                None,
            ],
        )

        result = formatter.format_chunk(chunk)

        assert result is not None
        assert isinstance(result, MessageEvent)
        assert result.metadata is None


class TestStreamFormatterValuesFormat:
    """Tests for values mode formatting - files, todos, messages."""

    @pytest.fixture
    def formatter(self):
        return StreamFormatter()

    # --- Messages Tests ---

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

    def test_values_with_multiple_message_types(self, formatter):
        """Values mode handles mixed message types."""
        chunk = (
            "values",
            {
                "messages": [
                    HumanMessage(content="Hello"),
                    AIMessage(content="Hi there!"),
                    ToolMessage(content="Result", tool_call_id="call-1"),
                ],
            },
        )

        result = formatter.format_chunk(chunk)

        assert result is not None
        assert isinstance(result, ValuesEvent)
        assert len(result.messages) == 3
        assert result.messages[0]["type"] == "human"
        assert result.messages[1]["type"] == "ai"
        assert result.messages[2]["type"] == "tool"

    def test_values_with_dict_messages(self, formatter):
        """Values mode handles pre-converted dict messages."""
        chunk = (
            "values",
            {
                "messages": [
                    {"type": "human", "content": "Hello"},
                    {"type": "ai", "content": "Hi!"},
                ],
            },
        )

        result = formatter.format_chunk(chunk)

        assert result is not None
        assert isinstance(result, ValuesEvent)
        assert len(result.messages) == 2
        assert result.messages[0]["content"] == "Hello"
        assert result.messages[1]["content"] == "Hi!"

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

    # --- Files Tests ---

    def test_values_with_files_dict(self, formatter):
        """Values mode extracts files dictionary correctly."""
        files_data = {
            "src/main.py": "print('hello')",
            "src/utils.py": "def helper(): pass",
        }
        chunk = (
            "values",
            {
                "messages": [],
                "files": files_data,
            },
        )

        result = formatter.format_chunk(chunk)

        assert result is not None
        assert isinstance(result, ValuesEvent)
        assert result.files == files_data
        assert result.files is not None
        assert result.files["src/main.py"] == "print('hello')"

    def test_values_with_empty_files(self, formatter):
        """Values mode with empty files dict works."""
        chunk = (
            "values",
            {
                "messages": [],
                "files": {},
            },
        )

        result = formatter.format_chunk(chunk)

        assert result is not None
        assert isinstance(result, ValuesEvent)
        assert result.files == {}

    def test_values_with_none_files(self, formatter):
        """Values mode with None files works."""
        chunk = (
            "values",
            {
                "messages": [],
                "files": None,
            },
        )

        result = formatter.format_chunk(chunk)

        assert result is not None
        assert isinstance(result, ValuesEvent)
        assert result.files is None

    def test_values_without_files_key(self, formatter):
        """Values mode without files key returns None for files."""
        chunk = (
            "values",
            {
                "messages": [],
            },
        )

        result = formatter.format_chunk(chunk)

        assert result is not None
        assert isinstance(result, ValuesEvent)
        assert result.files is None

    # --- Todos Tests ---

    def test_values_with_todos_list(self, formatter):
        """Values mode extracts todos list correctly."""
        todos_data = [
            {"id": "1", "title": "Task 1", "completed": False},
            {"id": "2", "title": "Task 2", "completed": True},
        ]
        chunk = (
            "values",
            {
                "messages": [],
                "todos": todos_data,
            },
        )

        result = formatter.format_chunk(chunk)

        assert result is not None
        assert isinstance(result, ValuesEvent)
        assert result.todos == todos_data
        assert result.todos is not None
        assert len(result.todos) == 2
        assert result.todos[0]["title"] == "Task 1"
        assert result.todos[1]["completed"] is True

    def test_values_with_empty_todos(self, formatter):
        """Values mode with empty todos list works."""
        chunk = (
            "values",
            {
                "messages": [],
                "todos": [],
            },
        )

        result = formatter.format_chunk(chunk)

        assert result is not None
        assert isinstance(result, ValuesEvent)
        assert result.todos == []

    def test_values_with_none_todos(self, formatter):
        """Values mode with None todos works."""
        chunk = (
            "values",
            {
                "messages": [],
                "todos": None,
            },
        )

        result = formatter.format_chunk(chunk)

        assert result is not None
        assert isinstance(result, ValuesEvent)
        assert result.todos is None

    def test_values_without_todos_key(self, formatter):
        """Values mode without todos key returns None for todos."""
        chunk = (
            "values",
            {
                "messages": [],
            },
        )

        result = formatter.format_chunk(chunk)

        assert result is not None
        assert isinstance(result, ValuesEvent)
        assert result.todos is None

    # --- Extra Fields Tests ---

    def test_values_with_extra_fields(self, formatter):
        """Values mode captures extra fields beyond messages/files/todos."""
        chunk = (
            "values",
            {
                "messages": [],
                "files": {},
                "todos": [],
                "custom_state": {"key": "value"},
                "counter": 42,
            },
        )

        result = formatter.format_chunk(chunk)

        assert result is not None
        assert isinstance(result, ValuesEvent)
        assert result.extra is not None
        assert result.extra["custom_state"] == {"key": "value"}
        assert result.extra["counter"] == 42

    def test_values_without_extra_fields(self, formatter):
        """Values mode with only standard fields returns None for extra."""
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
        assert result.extra is None


class TestStreamFormatterEdgeCases:
    """Edge case tests for StreamFormatter - missing fields, invalid input."""

    @pytest.fixture
    def formatter(self):
        return StreamFormatter()

    # --- Invalid Chunk Format Tests ---

    def test_handles_invalid_chunk_gracefully(self, formatter):
        """Invalid chunks return None without raising."""
        result = formatter.format_chunk({"invalid": "chunk"})
        assert result is None

    def test_handles_single_element_tuple(self, formatter):
        """Single-element tuple returns None."""
        result = formatter.format_chunk(("messages",))
        assert result is None

    def test_handles_triple_element_tuple(self, formatter):
        """Three-element tuple returns None."""
        result = formatter.format_chunk(("messages", [], "extra"))
        assert result is None

    def test_handles_empty_tuple(self, formatter):
        """Empty tuple returns None."""
        result = formatter.format_chunk(())
        assert result is None

    def test_handles_none_chunk(self, formatter):
        """None chunk returns None without raising."""
        result = formatter.format_chunk(None)
        assert result is None

    def test_handles_string_chunk(self, formatter):
        """String chunk returns None."""
        result = formatter.format_chunk("not a tuple")
        assert result is None

    def test_handles_integer_chunk(self, formatter):
        """Integer chunk returns None."""
        result = formatter.format_chunk(12345)
        assert result is None

    # --- Unknown Mode Tests ---

    def test_handles_unknown_mode(self, formatter):
        """Unknown mode name returns None."""
        chunk = ("unknown_mode", {"data": "test"})
        result = formatter.format_chunk(chunk)
        assert result is None

    def test_handles_empty_mode_name(self, formatter):
        """Empty mode name returns None."""
        chunk = ("", {"data": "test"})
        result = formatter.format_chunk(chunk)
        assert result is None

    # --- Invalid Messages Payload Tests ---

    def test_handles_invalid_messages_payload(self, formatter):
        """Invalid messages payload returns None."""
        chunk = ("messages", "not-a-list")
        result = formatter.format_chunk(chunk)
        assert result is None

    def test_handles_empty_messages_payload(self, formatter):
        """Empty messages payload returns None."""
        chunk = ("messages", [])
        result = formatter.format_chunk(chunk)
        assert result is None

    def test_handles_none_messages_payload(self, formatter):
        """None messages payload returns None."""
        chunk = ("messages", None)
        result = formatter.format_chunk(chunk)
        assert result is None

    # --- Unexpected Message Type Tests ---

    def test_handles_unexpected_message_type(self, formatter):
        """Non-AI/Tool message types return None."""
        chunk = (
            "messages",
            [
                HumanMessage(content="Hi"),  # HumanMessage is not expected here
                {"user_id": "123"},
            ],
        )

        result = formatter.format_chunk(chunk)
        assert result is None

    def test_handles_dict_message_in_messages_mode(self, formatter):
        """Dict message in messages mode returns None (not a valid message type)."""
        chunk = (
            "messages",
            [
                {"type": "ai", "content": "test"},  # Raw dict, not AIMessageChunk
                {"user_id": "123"},
            ],
        )

        result = formatter.format_chunk(chunk)
        assert result is None

    # --- SSE Output Format Tests ---

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

    def test_values_output_is_json_serializable(self, formatter):
        """ValuesEvent output can be serialized to JSON via to_sse()."""
        chunk = (
            "values",
            {
                "messages": [HumanMessage(content="Test")],
                "files": {"file.txt": "content"},
                "todos": [{"id": "1", "title": "Task"}],
            },
        )

        result = formatter.format_chunk(chunk)

        sse_output = result.to_sse()
        assert isinstance(sse_output, str)
        assert sse_output.startswith("data: ")
        assert sse_output.endswith("\n\n")

        data_str = sse_output[6:-2]
        parsed = ujson.loads(data_str)
        assert parsed[0] == "values"
        assert "messages" in parsed[1]
        assert "files" in parsed[1]
        assert "todos" in parsed[1]


class TestStreamFormatterDirectMethods:
    """Tests for direct method calls on StreamFormatter."""

    @pytest.fixture
    def formatter(self):
        return StreamFormatter()

    # --- format_messages_chunk Tests ---

    def test_format_messages_chunk_with_ai_message(self, formatter):
        """Direct call to format_messages_chunk with AIMessageChunk."""
        msg = AIMessageChunk(content="Hello", id="test-id")
        result = formatter.format_messages_chunk(msg, {"user_id": "123"})

        assert result is not None
        assert isinstance(result, MessageEvent)
        assert result.message["content"] == "Hello"

    def test_format_messages_chunk_with_tool_message(self, formatter):
        """Direct call to format_messages_chunk with ToolMessage."""
        msg = ToolMessage(content="Result", tool_call_id="call-1")
        result = formatter.format_messages_chunk(msg)

        assert result is not None
        assert isinstance(result, MessageEvent)
        assert result.message["type"] == "tool"
        assert result.metadata is None

    def test_format_messages_chunk_with_invalid_type(self, formatter):
        """Direct call to format_messages_chunk with invalid type returns None."""
        result = formatter.format_messages_chunk("not a message")
        assert result is None

    # --- format_values_chunk Tests ---

    def test_format_values_chunk_with_all_fields(self, formatter):
        """Direct call to format_values_chunk with all standard fields."""
        values = {
            "messages": [HumanMessage(content="Hi")],
            "files": {"file.py": "code"},
            "todos": [{"id": "1"}],
        }
        result = formatter.format_values_chunk(values)

        assert isinstance(result, ValuesEvent)
        assert len(result.messages) == 1
        assert result.files == {"file.py": "code"}
        assert result.todos == [{"id": "1"}]

    def test_format_values_chunk_with_missing_messages(self, formatter):
        """Direct call to format_values_chunk without messages key."""
        values = {
            "files": {"file.py": "code"},
        }
        result = formatter.format_values_chunk(values)

        assert isinstance(result, ValuesEvent)
        assert result.messages == []

    # --- _to_dict Tests ---

    def test_to_dict_with_pydantic_model(self, formatter):
        """_to_dict converts Pydantic models correctly."""
        msg = HumanMessage(content="Test")
        result = formatter._to_dict(msg)

        assert isinstance(result, dict)
        assert result["content"] == "Test"
        assert result["type"] == "human"

    def test_to_dict_with_dict(self, formatter):
        """_to_dict passes through dicts unchanged."""
        data = {"key": "value", "nested": {"inner": True}}
        result = formatter._to_dict(data)

        assert result is data  # Should be same object
        assert result["key"] == "value"


class TestModuleLevelInstance:
    """Tests for module-level formatter instance."""

    def test_module_instance_exists(self):
        """Module exposes a formatter instance."""
        from src.utils.stream_formatter import formatter

        assert isinstance(formatter, StreamFormatter)

    def test_module_instance_is_usable(self):
        """Module-level formatter instance works correctly."""
        from src.utils.stream_formatter import formatter

        chunk = (
            "messages",
            [
                AIMessageChunk(content="Using module instance", id="test"),
                None,
            ],
        )

        result = formatter.format_chunk(chunk)

        assert result is not None
        assert isinstance(result, MessageEvent)
        assert result.message["content"] == "Using module instance"
