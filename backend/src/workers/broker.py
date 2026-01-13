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
    result_ex_time=300,  # 5 minute TTL for results
)

# Redis Stream broker for task distribution
broker = RedisStreamBroker(
    url=REDIS_URL,
    queue_name="orchestra_tasks",
).with_result_backend(result_backend)
