"""Integration tests for agent.astream output format.

Phase 2 TDD: Tests verifying agent.astream produces correct chunk format
and that handle_multi_mode correctly processes the output.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


class TestAgentStreamOutput:
    """Tests verifying agent.astream produces correct chunk format."""

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
    async def test_handle_multi_mode_processes_astream_output(self):
        """handle_multi_mode correctly processes agent.astream chunks."""
        from src.utils.stream import handle_multi_mode
        from langchain_core.messages import AIMessageChunk

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

        result = handle_multi_mode(chunk)

        assert result is not None
        assert result[0] == "messages"
        msg_dict, metadata = result[1]
        assert msg_dict["content"] == "Test response"
        assert metadata["ls_provider"] == "openai"

    @pytest.mark.asyncio
    async def test_stream_output_is_json_serializable(self):
        """handle_multi_mode output can be serialized to JSON."""
        import ujson
        from src.utils.stream import handle_multi_mode
        from langchain_core.messages import AIMessageChunk

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

    @pytest.mark.asyncio
    async def test_values_mode_chunk_serialization(self):
        """Values mode chunks can be serialized to JSON."""
        import ujson
        from src.utils.stream import handle_multi_mode
        from langchain_core.messages import HumanMessage, AIMessage

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

        result = handle_multi_mode(chunk)

        assert result is not None
        assert result[0] == "values"

        # Should be JSON serializable
        serialized = ujson.dumps(result)
        deserialized = ujson.loads(serialized)
        assert deserialized[0] == "values"
        assert "messages" in deserialized[1]
        assert "files" in deserialized[1]

    @pytest.mark.asyncio
    async def test_empty_ai_message_chunks_filtered(self):
        """Empty AIMessageChunks are filtered out by handle_multi_mode."""
        from src.utils.stream import handle_multi_mode
        from langchain_core.messages import AIMessageChunk

        # Empty chunk with no content, tool_calls, or stop reason
        chunk = (
            "messages",
            [
                AIMessageChunk(content="", id="empty"),
                {"thread_id": "123"},
            ],
        )

        result = handle_multi_mode(chunk)
        assert result is None

    @pytest.mark.asyncio
    async def test_tool_message_serialization(self):
        """ToolMessage chunks are properly serialized."""
        import ujson
        from src.utils.stream import handle_multi_mode
        from langchain_core.messages import ToolMessage

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

        result = handle_multi_mode(chunk)

        assert result is not None
        assert result[0] == "messages"

        # Verify it's JSON serializable
        serialized = ujson.dumps(result)
        deserialized = ujson.loads(serialized)
        assert deserialized[1][0]["type"] == "tool"

    @pytest.mark.asyncio
    async def test_streaming_pipeline_simulation(self):
        """Simulate the full streaming pipeline from agent to SSE."""
        import ujson
        from src.utils.stream import handle_multi_mode
        from langchain_core.messages import AIMessageChunk, HumanMessage

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
            result = handle_multi_mode(chunk)
            if result:
                # Simulate SSE formatting
                data = ujson.dumps(result)
                sse_event = f"data: {data}\n\n"
                processed.append(sse_event)

        # Should have 3 events (1 empty filtered out)
        assert len(processed) == 3
        assert all(event.startswith("data: ") for event in processed)
        assert all(event.endswith("\n\n") for event in processed)
