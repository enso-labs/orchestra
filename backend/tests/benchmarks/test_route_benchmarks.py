"""Benchmarks for API route handlers.

Measures end-to-end request handling overhead (serialization, validation,
dependency injection) using FastAPI TestClient with mocked dependencies.
"""

import asyncio
from unittest.mock import MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from langgraph.store.memory import InMemoryStore

from main import api_app, app
from src.services.db import get_async_db, get_store
from src.utils.auth import verify_credentials, get_optional_user, get_optional_user_from_token
from src.utils.cache import init_cache

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

MOCK_USER = MagicMock()
MOCK_USER.id = "bench-route-user-0000"

_ALL_APPS = (app, api_app)

WARN_THRESHOLD_MS = 200  # Flag any endpoint >200ms


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def _set_overrides(overrides: dict) -> None:
    for a in _ALL_APPS:
        a.dependency_overrides.update(overrides)


def _clear_overrides() -> None:
    for a in _ALL_APPS:
        a.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def route_store():
    """Shared InMemoryStore for route benchmarks."""
    return InMemoryStore()


@pytest.fixture
def bench_client(route_store):
    """Synchronous-friendly HTTP client with mocked dependencies."""

    async def override_db():
        yield None

    def override_store(req=None):
        return route_store

    async def override_auth():
        return MOCK_USER

    _set_overrides(
        {
            get_async_db: override_db,
            get_store: override_store,
            verify_credentials: override_auth,
            get_optional_user: override_auth,
            get_optional_user_from_token: override_auth,
        }
    )

    init_cache()
    transport = ASGITransport(app=app)
    client = _run(AsyncClient(transport=transport, base_url="http://test").__aenter__())
    yield client
    _run(client.aclose())
    _clear_overrides()


# ---------------------------------------------------------------------------
# Seed helpers
# ---------------------------------------------------------------------------


def _seed_memories(client, count: int) -> list[str]:
    """Seed memories via API and return their IDs."""
    ids = []
    for i in range(count):
        resp = _run(client.post("/api/memories", json={"content": f"bench memory {i}", "path": f"bench_{i}.md"}))
        ids.append(resp.json()["id"])
    return ids


def _seed_assistants(client, count: int) -> list[str]:
    """Seed assistants via API and return their IDs."""
    ids = []
    for i in range(count):
        resp = _run(
            client.post(
                "/api/assistants",
                json={
                    "name": f"Bench Assistant {i}",
                    "description": f"Benchmark assistant {i}",
                    "tools": [],
                    "system_prompt": f"You are bench assistant {i}.",
                    "metadata": {},
                    "public": False,
                },
            )
        )
        ids.append(resp.json()["assistant_id"])
    return ids


# ===========================================================================
# Health route benchmarks
# ===========================================================================


def test_bench_health_check(benchmark, bench_client):
    """Benchmark GET /api/info/health — simple JSON response."""

    def _call():
        resp = _run(bench_client.get("/api/info/health"))
        assert resp.status_code == 200
        return resp

    result = benchmark(_call)
    assert result.json()["status"] == "healthy"


# ===========================================================================
# Memory route benchmarks
# ===========================================================================


def test_bench_memory_route_create(benchmark, bench_client):
    """Benchmark POST /api/memories — create a memory via API."""
    counter = {"i": 0}

    def _call():
        counter["i"] += 1
        resp = _run(
            bench_client.post(
                "/api/memories",
                json={"content": f"bench content {counter['i']}", "path": f"bench_route_{counter['i']}.md"},
            )
        )
        assert resp.status_code == 201
        return resp

    result = benchmark(_call)
    assert "id" in result.json()


def test_bench_memory_route_list(benchmark, bench_client):
    """Benchmark GET /api/memories — list memories after seeding 50."""
    _seed_memories(bench_client, 50)

    def _call():
        resp = _run(bench_client.get("/api/memories?limit=50"))
        assert resp.status_code == 200
        return resp

    result = benchmark(_call)
    data = result.json()
    assert len(data["memories"]) <= 50


def test_bench_memory_route_get(benchmark, bench_client):
    """Benchmark GET /api/memories/{id} — fetch a single memory."""
    ids = _seed_memories(bench_client, 1)
    memory_id = ids[0]

    def _call():
        resp = _run(bench_client.get(f"/api/memories/{memory_id}"))
        assert resp.status_code == 200
        return resp

    result = benchmark(_call)
    assert result.json()["id"] == memory_id


def test_bench_memory_route_delete(benchmark, bench_client):
    """Benchmark DELETE /api/memories/{id} — delete a memory via API."""
    counter = {"i": 0}

    def _call():
        counter["i"] += 1
        # Create then delete
        create_resp = _run(
            bench_client.post(
                "/api/memories",
                json={"content": f"delete me {counter['i']}", "path": f"del_{counter['i']}.md"},
            )
        )
        mid = create_resp.json()["id"]
        resp = _run(bench_client.delete(f"/api/memories/{mid}"))
        assert resp.status_code == 204
        return resp

    benchmark(_call)


# ===========================================================================
# Assistant route benchmarks
# ===========================================================================


def test_bench_assistant_route_create(benchmark, bench_client):
    """Benchmark POST /api/assistants — create an assistant via API."""
    counter = {"i": 0}

    def _call():
        counter["i"] += 1
        resp = _run(
            bench_client.post(
                "/api/assistants",
                json={
                    "name": f"Bench {counter['i']}",
                    "description": f"Benchmark assistant {counter['i']}",
                    "tools": [],
                    "system_prompt": "Test",
                    "metadata": {},
                    "public": False,
                },
            )
        )
        assert resp.status_code == 200
        return resp

    result = benchmark(_call)
    assert "assistant_id" in result.json()


def test_bench_assistant_route_search(benchmark, bench_client):
    """Benchmark POST /api/assistants/search — list assistants after seeding 20."""
    _seed_assistants(bench_client, 20)

    def _call():
        resp = _run(bench_client.post("/api/assistants/search", json={"filter": {}}))
        assert resp.status_code == 200
        return resp

    result = benchmark(_call)
    assert "assistants" in result.json()


def test_bench_assistant_route_delete(benchmark, bench_client):
    """Benchmark DELETE /api/assistants/{id} — delete an assistant."""
    counter = {"i": 0}

    def _call():
        counter["i"] += 1
        create_resp = _run(
            bench_client.post(
                "/api/assistants",
                json={
                    "name": f"Del {counter['i']}",
                    "description": "temp",
                    "tools": [],
                    "system_prompt": "Test",
                    "metadata": {},
                    "public": False,
                },
            )
        )
        aid = create_resp.json()["assistant_id"]
        resp = _run(bench_client.delete(f"/api/assistants/{aid}"))
        assert resp.status_code == 204
        return resp

    benchmark(_call)


# ===========================================================================
# Tool route benchmarks
# ===========================================================================


def test_bench_tool_route_list(benchmark, bench_client):
    """Benchmark GET /api/tools — list tools (with mocked tool library)."""

    with patch("src.services.tool.init_tool_library", return_value=[]):

        def _call():
            resp = _run(bench_client.get("/api/tools"))
            assert resp.status_code == 200
            return resp

        result = benchmark(_call)
        assert "tools" in result.json()


def test_bench_tool_route_create(benchmark, bench_client):
    """Benchmark POST /api/tools — create a custom tool."""
    counter = {"i": 0}

    def _call():
        counter["i"] += 1
        resp = _run(
            bench_client.post(
                "/api/tools",
                json={
                    "name": f"bench_tool_{counter['i']}",
                    "config": {"base_tool": "send_webhook_to_channel"},
                    "description": f"Benchmark tool {counter['i']}",
                    "type": "default",
                    "metadata": {},
                    "tags": ["benchmark"],
                    "env": {},
                    "verbose": False,
                    "disabled": False,
                    "public": False,
                },
            )
        )
        assert resp.status_code == 201
        return resp

    benchmark(_call)


# ===========================================================================
# LLM route benchmarks (lightweight endpoints only)
# ===========================================================================


def test_bench_llm_models_list(benchmark, bench_client):
    """Benchmark GET /api/llm/models — list available models."""

    def _call():
        resp = _run(bench_client.get("/api/llm/models"))
        assert resp.status_code == 200
        return resp

    result = benchmark(_call)
    data = result.json()
    assert "models" in data
    assert "default" in data


def test_bench_llm_models_reset(benchmark, bench_client):
    """Benchmark GET /api/llm/models/reset — reset model cache."""

    def _call():
        resp = _run(bench_client.get("/api/llm/models/reset"))
        assert resp.status_code == 200
        return resp

    result = benchmark(_call)
    assert "message" in result.json()


# ===========================================================================
# Serialization overhead: route vs repo comparison
# ===========================================================================


def test_bench_memory_serialization_overhead(benchmark, bench_client):
    """Benchmark memory list via route to compare with repo-only timing.

    The repo-layer benchmark for list-100 gives a baseline.  This test
    measures the same operation through the full HTTP stack so we can
    compute serialization + framework overhead.
    """
    _seed_memories(bench_client, 100)

    def _call():
        resp = _run(bench_client.get("/api/memories?limit=100"))
        assert resp.status_code == 200
        return resp

    result = benchmark(_call)
    data = result.json()
    assert data["total"] >= 100
