"""Regression tests for ServiceContext.delete_thread.

Pins the contract that fixes the "unable to delete a thread" bug: the DELETE
route returned 204 while the thread persisted because delete_thread deleted
checkpoints first, aborted on checkpoint-cleanup failure, and swallowed the
exception (returning it instead of raising) — so the thread-store delete never
ran and the route still reported success.

Corrected contract:
  * the thread record is deleted first and is the gating operation
  * checkpoint cleanup is best-effort (a failure must not resurrect the thread)
  * a genuine thread-delete failure propagates so the route returns an error
"""

from unittest.mock import AsyncMock

import pytest

from src.contexts.service import ServiceContext


def _context(*, thread_deleted=True, checkpoint="ok"):
    """Build a bare ServiceContext with mocked sub-services (no DB / no __init__)."""
    ctx = ServiceContext.__new__(ServiceContext)
    ctx.thread_service = AsyncMock()
    ctx.thread_service.delete = AsyncMock(return_value=thread_deleted)
    ctx.checkpoint_service = AsyncMock()
    if checkpoint == "raise":
        ctx.checkpoint_service.delete_checkpoints_for_thread = AsyncMock(side_effect=NotImplementedError())
    elif checkpoint == "false":
        ctx.checkpoint_service.delete_checkpoints_for_thread = AsyncMock(return_value=False)
    else:
        ctx.checkpoint_service.delete_checkpoints_for_thread = AsyncMock(return_value=True)
    return ctx


@pytest.mark.asyncio
async def test_happy_path_deletes_thread_then_checkpoints():
    ctx = _context()
    assert await ctx.delete_thread("t1") is True
    ctx.thread_service.delete.assert_awaited_once_with("t1")
    ctx.checkpoint_service.delete_checkpoints_for_thread.assert_awaited_once_with("t1")


@pytest.mark.asyncio
async def test_thread_deleted_even_when_checkpoint_cleanup_raises():
    # A checkpoint-cleanup failure must not abort the thread deletion.
    ctx = _context(checkpoint="raise")
    assert await ctx.delete_thread("t1") is True
    ctx.thread_service.delete.assert_awaited_once_with("t1")


@pytest.mark.asyncio
async def test_thread_deleted_when_checkpoint_cleanup_returns_false():
    ctx = _context(checkpoint="false")
    assert await ctx.delete_thread("t1") is True
    ctx.thread_service.delete.assert_awaited_once_with("t1")


@pytest.mark.asyncio
async def test_raises_when_thread_record_delete_fails():
    ctx = _context(thread_deleted=False)
    with pytest.raises(ValueError):
        await ctx.delete_thread("t1")
    # Checkpoint cleanup must not run if the thread record could not be deleted.
    ctx.checkpoint_service.delete_checkpoints_for_thread.assert_not_awaited()


@pytest.mark.asyncio
async def test_works_without_checkpoint_service():
    ctx = _context()
    del ctx.checkpoint_service
    assert await ctx.delete_thread("t1") is True
    ctx.thread_service.delete.assert_awaited_once_with("t1")
