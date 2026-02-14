"""Unit tests for distributed worker model resolution logic.

Tests that _execute_agent_stream correctly resolves user default model
and API key, mirroring LLMController._resolve_user_settings().

Covers:
1. Empty model resolves to user's settings.default_model
2. Falls back to DEFAULT_CHAT_MODEL when no user default exists
3. Explicit model passes through unchanged
4. api_key is passed to construct_agent
5. Empty user_id (unauthenticated) uses DEFAULT_CHAT_MODEL
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.constants.llm import DEFAULT_CHAT_MODEL
from src.schemas.entities import LLMRequest


class FakeSettings:
    """Minimal stand-in for user settings."""

    def __init__(self, default_model=None, encrypted_keys=None):
        self.default_model = default_model
        self.encrypted_keys = encrypted_keys


class FakeMessage:
    """Message stub that allows setting .model (unlike pydantic ChatMessage)."""

    def __init__(self):
        self.role = "user"
        self.content = "Hello"
        self.model = None


def _make_params(model=""):
    """Build a minimal LLMRequest with a FakeMessage so .model can be set."""
    params = LLMRequest(
        input={"messages": [{"role": "user", "content": "Hello"}]},
        model=model,
    )
    # Replace the pydantic ChatMessage with a FakeMessage that allows .model
    params.input.messages[-1] = FakeMessage()
    return params


def _make_service_context(store=None, user_id="user-1"):
    """Build a mock ServiceContext with llm_service.assistant as passthrough."""
    ctx = MagicMock()
    ctx.store = store or MagicMock()
    ctx.user_id = user_id
    ctx.llm_service.assistant = AsyncMock(side_effect=lambda p: p)
    ctx.memory_service = MagicMock()
    ctx.thread_service.update = AsyncMock()
    return ctx


def _mock_agent(model_name):
    """Build a mock agent that supports astream with empty iteration."""
    agent = AsyncMock()
    agent.model = model_name

    async def empty_astream(*_args, **_kwargs):
        return
        yield  # noqa: unreachable — makes this an async generator

    agent.astream = empty_astream
    agent.graph.aget_state = AsyncMock(
        return_value=MagicMock(
            config={"configurable": {}},
            values={"messages": []},
        )
    )
    return agent


def _mock_redis():
    """Build a mock Redis client."""
    r = AsyncMock()
    r.xadd = AsyncMock()
    r.expire = AsyncMock()
    return r


# Patch targets at source modules (imports are local inside _execute_agent_stream)
_PATCHES = {
    "settings_repo": "src.repos.user_settings_repo.UserSettingsRepo",
    "resolve_api_key": "src.utils.llm.resolve_api_key",
    "prepare_memory": "src.agents.prepare_memory_files",
    "construct_agent": "src.agents.construct_agent",
    "init_backend": "src.agents.init_backend",
}


class TestWorkerModelResolution:
    """Test model resolution inside _execute_agent_stream."""

    @pytest.mark.asyncio
    async def test_empty_model_resolves_to_user_default(self):
        """When request has no model, user's default_model should be applied."""
        params = _make_params(model="")
        ctx = _make_service_context()
        user_default = "anthropic:claude-sonnet-4"

        with (
            patch(_PATCHES["settings_repo"]) as MockRepo,
            patch(_PATCHES["resolve_api_key"], return_value=None),
            patch(
                _PATCHES["prepare_memory"],
                new_callable=AsyncMock,
                return_value=({}, []),
            ),
            patch(
                _PATCHES["construct_agent"], new_callable=AsyncMock
            ) as mock_construct,
            patch(_PATCHES["init_backend"]),
        ):
            instance = MockRepo.return_value
            instance._get_or_create = AsyncMock(
                return_value=FakeSettings(default_model=user_default)
            )
            instance._decrypt_keys = MagicMock(return_value={})

            mock_construct.return_value = _mock_agent(user_default)

            from src.workers.tasks import _execute_agent_stream

            await _execute_agent_stream(
                params=params,
                config={"configurable": {"thread_id": "t1"}},
                files_map={},
                todos_list=[],
                service_context=ctx,
                checkpointer=MagicMock(),
                user_id="user-1",
                thread_id="t1",
                stream_key="agent:stream:t1",
                redis_client=_mock_redis(),
            )

            call_kwargs = mock_construct.call_args[1]
            assert call_kwargs["model"] == user_default

    @pytest.mark.asyncio
    async def test_no_user_default_falls_back_to_system(self):
        """When user has no default_model, DEFAULT_CHAT_MODEL should be used."""
        params = _make_params(model="")
        ctx = _make_service_context()

        with (
            patch(_PATCHES["settings_repo"]) as MockRepo,
            patch(_PATCHES["resolve_api_key"], return_value=None),
            patch(
                _PATCHES["prepare_memory"],
                new_callable=AsyncMock,
                return_value=({}, []),
            ),
            patch(
                _PATCHES["construct_agent"], new_callable=AsyncMock
            ) as mock_construct,
            patch(_PATCHES["init_backend"]),
        ):
            instance = MockRepo.return_value
            instance._get_or_create = AsyncMock(
                return_value=FakeSettings(default_model=None)
            )
            instance._decrypt_keys = MagicMock(return_value={})

            mock_construct.return_value = _mock_agent(DEFAULT_CHAT_MODEL)

            from src.workers.tasks import _execute_agent_stream

            await _execute_agent_stream(
                params=params,
                config={"configurable": {"thread_id": "t1"}},
                files_map={},
                todos_list=[],
                service_context=ctx,
                checkpointer=MagicMock(),
                user_id="user-1",
                thread_id="t1",
                stream_key="agent:stream:t1",
                redis_client=_mock_redis(),
            )

            call_kwargs = mock_construct.call_args[1]
            assert call_kwargs["model"] == DEFAULT_CHAT_MODEL

    @pytest.mark.asyncio
    async def test_explicit_model_passes_through(self):
        """When request has an explicit model, it should not be overridden."""
        explicit_model = "openai:gpt-4o"
        params = _make_params(model=explicit_model)
        ctx = _make_service_context()

        with (
            patch(_PATCHES["settings_repo"]) as MockRepo,
            patch(_PATCHES["resolve_api_key"], return_value="sk-test"),
            patch(
                _PATCHES["prepare_memory"],
                new_callable=AsyncMock,
                return_value=({}, []),
            ),
            patch(
                _PATCHES["construct_agent"], new_callable=AsyncMock
            ) as mock_construct,
            patch(_PATCHES["init_backend"]),
        ):
            instance = MockRepo.return_value
            instance._get_or_create = AsyncMock(
                return_value=FakeSettings(default_model="anthropic:claude-sonnet-4")
            )
            instance._decrypt_keys = MagicMock(return_value={"openai": "sk-test"})

            mock_construct.return_value = _mock_agent(explicit_model)

            from src.workers.tasks import _execute_agent_stream

            await _execute_agent_stream(
                params=params,
                config={"configurable": {"thread_id": "t1"}},
                files_map={},
                todos_list=[],
                service_context=ctx,
                checkpointer=MagicMock(),
                user_id="user-1",
                thread_id="t1",
                stream_key="agent:stream:t1",
                redis_client=_mock_redis(),
            )

            call_kwargs = mock_construct.call_args[1]
            assert call_kwargs["model"] == explicit_model

    @pytest.mark.asyncio
    async def test_api_key_passed_to_construct_agent(self):
        """Resolved api_key should be passed to construct_agent."""
        params = _make_params(model="openai:gpt-4o")
        ctx = _make_service_context()
        expected_key = "sk-resolved-key"

        with (
            patch(_PATCHES["settings_repo"]) as MockRepo,
            patch(_PATCHES["resolve_api_key"], return_value=expected_key),
            patch(
                _PATCHES["prepare_memory"],
                new_callable=AsyncMock,
                return_value=({}, []),
            ),
            patch(
                _PATCHES["construct_agent"], new_callable=AsyncMock
            ) as mock_construct,
            patch(_PATCHES["init_backend"]),
        ):
            instance = MockRepo.return_value
            instance._get_or_create = AsyncMock(
                return_value=FakeSettings(default_model=None)
            )
            instance._decrypt_keys = MagicMock(return_value={"openai": expected_key})

            mock_construct.return_value = _mock_agent("openai:gpt-4o")

            from src.workers.tasks import _execute_agent_stream

            await _execute_agent_stream(
                params=params,
                config={"configurable": {"thread_id": "t1"}},
                files_map={},
                todos_list=[],
                service_context=ctx,
                checkpointer=MagicMock(),
                user_id="user-1",
                thread_id="t1",
                stream_key="agent:stream:t1",
                redis_client=_mock_redis(),
            )

            call_kwargs = mock_construct.call_args[1]
            assert call_kwargs["api_key"] == expected_key

    @pytest.mark.asyncio
    async def test_unauthenticated_user_gets_system_default(self):
        """When user_id is empty, DEFAULT_CHAT_MODEL should be used with no api_key."""
        params = _make_params(model="")
        ctx = _make_service_context(user_id="")

        with (
            patch(
                _PATCHES["prepare_memory"],
                new_callable=AsyncMock,
                return_value=({}, []),
            ),
            patch(
                _PATCHES["construct_agent"], new_callable=AsyncMock
            ) as mock_construct,
            patch(_PATCHES["init_backend"]),
        ):
            mock_construct.return_value = _mock_agent(DEFAULT_CHAT_MODEL)

            from src.workers.tasks import _execute_agent_stream

            await _execute_agent_stream(
                params=params,
                config={"configurable": {"thread_id": "t1"}},
                files_map={},
                todos_list=[],
                service_context=ctx,
                checkpointer=MagicMock(),
                user_id="",
                thread_id="t1",
                stream_key="agent:stream:t1",
                redis_client=_mock_redis(),
            )

            call_kwargs = mock_construct.call_args[1]
            assert call_kwargs["model"] == DEFAULT_CHAT_MODEL
            assert call_kwargs["api_key"] is None
