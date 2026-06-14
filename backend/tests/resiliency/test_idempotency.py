"""Resiliency probe: run_agent_stream idempotency.

Property asserted (does NOT exist today → RED):
    Enqueuing run_agent_stream twice with the same (user_id, thread_id, run_id)
    results in exactly ONE logical execution / one assistant message written to
    the thread store.  A dedup guard must prevent double-processing.

Why it fails today:
    There is no idempotency key check anywhere in run_agent_stream or the
    broker layer.  Two identical enqueue calls would both execute, potentially
    writing duplicate assistant messages.
"""

import pytest
from unittest.mock import AsyncMock, patch
from uuid import uuid4


@pytest.mark.resiliency
async def test_dedup_key_written_to_redis_before_execution(fake_redis):
    """An idempotency key must be SET in Redis atomically before task work begins.

    The key pattern must be ``run:dedup:{run_id}`` and must be written (with a
    TTL) before _execute_agent_stream is called so that a concurrent worker
    processing the same message would see the key and bail.

    Today no such key is written, so this probe fails.
    """
    user_id = str(uuid4())
    thread_id = str(uuid4())
    run_id = str(uuid4())

    task_dict = {
        "input": {"messages": [{"role": "user", "content": "ping"}]},
        "model": "openai:gpt-4.1-mini",
        "metadata": {},
    }

    execute_mock = AsyncMock(return_value={"status": "complete", "stream_key": f"agent:stream:{thread_id}:{run_id}"})

    # Also patch AbortService and WorkerState to avoid network/DB calls
    with (
        patch("src.workers.tasks._execute_agent_stream", execute_mock),
        patch("src.workers.tasks.redis.from_url", return_value=fake_redis),
        patch("src.services.abort.AbortService.check_abort_signal", new_callable=AsyncMock, return_value=False),
        patch("src.workers.state.WorkerState.is_initialized", return_value=True),
        patch("src.workers.state.WorkerState.get_checkpointer", return_value=AsyncMock()),
        patch("src.workers.state.WorkerState.get_store", return_value=AsyncMock()),
    ):
        from src.workers.tasks import run_agent_stream

        try:
            await run_agent_stream(
                task_dict=task_dict,
                user_id=user_id,
                thread_id=thread_id,
                run_id=run_id,
            )
        except Exception:
            pass  # we only care about the dedup key

    expected_key = f"run:dedup:{run_id}"
    stored = await fake_redis.get(expected_key)
    assert stored is not None, (
        f"Expected idempotency key {expected_key!r} to exist in Redis after dispatch "
        "but no such key was written. Dedup guard is absent — intentionally RED."
    )


@pytest.mark.resiliency
async def test_duplicate_run_ids_produce_single_execution(fake_redis):
    """Two identical (user_id, thread_id, run_id) dispatches produce ONE execution.

    The task layer must detect the duplicate run_id and short-circuit the second
    invocation before it processes the LLM request.  Today there is no such guard,
    so this assertion fails.
    """
    user_id = str(uuid4())
    thread_id = str(uuid4())
    run_id = str(uuid4())  # same run_id for both enqueues

    task_dict = {
        "input": {"messages": [{"role": "user", "content": "hello"}]},
        "model": "openai:gpt-4.1-mini",
        "metadata": {},
    }

    execution_count = 0

    async def counting_execute(*args, **kwargs):
        nonlocal execution_count
        execution_count += 1
        return {"status": "complete", "stream_key": f"agent:stream:{thread_id}:{run_id}"}

    with (
        patch("src.workers.tasks._execute_agent_stream", side_effect=counting_execute),
        patch("src.workers.tasks.redis.from_url", return_value=fake_redis),
        patch("src.services.abort.AbortService.check_abort_signal", new_callable=AsyncMock, return_value=False),
        patch("src.workers.state.WorkerState.is_initialized", return_value=True),
        patch("src.workers.state.WorkerState.get_checkpointer", return_value=AsyncMock()),
        patch("src.workers.state.WorkerState.get_store", return_value=AsyncMock()),
    ):
        from src.workers.tasks import run_agent_stream

        # First invocation
        try:
            await run_agent_stream(
                task_dict=task_dict,
                user_id=user_id,
                thread_id=thread_id,
                run_id=run_id,
            )
        except Exception:
            pass

        # Second invocation — same run_id
        try:
            await run_agent_stream(
                task_dict=task_dict,
                user_id=user_id,
                thread_id=thread_id,
                run_id=run_id,
            )
        except Exception:
            pass

    # The dedup guard must have prevented the second execution
    assert execution_count == 1, (
        f"Expected exactly 1 execution for run_id={run_id!r} "
        f"but _execute_agent_stream was called {execution_count} times. "
        "No idempotency guard exists yet — this probe is intentionally RED."
    )
