"""Async Redis client singleton for application-level caching."""

import redis.asyncio as redis

from src.workers.broker import REDIS_URL

_client: redis.Redis | None = None


async def get_redis_client() -> redis.Redis:
    """Return a shared async Redis client instance."""
    global _client
    if _client is None:
        _client = redis.from_url(REDIS_URL, decode_responses=True)
    return _client
