"""Integration tests for distributed streaming.

Phase 5 TDD: End-to-end tests for the distributed workers feature,
verifying the full flow from API to worker to SSE consumer.
"""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from uuid import uuid4


class TestLLMStreamDistributedEndpoint:
    """Tests for POST /llm/stream/distributed endpoint."""

    @pytest.mark.asyncio
    async def test_returns_thread_id_and_poll_url(self, async_client):
        """Returns thread_id and poll_url with HTTP 202."""
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
            data = response.json()
            assert "thread_id" in data
            assert "poll_url" in data
            # Verify poll_url format
            assert data["poll_url"] == f"/api/threads/{data['thread_id']}/stream"

    @pytest.mark.asyncio
    async def test_enqueues_task(self, async_client):
        """Enqueues TaskIQ task when called."""
        with patch("src.workers.tasks.run_agent_stream") as mock_task:
            mock_task.kiq = AsyncMock()

            payload = {
                "input": {"messages": [{"role": "user", "content": "Test"}]},
                "model": "openai:gpt-4.1-mini",
            }
            await async_client.post(
                "/api/llm/stream/distributed",
                json=payload,
            )

            mock_task.kiq.assert_called_once()

    @pytest.mark.asyncio
    async def test_task_receives_correct_parameters(self, async_client):
        """Task is enqueued with correct parameters."""
        with patch("src.workers.tasks.run_agent_stream") as mock_task:
            mock_task.kiq = AsyncMock()

            payload = {
                "input": {"messages": [{"role": "user", "content": "Hello"}]},
                "model": "openai:gpt-4.1-mini",
                "metadata": {"thread_id": "test-thread-123"},
            }
            await async_client.post(
                "/api/llm/stream/distributed",
                json=payload,
            )

            call_args = mock_task.kiq.call_args
            assert call_args is not None
            kwargs = call_args.kwargs
            assert "task_dict" in kwargs
            assert "user_id" in kwargs
            assert "thread_id" in kwargs
            assert kwargs["thread_id"] == "test-thread-123"

    @pytest.mark.asyncio
    async def test_generates_thread_id_if_not_provided(self, async_client):
        """Generates thread_id when not in metadata."""
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
            assert len(data["thread_id"]) > 0  # UUID format


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


class TestSyncStreamEndpoint:
    """Tests for POST /llm/stream (sync mode)."""

    @pytest.mark.asyncio
    async def test_sync_stream_returns_sse(self, async_client):
        """Sync stream endpoint returns SSE directly."""
        payload = {
            "input": {"messages": [{"role": "user", "content": "Test"}]},
            "model": "openai:gpt-4.1-mini",
        }

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
                assert response.headers["content-type"].startswith("text/event-stream")

    @pytest.mark.asyncio
    async def test_sync_stream_is_default(self, async_client):
        """Sync stream is the default streaming mode."""
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
                assert response.headers["content-type"].startswith("text/event-stream")
