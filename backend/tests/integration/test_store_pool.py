"""Counts real Postgres backends to pin the pool behaviour behind #957.

The identity tests in `tests/unit/services/test_store_singleton.py` prove the
same object comes back N times, but identity never observes a *pool*: an
implementation that returned a cached store while quietly opening a second pool
per call satisfies every one of them. This file counts backends in
`pg_stat_activity`, which is the only assertion that speaks to what the issue
reported. `application_name` on the store pool is what makes that count
attributable rather than a bare number shared with SQLAlchemy's engine and the
checkpointer.

**A correction to the issue, established here empirically.** #957 predicts the
count "should stay flat across N task runs instead of stepping up by 5 each
time." Measured against the pre-fix code, it does *not* step up across
*sequential* runs: `async with get_store_db() as store:` closes its pool on exit,
so the backends are released when each task finishes. The cost is real but has a
different shape:

- **per-task**: five connections are established and torn down on every task and
  every job, so the connect round-trip is on the critical path of each one; and
- **per-concurrency**: C tasks running at once hold C separate pools, so
  `5 x C` backends exist simultaneously when callers each create a pool.

`test_concurrent_callers_share_one_pool` measures the second directly, comparing
the two patterns side by side. That is the honest, falsifiable version of the
issue's criterion, and it is what the PR body claims.
"""

import asyncio
import os

import pytest
from sqlalchemy import text

from src.constants import DB_POOL_MAX_SIZE, DB_POOL_MIN_SIZE
from src.services.db import (
    close_shared_store,
    get_shared_store,
    get_store_application_name,
    get_store_db,
)

CONCURRENCY = 3


async def _store_backend_count(session) -> int:
    # Roll back first: the count must not be read inside a snapshot taken before
    # the pools under test opened their connections.
    await session.rollback()
    result = await session.execute(
        text("SELECT count(*) FROM pg_stat_activity WHERE application_name = :name"),
        {"name": get_store_application_name()},
    )
    return int(result.scalar() or 0)


@pytest.fixture
async def shared_store():
    """A real singleton, always closed -- a leaked pool would skew later counts."""
    try:
        yield await get_shared_store()
    finally:
        await close_shared_store()


class TestSharedStorePool:
    async def test_the_singleton_owns_exactly_one_pool(self, shared_store):
        """Concrete, not identity-shaped: inspect the psycopg pool itself."""
        pool = shared_store.conn

        assert pool.min_size == DB_POOL_MIN_SIZE
        assert pool.max_size == DB_POOL_MAX_SIZE
        assert (await get_shared_store()).conn is pool

    async def test_repeated_use_opens_no_further_backends(self, shared_store, test_db):
        """Sequential reuse holds exactly one pool's worth of connections."""
        await shared_store.setup()
        # `pool.wait()` blocks until `min_size` connections are actually open.
        # Without it the count races the pool's background filler and reads low,
        # which would make this pass against almost anything.
        await shared_store.conn.wait()
        baseline = await _store_backend_count(test_db)
        assert baseline >= DB_POOL_MIN_SIZE, f"expected a filled pool, saw {baseline} backends"

        counts = []
        for _ in range(5):
            store = await get_shared_store()
            await store.conn.wait()
            await store.asearch(("pool_probe_957",), limit=1)
            counts.append(await _store_backend_count(test_db))

        assert counts == [baseline] * 5, f"connection count grew across calls: {counts}"
        assert baseline <= DB_POOL_MAX_SIZE

    async def test_concurrent_callers_share_one_pool(self, test_db):
        """The measurement that justifies this change.

        Runs both patterns with the same concurrency and compares. Pre-fix, each
        concurrent task held its own eagerly-filled pool; post-fix they share one.
        """

        async def _with_factory(barrier: asyncio.Barrier) -> None:
            async with get_store_db() as store:
                await store.conn.wait()
                await barrier.wait()
                await barrier.wait()

        async def _with_singleton(barrier: asyncio.Barrier) -> None:
            # No `pool.wait()` here: psycopg asserts if two coroutines wait on the
            # same pool, and the singleton's pool is filled once by the caller
            # below -- which is the whole point of the comparison.
            store = await get_shared_store()
            await store.asearch(("pool_probe_957",), limit=1)
            await barrier.wait()
            await barrier.wait()

        async def _peak(runner) -> int:
            barrier = asyncio.Barrier(CONCURRENCY + 1)
            tasks = [asyncio.create_task(runner(barrier)) for _ in range(CONCURRENCY)]
            try:
                await barrier.wait()  # every task now holds an open pool
                peak = await _store_backend_count(test_db)
            finally:
                await barrier.wait()  # release them
                await asyncio.gather(*tasks)
            return peak

        try:
            factory_peak = await _peak(_with_factory)

            # Fill the shared pool once, serially, so the comparison is between
            # two filled pools rather than between a filled one and a cold one.
            await (await get_shared_store()).conn.wait()
            singleton_peak = await _peak(_with_singleton)
        finally:
            await close_shared_store()

        assert factory_peak == CONCURRENCY * DB_POOL_MIN_SIZE, (
            f"expected the per-call factory to hold {CONCURRENCY} pools, saw {factory_peak} backends"
        )
        assert singleton_peak == DB_POOL_MIN_SIZE, (
            f"expected {CONCURRENCY} concurrent callers to share one pool, saw {singleton_peak} backends"
        )
        assert singleton_peak < factory_peak

    async def test_pool_connections_carry_this_process_application_name(self, shared_store, test_db):
        await shared_store.setup()
        await shared_store.conn.wait()

        await test_db.rollback()
        result = await test_db.execute(
            text(
                "SELECT DISTINCT application_name FROM pg_stat_activity WHERE application_name LIKE 'orchestra-store-%'"
            )
        )
        names = {row[0] for row in result}

        assert get_store_application_name() in names
        assert get_store_application_name() == f"orchestra-store-{os.getpid()}"

    async def test_closing_releases_the_backends(self, test_db):
        store = await get_shared_store()
        await store.setup()
        await store.conn.wait()
        assert await _store_backend_count(test_db) >= DB_POOL_MIN_SIZE

        await close_shared_store()

        # Postgres reaps backends asynchronously, so poll rather than assert once.
        for _ in range(50):
            if await _store_backend_count(test_db) == 0:
                break
            await asyncio.sleep(0.05)
        else:
            pytest.fail("store backends survived close_shared_store()")
