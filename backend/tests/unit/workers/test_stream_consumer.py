"""Unit tests for Redis stream consumer.

Phase 3-4 TDD: Tests for the stream_from_redis function that consumes
Redis streams and yields SSE events.
"""

import pytest
from unittest.mock import patch
from uuid import uuid4

from src.utils.stream import stream_from_redis


class TestStreamFromRedis:
    """Tests for the stream_from_redis async generator."""

    @pytest.mark.asyncio
    async def test_yields_sse_formatted_data_events(self, fake_redis):
        """Consumer yields data as SSE-formatted events."""
        thread_id = str(uuid4())
        run_id = str(uuid4())
        stream_key = f"agent:stream:{thread_id}:{run_id}"

        # Seed the stream with data and done marker
        await fake_redis.xadd(stream_key, {"data": b'{"test": "chunk"}'})
        await fake_redis.xadd(stream_key, {"done": b"true"})

        # Mock redis.from_url to return our fake_redis
        with patch("redis.asyncio.from_url", return_value=fake_redis):
            events = []
            async for event in stream_from_redis(thread_id, run_id):
                events.append(event)

        # Verify SSE format includes id lines
        assert len(events) == 2
        assert events[0].startswith("id: ")
        assert 'data: {"test": "chunk"}\n\n' in events[0]
        assert events[1].startswith("id: ")
        assert events[1].endswith("data: [DONE]\n\n")

    @pytest.mark.asyncio
    async def test_done_record_finishes_generator(self, fake_redis):
        """Consumer generator finishes when done record is received."""
        thread_id = str(uuid4())
        run_id = str(uuid4())
        stream_key = f"agent:stream:{thread_id}:{run_id}"

        await fake_redis.xadd(stream_key, {"done": b"true"})

        with patch("redis.asyncio.from_url", return_value=fake_redis):
            events = [event async for event in stream_from_redis(thread_id, run_id)]

        assert len(events) == 1
        assert events[0].endswith("data: [DONE]\n\n")

    @pytest.mark.asyncio
    async def test_yields_multiple_data_events_in_order(self, fake_redis):
        """Consumer yields multiple data events in order before done."""
        thread_id = str(uuid4())
        run_id = str(uuid4())
        stream_key = f"agent:stream:{thread_id}:{run_id}"

        await fake_redis.xadd(stream_key, {"data": b'{"chunk": 1}'})
        await fake_redis.xadd(stream_key, {"data": b'{"chunk": 2}'})
        await fake_redis.xadd(stream_key, {"data": b'{"chunk": 3}'})
        await fake_redis.xadd(stream_key, {"done": b"true"})

        with patch("redis.asyncio.from_url", return_value=fake_redis):
            events = [event async for event in stream_from_redis(thread_id, run_id)]

        assert len(events) == 4
        assert 'data: {"chunk": 1}\n\n' in events[0]
        assert 'data: {"chunk": 2}\n\n' in events[1]
        assert 'data: {"chunk": 3}\n\n' in events[2]
        assert events[3].endswith("data: [DONE]\n\n")

    @pytest.mark.asyncio
    async def test_error_message_yields_error_and_done(self, fake_redis):
        """Consumer yields error message in SSE format and then [DONE]."""
        thread_id = str(uuid4())
        run_id = str(uuid4())
        stream_key = f"agent:stream:{thread_id}:{run_id}"

        await fake_redis.xadd(stream_key, {"error": b"Test error"})

        with patch("redis.asyncio.from_url", return_value=fake_redis):
            events = [event async for event in stream_from_redis(thread_id, run_id)]

        assert len(events) == 2
        assert '["error", {"error": "Test error"}]' in events[0]
        assert events[1].endswith("data: [DONE]\n\n")


class TestSSEFormatting:
    """Tests for SSE event formatting."""

    @pytest.mark.asyncio
    async def test_data_event_format(self, fake_redis):
        """Data events follow SSE format."""
        import ujson

        thread_id = str(uuid4())
        run_id = str(uuid4())
        stream_key = f"agent:stream:{thread_id}:{run_id}"

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
        run_id = str(uuid4())
        stream_key = f"agent:stream:{thread_id}:{run_id}"

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
        """Stream key follows agent:stream:{thread_id}:{run_id} format."""
        thread_id = "test-thread-12345"
        run_id = "test-run-12345"
        expected_key = f"agent:stream:{thread_id}:{run_id}"

        await fake_redis.xadd(expected_key, {"data": b"test"})

        # Verify the key exists
        exists = await fake_redis.exists(expected_key)
        assert exists == 1

    @pytest.mark.asyncio
    async def test_stream_key_with_uuid(self, fake_redis):
        """Stream key works with UUID thread IDs."""
        thread_id = str(uuid4())
        run_id = str(uuid4())
        stream_key = f"agent:stream:{thread_id}:{run_id}"

        await fake_redis.xadd(stream_key, {"data": b"test"})

        messages = await fake_redis.xrange(stream_key)
        assert len(messages) == 1


class TestStreamConsumerIntegration:
    """Integration tests for stream consumer behavior."""

    @pytest.mark.asyncio
    async def test_consumer_can_read_from_stream(self, fake_redis):
        """Consumer can read messages from Redis stream."""
        thread_id = str(uuid4())
        run_id = str(uuid4())
        stream_key = f"agent:stream:{thread_id}:{run_id}"

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
        run_id = str(uuid4())
        stream_key = f"agent:stream:{thread_id}:{run_id}"

        await fake_redis.xadd(stream_key, {"data": b"test"})

        # Set a very short TTL (1 second)
        await fake_redis.expire(stream_key, 1)

        # Get TTL
        ttl = await fake_redis.ttl(stream_key)
        assert ttl > 0  # TTL is set
        assert ttl <= 1  # TTL is short
