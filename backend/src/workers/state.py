"""Worker-level state management for TaskIQ workers.

This module provides singleton instances that persist across task executions
within a single worker process. This pattern avoids the overhead of creating
new database connections for every task.

The checkpointer is created once when the worker starts and reused for all tasks
processed by that worker. The store is the *process*-level singleton owned by
``services/db.py`` (see :func:`src.services.db.get_shared_store`); this class holds
a reference to it rather than its own instance, so the worker, the API, and the
scheduler jobs each open exactly one store pool per process (#957).

Design Rationale:
- TaskIQ workers are single-threaded by default
- Connection reuse dramatically reduces Supavisor pressure
- Async lock in ResilientAsyncPostgresSaver handles concurrent coroutines
"""

import asyncio
import os
import socket
from typing import Optional
from uuid import uuid4

import redis.asyncio as redis
from langgraph.store.postgres import AsyncPostgresStore

from src.services.checkpoint_resilient import ResilientAsyncPostgresSaver
from src.services.db import close_shared_store, get_shared_store
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
from src.constants.redis import REDIS_URL
from src.utils.format import get_time
from src.utils.logger import logger

# Heartbeat key TTL (seconds). A worker refreshes its key well within this
# window; if the worker dies, the key expires and external health-checkers can
# detect the stale/absent worker automatically.
HEARTBEAT_TTL = 30

# Stable per-process worker identity, generated once at import time. Used as the
# heartbeat key suffix (``worker:heartbeat:<worker_id>``) so each live worker
# owns exactly one heartbeat key.
WORKER_ID = f"{socket.gethostname()}:{os.getpid()}:{uuid4().hex[:8]}"


class WorkerState:
    """Singleton state container for TaskIQ worker process.

    Holds shared resources that should persist across task executions:
    - Checkpointer: Resilient PostgresSaver for LangGraph state
    - Store: AsyncPostgresStore for LangGraph store operations

    Thread Safety:
    - TaskIQ workers are single-threaded by default
    - Async lock in ResilientAsyncPostgresSaver handles concurrent coroutines
    - _init_lock serializes concurrent initialize() calls from lazy-init paths

    Usage:
        # On worker startup
        await WorkerState.initialize()

        # In task execution
        checkpointer = WorkerState.get_checkpointer()
        store = WorkerState.get_store()

        # On worker shutdown
        await WorkerState.shutdown()
    """

    _instance: Optional["WorkerState"] = None
    _checkpointer: Optional[ResilientAsyncPostgresSaver] = None
    _store: Optional[AsyncPostgresStore] = None
    _initialized: bool = False
    _init_lock: asyncio.Lock = asyncio.Lock()

    # Graceful-drain flag. Set True on shutdown so the worker refuses NEW tasks
    # while letting in-flight runs complete. Draining is terminal — drain leads
    # to shutdown — so there is intentionally no method to clear it.
    _draining: bool = False

    # Stable identity for this worker process; the heartbeat key suffix.
    worker_id: str = WORKER_ID

    @classmethod
    def get_instance(cls) -> "WorkerState":
        """Get or create the singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    async def initialize(cls) -> None:
        """Initialize worker state (called on worker startup).

        Creates the shared checkpointer and store instances and establishes
        the initial database connections. Uses an asyncio.Lock to serialize
        concurrent callers and cleans up partial resources on failure.
        """
        instance = cls.get_instance()

        async with instance._init_lock:
            # Re-check after acquiring lock (another caller may have completed init)
            if instance._initialized:
                logger.debug("Worker state already initialized, skipping")
                return

            logger.info(
                "worker_state_initializing",
                extra={
                    "event": "worker_state_initializing",
                },
            )

            # Write the liveness heartbeat key early so it lands even if the
            # checkpointer/store setup below is slow or stubbed. A heartbeat
            # failure must never abort worker startup — log and continue.
            await cls._write_heartbeat()

            try:
                # Create and connect checkpointer
                instance._checkpointer = ResilientAsyncPostgresSaver(
                    connection_string=DB_URI_SESSION,
                    max_retries=CHECKPOINT_MAX_RETRIES,
                    base_delay=CHECKPOINT_RETRY_DELAY,
                    max_delay=CHECKPOINT_MAX_DELAY,
                    jitter=CHECKPOINT_JITTER,
                    enable_fallback=CHECKPOINT_ENABLE_FALLBACK,
                    health_check_interval=CHECKPOINT_HEALTH_CHECK_INTERVAL,
                    keepalives=1,
                    keepalives_idle=DB_KEEPALIVE_IDLE,
                    keepalives_interval=DB_KEEPALIVE_INTERVAL,
                    keepalives_count=DB_KEEPALIVE_COUNT,
                )
                await instance._checkpointer.connect()

                # Ensure checkpoint tables exist
                await instance._checkpointer.setup()

                # Store lifecycle now lives in services/db.py, so the worker process
                # and anything else importing it share one instance (#957). Holding a
                # second exit stack here would mean two owners of one resource.
                instance._store = await get_shared_store()

                instance._initialized = True
                logger.info(
                    "worker_state_initialized",
                    extra={
                        "event": "worker_state_initialized",
                        "status": "success",
                    },
                )
            except Exception:
                # Clean up any partially-created resources
                logger.exception("worker_state_init_failed")
                await cls._cleanup_resources(instance)
                raise

    @classmethod
    async def _cleanup_resources(cls, instance: "WorkerState") -> None:
        """Release any resources on the instance, regardless of _initialized state."""
        # The store is owned by services/db.py; closing it also cancels its internal
        # batch loop task. Idempotent, so the double call from initialize()'s failure
        # branch and from shutdown() is safe.
        if instance._store is not None:
            try:
                await close_shared_store()
            except Exception as e:
                logger.warning("Error closing shared store during cleanup: %s", e)
        instance._store = None

        if instance._checkpointer:
            try:
                await instance._checkpointer.close()
            except Exception as e:
                logger.warning("Error closing checkpointer during cleanup: %s", e)
            instance._checkpointer = None

        instance._initialized = False

    @classmethod
    async def shutdown(cls) -> None:
        """Cleanup worker state (called on worker shutdown).

        Closes the checkpointer and store connections and releases resources.
        Attempts cleanup even if _initialized is False to release any
        partially-created resources from a failed initialize().
        """
        instance = cls.get_instance()

        has_resources = instance._initialized or instance._checkpointer is not None or instance._store is not None
        if not has_resources:
            logger.debug("Worker state has no resources, nothing to shutdown")
            return

        logger.info(
            "worker_state_shutting_down",
            extra={
                "event": "worker_state_shutting_down",
            },
        )

        await cls._cleanup_resources(instance)

        logger.info(
            "worker_state_shutdown_complete",
            extra={
                "event": "worker_state_shutdown_complete",
            },
        )

    @classmethod
    def get_checkpointer(cls) -> ResilientAsyncPostgresSaver:
        """Get the shared checkpointer instance.

        Returns:
            The worker's shared ResilientAsyncPostgresSaver instance

        Raises:
            RuntimeError: If worker state not initialized
        """
        instance = cls.get_instance()
        if not instance._initialized or not instance._checkpointer:
            raise RuntimeError(
                "Worker state not initialized. Ensure WorkerState.initialize() "
                "is called on worker startup via TaskIQ lifecycle hooks."
            )
        return instance._checkpointer

    @classmethod
    def get_store(cls) -> AsyncPostgresStore:
        """Get the shared store instance.

        Returns:
            The worker's shared AsyncPostgresStore instance

        Raises:
            RuntimeError: If worker state not initialized
        """
        instance = cls.get_instance()
        if not instance._initialized or not instance._store:
            raise RuntimeError(
                "Worker state not initialized. Ensure WorkerState.initialize() "
                "is called on worker startup via TaskIQ lifecycle hooks."
            )
        return instance._store

    @classmethod
    def is_initialized(cls) -> bool:
        """Check if worker state is initialized."""
        instance = cls.get_instance()
        return instance._initialized

    @classmethod
    def get_metrics(cls) -> dict:
        """Get metrics from the worker state.

        Returns:
            Dictionary containing:
            - initialized: Whether worker state is initialized
            - checkpointer_metrics: Metrics from the checkpointer (if available)
        """
        instance = cls.get_instance()
        metrics = {
            "initialized": instance._initialized,
        }
        if instance._checkpointer:
            metrics["checkpointer_metrics"] = instance._checkpointer.metrics
        return metrics

    # --- Graceful drain -----------------------------------------------------

    @classmethod
    def mark_draining(cls) -> None:
        """Signal that this worker is draining and must refuse NEW tasks.

        Called from the broker shutdown hook before resource teardown so that
        in-flight runs can finish while ``run_agent_stream`` short-circuits any
        newly-dispatched work. Draining is terminal: there is intentionally no
        method to clear the flag — a drained worker proceeds to shutdown.
        """
        cls._draining = True
        logger.info(
            "worker_state_draining",
            extra={
                "event": "worker_state_draining",
                "worker_id": cls.worker_id,
            },
        )

    @classmethod
    def is_draining(cls) -> bool:
        """Return whether this worker is draining (refusing new tasks)."""
        return cls._draining

    # --- Liveness heartbeat -------------------------------------------------

    @classmethod
    async def _write_heartbeat(cls) -> None:
        """Write/refresh the ``worker:heartbeat:<worker_id>`` key with a TTL.

        Defensive by design: a Redis failure here is logged and swallowed so a
        heartbeat hiccup never aborts worker startup or task processing.
        """
        try:
            client = redis.from_url(REDIS_URL)
            try:
                await client.set(
                    f"worker:heartbeat:{cls.worker_id}",
                    get_time(),
                    ex=HEARTBEAT_TTL,
                )
            finally:
                close = getattr(client, "aclose", None)
                if close is not None:
                    await close()
        except Exception as e:  # pragma: no cover - defensive
            logger.warning("Failed to write worker heartbeat: %s", e)

    @classmethod
    async def heartbeat(cls) -> None:
        """Refresh the liveness heartbeat key.

        Intended to be called periodically by a background refresher so the key
        TTL is renewed while the worker is alive. Shares the same defensive
        write path as the initial heartbeat written during ``initialize()``.
        """
        await cls._write_heartbeat()


async def get_worker_checkpointer() -> ResilientAsyncPostgresSaver:
    """Get the worker's shared checkpointer instance.

    Convenience function for use in tasks. Will lazily initialize
    the worker state if not already initialized (handles cases where
    TaskIQ lifecycle hooks don't fire).

    Returns:
        The worker's shared ResilientAsyncPostgresSaver instance
    """
    if not WorkerState.is_initialized():
        logger.info(
            "worker_state_lazy_init",
            extra={
                "event": "worker_state_lazy_init",
                "reason": "lifecycle_hooks_not_fired",
            },
        )
        await WorkerState.initialize()
    return WorkerState.get_checkpointer()


async def get_worker_store() -> AsyncPostgresStore:
    """Get the worker's shared store instance.

    Convenience function for use in tasks. Will lazily initialize
    the worker state if not already initialized.

    Returns:
        The worker's shared AsyncPostgresStore instance
    """
    if not WorkerState.is_initialized():
        logger.info(
            "worker_state_lazy_init",
            extra={
                "event": "worker_state_lazy_init",
                "reason": "lifecycle_hooks_not_fired",
            },
        )
        await WorkerState.initialize()
    return WorkerState.get_store()
