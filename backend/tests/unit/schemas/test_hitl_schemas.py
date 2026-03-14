"""Unit tests for HITL (Human-in-the-Loop) Pydantic schemas."""

import unittest
from pydantic import ValidationError
from src.schemas.entities.hitl import (
    DecisionType,
    HumanDecision,
    InterruptConfig,
    InterruptInfo,
    InterruptListResponse,
    ResumeRequest,
    ResumeResponse,
)


class TestDecisionTypeEnum(unittest.TestCase):
    """Tests for DecisionType enum."""

    def test_accept_value(self):
        """Test ACCEPT enum value is correct."""
        self.assertEqual(DecisionType.ACCEPT.value, "accept")

    def test_edit_value(self):
        """Test EDIT enum value is correct."""
        self.assertEqual(DecisionType.EDIT.value, "edit")

    def test_response_value(self):
        """Test RESPONSE enum value is correct."""
        self.assertEqual(DecisionType.RESPONSE.value, "response")

    def test_reject_value(self):
        """Test REJECT enum value is correct."""
        self.assertEqual(DecisionType.REJECT.value, "reject")

    def test_enum_is_string_serializable(self):
        """Test that enum values serialize as strings in JSON."""
        decision = HumanDecision(decision_type=DecisionType.ACCEPT)
        json_data = decision.model_dump()
        self.assertEqual(json_data["decision_type"], "accept")

    def test_enum_from_string(self):
        """Test that enum can be created from string values."""
        decision = HumanDecision(decision_type="accept")
        self.assertEqual(decision.decision_type, DecisionType.ACCEPT)


class TestHumanDecisionValidation(unittest.TestCase):
    """Tests for HumanDecision validation logic."""

    def test_accept_decision_valid_minimal(self):
        """Test ACCEPT decision with minimal fields."""
        decision = HumanDecision(decision_type=DecisionType.ACCEPT)
        self.assertEqual(decision.decision_type, DecisionType.ACCEPT)
        self.assertIsNone(decision.edited_args)
        self.assertIsNone(decision.response_content)

    def test_reject_decision_valid_minimal(self):
        """Test REJECT decision with minimal fields."""
        decision = HumanDecision(decision_type=DecisionType.REJECT)
        self.assertEqual(decision.decision_type, DecisionType.REJECT)
        self.assertIsNone(decision.edited_args)
        self.assertIsNone(decision.response_content)

    def test_edit_decision_valid_with_edited_args(self):
        """Test EDIT decision with required edited_args."""
        edited_args = {"url": "https://safe.example.com"}
        decision = HumanDecision(
            decision_type=DecisionType.EDIT,
            edited_args=edited_args,
        )
        self.assertEqual(decision.decision_type, DecisionType.EDIT)
        self.assertEqual(decision.edited_args, edited_args)

    def test_edit_decision_invalid_without_edited_args(self):
        """Test EDIT decision requires edited_args."""
        with self.assertRaises(ValidationError) as context:
            HumanDecision(decision_type=DecisionType.EDIT)
        error_msg = str(context.exception)
        self.assertIn("edited_args is required", error_msg)

    def test_response_decision_valid_with_response_content(self):
        """Test RESPONSE decision with required response_content."""
        decision = HumanDecision(
            decision_type=DecisionType.RESPONSE,
            response_content="Proceed with caution",
        )
        self.assertEqual(decision.decision_type, DecisionType.RESPONSE)
        self.assertEqual(decision.response_content, "Proceed with caution")

    def test_response_decision_invalid_without_response_content(self):
        """Test RESPONSE decision requires response_content."""
        with self.assertRaises(ValidationError) as context:
            HumanDecision(decision_type=DecisionType.RESPONSE)
        error_msg = str(context.exception)
        self.assertIn("response_content is required", error_msg)

    def test_edit_decision_allows_empty_dict(self):
        """Test EDIT decision with empty edited_args dict."""
        decision = HumanDecision(
            decision_type=DecisionType.EDIT,
            edited_args={},
        )
        self.assertEqual(decision.edited_args, {})

    def test_response_decision_allows_empty_string(self):
        """Test RESPONSE decision with empty response_content string."""
        decision = HumanDecision(
            decision_type=DecisionType.RESPONSE,
            response_content="",
        )
        self.assertEqual(decision.response_content, "")

    def test_accept_decision_with_optional_extra_fields(self):
        """Test ACCEPT decision can have optional fields set (they are ignored)."""
        decision = HumanDecision(
            decision_type=DecisionType.ACCEPT,
            edited_args={"extra": "data"},
            response_content="not required but allowed",
        )
        self.assertEqual(decision.decision_type, DecisionType.ACCEPT)
        # Extra fields are allowed but not required
        self.assertEqual(decision.edited_args, {"extra": "data"})


class TestInterruptConfig(unittest.TestCase):
    """Tests for InterruptConfig model."""

    def test_default_allowed_actions(self):
        """Test that default allowed_actions includes all decision types."""
        config = InterruptConfig()
        expected = [
            DecisionType.ACCEPT,
            DecisionType.EDIT,
            DecisionType.RESPONSE,
            DecisionType.REJECT,
        ]
        self.assertEqual(config.allowed_actions, expected)

    def test_custom_allowed_actions(self):
        """Test custom allowed_actions subset."""
        config = InterruptConfig(allowed_actions=[DecisionType.ACCEPT, DecisionType.REJECT])
        self.assertEqual(len(config.allowed_actions), 2)
        self.assertIn(DecisionType.ACCEPT, config.allowed_actions)
        self.assertIn(DecisionType.REJECT, config.allowed_actions)

    def test_allowed_actions_from_strings(self):
        """Test allowed_actions accepts string values."""
        config = InterruptConfig(allowed_actions=["accept", "reject"])
        self.assertEqual(len(config.allowed_actions), 2)

    def test_serialization(self):
        """Test InterruptConfig serializes correctly."""
        config = InterruptConfig(allowed_actions=[DecisionType.ACCEPT])
        json_data = config.model_dump()
        self.assertEqual(json_data["allowed_actions"], ["accept"])


class TestInterruptInfo(unittest.TestCase):
    """Tests for InterruptInfo model."""

    def test_required_fields_only(self):
        """Test InterruptInfo with only required fields."""
        info = InterruptInfo(tool_name="http_request")
        self.assertEqual(info.tool_name, "http_request")
        self.assertEqual(info.tool_args, {})
        self.assertIsNone(info.description)
        self.assertIsNotNone(info.config)

    def test_full_fields(self):
        """Test InterruptInfo with all fields populated."""
        config = InterruptConfig(allowed_actions=[DecisionType.ACCEPT, DecisionType.REJECT])
        info = InterruptInfo(
            tool_name="http_request",
            tool_args={"method": "POST", "url": "https://api.example.com"},
            description="Make an HTTP POST request",
            config=config,
        )
        self.assertEqual(info.tool_name, "http_request")
        self.assertEqual(info.tool_args["method"], "POST")
        self.assertEqual(info.description, "Make an HTTP POST request")
        self.assertEqual(len(info.config.allowed_actions), 2)

    def test_serialization(self):
        """Test InterruptInfo serializes correctly to JSON."""
        info = InterruptInfo(
            tool_name="bash",
            tool_args={"command": "ls -la"},
            description="List directory contents",
        )
        json_data = info.model_dump()
        self.assertEqual(json_data["tool_name"], "bash")
        self.assertEqual(json_data["tool_args"]["command"], "ls -la")
        self.assertEqual(json_data["description"], "List directory contents")
        self.assertIn("config", json_data)

    def test_tool_args_accepts_complex_nested_data(self):
        """Test tool_args can hold complex nested data structures."""
        complex_args = {
            "url": "https://api.example.com",
            "headers": {"Authorization": "Bearer token"},
            "body": {"nested": {"deeply": ["array", "values"]}},
        }
        info = InterruptInfo(tool_name="http_request", tool_args=complex_args)
        self.assertEqual(info.tool_args["body"]["nested"]["deeply"][0], "array")


class TestInterruptListResponse(unittest.TestCase):
    """Tests for InterruptListResponse model."""

    def test_no_interrupts(self):
        """Test response when no interrupts are pending."""
        response = InterruptListResponse(
            thread_id="thread-123",
            has_interrupts=False,
            interrupts=[],
        )
        self.assertEqual(response.thread_id, "thread-123")
        self.assertFalse(response.has_interrupts)
        self.assertEqual(response.interrupts, [])

    def test_with_interrupts(self):
        """Test response with pending interrupts."""
        interrupt = InterruptInfo(
            tool_name="http_request",
            tool_args={"url": "https://example.com"},
        )
        response = InterruptListResponse(
            thread_id="thread-456",
            has_interrupts=True,
            interrupts=[interrupt],
        )
        self.assertEqual(response.thread_id, "thread-456")
        self.assertTrue(response.has_interrupts)
        self.assertEqual(len(response.interrupts), 1)
        self.assertEqual(response.interrupts[0].tool_name, "http_request")

    def test_serialization(self):
        """Test InterruptListResponse serializes correctly."""
        response = InterruptListResponse(
            thread_id="thread-789",
            has_interrupts=False,
        )
        json_data = response.model_dump()
        self.assertEqual(json_data["thread_id"], "thread-789")
        self.assertFalse(json_data["has_interrupts"])
        self.assertEqual(json_data["interrupts"], [])

    def test_multiple_interrupts(self):
        """Test response with multiple pending interrupts."""
        interrupts = [
            InterruptInfo(tool_name="tool1"),
            InterruptInfo(tool_name="tool2"),
            InterruptInfo(tool_name="tool3"),
        ]
        response = InterruptListResponse(
            thread_id="thread-multi",
            has_interrupts=True,
            interrupts=interrupts,
        )
        self.assertEqual(len(response.interrupts), 3)


class TestResumeRequest(unittest.TestCase):
    """Tests for ResumeRequest model."""

    def test_single_decision(self):
        """Test ResumeRequest with a single decision."""
        decision = HumanDecision(decision_type=DecisionType.ACCEPT)
        request = ResumeRequest(decisions=[decision])
        self.assertEqual(len(request.decisions), 1)
        self.assertEqual(request.decisions[0].decision_type, DecisionType.ACCEPT)

    def test_multiple_decisions(self):
        """Test ResumeRequest with multiple decisions."""
        decisions = [
            HumanDecision(decision_type=DecisionType.ACCEPT),
            HumanDecision(decision_type=DecisionType.REJECT),
        ]
        request = ResumeRequest(decisions=decisions)
        self.assertEqual(len(request.decisions), 2)

    def test_empty_decisions_invalid(self):
        """Test that empty decisions list is rejected."""
        with self.assertRaises(ValidationError) as context:
            ResumeRequest(decisions=[])
        # Check for min_length validation
        error_msg = str(context.exception)
        self.assertTrue(
            "at least 1" in error_msg.lower() or "too_short" in error_msg.lower() or "min_length" in error_msg.lower()
        )

    def test_serialization(self):
        """Test ResumeRequest serializes correctly."""
        request = ResumeRequest(decisions=[HumanDecision(decision_type=DecisionType.ACCEPT)])
        json_data = request.model_dump()
        self.assertEqual(len(json_data["decisions"]), 1)
        self.assertEqual(json_data["decisions"][0]["decision_type"], "accept")

    def test_nested_decision_validation(self):
        """Test that nested decision validation is enforced."""
        # This should fail because EDIT requires edited_args
        with self.assertRaises(ValidationError):
            ResumeRequest(decisions=[{"decision_type": "edit"}])


class TestResumeResponse(unittest.TestCase):
    """Tests for ResumeResponse model."""

    def test_success_response(self):
        """Test successful resume response."""
        response = ResumeResponse(
            success=True,
            thread_id="thread-123",
            message="Thread resumed successfully",
            checkpoint_id="checkpoint-456",
        )
        self.assertTrue(response.success)
        self.assertEqual(response.thread_id, "thread-123")
        self.assertEqual(response.message, "Thread resumed successfully")
        self.assertEqual(response.checkpoint_id, "checkpoint-456")

    def test_failure_response(self):
        """Test failed resume response."""
        response = ResumeResponse(
            success=False,
            thread_id="thread-123",
            message="No pending interrupt",
            checkpoint_id=None,
        )
        self.assertFalse(response.success)
        self.assertIsNone(response.checkpoint_id)

    def test_checkpoint_id_optional(self):
        """Test that checkpoint_id is optional."""
        response = ResumeResponse(
            success=True,
            thread_id="thread-123",
            message="Resumed",
        )
        self.assertIsNone(response.checkpoint_id)

    def test_serialization(self):
        """Test ResumeResponse serializes correctly."""
        response = ResumeResponse(
            success=True,
            thread_id="thread-789",
            message="All good",
            checkpoint_id="cp-001",
        )
        json_data = response.model_dump()
        self.assertTrue(json_data["success"])
        self.assertEqual(json_data["thread_id"], "thread-789")
        self.assertEqual(json_data["message"], "All good")
        self.assertEqual(json_data["checkpoint_id"], "cp-001")


if __name__ == "__main__":
    unittest.main()
