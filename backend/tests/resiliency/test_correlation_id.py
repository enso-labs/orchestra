"""Resiliency probe: correlation / request-ID propagation.

Property asserted (does NOT exist today → RED):
    Every run_agent_stream invocation must bind a correlation ID into a
    ContextVar so that structured log entries emitted during the run can be
    traced back to the originating request.

    Concretely:
    - src.utils.correlation must exist and expose a ContextVar (or getter)
      named ``correlation_id``.
    - run_agent_stream must call a bind/set function on that ContextVar before
      delegating to _execute_agent_stream.
    - The value stored must equal the run_id passed to the task (or a header
      value — run_id is the canonical trace token for worker tasks).

Why it fails today:
    There is no src/utils/correlation.py module.  run_agent_stream has no
    ContextVar binding.  Importing the module raises ImportError.
"""

import pytest
from unittest.mock import patch
from uuid import uuid4


@pytest.mark.resiliency
def test_correlation_module_exists():
    """src.utils.correlation must be importable with a correlation_id ContextVar.

    Today the module does not exist → ImportError → pytest.fail (collected & FAILED).
    """
    try:
        import src.utils.correlation as correlation_module  # noqa: F401
    except ImportError:
        pytest.fail(
            "src.utils.correlation does not exist. "
            "A correlation ID ContextVar module must be implemented. "
            "Intentionally RED — module is absent today."
        )

    # The module must expose a way to get/set the current correlation ID.
    has_getter = hasattr(correlation_module, "get_correlation_id") or hasattr(correlation_module, "correlation_id")
    assert has_getter, (
        "src.utils.correlation exists but does not expose 'get_correlation_id' or 'correlation_id'. Intentionally RED."
    )


@pytest.mark.resiliency
async def test_run_agent_stream_binds_correlation_id(fake_redis):
    """run_agent_stream must bind the run_id as the correlation ID before executing.

    We intercept _execute_agent_stream and inspect what was bound in the
    correlation ContextVar at the moment the call was made.

    Today nothing is bound → the ContextVar getter returns None/default → FAIL.
    """
    user_id = str(uuid4())
    thread_id = str(uuid4())
    run_id = str(uuid4())

    task_dict = {
        "input": {"messages": [{"role": "user", "content": "trace me"}]},
        "model": "openai:gpt-4.1-mini",
        "metadata": {},
    }

    captured_correlation_id: list = []

    async def capture_correlation(*args, **kwargs):
        # Attempt to read the correlation ID that should have been bound by now.
        try:
            from src.utils.correlation import get_correlation_id

            captured_correlation_id.append(get_correlation_id())
        except (ImportError, AttributeError):
            # Module absent or getter missing — record sentinel so we can fail below
            captured_correlation_id.append("__not_set__")
        return {"status": "complete", "stream_key": f"agent:stream:{thread_id}:{run_id}"}

    with patch("src.workers.tasks._execute_agent_stream", side_effect=capture_correlation):
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

    assert captured_correlation_id, "capture hook was never called — task did not reach _execute_agent_stream"
    bound_value = captured_correlation_id[0]
    assert bound_value == run_id, (
        f"Expected correlation_id to be bound to run_id={run_id!r} "
        f"but got {bound_value!r}. "
        "Correlation ContextVar binding is absent — intentionally RED."
    )
