# PROPOSAL_GUARDIAN.md
## Stabilize LangGraph Postgres Checkpointing on Supabase

**Agent**: GUARDIAN (Security, Error Handling, Edge Cases, Testing)
**Date**: 2026-01-19
**Feature**: Supabase LangGraph Checkpoint Stability

---

## 1. Executive Summary

The proposed solution implements a defensive, multi-layered resilience strategy around LangGraph checkpoint operations to prevent SSL connection failures from crashing agent execution. The approach wraps the `AsyncPostgresSaver` with a custom `ResilientCheckpointSaver` that provides automatic retry with exponential backoff, connection health validation, graceful degradation to in-memory fallback, and comprehensive structured logging for operational observability. This design ensures checkpoint failures degrade gracefully rather than catastrophically, maintaining agent execution continuity even under transient database connectivity issues.

---

## 2. Architectural Analysis

### 2.1 Current State Assessment

#### Connection Management (`backend/src/services/db.py`)
- **Current Pattern**: Uses `AsyncConnection.connect()` as an async context manager creating fresh connections per checkpoint operation
- **Configuration**: Sets `prepare_threshold=None` and `autocommit=True` for Supavisor compatibility
- **Issue**: No connection validation, no retry logic, no health checks between operations
- **Risk**: Each `get_checkpoint_db()` call creates a new connection vulnerable to SSL termination

#### Checkpoint Service (`backend/src/services/checkpoint.py`)
- **Current Pattern**: Uses `@retry_db_operation` decorator on `list_checkpoints()` only
- **Issue**: Critical methods `create_checkpoint()`, `get_checkpoint()`, `delete_checkpoints_for_thread()` lack retry protection
- **Issue**: Catches generic `Exception` with broad logging but no error classification
- **Risk**: SSL failures during checkpoint write leave agent in inconsistent state

#### TaskIQ Workers (`backend/src/workers/tasks.py`)
- **Current Pattern**: Creates fresh checkpoint connection per task via `get_checkpoint_db()`
- **Issue**: No connection pooling or reuse between streaming iterations
- **Issue**: Final state update after stream completion uses same fragile connection
- **Risk**: Connection churn under load, race conditions during high concurrency

#### Stream Generator (`backend/src/utils/stream.py`)
- **Current Pattern**: Single checkpoint connection for entire stream duration
- **Issue**: Long-running streams (minutes) exceed Supavisor connection timeouts
- **Issue**: `finally` block assumes checkpointer is still valid after streaming
- **Risk**: SSL disconnect mid-stream corrupts checkpoint state

#### Retry Utility (`backend/src/utils/retry.py`)
- **Strength**: Well-designed decorator supporting both sync/async functions
- **Issue**: Catches all exceptions equally, no distinction between retryable vs. permanent failures
- **Issue**: No jitter in backoff, potential thundering herd under load
- **Gap**: No callback hooks for logging retry attempts or alerting

### 2.2 Error Classification Analysis

The SSL connection errors observed fall into these categories:

| Error Type | Exception Class | Retryable | Typical Cause |
|------------|-----------------|-----------|---------------|
| SSL EOF | `psycopg.OperationalError` | Yes | Supavisor timeout, network blip |
| Connection closed unexpectedly | `psycopg.OperationalError` | Yes | Pooler connection recycling |
| Connection refused | `psycopg.OperationalError` | Maybe | Database overload, restart |
| Authentication failed | `psycopg.OperationalError` | No | Credentials issue |
| Syntax/Query error | `psycopg.ProgrammingError` | No | Code bug |
| Constraint violation | `psycopg.IntegrityError` | No | Data issue |
| Timeout | `asyncio.TimeoutError` | Yes | Network latency |

### 2.3 Proposed Architecture

```
                                    +-------------------+
                                    |   Agent Stream    |
                                    +--------+----------+
                                             |
                                             v
                        +--------------------+--------------------+
                        |         ResilientCheckpointSaver        |
                        |  (Wrapper around AsyncPostgresSaver)    |
                        +--------------------+--------------------+
                                             |
               +-----------------------------+-----------------------------+
               |                             |                             |
               v                             v                             v
    +----------+----------+     +-----------+----------+     +-------------+--------+
    | Connection Health   |     | Retry Logic with     |     | Fallback Strategy   |
    | Validator           |     | Exponential Backoff  |     | (InMemorySaver)     |
    +----------+----------+     +-----------+----------+     +-------------+--------+
               |                             |                             |
               +-----------------------------+-----------------------------+
                                             |
                                             v
                        +--------------------+--------------------+
                        |        AsyncPostgresSaver (psycopg3)    |
                        +--------------------+--------------------+
                                             |
                                             v
                        +--------------------+--------------------+
                        |     Supabase Supavisor (Transaction)    |
                        +-----------------------------------------+
```

### 2.4 Integration Points

1. **`backend/src/services/db.py`**: New `get_resilient_checkpoint_db()` factory
2. **`backend/src/services/checkpoint.py`**: Update to use resilient saver, add retry to all methods
3. **`backend/src/utils/retry.py`**: Enhanced with error classification and jitter
4. **`backend/src/workers/tasks.py`**: Use resilient checkpoint saver
5. **`backend/src/utils/stream.py`**: Use resilient checkpoint saver
6. **New file**: `backend/src/services/errors.py` for exception hierarchy
7. **New file**: `backend/src/services/checkpoint_resilient.py` for wrapper class

---

## 3. Implementation Strategy

### 3.1 Step-by-Step Implementation Plan

#### Phase 1: Exception Infrastructure (Low Risk)
1. Create `backend/src/services/errors.py` with custom exception hierarchy
2. Implement error classification helper function
3. Add unit tests for error classification

#### Phase 2: Enhanced Retry Utility (Low Risk)
4. Add jitter to `retry_db_operation` backoff
5. Add error classification support (retryable vs. permanent)
6. Add callback hooks for retry/failure events
7. Add unit tests for retry behavior

#### Phase 3: Resilient Checkpoint Saver (Medium Risk)
8. Create `ResilientCheckpointSaver` wrapper class
9. Implement connection health check method
10. Implement retry-with-reconnect for all checkpoint methods
11. Implement graceful degradation to `InMemorySaver`
12. Add structured logging for all failure modes
13. Add integration tests with simulated failures

#### Phase 4: Integration (Medium Risk)
14. Update `get_checkpoint_db()` to return `ResilientCheckpointSaver`
15. Apply `@retry_db_operation` to all `CheckpointService` methods
16. Update `run_agent_stream` task to handle checkpoint failures
17. Update `stream_generator` to handle checkpoint failures
18. Add integration tests for worker resilience

#### Phase 5: Observability (Low Risk)
19. Add structured log fields for checkpoint operations
20. Add metrics/counters for retry attempts and failures
21. Add health check endpoint improvements

### 3.2 File Changes Required

#### New Files

**`backend/src/services/errors.py`**
```python
"""Custom exception hierarchy for checkpoint operations.

Security note: Error messages must not expose connection strings,
credentials, or internal database details.
"""
from typing import Optional
import psycopg


class CheckpointError(Exception):
    """Base exception for checkpoint operations."""

    def __init__(self, message: str, original_error: Optional[Exception] = None):
        # Sanitize message to prevent credential leakage
        self.message = self._sanitize_message(message)
        self.original_error = original_error
        super().__init__(self.message)

    @staticmethod
    def _sanitize_message(message: str) -> str:
        """Remove potential sensitive data from error messages."""
        # Remove anything that looks like a connection string
        import re
        patterns = [
            r'postgresql://[^\s]+',  # Full connection strings
            r'password=[^\s&]+',      # Password parameters
            r'host=[^\s&]+',          # Host information
        ]
        sanitized = message
        for pattern in patterns:
            sanitized = re.sub(pattern, '[REDACTED]', sanitized, flags=re.IGNORECASE)
        return sanitized


class RetryableCheckpointError(CheckpointError):
    """Error that may succeed on retry (connection issues, timeouts)."""
    pass


class PermanentCheckpointError(CheckpointError):
    """Error that will not succeed on retry (auth failures, query errors)."""
    pass


class CheckpointDegradedError(CheckpointError):
    """Checkpoint operation completed but using fallback (in-memory)."""
    pass


def classify_checkpoint_error(error: Exception) -> type[CheckpointError]:
    """Classify an exception as retryable or permanent.

    Returns the appropriate CheckpointError subclass to wrap the error.
    """
    if isinstance(error, psycopg.OperationalError):
        error_msg = str(error).lower()

        # Retryable operational errors
        retryable_patterns = [
            'ssl connection has been closed',
            'connection closed unexpectedly',
            'connection refused',
            'connection reset',
            'broken pipe',
            'consuming input failed',
            'timeout',
            'connection timed out',
            'server closed the connection',
        ]

        for pattern in retryable_patterns:
            if pattern in error_msg:
                return RetryableCheckpointError

        # Non-retryable operational errors
        permanent_patterns = [
            'authentication failed',
            'password authentication failed',
            'permission denied',
            'role .* does not exist',
            'database .* does not exist',
        ]

        import re
        for pattern in permanent_patterns:
            if re.search(pattern, error_msg):
                return PermanentCheckpointError

        # Default operational errors to retryable (network issues)
        return RetryableCheckpointError

    if isinstance(error, psycopg.ProgrammingError):
        # Query/syntax errors are permanent
        return PermanentCheckpointError

    if isinstance(error, psycopg.IntegrityError):
        # Constraint violations are permanent
        return PermanentCheckpointError

    if isinstance(error, (asyncio.TimeoutError, TimeoutError)):
        return RetryableCheckpointError

    if isinstance(error, (ConnectionError, OSError)):
        return RetryableCheckpointError

    # Unknown errors default to retryable for safety
    return RetryableCheckpointError


import asyncio  # Import at top in actual implementation
```

**`backend/src/services/checkpoint_resilient.py`**
```python
"""Resilient checkpoint saver with retry logic and graceful degradation.

This wrapper provides:
- Automatic retry with exponential backoff for transient failures
- Connection health validation before operations
- Graceful degradation to in-memory fallback
- Structured logging for observability
"""
import asyncio
import random
from typing import Optional, Iterator, Sequence, Any
from contextlib import asynccontextmanager

from langgraph.checkpoint.base import (
    BaseCheckpointSaver,
    Checkpoint,
    CheckpointMetadata,
    CheckpointTuple,
    ChannelVersions,
)
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.checkpoint.memory import InMemorySaver
from langchain_core.runnables.config import RunnableConfig
from psycopg import AsyncConnection

from src.utils.logger import logger
from src.services.errors import (
    classify_checkpoint_error,
    RetryableCheckpointError,
    PermanentCheckpointError,
    CheckpointDegradedError,
)


class ResilientCheckpointSaver(BaseCheckpointSaver):
    """Checkpoint saver with automatic retry and fallback capabilities.

    Wraps AsyncPostgresSaver with resilience patterns:
    1. Validates connection health before operations
    2. Retries on transient failures with exponential backoff
    3. Falls back to in-memory storage if Postgres unavailable
    4. Logs all failure/recovery events for observability
    """

    def __init__(
        self,
        connection_factory,  # Callable that returns AsyncConnection
        db_uri: str,
        max_retries: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 30.0,
        jitter: float = 0.1,
        enable_fallback: bool = True,
    ):
        super().__init__()
        self._connection_factory = connection_factory
        self._db_uri = db_uri
        self._max_retries = max_retries
        self._base_delay = base_delay
        self._max_delay = max_delay
        self._jitter = jitter
        self._enable_fallback = enable_fallback

        # Primary saver (Postgres)
        self._primary_saver: Optional[AsyncPostgresSaver] = None
        self._connection: Optional[AsyncConnection] = None

        # Fallback saver (in-memory)
        self._fallback_saver = InMemorySaver() if enable_fallback else None
        self._using_fallback = False

        # Metrics
        self._retry_count = 0
        self._fallback_count = 0

    async def _ensure_connection(self) -> AsyncPostgresSaver:
        """Ensure we have a healthy connection, reconnecting if needed."""
        if self._connection is None or self._is_connection_unhealthy():
            await self._reconnect()
        return self._primary_saver

    def _is_connection_unhealthy(self) -> bool:
        """Check if the current connection appears unhealthy."""
        if self._connection is None:
            return True
        try:
            # Check psycopg connection status
            return self._connection.closed
        except Exception:
            return True

    async def _reconnect(self) -> None:
        """Establish a new connection to Postgres."""
        # Close existing connection if any
        if self._connection is not None:
            try:
                await self._connection.close()
            except Exception as e:
                logger.debug(f"Error closing old connection: {e}")

        # Create new connection
        self._connection = await self._connection_factory()
        self._primary_saver = AsyncPostgresSaver(self._connection)
        self._using_fallback = False
        logger.info(
            "checkpoint_reconnect",
            extra={
                "event": "checkpoint_reconnect",
                "status": "success",
            }
        )

    def _calculate_delay(self, attempt: int) -> float:
        """Calculate delay with exponential backoff and jitter."""
        base = self._base_delay * (2 ** attempt)
        capped = min(base, self._max_delay)
        jitter = capped * self._jitter * random.random()
        return capped + jitter

    async def _execute_with_retry(
        self,
        operation_name: str,
        operation,  # Async callable
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
            RetryableCheckpointError: If all retries exhausted
        """
        last_error = None

        for attempt in range(self._max_retries):
            try:
                saver = await self._ensure_connection()
                method = getattr(saver, operation_name)
                return await method(*args, **kwargs)

            except Exception as e:
                error_class = classify_checkpoint_error(e)
                last_error = error_class(str(e), original_error=e)

                # Log the failure
                logger.warning(
                    f"checkpoint_operation_failed",
                    extra={
                        "event": "checkpoint_operation_failed",
                        "operation": operation_name,
                        "attempt": attempt + 1,
                        "max_retries": self._max_retries,
                        "error_type": error_class.__name__,
                        "retryable": error_class is RetryableCheckpointError,
                    }
                )

                # Don't retry permanent errors
                if error_class is PermanentCheckpointError:
                    raise last_error

                # Calculate backoff delay
                if attempt < self._max_retries - 1:
                    delay = self._calculate_delay(attempt)
                    self._retry_count += 1
                    logger.info(
                        f"checkpoint_retry_scheduled",
                        extra={
                            "event": "checkpoint_retry_scheduled",
                            "operation": operation_name,
                            "attempt": attempt + 1,
                            "delay_seconds": delay,
                        }
                    )
                    await asyncio.sleep(delay)

                    # Force reconnection on next attempt
                    self._connection = None

        # All retries exhausted - try fallback
        if self._enable_fallback and self._fallback_saver is not None:
            self._using_fallback = True
            self._fallback_count += 1
            logger.warning(
                "checkpoint_fallback_activated",
                extra={
                    "event": "checkpoint_fallback_activated",
                    "operation": operation_name,
                    "reason": "retries_exhausted",
                }
            )
            # Execute on fallback
            method = getattr(self._fallback_saver, operation_name.replace('a', '', 1))  # Remove 'a' prefix for sync methods
            if asyncio.iscoroutinefunction(method):
                return await method(*args, **kwargs)
            return method(*args, **kwargs)

        raise last_error

    # Implement BaseCheckpointSaver interface

    async def aput(
        self,
        config: RunnableConfig,
        checkpoint: Checkpoint,
        metadata: CheckpointMetadata,
        new_versions: ChannelVersions,
    ) -> RunnableConfig:
        """Store a checkpoint with retry logic."""
        return await self._execute_with_retry(
            "aput",
            None,  # operation is derived from method name
            config,
            checkpoint,
            metadata,
            new_versions,
        )

    async def aput_writes(
        self,
        config: RunnableConfig,
        writes: Sequence[tuple[str, Any]],
        task_id: str,
    ) -> None:
        """Store checkpoint writes with retry logic."""
        return await self._execute_with_retry(
            "aput_writes",
            None,
            config,
            writes,
            task_id,
        )

    async def aget_tuple(self, config: RunnableConfig) -> Optional[CheckpointTuple]:
        """Get a checkpoint tuple with retry logic."""
        return await self._execute_with_retry(
            "aget_tuple",
            None,
            config,
        )

    async def alist(
        self,
        config: Optional[RunnableConfig],
        *,
        filter: Optional[dict[str, Any]] = None,
        before: Optional[RunnableConfig] = None,
        limit: Optional[int] = None,
    ) -> Iterator[CheckpointTuple]:
        """List checkpoints with retry logic.

        Note: Returns async iterator - retry applies to initial connection only.
        Individual iteration errors must be handled by caller.
        """
        try:
            saver = await self._ensure_connection()
            async for item in saver.alist(config, filter=filter, before=before, limit=limit):
                yield item
        except Exception as e:
            error_class = classify_checkpoint_error(e)
            logger.warning(
                "checkpoint_alist_failed",
                extra={
                    "event": "checkpoint_alist_failed",
                    "error_type": error_class.__name__,
                }
            )
            if self._enable_fallback and self._fallback_saver is not None:
                self._using_fallback = True
                for item in self._fallback_saver.list(config, filter=filter, before=before, limit=limit):
                    yield item
            else:
                raise error_class(str(e), original_error=e)

    async def aget(self, config: RunnableConfig) -> Optional[Checkpoint]:
        """Get a checkpoint with retry logic."""
        tuple_result = await self.aget_tuple(config)
        if tuple_result is None:
            return None
        return tuple_result.checkpoint

    async def setup(self) -> None:
        """Initialize the checkpoint tables."""
        try:
            saver = await self._ensure_connection()
            await saver.setup()
        except Exception as e:
            logger.error(
                "checkpoint_setup_failed",
                extra={
                    "event": "checkpoint_setup_failed",
                    "error": str(e),
                }
            )
            raise

    async def adelete_thread(self, thread_id: str) -> None:
        """Delete checkpoints for a thread with retry logic."""
        return await self._execute_with_retry(
            "adelete_thread",
            None,
            thread_id,
        )

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
        }

    async def close(self) -> None:
        """Close the connection."""
        if self._connection is not None:
            try:
                await self._connection.close()
            except Exception as e:
                logger.debug(f"Error closing connection: {e}")
            finally:
                self._connection = None
                self._primary_saver = None
```

#### Modified Files

**`backend/src/services/db.py`** - Add resilient checkpoint factory:
```python
# Add to imports
from src.services.checkpoint_resilient import ResilientCheckpointSaver
from src.constants import (
    # ... existing imports ...
    CHECKPOINT_MAX_RETRIES,
    CHECKPOINT_BASE_DELAY,
    CHECKPOINT_ENABLE_FALLBACK,
)

# Add new factory function
@asynccontextmanager
async def get_resilient_checkpoint_db() -> AsyncIterator[ResilientCheckpointSaver]:
    """
    Create a ResilientCheckpointSaver with automatic retry and fallback.

    This replaces get_checkpoint_db() for production use, providing:
    - Automatic retry on SSL/connection failures
    - Exponential backoff with jitter
    - Optional fallback to in-memory storage
    - Structured logging for all failure events
    """
    async def connection_factory():
        return await AsyncConnection.connect(
            DB_URI,
            autocommit=True,
            prepare_threshold=None,
            row_factory=dict_row,
        )

    saver = ResilientCheckpointSaver(
        connection_factory=connection_factory,
        db_uri=DB_URI,
        max_retries=CHECKPOINT_MAX_RETRIES,
        base_delay=CHECKPOINT_BASE_DELAY,
        enable_fallback=CHECKPOINT_ENABLE_FALLBACK,
    )

    try:
        yield saver
    finally:
        await saver.close()
```

**`backend/src/constants/__init__.py`** - Add new constants:
```python
# Checkpoint Resilience Settings
CHECKPOINT_MAX_RETRIES = int(os.getenv("CHECKPOINT_MAX_RETRIES", "3"))
CHECKPOINT_BASE_DELAY = float(os.getenv("CHECKPOINT_BASE_DELAY", "1.0"))
CHECKPOINT_MAX_DELAY = float(os.getenv("CHECKPOINT_MAX_DELAY", "30.0"))
CHECKPOINT_ENABLE_FALLBACK = os.getenv("CHECKPOINT_ENABLE_FALLBACK", "true").lower() == "true"
```

**`backend/src/utils/retry.py`** - Enhanced with jitter and classification:
```python
import time
import asyncio
import functools
import inspect
import random
from typing import Callable, Optional, Tuple, Type

from src.utils.logger import logger


def retry_db_operation(
    tries: int = 3,
    delay: float = 1.0,
    backoff: float = 2.0,
    max_delay: float = 30.0,
    jitter: float = 0.1,
    exceptions: Tuple[Type[Exception], ...] = (Exception,),
    on_retry: Optional[Callable[[Exception, int, float], None]] = None,
    on_failure: Optional[Callable[[Exception, int], None]] = None,
    classify_error: Optional[Callable[[Exception], bool]] = None,
):
    """
    A decorator to retry a database operation on specified exceptions.
    Supports both sync and async functions.

    Args:
        tries: The maximum number of retry attempts.
        delay: The initial delay in seconds between retries.
        backoff: The multiplier for the delay between subsequent retries.
        max_delay: Maximum delay cap to prevent excessive waits.
        jitter: Random factor (0.0-1.0) to add to delay to prevent thundering herd.
        exceptions: A tuple of exception types to catch and trigger a retry.
        on_retry: Optional callback(exception, attempt, delay) called before each retry.
        on_failure: Optional callback(exception, attempts) called when all retries exhausted.
        classify_error: Optional function that returns True if error is retryable.
    """

    def calculate_delay(attempt: int, base_delay: float) -> float:
        """Calculate delay with exponential backoff, cap, and jitter."""
        exponential = base_delay * (backoff ** attempt)
        capped = min(exponential, max_delay)
        jitter_amount = capped * jitter * random.random()
        return capped + jitter_amount

    def decorator(func):
        if inspect.iscoroutinefunction(func):

            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs):
                mtries, mdelay = tries, delay
                last_exception = None

                for attempt in range(mtries):
                    try:
                        return await func(*args, **kwargs)
                    except exceptions as e:
                        last_exception = e

                        # Check if error is retryable
                        if classify_error is not None and not classify_error(e):
                            logger.warning(
                                f"Non-retryable error in {func.__name__}: {e}"
                            )
                            if on_failure:
                                on_failure(e, attempt + 1)
                            raise

                        if attempt < mtries - 1:
                            current_delay = calculate_delay(attempt, mdelay)
                            logger.warning(
                                f"Caught exception in {func.__name__}: {e}. "
                                f"Attempt {attempt + 1}/{mtries}. "
                                f"Retrying in {current_delay:.2f}s..."
                            )
                            if on_retry:
                                on_retry(e, attempt + 1, current_delay)
                            await asyncio.sleep(current_delay)
                        else:
                            logger.error(
                                f"All {mtries} retries exhausted for {func.__name__}: {e}"
                            )
                            if on_failure:
                                on_failure(e, mtries)
                            raise

                raise last_exception  # Should not reach here

            return async_wrapper
        else:

            @functools.wraps(func)
            def sync_wrapper(*args, **kwargs):
                mtries, mdelay = tries, delay
                last_exception = None

                for attempt in range(mtries):
                    try:
                        return func(*args, **kwargs)
                    except exceptions as e:
                        last_exception = e

                        # Check if error is retryable
                        if classify_error is not None and not classify_error(e):
                            logger.warning(
                                f"Non-retryable error in {func.__name__}: {e}"
                            )
                            if on_failure:
                                on_failure(e, attempt + 1)
                            raise

                        if attempt < mtries - 1:
                            current_delay = calculate_delay(attempt, mdelay)
                            logger.warning(
                                f"Caught exception in {func.__name__}: {e}. "
                                f"Attempt {attempt + 1}/{mtries}. "
                                f"Retrying in {current_delay:.2f}s..."
                            )
                            if on_retry:
                                on_retry(e, attempt + 1, current_delay)
                            time.sleep(current_delay)
                        else:
                            logger.error(
                                f"All {mtries} retries exhausted for {func.__name__}: {e}"
                            )
                            if on_failure:
                                on_failure(e, mtries)
                            raise

                raise last_exception  # Should not reach here

            return sync_wrapper

    return decorator
```

**`backend/src/services/checkpoint.py`** - Add retry to all methods:
```python
# Add to imports
from src.services.errors import (
    classify_checkpoint_error,
    RetryableCheckpointError,
    PermanentCheckpointError,
)
import psycopg

# Update decorator usage on existing methods
CHECKPOINT_EXCEPTIONS = (
    psycopg.OperationalError,
    psycopg.InterfaceError,
    ConnectionError,
    OSError,
)

def is_retryable_checkpoint_error(e: Exception) -> bool:
    """Determine if a checkpoint error should be retried."""
    return classify_checkpoint_error(e) is RetryableCheckpointError


# Apply to create_checkpoint method
@retry_db_operation(
    tries=3,
    delay=1,
    backoff=2,
    exceptions=CHECKPOINT_EXCEPTIONS,
    classify_error=is_retryable_checkpoint_error,
)
async def create_checkpoint(
    self,
    thread_id: str,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    new_versions: ChannelVersions,
):
    # ... existing implementation ...

# Apply to get_checkpoint method
@retry_db_operation(
    tries=3,
    delay=1,
    backoff=2,
    exceptions=CHECKPOINT_EXCEPTIONS,
    classify_error=is_retryable_checkpoint_error,
)
async def get_checkpoint(
    self,
    thread_id: str,
    checkpoint_id: str | None = None,
) -> Checkpoint | None:
    # ... existing implementation ...

# Apply to delete_checkpoints_for_thread method
@retry_db_operation(
    tries=3,
    delay=1,
    backoff=2,
    exceptions=CHECKPOINT_EXCEPTIONS,
    classify_error=is_retryable_checkpoint_error,
)
async def delete_checkpoints_for_thread(self, thread_id: str) -> bool:
    # ... existing implementation ...
```

**`backend/src/workers/tasks.py`** - Use resilient checkpoint saver:
```python
# Update import
from src.services.db import get_resilient_checkpoint_db, get_store_db

# Update context manager usage (line 74-77)
async with (
    get_store_db() as store,
    get_resilient_checkpoint_db() as checkpointer,
):
    # ... rest of implementation ...

    # Add checkpoint failure handling in finally block
    try:
        if service_context.user_id and checkpointer:
            # Existing state update code...
            pass
    except Exception as checkpoint_error:
        logger.warning(
            "checkpoint_final_update_failed",
            extra={
                "event": "checkpoint_final_update_failed",
                "thread_id": thread_id,
                "error": str(checkpoint_error),
                "using_fallback": getattr(checkpointer, 'is_using_fallback', False),
            }
        )
        # Don't re-raise - stream already completed successfully
```

**`backend/src/utils/stream.py`** - Use resilient checkpoint saver:
```python
# Update import
from src.services.db import get_resilient_checkpoint_db

# Update context manager (line 192)
async with get_resilient_checkpoint_db() as checkpointer:
    # ... existing implementation ...
```

### 3.3 Key Code Patterns

#### Pattern 1: Structured Logging for Observability
```python
# Always use extra dict for structured fields
logger.warning(
    "checkpoint_operation_failed",
    extra={
        "event": "checkpoint_operation_failed",  # Searchable event type
        "operation": operation_name,
        "attempt": attempt + 1,
        "max_retries": self._max_retries,
        "error_type": error_class.__name__,
        "thread_id": config.get("configurable", {}).get("thread_id"),
        "retryable": error_class is RetryableCheckpointError,
    }
)
```

#### Pattern 2: Error Classification Before Retry
```python
try:
    result = await operation()
except Exception as e:
    error_class = classify_checkpoint_error(e)

    if error_class is PermanentCheckpointError:
        # Don't waste retries on permanent failures
        raise error_class(str(e), original_error=e)

    # Proceed with retry logic for transient errors
```

#### Pattern 3: Graceful Degradation
```python
# After all retries exhausted
if self._enable_fallback and self._fallback_saver is not None:
    self._using_fallback = True
    logger.warning(
        "checkpoint_fallback_activated",
        extra={"event": "checkpoint_fallback_activated"}
    )
    # Continue with in-memory - data loss is better than crash
    return await self._fallback_saver.aput(...)

# No fallback available - raise with full context
raise RetryableCheckpointError(
    f"Checkpoint operation failed after {max_retries} attempts",
    original_error=last_error
)
```

#### Pattern 4: Security-Conscious Error Messages
```python
class CheckpointError(Exception):
    @staticmethod
    def _sanitize_message(message: str) -> str:
        """Remove potential sensitive data from error messages."""
        import re
        patterns = [
            r'postgresql://[^\s]+',  # Connection strings
            r'password=[^\s&]+',      # Password params
        ]
        sanitized = message
        for pattern in patterns:
            sanitized = re.sub(pattern, '[REDACTED]', sanitized, flags=re.IGNORECASE)
        return sanitized
```

---

## 4. Design Decisions

### 4.1 Trade-offs Considered

| Decision | Alternative | Why This Choice |
|----------|-------------|-----------------|
| Wrapper class over patching | Monkey-patch AsyncPostgresSaver | Cleaner separation of concerns, easier testing, no version coupling |
| Exponential backoff with jitter | Fixed delay | Prevents thundering herd when multiple workers retry simultaneously |
| In-memory fallback | Fail completely | PRD requires "degrade gracefully" - data loss is preferable to crash |
| Error classification | Catch-all retry | Avoids wasting retries on permanent failures (auth, syntax errors) |
| Factory function pattern | Singleton connection | Per-request isolation aligns with existing patterns, avoids shared state bugs |
| Structured logging | Text logs | Enables log aggregation, alerting, and dashboarding in production |

### 4.2 Why This Approach Over Alternatives

**Alternative 1: Connection Pooling (psycopg_pool)**
- Rejected because: Supavisor already provides connection pooling; adding another layer complicates debugging and may cause pool-within-pool issues
- Our approach: Keep single connections but make them resilient to drops

**Alternative 2: Queue Checkpoint Writes Asynchronously**
- Rejected because: Adds complexity (message queue), eventual consistency issues, harder to debug
- Our approach: Synchronous writes with retry maintain consistency guarantees

**Alternative 3: Disable Checkpointing on Failure**
- Rejected because: PRD requires graceful degradation, not silent data loss
- Our approach: Fall back to in-memory with clear logging

### 4.3 Alignment with Existing Codebase Patterns

1. **Context Manager Pattern**: Both `get_checkpoint_db()` and `get_resilient_checkpoint_db()` use `@asynccontextmanager` consistent with existing DB utilities

2. **Decorator Pattern**: Enhanced `retry_db_operation` extends existing utility rather than replacing it

3. **Service Injection**: `ResilientCheckpointSaver` accepts a connection factory, allowing dependency injection for testing

4. **Structured Logging**: Uses existing `logger` from `src.utils.logger` with `extra={}` dict pattern

5. **Configuration via Environment**: New constants follow existing pattern in `src.constants/__init__.py`

---

## 5. Risk Assessment

### 5.1 Potential Pitfalls

| Risk | Impact | Mitigation |
|------|--------|------------|
| Retry storms under high load | Database overload | Jitter + capped max_delay + circuit breaker (future) |
| Fallback data loss | User loses conversation history | Clear logging + metric alerting + sync-back mechanism (future) |
| Increased latency | Slow user experience | Configurable timeouts + fast-fail on permanent errors |
| Memory pressure from InMemorySaver | Worker OOM | Limit fallback duration + periodic flush attempts |
| Race conditions during reconnect | Duplicate writes | Lock around reconnect logic |
| Breaking change to CheckpointService interface | Integration failures | Maintain same method signatures |

### 5.2 Edge Cases to Handle

1. **Connection drops mid-checkpoint-write**: Checkpoint may be partially written
   - Mitigation: LangGraph handles this with idempotent checkpoint IDs

2. **Reconnection fails repeatedly**: Worker becomes non-functional
   - Mitigation: Fallback to in-memory, log critical alert, health check fails

3. **In-memory fallback during long conversation**: Large memory footprint
   - Mitigation: Limit messages stored, periodic Postgres sync attempt

4. **Multiple workers hitting DB limit simultaneously**: All get connection refused
   - Mitigation: Jitter spreads out retry timing, prevents thundering herd

5. **SSL certificate rotation mid-stream**: All connections fail at once
   - Mitigation: Retry logic handles, workers recover at different times due to jitter

6. **Checkpoint ID collision after fallback sync**: Data inconsistency
   - Mitigation: Use LangGraph's built-in checkpoint ID generation (UUIDs)

7. **Worker process crash during fallback**: In-memory data lost
   - Mitigation: Accept data loss, ensure main stream completed (PRD requirement)

8. **Database returns after extended outage**: Stale in-memory data
   - Mitigation: Clear in-memory on successful reconnect, rely on stream-level state

9. **Partial network failure (writes succeed, reads fail)**: Inconsistent state
   - Mitigation: Validate connection health with simple query before complex operations

10. **Async generator exhaustion during alist()**: Partial checkpoint list
    - Mitigation: Yield from fallback for remaining items, log incomplete list

### 5.3 Testing Considerations

#### Unit Tests Required

1. **Error Classification Tests** (`test_errors.py`)
   - Test each psycopg error type maps to correct classification
   - Test message sanitization removes connection strings
   - Test unknown errors default to retryable

2. **Retry Decorator Tests** (`test_retry.py`)
   - Test exponential backoff calculation with jitter
   - Test max_delay cap is respected
   - Test on_retry callback is called
   - Test on_failure callback is called after exhaustion
   - Test classify_error prevents retry on permanent errors

3. **ResilientCheckpointSaver Tests** (`test_checkpoint_resilient.py`)
   - Test connection health check detects closed connection
   - Test retry creates new connection
   - Test fallback activates after max retries
   - Test metrics are updated correctly
   - Test all BaseCheckpointSaver methods are proxied
   - Test close() cleans up resources

#### Integration Tests Required

1. **Simulated Failure Tests** (`test_checkpoint_integration.py`)
   - Mock psycopg.OperationalError on first N calls, succeed after
   - Verify retry count matches configuration
   - Verify final operation succeeds

2. **Fallback Behavior Tests**
   - Disable database entirely
   - Verify fallback activates
   - Verify checkpoint operations continue
   - Verify logging indicates fallback mode

3. **Worker Task Tests** (`test_tasks_resilience.py`)
   - Inject connection failure mid-stream
   - Verify stream completes
   - Verify error is logged, not raised
   - Verify final state update attempts retry

4. **End-to-End Tests**
   - Run full agent stream with flaky connection simulation
   - Verify user receives complete response
   - Verify checkpoint state is eventually consistent

#### Test Fixtures Required

```python
# conftest.py additions

@pytest.fixture
def flaky_connection():
    """Connection that fails first N times then succeeds."""
    fail_count = [0]
    max_failures = 2

    async def factory():
        fail_count[0] += 1
        if fail_count[0] <= max_failures:
            raise psycopg.OperationalError("SSL connection has been closed unexpectedly")
        return await real_connection()

    return factory

@pytest.fixture
def always_failing_connection():
    """Connection that always fails for fallback testing."""
    async def factory():
        raise psycopg.OperationalError("Connection refused")
    return factory

@pytest.fixture
def mock_checkpoint_saver(flaky_connection):
    """ResilientCheckpointSaver with flaky connection for testing."""
    return ResilientCheckpointSaver(
        connection_factory=flaky_connection,
        db_uri="postgresql://test",
        max_retries=3,
        base_delay=0.1,  # Fast tests
        enable_fallback=True,
    )
```

---

## 6. Estimated Complexity

### 6.1 Scope Assessment

| Component | Scope | Justification |
|-----------|-------|---------------|
| Error hierarchy (`errors.py`) | Small | Single file, simple classes |
| Retry enhancement | Small | Extend existing, backwards compatible |
| ResilientCheckpointSaver | Medium | New class, but clear interface contract |
| DB factory updates | Small | Add one new function |
| Worker/Stream integration | Small | Swap context manager, add try/catch |
| Test coverage | Medium | Need mocking infrastructure |

**Overall Scope: Medium**

### 6.2 Risk Level Assessment

| Factor | Level | Reasoning |
|--------|-------|-----------|
| Code complexity | Low | Well-defined wrapper pattern |
| Integration points | Medium | Touches critical path (checkpoints) |
| Testing difficulty | Medium | Need connection failure simulation |
| Rollback difficulty | Low | Feature flag via `CHECKPOINT_ENABLE_FALLBACK` |
| Production impact if buggy | Medium | Could cause data loss or crashes |

**Overall Risk Level: Medium**

### 6.3 Suggested Priority Order

1. **Phase 1: Exception Infrastructure** (Day 1)
   - Lowest risk, foundational for other phases
   - Can be merged independently

2. **Phase 2: Enhanced Retry Utility** (Day 1-2)
   - Backwards compatible enhancement
   - Immediate benefit to existing retry usage

3. **Phase 3: Resilient Checkpoint Saver** (Day 2-3)
   - Core implementation
   - Requires thorough unit testing before integration

4. **Phase 4: Integration** (Day 3-4)
   - Swap in new saver, add error handling
   - Feature flag allows gradual rollout

5. **Phase 5: Observability** (Day 4-5)
   - Polish logging format
   - Add metrics if monitoring infrastructure exists

### 6.4 Feature Flag Strategy

```python
# In constants/__init__.py
CHECKPOINT_USE_RESILIENT = os.getenv("CHECKPOINT_USE_RESILIENT", "false").lower() == "true"

# In db.py
@asynccontextmanager
async def get_checkpoint_db():
    if CHECKPOINT_USE_RESILIENT:
        async with get_resilient_checkpoint_db() as saver:
            yield saver
    else:
        # Existing implementation
        async with await AsyncConnection.connect(...) as conn:
            yield AsyncPostgresSaver(conn)
```

This allows:
- Gradual rollout: Enable for specific workers first
- Quick rollback: Set env var to "false"
- A/B testing: Compare error rates between modes

---

## Appendix A: Security Considerations

### A.1 Sensitive Data in Logs

The implementation must ensure:
- Connection strings are never logged
- Database credentials are never exposed in error messages
- User data (thread_id) is only logged at DEBUG level
- Stack traces don't contain environment variables

### A.2 Error Message Sanitization

All `CheckpointError` subclasses inherit `_sanitize_message()` which removes:
- Full PostgreSQL connection strings (`postgresql://...`)
- Password parameters (`password=...`)
- Host information (`host=...`)

### A.3 Audit Trail

Structured logging provides audit trail for:
- When fallback mode was activated
- Which operations triggered retries
- Duration of database unavailability
- Recovery success/failure

---

## Appendix B: Monitoring Recommendations

### B.1 Metrics to Track

If metrics infrastructure available (e.g., Prometheus):

```python
# Counters
checkpoint_retry_total{operation, error_type}
checkpoint_fallback_activations_total
checkpoint_operation_failures_total{operation, permanent}

# Gauges
checkpoint_retry_delay_seconds
checkpoint_fallback_active  # 1 if any saver in fallback mode

# Histograms
checkpoint_operation_duration_seconds{operation}
```

### B.2 Alerting Thresholds

- WARN: `checkpoint_retry_total` > 10/minute
- CRITICAL: `checkpoint_fallback_activations_total` > 0
- PAGE: `checkpoint_fallback_active` == 1 for > 5 minutes

### B.3 Dashboard Queries

```sql
-- Retry rate over time (assuming log aggregation)
SELECT
  DATE_TRUNC('minute', timestamp) as minute,
  COUNT(*) FILTER (WHERE event = 'checkpoint_retry_scheduled') as retries,
  COUNT(*) FILTER (WHERE event = 'checkpoint_fallback_activated') as fallbacks
FROM logs
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY 1
ORDER BY 1;
```

---

## Appendix C: Rollback Plan

If issues discovered in production:

1. **Immediate**: Set `CHECKPOINT_USE_RESILIENT=false` and restart workers
2. **Verify**: Monitor error rates return to baseline
3. **Investigate**: Review structured logs for failure patterns
4. **Fix**: Address root cause in code
5. **Re-deploy**: Enable feature flag incrementally

Time to rollback: < 5 minutes (environment variable change + worker restart)
