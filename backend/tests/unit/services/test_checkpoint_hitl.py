"""Unit tests for CheckpointService HITL (Human-in-the-Loop) methods."""

import unittest
from unittest.mock import AsyncMock, MagicMock
from typing import Any
from src.services.checkpoint import CheckpointService
from src.schemas.entities.hitl import (
    DecisionType,
    HumanDecision,
    InterruptInfo,
    ResumeResponse,
)


class MockInterrupt:
    """Mock interrupt object that mimics LangGraph's Interrupt structure."""

    def __init__(self, value: dict[str, Any] | list[dict[str, Any]]):
        self.value = value


class TestGetInterrupts(unittest.IsolatedAsyncioTestCase):
    """Tests for CheckpointService.get_interrupts method."""

    async def test_returns_empty_when_no_graph(self):
        """Test that get_interrupts returns empty list when no graph is configured."""
        service = CheckpointService(user_id="test-user", graph=None)
        result = await service.get_interrupts("thread-123")
        self.assertEqual(result, [])

    async def test_returns_empty_when_no_state(self):
        """Test that get_interrupts returns empty list when state is None."""
        mock_graph = MagicMock()
        mock_graph.aget_state = AsyncMock(return_value=None)

        service = CheckpointService(user_id="test-user", graph=mock_graph)
        result = await service.get_interrupts("thread-123")
        self.assertEqual(result, [])

    async def test_returns_empty_when_no_interrupts_in_state(self):
        """Test that get_interrupts returns empty list when state has no interrupts."""
        mock_state = MagicMock()
        mock_state.interrupts = []

        mock_graph = MagicMock()
        mock_graph.aget_state = AsyncMock(return_value=mock_state)

        service = CheckpointService(user_id="test-user", graph=mock_graph)
        result = await service.get_interrupts("thread-123")
        self.assertEqual(result, [])

    async def test_returns_interrupt_data_when_interrupt_exists(self):
        """Test that get_interrupts returns correct data when interrupt exists."""
        # Create mock interrupt with proper HumanInterrupt structure
        interrupt_value = {
            "action_request": {
                "action": "http_request",
                "args": {"url": "https://example.com", "method": "POST"},
            },
            "config": {
                "allow_accept": True,
                "allow_edit": True,
                "allow_respond": False,
            },
            "description": "Make an HTTP POST request to example.com",
        }

        mock_interrupt = MockInterrupt(interrupt_value)
        mock_state = MagicMock()
        mock_state.interrupts = [mock_interrupt]

        mock_graph = MagicMock()
        mock_graph.aget_state = AsyncMock(return_value=mock_state)

        service = CheckpointService(user_id="test-user", graph=mock_graph)
        result = await service.get_interrupts("thread-123")

        self.assertEqual(len(result), 1)
        self.assertIsInstance(result[0], InterruptInfo)
        self.assertEqual(result[0].tool_name, "http_request")
        self.assertEqual(result[0].tool_args["url"], "https://example.com")
        self.assertEqual(result[0].tool_args["method"], "POST")
        self.assertEqual(
            result[0].description, "Make an HTTP POST request to example.com"
        )

        # Verify allowed actions based on config
        allowed_actions = result[0].config.allowed_actions
        self.assertIn(DecisionType.ACCEPT, allowed_actions)
        self.assertIn(DecisionType.EDIT, allowed_actions)
        self.assertNotIn(DecisionType.RESPONSE, allowed_actions)
        self.assertIn(DecisionType.REJECT, allowed_actions)  # Always included

    async def test_returns_interrupt_data_with_list_value_format(self):
        """Test that get_interrupts handles interrupt value as a list (alternative format)."""
        # Some LangGraph versions return interrupt.value as a list
        interrupt_value = [
            {
                "action_request": {
                    "action": "bash_command",
                    "args": {"command": "ls -la"},
                },
                "config": {
                    "allow_accept": True,
                    "allow_edit": False,
                    "allow_respond": True,
                },
                "description": "Execute bash command",
            }
        ]

        mock_interrupt = MockInterrupt(interrupt_value)
        mock_state = MagicMock()
        mock_state.interrupts = [mock_interrupt]

        mock_graph = MagicMock()
        mock_graph.aget_state = AsyncMock(return_value=mock_state)

        service = CheckpointService(user_id="test-user", graph=mock_graph)
        result = await service.get_interrupts("thread-123")

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].tool_name, "bash_command")
        self.assertEqual(result[0].tool_args["command"], "ls -la")

    async def test_handles_missing_action_request(self):
        """Test that get_interrupts handles missing action_request gracefully."""
        interrupt_value = {
            "config": {"allow_accept": True},
            "description": "Some interrupt",
        }

        mock_interrupt = MockInterrupt(interrupt_value)
        mock_state = MagicMock()
        mock_state.interrupts = [mock_interrupt]

        mock_graph = MagicMock()
        mock_graph.aget_state = AsyncMock(return_value=mock_state)

        service = CheckpointService(user_id="test-user", graph=mock_graph)
        result = await service.get_interrupts("thread-123")

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].tool_name, "unknown")
        self.assertEqual(result[0].tool_args, {})

    async def test_handles_exception_gracefully(self):
        """Test that get_interrupts handles exceptions and returns empty list."""
        mock_graph = MagicMock()
        mock_graph.aget_state = AsyncMock(side_effect=Exception("Database error"))

        service = CheckpointService(user_id="test-user", graph=mock_graph)
        result = await service.get_interrupts("thread-123")
        self.assertEqual(result, [])

    async def test_multiple_interrupts(self):
        """Test that get_interrupts handles multiple concurrent interrupts."""
        interrupt1 = MockInterrupt(
            {
                "action_request": {"action": "tool1", "args": {}},
                "config": {"allow_accept": True},
                "description": "First interrupt",
            }
        )
        interrupt2 = MockInterrupt(
            {
                "action_request": {"action": "tool2", "args": {}},
                "config": {"allow_edit": True},
                "description": "Second interrupt",
            }
        )

        mock_state = MagicMock()
        mock_state.interrupts = [interrupt1, interrupt2]

        mock_graph = MagicMock()
        mock_graph.aget_state = AsyncMock(return_value=mock_state)

        service = CheckpointService(user_id="test-user", graph=mock_graph)
        result = await service.get_interrupts("thread-123")

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0].tool_name, "tool1")
        self.assertEqual(result[1].tool_name, "tool2")


class TestResumeWithDecision(unittest.IsolatedAsyncioTestCase):
    """Tests for CheckpointService.resume_with_decision method."""

    async def test_raises_error_when_no_graph(self):
        """Test that resume_with_decision raises ValueError when no graph is configured."""
        service = CheckpointService(user_id="test-user", graph=None)
        decision = HumanDecision(decision_type=DecisionType.ACCEPT)

        with self.assertRaises(ValueError) as context:
            await service.resume_with_decision("thread-123", [decision])

        self.assertIn("No graph configured", str(context.exception))

    async def test_raises_error_when_no_pending_interrupt(self):
        """Test that resume_with_decision raises ValueError when no interrupt is pending."""
        mock_state = MagicMock()
        mock_state.interrupts = []

        mock_graph = MagicMock()
        mock_graph.aget_state = AsyncMock(return_value=mock_state)

        service = CheckpointService(user_id="test-user", graph=mock_graph)
        decision = HumanDecision(decision_type=DecisionType.ACCEPT)

        with self.assertRaises(ValueError) as context:
            await service.resume_with_decision("thread-123", [decision])

        self.assertIn("No pending interrupt", str(context.exception))

    async def test_raises_error_when_state_is_none(self):
        """Test that resume_with_decision raises ValueError when state is None."""
        mock_graph = MagicMock()
        mock_graph.aget_state = AsyncMock(return_value=None)

        service = CheckpointService(user_id="test-user", graph=mock_graph)
        decision = HumanDecision(decision_type=DecisionType.ACCEPT)

        with self.assertRaises(ValueError) as context:
            await service.resume_with_decision("thread-123", [decision])

        self.assertIn("No pending interrupt", str(context.exception))

    async def test_accept_decision_invokes_graph_correctly(self):
        """Test that ACCEPT decision resumes graph with correct Command."""
        mock_interrupt = MockInterrupt({"action_request": {"action": "test_tool"}})
        mock_state_with_interrupt = MagicMock()
        mock_state_with_interrupt.interrupts = [mock_interrupt]

        mock_state_after_resume = MagicMock()
        mock_state_after_resume.config = {
            "configurable": {"checkpoint_id": "new-cp-123"}
        }

        mock_graph = MagicMock()
        mock_graph.aget_state = AsyncMock(
            side_effect=[mock_state_with_interrupt, mock_state_after_resume]
        )
        mock_graph.ainvoke = AsyncMock(return_value={"result": "success"})

        service = CheckpointService(user_id="test-user", graph=mock_graph)
        decision = HumanDecision(decision_type=DecisionType.ACCEPT)

        result = await service.resume_with_decision("thread-123", [decision])

        self.assertIsInstance(result, ResumeResponse)
        self.assertTrue(result.success)
        self.assertEqual(result.thread_id, "thread-123")
        self.assertEqual(result.checkpoint_id, "new-cp-123")

        # Verify ainvoke was called with Command
        mock_graph.ainvoke.assert_called_once()
        call_args = mock_graph.ainvoke.call_args
        command = call_args[0][0]
        # Verify it's a Command with resume value for accept
        self.assertEqual(command.resume, {"type": "accept"})

    async def test_edit_decision_invokes_graph_with_modified_args(self):
        """Test that EDIT decision resumes graph with modified args."""
        mock_interrupt = MockInterrupt({"action_request": {"action": "test_tool"}})
        mock_state_with_interrupt = MagicMock()
        mock_state_with_interrupt.interrupts = [mock_interrupt]

        mock_state_after_resume = MagicMock()
        mock_state_after_resume.config = {
            "configurable": {"checkpoint_id": "new-cp-456"}
        }

        mock_graph = MagicMock()
        mock_graph.aget_state = AsyncMock(
            side_effect=[mock_state_with_interrupt, mock_state_after_resume]
        )
        mock_graph.ainvoke = AsyncMock(return_value={"result": "success"})

        service = CheckpointService(user_id="test-user", graph=mock_graph)
        edited_args = {"url": "https://safe-url.example.com"}
        decision = HumanDecision(
            decision_type=DecisionType.EDIT,
            edited_args=edited_args,
        )

        result = await service.resume_with_decision("thread-123", [decision])

        self.assertIsInstance(result, ResumeResponse)
        self.assertTrue(result.success)
        self.assertEqual(result.checkpoint_id, "new-cp-456")

        # Verify ainvoke was called with Command containing edited args
        mock_graph.ainvoke.assert_called_once()
        call_args = mock_graph.ainvoke.call_args
        command = call_args[0][0]
        self.assertEqual(command.resume["type"], "edit")
        self.assertEqual(command.resume["args"]["args"], edited_args)

    async def test_response_decision_invokes_graph_with_response_content(self):
        """Test that RESPONSE decision resumes graph with response content."""
        mock_interrupt = MockInterrupt({"action_request": {"action": "test_tool"}})
        mock_state_with_interrupt = MagicMock()
        mock_state_with_interrupt.interrupts = [mock_interrupt]

        mock_state_after_resume = MagicMock()
        mock_state_after_resume.config = {
            "configurable": {"checkpoint_id": "new-cp-789"}
        }

        mock_graph = MagicMock()
        mock_graph.aget_state = AsyncMock(
            side_effect=[mock_state_with_interrupt, mock_state_after_resume]
        )
        mock_graph.ainvoke = AsyncMock(return_value={"result": "success"})

        service = CheckpointService(user_id="test-user", graph=mock_graph)
        decision = HumanDecision(
            decision_type=DecisionType.RESPONSE,
            response_content="Please use a different approach",
        )

        result = await service.resume_with_decision("thread-123", [decision])

        self.assertIsInstance(result, ResumeResponse)
        self.assertTrue(result.success)

        # Verify ainvoke was called with Command containing response content
        mock_graph.ainvoke.assert_called_once()
        call_args = mock_graph.ainvoke.call_args
        command = call_args[0][0]
        self.assertEqual(command.resume["type"], "response")
        self.assertEqual(command.resume["args"], "Please use a different approach")

    async def test_reject_decision_invokes_graph_with_rejection_message(self):
        """Test that REJECT decision resumes graph with rejection message."""
        mock_interrupt = MockInterrupt({"action_request": {"action": "test_tool"}})
        mock_state_with_interrupt = MagicMock()
        mock_state_with_interrupt.interrupts = [mock_interrupt]

        mock_state_after_resume = MagicMock()
        mock_state_after_resume.config = {
            "configurable": {"checkpoint_id": "new-cp-rej"}
        }

        mock_graph = MagicMock()
        mock_graph.aget_state = AsyncMock(
            side_effect=[mock_state_with_interrupt, mock_state_after_resume]
        )
        mock_graph.ainvoke = AsyncMock(return_value={"result": "rejected"})

        service = CheckpointService(user_id="test-user", graph=mock_graph)
        decision = HumanDecision(decision_type=DecisionType.REJECT)

        result = await service.resume_with_decision("thread-123", [decision])

        self.assertIsInstance(result, ResumeResponse)
        self.assertTrue(result.success)

        # Verify ainvoke was called with Command containing rejection
        mock_graph.ainvoke.assert_called_once()
        call_args = mock_graph.ainvoke.call_args
        command = call_args[0][0]
        self.assertEqual(command.resume["type"], "response")
        self.assertEqual(command.resume["args"], "User rejected this action.")

    async def test_returns_failure_response_on_exception(self):
        """Test that resume_with_decision returns failure response on exception."""
        mock_interrupt = MockInterrupt({"action_request": {"action": "test_tool"}})
        mock_state_with_interrupt = MagicMock()
        mock_state_with_interrupt.interrupts = [mock_interrupt]

        mock_graph = MagicMock()
        mock_graph.aget_state = AsyncMock(return_value=mock_state_with_interrupt)
        mock_graph.ainvoke = AsyncMock(side_effect=Exception("Graph execution failed"))

        service = CheckpointService(user_id="test-user", graph=mock_graph)
        decision = HumanDecision(decision_type=DecisionType.ACCEPT)

        result = await service.resume_with_decision("thread-123", [decision])

        self.assertIsInstance(result, ResumeResponse)
        self.assertFalse(result.success)
        self.assertEqual(result.thread_id, "thread-123")
        self.assertIn("Failed to resume", result.message)
        self.assertIsNone(result.checkpoint_id)

    async def test_multiple_decisions_passed_as_list(self):
        """Test that multiple decisions are handled correctly."""
        mock_interrupt1 = MockInterrupt({"action_request": {"action": "tool1"}})
        mock_interrupt2 = MockInterrupt({"action_request": {"action": "tool2"}})
        mock_state_with_interrupts = MagicMock()
        mock_state_with_interrupts.interrupts = [mock_interrupt1, mock_interrupt2]

        mock_state_after_resume = MagicMock()
        mock_state_after_resume.config = {"configurable": {"checkpoint_id": "multi-cp"}}

        mock_graph = MagicMock()
        mock_graph.aget_state = AsyncMock(
            side_effect=[mock_state_with_interrupts, mock_state_after_resume]
        )
        mock_graph.ainvoke = AsyncMock(return_value={"result": "success"})

        service = CheckpointService(user_id="test-user", graph=mock_graph)
        decisions = [
            HumanDecision(decision_type=DecisionType.ACCEPT),
            HumanDecision(decision_type=DecisionType.REJECT),
        ]

        result = await service.resume_with_decision("thread-123", decisions)

        self.assertTrue(result.success)

        # For multiple decisions, resume value should be a list
        call_args = mock_graph.ainvoke.call_args
        command = call_args[0][0]
        self.assertIsInstance(command.resume, list)
        self.assertEqual(len(command.resume), 2)


if __name__ == "__main__":
    unittest.main()
