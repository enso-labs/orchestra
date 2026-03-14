"""Tests for scheduled_llm_invoke TaskIQ dispatch logic."""

from unittest.mock import AsyncMock, patch, MagicMock
from uuid import UUID

import pytest

from src.services.schedule import scheduled_llm_invoke


@pytest.fixture
def task_dict_with_thread():
    return {
        "model": "gpt-4",
        "metadata": {"thread_id": "existing-thread-id", "user_id": "u1"},
        "input": {"messages": [{"role": "user", "content": "hello"}]},
    }


@pytest.fixture
def task_dict_without_thread():
    return {
        "model": "gpt-4",
        "metadata": {},
        "input": {"messages": [{"role": "user", "content": "hello"}]},
    }


@pytest.mark.asyncio
@patch("src.constants.DISTRIBUTED_WORKERS", True)
async def test_dispatches_to_taskiq_when_distributed(task_dict_with_thread):
    """When DISTRIBUTED_WORKERS=true, run_agent_stream.kiq() is called."""
    mock_kiq = AsyncMock()
    mock_task = MagicMock()
    mock_task.kiq = mock_kiq

    with patch("src.workers.tasks.run_agent_stream", mock_task):
        await scheduled_llm_invoke(task_dict=task_dict_with_thread, user_id="u1", title="test job")

    mock_kiq.assert_called_once_with(
        task_dict=task_dict_with_thread,
        user_id="u1",
        thread_id="existing-thread-id",
    )


@pytest.mark.asyncio
@patch("src.constants.DISTRIBUTED_WORKERS", False)
async def test_in_process_when_not_distributed(task_dict_with_thread):
    """When DISTRIBUTED_WORKERS=false, the in-process path runs (not kiq)."""
    from contextlib import asynccontextmanager

    mock_kiq = AsyncMock()
    mock_task = MagicMock()
    mock_task.kiq = mock_kiq

    mock_agent = AsyncMock()
    mock_agent.model = "gpt-4"
    mock_agent.invoke = AsyncMock(return_value={"files": {}, "todos": []})
    mock_agent.graph.aget_state = AsyncMock(
        return_value=MagicMock(
            config={"configurable": {}},
            values={"messages": [MagicMock(model="gpt-4")]},
        )
    )

    mock_svc_ctx = MagicMock()
    mock_svc_ctx.user_id = "u1"
    mock_svc_ctx.checkpointer = MagicMock()
    mock_svc_ctx.memory_service = MagicMock()
    mock_svc_ctx.thread_service.update = AsyncMock()
    mock_svc_ctx.store = MagicMock()
    mock_svc_ctx.store.fields = []

    # The assistant side_effect must replace the last message with something
    # that supports .model assignment (ChatMessage is a strict pydantic model).
    async def _assistant(params):
        params.input.messages[-1] = MagicMock(model=None)
        return params

    mock_svc_ctx.llm_service.assistant = AsyncMock(side_effect=_assistant)

    @asynccontextmanager
    async def fake_store_db():
        yield MagicMock()

    @asynccontextmanager
    async def fake_checkpoint_db():
        yield MagicMock()

    with (
        patch("src.workers.tasks.run_agent_stream", mock_task),
        patch("src.services.db.get_store_db", fake_store_db),
        patch("src.services.db.get_checkpoint_db", fake_checkpoint_db),
        patch("src.contexts.service.ServiceContext", return_value=mock_svc_ctx),
        patch("src.agents.init_config", return_value={"metadata": {}, "configurable": {}}),
        patch("src.agents.construct_agent", AsyncMock(return_value=mock_agent)),
        patch("src.agents.prepare_memory_files", AsyncMock(return_value=({}, []))),
        patch("src.services.context_files.resolve_context_files", AsyncMock(return_value={})),
    ):
        await scheduled_llm_invoke(task_dict=task_dict_with_thread, user_id="u1", title="test")

    mock_kiq.assert_not_called()


@pytest.mark.asyncio
@patch("src.constants.DISTRIBUTED_WORKERS", True)
async def test_extracts_thread_id_from_metadata(task_dict_with_thread):
    """thread_id is extracted from task_dict metadata when present."""
    mock_kiq = AsyncMock()
    mock_task = MagicMock()
    mock_task.kiq = mock_kiq

    with patch("src.workers.tasks.run_agent_stream", mock_task):
        await scheduled_llm_invoke(task_dict=task_dict_with_thread, user_id="u1", title="test")

    call_kwargs = mock_kiq.call_args.kwargs
    assert call_kwargs["thread_id"] == "existing-thread-id"


@pytest.mark.asyncio
@patch("src.constants.DISTRIBUTED_WORKERS", True)
async def test_generates_uuid_when_no_thread_id(task_dict_without_thread):
    """thread_id is generated as UUID when not present in metadata."""
    mock_kiq = AsyncMock()
    mock_task = MagicMock()
    mock_task.kiq = mock_kiq

    with patch("src.workers.tasks.run_agent_stream", mock_task):
        await scheduled_llm_invoke(task_dict=task_dict_without_thread, user_id="u1", title="test")

    call_kwargs = mock_kiq.call_args.kwargs
    UUID(call_kwargs["thread_id"])  # Raises ValueError if not valid UUID
    assert call_kwargs["thread_id"] != ""
