"""Smoke test to verify benchmark infrastructure is working."""

from tests.benchmarks.conftest import make_memory, make_thread, make_assistant, make_saved_tool


def test_benchmark_infra_smoke(benchmark, memory_repo):
    """Verify pytest-benchmark runs and produces timing data."""

    async def _create_and_list():
        await memory_repo.create(**make_memory(0))
        memories, total = await memory_repo.list(limit=10)
        return memories

    import asyncio

    result = benchmark(lambda: asyncio.get_event_loop().run_until_complete(_create_and_list()))
    assert result is not None


def test_data_factories():
    """Verify all data factories produce valid structures."""
    mem = make_memory(1)
    assert "content" in mem and "path" in mem

    thread = make_thread(1, message_count=3)
    assert len(thread["messages"]) == 3

    assistant = make_assistant(1)
    assert assistant["name"] == "Bench Assistant 1"

    tool = make_saved_tool(1)
    assert tool.name == "bench_tool_1"
