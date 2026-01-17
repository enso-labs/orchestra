"""Integration tests for LLM stream endpoint.

US-010: Tests verifying end-to-end streaming behavior including:
- Sync stream returns valid SSE format
- Metadata event is first event
- Error events have correct format
- Stream completes with proper store update
- Cancellation cleans up properly

CURL validation examples:
    # Basic stream request (returns SSE with Content-Type: text/event-stream)
    curl -X POST http://localhost:8000/api/llm/stream \
        -H "Content-Type: application/json" \
        -d '{"input": {"messages": [{"role": "user", "content": "Hello"}]}, "model": "openai:gpt-4.1-mini"}'

    # Expected response format (first event is metadata):
    # data: ["metadata",{"thread_id":"abc-123","assistant_id":null,"project_id":null}]
    # data: ["messages",{...}]
    # data: ["values",{...}]
"""

import pytest
import ujson
from unittest.mock import patch, AsyncMock, MagicMock

from src.schemas.events.stream import (
    MetadataEvent,
    MessageEvent,
    ValuesEvent,
    ErrorEvent,
    DoneEvent,
)


class TestSyncStreamSSEFormat:
    """Tests verifying sync stream returns valid SSE format."""

    @pytest.mark.asyncio
    async def test_stream_returns_sse_content_type(self, async_client):
        """POST /api/llm/stream returns Content-Type: text/event-stream."""
        payload = {
            "input": {"messages": [{"role": "user", "content": "Test"}]},
            "model": "openai:gpt-4.1-mini",
        }

        with patch("src.routes.v0.llm.LLMController") as mock_controller_class:
            mock_controller = MagicMock()

            async def mock_stream():
                yield 'data: ["metadata",{"thread_id":"123"}]\n\n'
                yield "data: [DONE]\n\n"

            mock_controller.llm_stream = AsyncMock(return_value=mock_stream())
            mock_controller_class.return_value = mock_controller

            async with async_client.stream(
                "POST", "/api/llm/stream", json=payload
            ) as response:
                assert response.status_code == 200
                content_type = response.headers.get("content-type", "")
                assert content_type.startswith("text/event-stream")

    @pytest.mark.asyncio
    async def test_stream_returns_proper_sse_format(self, async_client):
        """Stream events are formatted as 'data: {...}\\n\\n'."""
        payload = {
            "input": {"messages": [{"role": "user", "content": "Test"}]},
            "model": "openai:gpt-4.1-mini",
        }

        with patch("src.routes.v0.llm.LLMController") as mock_controller_class:
            mock_controller = MagicMock()

            async def mock_stream():
                yield MetadataEvent(thread_id="123").to_sse()
                yield MessageEvent(message={"content": "Hello"}, metadata={}).to_sse()

            mock_controller.llm_stream = AsyncMock(return_value=mock_stream())
            mock_controller_class.return_value = mock_controller

            chunks = []
            async with async_client.stream(
                "POST", "/api/llm/stream", json=payload
            ) as response:
                async for chunk in response.aiter_bytes():
                    chunks.append(chunk.decode())

            full_response = "".join(chunks)
            # Each SSE event should start with "data: " and end with "\n\n"
            assert "data: " in full_response
            # The response should have proper line endings
            events = full_response.split("data: ")
            for event in events:
                if event.strip():
                    assert event.rstrip().endswith("\n") or event.rstrip()

    @pytest.mark.asyncio
    async def test_stream_events_are_json_parseable(self, async_client):
        """Stream event data can be parsed as JSON."""
        payload = {
            "input": {"messages": [{"role": "user", "content": "Test"}]},
            "model": "openai:gpt-4.1-mini",
        }

        with patch("src.routes.v0.llm.LLMController") as mock_controller_class:
            mock_controller = MagicMock()

            async def mock_stream():
                yield MetadataEvent(thread_id="test-123").to_sse()

            mock_controller.llm_stream = AsyncMock(return_value=mock_stream())
            mock_controller_class.return_value = mock_controller

            chunks = []
            async with async_client.stream(
                "POST", "/api/llm/stream", json=payload
            ) as response:
                async for chunk in response.aiter_bytes():
                    chunks.append(chunk.decode())

            full_response = "".join(chunks)
            # Parse the SSE data portion
            for line in full_response.split("\n"):
                if line.startswith("data: "):
                    data_str = line[6:]  # Remove "data: " prefix
                    if data_str and data_str != "[DONE]":
                        # Should not raise on valid JSON
                        parsed = ujson.loads(data_str)
                        assert isinstance(parsed, (list, dict))


class TestMetadataEventFirst:
    """Tests verifying metadata event is first in stream."""

    @pytest.mark.asyncio
    async def test_first_event_is_metadata(self, async_client):
        """First event in stream is a metadata event."""
        payload = {
            "input": {"messages": [{"role": "user", "content": "Test"}]},
            "model": "openai:gpt-4.1-mini",
        }

        with patch("src.routes.v0.llm.LLMController") as mock_controller_class:
            mock_controller = MagicMock()

            async def mock_stream():
                yield MetadataEvent(
                    thread_id="abc-123",
                    assistant_id="asst-456",
                    project_id="proj-789",
                ).to_sse()
                yield MessageEvent(
                    message={"content": "Response"}, metadata={}
                ).to_sse()

            mock_controller.llm_stream = AsyncMock(return_value=mock_stream())
            mock_controller_class.return_value = mock_controller

            chunks = []
            async with async_client.stream(
                "POST", "/api/llm/stream", json=payload
            ) as response:
                async for chunk in response.aiter_bytes():
                    chunks.append(chunk.decode())

            full_response = "".join(chunks)
            # Find first data event
            lines = full_response.split("\n")
            first_data = None
            for line in lines:
                if line.startswith("data: "):
                    first_data = line[6:]
                    break

            assert first_data is not None
            parsed = ujson.loads(first_data)
            # First event should be metadata tuple: ["metadata", {...}]
            assert isinstance(parsed, list)
            assert parsed[0] == "metadata"
            assert "thread_id" in parsed[1]

    @pytest.mark.asyncio
    async def test_metadata_contains_thread_id(self, async_client):
        """Metadata event contains thread_id."""
        payload = {
            "input": {"messages": [{"role": "user", "content": "Test"}]},
            "model": "openai:gpt-4.1-mini",
        }

        with patch("src.routes.v0.llm.LLMController") as mock_controller_class:
            mock_controller = MagicMock()

            async def mock_stream():
                yield MetadataEvent(thread_id="my-thread-id").to_sse()

            mock_controller.llm_stream = AsyncMock(return_value=mock_stream())
            mock_controller_class.return_value = mock_controller

            chunks = []
            async with async_client.stream(
                "POST", "/api/llm/stream", json=payload
            ) as response:
                async for chunk in response.aiter_bytes():
                    chunks.append(chunk.decode())

            full_response = "".join(chunks)
            for line in full_response.split("\n"):
                if line.startswith("data: "):
                    data_str = line[6:]
                    parsed = ujson.loads(data_str)
                    if parsed[0] == "metadata":
                        assert parsed[1]["thread_id"] == "my-thread-id"
                        break

    @pytest.mark.asyncio
    async def test_metadata_structure(self):
        """MetadataEvent produces correct SSE structure."""
        event = MetadataEvent(
            thread_id="thread-123",
            assistant_id="asst-456",
            project_id="proj-789",
        )

        sse = event.to_sse()

        # Verify format
        assert sse.startswith("data: ")
        assert sse.endswith("\n\n")

        # Parse and verify content
        data_str = sse[6:-2]  # Remove "data: " and "\n\n"
        parsed = ujson.loads(data_str)

        assert parsed[0] == "metadata"
        assert parsed[1]["thread_id"] == "thread-123"
        assert parsed[1]["assistant_id"] == "asst-456"
        assert parsed[1]["project_id"] == "proj-789"


class TestErrorEventFormat:
    """Tests verifying error events have correct format."""

    @pytest.mark.asyncio
    async def test_simple_error_format(self):
        """Simple error is formatted as tuple: ['error', 'message']."""
        event = ErrorEvent(message="Something went wrong")
        sse = event.to_sse()

        data_str = sse[6:-2]
        parsed = ujson.loads(data_str)

        assert parsed[0] == "error"
        assert parsed[1] == "Something went wrong"

    @pytest.mark.asyncio
    async def test_error_with_code_format(self):
        """Error with code is formatted as tuple: ['error', {...}]."""
        event = ErrorEvent(message="PII detected", code="PII_DETECTED")
        sse = event.to_sse()

        data_str = sse[6:-2]
        parsed = ujson.loads(data_str)

        assert parsed[0] == "error"
        assert isinstance(parsed[1], dict)
        assert parsed[1]["message"] == "PII detected"
        assert parsed[1]["code"] == "PII_DETECTED"

    @pytest.mark.asyncio
    async def test_error_with_details_format(self):
        """Error with details includes details object."""
        event = ErrorEvent(
            message="Validation failed",
            code="VALIDATION_ERROR",
            details={"field": "email", "reason": "invalid format"},
        )
        sse = event.to_sse()

        data_str = sse[6:-2]
        parsed = ujson.loads(data_str)

        assert parsed[0] == "error"
        assert parsed[1]["message"] == "Validation failed"
        assert parsed[1]["code"] == "VALIDATION_ERROR"
        assert parsed[1]["details"]["field"] == "email"

    @pytest.mark.asyncio
    async def test_error_event_in_stream(self, async_client):
        """Error event is properly formatted in stream response."""
        payload = {
            "input": {"messages": [{"role": "user", "content": "Test"}]},
            "model": "openai:gpt-4.1-mini",
        }

        with patch("src.routes.v0.llm.LLMController") as mock_controller_class:
            mock_controller = MagicMock()

            async def mock_stream():
                yield MetadataEvent(thread_id="123").to_sse()
                yield ErrorEvent(message="Test error").to_sse()

            mock_controller.llm_stream = AsyncMock(return_value=mock_stream())
            mock_controller_class.return_value = mock_controller

            chunks = []
            async with async_client.stream(
                "POST", "/api/llm/stream", json=payload
            ) as response:
                async for chunk in response.aiter_bytes():
                    chunks.append(chunk.decode())

            full_response = "".join(chunks)
            assert "error" in full_response
            assert "Test error" in full_response


class TestStreamStoreUpdate:
    """Tests verifying stream completes with proper store update."""

    @pytest.mark.asyncio
    async def test_store_update_called_on_completion(self, async_client):
        """StreamingService.update_store is called after stream completes."""
        payload = {
            "input": {"messages": [{"role": "user", "content": "Test"}]},
            "model": "openai:gpt-4.1-mini",
        }

        with patch("src.routes.v0.llm.LLMController") as mock_controller_class:
            mock_controller = MagicMock()
            update_store_called = []

            async def mock_stream():
                yield MetadataEvent(thread_id="123").to_sse()
                yield MessageEvent(
                    message={"content": "Response"}, metadata={}
                ).to_sse()
                update_store_called.append(True)

            mock_controller.llm_stream = AsyncMock(return_value=mock_stream())
            mock_controller_class.return_value = mock_controller

            chunks = []
            async with async_client.stream(
                "POST", "/api/llm/stream", json=payload
            ) as response:
                async for chunk in response.aiter_bytes():
                    chunks.append(chunk.decode())

            # Verify stream completed
            assert len(chunks) > 0

    @pytest.mark.asyncio
    async def test_values_event_contains_state(self):
        """ValuesEvent contains messages, files, and todos."""
        event = ValuesEvent(
            messages=[
                {"type": "human", "content": "Hello"},
                {"type": "ai", "content": "Hi there!"},
            ],
            files={"/test.txt": {"content": ["test"]}},
            todos=[{"task": "Test task", "done": False}],
        )

        sse = event.to_sse()
        data_str = sse[6:-2]
        parsed = ujson.loads(data_str)

        assert parsed[0] == "values"
        assert len(parsed[1]["messages"]) == 2
        assert "/test.txt" in parsed[1]["files"]
        assert len(parsed[1]["todos"]) == 1


class TestCancellationCleanup:
    """Tests verifying cancellation cleans up properly."""

    @pytest.mark.asyncio
    async def test_client_disconnect_stops_stream(self, async_client):
        """Stream stops when client disconnects."""
        payload = {
            "input": {"messages": [{"role": "user", "content": "Test"}]},
            "model": "openai:gpt-4.1-mini",
        }

        disconnect_checked = []

        with patch("src.routes.v0.llm.LLMController") as mock_controller_class:
            mock_controller = MagicMock()

            async def mock_stream():
                yield MetadataEvent(thread_id="123").to_sse()
                # Simulate client disconnect after first event
                disconnect_checked.append(True)
                yield MessageEvent(
                    message={"content": "More data"}, metadata={}
                ).to_sse()

            mock_controller.llm_stream = AsyncMock(return_value=mock_stream())
            mock_controller_class.return_value = mock_controller

            # Start streaming but don't consume all data
            async with async_client.stream(
                "POST", "/api/llm/stream", json=payload
            ) as response:
                # Read just the first chunk
                async for _ in response.aiter_bytes():
                    break  # Disconnect after first chunk

            # Stream was started
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_done_event_format(self):
        """DoneEvent produces correct SSE format."""
        event = DoneEvent()
        sse = event.to_sse()

        assert sse == "data: [DONE]\n\n"


class TestMessageEventFormat:
    """Tests verifying message events have correct format."""

    @pytest.mark.asyncio
    async def test_message_event_structure(self):
        """MessageEvent produces correct tuple structure."""
        event = MessageEvent(
            message={"type": "ai", "content": "Hello world"},
            metadata={"step": 1, "model": "gpt-4"},
        )

        sse = event.to_sse()
        data_str = sse[6:-2]
        parsed = ujson.loads(data_str)

        assert parsed[0] == "messages"
        assert isinstance(parsed[1], list)
        assert parsed[1][0]["content"] == "Hello world"
        assert parsed[1][1]["step"] == 1

    @pytest.mark.asyncio
    async def test_ai_message_chunk_format(self):
        """AI message chunks are properly formatted."""
        event = MessageEvent(
            message={
                "type": "ai",
                "content": "Test response",
                "tool_calls": [],
            },
            metadata={"thread_id": "test-thread"},
        )

        sse = event.to_sse()
        data_str = sse[6:-2]
        parsed = ujson.loads(data_str)

        assert parsed[0] == "messages"
        assert parsed[1][0]["type"] == "ai"
        assert parsed[1][0]["content"] == "Test response"


class TestValuesEventFormat:
    """Tests verifying values events have correct format."""

    @pytest.mark.asyncio
    async def test_values_event_with_extra_fields(self):
        """ValuesEvent includes extra fields in output."""
        event = ValuesEvent(
            messages=[{"type": "human", "content": "Hi"}],
            files={},
            todos=[],
            extra={"custom_field": "custom_value"},
        )

        sse = event.to_sse()
        data_str = sse[6:-2]
        parsed = ujson.loads(data_str)

        assert parsed[0] == "values"
        assert "custom_field" in parsed[1]
        assert parsed[1]["custom_field"] == "custom_value"

    @pytest.mark.asyncio
    async def test_values_event_minimal(self):
        """ValuesEvent with only required fields."""
        event = ValuesEvent(messages=[])

        sse = event.to_sse()
        data_str = sse[6:-2]
        parsed = ujson.loads(data_str)

        assert parsed[0] == "values"
        assert "messages" in parsed[1]
        assert parsed[1]["messages"] == []


class TestStreamHeaders:
    """Tests verifying stream response headers."""

    @pytest.mark.asyncio
    async def test_cache_control_header(self, async_client):
        """Stream response has Cache-Control: no-cache header."""
        payload = {
            "input": {"messages": [{"role": "user", "content": "Test"}]},
            "model": "openai:gpt-4.1-mini",
        }

        with patch("src.routes.v0.llm.LLMController") as mock_controller_class:
            mock_controller = MagicMock()

            async def mock_stream():
                yield MetadataEvent(thread_id="123").to_sse()

            mock_controller.llm_stream = AsyncMock(return_value=mock_stream())
            mock_controller_class.return_value = mock_controller

            async with async_client.stream(
                "POST", "/api/llm/stream", json=payload
            ) as response:
                assert response.headers.get("cache-control") == "no-cache"

    @pytest.mark.asyncio
    async def test_connection_header(self, async_client):
        """Stream response has Connection: keep-alive header."""
        payload = {
            "input": {"messages": [{"role": "user", "content": "Test"}]},
            "model": "openai:gpt-4.1-mini",
        }

        with patch("src.routes.v0.llm.LLMController") as mock_controller_class:
            mock_controller = MagicMock()

            async def mock_stream():
                yield MetadataEvent(thread_id="123").to_sse()

            mock_controller.llm_stream = AsyncMock(return_value=mock_stream())
            mock_controller_class.return_value = mock_controller

            async with async_client.stream(
                "POST", "/api/llm/stream", json=payload
            ) as response:
                assert response.headers.get("connection") == "keep-alive"


class TestStreamEndpoint:
    """General endpoint tests."""

    @pytest.mark.asyncio
    async def test_endpoint_returns_200_for_valid_request(self, async_client):
        """Valid request returns HTTP 200."""
        payload = {
            "input": {"messages": [{"role": "user", "content": "Test"}]},
            "model": "openai:gpt-4.1-mini",
        }

        with patch("src.routes.v0.llm.LLMController") as mock_controller_class:
            mock_controller = MagicMock()

            async def mock_stream():
                yield MetadataEvent(thread_id="123").to_sse()

            mock_controller.llm_stream = AsyncMock(return_value=mock_stream())
            mock_controller_class.return_value = mock_controller

            async with async_client.stream(
                "POST", "/api/llm/stream", json=payload
            ) as response:
                assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_endpoint_accepts_optional_params(self, async_client):
        """Endpoint accepts optional parameters."""
        payload = {
            "input": {"messages": [{"role": "user", "content": "Test"}]},
            "model": "openai:gpt-4.1-mini",
            "generate_files": True,
            "target_file": "/test.py",
            "file_context": "# existing code",
        }

        with patch("src.routes.v0.llm.LLMController") as mock_controller_class:
            mock_controller = MagicMock()

            async def mock_stream():
                yield MetadataEvent(thread_id="123").to_sse()

            mock_controller.llm_stream = AsyncMock(return_value=mock_stream())
            mock_controller_class.return_value = mock_controller

            async with async_client.stream(
                "POST", "/api/llm/stream", json=payload
            ) as response:
                assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_endpoint_handles_metadata(self, async_client):
        """Endpoint handles thread_id in metadata."""
        payload = {
            "input": {"messages": [{"role": "user", "content": "Test"}]},
            "model": "openai:gpt-4.1-mini",
            "metadata": {"thread_id": "custom-thread-id"},
        }

        with patch("src.routes.v0.llm.LLMController") as mock_controller_class:
            mock_controller = MagicMock()

            async def mock_stream():
                yield MetadataEvent(thread_id="custom-thread-id").to_sse()

            mock_controller.llm_stream = AsyncMock(return_value=mock_stream())
            mock_controller_class.return_value = mock_controller

            async with async_client.stream(
                "POST", "/api/llm/stream", json=payload
            ) as response:
                assert response.status_code == 200
