"""TaskIQ Redis broker configuration for distributed workers.

This module configures the TaskIQ broker with Redis Streams for reliable
task queuing and result storage.

Environment Variables:
    REDIS_URL: Redis connection URL (default: redis://localhost:6379/0)
"""

import asyncio
import os
from collections.abc import AsyncGenerator

from redis.exceptions import ConnectionError
from taskiq.acks import AckableMessage
from taskiq_redis import RedisStreamBroker, RedisAsyncResultBackend

from src.utils.logger import logger

# Redis connection URL from environment
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Result backend with 5-minute TTL for task results
result_backend = RedisAsyncResultBackend(
    redis_url=REDIS_URL,
    result_ex_time=300,  # 5 minute TTL for results
)


class ResilientRedisStreamBroker(RedisStreamBroker):
    """RedisStreamBroker with ConnectionError retry handling.

    The upstream RedisStreamBroker.listen() does not catch ConnectionError,
    so a Redis restart or network blip kills the worker process. This
    subclass wraps listen() with a reconnect loop, matching the pattern
    already used by ListQueueBroker.
    """

    async def listen(self) -> AsyncGenerator[AckableMessage, None]:
        """Listen with automatic reconnect on ConnectionError."""
        while True:
            try:
                async for message in super().listen():
                    yield message
            except ConnectionError as exc:
                logger.warning("Redis connection error in broker listen: %s. Reconnecting...", exc)
                await asyncio.sleep(1)
                continue


# Redis Stream broker for task distribution
broker = ResilientRedisStreamBroker(
    url=REDIS_URL,
    queue_name="orchestra_tasks",
).with_result_backend(result_backend)


# Worker lifecycle hooks for resilient checkpointer
@broker.on_event("startup")
async def on_startup():
    """Initialize worker state on startup.

    This hook is called when a TaskIQ worker process starts.
    It initializes the shared checkpointer and store instances that will be
    reused across all task executions in this worker.
    """
    from src.workers.state import WorkerState
    from src.constants import CHECKPOINT_USE_RESILIENT

    if CHECKPOINT_USE_RESILIENT:
        await WorkerState.initialize()


@broker.on_event("shutdown")
async def on_shutdown():
    """Cleanup worker state on shutdown.

    This hook is called when a TaskIQ worker process is shutting down.
    It properly closes the checkpointer and store connections and releases resources.
    """
    from src.workers.state import WorkerState
    from src.constants import CHECKPOINT_USE_RESILIENT

    if CHECKPOINT_USE_RESILIENT:
        await WorkerState.shutdown()
