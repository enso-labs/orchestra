# Architectural Proposal: Stabilize LangGraph Postgres Checkpointing on Supabase

**Author:** AGENT_1 (ARCHITECT)
**Date:** 2026-01-19
**Status:** Draft

---

## 1. Executive Summary

The current LangGraph PostgresSaver implementation experiences intermittent SSL connection failures when operating against Supabase's Supavisor connection pooler. The root cause is a fundamental incompatibility between psycopg's async pipeline mode and transaction-level connection pooling. **The recommended solution involves a three-pronged approach**: (1) split database connectivity to use session-mode pooling (port 5432) exclusively for checkpointing while maintaining transaction pooling for ORM operations, (2) implement a `ResilientAsyncPostgresSaver` wrapper with connection health monitoring and automatic reconnection, and (3) restructure TaskIQ workers to maintain persistent checkpointer instances per worker lifecycle rather than per-task creation.

---

## 2. Architectural Analysis

### 2.1 Current State Assessment

#### Database Connectivity Architecture

```
Current Flow:

  FastAPI API  -----------------> Supabase Supavisor (Port 5432)
       |                                    |
       |                                    v
       |                          PostgreSQL Database
       |                                    ^
       v                                    |
  TaskIQ Workers -----------------> Supabase Supavisor (Port 5432)
  (per-task connections)
```

**Key Files and Their Roles:**

| File | Purpose | Current Behavior |
|------|---------|------------------|
| `backend/src/services/db.py` | Database connection factory | Creates `AsyncConnection.connect()` with `prepare_threshold=None` via `get_checkpoint_db()` context manager |
| `backend/src/workers/tasks.py` | TaskIQ task definitions | Creates new checkpointer per task execution via `async with get_checkpoint_db()` |
| `backend/src/services/checkpoint.py` | Checkpoint CRUD service | Wraps checkpointer operations with basic retry decorator |
| `backend/src/utils/retry.py` | Generic retry decorator | Exponential backoff, catches `Exception` broadly |
| `backend/src/constants/__init__.py` | Configuration constants | Single `DB_URI` from `POSTGRES_CONNECTION_STRING` env var |

#### Current `get_checkpoint_db()` Implementation (db.py:92-108)

```python
@asynccontextmanager
async def get_checkpoint_db() -> AsyncIterator[AsyncPostgresSaver]:
    async with await AsyncConnection.connect(
        DB_URI,
        autocommit=True,
        prepare_threshold=None,  # Attempts pooler compatibility
        row_factory=dict_row,
    ) as conn:
        yield AsyncPostgresSaver(conn)
```

**Problems with Current Approach:**

1. **Single Connection String**: Both FastAPI (ORM) and LangGraph (checkpointing) use the same `DB_URI`, which typically points to port 5432 (session mode) or 6543 (transaction mode)
2. **Per-Task Connection Churn**: Each TaskIQ task creates a fresh connection, exacerbating pooler pressure
3. **No TCP Keepalives**: Connections can go stale without detection
4. **No Pipeline Mode Control**: `AsyncPostgresSaver` internally uses pipeline mode which is incompatible with transaction pooling
5. **Broad Retry Scope**: The retry decorator catches all `Exception` types without distinguishing recoverable SSL errors from fatal errors

### 2.2 Root Cause Deep Dive

#### Why SSL Connections Close Unexpectedly

```
Timeline of Failure:

1. TaskIQ worker task starts
2. get_checkpoint_db() creates AsyncConnection
3. AsyncPostgresSaver wraps connection, enables pipeline mode
4. Supavisor assigns a backend connection from pool
5. Agent execution begins streaming chunks
6. During long-running stream (>30s typical):
   - Supavisor may reassign backend connection
   - TCP idle timeout may trigger
   - Pipeline mode expects continuous connection
7. SSL negotiation state lost on backend reassignment
8. psycopg.OperationalError: SSL connection closed unexpectedly
```

#### Supavisor Pooling Mode Differences

| Mode | Port | Behavior | LangGraph Compatibility |
|------|------|----------|------------------------|
| **Transaction** | 6543 | New backend per transaction | INCOMPATIBLE - Breaks pipeline mode |
| **Session** | 5432 | Sticky backend per session | COMPATIBLE - Requires keep-alive |

The fundamental issue is that LangGraph's `AsyncPostgresSaver` uses `pipeline=True` in its internal cursor operations, which requires a stable, long-lived connection - something transaction pooling cannot guarantee.

### 2.3 Proposed Architecture

```
Proposed Flow:

  FastAPI API  -----------------> Supabase Supavisor (Port 6543)
       |                          Transaction Mode - for ORM queries
       |
       |                          PostgreSQL Database
       |                                    ^
       |                                    |
  TaskIQ Workers -----------------> Supabase Supavisor (Port 5432)
  (per-worker checkpointer)         Session Mode - for checkpointing
       |
       v
  ResilientAsyncPostgresSaver
  (connection monitoring + auto-reconnect)
```

**Key Changes:**

1. **Dual Connection Strings**: Introduce `POSTGRES_CONNECTION_STRING_SESSION` for checkpointing
2. **Worker-Level Checkpointer**: Single checkpointer instance per TaskIQ worker, not per task
3. **Resilient Wrapper**: New `ResilientAsyncPostgresSaver` with health checks and reconnection
4. **TCP Keepalives**: Configure at connection level to detect stale connections early
5. **Targeted Retries**: Catch specific `psycopg.OperationalError` subtypes

---

## 3. Implementation Strategy

### 3.1 Phase 1: Configuration Enhancements

#### 3.1.1 New Environment Variables

**File: `backend/src/constants/__init__.py`**

```python
# New constants to add:

def get_db_uri_session():
    """Get session-mode connection string for checkpointing.

    Falls back to main DB_URI if not explicitly set.
    Session mode (port 5432) is required for LangGraph checkpointing
    due to pipeline mode requirements.
    """
    uri = os.getenv("POSTGRES_CONNECTION_STRING_SESSION")
    if not uri:
        # Fall back to main URI, assuming it's session mode
        return DB_URI
    return uri

DB_URI_SESSION = get_db_uri_session()

# TCP keepalive settings for long-running connections
DB_KEEPALIVE_IDLE = int(os.getenv("DB_KEEPALIVE_IDLE", "60"))  # seconds
DB_KEEPALIVE_INTERVAL = int(os.getenv("DB_KEEPALIVE_INTERVAL", "15"))  # seconds
DB_KEEPALIVE_COUNT = int(os.getenv("DB_KEEPALIVE_COUNT", "4"))  # retries

# Checkpointer resilience settings
CHECKPOINT_MAX_RETRIES = int(os.getenv("CHECKPOINT_MAX_RETRIES", "3"))
CHECKPOINT_RETRY_DELAY = float(os.getenv("CHECKPOINT_RETRY_DELAY", "1.0"))  # seconds
CHECKPOINT_HEALTH_CHECK_INTERVAL = int(os.getenv("CHECKPOINT_HEALTH_CHECK_INTERVAL", "30"))  # seconds
```

#### 3.1.2 Connection Parameter Factory

**File: `backend/src/services/db.py`** (new function)

```python
def get_checkpoint_connection_kwargs() -> dict:
    """Generate connection kwargs optimized for checkpointing.

    Returns kwargs compatible with psycopg.AsyncConnection.connect()
    that ensure:
    - Prepared statements disabled (pooler compatibility)
    - TCP keepalives enabled (stale connection detection)
    - Autocommit mode (required by AsyncPostgresSaver)
    """
    return {
        "autocommit": True,
        "prepare_threshold": None,  # Disable prepared statements
        "row_factory": dict_row,
        "keepalives": 1,
        "keepalives_idle": DB_KEEPALIVE_IDLE,
        "keepalives_interval": DB_KEEPALIVE_INTERVAL,
        "keepalives_count": DB_KEEPALIVE_COUNT,
    }
```

### 3.2 Phase 2: Resilient Checkpointer Wrapper

#### 3.2.1 New Module: `backend/src/services/checkpoint_resilient.py`

```python
"""Resilient PostgresSaver wrapper for Supabase Supavisor compatibility.

This module provides a wrapper around LangGraph's AsyncPostgresSaver that:
1. Handles SSL connection drops gracefully via automatic reconnection
2. Monitors connection health proactively
3. Implements targeted retry logic for transient failures
4. Maintains connection state across operations

Design Rationale:
- Supabase Supavisor can drop connections due to pooler reassignment
- LangGraph pipeline mode requires stable, long-lived connections
- TCP keepalives detect stale connections but don't prevent them
- Automatic reconnection with state preservation provides resilience
"""

import asyncio
from contextlib import asynccontextmanager
from typing import AsyncIterator, Optional, Sequence
from functools import wraps

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.checkpoint.base import (
    Checkpoint,
    CheckpointMetadata,
    CheckpointTuple,
    ChannelVersions,
)
from psycopg import AsyncConnection, OperationalError
from psycopg.rows import dict_row
from langchain_core.runnables.config import RunnableConfig

from src.constants import (
    DB_URI_SESSION,
    CHECKPOINT_MAX_RETRIES,
    CHECKPOINT_RETRY_DELAY,
    CHECKPOINT_HEALTH_CHECK_INTERVAL,
)
from src.services.db import get_checkpoint_connection_kwargs
from src.utils.logger import logger


class CheckpointConnectionError(Exception):
    """Raised when checkpoint connection cannot be established or recovered."""
    pass


def _is_recoverable_error(error: Exception) -> bool:
    """Determine if an error is potentially recoverable via reconnection.

    Recoverable errors include:
    - SSL connection closures
    - Connection reset by peer
    - Network unreachable (transient)
    - Connection timed out

    Non-recoverable errors include:
    - Authentication failures
    - Permission denied
    - Database does not exist
    """
    if not isinstance(error, OperationalError):
        return False

    error_msg = str(error).lower()
    recoverable_patterns = [
        "ssl connection has been closed",
        "connection reset by peer",
        "network is unreachable",
        "connection timed out",
        "server closed the connection",
        "connection refused",  # Server restart
        "broken pipe",
    ]

    non_recoverable_patterns = [
        "authentication failed",
        "password authentication",
        "permission denied",
        "database .* does not exist",
        "role .* does not exist",
    ]

    for pattern in non_recoverable_patterns:
        if pattern in error_msg:
            return False

    for pattern in recoverable_patterns:
        if pattern in error_msg:
            return True

    # Default to recoverable for unknown OperationalErrors
    return True


def with_reconnect(method):
    """Decorator that wraps checkpointer methods with reconnection logic.

    On recoverable errors:
    1. Logs the error
    2. Attempts reconnection
    3. Retries the operation
    4. Raises CheckpointConnectionError after max retries
    """
    @wraps(method)
    async def wrapper(self: "ResilientAsyncPostgresSaver", *args, **kwargs):
        last_error = None

        for attempt in range(CHECKPOINT_MAX_RETRIES):
            try:
                # Ensure connection is healthy before operation
                if not await self._check_connection_health():
                    await self._reconnect()

                return await method(self, *args, **kwargs)

            except Exception as e:
                last_error = e

                if not _is_recoverable_error(e):
                    logger.error(f"Non-recoverable checkpoint error: {e}")
                    raise

                logger.warning(
                    f"Checkpoint operation failed (attempt {attempt + 1}/{CHECKPOINT_MAX_RETRIES}): {e}"
                )

                if attempt < CHECKPOINT_MAX_RETRIES - 1:
                    await asyncio.sleep(CHECKPOINT_RETRY_DELAY * (2 ** attempt))
                    await self._reconnect()

        raise CheckpointConnectionError(
            f"Checkpoint operation failed after {CHECKPOINT_MAX_RETRIES} attempts"
        ) from last_error

    return wrapper


class ResilientAsyncPostgresSaver:
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

    def __init__(self, connection_string: str = None):
        self._connection_string = connection_string or DB_URI_SESSION
        self._connection: Optional[AsyncConnection] = None
        self._saver: Optional[AsyncPostgresSaver] = None
        self._last_health_check: float = 0
        self._is_connected: bool = False
        self._lock = asyncio.Lock()

    @classmethod
    @asynccontextmanager
    async def create(cls, connection_string: str = None) -> AsyncIterator["ResilientAsyncPostgresSaver"]:
        """Factory method that returns a connected instance as context manager."""
        instance = cls(connection_string)
        try:
            await instance.connect()
            yield instance
        finally:
            await instance.close()

    async def connect(self) -> None:
        """Establish connection and create the underlying saver."""
        async with self._lock:
            if self._is_connected:
                return

            try:
                kwargs = get_checkpoint_connection_kwargs()
                self._connection = await AsyncConnection.connect(
                    self._connection_string,
                    **kwargs
                )
                self._saver = AsyncPostgresSaver(self._connection)
                self._is_connected = True
                self._last_health_check = asyncio.get_event_loop().time()
                logger.info("Checkpoint connection established")
            except Exception as e:
                logger.error(f"Failed to establish checkpoint connection: {e}")
                raise CheckpointConnectionError(f"Initial connection failed: {e}") from e

    async def close(self) -> None:
        """Close connection and cleanup resources."""
        async with self._lock:
            if self._connection and not self._connection.closed:
                await self._connection.close()
            self._connection = None
            self._saver = None
            self._is_connected = False
            logger.info("Checkpoint connection closed")

    async def _check_connection_health(self) -> bool:
        """Check if connection is healthy via lightweight query.

        Returns True if connection is healthy, False otherwise.
        Skips check if last check was within CHECKPOINT_HEALTH_CHECK_INTERVAL.
        """
        if not self._is_connected or not self._connection:
            return False

        if self._connection.closed:
            self._is_connected = False
            return False

        current_time = asyncio.get_event_loop().time()
        if current_time - self._last_health_check < CHECKPOINT_HEALTH_CHECK_INTERVAL:
            return True

        try:
            # Lightweight health check
            async with self._connection.cursor() as cur:
                await cur.execute("SELECT 1")
            self._last_health_check = current_time
            return True
        except Exception as e:
            logger.warning(f"Connection health check failed: {e}")
            self._is_connected = False
            return False

    async def _reconnect(self) -> None:
        """Close existing connection and establish a new one."""
        async with self._lock:
            logger.info("Attempting checkpoint reconnection...")

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
            kwargs = get_checkpoint_connection_kwargs()
            self._connection = await AsyncConnection.connect(
                self._connection_string,
                **kwargs
            )
            self._saver = AsyncPostgresSaver(self._connection)
            self._is_connected = True
            self._last_health_check = asyncio.get_event_loop().time()
            logger.info("Checkpoint reconnection successful")

    async def setup(self) -> None:
        """Create checkpoint tables if they don't exist."""
        if not self._saver:
            raise CheckpointConnectionError("Not connected")
        await self._saver.setup()

    # Delegated methods with reconnect logic

    @with_reconnect
    async def aget(self, config: RunnableConfig) -> Optional[Checkpoint]:
        """Get checkpoint for config."""
        return await self._saver.aget(config)

    @with_reconnect
    async def aget_tuple(self, config: RunnableConfig) -> Optional[CheckpointTuple]:
        """Get checkpoint tuple for config."""
        return await self._saver.aget_tuple(config)

    @with_reconnect
    async def aput(
        self,
        config: RunnableConfig,
        checkpoint: Checkpoint,
        metadata: CheckpointMetadata,
        new_versions: ChannelVersions,
    ) -> RunnableConfig:
        """Store checkpoint."""
        return await self._saver.aput(config, checkpoint, metadata, new_versions)

    @with_reconnect
    async def aput_writes(
        self,
        config: RunnableConfig,
        writes: Sequence[tuple[str, Any]],
        task_id: str,
    ) -> None:
        """Store intermediate writes."""
        return await self._saver.aput_writes(config, writes, task_id)

    async def alist(
        self,
        config: RunnableConfig,
        *,
        filter: Optional[dict] = None,
        before: Optional[RunnableConfig] = None,
        limit: Optional[int] = None,
    ) -> AsyncIterator[CheckpointTuple]:
        """List checkpoints. Note: This is a generator, reconnect per iteration."""
        async for checkpoint in self._saver.alist(config, filter=filter, before=before, limit=limit):
            yield checkpoint

    @with_reconnect
    async def adelete_thread(self, thread_id: str) -> None:
        """Delete all checkpoints for a thread."""
        # AsyncPostgresSaver doesn't have adelete_thread, implement via SQL
        if not self._connection:
            raise CheckpointConnectionError("Not connected")

        async with self._connection.cursor() as cur:
            await cur.execute(
                "DELETE FROM checkpoints WHERE thread_id = %s",
                (thread_id,)
            )
```

### 3.3 Phase 3: Worker Lifecycle Refactoring

#### 3.3.1 Worker-Level Checkpointer Singleton

**File: `backend/src/workers/state.py`** (NEW)

```python
"""Worker-level state management for TaskIQ workers.

This module provides singleton instances that persist across task executions
within a single worker process. This pattern avoids the overhead of creating
new database connections for every task.

The checkpointer instance is created once when the worker starts and reused
for all tasks processed by that worker.
"""

from typing import Optional
from src.services.checkpoint_resilient import ResilientAsyncPostgresSaver
from src.utils.logger import logger


class WorkerState:
    """Singleton state container for TaskIQ worker process.

    Holds shared resources that should persist across task executions:
    - Checkpointer: Resilient PostgresSaver for LangGraph state

    Thread Safety:
    - TaskIQ workers are single-threaded by default
    - Async lock in ResilientAsyncPostgresSaver handles concurrent coroutines
    """

    _instance: Optional["WorkerState"] = None
    _checkpointer: Optional[ResilientAsyncPostgresSaver] = None
    _initialized: bool = False

    @classmethod
    def get_instance(cls) -> "WorkerState":
        """Get or create the singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    async def initialize(cls) -> None:
        """Initialize worker state (called on worker startup)."""
        instance = cls.get_instance()
        if instance._initialized:
            return

        logger.info("Initializing worker state...")

        # Create and connect checkpointer
        instance._checkpointer = ResilientAsyncPostgresSaver()
        await instance._checkpointer.connect()
        await instance._checkpointer.setup()

        instance._initialized = True
        logger.info("Worker state initialized successfully")

    @classmethod
    async def shutdown(cls) -> None:
        """Cleanup worker state (called on worker shutdown)."""
        instance = cls.get_instance()
        if not instance._initialized:
            return

        logger.info("Shutting down worker state...")

        if instance._checkpointer:
            await instance._checkpointer.close()
            instance._checkpointer = None

        instance._initialized = False
        logger.info("Worker state shutdown complete")

    @classmethod
    def get_checkpointer(cls) -> ResilientAsyncPostgresSaver:
        """Get the shared checkpointer instance.

        Raises:
            RuntimeError: If worker state not initialized
        """
        instance = cls.get_instance()
        if not instance._initialized or not instance._checkpointer:
            raise RuntimeError(
                "Worker state not initialized. Ensure WorkerState.initialize() "
                "is called on worker startup."
            )
        return instance._checkpointer


# Convenience functions for use in tasks
async def get_worker_checkpointer() -> ResilientAsyncPostgresSaver:
    """Get the worker's shared checkpointer instance."""
    return WorkerState.get_checkpointer()
```

#### 3.3.2 TaskIQ Lifecycle Hooks

**File: `backend/src/workers/broker.py`** (MODIFY)

```python
"""TaskIQ Redis broker configuration for distributed workers.

This module configures the TaskIQ broker with Redis Streams for reliable
task queuing and result storage.

Environment Variables:
    REDIS_URL: Redis connection URL (default: redis://localhost:6379/0)
"""

import os
from taskiq_redis import RedisStreamBroker, RedisAsyncResultBackend

# Redis connection URL from environment
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Result backend with 5-minute TTL for task results
result_backend = RedisAsyncResultBackend(
    redis_url=REDIS_URL,
    result_ex_time=300,  # 5 minute TTL
)

# Redis Stream broker for task distribution
broker = RedisStreamBroker(
    url=REDIS_URL,
    queue_name="orchestra_tasks",
).with_result_backend(result_backend)


# Worker lifecycle hooks
@broker.on_event("startup")
async def on_startup():
    """Initialize worker state on startup."""
    from src.workers.state import WorkerState
    await WorkerState.initialize()


@broker.on_event("shutdown")
async def on_shutdown():
    """Cleanup worker state on shutdown."""
    from src.workers.state import WorkerState
    await WorkerState.shutdown()
```

#### 3.3.3 Updated Task Implementation

**File: `backend/src/workers/tasks.py`** (MODIFY)

```python
"""TaskIQ task definitions for distributed agent execution.

Key Changes from Original:
1. Uses worker-level checkpointer instead of per-task connections
2. Checkpointer is obtained from WorkerState singleton
3. Removed get_checkpoint_db() context manager usage
4. Added explicit error handling for checkpoint failures
"""

import ujson
import redis.asyncio as redis
from src.workers.broker import broker, REDIS_URL


@broker.task(task_name="run_agent_stream")
async def run_agent_stream(
    task_dict: dict,
    user_id: str,
    thread_id: str,
) -> dict:
    """
    Execute agent and stream results via Redis Streams.

    This task uses the worker-level checkpointer for efficiency:
    - Single connection per worker, not per task
    - Automatic reconnection on transient failures
    - Reduced connection pool pressure on Supavisor
    """
    from deepagents.backends import StoreBackend
    from langchain.tools import ToolRuntime
    from src.schemas.entities import LLMRequest
    from src.schemas.contexts import ContextSchema
    from src.flows import construct_agent, init_config, init_backend
    from src.services.db import get_store_db
    from src.contexts.service import ServiceContext
    from src.utils.stream import handle_multi_mode
    from src.utils.logger import logger
    from src.utils.format import get_time
    from src.workers.state import get_worker_checkpointer
    from src.services.checkpoint_resilient import CheckpointConnectionError

    stream_key = f"agent:stream:{thread_id}"
    redis_client = redis.from_url(REDIS_URL)

    # Clear any existing stream from previous turns
    await redis_client.delete(stream_key)

    try:
        # Reconstruct request from dict
        params = LLMRequest(**task_dict)
        params.metadata.user_id = user_id
        params.metadata.thread_id = thread_id

        logger.info(f"Starting distributed agent task for thread: {thread_id}")

        # Initialize config
        config = init_config(params, user_id)
        files_map = config["configurable"].get("files", {})
        todos_list = config["configurable"].get("todos", [])

        # Get worker-level checkpointer (persistent per worker)
        checkpointer = await get_worker_checkpointer()

        # Store still uses per-task connection (lower risk, different access pattern)
        async with get_store_db() as store:
            service_context = ServiceContext(
                user_id=user_id,
                store=store,
                config=config,
                checkpointer=checkpointer,
            )

            # Get assistant config if needed
            params = await service_context.llm_service.assistant(params)

            # Initialize ToolRuntime and Backend
            ctx_schema = ContextSchema(model=params.model or "", user_id=user_id)
            runtime = ToolRuntime(
                state={"messages": [], "files": files_map},
                context=ctx_schema,
                tool_call_id="tc_worker",
                store=service_context.store,
                stream_writer=lambda _: None,
                config=config,
            )
            store_backend = StoreBackend(runtime)
            routes = {
                f"/users/{user_id}/memories/": store_backend,
                f"/users/{user_id}/config/": store_backend,
            }
            backend = init_backend(runtime, routes=routes)

            agent = await construct_agent(
                instructions=params.instructions,
                system_prompt=params.system_prompt,
                tools=params.tools,
                model=params.model,
                subagents=params.subagents,
                checkpointer=checkpointer,
                service_context=service_context,
                backend=backend,
            )
            params.input.messages[-1].model = agent.model

            # Send metadata event first
            metadata_event = ujson.dumps(
                (
                    "metadata",
                    {
                        "thread_id": config["configurable"].get("thread_id"),
                        "assistant_id": config["configurable"].get("assistant_id"),
                        "project_id": config["configurable"].get("project_id"),
                    },
                )
            )
            await redis_client.xadd(stream_key, {"data": metadata_event})

            # Stream to Redis
            async for chunk in agent.astream(
                params.input,
                stream_mode=["messages", "values"],
                config=config,
                context=ctx_schema,
            ):
                stream_chunk = handle_multi_mode(chunk)
                if stream_chunk:
                    stream_type = stream_chunk[0]
                    chunk_data = stream_chunk[1]
                    if stream_type == "values" and chunk_data.get("files"):
                        files_map = {**files_map, **chunk_data["files"]}
                    if stream_type == "values" and "todos" in chunk_data:
                        todos_list = chunk_data["todos"]
                    data = ujson.dumps(stream_chunk)
                    await redis_client.xadd(stream_key, {"data": data})

            # Signal completion
            await redis_client.xadd(stream_key, {"done": "true"})
            await redis_client.expire(stream_key, 300)

            logger.info(f"Distributed agent task completed for thread: {thread_id}")

            # Update thread state
            if service_context.user_id and checkpointer:
                try:
                    final_state = await agent.graph.aget_state(config)

                    if not final_state or not final_state.values.get("messages"):
                        logger.warning(
                            f"Checkpoint update resulted in empty state for thread {thread_id}"
                        )

                    configurable = {
                        **final_state.config.get("configurable", {}),
                        **config["configurable"],
                    }
                    messages = final_state.values.get("messages", [])
                    if messages:
                        messages[-1].model = agent.model

                    service_context.store.fields = ["messages", "files"]
                    await service_context.thread_service.update(
                        thread_id=configurable.get("thread_id"),
                        data={
                            "thread_id": configurable.get("thread_id"),
                            "checkpoint_id": configurable.get("checkpoint_id"),
                            "assistant_id": configurable.get("assistant_id"),
                            "project_id": configurable.get("project_id"),
                            "messages": messages,
                            "todos": todos_list,
                            "files": files_map,
                            "updated_at": get_time(),
                        },
                    )
                    logger.info(f"checkpoint: {ujson.dumps(configurable)}")
                except CheckpointConnectionError as e:
                    logger.error(f"Checkpoint connection failed for thread {thread_id}: {e}")
                    # Don't fail the whole task - stream was successful
                    # The checkpoint state may be stale but can be recovered

        return {"status": "complete", "stream_key": stream_key}

    except CheckpointConnectionError as e:
        logger.exception(f"Checkpoint connection error for thread {thread_id}: {e}")
        await redis_client.xadd(stream_key, {"error": f"Checkpoint error: {e}", "done": "true"})
        await redis_client.expire(stream_key, 300)
        raise

    except Exception as e:
        logger.exception(f"Task failed for thread {thread_id}: {e}")
        try:
            await redis_client.xadd(stream_key, {"error": str(e), "done": "true"})
            await redis_client.expire(stream_key, 300)
        except Exception as redis_err:
            logger.error(f"Failed to send error to Redis for thread {thread_id}: {redis_err}")
        raise

    finally:
        await redis_client.aclose()
```

### 3.4 Phase 4: FastAPI Integration Updates

#### 3.4.1 Update `stream_generator` in stream.py

**File: `backend/src/utils/stream.py`** (MODIFY `stream_generator` function)

The synchronous streaming path in FastAPI also needs the resilient checkpointer. Since this path doesn't have worker-level state, we use the context manager pattern:

```python
async def stream_generator(
    input: LLMInput,
    model: BaseChatModel,
    system_prompt: str,
    tools: list[BaseTool],
    subagents: list[SubAgent],
    config: RunnableConfig,
    service_context: ServiceContext,
    instructions: str = None,
):
    files_map = config["metadata"].get("files", {}) or input.files or {}
    todos_list = config["metadata"].get("todos", [])

    # Use resilient checkpointer instead of basic get_checkpoint_db
    from src.services.checkpoint_resilient import ResilientAsyncPostgresSaver, CheckpointConnectionError

    async with ResilientAsyncPostgresSaver.create() as checkpointer:
        try:
            # ... rest of implementation unchanged ...
```

### 3.5 File Summary

| File | Action | Description |
|------|--------|-------------|
| `backend/src/constants/__init__.py` | MODIFY | Add `DB_URI_SESSION`, keepalive settings, checkpoint resilience settings |
| `backend/src/services/db.py` | MODIFY | Add `get_checkpoint_connection_kwargs()` function |
| `backend/src/services/checkpoint_resilient.py` | CREATE | `ResilientAsyncPostgresSaver` wrapper class |
| `backend/src/workers/state.py` | CREATE | `WorkerState` singleton for worker-level resources |
| `backend/src/workers/broker.py` | MODIFY | Add startup/shutdown lifecycle hooks |
| `backend/src/workers/tasks.py` | MODIFY | Use worker-level checkpointer instead of per-task |
| `backend/src/utils/stream.py` | MODIFY | Use `ResilientAsyncPostgresSaver` in `stream_generator` |
| `docker-compose.yml` | MODIFY | Add `POSTGRES_CONNECTION_STRING_SESSION` env var to worker |

---

## 4. Design Decisions

### 4.1 Trade-offs Considered

#### Decision 1: Wrapper Pattern vs. Subclassing AsyncPostgresSaver

**Chosen: Wrapper Pattern (Composition)**

| Approach | Pros | Cons |
|----------|------|------|
| **Wrapper** | - No coupling to LangGraph internals<br>- Easy to update when LangGraph changes<br>- Clear separation of concerns | - Slight indirection overhead<br>- Must delegate all methods |
| **Subclass** | - Direct access to internals<br>- Less code | - Tight coupling<br>- May break on LangGraph updates<br>- Private method access issues |

**Rationale**: LangGraph is actively developed and `AsyncPostgresSaver` internals may change. The wrapper pattern isolates our resilience logic from implementation details.

#### Decision 2: Worker-Level vs. Per-Task Checkpointer

**Chosen: Worker-Level (Singleton per Worker)**

| Approach | Pros | Cons |
|----------|------|------|
| **Worker-Level** | - Minimal connection churn<br>- Efficient pooler usage<br>- Fast task startup | - Shared state risk<br>- Must handle concurrent tasks |
| **Per-Task** | - Complete isolation<br>- Simple cleanup | - High connection churn<br>- Slower task startup<br>- Pooler pressure |

**Rationale**: TaskIQ workers are single-threaded by default, so concurrent task risk is low. The async lock in `ResilientAsyncPostgresSaver` handles coroutine concurrency. Connection reuse dramatically reduces Supavisor pressure.

#### Decision 3: Dual Connection Strings vs. Connection Multiplexer

**Chosen: Dual Connection Strings**

| Approach | Pros | Cons |
|----------|------|------|
| **Dual Strings** | - Simple configuration<br>- Clear separation<br>- Easy to understand | - Two env vars to manage |
| **Multiplexer** | - Single config point<br>- Dynamic routing | - Complex implementation<br>- Harder to debug |

**Rationale**: Explicit configuration is easier to audit and troubleshoot. Different ports serve different purposes and should be clearly separated.

### 4.2 Why This Approach Over Alternatives

#### Alternative A: Switch to Memory-Based Checkpointing

**Rejected Because:**
- Loses persistence across restarts
- Not suitable for production distributed systems
- Defeats purpose of checkpoint recovery

#### Alternative B: Direct Connection to Database (Bypass Pooler)

**Rejected Because:**
- Requires opening firewall to direct connections
- Loses benefits of connection pooling for other operations
- Security implications with exposed database

#### Alternative C: PgBouncer Instead of Supavisor

**Rejected Because:**
- Requires self-managed infrastructure
- Supavisor is Supabase's managed solution
- Session mode on port 5432 is already compatible

### 4.3 Alignment with Existing Codebase Patterns

The proposed implementation aligns with existing patterns:

1. **Context Manager Pattern**: `ResilientAsyncPostgresSaver.create()` follows `get_checkpoint_db()` and `get_store_db()` patterns
2. **Retry Decorator Pattern**: `@with_reconnect` mirrors `@retry_db_operation` in `utils/retry.py`
3. **Singleton Service Pattern**: `WorkerState` follows `ScheduleService`, `CheckpointService` patterns
4. **Configuration via Environment**: New constants follow existing `DB_POOL_*` pattern
5. **Lifecycle Hooks**: TaskIQ hooks mirror FastAPI's `lifespan` context manager

---

## 5. Risk Assessment

### 5.1 Potential Pitfalls

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Reconnection during checkpoint write** | Medium | High | Transaction-based writes in PostgresSaver ensure atomicity |
| **Worker state corruption** | Low | High | Async lock prevents concurrent modifications |
| **Health check overhead** | Low | Low | Interval-based checks, lightweight SELECT 1 |
| **Env var misconfiguration** | Medium | High | Fallback to existing `DB_URI` if session string not set |
| **LangGraph API changes** | Medium | Medium | Wrapper pattern isolates changes |

### 5.2 Edge Cases to Handle

1. **Worker restart during long-running stream**
   - Stream already written to Redis will be consumed
   - Checkpoint may be incomplete
   - **Handling**: Client reconnects, retrieves partial state, user can retry

2. **Database maintenance window**
   - All connections will fail
   - **Handling**: Retries will exhaust, task fails, Redis stream gets error message

3. **Supavisor upgrade/restart**
   - Temporary connection drops
   - **Handling**: Automatic reconnection after delay

4. **Concurrent tasks on same thread_id**
   - Race condition in checkpoint writes
   - **Handling**: LangGraph's checkpoint versioning handles this

5. **Memory pressure from worker-level connection**
   - Long-lived connection holds resources
   - **Handling**: Health check closes stale connections, worker restart cleans up

### 5.3 Testing Considerations

#### Unit Tests (New)

```
backend/tests/unit/services/test_checkpoint_resilient.py
- test_connection_establishment
- test_reconnect_on_ssl_error
- test_non_recoverable_error_not_retried
- test_health_check_interval
- test_max_retries_exceeded

backend/tests/unit/workers/test_state.py
- test_singleton_instance
- test_initialize_creates_checkpointer
- test_shutdown_closes_connection
- test_get_checkpointer_before_init_raises
```

#### Integration Tests (New)

```
backend/tests/integration/test_checkpoint_resilience.py
- test_checkpoint_survives_connection_drop (requires test fixture that simulates drop)
- test_worker_processes_multiple_tasks_same_checkpointer
- test_stream_completes_after_reconnection
```

#### Manual Testing Checklist

1. [ ] Deploy with `POSTGRES_CONNECTION_STRING_SESSION` pointing to port 5432
2. [ ] Run distributed agent task and verify completion
3. [ ] Simulate connection drop (e.g., via Supabase dashboard pause)
4. [ ] Verify worker reconnects and continues
5. [ ] Check logs for reconnection events
6. [ ] Verify checkpoint data integrity after recovery

---

## 6. Estimated Complexity

### 6.1 Scope Assessment

| Component | Lines of Code | Complexity |
|-----------|---------------|------------|
| `checkpoint_resilient.py` | ~300 | Medium |
| `workers/state.py` | ~80 | Low |
| `constants/__init__.py` changes | ~20 | Low |
| `services/db.py` changes | ~15 | Low |
| `workers/broker.py` changes | ~15 | Low |
| `workers/tasks.py` changes | ~50 | Medium |
| `utils/stream.py` changes | ~10 | Low |
| Unit tests | ~200 | Medium |
| Integration tests | ~100 | Medium |

**Total Estimated New/Modified Code**: ~800 lines

### 6.2 Risk Level: **Medium**

- Core checkpointing is critical path
- Connection handling is complex
- But: Wrapper pattern limits blast radius
- Fallback to existing behavior if wrapper fails

### 6.3 Suggested Priority Order

1. **Phase 1** (Day 1): Configuration enhancements
   - Add new constants
   - Add connection kwargs factory
   - Deploy with existing code to verify no regression

2. **Phase 2** (Day 2-3): Resilient checkpointer
   - Implement `ResilientAsyncPostgresSaver`
   - Add unit tests
   - Test in isolation

3. **Phase 3** (Day 4-5): Worker lifecycle
   - Implement `WorkerState`
   - Add lifecycle hooks to broker
   - Update task implementation
   - Integration testing

4. **Phase 4** (Day 6): FastAPI integration
   - Update `stream_generator`
   - End-to-end testing
   - Documentation update

### 6.4 Deployment Strategy

1. **Canary Deployment**: Deploy to single worker first
2. **Feature Flag**: Use `ENABLE_RESILIENT_CHECKPOINTER` env var to toggle
3. **Monitoring**: Watch for reconnection events in logs
4. **Rollback Plan**: Revert to original `get_checkpoint_db()` if issues arise

---

## 7. Appendix

### A. Environment Variable Reference

```bash
# Database Connectivity
POSTGRES_CONNECTION_STRING=postgresql://user:pass@pooler.supabase.com:6543/db  # Transaction mode
POSTGRES_CONNECTION_STRING_SESSION=postgresql://user:pass@pooler.supabase.com:5432/db  # Session mode

# TCP Keepalive Settings
DB_KEEPALIVE_IDLE=60           # Seconds before first keepalive probe
DB_KEEPALIVE_INTERVAL=15       # Seconds between probes
DB_KEEPALIVE_COUNT=4           # Number of failed probes before connection considered dead

# Checkpoint Resilience
CHECKPOINT_MAX_RETRIES=3       # Max reconnection attempts
CHECKPOINT_RETRY_DELAY=1.0     # Initial retry delay (doubles each attempt)
CHECKPOINT_HEALTH_CHECK_INTERVAL=30  # Seconds between health checks

# Feature Flags (optional)
ENABLE_RESILIENT_CHECKPOINTER=true  # Toggle new checkpointer
```

### B. Monitoring Recommendations

Add these log patterns to alerting:

```
# Warn: Transient failures (expected during maintenance)
"Checkpoint operation failed (attempt"
"Connection health check failed"
"Attempting checkpoint reconnection"

# Error: Persistent failures (investigate)
"Checkpoint operation failed after .* attempts"
"Non-recoverable checkpoint error"
"Checkpoint connection failed for thread"
```

### C. References

- [LangGraph Checkpoint Documentation](https://langchain-ai.github.io/langgraph/reference/checkpoints/)
- [Supabase Supavisor Documentation](https://supabase.com/docs/guides/platform/connection-pooling)
- [psycopg3 Connection Parameters](https://www.psycopg.org/psycopg3/docs/api/connections.html)
- [TaskIQ Lifecycle Events](https://taskiq-python.github.io/guide/lifecycle/)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-19
**Next Review**: After implementation of Phase 2
