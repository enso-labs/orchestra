"""Unit tests for LLM controller model resolution logic.

Tests that _resolve_user_settings correctly applies:
1. Explicit model passes through unchanged
2. Empty model resolves to user default
3. No user default falls back to DEFAULT_CHAT_MODEL
4. Unauthenticated user gets DEFAULT_CHAT_MODEL
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from src.controllers.llm import LLMController
from src.constants.llm import DEFAULT_CHAT_MODEL


class FakeSettings:
    """Minimal stand-in for user settings."""

    def __init__(self, default_model=None, default_sandbox=None):
        self.default_model = default_model
        self.default_sandbox = default_sandbox


@pytest.fixture
def mock_store():
    return MagicMock()


@pytest.fixture
def mock_config():
    return {"configurable": {}, "metadata": {}}


class TestResolveUserSettings:
    """Test _resolve_user_settings model resolution."""

    @pytest.mark.asyncio
    async def test_explicit_model_passes_through(self, mock_store, mock_config):
        """When client sends an explicit model, it should be used as-is."""
        controller = LLMController(
            user_id="user-1", store=mock_store, config=mock_config
        )

        with patch.object(
            controller,
            "_resolve_user_settings",
            wraps=controller._resolve_user_settings,
        ):
            with patch("src.controllers.llm.UserSettingsRepo") as MockRepo:
                instance = MockRepo.return_value
                instance._get_or_create = AsyncMock(
                    return_value=FakeSettings(default_model="anthropic:claude-sonnet-4")
                )
                instance._decrypt_keys = MagicMock(return_value={})

                (
                    model,
                    api_key,
                    default_sandbox,
                ) = await controller._resolve_user_settings("openai:gpt-4o")

        assert model == "openai:gpt-4o"

    @pytest.mark.asyncio
    async def test_empty_model_resolves_to_user_default(self, mock_store, mock_config):
        """When client sends empty model, user's default_model should be used."""
        controller = LLMController(
            user_id="user-1", store=mock_store, config=mock_config
        )

        with patch("src.controllers.llm.UserSettingsRepo") as MockRepo:
            instance = MockRepo.return_value
            instance._get_or_create = AsyncMock(
                return_value=FakeSettings(default_model="anthropic:claude-sonnet-4")
            )
            instance._decrypt_keys = MagicMock(return_value={})

            model, _, _ = await controller._resolve_user_settings("")

        assert model == "anthropic:claude-sonnet-4"

    @pytest.mark.asyncio
    async def test_no_user_default_falls_back_to_system(self, mock_store, mock_config):
        """When user has no default_model, system DEFAULT_CHAT_MODEL should be used."""
        controller = LLMController(
            user_id="user-1", store=mock_store, config=mock_config
        )

        with patch("src.controllers.llm.UserSettingsRepo") as MockRepo:
            instance = MockRepo.return_value
            instance._get_or_create = AsyncMock(
                return_value=FakeSettings(default_model=None)
            )
            instance._decrypt_keys = MagicMock(return_value={})

            model, _, _ = await controller._resolve_user_settings("")

        assert model == DEFAULT_CHAT_MODEL

    @pytest.mark.asyncio
    async def test_default_sandbox_returned_from_settings(
        self, mock_store, mock_config
    ):
        """When user has a default_sandbox, it should be returned in the 3-tuple."""
        controller = LLMController(
            user_id="user-1", store=mock_store, config=mock_config
        )

        with patch("src.controllers.llm.UserSettingsRepo") as MockRepo:
            instance = MockRepo.return_value
            instance._get_or_create = AsyncMock(
                return_value=FakeSettings(
                    default_model="openai:gpt-4o", default_sandbox="daytona"
                )
            )
            instance._decrypt_keys = MagicMock(return_value={})

            model, _, default_sandbox = await controller._resolve_user_settings(
                "openai:gpt-4o"
            )

        assert model == "openai:gpt-4o"
        assert default_sandbox == "daytona"

    @pytest.mark.asyncio
    async def test_unauthenticated_user_gets_system_default(
        self, mock_store, mock_config
    ):
        """Unauthenticated users (no user_id) should get DEFAULT_CHAT_MODEL."""
        controller = LLMController(user_id=None, store=mock_store, config=mock_config)

        model, api_key, default_sandbox = await controller._resolve_user_settings("")

        assert model == DEFAULT_CHAT_MODEL
        assert api_key is None
        assert default_sandbox is None

    @pytest.mark.asyncio
    async def test_unauthenticated_user_explicit_model_preserved(
        self, mock_store, mock_config
    ):
        """Unauthenticated users with explicit model should keep it."""
        controller = LLMController(user_id=None, store=mock_store, config=mock_config)

        model, api_key, default_sandbox = await controller._resolve_user_settings(
            "openai:gpt-4o"
        )

        assert model == "openai:gpt-4o"
        assert api_key is None
        assert default_sandbox is None


class TestLLMRequestModelDefault:
    """Test that LLMRequest.model defaults to None."""

    def test_model_defaults_to_none(self):
        """LLMRequest without model field should default to None."""
        from src.schemas.entities.llm import LLMRequest

        payload = {
            "input": {"messages": [{"role": "user", "content": "Hello"}]},
        }
        request = LLMRequest(**payload)
        assert request.model is None

    def test_model_explicit_value_preserved(self):
        """LLMRequest with explicit model should preserve it."""
        from src.schemas.entities.llm import LLMRequest

        payload = {
            "input": {"messages": [{"role": "user", "content": "Hello"}]},
            "model": "openai:gpt-4o",
        }
        request = LLMRequest(**payload)
        assert request.model == "openai:gpt-4o"

    def test_model_empty_string_preserved(self):
        """LLMRequest with empty string model should preserve it."""
        from src.schemas.entities.llm import LLMRequest

        payload = {
            "input": {"messages": [{"role": "user", "content": "Hello"}]},
            "model": "",
        }
        request = LLMRequest(**payload)
        assert request.model == ""
