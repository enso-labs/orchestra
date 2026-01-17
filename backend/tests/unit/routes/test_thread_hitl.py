"""Unit tests for HITL (Human-in-the-Loop) route endpoints in thread.py.

These tests verify HTTP status codes and response formats for the HITL endpoints
without requiring a database connection or real authentication.
"""

import unittest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException, status
from src.schemas.entities.hitl import (
    DecisionType,
    HumanDecision,
    InterruptInfo,
    InterruptConfig,
    InterruptListResponse,
    ResumeRequest,
    ResumeResponse,
)
from src.schemas.models import ProtectedUser
from datetime import datetime


def make_mock_user():
    """Create a mock authenticated user."""
    return ProtectedUser(
        id="test-user-123",
        email="test@example.com",
        username="testuser",
        name="Test User",
        created_at=datetime.now(),
    )


class MockStoreItem:
    """Mock store item returned by thread_service.get()."""

    def __init__(self, value: dict | None = None, exists: bool = True):
        self.value = value or {"title": "Test Thread"}
        self._exists = exists

    def __bool__(self):
        return self._exists


class TestGetThreadInterruptsEndpoint(unittest.IsolatedAsyncioTestCase):
    """Tests for GET /api/threads/{thread_id}/interrupts endpoint logic."""

    async def test_returns_interrupt_data_when_interrupt_exists(self):
        """Test that endpoint returns interrupt data when interrupt exists."""
        from src.routes.v0.thread import get_thread_interrupts

        thread_id = "test-thread-123"
        mock_user = make_mock_user()
        mock_store = MagicMock()

        mock_interrupt = InterruptInfo(
            tool_name="http_request",
            tool_args={"url": "https://example.com", "method": "POST"},
            description="Make an HTTP POST request",
            config=InterruptConfig(
                allowed_actions=[
                    DecisionType.ACCEPT,
                    DecisionType.EDIT,
                    DecisionType.REJECT,
                ]
            ),
        )

        with (
            patch("src.routes.v0.thread.get_checkpoint_db") as mock_get_cp_db,
            patch("src.routes.v0.thread.ServiceContext") as mock_service_context_cls,
            patch("src.routes.v0.thread.graph_builder") as mock_graph_builder,
            patch("src.routes.v0.thread.CheckpointService") as mock_cp_service_cls,
        ):
            # Setup context manager for checkpointer
            mock_checkpointer = MagicMock()
            mock_context_manager = MagicMock()
            mock_context_manager.__aenter__ = AsyncMock(return_value=mock_checkpointer)
            mock_context_manager.__aexit__ = AsyncMock(return_value=None)
            mock_get_cp_db.return_value = mock_context_manager

            # Setup thread service mock to return a thread
            mock_thread = MockStoreItem()
            mock_service_context = MagicMock()
            mock_service_context.thread_service.get = AsyncMock(
                return_value=mock_thread
            )
            mock_service_context_cls.return_value = mock_service_context

            # Setup graph builder mock
            mock_graph = MagicMock()
            mock_graph_builder.return_value = mock_graph

            # Setup checkpoint service mock with interrupts
            mock_cp_service = MagicMock()
            mock_cp_service.get_interrupts = AsyncMock(return_value=[mock_interrupt])
            mock_cp_service_cls.return_value = mock_cp_service

            result = await get_thread_interrupts(thread_id, mock_user, mock_store)

            self.assertIsInstance(result, InterruptListResponse)
            self.assertEqual(result.thread_id, thread_id)
            self.assertTrue(result.has_interrupts)
            self.assertEqual(len(result.interrupts), 1)
            self.assertEqual(result.interrupts[0].tool_name, "http_request")
            self.assertEqual(
                result.interrupts[0].tool_args["url"], "https://example.com"
            )

    async def test_returns_has_interrupts_false_when_none_pending(self):
        """Test that endpoint returns has_interrupts=false when no interrupts exist."""
        from src.routes.v0.thread import get_thread_interrupts

        thread_id = "test-thread-456"
        mock_user = make_mock_user()
        mock_store = MagicMock()

        with (
            patch("src.routes.v0.thread.get_checkpoint_db") as mock_get_cp_db,
            patch("src.routes.v0.thread.ServiceContext") as mock_service_context_cls,
            patch("src.routes.v0.thread.graph_builder") as mock_graph_builder,
            patch("src.routes.v0.thread.CheckpointService") as mock_cp_service_cls,
        ):
            mock_checkpointer = MagicMock()
            mock_context_manager = MagicMock()
            mock_context_manager.__aenter__ = AsyncMock(return_value=mock_checkpointer)
            mock_context_manager.__aexit__ = AsyncMock(return_value=None)
            mock_get_cp_db.return_value = mock_context_manager

            mock_thread = MockStoreItem()
            mock_service_context = MagicMock()
            mock_service_context.thread_service.get = AsyncMock(
                return_value=mock_thread
            )
            mock_service_context_cls.return_value = mock_service_context

            mock_graph = MagicMock()
            mock_graph_builder.return_value = mock_graph

            mock_cp_service = MagicMock()
            mock_cp_service.get_interrupts = AsyncMock(return_value=[])
            mock_cp_service_cls.return_value = mock_cp_service

            result = await get_thread_interrupts(thread_id, mock_user, mock_store)

            self.assertIsInstance(result, InterruptListResponse)
            self.assertEqual(result.thread_id, thread_id)
            self.assertFalse(result.has_interrupts)
            self.assertEqual(len(result.interrupts), 0)

    async def test_returns_404_for_unknown_thread(self):
        """Test that endpoint raises 404 when thread is not found."""
        from src.routes.v0.thread import get_thread_interrupts

        thread_id = "nonexistent-thread"
        mock_user = make_mock_user()
        mock_store = MagicMock()

        with (
            patch("src.routes.v0.thread.get_checkpoint_db") as mock_get_cp_db,
            patch("src.routes.v0.thread.ServiceContext") as mock_service_context_cls,
        ):
            mock_checkpointer = MagicMock()
            mock_context_manager = MagicMock()
            mock_context_manager.__aenter__ = AsyncMock(return_value=mock_checkpointer)
            mock_context_manager.__aexit__ = AsyncMock(return_value=None)
            mock_get_cp_db.return_value = mock_context_manager

            mock_service_context = MagicMock()
            mock_service_context.thread_service.get = AsyncMock(return_value=None)
            mock_service_context_cls.return_value = mock_service_context

            with self.assertRaises(HTTPException) as context:
                await get_thread_interrupts(thread_id, mock_user, mock_store)

            self.assertEqual(context.exception.status_code, status.HTTP_404_NOT_FOUND)
            self.assertIn("not found", context.exception.detail.lower())


class TestResumeThreadEndpoint(unittest.IsolatedAsyncioTestCase):
    """Tests for POST /api/threads/{thread_id}/resume endpoint logic."""

    async def test_returns_success_on_accept_decision(self):
        """Test that endpoint returns success on ACCEPT decision."""
        from src.routes.v0.thread import resume_thread

        thread_id = "test-thread-123"
        mock_user = make_mock_user()
        mock_store = MagicMock()

        mock_interrupt = InterruptInfo(
            tool_name="http_request",
            tool_args={"url": "https://example.com"},
            description="Make an HTTP request",
            config=InterruptConfig(
                allowed_actions=[
                    DecisionType.ACCEPT,
                    DecisionType.EDIT,
                    DecisionType.REJECT,
                ]
            ),
        )

        mock_resume_response = ResumeResponse(
            success=True,
            thread_id=thread_id,
            message="Thread resumed successfully",
            checkpoint_id="new-checkpoint-789",
        )

        request = ResumeRequest(
            decisions=[HumanDecision(decision_type=DecisionType.ACCEPT)]
        )

        with (
            patch("src.routes.v0.thread.get_checkpoint_db") as mock_get_cp_db,
            patch("src.routes.v0.thread.ServiceContext") as mock_service_context_cls,
            patch("src.routes.v0.thread.graph_builder") as mock_graph_builder,
            patch("src.routes.v0.thread.CheckpointService") as mock_cp_service_cls,
        ):
            mock_checkpointer = MagicMock()
            mock_context_manager = MagicMock()
            mock_context_manager.__aenter__ = AsyncMock(return_value=mock_checkpointer)
            mock_context_manager.__aexit__ = AsyncMock(return_value=None)
            mock_get_cp_db.return_value = mock_context_manager

            mock_thread = MockStoreItem()
            mock_service_context = MagicMock()
            mock_service_context.thread_service.get = AsyncMock(
                return_value=mock_thread
            )
            mock_service_context_cls.return_value = mock_service_context

            mock_graph = MagicMock()
            mock_graph_builder.return_value = mock_graph

            mock_cp_service = MagicMock()
            mock_cp_service.get_interrupts = AsyncMock(return_value=[mock_interrupt])
            mock_cp_service.resume_with_decision = AsyncMock(
                return_value=mock_resume_response
            )
            mock_cp_service_cls.return_value = mock_cp_service

            result = await resume_thread(thread_id, request, mock_user, mock_store)

            self.assertIsInstance(result, ResumeResponse)
            self.assertTrue(result.success)
            self.assertEqual(result.thread_id, thread_id)
            self.assertEqual(result.message, "Thread resumed successfully")
            self.assertEqual(result.checkpoint_id, "new-checkpoint-789")

    async def test_returns_400_for_invalid_decision_type(self):
        """Test that endpoint raises 400 when decision_type is not in allowed_actions."""
        from src.routes.v0.thread import resume_thread

        thread_id = "test-thread-456"
        mock_user = make_mock_user()
        mock_store = MagicMock()

        # Mock interrupt that only allows ACCEPT (not EDIT)
        mock_interrupt = InterruptInfo(
            tool_name="restricted_tool",
            tool_args={},
            description="Restricted operation",
            config=InterruptConfig(
                allowed_actions=[DecisionType.ACCEPT, DecisionType.REJECT]
            ),
        )

        # Try to use EDIT which is NOT allowed
        request = ResumeRequest(
            decisions=[
                HumanDecision(
                    decision_type=DecisionType.EDIT, edited_args={"key": "value"}
                )
            ]
        )

        with (
            patch("src.routes.v0.thread.get_checkpoint_db") as mock_get_cp_db,
            patch("src.routes.v0.thread.ServiceContext") as mock_service_context_cls,
            patch("src.routes.v0.thread.graph_builder") as mock_graph_builder,
            patch("src.routes.v0.thread.CheckpointService") as mock_cp_service_cls,
        ):
            mock_checkpointer = MagicMock()
            mock_context_manager = MagicMock()
            mock_context_manager.__aenter__ = AsyncMock(return_value=mock_checkpointer)
            mock_context_manager.__aexit__ = AsyncMock(return_value=None)
            mock_get_cp_db.return_value = mock_context_manager

            mock_thread = MockStoreItem()
            mock_service_context = MagicMock()
            mock_service_context.thread_service.get = AsyncMock(
                return_value=mock_thread
            )
            mock_service_context_cls.return_value = mock_service_context

            mock_graph = MagicMock()
            mock_graph_builder.return_value = mock_graph

            mock_cp_service = MagicMock()
            mock_cp_service.get_interrupts = AsyncMock(return_value=[mock_interrupt])
            mock_cp_service_cls.return_value = mock_cp_service

            with self.assertRaises(HTTPException) as context:
                await resume_thread(thread_id, request, mock_user, mock_store)

            self.assertEqual(context.exception.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn("not allowed", context.exception.detail.lower())

    async def test_returns_409_when_no_interrupt_pending(self):
        """Test that endpoint raises 409 when no interrupt is pending."""
        from src.routes.v0.thread import resume_thread

        thread_id = "test-thread-no-interrupt"
        mock_user = make_mock_user()
        mock_store = MagicMock()

        request = ResumeRequest(
            decisions=[HumanDecision(decision_type=DecisionType.ACCEPT)]
        )

        with (
            patch("src.routes.v0.thread.get_checkpoint_db") as mock_get_cp_db,
            patch("src.routes.v0.thread.ServiceContext") as mock_service_context_cls,
            patch("src.routes.v0.thread.graph_builder") as mock_graph_builder,
            patch("src.routes.v0.thread.CheckpointService") as mock_cp_service_cls,
        ):
            mock_checkpointer = MagicMock()
            mock_context_manager = MagicMock()
            mock_context_manager.__aenter__ = AsyncMock(return_value=mock_checkpointer)
            mock_context_manager.__aexit__ = AsyncMock(return_value=None)
            mock_get_cp_db.return_value = mock_context_manager

            mock_thread = MockStoreItem()
            mock_service_context = MagicMock()
            mock_service_context.thread_service.get = AsyncMock(
                return_value=mock_thread
            )
            mock_service_context_cls.return_value = mock_service_context

            mock_graph = MagicMock()
            mock_graph_builder.return_value = mock_graph

            # Setup checkpoint service mock with NO interrupts
            mock_cp_service = MagicMock()
            mock_cp_service.get_interrupts = AsyncMock(return_value=[])
            mock_cp_service_cls.return_value = mock_cp_service

            with self.assertRaises(HTTPException) as context:
                await resume_thread(thread_id, request, mock_user, mock_store)

            self.assertEqual(context.exception.status_code, status.HTTP_409_CONFLICT)
            self.assertIn("no pending interrupt", context.exception.detail.lower())

    async def test_returns_404_for_unknown_thread(self):
        """Test that endpoint raises 404 when thread is not found."""
        from src.routes.v0.thread import resume_thread

        thread_id = "nonexistent-thread"
        mock_user = make_mock_user()
        mock_store = MagicMock()

        request = ResumeRequest(
            decisions=[HumanDecision(decision_type=DecisionType.ACCEPT)]
        )

        with (
            patch("src.routes.v0.thread.get_checkpoint_db") as mock_get_cp_db,
            patch("src.routes.v0.thread.ServiceContext") as mock_service_context_cls,
        ):
            mock_checkpointer = MagicMock()
            mock_context_manager = MagicMock()
            mock_context_manager.__aenter__ = AsyncMock(return_value=mock_checkpointer)
            mock_context_manager.__aexit__ = AsyncMock(return_value=None)
            mock_get_cp_db.return_value = mock_context_manager

            mock_service_context = MagicMock()
            mock_service_context.thread_service.get = AsyncMock(return_value=None)
            mock_service_context_cls.return_value = mock_service_context

            with self.assertRaises(HTTPException) as context:
                await resume_thread(thread_id, request, mock_user, mock_store)

            self.assertEqual(context.exception.status_code, status.HTTP_404_NOT_FOUND)
            self.assertIn("not found", context.exception.detail.lower())

    async def test_returns_success_with_edit_decision(self):
        """Test that endpoint returns success with EDIT decision and modified args."""
        from src.routes.v0.thread import resume_thread

        thread_id = "test-thread-edit"
        mock_user = make_mock_user()
        mock_store = MagicMock()

        mock_interrupt = InterruptInfo(
            tool_name="http_request",
            tool_args={"url": "https://example.com", "method": "GET"},
            description="Make an HTTP request",
            config=InterruptConfig(
                allowed_actions=[
                    DecisionType.ACCEPT,
                    DecisionType.EDIT,
                    DecisionType.REJECT,
                ]
            ),
        )

        mock_resume_response = ResumeResponse(
            success=True,
            thread_id=thread_id,
            message="Thread resumed with edited args",
            checkpoint_id="edit-checkpoint-123",
        )

        edited_args = {"url": "https://safe-api.example.com", "method": "POST"}
        request = ResumeRequest(
            decisions=[
                HumanDecision(decision_type=DecisionType.EDIT, edited_args=edited_args)
            ]
        )

        with (
            patch("src.routes.v0.thread.get_checkpoint_db") as mock_get_cp_db,
            patch("src.routes.v0.thread.ServiceContext") as mock_service_context_cls,
            patch("src.routes.v0.thread.graph_builder") as mock_graph_builder,
            patch("src.routes.v0.thread.CheckpointService") as mock_cp_service_cls,
        ):
            mock_checkpointer = MagicMock()
            mock_context_manager = MagicMock()
            mock_context_manager.__aenter__ = AsyncMock(return_value=mock_checkpointer)
            mock_context_manager.__aexit__ = AsyncMock(return_value=None)
            mock_get_cp_db.return_value = mock_context_manager

            mock_thread = MockStoreItem()
            mock_service_context = MagicMock()
            mock_service_context.thread_service.get = AsyncMock(
                return_value=mock_thread
            )
            mock_service_context_cls.return_value = mock_service_context

            mock_graph = MagicMock()
            mock_graph_builder.return_value = mock_graph

            mock_cp_service = MagicMock()
            mock_cp_service.get_interrupts = AsyncMock(return_value=[mock_interrupt])
            mock_cp_service.resume_with_decision = AsyncMock(
                return_value=mock_resume_response
            )
            mock_cp_service_cls.return_value = mock_cp_service

            result = await resume_thread(thread_id, request, mock_user, mock_store)

            self.assertIsInstance(result, ResumeResponse)
            self.assertTrue(result.success)
            self.assertEqual(result.thread_id, thread_id)

    async def test_returns_success_with_response_decision(self):
        """Test that endpoint returns success with RESPONSE decision."""
        from src.routes.v0.thread import resume_thread

        thread_id = "test-thread-response"
        mock_user = make_mock_user()
        mock_store = MagicMock()

        mock_interrupt = InterruptInfo(
            tool_name="query_tool",
            tool_args={"query": "SELECT * FROM users"},
            description="Execute database query",
            config=InterruptConfig(
                allowed_actions=[
                    DecisionType.ACCEPT,
                    DecisionType.RESPONSE,
                    DecisionType.REJECT,
                ]
            ),
        )

        mock_resume_response = ResumeResponse(
            success=True,
            thread_id=thread_id,
            message="Thread resumed with human response",
            checkpoint_id="response-checkpoint-456",
        )

        request = ResumeRequest(
            decisions=[
                HumanDecision(
                    decision_type=DecisionType.RESPONSE,
                    response_content="Please use a different approach",
                )
            ]
        )

        with (
            patch("src.routes.v0.thread.get_checkpoint_db") as mock_get_cp_db,
            patch("src.routes.v0.thread.ServiceContext") as mock_service_context_cls,
            patch("src.routes.v0.thread.graph_builder") as mock_graph_builder,
            patch("src.routes.v0.thread.CheckpointService") as mock_cp_service_cls,
        ):
            mock_checkpointer = MagicMock()
            mock_context_manager = MagicMock()
            mock_context_manager.__aenter__ = AsyncMock(return_value=mock_checkpointer)
            mock_context_manager.__aexit__ = AsyncMock(return_value=None)
            mock_get_cp_db.return_value = mock_context_manager

            mock_thread = MockStoreItem()
            mock_service_context = MagicMock()
            mock_service_context.thread_service.get = AsyncMock(
                return_value=mock_thread
            )
            mock_service_context_cls.return_value = mock_service_context

            mock_graph = MagicMock()
            mock_graph_builder.return_value = mock_graph

            mock_cp_service = MagicMock()
            mock_cp_service.get_interrupts = AsyncMock(return_value=[mock_interrupt])
            mock_cp_service.resume_with_decision = AsyncMock(
                return_value=mock_resume_response
            )
            mock_cp_service_cls.return_value = mock_cp_service

            result = await resume_thread(thread_id, request, mock_user, mock_store)

            self.assertIsInstance(result, ResumeResponse)
            self.assertTrue(result.success)
            self.assertEqual(result.thread_id, thread_id)

    async def test_returns_success_with_reject_decision(self):
        """Test that endpoint returns success with REJECT decision."""
        from src.routes.v0.thread import resume_thread

        thread_id = "test-thread-reject"
        mock_user = make_mock_user()
        mock_store = MagicMock()

        mock_interrupt = InterruptInfo(
            tool_name="dangerous_tool",
            tool_args={"action": "delete_all"},
            description="Dangerous operation",
            config=InterruptConfig(
                allowed_actions=[DecisionType.ACCEPT, DecisionType.REJECT]
            ),
        )

        mock_resume_response = ResumeResponse(
            success=True,
            thread_id=thread_id,
            message="Thread resumed with rejection",
            checkpoint_id="reject-checkpoint-789",
        )

        request = ResumeRequest(
            decisions=[HumanDecision(decision_type=DecisionType.REJECT)]
        )

        with (
            patch("src.routes.v0.thread.get_checkpoint_db") as mock_get_cp_db,
            patch("src.routes.v0.thread.ServiceContext") as mock_service_context_cls,
            patch("src.routes.v0.thread.graph_builder") as mock_graph_builder,
            patch("src.routes.v0.thread.CheckpointService") as mock_cp_service_cls,
        ):
            mock_checkpointer = MagicMock()
            mock_context_manager = MagicMock()
            mock_context_manager.__aenter__ = AsyncMock(return_value=mock_checkpointer)
            mock_context_manager.__aexit__ = AsyncMock(return_value=None)
            mock_get_cp_db.return_value = mock_context_manager

            mock_thread = MockStoreItem()
            mock_service_context = MagicMock()
            mock_service_context.thread_service.get = AsyncMock(
                return_value=mock_thread
            )
            mock_service_context_cls.return_value = mock_service_context

            mock_graph = MagicMock()
            mock_graph_builder.return_value = mock_graph

            mock_cp_service = MagicMock()
            mock_cp_service.get_interrupts = AsyncMock(return_value=[mock_interrupt])
            mock_cp_service.resume_with_decision = AsyncMock(
                return_value=mock_resume_response
            )
            mock_cp_service_cls.return_value = mock_cp_service

            result = await resume_thread(thread_id, request, mock_user, mock_store)

            self.assertIsInstance(result, ResumeResponse)
            self.assertTrue(result.success)
            self.assertEqual(result.thread_id, thread_id)


class TestResumeRequestValidation(unittest.TestCase):
    """Tests for ResumeRequest validation (422 responses)."""

    def test_requires_decisions_list(self):
        """Test that ResumeRequest requires decisions list."""
        from pydantic import ValidationError

        with self.assertRaises(ValidationError):
            ResumeRequest()

    def test_rejects_empty_decisions_list(self):
        """Test that ResumeRequest rejects empty decisions list."""
        from pydantic import ValidationError

        with self.assertRaises(ValidationError):
            ResumeRequest(decisions=[])


class TestHumanDecisionValidation(unittest.TestCase):
    """Tests for HumanDecision validation (input validation)."""

    def test_edit_requires_edited_args(self):
        """Test that EDIT decision requires edited_args."""
        from pydantic import ValidationError

        with self.assertRaises(ValidationError):
            HumanDecision(decision_type=DecisionType.EDIT)

    def test_response_requires_response_content(self):
        """Test that RESPONSE decision requires response_content."""
        from pydantic import ValidationError

        with self.assertRaises(ValidationError):
            HumanDecision(decision_type=DecisionType.RESPONSE)

    def test_accept_works_without_extra_fields(self):
        """Test that ACCEPT decision works without extra fields."""
        decision = HumanDecision(decision_type=DecisionType.ACCEPT)
        self.assertEqual(decision.decision_type, DecisionType.ACCEPT)

    def test_reject_works_without_extra_fields(self):
        """Test that REJECT decision works without extra fields."""
        decision = HumanDecision(decision_type=DecisionType.REJECT)
        self.assertEqual(decision.decision_type, DecisionType.REJECT)


if __name__ == "__main__":
    unittest.main()
