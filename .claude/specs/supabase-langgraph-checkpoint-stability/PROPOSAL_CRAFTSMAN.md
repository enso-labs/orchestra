# PROPOSAL: Stabilize LangGraph Postgres Checkpointing on Supabase

**Agent:** CRAFTSMAN - Clean Code & Architecture Specialist
**Date:** 2026-01-19
**Feature:** Resilient Postgres Checkpointer for Supabase/Supavisor

---

## 1. Executive Summary

This proposal recommends implementing a `ResilientAsyncPostgresSaver` wrapper class that encapsulates connection resilience logic around LangGraph's `AsyncPostgresSaver`. The wrapper will detect SSL/connection-loss errors, automatically reconnect with TCP keepalive settings, and retry operations using exponential backoff. Additionally, we propose a dedicated `CHECKPOINT_DATABASE_URL` environment variable for direct connection mode (bypassing Supavisor for checkpoint operations) and worker-level checkpointer reuse to minimize connection churn.

---

## 2. Architectural Analysis

### 2.1 Current State Assessment

**Database Layer (`backend/src/services/db.py`):**
```python
@asynccontextmanager
async def get_checkpoint_db() -> AsyncIterator[AsyncPostgresSaver]:
    async with await AsyncConnection.connect(
        DB_URI,
        autocommit=True,
        prepare_threshold=None,  # Disabled for pgbouncer
        row_factory=dict_row,
    ) as conn:
        yield AsyncPostgresSaver(conn)
```

**Key Observations:**
1. **Context Manager Pattern:** Checkpoint DB is obtained via `get_checkpoint_db()` async context manager, creating a fresh connection each time.
2. **Connection per Task:** In `tasks.py`, every `run_agent_stream` task creates its own checkpoint connection:
   ```python
   async with (
       get_store_db() as store,
       get_checkpoint_db() as checkpointer,
   ):
   ```
3. **No Resilience:** No retry logic, no TCP keepalive, no reconnection on SSL errors.
4. **Single Connection String:** Uses `DB_URI` for everything (Supavisor pooled connection).

**Retry Infrastructure (`backend/src/utils/retry.py`):**
- Existing `@retry_db_operation` decorator supports both sync and async functions
- Configurable: tries, delay, backoff, exceptions
- Currently used in `CheckpointService.list_checkpoints()`

**CheckpointService (`backend/src/services/checkpoint.py`):**
- Wraps `BaseCheckpointSaver` with business logic
- Already uses `@retry_db_operation` on `list_checkpoints()` method
- Other methods (`get_checkpoint`, `create_checkpoint`, etc.) lack retry protection

**TaskIQ Workers (`backend/src/workers/tasks.py`):**
- Each task is independent and creates new connections
- No connection pooling or reuse at the worker process level
- Long-running agent streams are vulnerable to connection drops

### 2.2 Root Cause Analysis

The SSL connection closure error occurs because:

1. **Supavisor Transaction Pooling:** Supabase's connection pooler (Supavisor) operates in transaction mode, which:
   - Reassigns connections between transactions
   - May close connections during idle periods
   - Does not maintain persistent connections for long operations

2. **psycopg3 Pipeline Mode:** LangGraph's `AsyncPostgresSaver` may use `pipeline=True` internally, which:
   - Requires persistent connections
   - Conflicts with transaction pooling semantics

3. **Network Instability:** Without TCP keepalive:
   - Idle connections may be silently closed by intermediate proxies/load balancers
   - Client doesn't detect connection loss until attempting to use it

4. **Connection Churn:** Creating new connections per task:
   - Increases Supavisor overhead
   - Higher probability of hitting rate limits or pool exhaustion

### 2.3 Proposed Architecture

```
+-------------------+     +---------------------------+     +--------------------+
|   TaskIQ Worker   |---->| ResilientAsyncPostgres-   |---->| AsyncPostgresSaver |
|   (reuses per     |     | Saver (wrapper)           |     | (LangGraph)        |
|    process)       |     | - Error detection         |     +--------------------+
+-------------------+     | - Auto-reconnection       |
                          | - Retry w/ exp. backoff   |
                          | - TCP keepalive           |
                          +---------------------------+
                                      |
                                      v
                          +---------------------------+
                          | CHECKPOINT_DATABASE_URL   |
                          | (Direct connection, no    |
                          |  Supavisor)               |
                          +---------------------------+
```

### 2.4 Integration Points

| Component | Integration | Impact |
|-----------|-------------|--------|
| `db.py` | New `get_resilient_checkpoint_db()` function | Low - Additive |
| `constants/__init__.py` | Add `CHECKPOINT_DATABASE_URL` | Low - Additive |
| `tasks.py` | Use resilient checkpointer, implement reuse | Medium |
| `schedule.py` | Use resilient checkpointer | Low |
| `checkpoint.py` | Extend retry coverage | Low |
| `retry.py` | Add SSL error types | Low |

---

## 3. Implementation Strategy

### 3.1 Step-by-Step Implementation Plan

**Phase 1: Foundation (Low Risk)**
1. Add `CHECKPOINT_DATABASE_URL` environment variable
2. Create `ResilientAsyncPostgresSaver` wrapper class
3. Add TCP keepalive connection configuration

**Phase 2: Integration (Medium Risk)**
4. Update `get_checkpoint_db()` to use resilient wrapper
5. Implement worker-level checkpointer reuse pattern
6. Extend retry coverage in `CheckpointService`

**Phase 3: Validation (Low Risk)**
7. Add health check for resilient checkpointer
8. Update tests
9. Documentation

### 3.2 File Changes Required

#### New Files

| File | Purpose |
|------|---------|
| `backend/src/services/resilient_checkpoint.py` | `ResilientAsyncPostgresSaver` class |

#### Modified Files

| File | Change |
|------|--------|
| `backend/src/constants/__init__.py` | Add `CHECKPOINT_DATABASE_URL`, keepalive constants |
| `backend/src/services/db.py` | Add `get_resilient_checkpoint_db()` |
| `backend/src/workers/tasks.py` | Use resilient checkpointer with worker-level reuse |
| `backend/src/workers/broker.py` | Add startup hook for checkpointer initialization |
| `backend/src/services/schedule.py` | Use resilient checkpointer |
| `backend/src/utils/retry.py` | Add SSL-specific exception types |

### 3.3 Key Code Patterns

#### Pattern 1: Resilient Checkpointer Wrapper

```python
# backend/src/services/resilient_checkpoint.py
"""
Resilient wrapper for LangGraph AsyncPostgresSaver.

Handles connection-loss scenarios with Supabase/Supavisor by:
- Detecting SSL and connection errors
- Auto-reconnecting with TCP keepalive settings
- Retrying operations with exponential backoff
"""

import asyncio
from contextlib import asynccontextmanager
from typing import AsyncIterator, Optional, Sequence, Tuple, Any

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.checkpoint.base import (
    Checkpoint,
    CheckpointMetadata,
    CheckpointTuple,
    ChannelVersions,
)
from langchain_core.runnables import RunnableConfig
from psycopg import AsyncConnection, OperationalError
from psycopg.rows import dict_row

from src.utils.logger import logger


# SSL/Connection error patterns to detect
CONNECTION_ERROR_PATTERNS = (
    "SSL connection has been closed unexpectedly",
    "connection is closed",
    "server closed the connection unexpectedly",
    "consuming input failed",
    "connection refused",
    "connection reset by peer",
)


def is_connection_error(error: Exception) -> bool:
    """Check if an exception indicates a connection-loss scenario."""
    error_str = str(error).lower()
    return any(pattern.lower() in error_str for pattern in CONNECTION_ERROR_PATTERNS)


class ResilientAsyncPostgresSaver:
    """
    A resilient wrapper around AsyncPostgresSaver that handles connection
    failures with automatic reconnection and retry logic.

    Design Principles:
    - Single Responsibility: Only handles connection resilience
    - Open/Closed: Delegates all checkpoint operations to inner saver
    - Dependency Inversion: Accepts connection parameters, creates connections

    Usage:
        async with ResilientAsyncPostgresSaver.create(conn_string) as saver:
            await saver.aput(config, checkpoint, metadata, new_versions)
    """

    def __init__(
        self,
        conn_string: str,
        max_retries: int = 3,
        initial_delay_ms: int = 100,
        max_delay_ms: int = 1000,
        keepalives: int = 1,
        keepalives_idle: int = 30,
        keepalives_interval: int = 10,
        keepalives_count: int = 5,
    ):
        """
        Initialize the resilient checkpointer.

        Args:
            conn_string: PostgreSQL connection string (should be direct, not pooled)
            max_retries: Maximum retry attempts per operation (default: 3)
            initial_delay_ms: Initial retry delay in milliseconds (default: 100)
            max_delay_ms: Maximum retry delay in milliseconds (default: 1000)
            keepalives: Enable TCP keepalive (1=on, 0=off)
            keepalives_idle: Seconds idle before sending keepalive probe
            keepalives_interval: Seconds between keepalive probes
            keepalives_count: Number of failed probes before connection is dead
        """
        self._conn_string = conn_string
        self._max_retries = max_retries
        self._initial_delay_ms = initial_delay_ms
        self._max_delay_ms = max_delay_ms
        self._keepalives = keepalives
        self._keepalives_idle = keepalives_idle
        self._keepalives_interval = keepalives_interval
        self._keepalives_count = keepalives_count

        self._conn: Optional[AsyncConnection] = None
        self._saver: Optional[AsyncPostgresSaver] = None
        self._is_connected = False

    async def _create_connection(self) -> AsyncConnection:
        """Create a new connection with TCP keepalive settings."""
        conn = await AsyncConnection.connect(
            self._conn_string,
            autocommit=True,
            prepare_threshold=None,  # Required for connection pooler compatibility
            row_factory=dict_row,
            keepalives=self._keepalives,
            keepalives_idle=self._keepalives_idle,
            keepalives_interval=self._keepalives_interval,
            keepalives_count=self._keepalives_count,
        )
        return conn

    async def connect(self) -> None:
        """Establish connection and create inner saver."""
        if self._is_connected:
            return

        try:
            self._conn = await self._create_connection()
            self._saver = AsyncPostgresSaver(self._conn)
            self._is_connected = True
            logger.debug("ResilientAsyncPostgresSaver: Connection established")
        except Exception as e:
            logger.error(f"ResilientAsyncPostgresSaver: Failed to connect: {e}")
            raise

    async def disconnect(self) -> None:
        """Close connection and cleanup."""
        if self._conn is not None:
            try:
                await self._conn.close()
            except Exception as e:
                logger.warning(f"ResilientAsyncPostgresSaver: Error closing connection: {e}")
            finally:
                self._conn = None
                self._saver = None
                self._is_connected = False

    async def reconnect(self) -> None:
        """Force reconnection."""
        await self.disconnect()
        await self.connect()
        logger.info("ResilientAsyncPostgresSaver: Reconnected successfully")

    async def _execute_with_retry(self, operation_name: str, operation):
        """
        Execute an async operation with retry logic and exponential backoff.

        Args:
            operation_name: Name for logging
            operation: Async callable to execute

        Returns:
            Result of the operation

        Raises:
            Last exception if all retries exhausted
        """
        delay_ms = self._initial_delay_ms
        last_exception = None

        for attempt in range(self._max_retries + 1):
            try:
                if not self._is_connected:
                    await self.connect()

                return await operation()

            except (OperationalError, Exception) as e:
                last_exception = e

                if not is_connection_error(e):
                    # Not a connection error, don't retry
                    logger.error(
                        f"ResilientAsyncPostgresSaver: {operation_name} failed "
                        f"with non-connection error: {e}"
                    )
                    raise

                if attempt < self._max_retries:
                    logger.warning(
                        f"ResilientAsyncPostgresSaver: {operation_name} failed "
                        f"(attempt {attempt + 1}/{self._max_retries + 1}): {e}. "
                        f"Retrying in {delay_ms}ms..."
                    )
                    await asyncio.sleep(delay_ms / 1000.0)
                    await self.reconnect()
                    delay_ms = min(delay_ms * 2, self._max_delay_ms)
                else:
                    logger.error(
                        f"ResilientAsyncPostgresSaver: {operation_name} failed "
                        f"after {self._max_retries + 1} attempts: {e}"
                    )

        raise last_exception

    # Delegate checkpoint operations to inner saver with retry logic

    async def aget(
        self, config: RunnableConfig
    ) -> Optional[CheckpointTuple]:
        """Get a checkpoint with retry logic."""
        async def _op():
            return await self._saver.aget(config)
        return await self._execute_with_retry("aget", _op)

    async def aput(
        self,
        config: RunnableConfig,
        checkpoint: Checkpoint,
        metadata: CheckpointMetadata,
        new_versions: ChannelVersions,
    ) -> RunnableConfig:
        """Put a checkpoint with retry logic."""
        async def _op():
            return await self._saver.aput(config, checkpoint, metadata, new_versions)
        return await self._execute_with_retry("aput", _op)

    async def alist(
        self,
        config: RunnableConfig,
        *,
        filter: Optional[dict] = None,
        before: Optional[RunnableConfig] = None,
        limit: Optional[int] = None,
    ) -> AsyncIterator[CheckpointTuple]:
        """
        List checkpoints with retry logic.

        Note: This yields results from the inner saver. If connection fails
        mid-iteration, it will reconnect and restart from beginning.
        """
        async def _op():
            results = []
            async for item in self._saver.alist(
                config, filter=filter, before=before, limit=limit
            ):
                results.append(item)
            return results

        results = await self._execute_with_retry("alist", _op)
        for item in results:
            yield item

    async def adelete_thread(self, thread_id: str) -> None:
        """Delete thread checkpoints with retry logic."""
        async def _op():
            return await self._saver.adelete_thread(thread_id)
        return await self._execute_with_retry("adelete_thread", _op)

    async def aput_writes(
        self,
        config: RunnableConfig,
        writes: Sequence[Tuple[str, Any]],
        task_id: str,
    ) -> None:
        """Put writes with retry logic."""
        async def _op():
            return await self._saver.aput_writes(config, writes, task_id)
        return await self._execute_with_retry("aput_writes", _op)

    async def setup(self) -> None:
        """Run setup (create tables) with retry logic."""
        async def _op():
            return await self._saver.setup()
        return await self._execute_with_retry("setup", _op)

    # Context manager support

    async def __aenter__(self) -> "ResilientAsyncPostgresSaver":
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        await self.disconnect()

    @classmethod
    @asynccontextmanager
    async def create(
        cls,
        conn_string: str,
        **kwargs,
    ) -> AsyncIterator["ResilientAsyncPostgresSaver"]:
        """Factory context manager for creating a resilient saver."""
        saver = cls(conn_string, **kwargs)
        try:
            await saver.connect()
            yield saver
        finally:
            await saver.disconnect()
```

#### Pattern 2: Environment Configuration

```python
# Addition to backend/src/constants/__init__.py

# Checkpoint Database Configuration
# Use a direct connection URL (not Supavisor) for checkpointing stability
def get_checkpoint_db_uri():
    """
    Get checkpoint database URI.

    Falls back to DB_URI if CHECKPOINT_DATABASE_URL is not set.
    For Supabase, this should be the direct connection string (not pooled).
    """
    return os.getenv("CHECKPOINT_DATABASE_URL", DB_URI)

CHECKPOINT_DATABASE_URL = get_checkpoint_db_uri()

# TCP Keepalive Settings for Checkpoint Connections
CHECKPOINT_KEEPALIVES = int(os.getenv("CHECKPOINT_KEEPALIVES", "1"))
CHECKPOINT_KEEPALIVES_IDLE = int(os.getenv("CHECKPOINT_KEEPALIVES_IDLE", "30"))
CHECKPOINT_KEEPALIVES_INTERVAL = int(os.getenv("CHECKPOINT_KEEPALIVES_INTERVAL", "10"))
CHECKPOINT_KEEPALIVES_COUNT = int(os.getenv("CHECKPOINT_KEEPALIVES_COUNT", "5"))

# Retry Configuration for Checkpoint Operations
CHECKPOINT_MAX_RETRIES = int(os.getenv("CHECKPOINT_MAX_RETRIES", "3"))
CHECKPOINT_INITIAL_DELAY_MS = int(os.getenv("CHECKPOINT_INITIAL_DELAY_MS", "100"))
CHECKPOINT_MAX_DELAY_MS = int(os.getenv("CHECKPOINT_MAX_DELAY_MS", "1000"))
```

#### Pattern 3: Updated db.py Functions

```python
# Addition to backend/src/services/db.py

from src.constants import (
    CHECKPOINT_DATABASE_URL,
    CHECKPOINT_KEEPALIVES,
    CHECKPOINT_KEEPALIVES_IDLE,
    CHECKPOINT_KEEPALIVES_INTERVAL,
    CHECKPOINT_KEEPALIVES_COUNT,
    CHECKPOINT_MAX_RETRIES,
    CHECKPOINT_INITIAL_DELAY_MS,
    CHECKPOINT_MAX_DELAY_MS,
)
from src.services.resilient_checkpoint import ResilientAsyncPostgresSaver


@asynccontextmanager
async def get_resilient_checkpoint_db() -> AsyncIterator[ResilientAsyncPostgresSaver]:
    """
    Create a ResilientAsyncPostgresSaver with connection resilience.

    Uses CHECKPOINT_DATABASE_URL (direct connection) instead of DB_URI (pooled)
    for better stability with long-running checkpoint operations.

    Features:
    - TCP keepalive for connection health
    - Auto-reconnection on connection loss
    - Exponential backoff retry on transient failures
    """
    async with ResilientAsyncPostgresSaver.create(
        conn_string=CHECKPOINT_DATABASE_URL,
        max_retries=CHECKPOINT_MAX_RETRIES,
        initial_delay_ms=CHECKPOINT_INITIAL_DELAY_MS,
        max_delay_ms=CHECKPOINT_MAX_DELAY_MS,
        keepalives=CHECKPOINT_KEEPALIVES,
        keepalives_idle=CHECKPOINT_KEEPALIVES_IDLE,
        keepalives_interval=CHECKPOINT_KEEPALIVES_INTERVAL,
        keepalives_count=CHECKPOINT_KEEPALIVES_COUNT,
    ) as saver:
        yield saver


# Keep original for backward compatibility
@asynccontextmanager
async def get_checkpoint_db() -> AsyncIterator[AsyncPostgresSaver]:
    """
    Create an AsyncPostgresSaver with explicit connection kwargs.

    DEPRECATED: Use get_resilient_checkpoint_db() for better connection stability.

    Uses the solution from: https://github.com/langchain-ai/langgraph/issues/2755
    - autocommit=True: Required for checkpoint operations
    - prepare_threshold=0: Disables prepared statements for connection pooler compatibility
    - row_factory=dict_row: Required by AsyncPostgresSaver
    """
    async with await AsyncConnection.connect(
        DB_URI,
        autocommit=True,
        prepare_threshold=None,
        row_factory=dict_row,
    ) as conn:
        yield AsyncPostgresSaver(conn)
```

#### Pattern 4: Worker-Level Checkpointer Reuse

```python
# Addition to backend/src/workers/broker.py

from typing import Optional
from src.services.resilient_checkpoint import ResilientAsyncPostgresSaver
from src.constants import (
    CHECKPOINT_DATABASE_URL,
    CHECKPOINT_KEEPALIVES,
    CHECKPOINT_KEEPALIVES_IDLE,
    CHECKPOINT_KEEPALIVES_INTERVAL,
    CHECKPOINT_KEEPALIVES_COUNT,
    CHECKPOINT_MAX_RETRIES,
    CHECKPOINT_INITIAL_DELAY_MS,
    CHECKPOINT_MAX_DELAY_MS,
)

# Worker-level singleton checkpointer
_worker_checkpointer: Optional[ResilientAsyncPostgresSaver] = None


async def get_worker_checkpointer() -> ResilientAsyncPostgresSaver:
    """
    Get or create a worker-level checkpointer singleton.

    This reuses a single checkpointer per worker process to minimize
    connection churn and improve stability.
    """
    global _worker_checkpointer

    if _worker_checkpointer is None:
        _worker_checkpointer = ResilientAsyncPostgresSaver(
            conn_string=CHECKPOINT_DATABASE_URL,
            max_retries=CHECKPOINT_MAX_RETRIES,
            initial_delay_ms=CHECKPOINT_INITIAL_DELAY_MS,
            max_delay_ms=CHECKPOINT_MAX_DELAY_MS,
            keepalives=CHECKPOINT_KEEPALIVES,
            keepalives_idle=CHECKPOINT_KEEPALIVES_IDLE,
            keepalives_interval=CHECKPOINT_KEEPALIVES_INTERVAL,
            keepalives_count=CHECKPOINT_KEEPALIVES_COUNT,
        )
        await _worker_checkpointer.connect()

    return _worker_checkpointer


async def cleanup_worker_checkpointer() -> None:
    """Cleanup worker checkpointer on shutdown."""
    global _worker_checkpointer

    if _worker_checkpointer is not None:
        await _worker_checkpointer.disconnect()
        _worker_checkpointer = None


# TaskIQ startup/shutdown hooks
@broker.on_event("startup")
async def on_startup():
    """Initialize worker-level resources."""
    await get_worker_checkpointer()


@broker.on_event("shutdown")
async def on_shutdown():
    """Cleanup worker-level resources."""
    await cleanup_worker_checkpointer()
```

#### Pattern 5: Updated Tasks Using Worker Checkpointer

```python
# Changes to backend/src/workers/tasks.py

@broker.task(task_name="run_agent_stream")
async def run_agent_stream(
    task_dict: dict,
    user_id: str,
    thread_id: str,
) -> dict:
    """Execute agent and stream results via Redis Streams."""
    from src.workers.broker import get_worker_checkpointer  # Import from broker
    # ... existing imports ...

    try:
        # ... existing setup code ...

        # Get worker-level checkpointer (reused across tasks)
        checkpointer = await get_worker_checkpointer()

        async with get_store_db() as store:
            # Use checkpointer directly (not as context manager)
            service_context = ServiceContext(
                user_id=user_id,
                store=store,
                config=config,
                checkpointer=checkpointer,
            )

            # ... rest of existing code ...
```

---

## 4. Design Decisions

### 4.1 Trade-offs Considered

| Decision | Trade-off | Rationale |
|----------|-----------|-----------|
| Wrapper class vs. monkey-patching | More code, cleaner separation | Maintains SOLID principles, testable |
| Worker-level reuse vs. per-task creation | Shared state risk | Significant reduction in connection churn |
| Direct connection vs. Supavisor | Bypasses pooling benefits | Necessary for long-running operations |
| Exponential backoff | Slower recovery | Prevents thundering herd, standard practice |
| 100ms initial delay | Fast retry | Matches PRD requirement, covers transient errors |

### 4.2 Why This Approach Over Alternatives

**Alternative 1: Modify LangGraph Source**
- Rejected: Not maintainable, upstream changes would override

**Alternative 2: Connection Pool at App Level**
- Rejected: psycopg_pool doesn't integrate cleanly with AsyncPostgresSaver's connection ownership model

**Alternative 3: Retry at HTTP Layer**
- Rejected: Too coarse-grained, would retry entire agent execution

**Alternative 4: Use MemorySaver Fallback**
- Rejected: Loses persistence, defeats purpose of checkpointing

**Chosen Approach: Wrapper with Delegation**
- Aligns with Open/Closed principle (extend without modifying)
- Single responsibility for resilience logic
- Dependency injection compatible
- Testable in isolation

### 4.3 Alignment with Existing Codebase Patterns

| Pattern | Existing Usage | Proposed Usage |
|---------|----------------|----------------|
| Context managers | `get_checkpoint_db()`, `get_store_db()` | `get_resilient_checkpoint_db()` |
| Service classes | `CheckpointService`, `ThreadService` | `ResilientAsyncPostgresSaver` |
| Retry decorator | `@retry_db_operation` in `checkpoint.py` | Embedded in wrapper (method-level) |
| Environment config | `DB_URI`, `DB_POOL_*` | `CHECKPOINT_DATABASE_URL`, `CHECKPOINT_*` |
| Worker patterns | `broker.task()` decorators | Worker-level singletons |

---

## 5. Risk Assessment

### 5.1 Potential Pitfalls

| Risk | Mitigation |
|------|------------|
| Connection leak on exception | Use `try/finally` in context manager, test thoroughly |
| Retry masking real errors | Only retry on known connection error patterns |
| Worker singleton state corruption | Reconnect on any error, stateless operation model |
| Direct connection limits | Monitor connection count, document in runbook |
| Migration complexity | Keep old `get_checkpoint_db()` for backward compatibility |

### 5.2 Edge Cases to Handle

1. **Connection loss mid-iteration**: `alist()` buffers results before yielding to handle reconnection
2. **Worker process crash**: TaskIQ handles retry, new worker gets fresh checkpointer
3. **Database failover**: TCP keepalive + retry handles brief outages
4. **Supabase rate limiting**: Exponential backoff prevents rapid retry storms
5. **Configuration errors**: Validate connection string on startup, fail fast

### 5.3 Testing Considerations

**Unit Tests:**
- Mock `AsyncConnection` to simulate connection failures
- Verify retry count and delay timing
- Test error pattern matching

**Integration Tests:**
- Test with actual Supabase direct connection
- Simulate connection drops (firewall rules or proxy)
- Verify checkpoint persistence across reconnections

**Load Tests:**
- Multiple concurrent workers
- Sustained agent streaming
- Connection pool exhaustion scenarios

**Test File Structure:**
```
backend/tests/unit/services/test_resilient_checkpoint.py
backend/tests/integration/test_checkpoint_resilience.py
```

---

## 6. Estimated Complexity

### 6.1 Scope Assessment

| Metric | Value | Justification |
|--------|-------|---------------|
| **Scope** | Medium | New class + config + integration changes |
| **Risk Level** | Medium | Core checkpointing path, but isolated changes |
| **Lines of Code** | ~300 new, ~50 modified | Wrapper class is bulk of work |
| **Files Changed** | 6-8 | Listed in section 3.2 |
| **Estimated Effort** | 2-3 days | Including tests |

### 6.2 Implementation Priority Order

1. **P0 (Day 1):**
   - Create `ResilientAsyncPostgresSaver` class
   - Add environment variables and constants
   - Add `get_resilient_checkpoint_db()` function

2. **P1 (Day 2):**
   - Implement worker-level checkpointer reuse
   - Update `tasks.py` to use new pattern
   - Update `schedule.py` to use resilient checkpointer

3. **P2 (Day 3):**
   - Write unit tests
   - Write integration tests
   - Update health check endpoint
   - Update documentation

### 6.3 Rollback Plan

1. Toggle via environment variable: `USE_RESILIENT_CHECKPOINTER=false`
2. Original `get_checkpoint_db()` preserved
3. No database schema changes required
4. Feature flag at code level if needed

---

## 7. Summary

This proposal provides a clean, maintainable solution for LangGraph Postgres checkpointer stability on Supabase by:

1. **Encapsulating resilience** in a dedicated wrapper class
2. **Using direct connections** to bypass Supavisor limitations
3. **Implementing proven patterns**: TCP keepalive, exponential backoff, retry
4. **Minimizing connection churn** through worker-level reuse
5. **Maintaining backward compatibility** with existing code

The implementation follows SOLID principles, aligns with existing codebase patterns, and provides clear extension points for future enhancements.
