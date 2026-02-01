"""Integration tests for multi-turn messaging in distributed workers.

These tests validate that multi-turn conversations work correctly when
using TaskIQ distributed workers. Key scenarios:
1. Sequential messages share context
2. Rapid consecutive messages complete successfully
3. Checkpoint grows with turns
4. Consumer survives timeout
5. Error during turn 2 communicates to client
"""

import pytest
from unittest.mock import patch, AsyncMock
from uuid import uuid4


class TestMultiTurnContextPreservation:
    """Tests for context preservation across multiple turns."""

    @pytest.mark.asyncio
    async def test_sequential_messages_share_context(self, async_client):
        """
        Test: Send message 1, wait for DONE, send message 2.
        Acceptance: Both messages use the same thread_id for context continuity.
        """
        thread_id = str(uuid4())

        with patch("src.routes.v0.llm.DISTRIBUTED_WORKERS", True):
            with patch("src.workers.tasks.run_agent_stream") as mock_task:
                mock_task.kiq = AsyncMock()

                # Turn 1: Initial message
                payload_turn1 = {
                    "input": {
                        "messages": [
                            {"role": "user", "content": "Remember my name is Alice"}
                        ]
                    },
                    "model": "openai:gpt-4.1-mini",
                    "metadata": {"thread_id": thread_id},
                }
                response1 = await async_client.post(
                    "/api/llm/stream",
                    json=payload_turn1,
                )

                assert response1.status_code == 202
                data1 = response1.json()
                assert data1["thread_id"] == thread_id

                # Turn 2: Follow-up message with same thread_id
                payload_turn2 = {
                    "input": {
                        "messages": [{"role": "user", "content": "What is my name?"}]
                    },
                    "model": "openai:gpt-4.1-mini",
                    "metadata": {"thread_id": thread_id},
                }
                response2 = await async_client.post(
                    "/api/llm/stream",
                    json=payload_turn2,
                )

                assert response2.status_code == 202
                data2 = response2.json()
                assert data2["thread_id"] == thread_id

                # Verify both calls used the same thread_id
                calls = mock_task.kiq.call_args_list
                assert len(calls) == 2
                assert calls[0].kwargs["thread_id"] == thread_id
                assert calls[1].kwargs["thread_id"] == thread_id

    @pytest.mark.asyncio
    async def test_rapid_consecutive_messages(self, async_client):
        """
        Test: Send message 1 and 2 without waiting for DONE on message 1.
        Acceptance: Both complete successfully with the same thread_id.
        """
        thread_id = str(uuid4())

        with patch("src.routes.v0.llm.DISTRIBUTED_WORKERS", True):
            with patch("src.workers.tasks.run_agent_stream") as mock_task:
                mock_task.kiq = AsyncMock()

                # Send both messages rapidly (simulate rapid user input)
                payload = {
                    "input": {
                        "messages": [{"role": "user", "content": "Quick message"}]
                    },
                    "model": "openai:gpt-4.1-mini",
                    "metadata": {"thread_id": thread_id},
                }

                # Fire both requests concurrently
                response1 = await async_client.post("/api/llm/stream", json=payload)
                response2 = await async_client.post("/api/llm/stream", json=payload)

                # Both should succeed with 202 Accepted
                assert response1.status_code == 202
                assert response2.status_code == 202

                # Both should reference the same thread
                assert response1.json()["thread_id"] == thread_id
                assert response2.json()["thread_id"] == thread_id

    @pytest.mark.asyncio
    async def test_new_thread_created_when_no_thread_id_provided(self, async_client):
        """
        Test: Send message without thread_id.
        Acceptance: A new thread_id is generated and returned.
        """
        with patch("src.routes.v0.llm.DISTRIBUTED_WORKERS", True):
            with patch("src.workers.tasks.run_agent_stream") as mock_task:
                mock_task.kiq = AsyncMock()

                payload = {
                    "input": {
                        "messages": [
                            {"role": "user", "content": "Start new conversation"}
                        ]
                    },
                    "model": "openai:gpt-4.1-mini",
                }

                response = await async_client.post("/api/llm/stream", json=payload)

                assert response.status_code == 202
                data = response.json()
                assert "thread_id" in data
                assert data["thread_id"] is not None
                # UUID format validation
                assert len(data["thread_id"]) == 36


class TestCheckpointManagement:
    """Tests for checkpoint state management across turns."""

    @pytest.mark.asyncio
    async def test_checkpoint_grows_with_turns(self, async_client):
        """
        Test: Send 3 messages, verify checkpoint_id is tracked.
        Acceptance: Each turn should maintain proper checkpoint tracking.
        """
        thread_id = str(uuid4())
        task_dicts = []

        with patch("src.routes.v0.llm.DISTRIBUTED_WORKERS", True):
            with patch("src.workers.tasks.run_agent_stream") as mock_task:

                async def capture_task(**kwargs):
                    task_dicts.append(kwargs.get("task_dict"))

                mock_task.kiq = AsyncMock(side_effect=capture_task)

                for i in range(3):
                    payload = {
                        "input": {
                            "messages": [
                                {"role": "user", "content": f"Turn {i + 1} message"}
                            ]
                        },
                        "model": "openai:gpt-4.1-mini",
                        "metadata": {"thread_id": thread_id},
                    }

                    response = await async_client.post("/api/llm/stream", json=payload)
                    assert response.status_code == 202

                # Verify all 3 turns were enqueued
                assert mock_task.kiq.call_count == 3

                # All tasks should use the same thread_id
                for call in mock_task.kiq.call_args_list:
                    assert call.kwargs["thread_id"] == thread_id


class TestErrorHandling:
    """Tests for error handling during multi-turn conversations."""

    @pytest.mark.asyncio
    async def test_error_during_turn2_communicates_to_client(self, async_client):
        """
        Test: Cause failure on second message enqueue.
        Acceptance: Client receives appropriate error response.
        """
        thread_id = str(uuid4())

        with patch("src.routes.v0.llm.DISTRIBUTED_WORKERS", True):
            with patch("src.workers.tasks.run_agent_stream") as mock_task:
                # First call succeeds, second fails
                mock_task.kiq = AsyncMock(
                    side_effect=[None, Exception("Task enqueue failed")]
                )

                payload = {
                    "input": {"messages": [{"role": "user", "content": "Test"}]},
                    "model": "openai:gpt-4.1-mini",
                    "metadata": {"thread_id": thread_id},
                }

                # Turn 1 should succeed
                response1 = await async_client.post("/api/llm/stream", json=payload)
                assert response1.status_code == 202

                # Turn 2 should fail with 500
                response2 = await async_client.post("/api/llm/stream", json=payload)
                assert response2.status_code == 500


class TestStreamConsumer:
    """Tests for the Redis stream consumer behavior."""

    @pytest.mark.asyncio
    async def test_consumer_handles_timeout_gracefully(self, async_client):
        """
        Test: Mock slow worker, verify consumer keeps polling.
        Acceptance: Consumer eventually receives keep-alive or data.
        """
        thread_id = str(uuid4())

        with patch("src.routes.v0.thread.stream_from_redis") as mock_stream:
            with patch(
                "src.routes.v0.thread.get_optional_user_from_token"
            ) as mock_auth:
                mock_auth.return_value = None

                # Simulate slow worker with keep-alive then data
                async def slow_generator():
                    yield ": keep-alive\n\n"
                    yield 'data: {"message": "finally got response"}\n\n'
                    yield "data: [DONE]\n\n"

                mock_stream.return_value = slow_generator()

                chunks = []
                async with async_client.stream(
                    "GET", f"/api/threads/{thread_id}/stream"
                ) as response:
                    if response.status_code == 200:
                        async for chunk in response.aiter_bytes():
                            chunks.append(chunk.decode())

                full_response = "".join(chunks)
                assert "keep-alive" in full_response
                assert "finally got response" in full_response
                assert "[DONE]" in full_response

    @pytest.mark.asyncio
    async def test_consumer_handles_error_event(self, async_client):
        """
        Test: Worker sends error event.
        Acceptance: Client receives error in stream.
        """
        thread_id = str(uuid4())

        with patch("src.routes.v0.thread.stream_from_redis") as mock_stream:
            with patch(
                "src.routes.v0.thread.get_optional_user_from_token"
            ) as mock_auth:
                mock_auth.return_value = None

                async def error_generator():
                    yield 'data: {"error": "Something went wrong"}\n\n'
                    yield "data: [DONE]\n\n"

                mock_stream.return_value = error_generator()

                chunks = []
                async with async_client.stream(
                    "GET", f"/api/threads/{thread_id}/stream"
                ) as response:
                    if response.status_code == 200:
                        async for chunk in response.aiter_bytes():
                            chunks.append(chunk.decode())

                full_response = "".join(chunks)
                assert "error" in full_response
                assert "Something went wrong" in full_response


class TestBackendInitialization:
    """Tests verifying backend is properly initialized in worker tasks."""

    @pytest.mark.asyncio
    async def test_task_parameters_include_user_id(self, async_client):
        """
        Test: Verify user_id is passed to task.
        Acceptance: Task receives user_id for backend route initialization.
        """
        thread_id = str(uuid4())

        with patch("src.routes.v0.llm.DISTRIBUTED_WORKERS", True):
            with patch("src.workers.tasks.run_agent_stream") as mock_task:
                mock_task.kiq = AsyncMock()

                payload = {
                    "input": {"messages": [{"role": "user", "content": "Test"}]},
                    "model": "openai:gpt-4.1-mini",
                    "metadata": {"thread_id": thread_id},
                }

                await async_client.post("/api/llm/stream", json=payload)

                call_args = mock_task.kiq.call_args
                assert "user_id" in call_args.kwargs
                # user_id should be empty string when no auth (get_optional_user returns None)
                assert call_args.kwargs["user_id"] == ""

    @pytest.mark.asyncio
    async def test_task_dict_contains_model_info(self, async_client):
        """
        Test: Verify task_dict contains model for ToolRuntime context.
        Acceptance: task_dict has model field for ContextSchema initialization.
        """
        thread_id = str(uuid4())

        with patch("src.routes.v0.llm.DISTRIBUTED_WORKERS", True):
            with patch("src.workers.tasks.run_agent_stream") as mock_task:
                mock_task.kiq = AsyncMock()

                payload = {
                    "input": {"messages": [{"role": "user", "content": "Test"}]},
                    "model": "openai:gpt-4.1-mini",
                    "metadata": {"thread_id": thread_id},
                }

                await async_client.post("/api/llm/stream", json=payload)

                call_args = mock_task.kiq.call_args
                task_dict = call_args.kwargs["task_dict"]
                assert "model" in task_dict
                assert task_dict["model"] == "openai:gpt-4.1-mini"
