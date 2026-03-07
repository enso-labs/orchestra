"""Benchmarks for ThreadRepo CRUD operations."""

import asyncio
import uuid

from src.schemas.entities import SearchFilter

from tests.benchmarks.conftest import make_thread


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def _create_thread(thread_repo, index: int = 0, message_count: int = 5) -> str:
    """Create a thread and return its ID."""
    thread_id = str(uuid.uuid4())

    async def _do():
        data = make_thread(index, message_count=message_count)
        await thread_repo.update(thread_id, data)
        return thread_id

    return _run(_do())


# ---------------------------------------------------------------------------
# Create (via update, since ThreadRepo has no create method)
# ---------------------------------------------------------------------------


def test_bench_thread_create(benchmark, thread_repo):
    """Benchmark creating a thread with 5 messages."""
    counter = {"i": 0}

    async def _create():
        counter["i"] += 1
        tid = str(uuid.uuid4())
        data = make_thread(counter["i"], message_count=5)
        await thread_repo.update(tid, data)
        return tid

    result = benchmark(lambda: _run(_create()))
    assert result is not None


# ---------------------------------------------------------------------------
# List (via search)
# ---------------------------------------------------------------------------


def _seed_threads(thread_repo, count: int):
    """Pre-seed N threads."""
    for i in range(count):
        _create_thread(thread_repo, index=i)


def test_bench_thread_list(benchmark, thread_repo):
    """Benchmark listing threads after seeding 50."""
    _seed_threads(thread_repo, 50)

    async def _search():
        return await thread_repo.search(SearchFilter(limit=50))

    result = benchmark(lambda: _run(_search()))
    assert isinstance(result, list)


# ---------------------------------------------------------------------------
# Get with messages
# ---------------------------------------------------------------------------


def test_bench_thread_get_with_messages(benchmark, thread_repo):
    """Benchmark getting a thread that has 20 messages."""
    tid = _create_thread(thread_repo, index=0, message_count=20)

    result = benchmark(lambda: _run(thread_repo.get(tid)))
    assert result is not None


def test_bench_thread_get_large_messages(benchmark, thread_repo):
    """Benchmark getting a thread that has 100 messages."""
    tid = _create_thread(thread_repo, index=0, message_count=100)

    result = benchmark(lambda: _run(thread_repo.get(tid)))
    assert result is not None


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------


def test_bench_thread_delete(benchmark, thread_repo):
    """Benchmark deleting a thread."""

    async def _create_and_delete():
        tid = str(uuid.uuid4())
        await thread_repo.update(tid, make_thread(0))
        deleted = await thread_repo.delete(tid)
        return deleted

    result = benchmark(lambda: _run(_create_and_delete()))
    assert result is True
