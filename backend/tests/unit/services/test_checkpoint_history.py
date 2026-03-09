"""Unit tests for checkpoint history and forking service methods."""

import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from langgraph.checkpoint.base import CheckpointTuple

from src.services.checkpoint import CheckpointService
from src.schemas.entities.store import Thread


class TestCheckpointHistory(unittest.IsolatedAsyncioTestCase):
    def _make_checkpoint_tuple(self, checkpoint_id: str = "cp-1") -> CheckpointTuple:
        return CheckpointTuple(
            config={"configurable": {"thread_id": "thread-123", "checkpoint_id": checkpoint_id}},
            checkpoint={
                "id": checkpoint_id,
                "ts": "2026-03-08T12:00:00Z",
                "channel_values": {
                    "messages": [{"id": "msg-1", "type": "human", "content": "Hello", "model": "openai:gpt-4.1-mini"}],
                    "files": {"notes.md": {"content": ["Hello"]}},
                    "todos": [{"content": "Ship it", "status": "completed"}],
                },
                "pending_sends": [],
            },
            metadata={"source": "input"},
            parent_config=None,
            pending_writes=[],
        )

    async def test_is_restorable_false_when_interrupts_present(self):
        service = CheckpointService()
        checkpoint_tuple = self._make_checkpoint_tuple()
        state = SimpleNamespace(interrupts=["interrupt"], tasks=[], next=[])

        self.assertFalse(service.is_restorable(checkpoint_tuple, state=state))

    async def test_get_checkpoint_detail_returns_normalized_payload(self):
        checkpoint_tuple = self._make_checkpoint_tuple()
        state = SimpleNamespace(
            values={
                "files": {"notes.md": {"content": ["Hello"]}},
                "todos": [{"content": "Ship it", "status": "completed"}],
            },
            interrupts=[],
            tasks=[],
            next=[],
        )

        service = CheckpointService(graph=MagicMock())
        service._get_checkpoint_tuple = AsyncMock(return_value=checkpoint_tuple)
        service._get_state_snapshot = AsyncMock(return_value=state)

        detail = await service.get_checkpoint_detail("thread-123", "cp-1")

        self.assertEqual(detail.checkpoint_id, "cp-1")
        self.assertEqual(detail.source, "input")
        self.assertEqual(detail.messages[0]["content"], "Hello")
        self.assertTrue(detail.is_restorable)
        self.assertIn("notes.md", detail.files)

    async def test_fork_checkpoint_creates_new_thread_head(self):
        checkpoint_tuple = self._make_checkpoint_tuple()
        state = SimpleNamespace(
            values={
                "messages": [{"id": "msg-1", "type": "human", "content": "Hello"}],
                "files": {"notes.md": {"content": ["Hello"]}},
                "todos": [{"content": "Ship it", "status": "completed"}],
            },
            interrupts=[],
            tasks=[],
            next=[],
        )
        graph = MagicMock()
        graph.aupdate_state = AsyncMock(
            return_value={"configurable": {"thread_id": "fork-123", "checkpoint_id": "fork-cp-1"}}
        )

        service = CheckpointService(
            user_id="user-123",
            graph=graph,
            store=MagicMock(),
        )
        service._get_checkpoint_tuple = AsyncMock(return_value=checkpoint_tuple)
        service._get_state_snapshot = AsyncMock(return_value=state)
        service.thread_service.update = AsyncMock(return_value=True)

        with patch("src.services.checkpoint.uuid4", return_value="fork-123"):
            response = await service.fork_checkpoint(
                thread_id="thread-123",
                checkpoint_id="cp-1",
                user_id="user-123",
                source_thread=Thread(
                    id="thread-123",
                    title="Source thread",
                    assistant_id="assistant-123",
                    project_id="project-123",
                ),
                title="Forked title",
            )

        self.assertEqual(response.thread_id, "fork-123")
        self.assertEqual(response.head_checkpoint_id, "fork-cp-1")
        graph.aupdate_state.assert_awaited_once()
        service.thread_service.update.assert_awaited_once()
