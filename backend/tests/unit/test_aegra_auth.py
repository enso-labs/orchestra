"""Focused Aegra auth and tenancy contract tests."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

import aegra_auth


@pytest.mark.asyncio
async def test_missing_credentials_are_anonymous_not_an_authentication_error():
    result = await aegra_auth.authenticate(headers={})
    assert result["identity"] == "anonymous"
    assert result["is_authenticated"] is False
    assert result["permissions"] == []


@pytest.mark.asyncio
async def test_invalid_credentials_are_non_fatal():
    with patch.object(aegra_auth, "_authenticate_bearer", AsyncMock(return_value=None)):
        result = await aegra_auth.authenticate(headers={"authorization": "Bearer invalid"})
    assert result["identity"] == "anonymous"
    assert result["is_authenticated"] is False


@pytest.mark.asyncio
async def test_api_key_has_precedence_over_bearer():
    with (
        patch.object(aegra_auth, "_authenticate_api_key", AsyncMock(return_value=None)) as api_key,
        patch.object(aegra_auth, "_authenticate_bearer", AsyncMock(return_value={"identity": "bearer"})) as bearer,
    ):
        result = await aegra_auth.authenticate(headers={"x-api-key": "otk-rotated", "authorization": "Bearer valid"})

    assert result["identity"] == "anonymous"
    api_key.assert_awaited_once_with("otk-rotated")
    bearer.assert_not_awaited()


@pytest.mark.asyncio
async def test_public_run_is_allowed_but_paid_guest_model_is_forbidden():
    ctx = SimpleNamespace(
        user=SimpleNamespace(identity="anonymous", is_authenticated=False),
    )
    assistant = SimpleNamespace(model="openai:gpt-5", id="public-assistant")
    with (
        patch.object(aegra_auth, "_public_assistant", AsyncMock(return_value=assistant)),
        patch("src.utils.auth.is_authorized_model", return_value=True),
    ):
        value = {
            "config": {"configurable": {}},
            "context": {"assistant_id": "public-assistant"},
        }
        result = await aegra_auth.authorize_create_run(ctx, value)

    assert result is not None
    assert value["context"]["user_id"] == "anonymous"

    with (
        patch.object(aegra_auth, "_public_assistant", AsyncMock(return_value=assistant)),
        patch("src.utils.auth.is_authorized_model", return_value=False),
    ):
        with pytest.raises(Exception) as error:
            await aegra_auth.authorize_create_run(
                ctx,
                {"config": {"configurable": {}}, "context": {"assistant_id": "public-assistant"}},
            )
    assert getattr(error.value, "status_code", None) == 403


@pytest.mark.asyncio
async def test_tenant_filters_use_runtime_identity():
    ctx = SimpleNamespace(user=SimpleNamespace(identity="user-a", is_authenticated=True))
    assert await aegra_auth.authorize_thread_search(ctx, {}) == {"user_id": "user-a"}
    assert await aegra_auth.authorize_assistant_read(ctx, {}) == {"user_id": "user-a"}

    guest = SimpleNamespace(user=SimpleNamespace(identity="anonymous", is_authenticated=False))
    with pytest.raises(Exception) as error:
        await aegra_auth.authorize_thread_read(guest, {})
    assert getattr(error.value, "status_code", None) == 401
