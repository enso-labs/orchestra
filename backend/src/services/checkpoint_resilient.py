"""Resilient PostgresSaver wrapper for Supabase Supavisor compatibility.

This module provides a wrapper around LangGraph's AsyncPostgresSaver that:
1. Handles SSL connection drops gracefully via automatic reconnection
2. Monitors connection health proactively
3. Implements targeted retry logic for transient failures
4. Optionally falls back to InMemorySaver when Postgres is unavailable
5. Maintains connection state across operations

Design Rationale:
- Supabase Supavisor can drop connections due to pooler reassignment
- LangGraph pipeline mode requires stable, long-lived connections
- TCP keepalives detect stale connections but don't prevent them
- Automatic reconnection with state preservation provides resilience
"""

import asyncio
import random
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Optional, Sequence

from langgraph.checkpoint.base import (
    BaseCheckpointSaver,
    ChannelVersions,
    Checkpoint,
    CheckpointMetadata,
    CheckpointTuple,
)
from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langchain_core.runnables.config import RunnableConfig
from psycopg import AsyncConnection
from psycopg.rows import dict_row

from src.constants import (
    CHECKPOINT_ENABLE_FALLBACK,
    CHECKPOINT_HEALTH_CHECK_INTERVAL,
    CHECKPOINT_JITTER,
    CHECKPOINT_MAX_DELAY,
    CHECKPOINT_MAX_RETRIES,
    CHECKPOINT_RETRY_DELAY,
    DB_KEEPALIVE_COUNT,
    DB_KEEPALIVE_IDLE,
    DB_KEEPALIVE_INTERVAL,
    DB_URI_SESSION,
)
from src.services.errors import (
    CheckpointConnectionError,
    PermanentCheckpointError,
    RetryableCheckpointError,
    classify_checkpoint_error,
)
from src.utils.logger import logger


class ResilientAsyncPostgresSaver(BaseCheckpointSaver):
    """Resilient wrapper around AsyncPostgresSaver for Supabase compatibility.

    This class maintains a single connection and AsyncPostgresSaver instance,
    with automatic reconnection on transient failures.

    Usage:
        # Create and connect
        saver = ResilientAsyncPostgresSaver()
        await saver.connect()

        # Use like normal AsyncPostgresSaver
        await saver.aput(config, checkpoint, metadata, new_versions)
        checkpoint = await saver.aget(config)

        # Cleanup
        await saver.close()

        # Or use as context manager
        async with ResilientAsyncPostgresSaver.create() as saver:
            await saver.aput(...)

    Attributes:
        _connection: The underlying psycopg AsyncConnection
        _saver: The wrapped AsyncPostgresSaver instance
        _last_health_check: Timestamp of last successful health check
        _is_connected: Connection state flag
    """

    # Class-level serde attribute (required by LangGraph)
    serde = AsyncPostgresSaver.serde

    def __init__(
        self,
        connection_string: Optional[str] = None,
        max_retries: int = CHECKPOINT_MAX_RETRIES,
        base_delay: float = CHECKPOINT_RETRY_DELAY,
        max_delay: float = CHECKPOINT_MAX_DELAY,
        jitter: float = CHECKPOINT_JITTER,
        enable_fallback: bool = CHECKPOINT_ENABLE_FALLBACK,
        health_check_interval: int = CHECKPOINT_HEALTH_CHECK_INTERVAL,
        keepalives: int = 1,
        keepalives_idle: int = DB_KEEPALIVE_IDLE,
        keepalives_interval: int = DB_KEEPALIVE_INTERVAL,
        keepalives_count: int = DB_KEEPALIVE_COUNT,
    ):
        """Initialize the resilient checkpointer.

        Args:
            connection_string: PostgreSQL connection string (uses DB_URI_SESSION if not provided)
            max_retries: Maximum retry attempts per operation (default: from config)
            base_delay: Initial retry delay in seconds (default: from config)
            max_delay: Maximum retry delay cap in seconds (default: from config)
            jitter: Randomization factor for delay (0.0-1.0, default: from config)
            enable_fallback: Enable InMemorySaver fallback (default: from config)
            health_check_interval: Seconds between health checks (default: from config)
            keepalives: Enable TCP keepalive (1=on, 0=off)
            keepalives_idle: Seconds idle before first keepalive probe
            keepalives_interval: Seconds between keepalive probes
            keepalives_count: Number of failed probes before connection considered dead
        """
        self._connection_string = connection_string or DB_URI_SESSION
        self._max_retries = max_retries
        self._base_delay = base_delay
        self._max_delay = max_delay
        self._jitter = jitter
        self._enable_fallback = enable_fallback
        self._health_check_interval = health_check_interval
        self._keepalives = keepalives
        self._keepalives_idle = keepalives_idle
        self._keepalives_interval = keepalives_interval
        self._keepalives_count = keepalives_count

        # Connection state
        self._connection: Optional[AsyncConnection] = None
        self._saver: Optional[AsyncPostgresSaver] = None
        self._last_health_check: float = 0
        self._is_connected: bool = False
        self._lock = asyncio.Lock()

        # Fallback saver
        self._fallback_saver: Optional[MemorySaver] = MemorySaver() if enable_fallback else None
        self._using_fallback: bool = False

        # Metrics
        self._retry_count: int = 0
        self._fallback_count: int = 0

    def _get_connection_kwargs(self) -> dict:
        """Generate connection kwargs optimized for checkpointing."""
        return {
            "autocommit": True,
            "prepare_threshold": None,  # Disable prepared statements for pooler compatibility
            "row_factory": dict_row,
            "keepalives": self._keepalives,
            "keepalives_idle": self._keepalives_idle,
            "keepalives_interval": self._keepalives_interval,
            "keepalives_count": self._keepalives_count,
        }

    async def connect(self) -> None:
        """Establish connection and create the underlying saver."""
        async with self._lock:
            if self._is_connected:
                return

            try:
                kwargs = self._get_connection_kwargs()
                self._connection = await AsyncConnection.connect(self._connection_string, **kwargs)
                self._saver = AsyncPostgresSaver(self._connection)
                self._is_connected = True
                self._using_fallback = False
                self._last_health_check = asyncio.get_event_loop().time()
                logger.info(
                    "checkpoint_connection_established",
                    extra={
                        "event": "checkpoint_connection_established",
                        "status": "success",
                    },
                )
            except Exception as e:
                logger.error(
                    "checkpoint_connection_failed",
                    extra={
                        "event": "checkpoint_connection_failed",
                        "error": str(e),
                    },
                )
                raise CheckpointConnectionError(f"Initial connection failed: {e}") from e

    async def close(self) -> None:
        """Close connection and cleanup resources."""
        async with self._lock:
            if self._connection and not self._connection.closed:
                try:
                    await self._connection.close()
                except Exception as e:
                    logger.debug(f"Error closing checkpoint connection: {e}")
            self._connection = None
            self._saver = None
            self._is_connected = False
            logger.info(
                "checkpoint_connection_closed",
                extra={
                    "event": "checkpoint_connection_closed",
                },
            )

    async def _check_connection_health(self) -> bool:
        """Check if connection is healthy via lightweight query.

        Returns True if connection is healthy, False otherwise.
        Skips check if last check was within health_check_interval.
        """
        if not self._is_connected or not self._connection:
            return False

        if self._connection.closed:
            self._is_connected = False
            return False

        current_time = asyncio.get_event_loop().time()
        if current_time - self._last_health_check < self._health_check_interval:
            return True

        try:
            # Lightweight health check
            async with self._connection.cursor() as cur:
                await cur.execute("SELECT 1")
            self._last_health_check = current_time
            return True
        except Exception as e:
            logger.warning(
                "checkpoint_health_check_failed",
                extra={
                    "event": "checkpoint_health_check_failed",
                    "error": str(e),
                },
            )
            self._is_connected = False
            return False

    async def _reconnect(self) -> None:
        """Close existing connection and establish a new one."""
        async with self._lock:
            logger.info(
                "checkpoint_reconnect_attempt",
                extra={
                    "event": "checkpoint_reconnect_attempt",
                },
            )

            # Close existing connection if any
            if self._connection and not self._connection.closed:
                try:
                    await self._connection.close()
                except Exception:
                    pass

            self._connection = None
            self._saver = None
            self._is_connected = False

            # Establish new connection
            kwargs = self._get_connection_kwargs()
            self._connection = await AsyncConnection.connect(self._connection_string, **kwargs)
            self._saver = AsyncPostgresSaver(self._connection)
            self._is_connected = True
            self._using_fallback = False
            self._last_health_check = asyncio.get_event_loop().time()
            logger.info(
                "checkpoint_reconnect_success",
                extra={
                    "event": "checkpoint_reconnect_success",
                    "status": "success",
                },
            )

    def _calculate_delay(self, attempt: int) -> float:
        """Calculate delay with exponential backoff and jitter."""
        base = self._base_delay * (2**attempt)
        capped = min(base, self._max_delay)
        jitter_amount = capped * self._jitter * random.random()
        return capped + jitter_amount

    async def _execute_with_retry(
        self,
        operation_name: str,
        operation,
        *args,
        **kwargs,
    ):
        """Execute an operation with retry logic.

        Args:
            operation_name: Name for logging
            operation: Async callable to execute
            *args, **kwargs: Arguments to pass to operation

        Returns:
            Result of the operation

        Raises:
            PermanentCheckpointError: If error is non-retryable
            CheckpointConnectionError: If all retries exhausted and no fallback
        """
        last_error: Optional[Exception] = None

        for attempt in range(self._max_retries):
            try:
                # Ensure connection is healthy before operation
                if not await self._check_connection_health():
                    await self._reconnect()

                return await operation(*args, **kwargs)

            except Exception as e:
                error_class = classify_checkpoint_error(e)
                last_error = error_class(str(e), original_error=e)

                # Log the failure
                logger.warning(
                    "checkpoint_operation_failed",
                    extra={
                        "event": "checkpoint_operation_failed",
                        "operation": operation_name,
                        "attempt": attempt + 1,
                        "max_retries": self._max_retries,
                        "error_type": error_class.__name__,
                        "retryable": error_class is RetryableCheckpointError,
                    },
                )

                # Don't retry permanent errors
                if error_class is PermanentCheckpointError:
                    raise last_error

                # Calculate backoff delay
                if attempt < self._max_retries - 1:
                    delay = self._calculate_delay(attempt)
                    self._retry_count += 1
                    logger.info(
                        "checkpoint_retry_scheduled",
                        extra={
                            "event": "checkpoint_retry_scheduled",
                            "operation": operation_name,
                            "attempt": attempt + 1,
                            "delay_seconds": delay,
                        },
                    )
                    await asyncio.sleep(delay)

                    # Force reconnection on next attempt
                    try:
                        await self._reconnect()
                    except Exception as reconnect_error:
                        logger.warning(
                            "checkpoint_reconnect_failed",
                            extra={
                                "event": "checkpoint_reconnect_failed",
                                "error": str(reconnect_error),
                            },
                        )

        # All retries exhausted - try fallback if enabled
        if self._enable_fallback and self._fallback_saver is not None:
            self._using_fallback = True
            self._fallback_count += 1
            logger.warning(
                "checkpoint_fallback_activated",
                extra={
                    "event": "checkpoint_fallback_activated",
                    "operation": operation_name,
                    "reason": "retries_exhausted",
                },
            )
            # Return None or let caller handle - fallback methods called separately
            return None

        raise CheckpointConnectionError(
            f"Checkpoint operation '{operation_name}' failed after {self._max_retries} attempts"
        ) from last_error

    async def setup(self) -> None:
        """Create checkpoint tables if they don't exist."""
        if not self._saver:
            await self.connect()
        if self._saver:
            await self._saver.setup()

    # Delegated methods with retry logic

    async def aget(self, config: RunnableConfig) -> Optional[Checkpoint]:
        """Get checkpoint for config."""
        if self._using_fallback and self._fallback_saver:
            tuple_result = self._fallback_saver.get_tuple(config)
            return tuple_result.checkpoint if tuple_result else None

        async def _op():
            if self._saver:
                tuple_result = await self._saver.aget_tuple(config)
                return tuple_result.checkpoint if tuple_result else None
            return None

        return await self._execute_with_retry("aget", _op)

    async def aget_tuple(self, config: RunnableConfig) -> Optional[CheckpointTuple]:
        """Get checkpoint tuple for config."""
        if self._using_fallback and self._fallback_saver:
            return self._fallback_saver.get_tuple(config)

        async def _op():
            if self._saver:
                return await self._saver.aget_tuple(config)
            return None

        return await self._execute_with_retry("aget_tuple", _op)

    async def aput(
        self,
        config: RunnableConfig,
        checkpoint: Checkpoint,
        metadata: CheckpointMetadata,
        new_versions: ChannelVersions,
    ) -> RunnableConfig:
        """Store checkpoint."""
        if self._using_fallback and self._fallback_saver:
            return self._fallback_saver.put(config, checkpoint, metadata, new_versions)

        async def _op():
            if self._saver:
                return await self._saver.aput(config, checkpoint, metadata, new_versions)
            return config

        result = await self._execute_with_retry("aput", _op)

        # If retry returned None (fallback activated), use fallback
        if result is None and self._using_fallback and self._fallback_saver:
            return self._fallback_saver.put(config, checkpoint, metadata, new_versions)

        return result

    async def aput_writes(
        self,
        config: RunnableConfig,
        writes: Sequence[tuple[str, Any]],
        task_id: str,
    ) -> None:
        """Store intermediate writes."""
        if self._using_fallback and self._fallback_saver:
            self._fallback_saver.put_writes(config, writes, task_id)
            return

        async def _op():
            if self._saver:
                return await self._saver.aput_writes(config, writes, task_id)

        result = await self._execute_with_retry("aput_writes", _op)

        # If retry returned None (fallback activated), use fallback
        if result is None and self._using_fallback and self._fallback_saver:
            self._fallback_saver.put_writes(config, writes, task_id)

    async def adelete_thread(self, thread_id: str) -> None:
        """Delete all checkpoints and writes associated with a thread.

        BaseCheckpointSaver.adelete_thread raises NotImplementedError by
        default, so this wrapper must forward to the underlying
        AsyncPostgresSaver (or the fallback) explicitly — otherwise thread
        deletion silently fails when resilient checkpointing is enabled.
        """
        if self._using_fallback and self._fallback_saver:
            await self._fallback_saver.adelete_thread(thread_id)
            return

        async def _op():
            if self._saver:
                return await self._saver.adelete_thread(thread_id)

        await self._execute_with_retry("adelete_thread", _op)

        # If retry activated the fallback, delete there too so a later
        # reconnect to Postgres doesn't surface the thread's checkpoints again.
        if self._using_fallback and self._fallback_saver:
            await self._fallback_saver.adelete_thread(thread_id)

    async def alist(
        self,
        config: Optional[RunnableConfig],
        *,
        filter: Optional[dict] = None,
        before: Optional[RunnableConfig] = None,
        limit: Optional[int] = None,
    ) -> AsyncIterator[CheckpointTuple]:
        """List checkpoints. Note: This is a generator, reconnect per iteration."""
        if self._using_fallback and self._fallback_saver:
            for item in self._fallback_saver.list(config, filter=filter, before=before, limit=limit):
                yield item
            return

        try:
            # Ensure connection is healthy
            if not await self._check_connection_health():
                await self._reconnect()

            if self._saver:
                async for checkpoint in self._saver.alist(config, filter=filter, before=before, limit=limit):
                    yield checkpoint
        except Exception as e:
            error_class = classify_checkpoint_error(e)
            logger.warning(
                "checkpoint_alist_failed",
                extra={
                    "event": "checkpoint_alist_failed",
                    "error_type": error_class.__name__,
                },
            )
            if self._enable_fallback and self._fallback_saver is not None:
                self._using_fallback = True
                for item in self._fallback_saver.list(config, filter=filter, before=before, limit=limit):
                    yield item
            else:
                raise error_class(str(e), original_error=e)

    # Required interface methods from BaseCheckpointSaver

    def get_next_version(self, current: Optional[str], channel: str) -> str:
        """Generate the next version ID for a channel.

        Delegates to the underlying saver or fallback.
        """
        if self._using_fallback and self._fallback_saver:
            return self._fallback_saver.get_next_version(current, channel)
        if self._saver:
            return self._saver.get_next_version(current, channel)
        # Default implementation if no saver available
        if current is None:
            return "1"
        return str(int(current) + 1)

    def get(self, config: RunnableConfig) -> Optional[Checkpoint]:
        """Synchronous get - delegates to underlying saver."""
        if self._using_fallback and self._fallback_saver:
            tuple_result = self._fallback_saver.get_tuple(config)
            return tuple_result.checkpoint if tuple_result else None
        if self._saver:
            # Note: This is sync, but underlying saver may not support it
            # In practice, LangGraph uses async methods
            tuple_result = self._saver.get_tuple(config)
            return tuple_result.checkpoint if tuple_result else None
        return None

    def get_tuple(self, config: RunnableConfig) -> Optional[CheckpointTuple]:
        """Synchronous get_tuple - delegates to underlying saver."""
        if self._using_fallback and self._fallback_saver:
            return self._fallback_saver.get_tuple(config)
        if self._saver:
            return self._saver.get_tuple(config)
        return None

    def put(
        self,
        config: RunnableConfig,
        checkpoint: Checkpoint,
        metadata: CheckpointMetadata,
        new_versions: ChannelVersions,
    ) -> RunnableConfig:
        """Synchronous put - delegates to underlying saver."""
        if self._using_fallback and self._fallback_saver:
            return self._fallback_saver.put(config, checkpoint, metadata, new_versions)
        if self._saver:
            return self._saver.put(config, checkpoint, metadata, new_versions)
        return config

    def put_writes(
        self,
        config: RunnableConfig,
        writes: Sequence[tuple[str, Any]],
        task_id: str,
    ) -> None:
        """Synchronous put_writes - delegates to underlying saver."""
        if self._using_fallback and self._fallback_saver:
            self._fallback_saver.put_writes(config, writes, task_id)
            return
        if self._saver:
            self._saver.put_writes(config, writes, task_id)

    @property
    def config_specs(self) -> list:
        """Return config specs from underlying saver."""
        if self._saver:
            return self._saver.config_specs
        return AsyncPostgresSaver.config_specs

    @property
    def is_using_fallback(self) -> bool:
        """Check if currently using fallback storage."""
        return self._using_fallback

    @property
    def metrics(self) -> dict:
        """Return current metrics for observability."""
        return {
            "retry_count": self._retry_count,
            "fallback_count": self._fallback_count,
            "using_fallback": self._using_fallback,
            "is_connected": self._is_connected,
        }

    # Context manager support

    async def __aenter__(self) -> "ResilientAsyncPostgresSaver":
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        await self.close()

    @classmethod
    @asynccontextmanager
    async def create(
        cls,
        connection_string: Optional[str] = None,
        **kwargs,
    ) -> AsyncIterator["ResilientAsyncPostgresSaver"]:
        """Factory context manager for creating a resilient saver."""
        saver = cls(connection_string, **kwargs)
        try:
            await saver.connect()
            yield saver
        finally:
            await saver.close()
