"""Pins the FastAPI lifespan's ownership of the process store (#957).

Nothing else in the suite executes `main.lifespan`. Every other integration test
drives the app through `ASGITransport`, which does **not** emit lifespan events,
and `conftest.py` sets `app.state.store` by hand. So without this file the
following all pass the entire suite:

- dropping `api_app.state.store = store` (breaks MCP internal calls),
- dropping `await store.setup()`,
- dropping `close_shared_store()` from teardown,
- and -- the one that matters -- leaving a second `get_store_db()` pool alongside
  the singleton, which is exactly the "nets zero savings in the busiest process"
  failure this change exists to prevent.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import main
from src.services import schedule as schedule_module


class FakeStore:
    def __init__(self) -> None:
        self.setup_calls = 0

    async def setup(self) -> None:
        self.setup_calls += 1


@pytest.fixture
def lifespan_harness():
    """Patch everything the lifespan touches except the store wiring under test."""
    store = FakeStore()
    saver = MagicMock()
    saver.setup = AsyncMock()

    class _CheckpointCM:
        async def __aenter__(self):
            return saver

        async def __aexit__(self, *exc):
            return False

    class _McpCM:
        def __call__(self, _app):
            return self

        async def __aenter__(self):
            return None

        async def __aexit__(self, *exc):
            return False

    previous_store = getattr(main.app.state, "store", None)
    previous_api_store = getattr(main.api_app.state, "store", None)

    with (
        patch.object(main, "get_shared_store", AsyncMock(return_value=store)) as shared,
        patch.object(main, "close_shared_store", AsyncMock()) as close,
        patch.object(main, "get_checkpoint_db", lambda: _CheckpointCM()),
        patch.object(main, "init_cache", MagicMock()),
        # `mcp_app.lifespan` is a read-only property, so the app object itself is
        # swapped rather than the attribute.
        patch.object(main, "mcp_app", MagicMock(lifespan=_McpCM())),
        patch.object(main.schedule_service, "scheduler", MagicMock()),
        # The lifespan imports SCHEDULER locally, so patch it at its source.
        patch.object(schedule_module.SCHEDULER, "add_job", MagicMock()),
    ):
        yield {
            "store": store,
            "saver": saver,
            "get_shared_store": shared,
            "close_shared_store": close,
            "scheduler": main.schedule_service.scheduler,
        }

    main.app.state.store = previous_store
    main.api_app.state.store = previous_api_store


class TestLifespanStoreWiring:
    async def test_lifespan_builds_one_store_and_shares_it_with_both_apps(self, lifespan_harness):
        store = lifespan_harness["store"]

        async with main.lifespan(main.app):
            assert main.app.state.store is store
            # `api_app` is not decorative: ASGITransport-based MCP internal calls
            # resolve `get_store` against it, and the spliced routes carry
            # `dependency_overrides_provider = api_app`.
            assert main.api_app.state.store is store

        assert lifespan_harness["get_shared_store"].await_count == 1

    async def test_lifespan_runs_setup_exactly_once(self, lifespan_harness):
        async with main.lifespan(main.app):
            pass

        assert lifespan_harness["store"].setup_calls == 1
        assert lifespan_harness["saver"].setup.await_count == 1

    async def test_lifespan_closes_the_store_on_teardown(self, lifespan_harness):
        async with main.lifespan(main.app):
            assert lifespan_harness["close_shared_store"].await_count == 0

        assert lifespan_harness["close_shared_store"].await_count == 1

    async def test_scheduler_is_shut_down_before_the_store_is_closed(self, lifespan_harness):
        """Ordering, not just presence.

        The scheduler's jobs consume the same singleton and the distillation job
        carries `misfire_grace_time=3600`, so one can fire during teardown -- onto
        a pool we are about to close.
        """
        order: list[str] = []
        lifespan_harness["scheduler"].shutdown.side_effect = lambda *a, **k: order.append("scheduler")
        lifespan_harness["close_shared_store"].side_effect = lambda *a, **k: order.append("store")

        async with main.lifespan(main.app):
            pass

        assert order == ["scheduler", "store"]

    async def test_the_store_exists_before_the_scheduler_starts(self, lifespan_harness):
        """A restored job that misfires can fire the moment the scheduler starts.

        If the store were built after `scheduler.start()`, that job -- not the
        lifespan -- would be the first caller and would decide the singleton's
        event loop.
        """
        order: list[str] = []
        lifespan_harness["get_shared_store"].side_effect = lambda *a, **k: (
            order.append("store"),
            lifespan_harness["store"],
        )[1]
        lifespan_harness["scheduler"].start.side_effect = lambda *a, **k: order.append("scheduler")

        async with main.lifespan(main.app):
            pass

        assert order[:2] == ["store", "scheduler"]

    async def test_a_failing_close_does_not_propagate_out_of_the_lifespan(self, lifespan_harness):
        """Shutdown noise must not mask the real reason a process is going down."""
        lifespan_harness["close_shared_store"].side_effect = RuntimeError("pool already gone")

        async with main.lifespan(main.app):
            pass

    async def test_lifespan_does_not_build_a_second_store(self, lifespan_harness):
        """The regression that would net zero savings in the busiest process."""
        with patch("src.services.db.get_store_db") as factory:
            async with main.lifespan(main.app):
                pass

        factory.assert_not_called()
