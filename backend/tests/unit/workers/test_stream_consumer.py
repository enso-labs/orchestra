"""Unit tests for PostgreSQL stream consumer.

Phase 3-4 TDD: Tests for the stream_from_postgres function that consumes
PostgreSQL events and yields SSE events.
"""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from uuid import uuid4

from src.utils.stream import stream_from_postgres


class TestStreamFromPostgres:
    """Tests for the stream_from_postgres async generator."""

    @pytest.mark.asyncio
    async def test_yields_sse_formatted_data_events(self):
        """Consumer yields data as SSE-formatted events."""
        thread_id = str(uuid4())

        # Mock asyncpg connection
        mock_conn = AsyncMock()
        mock_conn.fetch = AsyncMock(
            side_effect=[
                [{"id": 1, "data": '{"test": "chunk"}', "error": None, "done": False}],
                [{"id": 2, "data": None, "error": None, "done": True}],
            ]
        )
        mock_conn.add_listener = AsyncMock()
        mock_conn.remove_listener = AsyncMock()
        mock_conn.close = AsyncMock()

        with patch("asyncpg.connect", return_value=mock_conn):
            events = []
            async for event in stream_from_postgres(thread_id):
                events.append(event)

        # Verify SSE format: "data: {...}\n\n"
        assert len(events) == 2
        assert events[0] == 'data: {"test": "chunk"}\n\n'
        assert events[1] == "data: [DONE]\n\n"

    @pytest.mark.asyncio
    async def test_done_record_finishes_generator(self):
        """Consumer generator finishes when done record is received."""
        thread_id = str(uuid4())

        mock_conn = AsyncMock()
        mock_conn.fetch = AsyncMock(
            return_value=[{"id": 1, "data": None, "error": None, "done": True}]
        )
        mock_conn.add_listener = AsyncMock()
        mock_conn.remove_listener = AsyncMock()
        mock_conn.close = AsyncMock()

        with patch("asyncpg.connect", return_value=mock_conn):
            events = [event async for event in stream_from_postgres(thread_id)]

        assert len(events) == 1
        assert events[0] == "data: [DONE]\n\n"

    @pytest.mark.asyncio
    async def test_yields_multiple_data_events_in_order(self):
        """Consumer yields multiple data events in order before done."""
        thread_id = str(uuid4())

        mock_conn = AsyncMock()
        mock_conn.fetch = AsyncMock(
            side_effect=[
                [
                    {"id": 1, "data": '{"chunk": 1}', "error": None, "done": False},
                    {"id": 2, "data": '{"chunk": 2}', "error": None, "done": False},
                    {"id": 3, "data": '{"chunk": 3}', "error": None, "done": False},
                ],
                [{"id": 4, "data": None, "error": None, "done": True}],
            ]
        )
        mock_conn.add_listener = AsyncMock()
        mock_conn.remove_listener = AsyncMock()
        mock_conn.close = AsyncMock()

        with patch("asyncpg.connect", return_value=mock_conn):
            events = [event async for event in stream_from_postgres(thread_id)]

        assert len(events) == 4
        assert events[0] == 'data: {"chunk": 1}\n\n'
        assert events[1] == 'data: {"chunk": 2}\n\n'
        assert events[2] == 'data: {"chunk": 3}\n\n'
        assert events[3] == "data: [DONE]\n\n"

    @pytest.mark.asyncio
    async def test_error_message_yields_error_and_done(self):
        """Consumer yields error message in SSE format and then [DONE]."""
        thread_id = str(uuid4())

        mock_conn = AsyncMock()
        mock_conn.fetch = AsyncMock(
            return_value=[{"id": 1, "data": None, "error": "Test error", "done": True}]
        )
        mock_conn.add_listener = AsyncMock()
        mock_conn.remove_listener = AsyncMock()
        mock_conn.close = AsyncMock()

        with patch("asyncpg.connect", return_value=mock_conn):
            events = [event async for event in stream_from_postgres(thread_id)]

        assert len(events) == 2
        assert events[0] == 'data: {"error": "Test error"}\n\n'
        assert events[1] == "data: [DONE]\n\n"


class TestSSEFormatting:
    """Tests for SSE event formatting."""

    @pytest.mark.asyncio
    async def test_data_event_format(self):
        """Data events follow SSE format."""
        import ujson

        test_data = {"type": "messages", "content": "Hello"}

        mock_conn = AsyncMock()
        mock_conn.fetch = AsyncMock(
            side_effect=[
                [
                    {
                        "id": 1,
                        "data": ujson.dumps(test_data),
                        "error": None,
                        "done": False,
                    }
                ],
                [{"id": 2, "data": None, "error": None, "done": True}],
            ]
        )
        mock_conn.add_listener = AsyncMock()
        mock_conn.remove_listener = AsyncMock()
        mock_conn.close = AsyncMock()

        with patch("asyncpg.connect", return_value=mock_conn):
            events = [event async for event in stream_from_postgres("test-thread")]

        # First event should be data
        assert 'data: {"type": "messages"' in events[0]
        assert events[1] == "data: [DONE]\n\n"


class TestStreamConsumerIntegration:
    """Integration tests for stream consumer behavior."""

    @pytest.mark.asyncio
    async def test_consumer_handles_connection_error(self):
        """Consumer handles connection errors gracefully."""
        thread_id = str(uuid4())

        mock_conn = AsyncMock()
        mock_conn.add_listener = AsyncMock()
        mock_conn.remove_listener = AsyncMock()
        mock_conn.close = AsyncMock()
        mock_conn.fetch = AsyncMock(side_effect=Exception("Connection lost"))

        with patch("asyncpg.connect", return_value=mock_conn):
            events = [event async for event in stream_from_postgres(thread_id)]

        # Should yield error and done
        assert len(events) == 2
        assert "error" in events[0]
        assert events[1] == "data: [DONE]\n\n"
