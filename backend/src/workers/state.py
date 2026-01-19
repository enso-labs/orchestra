"""Worker-level state management for TaskIQ workers.

This module provides singleton instances that persist across task executions
within a single worker process. This pattern avoids the overhead of creating
new database connections for every task.

The checkpointer instance is created once when the worker starts and reused
for all tasks processed by that worker.

Design Rationale:
- TaskIQ workers are single-threaded by default
- Connection reuse dramatically reduces Supavisor pressure
- Async lock in ResilientAsyncPostgresSaver handles concurrent coroutines
"""

from typing import Optional

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

    Thread Safety:
    - TaskIQ workers are single-threaded by default
    - Async lock in ResilientAsyncPostgresSaver handles concurrent coroutines

    Usage:
        # On worker startup
        await WorkerState.initialize()

        # In task execution
        checkpointer = WorkerState.get_checkpointer()

        # On worker shutdown
        await WorkerState.shutdown()
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
        """Initialize worker state (called on worker startup).

        Creates the shared checkpointer instance and establishes
        the initial database connection.
        """
        instance = cls.get_instance()
        if instance._initialized:
            logger.debug("Worker state already initialized, skipping")
            return

        logger.info(
            "worker_state_initializing",
            extra={
                "event": "worker_state_initializing",
            },
        )

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

        instance._initialized = True
        logger.info(
            "worker_state_initialized",
            extra={
                "event": "worker_state_initialized",
                "status": "success",
            },
        )

    @classmethod
    async def shutdown(cls) -> None:
        """Cleanup worker state (called on worker shutdown).

        Closes the checkpointer connection and releases resources.
        """
        instance = cls.get_instance()
        if not instance._initialized:
            logger.debug("Worker state not initialized, nothing to shutdown")
            return

        logger.info(
            "worker_state_shutting_down",
            extra={
                "event": "worker_state_shutting_down",
            },
        )

        if instance._checkpointer:
            await instance._checkpointer.close()
            instance._checkpointer = None

        instance._initialized = False
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
