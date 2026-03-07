"""Benchmarks for ToolRepo operations."""

import asyncio

from tests.benchmarks.conftest import make_saved_tool


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def _create_tool(tool_repo, index: int = 0):
    """Create a saved tool."""
    _run(tool_repo.create(make_saved_tool(index)))


# ---------------------------------------------------------------------------
# List (via search)
# ---------------------------------------------------------------------------


def test_bench_tool_list(benchmark, tool_repo):
    """Benchmark listing tools after seeding 20."""
    for i in range(20):
        _create_tool(tool_repo, i)

    result = benchmark(lambda: _run(tool_repo.search(limit=20)))
    assert isinstance(result, list)


def test_bench_tool_list_large(benchmark, tool_repo):
    """Benchmark listing tools after seeding 100."""
    for i in range(100):
        _create_tool(tool_repo, i)

    result = benchmark(lambda: _run(tool_repo.search(limit=100)))
    assert isinstance(result, list)


# ---------------------------------------------------------------------------
# Lookup by name (search with query)
# ---------------------------------------------------------------------------


def test_bench_tool_lookup_by_name(benchmark, tool_repo):
    """Benchmark looking up a tool by name."""
    for i in range(50):
        _create_tool(tool_repo, i)

    result = benchmark(lambda: _run(tool_repo.search(query="bench_tool_25")))
    assert isinstance(result, list)


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------


def test_bench_tool_delete(benchmark, tool_repo):
    """Benchmark deleting a tool."""
    counter = {"i": 0}

    async def _create_and_delete():
        counter["i"] += 1
        tool = make_saved_tool(counter["i"] + 10000)
        await tool_repo.create(tool)
        deleted = await tool_repo.delete(tool.name)
        return deleted

    result = benchmark(lambda: _run(_create_and_delete()))
    assert result is True
