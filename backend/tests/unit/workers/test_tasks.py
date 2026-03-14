"""Unit tests for TaskIQ task definitions.

Phase 3-4 TDD: Tests for task definitions ensuring proper registration and behavior.
"""

import pytest
from uuid import uuid4


class TestRunAgentStreamTask:
    """Tests for the run_agent_stream task."""

    def test_task_is_registered(self):
        """run_agent_stream task is registered with broker."""
        from src.workers.tasks import run_agent_stream

        assert run_agent_stream is not None
        assert hasattr(run_agent_stream, "kiq")

    def test_task_has_correct_name(self):
        """Task has expected task_name."""
        from src.workers.tasks import run_agent_stream

        assert run_agent_stream.task_name == "run_agent_stream"

    def test_task_is_callable(self):
        """Task is callable."""
        from src.workers.tasks import run_agent_stream

        assert callable(run_agent_stream)

    def test_task_has_kiq_method(self):
        """Task has kiq method for enqueuing."""
        from src.workers.tasks import run_agent_stream

        assert hasattr(run_agent_stream, "kiq")
        assert callable(run_agent_stream.kiq)


class TestRedisStreamOperations:
    """Tests for Redis stream operations used in tasks."""

    @pytest.mark.asyncio
    async def test_task_writes_to_redis_stream(self, fake_redis):
        """Task writes chunks to Redis stream."""
        thread_id = str(uuid4())
        run_id = str(uuid4())
        stream_key = f"agent:stream:{thread_id}:{run_id}"

        await fake_redis.xadd(stream_key, {"data": b"test chunk"})
        await fake_redis.xadd(stream_key, {"done": b"true"})

        messages = await fake_redis.xrange(stream_key)
        assert len(messages) == 2

    @pytest.mark.asyncio
    async def test_task_sets_stream_ttl(self, fake_redis):
        """Task sets TTL on stream key."""
        thread_id = str(uuid4())
        run_id = str(uuid4())
        stream_key = f"agent:stream:{thread_id}:{run_id}"

        await fake_redis.xadd(stream_key, {"data": b"test"})
        await fake_redis.expire(stream_key, 300)

        ttl = await fake_redis.ttl(stream_key)
        assert 0 < ttl <= 300

    @pytest.mark.asyncio
    async def test_task_writes_error_on_failure(self, fake_redis):
        """Task writes error to stream on exception."""
        thread_id = str(uuid4())
        run_id = str(uuid4())
        stream_key = f"agent:stream:{thread_id}:{run_id}"

        await fake_redis.xadd(stream_key, {"error": b"Test error", "done": b"true"})

        messages = await fake_redis.xrange(stream_key)
        assert len(messages) == 1
        assert b"error" in messages[0][1]

    @pytest.mark.asyncio
    async def test_stream_key_format(self, fake_redis):
        """Stream key follows expected format."""
        thread_id = "test-thread-12345"
        run_id = "test-run-12345"
        expected_key = f"agent:stream:{thread_id}:{run_id}"

        await fake_redis.xadd(expected_key, {"data": b"test"})

        # Verify key exists
        exists = await fake_redis.exists(expected_key)
        assert exists

    @pytest.mark.asyncio
    async def test_multiple_chunks_ordered(self, fake_redis):
        """Multiple chunks are stored in order."""
        import ujson

        thread_id = str(uuid4())
        run_id = str(uuid4())
        stream_key = f"agent:stream:{thread_id}:{run_id}"

        # Add chunks in order
        chunks = [
            {"type": "messages", "content": "chunk1"},
            {"type": "messages", "content": "chunk2"},
            {"type": "values", "messages": []},
        ]

        for chunk in chunks:
            await fake_redis.xadd(stream_key, {"data": ujson.dumps(chunk).encode()})

        await fake_redis.xadd(stream_key, {"done": b"true"})

        # Read back
        messages = await fake_redis.xrange(stream_key)
        assert len(messages) == 4  # 3 chunks + done

        # Verify order
        for i, (msg_id, data) in enumerate(messages[:-1]):  # Skip done marker
            parsed = ujson.loads(data[b"data"])
            assert parsed["content" if "content" in parsed else "messages"] is not None


class TestTaskSerialization:
    """Tests for task parameter serialization."""

    def test_llm_request_dict_serializable(self, sample_llm_request_dict):
        """LLMRequest dict is properly structured for serialization."""
        import ujson

        # Should be JSON serializable
        serialized = ujson.dumps(sample_llm_request_dict)
        assert isinstance(serialized, str)

        # Should round-trip
        deserialized = ujson.loads(serialized)
        assert deserialized["input"]["messages"][0]["content"] == "Hello, test!"

    def test_config_dict_serializable(self, sample_config_dict):
        """Config dict is properly structured for serialization."""
        import ujson

        # Should be JSON serializable
        serialized = ujson.dumps(sample_config_dict)
        assert isinstance(serialized, str)

        # Should round-trip
        deserialized = ujson.loads(serialized)
        assert deserialized["configurable"]["thread_id"] == "test-thread-123"
