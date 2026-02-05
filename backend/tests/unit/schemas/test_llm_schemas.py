"""Unit tests for LLMRequest and Assistant deep agent parameter fields."""

import unittest
from src.schemas.entities.llm import Assistant, LLMRequest, LLMInput


class TestLLMRequestDeepAgentFields(unittest.TestCase):
    """Tests for the deep agent parameter fields on LLMRequest."""

    def _make_input(self) -> LLMInput:
        return LLMInput(messages=[{"role": "user", "content": "Hello"}])

    def test_new_fields_default_to_none(self):
        """All five deep agent fields default to None when not provided."""
        req = LLMRequest(input=self._make_input())
        self.assertIsNone(req.skills)
        self.assertIsNone(req.memory)
        self.assertIsNone(req.agent_name)
        self.assertIsNone(req.response_format)
        self.assertIsNone(req.interrupt_on)

    def test_skills_set_correctly(self):
        req = LLMRequest(input=self._make_input(), skills=["web_search", "code_exec"])
        self.assertEqual(req.skills, ["web_search", "code_exec"])

    def test_memory_set_correctly(self):
        req = LLMRequest(
            input=self._make_input(), memory=["Remember: user prefers JSON"]
        )
        self.assertEqual(req.memory, ["Remember: user prefers JSON"])

    def test_agent_name_set_correctly(self):
        req = LLMRequest(input=self._make_input(), agent_name="my-deep-agent")
        self.assertEqual(req.agent_name, "my-deep-agent")

    def test_response_format_set_correctly(self):
        fmt = {"type": "json_object", "schema": {"answer": "string"}}
        req = LLMRequest(input=self._make_input(), response_format=fmt)
        self.assertEqual(req.response_format, fmt)

    def test_interrupt_on_set_correctly(self):
        interrupt = {"tool_calls": ["http_request"]}
        req = LLMRequest(input=self._make_input(), interrupt_on=interrupt)
        self.assertEqual(req.interrupt_on, interrupt)

    def test_all_fields_set_together(self):
        """All five fields can be set simultaneously."""
        req = LLMRequest(
            input=self._make_input(),
            skills=["s1"],
            memory=["m1"],
            agent_name="agent-1",
            response_format={"type": "text"},
            interrupt_on={"tool_calls": ["bash"]},
        )
        self.assertEqual(req.skills, ["s1"])
        self.assertEqual(req.memory, ["m1"])
        self.assertEqual(req.agent_name, "agent-1")
        self.assertEqual(req.response_format, {"type": "text"})
        self.assertEqual(req.interrupt_on, {"tool_calls": ["bash"]})


class TestAssistantDeepAgentFields(unittest.TestCase):
    """Tests for the deep agent parameter fields on Assistant."""

    def test_new_fields_default_to_none(self):
        """All five deep agent fields default to None on Assistant."""
        assistant = Assistant(name="Test", tools=["web_search"])
        self.assertIsNone(assistant.skills)
        self.assertIsNone(assistant.memory)
        self.assertIsNone(assistant.agent_name)
        self.assertIsNone(assistant.response_format)
        self.assertIsNone(assistant.interrupt_on)

    def test_fields_set_correctly(self):
        assistant = Assistant(
            name="Test",
            tools=["web_search"],
            skills=["skill-a"],
            memory=["mem-a"],
            agent_name="deep-agent-1",
            response_format={"type": "json_object"},
            interrupt_on={"tool_calls": ["http_request"]},
        )
        self.assertEqual(assistant.skills, ["skill-a"])
        self.assertEqual(assistant.memory, ["mem-a"])
        self.assertEqual(assistant.agent_name, "deep-agent-1")
        self.assertEqual(assistant.response_format, {"type": "json_object"})
        self.assertEqual(assistant.interrupt_on, {"tool_calls": ["http_request"]})


class TestAssistantToLLMRequestPropagation(unittest.TestCase):
    """Tests that Assistant.to_llm_request() propagates the five new fields."""

    def _make_input(self) -> LLMInput:
        return LLMInput(messages=[{"role": "user", "content": "Hello"}])

    def test_propagates_all_five_fields(self):
        """to_llm_request() copies skills, memory, agent_name, response_format, interrupt_on."""
        assistant = Assistant(
            name="PropagationTest",
            tools=["web_search"],
            skills=["s1", "s2"],
            memory=["m1"],
            agent_name="my-agent",
            response_format={"type": "json_object"},
            interrupt_on={"tool_calls": ["bash"]},
        )
        req = assistant.to_llm_request(input=self._make_input())
        self.assertEqual(req.skills, ["s1", "s2"])
        self.assertEqual(req.memory, ["m1"])
        self.assertEqual(req.agent_name, "my-agent")
        self.assertEqual(req.response_format, {"type": "json_object"})
        self.assertEqual(req.interrupt_on, {"tool_calls": ["bash"]})

    def test_propagates_none_defaults(self):
        """to_llm_request() propagates None when fields are not set on Assistant."""
        assistant = Assistant(name="DefaultTest", tools=[])
        req = assistant.to_llm_request(input=self._make_input())
        self.assertIsNone(req.skills)
        self.assertIsNone(req.memory)
        self.assertIsNone(req.agent_name)
        self.assertIsNone(req.response_format)
        self.assertIsNone(req.interrupt_on)

    def test_propagates_partial_fields(self):
        """to_llm_request() correctly propagates a mix of set and unset fields."""
        assistant = Assistant(
            name="Partial",
            tools=[],
            skills=["only-skill"],
            agent_name="partial-agent",
        )
        req = assistant.to_llm_request(input=self._make_input())
        self.assertEqual(req.skills, ["only-skill"])
        self.assertIsNone(req.memory)
        self.assertEqual(req.agent_name, "partial-agent")
        self.assertIsNone(req.response_format)
        self.assertIsNone(req.interrupt_on)


if __name__ == "__main__":
    unittest.main()
