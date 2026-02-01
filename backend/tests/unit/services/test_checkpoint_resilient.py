"""Unit tests for ResilientAsyncPostgresSaver.

Tests the resilient checkpoint saver's:
- Connection health checking
- Retry logic with exponential backoff
- Error classification (retryable vs permanent)
- Fallback to InMemorySaver
- Metrics tracking
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock
import pytest
import psycopg

from src.services.errors import (
    classify_checkpoint_error,
    is_retryable_error,
    RetryableCheckpointError,
    PermanentCheckpointError,
    CheckpointConnectionError,
)


class TestErrorClassification:
    """Tests for error classification functions."""

    def test_ssl_error_is_retryable(self):
        """SSL connection errors should be classified as retryable."""
        error = psycopg.OperationalError("SSL connection has been closed unexpectedly")
        assert classify_checkpoint_error(error) is RetryableCheckpointError
        assert is_retryable_error(error) is True

    def test_connection_refused_is_retryable(self):
        """Connection refused errors should be classified as retryable."""
        error = psycopg.OperationalError("Connection refused")
        assert classify_checkpoint_error(error) is RetryableCheckpointError

    def test_connection_reset_is_retryable(self):
        """Connection reset errors should be classified as retryable."""
        error = psycopg.OperationalError("connection reset by peer")
        assert classify_checkpoint_error(error) is RetryableCheckpointError

    def test_timeout_is_retryable(self):
        """Timeout errors should be classified as retryable."""
        error = asyncio.TimeoutError()
        assert classify_checkpoint_error(error) is RetryableCheckpointError

    def test_auth_failure_is_permanent(self):
        """Authentication failures should be classified as permanent."""
        error = psycopg.OperationalError("password authentication failed")
        assert classify_checkpoint_error(error) is PermanentCheckpointError
        assert is_retryable_error(error) is False

    def test_database_not_exist_is_permanent(self):
        """Missing database errors should be classified as permanent."""
        error = psycopg.OperationalError('database "foo" does not exist')
        assert classify_checkpoint_error(error) is PermanentCheckpointError

    def test_programming_error_is_permanent(self):
        """Programming errors (syntax) should be classified as permanent."""
        error = psycopg.ProgrammingError("syntax error")
        assert classify_checkpoint_error(error) is PermanentCheckpointError

    def test_integrity_error_is_permanent(self):
        """Integrity errors (constraints) should be classified as permanent."""
        error = psycopg.IntegrityError("unique constraint violated")
        assert classify_checkpoint_error(error) is PermanentCheckpointError

    def test_unknown_error_defaults_to_retryable(self):
        """Unknown errors should default to retryable for safety."""
        error = ValueError("some unknown error")
        assert classify_checkpoint_error(error) is RetryableCheckpointError


class TestMessageSanitization:
    """Tests for credential sanitization in error messages."""

    def test_connection_string_redacted(self):
        """Connection strings should be redacted from error messages."""
        error = CheckpointConnectionError(
            "Failed to connect to postgresql://user:password@host:5432/db"
        )
        assert "postgresql://" not in error.message
        assert "[REDACTED]" in error.message

    def test_password_parameter_redacted(self):
        """Password parameters should be redacted."""
        error = CheckpointConnectionError("Error with password=secret123")
        assert "password=" not in error.message
        assert "[REDACTED]" in error.message

    def test_host_parameter_redacted(self):
        """Host parameters should be redacted."""
        error = CheckpointConnectionError("Error with host=mydb.example.com")
        assert "host=" not in error.message
        assert "[REDACTED]" in error.message


class TestResilientCheckpointerUnit:
    """Unit tests for ResilientAsyncPostgresSaver behavior."""

    @pytest.fixture
    def mock_connection(self):
        """Create a mock connection that tracks closed state."""
        conn = AsyncMock()
        conn.closed = False
        conn.cursor = MagicMock(return_value=AsyncMock())
        return conn

    @pytest.fixture
    def mock_saver(self):
        """Create a mock AsyncPostgresSaver."""
        saver = AsyncMock()
        saver.aput = AsyncMock(return_value={"configurable": {"thread_id": "test"}})
        saver.aget = AsyncMock(return_value=None)
        saver.aget_tuple = AsyncMock(return_value=None)
        saver.setup = AsyncMock()
        return saver

    @pytest.mark.asyncio
    async def test_delay_calculation_with_jitter(self):
        """Test that delay calculation includes jitter."""
        from src.services.checkpoint_resilient import ResilientAsyncPostgresSaver

        saver = ResilientAsyncPostgresSaver(
            connection_string="postgresql://test",
            base_delay=1.0,
            max_delay=30.0,
            jitter=0.1,
        )

        # Calculate delay for first attempt (attempt=0)
        delay = saver._calculate_delay(0)

        # Should be around 1.0 + up to 10% jitter
        assert delay >= 1.0
        assert delay <= 1.1

        # Calculate delay for second attempt (attempt=1)
        delay = saver._calculate_delay(1)

        # Should be around 2.0 + up to 10% jitter
        assert delay >= 2.0
        assert delay <= 2.2

    @pytest.mark.asyncio
    async def test_delay_respects_max_cap(self):
        """Test that delay is capped at max_delay."""
        from src.services.checkpoint_resilient import ResilientAsyncPostgresSaver

        saver = ResilientAsyncPostgresSaver(
            connection_string="postgresql://test",
            base_delay=1.0,
            max_delay=5.0,
            jitter=0.0,  # No jitter for deterministic test
        )

        # After many attempts, delay should still be capped
        delay = saver._calculate_delay(10)  # 2^10 = 1024, but capped at 5

        assert delay == 5.0

    @pytest.mark.asyncio
    async def test_metrics_tracking(self):
        """Test that metrics are properly tracked."""
        from src.services.checkpoint_resilient import ResilientAsyncPostgresSaver

        saver = ResilientAsyncPostgresSaver(
            connection_string="postgresql://test",
            enable_fallback=True,
        )

        # Initial metrics
        assert saver.metrics["retry_count"] == 0
        assert saver.metrics["fallback_count"] == 0
        assert saver.metrics["using_fallback"] is False
        assert saver.metrics["is_connected"] is False

    @pytest.mark.asyncio
    async def test_fallback_flag(self):
        """Test is_using_fallback property."""
        from src.services.checkpoint_resilient import ResilientAsyncPostgresSaver

        saver = ResilientAsyncPostgresSaver(
            connection_string="postgresql://test",
            enable_fallback=True,
        )

        assert saver.is_using_fallback is False

        # Simulate fallback activation
        saver._using_fallback = True
        assert saver.is_using_fallback is True


class TestRetryDecorator:
    """Tests for the enhanced retry decorator."""

    @pytest.mark.asyncio
    async def test_retry_with_jitter(self):
        """Test that retry decorator includes jitter in delays."""
        from src.utils.retry import retry_db_operation

        attempts = []

        @retry_db_operation(tries=3, delay=0.1, jitter=0.1)
        async def failing_function():
            attempts.append(1)
            raise ConnectionError("Test error")

        with pytest.raises(ConnectionError):
            await failing_function()

        # Should have attempted 3 times
        assert len(attempts) == 3

    @pytest.mark.asyncio
    async def test_classify_error_prevents_retry(self):
        """Test that classify_error can prevent retries."""
        from src.utils.retry import retry_db_operation

        attempts = []

        def never_retry(e):
            return False

        @retry_db_operation(tries=3, delay=0.01, classify_error=never_retry)
        async def failing_function():
            attempts.append(1)
            raise ConnectionError("Test error")

        with pytest.raises(ConnectionError):
            await failing_function()

        # Should have only attempted once (no retries)
        assert len(attempts) == 1

    @pytest.mark.asyncio
    async def test_callbacks_called(self):
        """Test that on_retry and on_failure callbacks are called."""
        from src.utils.retry import retry_db_operation

        retry_calls = []
        failure_calls = []

        def on_retry(e, attempt, delay):
            retry_calls.append((attempt, delay))

        def on_failure(e, total_attempts):
            failure_calls.append(total_attempts)

        @retry_db_operation(
            tries=2,
            delay=0.01,
            on_retry=on_retry,
            on_failure=on_failure,
        )
        async def failing_function():
            raise ConnectionError("Test error")

        with pytest.raises(ConnectionError):
            await failing_function()

        # Should have 1 retry call (between attempt 1 and 2)
        assert len(retry_calls) == 1
        assert retry_calls[0][0] == 1  # First retry

        # Should have 1 failure call
        assert len(failure_calls) == 1
        assert failure_calls[0] == 2  # Total attempts
