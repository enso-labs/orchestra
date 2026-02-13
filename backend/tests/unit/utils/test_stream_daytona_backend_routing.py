from unittest.mock import AsyncMock, MagicMock, patch

import pytest

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
    mock_prepare_memory_files.return_value = ({}, [])
    mock_construct_agent.return_value = _FakeAgent()

    # Force Daytona creation failure to validate fallback notice path.
    mock_create_daytona_backend.return_value = (MagicMock(), None)
    mock_init_backend.return_value = MagicMock()

    service_context = MagicMock()
    service_context.user_id = "user-1"
    service_context.memory_service = MagicMock()
    service_context.store = MagicMock()
    service_context.thread_service.update = AsyncMock()

    input_obj = MagicMock()
    input_obj.files = {}
    input_obj.messages = [MagicMock()]

    config = {"metadata": {}, "configurable": {"thread_id": "t1"}}

    events = [
        event
        async for event in stream_generator(
            input=input_obj,
            model="openai/gpt-4o-mini",
            system_prompt="sys",
            tools=[],
            subagents=[],
            config=config,
            service_context=service_context,
            sandbox_backend="daytona",
            api_key="key-1",
        )
    ]

    mock_create_daytona_backend.assert_called_once_with(api_key="key-1")
    assert any("falling back to default sandbox" in event for event in events)


@pytest.mark.asyncio
@patch("src.utils.stream.get_checkpoint_db", return_value=_DummyCheckpointCtx())
@patch("src.utils.stream.prepare_memory_files", new_callable=AsyncMock)
@patch("src.utils.stream.construct_agent", new_callable=AsyncMock)
@patch("src.utils.stream.init_backend")
@patch("src.utils.stream.create_daytona_backend")
async def test_stream_generator_uses_daytona_backend_when_selected(
    mock_create_daytona_backend,
    mock_init_backend,
    mock_construct_agent,
    mock_prepare_memory_files,
    _mock_get_checkpoint_db,
):
    mock_prepare_memory_files.return_value = ({}, [])
    mock_construct_agent.return_value = _FakeAgent()

    daytona_sandbox = MagicMock()
    daytona_backend = MagicMock()
    mock_create_daytona_backend.return_value = (daytona_sandbox, daytona_backend)

    service_context = MagicMock()
    service_context.user_id = "user-1"
    service_context.memory_service = MagicMock()
    service_context.store = MagicMock()
    service_context.thread_service.update = AsyncMock()

    input_obj = MagicMock()
    input_obj.files = {}
    input_obj.messages = [MagicMock()]

    config = {"metadata": {}, "configurable": {"thread_id": "t1"}}

    _ = [
        event
        async for event in stream_generator(
            input=input_obj,
            model="openai/gpt-4o-mini",
            system_prompt="sys",
            tools=[],
            subagents=[],
            config=config,
            service_context=service_context,
            sandbox_backend="daytona",
            api_key="key-1",
        )
    ]

    mock_create_daytona_backend.assert_called_once_with(api_key="key-1")
    mock_init_backend.assert_not_called()
    daytona_sandbox.stop.assert_called_once()


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
    mock_prepare_memory_files.return_value = ({}, [])
    mock_construct_agent.return_value = _FakeAgent()
    mock_init_backend.return_value = MagicMock()

    service_context = MagicMock()
    service_context.user_id = "user-1"
    service_context.memory_service = MagicMock()
    service_context.store = MagicMock()
    service_context.thread_service.update = AsyncMock()

    input_obj = MagicMock()
    input_obj.files = {}
    input_obj.messages = [MagicMock()]

    config = {"metadata": {}, "configurable": {"thread_id": "t1"}}

    _ = [
        event
        async for event in stream_generator(
            input=input_obj,
            model="openai/gpt-4o-mini",
            system_prompt="sys",
            tools=[],
            subagents=[],
            config=config,
            service_context=service_context,
            sandbox_backend=None,
            api_key="key-1",
        )
    ]

    mock_create_daytona_backend.assert_not_called()
    mock_init_backend.assert_called_once()
