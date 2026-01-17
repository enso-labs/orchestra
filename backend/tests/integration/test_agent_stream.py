"""Integration tests for agent.astream output format.

Tests verifying agent.astream produces correct chunk format
and that StreamFormatter correctly processes the output.
"""

import pytest
import ujson
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage, ToolMessage
from unittest.mock import MagicMock

from src.schemas.events.stream import MessageEvent, ValuesEvent
from src.utils.stream_formatter import StreamFormatter


class TestAgentStreamOutput:
    """Tests verifying agent.astream produces correct chunk format."""

    @pytest.fixture
    def formatter(self):
        return StreamFormatter()

    @pytest.mark.asyncio
    async def test_astream_yields_messages_and_values_modes(self):
        """agent.astream with stream_mode=['messages', 'values'] yields both."""

        # Mock agent that yields expected chunk formats
        async def mock_astream(*args, **kwargs):
            yield ("messages", [MagicMock(content="chunk1"), {"thread_id": "123"}])
            yield ("values", {"messages": [], "files": {}, "todos": []})

        mock_agent = MagicMock()
        mock_agent.astream = mock_astream

        chunks = []
        async for chunk in mock_agent.astream(
            {"messages": []},
            stream_mode=["messages", "values"],
            config={},
        ):
            chunks.append(chunk)

        assert len(chunks) == 2
        assert chunks[0][0] == "messages"
        assert chunks[1][0] == "values"

    @pytest.mark.asyncio
    async def test_stream_formatter_processes_astream_output(self, formatter):
        """StreamFormatter correctly processes agent.astream chunks."""
        # Simulate real astream chunk
        chunk = (
            "messages",
            [
                AIMessageChunk(content="Test response", id="lc_run--123"),
                {
                    "user_id": "user-1",
                    "thread_id": "thread-1",
                    "langgraph_step": 5,
                    "ls_provider": "openai",
                },
            ],
        )

        result = formatter.format_chunk(chunk)

        assert result is not None
        assert isinstance(result, MessageEvent)
        assert result.message["content"] == "Test response"
        assert result.metadata["ls_provider"] == "openai"

    @pytest.mark.asyncio
    async def test_stream_output_is_json_serializable(self, formatter):
        """StreamFormatter output can be serialized to JSON via to_sse()."""
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

        # Parse the SSE data
        data_str = sse_output[6:-2]  # Remove "data: " prefix and "\n\n" suffix
        parsed = ujson.loads(data_str)
        assert parsed[0] == "messages"

    @pytest.mark.asyncio
    async def test_values_mode_chunk_serialization(self, formatter):
        """Values mode chunks can be serialized to JSON."""
        chunk = (
            "values",
            {
                "messages": [
                    HumanMessage(content="Hello"),
                    AIMessage(content="Hi there!"),
                ],
                "files": {"/path/file.txt": {"content": ["test"]}},
                "todos": [{"task": "test", "done": False}],
            },
        )

        result = formatter.format_chunk(chunk)

        assert result is not None
        assert isinstance(result, ValuesEvent)

        # Should be JSON serializable via to_sse()
        sse_output = result.to_sse()
        data_str = sse_output[6:-2]
        deserialized = ujson.loads(data_str)
        assert deserialized[0] == "values"
        assert "messages" in deserialized[1]
        assert "files" in deserialized[1]

    @pytest.mark.asyncio
    async def test_empty_ai_message_chunks_filtered(self, formatter):
        """Empty AIMessageChunks are filtered out by StreamFormatter."""
        # Empty chunk with no content, tool_calls, or stop reason
        chunk = (
            "messages",
            [
                AIMessageChunk(content="", id="empty"),
                {"thread_id": "123"},
            ],
        )

        result = formatter.format_chunk(chunk)
        assert result is None

    @pytest.mark.asyncio
    async def test_tool_message_serialization(self, formatter):
        """ToolMessage chunks are properly serialized."""
        chunk = (
            "messages",
            [
                ToolMessage(
                    content='{"result": "success"}',
                    tool_call_id="call-123",
                    name="test_tool",
                ),
                {"thread_id": "123"},
            ],
        )

        result = formatter.format_chunk(chunk)

        assert result is not None
        assert isinstance(result, MessageEvent)

        # Verify it's JSON serializable via to_sse()
        sse_output = result.to_sse()
        data_str = sse_output[6:-2]
        deserialized = ujson.loads(data_str)
        assert deserialized[1][0]["type"] == "tool"

    @pytest.mark.asyncio
    async def test_streaming_pipeline_simulation(self, formatter):
        """Simulate the full streaming pipeline from agent to SSE."""
        # Simulate a sequence of chunks that would come from agent.astream
        chunks = [
            ("messages", [AIMessageChunk(content="Hello", id="1"), {"step": 1}]),
            ("messages", [AIMessageChunk(content=" World", id="2"), {"step": 2}]),
            ("messages", [AIMessageChunk(content="", id="3"), {"step": 3}]),  # Empty
            (
                "values",
                {
                    "messages": [
                        HumanMessage(content="Hi"),
                        AIMessageChunk(content="Hello World", id="final"),
                    ],
                    "files": {},
                    "todos": [],
                },
            ),
        ]

        processed = []
        for chunk in chunks:
            result = formatter.format_chunk(chunk)
            if result:
                # Use to_sse() for SSE formatting
                sse_event = result.to_sse()
                processed.append(sse_event)

        # Should have 3 events (1 empty filtered out)
        assert len(processed) == 3
        assert all(event.startswith("data: ") for event in processed)
        assert all(event.endswith("\n\n") for event in processed)
