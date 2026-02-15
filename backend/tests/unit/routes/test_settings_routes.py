"""Unit tests for settings routes: auth, response masking, invalid provider handling."""

import json
from typing import AsyncGenerator
from unittest.mock import MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from langgraph.store.memory import InMemoryStore

from main import api_app, app
from src.services.db import get_async_db, get_store
from src.utils.auth import verify_credentials


# ---------------------------------------------------------------------------
# Fake encryption helpers (no APP_SECRET_KEY needed)
# ---------------------------------------------------------------------------


def _mock_encrypt(value: dict) -> str:
    return "ENC:" + json.dumps(value, sort_keys=True)


def _mock_decrypt(value: str) -> dict:
    if not value.startswith("ENC:"):
        raise ValueError("Bad ciphertext")
    return json.loads(value[4:])


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
async def settings_client() -> AsyncGenerator[AsyncClient, None]:
    """Client with auth and store overrides, plus mocked encryption."""
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

    with (
        patch(
            "src.repos.user_settings_repo.encrypt_value",
            side_effect=_mock_encrypt,
        ),
        patch(
            "src.repos.user_settings_repo.decrypt_value",
            side_effect=_mock_decrypt,
        ),
    ):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            yield client

    _clear_overrides()


@pytest.fixture
async def no_auth_client() -> AsyncGenerator[AsyncClient, None]:
    """Client WITHOUT auth override — requests should fail with 401/403."""
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
async def test_get_settings_requires_auth(no_auth_client: AsyncClient) -> None:
    """GET /settings without credentials returns 401 or 403."""
    resp = await no_auth_client.get("/api/settings")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_put_default_model_requires_auth(no_auth_client: AsyncClient) -> None:
    resp = await no_auth_client.put("/api/settings/default-model", json={"model": "openai/gpt-4"})
    assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# Tests: GET /settings
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_settings_empty(settings_client: AsyncClient) -> None:
    """Fresh settings returns null default_model and all providers is_set=False."""
    resp = await settings_client.get("/api/settings")
    assert resp.status_code == 200
    data = resp.json()
    assert data["default_model"] is None
    assert isinstance(data["provider_keys"], list)
    assert len(data["provider_keys"]) > 0
    for pk in data["provider_keys"]:
        assert pk["is_set"] is False


# ---------------------------------------------------------------------------
# Tests: PUT /settings/default-model
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_set_default_model(settings_client: AsyncClient) -> None:
    resp = await settings_client.put("/api/settings/default-model", json={"model": "anthropic/claude-3"})
    assert resp.status_code == 200
    assert resp.json()["default_model"] == "anthropic/claude-3"


@pytest.mark.asyncio
async def test_clear_default_model(settings_client: AsyncClient) -> None:
    await settings_client.put("/api/settings/default-model", json={"model": "openai/gpt-4"})
    resp = await settings_client.put("/api/settings/default-model", json={"model": None})
    assert resp.status_code == 200
    assert resp.json()["default_model"] is None


# ---------------------------------------------------------------------------
# Tests: PUT /settings/provider-keys  (response masking)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_upsert_provider_key_masks_response(settings_client: AsyncClient) -> None:
    """After upserting a key, response shows is_set=True but no raw key."""
    resp = await settings_client.put(
        "/api/settings/provider-keys",
        json={"provider": "OPENAI_API_KEY", "api_key": "sk-secret"},
    )
    assert resp.status_code == 200
    data = resp.json()
    # No raw key anywhere in response
    assert "sk-secret" not in json.dumps(data)
    openai = next(p for p in data["provider_keys"] if p["provider"] == "OPENAI_API_KEY")
    assert openai["is_set"] is True


@pytest.mark.asyncio
async def test_upsert_invalid_provider_returns_400(
    settings_client: AsyncClient,
) -> None:
    """Invalid provider name returns HTTP 400."""
    resp = await settings_client.put(
        "/api/settings/provider-keys",
        json={"provider": "INVALID_PROVIDER", "api_key": "key"},
    )
    assert resp.status_code == 400
    assert "Invalid provider" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# Tests: DELETE /settings/provider-keys/{provider}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_delete_provider_key(settings_client: AsyncClient) -> None:
    # Set then delete
    await settings_client.put(
        "/api/settings/provider-keys",
        json={"provider": "OPENAI_API_KEY", "api_key": "sk-1"},
    )
    resp = await settings_client.delete("/api/settings/provider-keys/OPENAI_API_KEY")
    assert resp.status_code == 200
    openai = next(p for p in resp.json()["provider_keys"] if p["provider"] == "OPENAI_API_KEY")
    assert openai["is_set"] is False


@pytest.mark.asyncio
async def test_delete_invalid_provider_returns_400(
    settings_client: AsyncClient,
) -> None:
    resp = await settings_client.delete("/api/settings/provider-keys/BAD_PROVIDER")
    assert resp.status_code == 400
    assert "Invalid provider" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# Tests: GET /settings includes default_sandbox
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_settings_includes_default_sandbox(
    settings_client: AsyncClient,
) -> None:
    """GET /settings response includes the default_sandbox field (null by default)."""
    resp = await settings_client.get("/api/settings")
    assert resp.status_code == 200
    data = resp.json()
    assert "default_sandbox" in data
    assert data["default_sandbox"] is None


# ---------------------------------------------------------------------------
# Tests: PUT /settings/default-sandbox
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_set_default_sandbox(settings_client: AsyncClient) -> None:
    """PUT /settings/default-sandbox stores and returns the value."""
    resp = await settings_client.put("/api/settings/default-sandbox", json={"sandbox": "daytona"})
    assert resp.status_code == 200
    assert resp.json()["default_sandbox"] == "daytona"

    # Verify it persists via GET
    get_resp = await settings_client.get("/api/settings")
    assert get_resp.json()["default_sandbox"] == "daytona"


@pytest.mark.asyncio
async def test_set_invalid_sandbox_returns_400(settings_client: AsyncClient) -> None:
    """PUT /settings/default-sandbox with invalid value returns HTTP 400."""
    resp = await settings_client.put("/api/settings/default-sandbox", json={"sandbox": "invalid_backend"})
    assert resp.status_code == 400
    assert "Invalid sandbox" in resp.json()["detail"]
