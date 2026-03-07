"""Benchmarks for MemoryRepo CRUD operations."""

import asyncio

from tests.benchmarks.conftest import make_memory


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


def test_bench_memory_create(benchmark, memory_repo):
    """Benchmark creating a single memory."""
    counter = {"i": 0}

    async def _create():
        counter["i"] += 1
        return await memory_repo.create(**make_memory(counter["i"]))

    result = benchmark(lambda: _run(_create()))
    assert result is not None


# ---------------------------------------------------------------------------
# List at various scales
# ---------------------------------------------------------------------------


def _seed_memories(memory_repo, count: int):
    """Pre-seed N memories into the repo."""

    async def _do():
        for i in range(count):
            await memory_repo.create(**make_memory(i))

    _run(_do())


def test_bench_memory_list_100(benchmark, memory_repo):
    """Benchmark listing after seeding 100 memories."""
    _seed_memories(memory_repo, 100)

    result = benchmark(lambda: _run(memory_repo.list(limit=100)))
    memories, total = result
    assert total >= 100


def test_bench_memory_list_500(benchmark, memory_repo):
    """Benchmark listing after seeding 500 memories."""
    _seed_memories(memory_repo, 500)

    result = benchmark(lambda: _run(memory_repo.list(limit=500)))
    memories, total = result
    assert total >= 500


def test_bench_memory_list_1000(benchmark, memory_repo):
    """Benchmark listing after seeding 1000 memories."""
    _seed_memories(memory_repo, 1000)

    result = benchmark(lambda: _run(memory_repo.list(limit=1000)))
    memories, total = result
    assert total >= 1000


# ---------------------------------------------------------------------------
# Search / list with query
# ---------------------------------------------------------------------------


def test_bench_memory_search(benchmark, memory_repo):
    """Benchmark searching memories with a query string."""
    _seed_memories(memory_repo, 200)

    result = benchmark(lambda: _run(memory_repo.list(limit=50, query="benchmark")))
    memories, total = result
    assert isinstance(memories, list)


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------


def test_bench_memory_delete(benchmark, memory_repo):
    """Benchmark deleting a memory."""

    async def _create_and_delete():
        mem = await memory_repo.create(**make_memory(0))
        deleted = await memory_repo.delete(mem.id)
        return deleted

    result = benchmark(lambda: _run(_create_and_delete()))
    assert result is True
