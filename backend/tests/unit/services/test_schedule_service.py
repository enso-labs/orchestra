"""Tests for scheduled_llm_invoke TaskIQ dispatch path."""

from unittest.mock import AsyncMock, patch, MagicMock
from uuid import UUID

import pytest

pytest.importorskip("taskiq_redis", reason="taskiq-redis not installed (distributed extra)")

from src.services.schedule import scheduled_llm_invoke


@pytest.fixture
def task_dict_with_thread_id():
    return {
        "input": {"messages": [{"role": "user", "content": "hello"}]},
        "metadata": {"thread_id": "existing-thread-id", "user_id": "user-1"},
        "model": "gpt-4",
    }


@pytest.fixture
def task_dict_without_thread_id():
    return {
        "input": {"messages": [{"role": "user", "content": "hello"}]},
        "metadata": {"user_id": "user-1"},
        "model": "gpt-4",
    }


@pytest.fixture
def task_dict_no_metadata():
    return {
        "input": {"messages": [{"role": "user", "content": "hello"}]},
        "model": "gpt-4",
    }


def _patch_distributed(enabled: bool):
    """Patch DISTRIBUTED_WORKERS at the import target inside scheduled_llm_invoke."""
    # The function does `from src.constants import DISTRIBUTED_WORKERS`
    # We patch the module so the import gets our value
    return patch("src.constants.DISTRIBUTED_WORKERS", enabled)


def _patch_taskiq():
    """Patch run_agent_stream with a mock that has an async kiq."""
    mock_task = MagicMock()
    mock_task.kiq = AsyncMock()
    return patch("src.workers.tasks.run_agent_stream", mock_task), mock_task


@pytest.mark.asyncio
async def test_dispatch_to_taskiq_when_distributed(task_dict_with_thread_id):
    """When DISTRIBUTED_WORKERS=true, should dispatch to run_agent_stream.kiq()."""
    patcher, mock_task = _patch_taskiq()
    with _patch_distributed(True), patcher:
        await scheduled_llm_invoke(
            task_dict=task_dict_with_thread_id,
            user_id="user-1",
            title="Test Job",
        )

    mock_task.kiq.assert_called_once_with(
        task_dict=task_dict_with_thread_id,
        user_id="user-1",
        thread_id="existing-thread-id",
    )


@pytest.mark.asyncio
async def test_in_process_when_not_distributed(task_dict_with_thread_id):
    """When DISTRIBUTED_WORKERS=false, should NOT call TaskIQ."""
    patcher, mock_task = _patch_taskiq()
    with _patch_distributed(False), patcher:
        # The in-process path will raise due to missing full env setup,
        # but we verify kiq was NOT called
        try:
            await scheduled_llm_invoke(
                task_dict=task_dict_with_thread_id,
                user_id="user-1",
                title="Test Job",
            )
        except Exception:
            pass  # Expected - in-process path needs full environment

    mock_task.kiq.assert_not_called()


@pytest.mark.asyncio
async def test_thread_id_from_metadata(task_dict_with_thread_id):
    """thread_id should be extracted from metadata when present."""
    patcher, mock_task = _patch_taskiq()
    with _patch_distributed(True), patcher:
        await scheduled_llm_invoke(
            task_dict=task_dict_with_thread_id,
            user_id="user-1",
            title="Test Job",
        )

    call_kwargs = mock_task.kiq.call_args[1]
    assert call_kwargs["thread_id"] == "existing-thread-id"


@pytest.mark.asyncio
async def test_thread_id_generated_when_missing(task_dict_without_thread_id):
    """thread_id should be a generated UUID when not in metadata."""
    patcher, mock_task = _patch_taskiq()
    with _patch_distributed(True), patcher:
        await scheduled_llm_invoke(
            task_dict=task_dict_without_thread_id,
            user_id="user-1",
            title="Test Job",
        )

    call_kwargs = mock_task.kiq.call_args[1]
    # Should be a valid UUID string
    UUID(call_kwargs["thread_id"])


@pytest.mark.asyncio
async def test_thread_id_generated_when_no_metadata(task_dict_no_metadata):
    """thread_id should be a generated UUID when metadata is missing entirely."""
    patcher, mock_task = _patch_taskiq()
    with _patch_distributed(True), patcher:
        await scheduled_llm_invoke(
            task_dict=task_dict_no_metadata,
            user_id="user-1",
            title="Test Job",
        )

    call_kwargs = mock_task.kiq.call_args[1]
    UUID(call_kwargs["thread_id"])
