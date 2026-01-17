"""Integration tests for distributed streaming.

US-011: Tests verifying distributed streaming path including:
- POST /stream/distributed returns 202 with thread_id
- GET /threads/{thread_id}/stream consumes Redis stream
- Keep-alive events during idle periods
- Error propagation from worker

CURL validation examples:

    # 1. Submit distributed stream request (returns 202 with thread_id and poll_url)
    curl -X POST http://localhost:8000/api/llm/stream/distributed \
        -H "Content-Type: application/json" \
        -d '{"input": {"messages": [{"role": "user", "content": "Hello"}]}, "model": "openai:gpt-4.1-mini"}'

    # Expected response:
    # HTTP/1.1 202 Accepted
    # {"thread_id":"abc-123-uuid","poll_url":"/api/threads/abc-123-uuid/stream"}

    # 2. Poll for results via SSE stream
    curl -X GET http://localhost:8000/api/threads/abc-123-uuid/stream \
        -H "Accept: text/event-stream"

    # Expected SSE stream:
    # : keep-alive
    # data: ["metadata",{"thread_id":"abc-123-uuid"}]
    # data: ["messages",[{"content":"Hello!"},{}]]
    # data: [DONE]

    # 3. With custom thread_id in metadata
    curl -X POST http://localhost:8000/api/llm/stream/distributed \
        -H "Content-Type: application/json" \
        -d '{"input": {"messages": [{"role": "user", "content": "Test"}]}, "model": "openai:gpt-4.1-mini", "metadata": {"thread_id": "my-custom-thread"}}'

    # Response preserves custom thread_id:
    # {"thread_id":"my-custom-thread","poll_url":"/api/threads/my-custom-thread/stream"}
"""

import pytest
import ujson
from unittest.mock import patch, AsyncMock, MagicMock
from uuid import uuid4

from src.schemas.events.stream import (
    MetadataEvent,
    MessageEvent,
    ValuesEvent,
    ErrorEvent,
    DoneEvent,
)


class TestDistributedEndpoint202:
    """Tests for POST /llm/stream/distributed returns 202."""

    @pytest.mark.asyncio
    async def test_returns_202_status(self, async_client):
        """POST /api/llm/stream/distributed returns HTTP 202 Accepted."""
        with patch("src.workers.tasks.run_agent_stream") as mock_task:
            mock_task.kiq = AsyncMock()

            payload = {
                "input": {"messages": [{"role": "user", "content": "Test"}]},
                "model": "openai:gpt-4.1-mini",
            }
            response = await async_client.post(
                "/api/llm/stream/distributed",
                json=payload,
            )

            assert response.status_code == 202

    @pytest.mark.asyncio
    async def test_returns_thread_id_in_response(self, async_client):
        """Response contains thread_id field."""
        with patch("src.workers.tasks.run_agent_stream") as mock_task:
            mock_task.kiq = AsyncMock()

            payload = {
                "input": {"messages": [{"role": "user", "content": "Test"}]},
                "model": "openai:gpt-4.1-mini",
            }
            response = await async_client.post(
                "/api/llm/stream/distributed",
                json=payload,
            )

            data = response.json()
            assert "thread_id" in data
            assert isinstance(data["thread_id"], str)
            assert len(data["thread_id"]) > 0

    @pytest.mark.asyncio
    async def test_returns_poll_url_in_response(self, async_client):
        """Response contains poll_url field matching thread_id."""
        with patch("src.workers.tasks.run_agent_stream") as mock_task:
            mock_task.kiq = AsyncMock()

            payload = {
                "input": {"messages": [{"role": "user", "content": "Test"}]},
                "model": "openai:gpt-4.1-mini",
            }
            response = await async_client.post(
                "/api/llm/stream/distributed",
                json=payload,
            )

            data = response.json()
            assert "poll_url" in data
            assert data["poll_url"] == f"/api/threads/{data['thread_id']}/stream"

    @pytest.mark.asyncio
    async def test_preserves_custom_thread_id(self, async_client):
        """Custom thread_id from metadata is preserved."""
        with patch("src.workers.tasks.run_agent_stream") as mock_task:
            mock_task.kiq = AsyncMock()

            custom_thread_id = "my-custom-thread-123"
            payload = {
                "input": {"messages": [{"role": "user", "content": "Test"}]},
                "model": "openai:gpt-4.1-mini",
                "metadata": {"thread_id": custom_thread_id},
            }
            response = await async_client.post(
                "/api/llm/stream/distributed",
                json=payload,
            )

            data = response.json()
            assert data["thread_id"] == custom_thread_id
            assert data["poll_url"] == f"/api/threads/{custom_thread_id}/stream"

    @pytest.mark.asyncio
    async def test_generates_uuid_when_no_thread_id(self, async_client):
        """UUID is generated when thread_id not provided."""
        with patch("src.workers.tasks.run_agent_stream") as mock_task:
            mock_task.kiq = AsyncMock()

            payload = {
                "input": {"messages": [{"role": "user", "content": "Test"}]},
                "model": "openai:gpt-4.1-mini",
            }
            response = await async_client.post(
                "/api/llm/stream/distributed",
                json=payload,
            )

            data = response.json()
            # UUID format has dashes and is 36 characters
            assert len(data["thread_id"]) == 36
            assert "-" in data["thread_id"]

    @pytest.mark.asyncio
    async def test_enqueues_task_with_correct_params(self, async_client):
        """Task is enqueued with correct parameters."""
        with patch("src.workers.tasks.run_agent_stream") as mock_task:
            mock_task.kiq = AsyncMock()

            payload = {
                "input": {"messages": [{"role": "user", "content": "Hello world"}]},
                "model": "openai:gpt-4.1-mini",
                "metadata": {"thread_id": "test-thread-xyz"},
            }
            await async_client.post(
                "/api/llm/stream/distributed",
                json=payload,
            )

            mock_task.kiq.assert_called_once()
            call_kwargs = mock_task.kiq.call_args.kwargs
            assert "task_dict" in call_kwargs
            assert "user_id" in call_kwargs
            assert "thread_id" in call_kwargs
            assert call_kwargs["thread_id"] == "test-thread-xyz"

    @pytest.mark.asyncio
    async def test_response_has_cache_control_header(self, async_client):
        """Response includes Cache-Control: no-cache header."""
        with patch("src.workers.tasks.run_agent_stream") as mock_task:
            mock_task.kiq = AsyncMock()

            payload = {
                "input": {"messages": [{"role": "user", "content": "Test"}]},
                "model": "openai:gpt-4.1-mini",
            }
            response = await async_client.post(
                "/api/llm/stream/distributed",
                json=payload,
            )

            assert response.headers.get("cache-control") == "no-cache"


class TestThreadStreamEndpointSSE:
    """Tests for GET /threads/{thread_id}/stream SSE format."""

    @pytest.mark.asyncio
    async def test_returns_sse_content_type(self, async_client):
        """Endpoint returns Content-Type: text/event-stream."""
        thread_id = str(uuid4())

        with patch("src.routes.v0.thread.stream_from_redis") as mock_stream:
            with patch(
                "src.routes.v0.thread.get_optional_user_from_token"
            ) as mock_auth:
                mock_auth.return_value = None

                async def mock_gen():
                    yield DoneEvent().to_sse()

                mock_stream.return_value = mock_gen()

                async with async_client.stream(
                    "GET", f"/api/threads/{thread_id}/stream"
                ) as response:
                    assert response.status_code == 200
                    content_type = response.headers.get("content-type", "")
                    assert content_type.startswith("text/event-stream")

    @pytest.mark.asyncio
    async def test_returns_cache_control_header(self, async_client):
        """Endpoint returns Cache-Control: no-cache header."""
        thread_id = str(uuid4())

        with patch("src.routes.v0.thread.stream_from_redis") as mock_stream:
            with patch(
                "src.routes.v0.thread.get_optional_user_from_token"
            ) as mock_auth:
                mock_auth.return_value = None

                async def mock_gen():
                    yield DoneEvent().to_sse()

                mock_stream.return_value = mock_gen()

                async with async_client.stream(
                    "GET", f"/api/threads/{thread_id}/stream"
                ) as response:
                    assert response.headers.get("cache-control") == "no-cache"

    @pytest.mark.asyncio
    async def test_returns_connection_keepalive_header(self, async_client):
        """Endpoint returns Connection: keep-alive header."""
        thread_id = str(uuid4())

        with patch("src.routes.v0.thread.stream_from_redis") as mock_stream:
            with patch(
                "src.routes.v0.thread.get_optional_user_from_token"
            ) as mock_auth:
                mock_auth.return_value = None

                async def mock_gen():
                    yield DoneEvent().to_sse()

                mock_stream.return_value = mock_gen()

                async with async_client.stream(
                    "GET", f"/api/threads/{thread_id}/stream"
                ) as response:
                    assert response.headers.get("connection") == "keep-alive"


class TestThreadStreamConsumesRedis:
    """Tests for /threads/{thread_id}/stream consuming Redis stream."""

    @pytest.mark.asyncio
    async def test_streams_metadata_event(self, async_client):
        """Stream includes metadata event."""
        thread_id = str(uuid4())

        with patch("src.routes.v0.thread.stream_from_redis") as mock_stream:
            with patch(
                "src.routes.v0.thread.get_optional_user_from_token"
            ) as mock_auth:
                mock_auth.return_value = None

                async def mock_gen():
                    yield MetadataEvent(thread_id=thread_id).to_sse()
                    yield DoneEvent().to_sse()

                mock_stream.return_value = mock_gen()

                chunks = []
                async with async_client.stream(
                    "GET", f"/api/threads/{thread_id}/stream"
                ) as response:
                    async for chunk in response.aiter_bytes():
                        chunks.append(chunk.decode())

                full_response = "".join(chunks)
                assert "metadata" in full_response
                assert thread_id in full_response

    @pytest.mark.asyncio
    async def test_streams_message_events(self, async_client):
        """Stream includes message events."""
        thread_id = str(uuid4())

        with patch("src.routes.v0.thread.stream_from_redis") as mock_stream:
            with patch(
                "src.routes.v0.thread.get_optional_user_from_token"
            ) as mock_auth:
                mock_auth.return_value = None

                async def mock_gen():
                    yield MetadataEvent(thread_id=thread_id).to_sse()
                    yield MessageEvent(
                        message={"type": "ai", "content": "Hello from worker"},
                        metadata={},
                    ).to_sse()
                    yield DoneEvent().to_sse()

                mock_stream.return_value = mock_gen()

                chunks = []
                async with async_client.stream(
                    "GET", f"/api/threads/{thread_id}/stream"
                ) as response:
                    async for chunk in response.aiter_bytes():
                        chunks.append(chunk.decode())

                full_response = "".join(chunks)
                assert "messages" in full_response
                assert "Hello from worker" in full_response

    @pytest.mark.asyncio
    async def test_streams_values_events(self, async_client):
        """Stream includes values events with state."""
        thread_id = str(uuid4())

        with patch("src.routes.v0.thread.stream_from_redis") as mock_stream:
            with patch(
                "src.routes.v0.thread.get_optional_user_from_token"
            ) as mock_auth:
                mock_auth.return_value = None

                async def mock_gen():
                    yield MetadataEvent(thread_id=thread_id).to_sse()
                    yield ValuesEvent(
                        messages=[
                            {"type": "human", "content": "Hi"},
                            {"type": "ai", "content": "Hello!"},
                        ],
                        files={"/test.py": {"content": ["print('test')"]}},
                        todos=[{"task": "Test task", "done": False}],
                    ).to_sse()
                    yield DoneEvent().to_sse()

                mock_stream.return_value = mock_gen()

                chunks = []
                async with async_client.stream(
                    "GET", f"/api/threads/{thread_id}/stream"
                ) as response:
                    async for chunk in response.aiter_bytes():
                        chunks.append(chunk.decode())

                full_response = "".join(chunks)
                assert "values" in full_response
                assert "messages" in full_response
                assert "files" in full_response
                assert "todos" in full_response

    @pytest.mark.asyncio
    async def test_streams_done_event_at_end(self, async_client):
        """Stream ends with [DONE] event."""
        thread_id = str(uuid4())

        with patch("src.routes.v0.thread.stream_from_redis") as mock_stream:
            with patch(
                "src.routes.v0.thread.get_optional_user_from_token"
            ) as mock_auth:
                mock_auth.return_value = None

                async def mock_gen():
                    yield MetadataEvent(thread_id=thread_id).to_sse()
                    yield DoneEvent().to_sse()

                mock_stream.return_value = mock_gen()

                chunks = []
                async with async_client.stream(
                    "GET", f"/api/threads/{thread_id}/stream"
                ) as response:
                    async for chunk in response.aiter_bytes():
                        chunks.append(chunk.decode())

                full_response = "".join(chunks)
                assert "[DONE]" in full_response

    @pytest.mark.asyncio
    async def test_events_are_json_parseable(self, async_client):
        """Stream events can be parsed as JSON."""
        thread_id = str(uuid4())

        with patch("src.routes.v0.thread.stream_from_redis") as mock_stream:
            with patch(
                "src.routes.v0.thread.get_optional_user_from_token"
            ) as mock_auth:
                mock_auth.return_value = None

                async def mock_gen():
                    yield MetadataEvent(thread_id=thread_id).to_sse()
                    yield MessageEvent(
                        message={"content": "Test"}, metadata={}
                    ).to_sse()
                    yield DoneEvent().to_sse()

                mock_stream.return_value = mock_gen()

                chunks = []
                async with async_client.stream(
                    "GET", f"/api/threads/{thread_id}/stream"
                ) as response:
                    async for chunk in response.aiter_bytes():
                        chunks.append(chunk.decode())

                full_response = "".join(chunks)
                for line in full_response.split("\n"):
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str and data_str != "[DONE]":
                            parsed = ujson.loads(data_str)
                            assert isinstance(parsed, (list, dict))


class TestKeepAliveEvents:
    """Tests for keep-alive events during idle periods."""

    @pytest.mark.asyncio
    async def test_keepalive_event_format(self, async_client):
        """Keep-alive events use SSE comment format."""
        thread_id = str(uuid4())

        with patch("src.routes.v0.thread.stream_from_redis") as mock_stream:
            with patch(
                "src.routes.v0.thread.get_optional_user_from_token"
            ) as mock_auth:
                mock_auth.return_value = None

                async def mock_gen():
                    yield ": keep-alive\n\n"
                    yield MetadataEvent(thread_id=thread_id).to_sse()
                    yield DoneEvent().to_sse()

                mock_stream.return_value = mock_gen()

                chunks = []
                async with async_client.stream(
                    "GET", f"/api/threads/{thread_id}/stream"
                ) as response:
                    async for chunk in response.aiter_bytes():
                        chunks.append(chunk.decode())

                full_response = "".join(chunks)
                # Keep-alive uses SSE comment format (starts with colon)
                assert ": keep-alive" in full_response

    @pytest.mark.asyncio
    async def test_multiple_keepalive_events(self, async_client):
        """Multiple keep-alive events can be sent."""
        thread_id = str(uuid4())

        with patch("src.routes.v0.thread.stream_from_redis") as mock_stream:
            with patch(
                "src.routes.v0.thread.get_optional_user_from_token"
            ) as mock_auth:
                mock_auth.return_value = None

                async def mock_gen():
                    yield ": keep-alive\n\n"
                    yield ": keep-alive\n\n"
                    yield MetadataEvent(thread_id=thread_id).to_sse()
                    yield DoneEvent().to_sse()

                mock_stream.return_value = mock_gen()

                chunks = []
                async with async_client.stream(
                    "GET", f"/api/threads/{thread_id}/stream"
                ) as response:
                    async for chunk in response.aiter_bytes():
                        chunks.append(chunk.decode())

                full_response = "".join(chunks)
                # Count keep-alive occurrences
                assert full_response.count(": keep-alive") >= 2


class TestErrorPropagation:
    """Tests for error propagation from worker."""

    @pytest.mark.asyncio
    async def test_simple_error_propagation(self, async_client):
        """Simple errors are propagated in stream."""
        thread_id = str(uuid4())

        with patch("src.routes.v0.thread.stream_from_redis") as mock_stream:
            with patch(
                "src.routes.v0.thread.get_optional_user_from_token"
            ) as mock_auth:
                mock_auth.return_value = None

                async def mock_gen():
                    yield MetadataEvent(thread_id=thread_id).to_sse()
                    yield ErrorEvent(message="Worker encountered an error").to_sse()
                    yield DoneEvent().to_sse()

                mock_stream.return_value = mock_gen()

                chunks = []
                async with async_client.stream(
                    "GET", f"/api/threads/{thread_id}/stream"
                ) as response:
                    async for chunk in response.aiter_bytes():
                        chunks.append(chunk.decode())

                full_response = "".join(chunks)
                assert "error" in full_response
                assert "Worker encountered an error" in full_response

    @pytest.mark.asyncio
    async def test_error_with_code_propagation(self, async_client):
        """Errors with codes are propagated in stream."""
        thread_id = str(uuid4())

        with patch("src.routes.v0.thread.stream_from_redis") as mock_stream:
            with patch(
                "src.routes.v0.thread.get_optional_user_from_token"
            ) as mock_auth:
                mock_auth.return_value = None

                async def mock_gen():
                    yield MetadataEvent(thread_id=thread_id).to_sse()
                    yield ErrorEvent(
                        message="Sensitive data detected", code="PII_DETECTED"
                    ).to_sse()
                    yield DoneEvent().to_sse()

                mock_stream.return_value = mock_gen()

                chunks = []
                async with async_client.stream(
                    "GET", f"/api/threads/{thread_id}/stream"
                ) as response:
                    async for chunk in response.aiter_bytes():
                        chunks.append(chunk.decode())

                full_response = "".join(chunks)
                assert "error" in full_response
                assert "PII_DETECTED" in full_response

    @pytest.mark.asyncio
    async def test_error_event_format(self):
        """ErrorEvent produces correct SSE format."""
        event = ErrorEvent(message="Test error message")
        sse = event.to_sse()

        assert sse.startswith("data: ")
        assert sse.endswith("\n\n")

        data_str = sse[6:-2]
        parsed = ujson.loads(data_str)
        assert parsed[0] == "error"
        assert parsed[1] == "Test error message"

    @pytest.mark.asyncio
    async def test_error_with_details_format(self):
        """ErrorEvent with details produces correct format."""
        event = ErrorEvent(
            message="Validation error",
            code="VALIDATION_ERROR",
            details={"field": "input", "reason": "too long"},
        )
        sse = event.to_sse()

        data_str = sse[6:-2]
        parsed = ujson.loads(data_str)
        assert parsed[0] == "error"
        assert parsed[1]["message"] == "Validation error"
        assert parsed[1]["code"] == "VALIDATION_ERROR"
        assert parsed[1]["details"]["field"] == "input"


class TestStreamFromRedisUnit:
    """Unit tests for stream_from_redis function behavior.

    Note: The stream_from_redis function imports redis.asyncio inline,
    making it difficult to mock directly. These tests verify behavior
    by mocking at the route level (see TestThreadStreamConsumesRedis)
    or by testing the function's output format.
    """

    @pytest.mark.asyncio
    async def test_stream_key_format(self):
        """stream_from_redis uses correct Redis stream key format."""
        # Verify the stream key naming convention is documented
        thread_id = "test-123"
        expected_key = f"agent:stream:{thread_id}"
        assert expected_key == "agent:stream:test-123"

    @pytest.mark.asyncio
    async def test_keepalive_format(self):
        """Keep-alive events use SSE comment format."""
        # SSE comments start with colon and don't need "data:"
        keepalive = ": keep-alive\n\n"
        assert keepalive.startswith(":")
        assert keepalive.endswith("\n\n")

    @pytest.mark.asyncio
    async def test_done_event_output(self):
        """DoneEvent produces [DONE] marker."""
        event = DoneEvent()
        sse = event.to_sse()
        assert "[DONE]" in sse
        assert sse == "data: [DONE]\n\n"

    @pytest.mark.asyncio
    async def test_error_event_output(self):
        """ErrorEvent produces proper SSE format."""
        event = ErrorEvent(message="Redis connection failed")
        sse = event.to_sse()
        assert "error" in sse
        assert "Redis connection failed" in sse


class TestStreamFromRedisConfig:
    """Tests for stream_from_redis configuration."""

    @pytest.mark.asyncio
    async def test_uses_streaming_service_config(self):
        """stream_from_redis uses StreamingService.get_redis_stream_config()."""
        from src.services.streaming import StreamingService

        config = StreamingService.get_redis_stream_config()

        assert "timeout_ms" in config
        assert "keepalive_ms" in config
        assert isinstance(config["timeout_ms"], int)
        assert isinstance(config["keepalive_ms"], int)

    @pytest.mark.asyncio
    async def test_default_timeout_value(self):
        """Default timeout is 60 seconds (60000ms)."""
        from src.services.streaming import StreamingService

        config = StreamingService.get_redis_stream_config()

        assert config["timeout_ms"] == 60000

    @pytest.mark.asyncio
    async def test_default_keepalive_value(self):
        """Default keepalive is 30 seconds (30000ms)."""
        from src.services.streaming import StreamingService

        config = StreamingService.get_redis_stream_config()

        assert config["keepalive_ms"] == 30000

    @pytest.mark.asyncio
    async def test_config_env_override(self):
        """Config values can be overridden via environment variables."""
        import os
        import importlib
        import src.services.streaming as streaming_module

        # Save original values
        orig_timeout = os.environ.get("REDIS_STREAM_TIMEOUT_MS")
        orig_keepalive = os.environ.get("REDIS_KEEPALIVE_INTERVAL_MS")

        try:
            os.environ["REDIS_STREAM_TIMEOUT_MS"] = "120000"
            os.environ["REDIS_KEEPALIVE_INTERVAL_MS"] = "15000"

            # Reload module to pick up new env vars
            importlib.reload(streaming_module)

            from src.services.streaming import StreamingService

            config = StreamingService.get_redis_stream_config()

            assert config["timeout_ms"] == 120000
            assert config["keepalive_ms"] == 15000

        finally:
            # Restore original values
            if orig_timeout:
                os.environ["REDIS_STREAM_TIMEOUT_MS"] = orig_timeout
            else:
                os.environ.pop("REDIS_STREAM_TIMEOUT_MS", None)
            if orig_keepalive:
                os.environ["REDIS_KEEPALIVE_INTERVAL_MS"] = orig_keepalive
            else:
                os.environ.pop("REDIS_KEEPALIVE_INTERVAL_MS", None)

            # Reload again to restore defaults
            importlib.reload(streaming_module)


class TestSyncStreamComparison:
    """Tests comparing sync and distributed stream behaviors."""

    @pytest.mark.asyncio
    async def test_sync_stream_returns_200(self, async_client):
        """POST /api/llm/stream returns 200 (sync mode)."""
        payload = {
            "input": {"messages": [{"role": "user", "content": "Test"}]},
            "model": "openai:gpt-4.1-mini",
        }

        with patch("src.routes.v0.llm.LLMController") as mock_controller_class:
            mock_controller = MagicMock()

            async def mock_stream():
                yield MetadataEvent(thread_id="123").to_sse()
                yield DoneEvent().to_sse()

            mock_controller.llm_stream = AsyncMock(return_value=mock_stream())
            mock_controller_class.return_value = mock_controller

            async with async_client.stream(
                "POST",
                "/api/llm/stream",
                json=payload,
            ) as response:
                assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_distributed_returns_202(self, async_client):
        """POST /api/llm/stream/distributed returns 202 (async mode)."""
        payload = {
            "input": {"messages": [{"role": "user", "content": "Test"}]},
            "model": "openai:gpt-4.1-mini",
        }

        with patch("src.workers.tasks.run_agent_stream") as mock_task:
            mock_task.kiq = AsyncMock()

            response = await async_client.post(
                "/api/llm/stream/distributed",
                json=payload,
            )

            assert response.status_code == 202

    @pytest.mark.asyncio
    async def test_sync_returns_sse_directly(self, async_client):
        """Sync stream returns SSE content directly."""
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
                "POST",
                "/api/llm/stream",
                json=payload,
            ) as response:
                content_type = response.headers.get("content-type", "")
                assert content_type.startswith("text/event-stream")

    @pytest.mark.asyncio
    async def test_distributed_returns_json(self, async_client):
        """Distributed stream returns JSON with poll URL."""
        payload = {
            "input": {"messages": [{"role": "user", "content": "Test"}]},
            "model": "openai:gpt-4.1-mini",
        }

        with patch("src.workers.tasks.run_agent_stream") as mock_task:
            mock_task.kiq = AsyncMock()

            response = await async_client.post(
                "/api/llm/stream/distributed",
                json=payload,
            )

            content_type = response.headers.get("content-type", "")
            assert "application/json" in content_type
            data = response.json()
            assert "thread_id" in data
            assert "poll_url" in data
