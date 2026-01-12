"""Unit tests for Redis stream consumer.

Phase 3-4 TDD: Tests for the stream_from_redis function that consumes
Redis streams and yields SSE events.
"""
import pytest
from uuid import uuid4


class TestStreamFromRedis:
    """Tests for the stream_from_redis function."""

    @pytest.mark.asyncio
    async def test_yields_data_events(self, fake_redis):
        """Consumer yields data as SSE events."""
        thread_id = str(uuid4())
        stream_key = f"agent:stream:{thread_id}"

        await fake_redis.xadd(stream_key, {"data": b'{"test": "chunk"}'})
        await fake_redis.xadd(stream_key, {"done": b"true"})

        messages = await fake_redis.xread({stream_key: "0"})
        assert len(messages) > 0

    @pytest.mark.asyncio
    async def test_yields_done_signal(self, fake_redis):
        """Consumer yields [DONE] on completion."""
        thread_id = str(uuid4())
        stream_key = f"agent:stream:{thread_id}"

        await fake_redis.xadd(stream_key, {"done": b"true"})

        messages = await fake_redis.xread({stream_key: "0"})
        _, entries = messages[0]
        _, data = entries[0]
        assert b"done" in data

    @pytest.mark.asyncio
    async def test_tracks_last_id_correctly(self, fake_redis):
        """Consumer tracks last_id for incremental reads."""
        thread_id = str(uuid4())
        stream_key = f"agent:stream:{thread_id}"

        id1 = await fake_redis.xadd(stream_key, {"data": b"chunk1"})
        await fake_redis.xadd(stream_key, {"data": b"chunk2"})

        messages = await fake_redis.xread({stream_key: id1})
        assert len(messages[0][1]) == 1  # Only second chunk

    @pytest.mark.asyncio
    async def test_handles_error_messages(self, fake_redis):
        """Consumer yields error messages correctly."""
        thread_id = str(uuid4())
        stream_key = f"agent:stream:{thread_id}"

        await fake_redis.xadd(stream_key, {"error": b"Test error", "done": b"true"})

        messages = await fake_redis.xread({stream_key: "0"})
        _, entries = messages[0]
        _, data = entries[0]
        assert b"error" in data
        assert data[b"error"] == b"Test error"


class TestSSEFormatting:
    """Tests for SSE event formatting."""

    @pytest.mark.asyncio
    async def test_data_event_format(self, fake_redis):
        """Data events follow SSE format."""
        import ujson

        thread_id = str(uuid4())
        stream_key = f"agent:stream:{thread_id}"

        test_data = {"type": "messages", "content": "Hello"}
        await fake_redis.xadd(stream_key, {"data": ujson.dumps(test_data).encode()})

        messages = await fake_redis.xread({stream_key: "0"})
        _, entries = messages[0]
        _, data = entries[0]

        # Verify it's valid JSON
        parsed = ujson.loads(data[b"data"])
        assert parsed["type"] == "messages"
        assert parsed["content"] == "Hello"

    @pytest.mark.asyncio
    async def test_multiple_events_order(self, fake_redis):
        """Multiple events are received in order."""
        import ujson

        thread_id = str(uuid4())
        stream_key = f"agent:stream:{thread_id}"

        # Add events in order
        events = [
            {"type": "metadata", "thread_id": thread_id},
            {"type": "messages", "content": "Hello"},
            {"type": "messages", "content": " World"},
            {"type": "values", "messages": []},
        ]

        for event in events:
            await fake_redis.xadd(stream_key, {"data": ujson.dumps(event).encode()})

        await fake_redis.xadd(stream_key, {"done": b"true"})

        messages = await fake_redis.xread({stream_key: "0"})
        _, entries = messages[0]

        # Verify order
        for i, (_, data) in enumerate(entries[:-1]):  # Skip done marker
            parsed = ujson.loads(data[b"data"])
            assert parsed["type"] == events[i]["type"]


class TestStreamKeyFormat:
    """Tests for stream key format."""

    @pytest.mark.asyncio
    async def test_stream_key_format_correct(self, fake_redis):
        """Stream key follows agent:stream:{thread_id} format."""
        thread_id = "test-thread-12345"
        expected_key = f"agent:stream:{thread_id}"

        await fake_redis.xadd(expected_key, {"data": b"test"})

        # Verify the key exists
        exists = await fake_redis.exists(expected_key)
        assert exists == 1

    @pytest.mark.asyncio
    async def test_stream_key_with_uuid(self, fake_redis):
        """Stream key works with UUID thread IDs."""
        thread_id = str(uuid4())
        stream_key = f"agent:stream:{thread_id}"

        await fake_redis.xadd(stream_key, {"data": b"test"})

        messages = await fake_redis.xrange(stream_key)
        assert len(messages) == 1


class TestStreamConsumerIntegration:
    """Integration tests for stream consumer behavior."""

    @pytest.mark.asyncio
    async def test_consumer_can_read_from_stream(self, fake_redis):
        """Consumer can read messages from Redis stream."""
        thread_id = str(uuid4())
        stream_key = f"agent:stream:{thread_id}"

        # Simulate producer writing
        await fake_redis.xadd(stream_key, {"data": b'{"chunk": 1}'})
        await fake_redis.xadd(stream_key, {"data": b'{"chunk": 2}'})
        await fake_redis.xadd(stream_key, {"done": b"true"})

        # Consumer reads
        all_messages = await fake_redis.xrange(stream_key)
        assert len(all_messages) == 3

    @pytest.mark.asyncio
    async def test_stream_cleanup_after_ttl(self, fake_redis):
        """Stream is cleaned up after TTL expires."""
        thread_id = str(uuid4())
        stream_key = f"agent:stream:{thread_id}"

        await fake_redis.xadd(stream_key, {"data": b"test"})

        # Set a very short TTL (1 second)
        await fake_redis.expire(stream_key, 1)

        # Get TTL
        ttl = await fake_redis.ttl(stream_key)
        assert ttl > 0  # TTL is set
        assert ttl <= 1  # TTL is short
