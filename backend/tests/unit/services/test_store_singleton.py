"""Pins the process-level store singleton introduced for #957.

Before this, `get_store_db()` was called per task and per job and each call built
a fresh `AsyncPostgresStore` whose psycopg pool opens `DB_POOL_MIN_SIZE` (5)
connections eagerly. These tests pin the three properties that keep it from
regressing to that: exactly one construction per process, a failed construction
that is not cached, and a close that actually releases and allows a rebuild.

Note on the fake factory: `get_store_db` is a plain `def` returning an
`@asynccontextmanager` *object*, not an async generator function. So the double
must be a **callable returning an async CM**; an async generator function makes
`AsyncExitStack.enter_async_context` raise `TypeError` and looks like a design
failure rather than a test bug.
"""

import asyncio
from contextlib import asynccontextmanager
from unittest.mock import MagicMock, patch

import pytest

from src.services import db as db_module
from src.services.db import (
    RunScopedStore,
    close_shared_store,
    get_shared_store,
    get_store_application_name,
)


class FakeStore:
    """Stand-in for AsyncPostgresStore. Deliberately not an InMemoryStore."""

    def __init__(self, tag: str = "fake") -> None:
        self.tag = tag
        self.fields: list[str] = []
        self.closed = False


class CountingFactory:
    """Callable returning a fresh async CM per call, counting constructions."""

    def __init__(self, store_factory=FakeStore) -> None:
        self.calls = 0
        self.stores: list[FakeStore] = []
        self._store_factory = store_factory

    def __call__(self, *args, **kwargs):
        @asynccontextmanager
        async def _cm():
            self.calls += 1
            store = self._store_factory()
            self.stores.append(store)
            try:
                yield store
            finally:
                store.closed = True

        return _cm()


@pytest.fixture
def counting_factory():
    factory = CountingFactory()
    with patch("src.services.db.get_store_db", factory):
        yield factory


class TestSingletonIdentity:
    async def test_serial_calls_construct_exactly_once(self, counting_factory):
        """N serial calls: one construction, N identical returns.

        Asserts the *count*, not only identity — identity alone still passes if a
        second pool is built and thrown away, which is precisely the waste #957
        is about.
        """
        stores = [await get_shared_store() for _ in range(10)]

        assert counting_factory.calls == 1
        assert all(store is stores[0] for store in stores)

    async def test_concurrent_first_callers_construct_exactly_once(self, counting_factory):
        """A thundering herd on a cold singleton still builds one store."""
        stores = await asyncio.gather(*(get_shared_store() for _ in range(16)))

        assert counting_factory.calls == 1
        assert len(set(id(store) for store in stores)) == 1

    async def test_get_shared_store_is_not_a_context_manager(self, counting_factory):
        """It must be awaitable, not enterable.

        An async-CM shape at the call sites is exactly the re-entry defect this
        PR removes, so the API is designed to make that unwritable.
        """
        store = await get_shared_store()

        with pytest.raises(TypeError):
            async with store:  # type: ignore[attr-defined]
                pass


class TestSingletonFailureHandling:
    async def test_failed_construction_is_not_cached(self):
        """A DB outage on first call must fail that caller only.

        Caching a half-built singleton would turn one transient failure into a
        permanently broken process — a strictly worse failure mode than the
        per-call factory it replaces.
        """
        attempts = {"n": 0}

        def flaky(*args, **kwargs):
            @asynccontextmanager
            async def _cm():
                attempts["n"] += 1
                if attempts["n"] == 1:
                    raise RuntimeError("DB down")
                yield FakeStore("recovered")

            return _cm()

        with patch("src.services.db.get_store_db", flaky):
            with pytest.raises(RuntimeError, match="DB down"):
                await get_shared_store()

            assert db_module._shared_store is None
            assert db_module._shared_store_stack is None

            store = await get_shared_store()

        assert store.tag == "recovered"
        assert attempts["n"] == 2


class TestCloseSharedStore:
    async def test_close_releases_and_allows_rebuild(self, counting_factory):
        first = await get_shared_store()
        await close_shared_store()

        assert first.closed is True
        assert db_module._shared_store is None

        second = await get_shared_store()

        assert second is not first
        assert counting_factory.calls == 2

    async def test_close_is_idempotent(self, counting_factory):
        """WorkerState calls it from both initialize()'s except branch and shutdown()."""
        await get_shared_store()
        await close_shared_store()
        await close_shared_store()  # must not raise

    async def test_close_on_cold_singleton_is_a_noop(self):
        await close_shared_store()

    async def test_close_tolerates_a_store_without_a_task(self, counting_factory):
        """FakeStore has no `_task`; the cancel path must not blow up on it."""
        await get_shared_store()
        await close_shared_store()

    async def test_close_tolerates_a_mock_task(self):
        """A MagicMock `_task` is truthy but not awaitable.

        Copying WorkerState's cleanup verbatim would call `asyncio.wait_for` on it
        and raise TypeError, which its
        `except (CancelledError, TimeoutError)` does not catch.
        """
        mock_store = MagicMock()
        mock_store._task = MagicMock()

        def factory(*args, **kwargs):
            @asynccontextmanager
            async def _cm():
                yield mock_store

            return _cm()

        with patch("src.services.db.get_store_db", factory):
            await get_shared_store()
            await close_shared_store()  # must not raise

    async def test_close_cancels_a_live_batch_task(self):
        """The pool is released by the exit stack; `_task` is independent of it."""

        async def _never():
            await asyncio.Event().wait()

        task = asyncio.create_task(_never())
        store = FakeStore()
        store._task = task

        def factory(*args, **kwargs):
            @asynccontextmanager
            async def _cm():
                yield store

            return _cm()

        with patch("src.services.db.get_store_db", factory):
            await get_shared_store()
            await close_shared_store()

        assert task.cancelled() or task.done()


class TestRunScopedStore:
    """`fields` isolation for the shared store.

    Six sites assign `store.fields` (`utils/stream.py`, `services/schedule.py`,
    `controllers/llm.py`, `workers/tasks.py`, `repos/thread_repo.py`,
    `repos/source_repo.py`). Nothing reads it today — it is not a langgraph API —
    so this is defence-in-depth rather than a fix for a live bug, but sharing one
    store object across concurrent runs is what would make it one.
    """

    def test_field_writes_are_isolated_per_run(self):
        shared = FakeStore()
        shared.fields = ["original"]

        a = RunScopedStore(shared)
        b = RunScopedStore(shared)
        a.fields = ["messages", "files"]
        b.fields = ["page_content"]

        assert a.fields == ["messages", "files"]
        assert b.fields == ["page_content"]
        assert shared.fields == ["original"]

    def test_fields_are_seeded_explicitly_not_from_the_shared_store(self):
        """Seeding via `getattr(store, "fields", [])` would be a read-side race.

        A scheduler job would inherit whatever an in-flight request last wrote.
        """
        shared = FakeStore()
        shared.fields = ["leaked-from-another-run"]

        assert RunScopedStore(shared).fields == []
        assert RunScopedStore(shared, ["explicit"]).fields == ["explicit"]

    def test_non_field_attributes_delegate_to_the_shared_store(self):
        shared = FakeStore()
        proxy = RunScopedStore(shared)

        assert proxy.tag == "fake"
        proxy.tag = "written-through"
        assert shared.tag == "written-through"

    async def test_async_with_on_the_proxy_raises(self):
        """Implicit special-method lookup goes through `type(obj)`.

        So `async with proxy` fails even though `hasattr(proxy, "__aenter__")` is
        True — which is why the re-entry cleanup had to land before the call
        sites were migrated, and why nobody should write a `hasattr` guard here.
        """
        proxy = RunScopedStore(FakeStore())

        with pytest.raises(TypeError):
            async with proxy:
                pass


def test_application_name_identifies_the_process():
    """Consumed by the pg_stat_activity probe that checks #957's own criterion."""
    assert get_store_application_name(4242) == "orchestra-store-4242"
    assert len(get_store_application_name(4242).encode()) < 63
