"""Idempotency service for distributed worker deduplication.

Provides a Redis-backed claim-at-entry guard so that duplicate dispatches
of the same run_id are detected and short-circuited before any heavyweight
work (LLM calls, DB writes, stream setup) begins.

Key design:
- Key pattern: ``run:dedup:{run_id}``
- Atomic SET ... NX EX: returns True (claimed) on first caller, False on
  every subsequent caller — no race window between GET and SET.
- TTL matches the stream TTL so keys are garbage-collected automatically.

Usage::

    claimed = await claim_run(run_id, redis_client=redis_client)
    if not claimed:
        return {"status": "duplicate", "stream_key": stream_key}
    # proceed with execution ...
"""

import redis.asyncio as redis

from src.utils.logger import logger

# Prefix mirrors the abort:signal: pattern in abort.py
DEDUP_KEY_PREFIX = "run:dedup:"

# TTL for dedup keys — long enough to cover any plausible queue redelivery
# window; matches STREAM_KEY_TTL_SECONDS (24 h) imported from utils.stream.
DEDUP_TTL_SECONDS = 86400  # 24 hours


async def claim_run(
    run_id: str,
    *,
    redis_client: redis.Redis,
    ttl: int = DEDUP_TTL_SECONDS,
) -> bool:
    """Atomically claim a run_id idempotency slot in Redis.

    Uses ``SET key value NX EX ttl`` so the claim is atomic — no race
    window between checking and writing.

    Args:
        run_id: The unique run identifier to claim.
        redis_client: An already-open async Redis client (caller owns lifecycle).
        ttl: Key TTL in seconds; defaults to DEDUP_TTL_SECONDS (24 h).

    Returns:
        True  — key was not present; this caller now owns the run.
        False — key already existed; this is a duplicate dispatch.
    """
    key = f"{DEDUP_KEY_PREFIX}{run_id}"
    result = await redis_client.set(key, "1", nx=True, ex=ttl)
    claimed = result is not None  # SET NX returns None when key already exists
    if not claimed:
        logger.info(
            "run_duplicate_detected",
            extra={
                "event": "run_duplicate_detected",
                "run_id": run_id,
                "dedup_key": key,
            },
        )
    return claimed
