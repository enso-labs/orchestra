"""Unit tests for AGENTS.md extraction in LLMService.assistant().

Tests verify that LLMService correctly extracts AGENTS.md content from
assistant.files and uses it as instructions for agent behavior.
"""

import unittest
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from src.schemas.entities.llm import Assistant, LLMInput, LLMRequest, Config
from src.services.llm import LLMService


def _make_llm_input(message: str = "Hello") -> LLMInput:
    """Create a minimal LLMInput for testing."""
    return LLMInput(
        messages=[LLMInput.ChatMessage(role="user", content=message)],
    )


def _make_params(assistant_id: str = None, files: dict = None) -> LLMRequest:
    """Create a minimal LLMRequest for testing."""
    metadata = Config(
        thread_id=str(uuid4()),
        assistant_id=assistant_id,
    )
    return LLMRequest(
        input=_make_llm_input(),
        metadata=metadata,
        tools=[],
        **(
            {
                "input": LLMInput(
                    messages=[LLMInput.ChatMessage(role="user", content="Hello")],
                    files=files,
                )
            }
            if files
            else {}
        ),
    )


class TestAgentsMdExtractionFromAssistantFiles(unittest.IsolatedAsyncioTestCase):
    """Tests for AGENTS.md extraction from assistant.files (agent mode)."""

    async def asyncSetUp(self):
        """Set up test fixtures with mocked dependencies."""
        self.assistant_service = AsyncMock()
        self.tool_service = MagicMock()
        self.tool_service.mcp_tools = AsyncMock(return_value=[])

        self.service = LLMService(
            user_id=str(uuid4()),
            assistant_service=self.assistant_service,
            tool_service=self.tool_service,
            config={"configurable": {"thread_id": str(uuid4())}, "metadata": {}},
        )

    async def test_agents_md_sets_instructions(self):
        """When assistant.files contains 'AGENTS.md', instructions is set to that value."""
        agents_md_content = (
            "You are a specialized coding assistant. Always respond with code examples."
        )
        assistant = Assistant(
            id=str(uuid4()),
            name="Test Agent",
            description="Test",
            tools=[],
            files={"AGENTS.md": agents_md_content},
        )
        self.assistant_service.get.return_value = assistant

        params = _make_params(assistant_id=assistant.id)
        result = await self.service.assistant(params)

        self.assertEqual(result.instructions, agents_md_content)

    async def test_agents_md_sets_system_prompt_to_default(self):
        """When AGENTS.md is present, system_prompt falls back to DEFAULT_SYSTEM_PROMPT."""
        agents_md_content = "Custom instructions from AGENTS.md"
        assistant = Assistant(
            id=str(uuid4()),
            name="Test Agent",
            description="Test",
            tools=[],
            system_prompt="Old custom system prompt",
            files={"AGENTS.md": agents_md_content},
        )
        self.assistant_service.get.return_value = assistant

        params = _make_params(assistant_id=assistant.id)
        result = await self.service.assistant(params)

        # system_prompt should be set to None so default_system_prompt() returns DEFAULT_SYSTEM_PROMPT
        from src.constants.llm import DEFAULT_SYSTEM_PROMPT

        self.assertEqual(result.system_prompt, DEFAULT_SYSTEM_PROMPT)
        self.assertEqual(result.instructions, agents_md_content)

    async def test_no_agents_md_preserves_existing_instructions(self):
        """When assistant.files does NOT contain 'AGENTS.md', existing instructions are unchanged."""
        assistant = Assistant(
            id=str(uuid4()),
            name="Test Agent",
            description="Test",
            tools=[],
            instructions="Original instructions",
            files={"/README.md": "# Readme content"},
        )
        self.assistant_service.get.return_value = assistant

        params = _make_params(assistant_id=assistant.id)
        result = await self.service.assistant(params)

        self.assertEqual(result.instructions, "Original instructions")

    async def test_no_agents_md_preserves_existing_system_prompt(self):
        """When assistant.files does NOT contain 'AGENTS.md', existing system_prompt is unchanged."""
        assistant = Assistant(
            id=str(uuid4()),
            name="Test Agent",
            description="Test",
            tools=[],
            system_prompt="Custom system prompt",
            files={"/README.md": "# Readme"},
        )
        self.assistant_service.get.return_value = assistant

        params = _make_params(assistant_id=assistant.id)
        result = await self.service.assistant(params)

        self.assertEqual(result.system_prompt, "Custom system prompt")

    async def test_empty_files_dict_no_error(self):
        """When assistant.files is empty dict, no error occurs and fields are unchanged."""
        assistant = Assistant(
            id=str(uuid4()),
            name="Test Agent",
            description="Test",
            tools=[],
            system_prompt="Keep this prompt",
            files={},
        )
        self.assistant_service.get.return_value = assistant

        params = _make_params(assistant_id=assistant.id)
        result = await self.service.assistant(params)

        self.assertEqual(result.system_prompt, "Keep this prompt")

    async def test_none_files_no_error(self):
        """When assistant.files is None, no error occurs and fields are unchanged."""
        assistant = Assistant(
            id=str(uuid4()),
            name="Test Agent",
            description="Test",
            tools=[],
            system_prompt="Keep this prompt",
        )
        # Manually set files to None to simulate edge case
        object.__setattr__(assistant, "files", None)
        self.assistant_service.get.return_value = assistant

        params = _make_params(assistant_id=assistant.id)
        result = await self.service.assistant(params)

        self.assertEqual(result.system_prompt, "Keep this prompt")


if __name__ == "__main__":
    unittest.main()
