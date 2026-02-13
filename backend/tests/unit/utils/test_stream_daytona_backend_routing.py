import ujson
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.agents.daytona import daytona_fallback_message
from src.utils.stream import stream_generator


class _DummyCheckpointCtx:
    async def __aenter__(self):
        return object()

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _FakeAgent:
    def __init__(self):
        self.model = "openai/gpt-4o-mini"
        self.graph = MagicMock()
        self.graph.aget_state = AsyncMock(
            return_value=MagicMock(
                config={"configurable": {}},
                values={"messages": []},
            )
        )

    async def astream(self, *_args, **_kwargs):
        if False:
            yield None


def _build_service_context():
    ctx = MagicMock()
    ctx.user_id = "user-1"
    ctx.memory_service = MagicMock()
    ctx.store = MagicMock()
    ctx.thread_service.update = AsyncMock()
    return ctx


def _build_input():
    inp = MagicMock()
    inp.files = {}
    inp.messages = [MagicMock()]
    return inp


def _default_config(**overrides):
    cfg = {
        "metadata": {},
        "configurable": {"thread_id": "t1", "assistant_id": "a1", "project_id": "p1"},
    }
    cfg.update(overrides)
    return cfg


@pytest.mark.asyncio
@patch("src.utils.stream.get_checkpoint_db", return_value=_DummyCheckpointCtx())
@patch("src.utils.stream.prepare_memory_files", new_callable=AsyncMock)
@patch("src.utils.stream.construct_agent", new_callable=AsyncMock)
@patch("src.utils.stream.init_backend")
@patch("src.utils.stream.create_daytona_backend")
async def test_stream_generator_uses_settings_driven_daytona_and_falls_back_with_notice(
    mock_create_daytona_backend,
    mock_init_backend,
    mock_construct_agent,
    mock_prepare_memory_files,
    _mock_get_checkpoint_db,
):
    """When Daytona backend lacks execute(), stream falls back with standardized SSE notice."""
    mock_prepare_memory_files.return_value = ({}, [])
    mock_construct_agent.return_value = _FakeAgent()

    # Force Daytona creation to return a backend without execute (None backend).
    mock_create_daytona_backend.return_value = (MagicMock(), None)
    mock_init_backend.return_value = MagicMock()

    events = [
        event
        async for event in stream_generator(
            input=_build_input(),
            model="openai/gpt-4o-mini",
            system_prompt="sys",
            tools=[],
            subagents=[],
            config=_default_config(),
            service_context=_build_service_context(),
            sandbox_backend="daytona",
            api_key="key-1",
        )
    ]

    mock_create_daytona_backend.assert_called_once_with(api_key="key-1")

    # Fallback event must use the standardized message from daytona_fallback_message()
    fallback_events = [e for e in events if "falling back to default sandbox" in e]
    assert len(fallback_events) == 1
    parsed = ujson.loads(fallback_events[0].removeprefix("data: ").strip())
    assert parsed[0] == "system"
    assert daytona_fallback_message("") != parsed[1]  # has a real reason, not empty

    # Default backend used as fallback
    mock_init_backend.assert_called_once()


@pytest.mark.asyncio
@patch("src.utils.stream.get_checkpoint_db", return_value=_DummyCheckpointCtx())
@patch("src.utils.stream.prepare_memory_files", new_callable=AsyncMock)
@patch("src.utils.stream.construct_agent", new_callable=AsyncMock)
@patch("src.utils.stream.init_backend")
@patch("src.utils.stream.create_daytona_backend")
async def test_stream_generator_uses_daytona_backend_when_execute_supported(
    mock_create_daytona_backend,
    mock_init_backend,
    mock_construct_agent,
    mock_prepare_memory_files,
    _mock_get_checkpoint_db,
):
    """When Daytona backend has execute(), stream uses it and cleans up sandbox."""
    mock_prepare_memory_files.return_value = ({}, [])
    mock_construct_agent.return_value = _FakeAgent()

    daytona_sandbox = MagicMock()
    daytona_backend = MagicMock()
    # MagicMock has callable execute attr by default → validation passes
    mock_create_daytona_backend.return_value = (daytona_sandbox, daytona_backend)

    events = [
        event
        async for event in stream_generator(
            input=_build_input(),
            model="openai/gpt-4o-mini",
            system_prompt="sys",
            tools=[],
            subagents=[],
            config=_default_config(),
            service_context=_build_service_context(),
            sandbox_backend="daytona",
            api_key="key-1",
        )
    ]

    mock_create_daytona_backend.assert_called_once_with(api_key="key-1")
    mock_init_backend.assert_not_called()
    daytona_sandbox.stop.assert_called_once()

    # No fallback events emitted
    assert not any("falling back" in e for e in events)


@pytest.mark.asyncio
@patch("src.utils.stream.get_checkpoint_db", return_value=_DummyCheckpointCtx())
@patch("src.utils.stream.prepare_memory_files", new_callable=AsyncMock)
@patch("src.utils.stream.construct_agent", new_callable=AsyncMock)
@patch("src.utils.stream.init_backend")
@patch("src.utils.stream.create_daytona_backend")
async def test_stream_generator_keeps_default_backend_when_setting_unset(
    mock_create_daytona_backend,
    mock_init_backend,
    mock_construct_agent,
    mock_prepare_memory_files,
    _mock_get_checkpoint_db,
):
    """When sandbox_backend is None, Daytona is never attempted."""
    mock_prepare_memory_files.return_value = ({}, [])
    mock_construct_agent.return_value = _FakeAgent()
    mock_init_backend.return_value = MagicMock()

    _ = [
        event
        async for event in stream_generator(
            input=_build_input(),
            model="openai/gpt-4o-mini",
            system_prompt="sys",
            tools=[],
            subagents=[],
            config=_default_config(),
            service_context=_build_service_context(),
            sandbox_backend=None,
            api_key="key-1",
        )
    ]

    mock_create_daytona_backend.assert_not_called()
    mock_init_backend.assert_called_once()


@pytest.mark.asyncio
@patch("src.utils.stream.get_checkpoint_db", return_value=_DummyCheckpointCtx())
@patch("src.utils.stream.prepare_memory_files", new_callable=AsyncMock)
@patch("src.utils.stream.construct_agent", new_callable=AsyncMock)
@patch("src.utils.stream.init_backend")
@patch("src.utils.stream.create_daytona_backend")
async def test_stream_generator_emits_metadata_and_done_events(
    mock_create_daytona_backend,
    mock_init_backend,
    mock_construct_agent,
    mock_prepare_memory_files,
    _mock_get_checkpoint_db,
):
    """Metadata event with thread/assistant/project IDs is first, [DONE] is last."""
    mock_prepare_memory_files.return_value = ({}, [])
    mock_construct_agent.return_value = _FakeAgent()
    mock_init_backend.return_value = MagicMock()

    config = _default_config()
    events = [
        event
        async for event in stream_generator(
            input=_build_input(),
            model="openai/gpt-4o-mini",
            system_prompt="sys",
            tools=[],
            subagents=[],
            config=config,
            service_context=_build_service_context(),
            sandbox_backend=None,
        )
    ]

    # Metadata event is first data event
    metadata_event = events[0]
    parsed = ujson.loads(metadata_event.removeprefix("data: ").strip())
    assert parsed[0] == "metadata"
    assert parsed[1]["thread_id"] == "t1"
    assert parsed[1]["assistant_id"] == "a1"
    assert parsed[1]["project_id"] == "p1"

    # [DONE] is the terminal event
    assert events[-1].strip() == "data: [DONE]"


@pytest.mark.asyncio
@patch("src.utils.stream.get_checkpoint_db", return_value=_DummyCheckpointCtx())
@patch("src.utils.stream.prepare_memory_files", new_callable=AsyncMock)
@patch("src.utils.stream.construct_agent", new_callable=AsyncMock)
@patch("src.utils.stream.init_backend")
@patch("src.utils.stream.create_daytona_backend")
async def test_stream_generator_cleanup_skipped_when_no_sandbox(
    mock_create_daytona_backend,
    mock_init_backend,
    mock_construct_agent,
    mock_prepare_memory_files,
    _mock_get_checkpoint_db,
):
    """Daytona sandbox.stop() is NOT called when sandbox_backend is not daytona."""
    mock_prepare_memory_files.return_value = ({}, [])
    mock_construct_agent.return_value = _FakeAgent()
    mock_init_backend.return_value = MagicMock()

    _ = [
        event
        async for event in stream_generator(
            input=_build_input(),
            model="openai/gpt-4o-mini",
            system_prompt="sys",
            tools=[],
            subagents=[],
            config=_default_config(),
            service_context=_build_service_context(),
            sandbox_backend=None,
        )
    ]

    mock_create_daytona_backend.assert_not_called()
