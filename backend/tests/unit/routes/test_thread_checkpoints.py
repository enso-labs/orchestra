"""Unit tests for checkpoint history routes in thread.py."""

import unittest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import HTTPException, status

from src.schemas.entities.checkpoint import (
    ForkCheckpointResponse,
    ThreadCheckpointSummary,
)
from src.schemas.models import ProtectedUser


def make_mock_user():
    return ProtectedUser(
        id="test-user-123",
        email="test@example.com",
        username="testuser",
        name="Test User",
        created_at=datetime.now(),
    )


class TestThreadCheckpointRoutes(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.user = make_mock_user()
        self.store = MagicMock()
        self.context_manager = MagicMock()
        self.checkpointer = MagicMock()
        self.context_manager.__aenter__ = AsyncMock(return_value=self.checkpointer)
        self.context_manager.__aexit__ = AsyncMock(return_value=None)
        self.thread = MagicMock()
        self.thread.head_checkpoint_id = "cp-head"

    async def test_list_thread_checkpoints_returns_summaries(self):
        from src.routes.v0.thread import list_thread_checkpoints

        summary = ThreadCheckpointSummary(
            checkpoint_id="cp-head",
            created_at="2026-03-08T12:00:00Z",
            has_files=False,
            has_todos=False,
            has_interrupts=False,
            is_restorable=True,
            is_head=True,
        )

        with (
            patch("src.routes.v0.thread.get_checkpoint_db", return_value=self.context_manager),
            patch("src.routes.v0.thread.ServiceContext") as mock_service_context_cls,
            patch("src.routes.v0.thread._build_checkpoint_service") as mock_build_checkpoint_service,
        ):
            mock_service_context = MagicMock()
            mock_service_context.thread_service.get = AsyncMock(return_value=self.thread)
            mock_service_context_cls.return_value = mock_service_context

            checkpoint_service = MagicMock()
            checkpoint_service.list_checkpoint_summaries = AsyncMock(return_value=[summary])
            mock_build_checkpoint_service.return_value = checkpoint_service

            result = await list_thread_checkpoints("thread-123", 20, None, self.user, self.store)

            self.assertEqual(len(result.checkpoints), 1)
            self.assertEqual(result.checkpoints[0].checkpoint_id, "cp-head")
            checkpoint_service.list_checkpoint_summaries.assert_awaited_once()

    async def test_get_thread_checkpoint_returns_404_when_missing(self):
        from src.routes.v0.thread import get_thread_checkpoint

        with (
            patch("src.routes.v0.thread.get_checkpoint_db", return_value=self.context_manager),
            patch("src.routes.v0.thread.ServiceContext") as mock_service_context_cls,
            patch("src.routes.v0.thread._build_checkpoint_service") as mock_build_checkpoint_service,
        ):
            mock_service_context = MagicMock()
            mock_service_context.thread_service.get = AsyncMock(return_value=self.thread)
            mock_service_context_cls.return_value = mock_service_context

            checkpoint_service = MagicMock()
            checkpoint_service.get_checkpoint_detail = AsyncMock(return_value=None)
            mock_build_checkpoint_service.return_value = checkpoint_service

            with self.assertRaises(HTTPException) as context:
                await get_thread_checkpoint("thread-123", "cp-missing", self.user, self.store)

            self.assertEqual(context.exception.status_code, status.HTTP_404_NOT_FOUND)

    async def test_fork_thread_checkpoint_returns_fork_response(self):
        from src.routes.v0.thread import fork_thread_checkpoint

        fork_response = ForkCheckpointResponse(
            thread_id="fork-123",
            head_checkpoint_id="fork-cp-1",
            source_thread_id="thread-123",
            source_checkpoint_id="cp-1",
        )

        with (
            patch("src.routes.v0.thread.get_checkpoint_db", return_value=self.context_manager),
            patch("src.routes.v0.thread.ServiceContext") as mock_service_context_cls,
            patch("src.routes.v0.thread._build_checkpoint_service") as mock_build_checkpoint_service,
        ):
            mock_service_context = MagicMock()
            mock_service_context.thread_service.get = AsyncMock(return_value=self.thread)
            mock_service_context_cls.return_value = mock_service_context

            checkpoint_service = MagicMock()
            checkpoint_service.fork_checkpoint = AsyncMock(return_value=fork_response)
            mock_build_checkpoint_service.return_value = checkpoint_service

            result = await fork_thread_checkpoint("thread-123", "cp-1", MagicMock(title=None), self.user, self.store)

            self.assertEqual(result.thread_id, "fork-123")
            checkpoint_service.fork_checkpoint.assert_awaited_once()

    async def test_fork_thread_checkpoint_returns_409_for_non_restorable_checkpoint(self):
        from src.routes.v0.thread import fork_thread_checkpoint

        with (
            patch("src.routes.v0.thread.get_checkpoint_db", return_value=self.context_manager),
            patch("src.routes.v0.thread.ServiceContext") as mock_service_context_cls,
            patch("src.routes.v0.thread._build_checkpoint_service") as mock_build_checkpoint_service,
        ):
            mock_service_context = MagicMock()
            mock_service_context.thread_service.get = AsyncMock(return_value=self.thread)
            mock_service_context_cls.return_value = mock_service_context

            checkpoint_service = MagicMock()
            checkpoint_service.fork_checkpoint = AsyncMock(side_effect=ValueError("Checkpoint is not restorable"))
            mock_build_checkpoint_service.return_value = checkpoint_service

            with self.assertRaises(HTTPException) as context:
                await fork_thread_checkpoint("thread-123", "cp-1", MagicMock(title=None), self.user, self.store)

            self.assertEqual(context.exception.status_code, status.HTTP_409_CONFLICT)
