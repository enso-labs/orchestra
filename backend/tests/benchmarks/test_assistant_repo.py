"""Benchmarks for AssistantService CRUD operations."""

import asyncio
import uuid

from tests.benchmarks.conftest import make_assistant


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def _create_assistant(assistant_service, index: int = 0) -> str:
    """Create an assistant and return its ID."""
    aid = str(uuid.uuid4())
    _run(assistant_service.update(aid, make_assistant(index)))
    return aid


# ---------------------------------------------------------------------------
# Create (via update)
# ---------------------------------------------------------------------------


def test_bench_assistant_create(benchmark, assistant_service):
    """Benchmark creating an assistant."""
    counter = {"i": 0}

    async def _create():
        counter["i"] += 1
        aid = str(uuid.uuid4())
        await assistant_service.update(aid, make_assistant(counter["i"]))
        return aid

    result = benchmark(lambda: _run(_create()))
    assert result is not None


# ---------------------------------------------------------------------------
# List (via search)
# ---------------------------------------------------------------------------


def test_bench_assistant_list(benchmark, assistant_service):
    """Benchmark listing assistants after seeding 50."""
    for i in range(50):
        _create_assistant(assistant_service, i)

    result = benchmark(lambda: _run(assistant_service.search(limit=50)))
    assert isinstance(result, list)


def test_bench_assistant_list_large(benchmark, assistant_service):
    """Benchmark listing assistants after seeding 200."""
    for i in range(200):
        _create_assistant(assistant_service, i)

    result = benchmark(lambda: _run(assistant_service.search(limit=200)))
    assert isinstance(result, list)


# ---------------------------------------------------------------------------
# Get
# ---------------------------------------------------------------------------


def test_bench_assistant_get(benchmark, assistant_service):
    """Benchmark getting a single assistant by ID."""
    aid = _create_assistant(assistant_service, 0)

    result = benchmark(lambda: _run(assistant_service.get(aid)))
    assert result is not None
