"""Resiliency probe: worker heartbeat and graceful drain.

Property asserted (does NOT exist today → RED):
    The worker must expose:
    1. A ``mark_draining()`` classmethod on WorkerState (or equivalent) that
       sets a boolean flag.
    2. A liveness / heartbeat key written to Redis so external health-checkers
       can detect stale workers.
    3. When draining, run_agent_stream must refuse NEW work (return early with a
       ``draining`` status) so in-flight runs can complete before the worker shuts down.

Why it fails today:
    WorkerState has no ``draining`` flag and no ``mark_draining`` method.
    No heartbeat key is written to Redis on startup or during task processing.
    run_agent_stream has no drain check.
"""

import pytest
from unittest.mock import AsyncMock, patch
from uuid import uuid4


@pytest.mark.resiliency
def test_worker_state_has_mark_draining():
    """WorkerState must expose a mark_draining() classmethod that sets a flag.

    Today WorkerState has no such method → AttributeError → FAIL.
    """
    from src.workers.state import WorkerState

    assert hasattr(WorkerState, "mark_draining"), (
        "WorkerState does not have a mark_draining() method. Intentionally RED — draining flag is absent today."
    )
    assert callable(WorkerState.mark_draining), "WorkerState.mark_draining must be callable."


@pytest.mark.resiliency
def test_worker_state_has_is_draining():
    """WorkerState must expose an is_draining() predicate (or property).

    Today WorkerState has no such attribute → FAIL.
    """
    from src.workers.state import WorkerState

    has_predicate = hasattr(WorkerState, "is_draining") or hasattr(WorkerState.get_instance(), "draining")
    assert has_predicate, (
        "WorkerState does not have an is_draining() predicate or .draining flag. "
        "Intentionally RED — draining flag is absent today."
    )


@pytest.mark.resiliency
async def test_draining_worker_refuses_new_tasks(fake_redis):
    """When the worker is draining, run_agent_stream must return early with status='draining'.

    The test:
    1. Calls WorkerState.mark_draining() to set the drain flag.
    2. Dispatches run_agent_stream.
    3. Asserts the result status is 'draining' and _execute_agent_stream was NOT called.

    Today mark_draining doesn't exist, so this fails at step 1.
    """
    from src.workers.state import WorkerState

    user_id = str(uuid4())
    thread_id = str(uuid4())
    run_id = str(uuid4())

    task_dict = {
        "input": {"messages": [{"role": "user", "content": "while draining"}]},
        "model": "openai:gpt-4.1-mini",
        "metadata": {},
    }

    # Set the drain flag — this will raise AttributeError today (RED).
    try:
        WorkerState.mark_draining()
    except AttributeError:
        pytest.fail("WorkerState.mark_draining() does not exist. Cannot set drain flag — intentionally RED.")
    finally:
        # Best-effort reset so we don't poison other tests
        try:
            WorkerState.unmark_draining()  # type: ignore[attr-defined]
        except AttributeError:
            pass

    with patch("src.workers.tasks._execute_agent_stream", new_callable=AsyncMock) as mock_exec:
        with patch("src.workers.tasks.redis.from_url", return_value=fake_redis):
            from src.workers.tasks import run_agent_stream

            result = await run_agent_stream(
                task_dict=task_dict,
                user_id=user_id,
                thread_id=thread_id,
                run_id=run_id,
            )

    mock_exec.assert_not_called()
    assert isinstance(result, dict), "run_agent_stream must return a dict when draining"
    assert result.get("status") == "draining", (
        f"Expected status='draining' but got {result!r}. Drain-aware early-exit is absent — intentionally RED."
    )


@pytest.mark.resiliency
async def test_heartbeat_key_written_to_redis(fake_redis):
    """A liveness heartbeat key must exist in Redis while the worker is alive.

    The heartbeat key pattern must be: ``worker:heartbeat:<worker_id>``
    and must carry a TTL so dead workers are detectable automatically.

    Today WorkerState.initialize() writes no such key → FAIL.
    """
    from src.workers.state import WorkerState

    # Reset state so initialize() runs fresh
    instance = WorkerState.get_instance()
    instance._initialized = False
    instance._checkpointer = None
    instance._store = None

    with (
        patch("src.workers.state.ResilientAsyncPostgresSaver") as mock_saver_cls,
        # Must be patched where `state.py` binds the name, not in `services.db`:
        # the module does `from src.services.db import ... get_shared_store`, so a
        # patch on the source module would be inert -- and this test swallows the
        # exception from initialize(), so an unpatched call would silently open a
        # real pool and cache it as this process's store singleton.
        patch("src.workers.state.get_shared_store") as mock_shared_store,
        patch("src.workers.state.redis", create=True) as mock_redis_mod,
    ):
        # Stub out saver
        mock_saver = AsyncMock()
        mock_saver_cls.return_value = mock_saver

        # `get_shared_store()` is an awaitable returning the store, not a context
        # manager -- that is the shape change #957 made.
        mock_shared_store.return_value = AsyncMock()

        # Point any redis.from_url call inside state.py to our fake_redis
        mock_redis_mod.from_url = lambda *a, **kw: fake_redis

        try:
            await WorkerState.initialize()
        except Exception:
            pass  # We only care about whether the key was written

    # Look for any key matching worker:heartbeat:*
    heartbeat_keys = await fake_redis.keys("worker:heartbeat:*")
    assert heartbeat_keys, (
        "No worker:heartbeat:* key found in Redis after WorkerState.initialize(). "
        "Liveness heartbeat is absent — intentionally RED."
    )

    # The key must have a TTL (so stale workers are detectable)
    ttl = await fake_redis.ttl(heartbeat_keys[0])
    assert ttl > 0, (
        f"Heartbeat key {heartbeat_keys[0]!r} has no TTL (ttl={ttl}). "
        "Heartbeat keys must expire so dead workers are detectable."
    )
