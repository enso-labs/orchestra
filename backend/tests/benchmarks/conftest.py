"""Shared fixtures and data factories for benchmark tests."""

import pytest
from datetime import datetime
from langgraph.store.memory import InMemoryStore

from src.repos.memory_repo import MemoryRepo
from src.repos.thread_repo import ThreadRepo
from src.repos.tool_repo import ToolRepo
from src.services.assistant import AssistantService
from src.repos.tool_repo import SavedTool, ToolConfig


BENCH_USER_ID = "bench-user-00000000-0000-0000-0000"


# ---------------------------------------------------------------------------
# Store fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def bench_store():
    """Fresh InMemoryStore for each benchmark."""
    return InMemoryStore()


# ---------------------------------------------------------------------------
# Repo / service fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def memory_repo(bench_store):
    return MemoryRepo(user_id=BENCH_USER_ID, store=bench_store)


@pytest.fixture
def thread_repo(bench_store):
    return ThreadRepo(user_id=BENCH_USER_ID, store=bench_store)


@pytest.fixture
def tool_repo(bench_store):
    return ToolRepo(user_id=BENCH_USER_ID, store=bench_store)


@pytest.fixture
def assistant_service(bench_store):
    return AssistantService(user_id=BENCH_USER_ID, store=bench_store)


# ---------------------------------------------------------------------------
# Data factories
# ---------------------------------------------------------------------------


def make_memory(index: int = 0) -> dict:
    """Return kwargs suitable for MemoryRepo.create()."""
    return {
        "content": f"Benchmark memory content #{index}. " * 5,
        "path": f"bench_{index}.md",
        "metadata": {"tag": "benchmark", "index": index},
    }


def make_thread(index: int = 0, message_count: int = 5) -> dict:
    """Return a dict suitable for ThreadRepo.update() (thread data payload)."""
    messages = [
        {"role": "user" if i % 2 == 0 else "assistant", "content": f"Message {i} in thread {index}"}
        for i in range(message_count)
    ]
    return {
        "title": f"Benchmark thread #{index}",
        "messages": messages,
        "metadata": {"tag": "benchmark"},
    }


def make_assistant(index: int = 0) -> dict:
    """Return a dict suitable for AssistantService.update()."""
    return {
        "name": f"Bench Assistant {index}",
        "description": f"Benchmark assistant #{index} for perf testing.",
        "tools": ["web_search", "code_interpreter"],
        "system_prompt": f"You are benchmark assistant {index}.",
        "instructions": None,
        "mcp": {},
        "a2a": {},
        "metadata": {"tag": "benchmark", "index": index},
        "public": False,
    }


def make_saved_tool(index: int = 0) -> SavedTool:
    """Return a SavedTool instance for ToolRepo.create()."""
    return SavedTool(
        name=f"bench_tool_{index}",
        config=ToolConfig(base_tool="send_webhook_to_channel"),
        description=f"Benchmark tool #{index}",
        type="default",
        metadata={"index": index},
        tags=["benchmark"],
        env={"WEBHOOK_URL": "https://example.com/hook"},
        verbose=False,
        disabled=False,
        public=False,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
