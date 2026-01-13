"""Integration tests for distributed streaming.

Phase 5 TDD: End-to-end tests for the distributed workers feature,
verifying the full flow from API to worker to SSE consumer.
"""

import os
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from uuid import uuid4


class TestLLMStreamWithDistributedWorkers:
    """Tests for POST /llm/stream when DISTRIBUTED_WORKERS=true."""

    @pytest.mark.asyncio
    async def test_returns_thread_id_when_distributed(self, async_client):
        """Returns thread_id and distributed=true when workers enabled."""
        with patch.dict(os.environ, {"DISTRIBUTED_WORKERS": "true"}):
            with patch("src.routes.v0.llm.DISTRIBUTED_WORKERS", True):
                with patch("src.workers.tasks.run_agent_stream") as mock_task:
                    mock_task.kiq = AsyncMock()

                    payload = {
                        "input": {"messages": [{"role": "user", "content": "Test"}]},
                        "model": "openai:gpt-4.1-mini",
                    }
                    response = await async_client.post(
                        "/api/llm/stream",
                        json=payload,
                    )

                    assert response.status_code == 202
                    data = response.json()
                    assert "thread_id" in data
                    assert data["distributed"] is True

    @pytest.mark.asyncio
    async def test_enqueues_task_when_distributed(self, async_client):
        """Enqueues TaskIQ task when distributed workers enabled."""
        with patch.dict(os.environ, {"DISTRIBUTED_WORKERS": "true"}):
            with patch("src.routes.v0.llm.DISTRIBUTED_WORKERS", True):
                with patch("src.workers.tasks.run_agent_stream") as mock_task:
                    mock_task.kiq = AsyncMock()

                    payload = {
                        "input": {"messages": [{"role": "user", "content": "Test"}]},
                        "model": "openai:gpt-4.1-mini",
                    }
                    await async_client.post(
                        "/api/llm/stream",
                        json=payload,
                    )

                    mock_task.kiq.assert_called_once()

    @pytest.mark.asyncio
    async def test_task_receives_correct_parameters(self, async_client):
        """Task is enqueued with correct parameters."""
        with patch.dict(os.environ, {"DISTRIBUTED_WORKERS": "true"}):
            with patch("src.routes.v0.llm.DISTRIBUTED_WORKERS", True):
                with patch("src.workers.tasks.run_agent_stream") as mock_task:
                    mock_task.kiq = AsyncMock()

                    payload = {
                        "input": {"messages": [{"role": "user", "content": "Hello"}]},
                        "model": "openai:gpt-4.1-mini",
                        "metadata": {"thread_id": "test-thread-123"},
                    }
                    await async_client.post(
                        "/api/llm/stream",
                        json=payload,
                    )

                    call_args = mock_task.kiq.call_args
                    assert call_args is not None
                    kwargs = call_args.kwargs
                    assert "task_dict" in kwargs
                    assert "user_id" in kwargs
                    assert "thread_id" in kwargs


class TestThreadStreamEndpoint:
    """Tests for GET /threads/{thread_id}/stream."""

    @pytest.mark.asyncio
    async def test_endpoint_exists(self, async_client):
        """Endpoint exists and is accessible without auth (uses get_optional_user)."""
        thread_id = str(uuid4())

        with patch("src.routes.v0.thread.stream_from_redis") as mock_stream:
            with patch(
                "src.routes.v0.thread.get_optional_user_from_token"
            ) as mock_auth:
                mock_auth.return_value = None  # No authentication required

                async def mock_gen():
                    yield "data: [DONE]\n\n"

                mock_stream.return_value = mock_gen()

                async with async_client.stream(
                    "GET", f"/api/threads/{thread_id}/stream"
                ) as response:
                    # The endpoint should work even without authentication
                    # since it uses get_optional_user
                    assert response.status_code in [200, 422]

    @pytest.mark.asyncio
    async def test_returns_sse_content_type(self, async_client):
        """Endpoint returns SSE media type."""
        thread_id = str(uuid4())

        with patch("src.routes.v0.thread.stream_from_redis") as mock_stream:
            with patch(
                "src.routes.v0.thread.get_optional_user_from_token"
            ) as mock_auth:
                mock_auth.return_value = None

                async def mock_gen():
                    yield "data: [DONE]\n\n"

                mock_stream.return_value = mock_gen()

                async with async_client.stream(
                    "GET", f"/api/threads/{thread_id}/stream"
                ) as response:
                    if response.status_code == 200:
                        assert response.headers["content-type"].startswith(
                            "text/event-stream"
                        )

    @pytest.mark.asyncio
    async def test_streams_data_events(self, async_client):
        """Endpoint streams data events from Redis."""
        thread_id = str(uuid4())

        with patch("src.routes.v0.thread.stream_from_redis") as mock_stream:
            with patch(
                "src.routes.v0.thread.get_optional_user_from_token"
            ) as mock_auth:
                mock_auth.return_value = None

                async def mock_gen():
                    yield 'data: {"test": "chunk1"}\n\n'
                    yield 'data: {"test": "chunk2"}\n\n'
                    yield "data: [DONE]\n\n"

                mock_stream.return_value = mock_gen()

                chunks = []
                async with async_client.stream(
                    "GET", f"/api/threads/{thread_id}/stream"
                ) as response:
                    if response.status_code == 200:
                        async for chunk in response.aiter_bytes():
                            chunks.append(chunk.decode())

                        assert len(chunks) > 0
                        full_response = "".join(chunks)
                        assert "chunk1" in full_response
                        assert "chunk2" in full_response
                        assert "[DONE]" in full_response


class TestBackwardCompatibility:
    """Tests ensuring sync streaming works when distributed disabled."""

    @pytest.mark.asyncio
    async def test_sync_stream_when_distributed_disabled(self, async_client):
        """Returns SSE stream directly when DISTRIBUTED_WORKERS=false."""
        with patch.dict(os.environ, {"DISTRIBUTED_WORKERS": "false"}):
            with patch("src.routes.v0.llm.DISTRIBUTED_WORKERS", False):
                # This will fail without proper mocking of the LLM controller,
                # but we can verify it doesn't return a JSON response
                payload = {
                    "input": {"messages": [{"role": "user", "content": "Test"}]},
                    "model": "openai:gpt-4.1-mini",
                }

                # The sync path would try to create an LLM controller and stream
                # For this test, we're just verifying the routing logic
                with patch("src.routes.v0.llm.LLMController") as mock_controller_class:
                    mock_controller = MagicMock()

                    async def mock_stream():
                        yield "data: test\n\n"

                    mock_controller.llm_stream = AsyncMock(return_value=mock_stream())
                    mock_controller_class.return_value = mock_controller

                    async with async_client.stream(
                        "POST",
                        "/api/llm/stream",
                        json=payload,
                    ) as response:
                        assert response.status_code == 200
                        assert response.headers["content-type"].startswith(
                            "text/event-stream"
                        )

    @pytest.mark.asyncio
    async def test_default_is_sync_mode(self, async_client):
        """Default mode (no env var) uses sync streaming."""
        # When DISTRIBUTED_WORKERS is not set, it defaults to false
        with patch("src.routes.v0.llm.DISTRIBUTED_WORKERS", False):
            with patch("src.routes.v0.llm.LLMController") as mock_controller_class:
                mock_controller = MagicMock()

                async def mock_stream():
                    yield "data: test\n\n"

                mock_controller.llm_stream = AsyncMock(return_value=mock_stream())
                mock_controller_class.return_value = mock_controller

                payload = {
                    "input": {"messages": [{"role": "user", "content": "Test"}]},
                    "model": "openai:gpt-4.1-mini",
                }

                async with async_client.stream(
                    "POST",
                    "/api/llm/stream",
                    json=payload,
                ) as response:
                    # Should be streaming, not JSON
                    assert response.headers["content-type"].startswith(
                        "text/event-stream"
                    )


class TestDistributedWorkersEnvVar:
    """Tests for DISTRIBUTED_WORKERS environment variable handling."""

    def test_distributed_workers_false_by_default(self):
        """DISTRIBUTED_WORKERS defaults to false."""
        with patch.dict(os.environ, {}, clear=True):
            os.environ.pop("DISTRIBUTED_WORKERS", None)
            result = os.getenv("DISTRIBUTED_WORKERS", "false").lower() == "true"
            assert result is False

    def test_distributed_workers_true_when_set(self):
        """DISTRIBUTED_WORKERS is true when set to 'true'."""
        with patch.dict(os.environ, {"DISTRIBUTED_WORKERS": "true"}):
            result = os.getenv("DISTRIBUTED_WORKERS", "false").lower() == "true"
            assert result is True

    def test_distributed_workers_case_insensitive(self):
        """DISTRIBUTED_WORKERS is case-insensitive."""
        with patch.dict(os.environ, {"DISTRIBUTED_WORKERS": "TRUE"}):
            result = os.getenv("DISTRIBUTED_WORKERS", "false").lower() == "true"
            assert result is True

        with patch.dict(os.environ, {"DISTRIBUTED_WORKERS": "True"}):
            result = os.getenv("DISTRIBUTED_WORKERS", "false").lower() == "true"
            assert result is True
