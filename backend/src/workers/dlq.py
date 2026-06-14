"""Dead-letter queue (DLQ) for permanently-failed agent runs.

When ``run_agent_stream`` hits a PERMANENT (non-retryable) failure, the failed
job payload is persisted to a Redis-backed dead-letter store so the run is not
silently lost. A permanent failure is therefore *recorded* (DLQ entry),
*surfaced* (SSE error event emitted by the task), and *replayable* (via
``replay``) instead of vanishing.

Key design:
- Key pattern: ``dlq:{run_id}`` — one entry per dead-lettered run.
- Value: a ujson payload carrying everything needed to re-enqueue the job.
- TTL: 7 days, long enough for a human/operator to notice and replay.

Retryable errors do NOT land here — those are left to the TaskIQ broker's
retry mechanism. Only permanent failures are dead-lettered.

Replay mints a FRESH run_id so the idempotency guard (``run:dedup:{run_id}``)
does not short-circuit the replayed dispatch as a duplicate of the dead run.
"""

from uuid import uuid4

import redis.asyncio as redis
import ujson

from src.constants.redis import REDIS_URL
from src.utils.logger import logger

# Key prefix mirrors the run:dedup: / abort:signal: patterns elsewhere.
DLQ_KEY_PREFIX = "dlq:"

# TTL for DLQ entries — 7 days. Long enough for an operator to notice a
# permanently-failed run and replay it before the record is garbage-collected.
DLQ_TTL_SECONDS = 7 * 24 * 60 * 60  # 604800


async def write_dlq(
    redis_client: redis.Redis,
    run_id: str,
    *,
    task_dict: dict,
    user_id: str,
    thread_id: str,
    error: Exception,
) -> None:
    """Persist a permanently-failed run to the dead-letter store.

    Writes ``dlq:{run_id}`` with the full re-enqueue payload and a 7-day TTL.

    Args:
        redis_client: An already-open async Redis client (caller owns lifecycle).
        run_id: The run identifier that failed permanently.
        task_dict: Serialized LLMRequest dict — the payload needed to replay.
        user_id: User ID associated with the failed run.
        thread_id: Thread ID associated with the failed run.
        error: The permanent exception that caused the dead-letter.
    """
    key = f"{DLQ_KEY_PREFIX}{run_id}"
    payload = {
        "run_id": run_id,
        "task_dict": task_dict,
        "user_id": user_id,
        "thread_id": thread_id,
        "error": str(error),
        "error_type": type(error).__name__,
    }
    await redis_client.set(key, ujson.dumps(payload), ex=DLQ_TTL_SECONDS)
    logger.error(
        "dlq_entry_written",
        extra={
            "event": "dlq_entry_written",
            "run_id": run_id,
            "thread_id": thread_id,
            "user_id": user_id,
            "dlq_key": key,
            "error": str(error),
            "error_type": type(error).__name__,
        },
    )


async def replay(run_id: str, *, redis_client: redis.Redis | None = None) -> dict:
    """Replay a dead-lettered run by re-enqueuing its stored payload.

    Reads ``dlq:{run_id}`` and, if present, re-dispatches ``run_agent_stream``
    with a FRESH run_id so the idempotency guard does not treat the replay as a
    duplicate of the original (dead) run. The original DLQ entry is removed on a
    successful re-enqueue.

    Args:
        run_id: The dead-lettered run identifier to replay.
        redis_client: Optional async Redis client; one is created (and closed)
            internally when not provided.

    Returns:
        ``{"status": "not_found"}`` when no DLQ entry exists for ``run_id``, or
        ``{"status": "replayed", "new_run_id": <id>}`` after re-enqueue.
    """
    # Lazy import to avoid a circular import (tasks.py imports nothing from dlq
    # at module load; replay pulls in the task only when invoked).
    from src.workers.tasks import run_agent_stream

    owns_client = redis_client is None
    if owns_client:
        redis_client = redis.from_url(REDIS_URL)

    try:
        key = f"{DLQ_KEY_PREFIX}{run_id}"
        raw = await redis_client.get(key)
        if raw is None:
            logger.info(
                "dlq_replay_not_found",
                extra={"event": "dlq_replay_not_found", "run_id": run_id, "dlq_key": key},
            )
            return {"status": "not_found"}

        entry = ujson.loads(raw)
        task_dict = entry["task_dict"]
        user_id = entry.get("user_id", "")
        thread_id = entry["thread_id"]

        # Mint a fresh run_id so the idempotency guard (run:dedup:{run_id}) does
        # NOT short-circuit the replay as a duplicate of the dead run.
        new_run_id = str(uuid4())

        await run_agent_stream.kiq(
            task_dict,
            user_id,
            thread_id,
            run_id=new_run_id,
        )

        # Drop the DLQ entry now that the job has been re-enqueued.
        await redis_client.delete(key)

        logger.info(
            "dlq_replay_enqueued",
            extra={
                "event": "dlq_replay_enqueued",
                "run_id": run_id,
                "new_run_id": new_run_id,
                "thread_id": thread_id,
                "user_id": user_id,
            },
        )
        return {"status": "replayed", "new_run_id": new_run_id}
    finally:
        if owns_client:
            await redis_client.aclose()
