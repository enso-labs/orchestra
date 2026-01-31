"""Unit tests for memory REST API routes."""

from typing import AsyncGenerator
from unittest.mock import MagicMock

import pytest
from httpx import ASGITransport, AsyncClient
from langgraph.store.memory import InMemoryStore

from main import api_app, app
from src.services.db import get_async_db, get_store
from src.utils.auth import verify_credentials


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

MOCK_USER = MagicMock()
MOCK_USER.id = 99999

_ALL_APPS = (app, api_app)


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
async def memory_client() -> AsyncGenerator[AsyncClient, None]:
    store = InMemoryStore()

    async def override_db():
        yield None

    def override_store(req=None):
        return store

    async def override_auth():
        return MOCK_USER

    _set_overrides(
        {
            get_async_db: override_db,
            get_store: override_store,
            verify_credentials: override_auth,
        }
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    _clear_overrides()


@pytest.fixture
async def no_auth_client() -> AsyncGenerator[AsyncClient, None]:
    store = InMemoryStore()

    async def override_db():
        yield None

    def override_store(req=None):
        return store

    _set_overrides(
        {
            get_async_db: override_db,
            get_store: override_store,
        }
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    _clear_overrides()


# ---------------------------------------------------------------------------
# Tests: authentication required
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_memories_requires_auth(no_auth_client: AsyncClient) -> None:
    resp = await no_auth_client.get("/api/memories")
    assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# Tests: CRUD operations
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_memory(memory_client: AsyncClient) -> None:
    resp = await memory_client.post("/api/memories", json={"content": "test memory"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["content"] == "test memory"
    assert data["id"].startswith("memory_")


@pytest.mark.asyncio
async def test_get_memory(memory_client: AsyncClient) -> None:
    create_resp = await memory_client.post("/api/memories", json={"content": "get me"})
    memory_id = create_resp.json()["id"]

    resp = await memory_client.get(f"/api/memories/{memory_id}")
    assert resp.status_code == 200
    assert resp.json()["content"] == "get me"


@pytest.mark.asyncio
async def test_get_memory_not_found(memory_client: AsyncClient) -> None:
    resp = await memory_client.get("/api/memories/nonexistent")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_memory(memory_client: AsyncClient) -> None:
    create_resp = await memory_client.post(
        "/api/memories", json={"content": "original"}
    )
    memory_id = create_resp.json()["id"]

    resp = await memory_client.put(
        f"/api/memories/{memory_id}", json={"content": "updated"}
    )
    assert resp.status_code == 200
    assert resp.json()["content"] == "updated"


@pytest.mark.asyncio
async def test_update_memory_not_found(memory_client: AsyncClient) -> None:
    resp = await memory_client.put("/api/memories/nonexistent", json={"content": "x"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_memory(memory_client: AsyncClient) -> None:
    create_resp = await memory_client.post(
        "/api/memories", json={"content": "delete me"}
    )
    memory_id = create_resp.json()["id"]

    resp = await memory_client.delete(f"/api/memories/{memory_id}")
    assert resp.status_code == 204

    # Verify deleted
    get_resp = await memory_client.get(f"/api/memories/{memory_id}")
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_memory_not_found(memory_client: AsyncClient) -> None:
    resp = await memory_client.delete("/api/memories/nonexistent")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_memories_with_pagination(memory_client: AsyncClient) -> None:
    # Create 3 memories
    for i in range(3):
        await memory_client.post("/api/memories", json={"content": f"memory {i}"})

    resp = await memory_client.get("/api/memories?limit=2&offset=0")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["memories"]) == 2
    assert data["total"] == 3
    assert data["limit"] == 2
    assert data["offset"] == 0
