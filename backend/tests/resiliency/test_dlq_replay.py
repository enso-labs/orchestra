"""Resiliency probe: dead-letter queue (DLQ) recording and replay.

Property asserted (does NOT exist today → RED):
    When run_agent_stream hits a PERMANENT (non-retryable) failure, the failed
    job payload must be persisted to a dead-letter store so it can be replayed
    later without re-enqueuing from the API.

Why it fails today:
    There is no DLQ module under src/workers/ or src/services/.  PermanentCheckpointError
    and other fatal errors are logged and re-raised, but nothing writes to a DLQ.
    The ``replay()`` entry-point expected by these probes does not exist.
"""

import pytest
from unittest.mock import patch
from uuid import uuid4


@pytest.mark.resiliency
async def test_permanent_failure_records_to_dlq(fake_redis):
    """A non-retryable error must write the job to a dead-letter store.

    After a PermanentCheckpointError the task must:
    1. NOT silently swallow the error.
    2. Write a DLQ entry keyed on run_id so the job is replayable.

    Today no DLQ write exists, so this probe fails.
    """
    from src.services.errors import PermanentCheckpointError

    user_id = str(uuid4())
    thread_id = str(uuid4())
    run_id = str(uuid4())

    task_dict = {
        "input": {"messages": [{"role": "user", "content": "fail me"}]},
        "model": "openai:gpt-4.1-mini",
        "metadata": {},
    }

    permanent_error = PermanentCheckpointError("authentication failed")

    with patch("src.workers.tasks._execute_agent_stream", side_effect=permanent_error):
        with patch("src.workers.tasks.redis.from_url", return_value=fake_redis):
            try:
                from src.workers.tasks import run_agent_stream

                await run_agent_stream(
                    task_dict=task_dict,
                    user_id=user_id,
                    thread_id=thread_id,
                    run_id=run_id,
                )
            except Exception:
                pass  # expected to raise; we inspect the DLQ below

    # The DLQ module must exist and must have written an entry for this run_id.
    # Expected key pattern: dlq:{run_id}  or similar in Redis / a DLQ list.
    dlq_key = f"dlq:{run_id}"
    entry = await fake_redis.get(dlq_key)
    assert entry is not None, (
        f"Expected a DLQ entry at {dlq_key!r} after permanent failure but nothing was written. "
        "No DLQ mechanism exists yet — intentionally RED."
    )


@pytest.mark.resiliency
def test_dlq_replay_function_exists():
    """A replay() entry-point must exist for DLQ job re-enqueue.

    The DLQ module (src.workers.dlq) must expose a replay() coroutine that
    accepts a run_id and re-enqueues the stored job payload.

    Today the module does not exist, so this import fails — which is a
    collected-and-failed assertion, not an errors-during-collection issue.
    """
    try:
        from src.workers import dlq as dlq_module  # noqa: F401
    except ImportError:
        pytest.fail(
            "src.workers.dlq does not exist. "
            "A DLQ module with a replay() function must be implemented. "
            "Intentionally RED — no DLQ exists today."
        )

    assert hasattr(dlq_module, "replay"), (
        "src.workers.dlq exists but does not expose a replay() function. Intentionally RED."
    )
    assert callable(dlq_module.replay), "dlq.replay must be callable."


@pytest.mark.resiliency
async def test_retryable_error_does_not_write_dlq(fake_redis):
    """A retryable error must NOT write to the DLQ (let TaskIQ retry instead).

    Only permanent failures should land in the DLQ.  Retryable errors (e.g.
    SSL drops) should be left to the broker retry mechanism.

    This probe will pass trivially until the DLQ write logic exists, but we
    include it now so it documents the invariant alongside the positive case
    and runs in the same suite.  It is marked resiliency so it is gated
    together with the rest.
    """
    from src.services.errors import RetryableCheckpointError

    user_id = str(uuid4())
    thread_id = str(uuid4())
    run_id = str(uuid4())

    task_dict = {
        "input": {"messages": [{"role": "user", "content": "retry me"}]},
        "model": "openai:gpt-4.1-mini",
        "metadata": {},
    }

    retryable_error = RetryableCheckpointError("ssl connection has been closed")

    with patch("src.workers.tasks._execute_agent_stream", side_effect=retryable_error):
        with patch("src.workers.tasks.redis.from_url", return_value=fake_redis):
            try:
                from src.workers.tasks import run_agent_stream

                await run_agent_stream(
                    task_dict=task_dict,
                    user_id=user_id,
                    thread_id=thread_id,
                    run_id=run_id,
                )
            except Exception:
                pass

    dlq_key = f"dlq:{run_id}"
    entry = await fake_redis.get(dlq_key)
    # A retryable error must NOT be DLQ'd — but since DLQ doesn't exist yet,
    # no entry will be written regardless.  This sub-assertion stays GREEN
    # during baseline; we still mark the test resiliency so it runs with the suite.
    assert entry is None, (
        f"Retryable error must NOT write to DLQ key {dlq_key!r}. "
        "If this fails after DLQ is implemented, the is_retryable_error guard is broken."
    )
