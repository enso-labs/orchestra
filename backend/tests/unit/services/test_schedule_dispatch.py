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
    mock_kiq = AsyncMock()
    mock_task = MagicMock()
    mock_task.kiq = mock_kiq

    with (
        patch("src.workers.tasks.run_agent_stream", mock_task),
        patch("src.schemas.entities.LLMRequest") as mock_req,
        patch("src.agents.construct_agent") as mock_construct,
        patch("src.agents.init_config") as mock_init_config,
        patch("src.services.db.get_checkpoint_db") as mock_cp,
        patch("src.services.db.get_store_db") as mock_store,
        patch("src.contexts.service.ServiceContext") as mock_ctx,
    ):
        mock_init_config.return_value = {"metadata": {}, "configurable": {}}
        mock_params = MagicMock()
        mock_params.metadata.thread_id = "t1"
        mock_params.metadata.user_id = "u1"
        mock_params.input.messages = [MagicMock()]
        mock_req.return_value = mock_params

        mock_agent = AsyncMock()
        mock_agent.model = "gpt-4"
        mock_agent.invoke = AsyncMock(return_value={"files": {}, "todos": []})
        mock_agent.graph.aget_state = AsyncMock(
            return_value=MagicMock(
                config={"configurable": {}},
                values={"messages": [MagicMock(model="gpt-4")]},
            )
        )
        mock_construct.return_value = mock_agent

        mock_store_instance = MagicMock()
        mock_cp_instance = MagicMock()
        mock_store.return_value.__aenter__ = AsyncMock(return_value=mock_store_instance)
        mock_store.return_value.__aexit__ = AsyncMock(return_value=False)
        mock_cp.return_value.__aenter__ = AsyncMock(return_value=mock_cp_instance)
        mock_cp.return_value.__aexit__ = AsyncMock(return_value=False)

        mock_svc_ctx = MagicMock()
        mock_svc_ctx.user_id = "u1"
        mock_svc_ctx.checkpointer = mock_cp_instance
        mock_svc_ctx.llm_service.assistant = AsyncMock(return_value=mock_params)
        mock_svc_ctx.thread_service.update = AsyncMock()
        mock_svc_ctx.thread_service.update_checkpoint_snapshot = AsyncMock()
        mock_svc_ctx.thread_service.get = AsyncMock(return_value=None)
        mock_svc_ctx.store = mock_store_instance
        mock_svc_ctx.store.fields = []
        mock_ctx.return_value = mock_svc_ctx

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
