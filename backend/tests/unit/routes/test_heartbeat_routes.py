"""Unit tests for heartbeat REST API endpoints."""

from datetime import datetime, timezone
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from langgraph.store.memory import InMemoryStore

from main import api_app, app
from src.schemas.entities.heartbeat import (
    ActiveHours,
    HeartbeatConfig,
    HeartbeatState,
    HeartbeatTickResult,
)
from src.services.db import get_async_db, get_store
from src.utils.auth import verify_credentials


# --- Helpers ---

MOCK_USER = MagicMock()
MOCK_USER.id = "test-user-hb"

_ALL_APPS = (app, api_app)


def _set_overrides(overrides: dict) -> None:
    for a in _ALL_APPS:
        a.dependency_overrides.update(overrides)


def _clear_overrides() -> None:
    for a in _ALL_APPS:
        a.dependency_overrides.clear()


def _make_config(**overrides) -> HeartbeatConfig:
    defaults = {
        "user_id": "test-user-hb",
        "assistant_id": "asst-1",
        "enabled": True,
        "checklist": "- [ ] Check inbox",
        "every_seconds": 3600,
        "active_hours": ActiveHours(),
    }
    defaults.update(overrides)
    return HeartbeatConfig(**defaults)


# --- Fixtures ---


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
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

    fake_redis = AsyncMock()
    fake_redis.get = AsyncMock(return_value=None)
    fake_redis.set = AsyncMock(return_value=None)
    fake_redis.delete = AsyncMock(return_value=None)

    with patch("src.common.utils.redis_cache.get_redis_client", return_value=fake_redis):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c

    _clear_overrides()


# --- GET /api/heartbeat ---


@pytest.mark.asyncio
@patch("src.routes.v0.heartbeat.HeartbeatService")
async def test_get_returns_empty_when_no_config(mock_svc_class, client: AsyncClient):
    mock_svc = AsyncMock()
    mock_svc.get_config.return_value = None
    mock_svc_class.return_value = mock_svc

    resp = await client.get("/api/heartbeat")
    assert resp.status_code == 200
    assert resp.json() == {}


@pytest.mark.asyncio
@patch("src.routes.v0.heartbeat.HeartbeatService")
async def test_get_returns_saved_config(mock_svc_class, client: AsyncClient):
    config = _make_config()
    mock_svc = AsyncMock()
    mock_svc.get_config.return_value = config
    mock_svc_class.return_value = mock_svc

    resp = await client.get("/api/heartbeat")
    assert resp.status_code == 200
    data = resp.json()
    assert data["assistant_id"] == "asst-1"
    assert data["enabled"] is True


# --- PUT /api/heartbeat ---


@pytest.mark.asyncio
@patch("src.routes.v0.heartbeat.HeartbeatService")
async def test_put_creates_config(mock_svc_class, client: AsyncClient):
    mock_svc = AsyncMock()
    mock_svc.get_config.return_value = None
    mock_svc.register.return_value = "sched-1"
    mock_svc_class.return_value = mock_svc

    resp = await client.put(
        "/api/heartbeat",
        json={
            "assistant_id": "asst-1",
            "enabled": True,
            "checklist": "- [ ] Test",
            "every_seconds": 3600,
        },
    )
    assert resp.status_code == 200
    mock_svc.save_config.assert_called_once()


@pytest.mark.asyncio
@patch("src.routes.v0.heartbeat.HeartbeatService")
async def test_put_registers_schedule_on_enable(mock_svc_class, client: AsyncClient):
    mock_svc = AsyncMock()
    mock_svc.get_config.return_value = None
    mock_svc_class.return_value = mock_svc

    await client.put(
        "/api/heartbeat",
        json={"assistant_id": "asst-1", "enabled": True, "checklist": "test"},
    )

    mock_svc.register.assert_called_once()


@pytest.mark.asyncio
@patch("src.routes.v0.heartbeat.HeartbeatService")
async def test_put_unregisters_on_disable(mock_svc_class, client: AsyncClient):
    mock_svc = AsyncMock()
    mock_svc.get_config.return_value = _make_config(enabled=True, schedule_id="sched-1")
    mock_svc_class.return_value = mock_svc

    await client.put(
        "/api/heartbeat",
        json={"assistant_id": "asst-1", "enabled": False, "checklist": "test"},
    )

    mock_svc.unregister.assert_called_once()
    mock_svc.register.assert_not_called()


@pytest.mark.asyncio
async def test_put_validates_every_seconds_too_low(client: AsyncClient):
    resp = await client.put(
        "/api/heartbeat",
        json={"assistant_id": "asst-1", "enabled": True, "every_seconds": 100},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_put_validates_every_seconds_too_high(client: AsyncClient):
    resp = await client.put(
        "/api/heartbeat",
        json={"assistant_id": "asst-1", "enabled": True, "every_seconds": 100000},
    )
    assert resp.status_code == 422


# --- DELETE /api/heartbeat ---


@pytest.mark.asyncio
@patch("src.routes.v0.heartbeat.HeartbeatService")
async def test_delete_removes_config(mock_svc_class, client: AsyncClient):
    mock_svc = AsyncMock()
    mock_svc.delete_config.return_value = True
    mock_svc_class.return_value = mock_svc

    resp = await client.delete("/api/heartbeat")
    assert resp.status_code == 204
    mock_svc.delete_config.assert_called_once()


# --- POST /api/heartbeat/tick ---


@pytest.mark.asyncio
@patch("src.routes.v0.heartbeat.HeartbeatService")
async def test_post_tick_triggers_and_returns_result(mock_svc_class, client: AsyncClient):
    now = datetime.now(timezone.utc)
    result = HeartbeatTickResult(action="ok", reason="All checks passed", response="HEARTBEAT_OK", timestamp=now)

    mock_svc = AsyncMock()
    mock_svc.tick.return_value = result
    mock_svc_class.return_value = mock_svc

    resp = await client.post("/api/heartbeat/tick")
    assert resp.status_code == 200
    data = resp.json()
    assert data["action"] == "ok"


# --- GET /api/heartbeat/state ---


@pytest.mark.asyncio
@patch("src.routes.v0.heartbeat.HeartbeatService")
async def test_get_state_returns_state(mock_svc_class, client: AsyncClient):
    state = HeartbeatState(total_ticks=10, consecutive_ok_count=5)

    mock_svc = AsyncMock()
    mock_svc.get_state.return_value = state
    mock_svc_class.return_value = mock_svc

    resp = await client.get("/api/heartbeat/state")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_ticks"] == 10


# --- GET /api/heartbeat/history ---


@pytest.mark.asyncio
@patch("src.routes.v0.heartbeat.HeartbeatService")
async def test_get_history_returns_results(mock_svc_class, client: AsyncClient):
    now = datetime.now(timezone.utc)
    results = [
        HeartbeatTickResult(action="escalated", reason="Issue found", timestamp=now),
        HeartbeatTickResult(action="ok", reason="All good", timestamp=now),
    ]

    mock_svc = AsyncMock()
    mock_svc.get_history.return_value = results
    mock_svc_class.return_value = mock_svc

    resp = await client.get("/api/heartbeat/history")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert data[0]["action"] == "escalated"


@pytest.mark.asyncio
@patch("src.routes.v0.heartbeat.HeartbeatService")
async def test_get_history_respects_limit_param(mock_svc_class, client: AsyncClient):
    mock_svc = AsyncMock()
    mock_svc.get_history.return_value = []
    mock_svc_class.return_value = mock_svc

    await client.get("/api/heartbeat/history?limit=5")

    mock_svc.get_history.assert_called_once_with(limit=5)
