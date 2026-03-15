"""TaskIQ Scheduler configuration for periodic task execution.

This module sets up the TaskIQ scheduler with a Redis-backed schedule source.
The scheduler reads scheduled tasks from Redis and dispatches them to the broker.

Usage:
    taskiq scheduler src.workers.scheduler:scheduler
"""

from taskiq import TaskiqScheduler
from taskiq_redis import ListRedisScheduleSource

from src.constants.redis import REDIS_URL

# Redis-backed schedule source for persistent task schedules
redis_source = ListRedisScheduleSource(url=REDIS_URL)

# Scheduler that reads from redis_source and dispatches to the broker
scheduler = TaskiqScheduler(
    broker="src.workers.broker:broker",
    sources=[redis_source],
)
