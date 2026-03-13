"""Worker-level state management for TaskIQ workers.

This module provides singleton instances that persist across task executions
within a single worker process. This pattern avoids the overhead of creating
new database connections for every task.

The checkpointer and store instances are created once when the worker starts
and reused for all tasks processed by that worker.

Design Rationale:
- TaskIQ workers are single-threaded by default
- Connection reuse dramatically reduces Supavisor pressure
- Async lock in ResilientAsyncPostgresSaver handles concurrent coroutines
"""

import asyncio
import contextlib
from typing import Optional

from langgraph.store.postgres import AsyncPostgresStore

from src.services.checkpoint_resilient import ResilientAsyncPostgresSaver
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
from src.utils.logger import logger


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
    _store_exit_stack: Optional[contextlib.AsyncExitStack] = None
    _initialized: bool = False
    _init_lock: asyncio.Lock = asyncio.Lock()

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

                # Create singleton store via AsyncExitStack to manage the context manager
                from src.services.db import get_store_db

                instance._store_exit_stack = contextlib.AsyncExitStack()
                instance._store = await instance._store_exit_stack.enter_async_context(get_store_db())

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
        if instance._store_exit_stack:
            try:
                await instance._store_exit_stack.aclose()
            except Exception as e:
                logger.warning("Error closing store exit stack during cleanup: %s", e)
            instance._store_exit_stack = None

        # Defense-in-depth: cancel store's internal batch loop task
        if instance._store and hasattr(instance._store, "_task"):
            task = instance._store._task
            if task and not task.done():
                task.cancel()
                try:
                    await asyncio.wait_for(task, timeout=5.0)
                except (asyncio.CancelledError, asyncio.TimeoutError):
                    pass
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

        has_resources = (
            instance._initialized
            or instance._checkpointer is not None
            or instance._store is not None
            or instance._store_exit_stack is not None
        )
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
