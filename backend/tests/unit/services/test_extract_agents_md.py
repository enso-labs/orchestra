"""Unit and integration tests for LLMService.extract_agents_md() and AGENTS.md injection."""

import unittest
from unittest.mock import AsyncMock, patch, MagicMock
from uuid import uuid4

from src.services.llm import LLMService
from src.schemas.entities.llm import (
    Assistant,
    Config,
    LLMInput,
    LLMRequest,
)
from src.constants.llm import DEFAULT_SYSTEM_PROMPT


class TestExtractAgentsMd(unittest.TestCase):
    """Tests for the extract_agents_md static method."""

    def test_none_files_returns_none(self):
        """Test: None files dict returns None."""
        result = LLMService.extract_agents_md(None)
        self.assertIsNone(result)

    def test_empty_files_returns_none(self):
        """Test: Empty files dict returns None."""
        result = LLMService.extract_agents_md({})
        self.assertIsNone(result)

    def test_missing_key_returns_none(self):
        """Test: Files dict without 'AGENTS.md' key returns None."""
        result = LLMService.extract_agents_md({"README.md": "# Hello"})
        self.assertIsNone(result)

    def test_plain_string_returns_stripped_content(self):
        """Test: AGENTS.md as plain string returns stripped content."""
        result = LLMService.extract_agents_md({"AGENTS.md": "  # Instructions  \n"})
        self.assertEqual(result, "# Instructions")

    def test_dict_with_content_string_returns_stripped_content(self):
        """Test: AGENTS.md as dict with 'content' as string returns stripped content."""
        result = LLMService.extract_agents_md(
            {"AGENTS.md": {"content": "  # Instructions  "}}
        )
        self.assertEqual(result, "# Instructions")

    def test_dict_with_content_list_returns_joined_content(self):
        """Test: AGENTS.md as dict with 'content' as list of strings returns joined content."""
        result = LLMService.extract_agents_md(
            {"AGENTS.md": {"content": ["# Title", "Line 2", "Line 3"]}}
        )
        self.assertEqual(result, "# Title\nLine 2\nLine 3")

    def test_dict_with_content_none_returns_none(self):
        """Test: AGENTS.md as dict with 'content' as None returns None."""
        result = LLMService.extract_agents_md({"AGENTS.md": {"content": None}})
        self.assertIsNone(result)

    def test_list_returns_joined_content(self):
        """Test: AGENTS.md as list of strings returns joined content."""
        result = LLMService.extract_agents_md(
            {"AGENTS.md": ["# Title", "Line 2", "Line 3"]}
        )
        self.assertEqual(result, "# Title\nLine 2\nLine 3")

    def test_empty_string_returns_none(self):
        """Test: AGENTS.md with empty string value returns None."""
        result = LLMService.extract_agents_md({"AGENTS.md": ""})
        self.assertIsNone(result)

    def test_whitespace_only_returns_none(self):
        """Test: AGENTS.md with whitespace-only value returns None."""
        result = LLMService.extract_agents_md({"AGENTS.md": "   \n\t  "})
        self.assertIsNone(result)


class TestAgentsMdInjectionInAssistant(unittest.IsolatedAsyncioTestCase):
    """Integration tests for AGENTS.md injection in LLMService.assistant()."""

    async def asyncSetUp(self):
        """Set up test fixtures with mocked dependencies."""
        self.user_id = str(uuid4())
        self.thread_id = str(uuid4())
        self.assistant_id = str(uuid4())

        # Mock dependencies
        self.mock_assistant_service = MagicMock()
        self.mock_assistant_service.get = AsyncMock(return_value=None)
        self.mock_assistant_service.get_public = AsyncMock(return_value=None)

        self.mock_tool_service = MagicMock()

        self.mock_store = MagicMock()

        self.mock_config = {
            "configurable": {"thread_id": self.thread_id},
            "metadata": {},
        }

        self.service = LLMService(
            user_id=self.user_id,
            store=self.mock_store,
            tool_service=self.mock_tool_service,
            assistant_service=self.mock_assistant_service,
            config=self.mock_config,
        )

    def _make_params(
        self, assistant_id: str | None = None, files: dict | None = None
    ) -> LLMRequest:
        """Helper to create LLMRequest params for testing."""
        return LLMRequest(
            input=LLMInput(
                messages=[LLMInput.ChatMessage(role="user", content="Hello")],
                files=files or {},
            ),
            metadata=Config(
                thread_id=self.thread_id,
                assistant_id=assistant_id,
            ),
        )

    @patch.object(LLMService, "init_tools", new_callable=AsyncMock)
    async def test_agent_with_agents_md_injects_instructions(self, mock_init_tools):
        """Test: Agent with AGENTS.md in assistant.files — returned LLMRequest.instructions contains AGENTS.md content."""
        mock_init_tools.return_value = []
        agents_md_content = "# Custom Agent Instructions\nYou are a specialized agent."

        assistant = Assistant(
            name="Test Agent",
            tools=[],
            files={"AGENTS.md": agents_md_content},
        )
        self.mock_assistant_service.get.return_value = assistant

        params = self._make_params(assistant_id=self.assistant_id)
        result = await self.service.assistant(params)

        self.assertEqual(result.instructions, agents_md_content)
        self.assertEqual(result.system_prompt, DEFAULT_SYSTEM_PROMPT)

    @patch.object(LLMService, "init_tools", new_callable=AsyncMock)
    async def test_agent_without_agents_md_uses_original(self, mock_init_tools):
        """Test: Agent without AGENTS.md — returned LLMRequest uses original instructions/system_prompt."""
        mock_init_tools.return_value = []
        original_instructions = "Original instructions"

        assistant = Assistant(
            name="Test Agent",
            tools=[],
            instructions=original_instructions,
            files={"README.md": "# Hello"},
        )
        self.mock_assistant_service.get.return_value = assistant

        params = self._make_params(assistant_id=self.assistant_id)
        result = await self.service.assistant(params)

        self.assertEqual(result.instructions, original_instructions)

    @patch.object(LLMService, "init_tools", new_callable=AsyncMock)
    async def test_agent_agents_md_overrides_existing_instructions_with_warning(
        self, mock_init_tools
    ):
        """Test: Agent with AGENTS.md AND existing instructions — AGENTS.md wins, warning is logged."""
        mock_init_tools.return_value = []
        agents_md_content = "# AGENTS.md instructions"

        assistant = Assistant(
            name="Test Agent",
            tools=[],
            instructions="Original instructions that should be overridden",
            files={"AGENTS.md": agents_md_content},
        )
        self.mock_assistant_service.get.return_value = assistant

        params = self._make_params(assistant_id=self.assistant_id)

        with patch("src.services.llm.logger") as mock_logger:
            result = await self.service.assistant(params)

            # AGENTS.md content wins
            self.assertEqual(result.instructions, agents_md_content)

            # Warning was logged about override
            warning_calls = [str(call) for call in mock_logger.warning.call_args_list]
            self.assertTrue(
                any("overriding" in call.lower() for call in warning_calls),
                f"Expected warning about overriding, got: {warning_calls}",
            )

    @patch.object(LLMService, "init_tools", new_callable=AsyncMock)
    async def test_thread_mode_with_agents_md_sets_instructions(self, mock_init_tools):
        """Test: Non-agent mode with AGENTS.md in params.input.files — params.instructions is set."""
        mock_init_tools.return_value = []
        agents_md_content = "# Thread-level instructions"

        params = self._make_params(
            assistant_id=None,
            files={"AGENTS.md": agents_md_content},
        )
        result = await self.service.assistant(params)

        self.assertEqual(result.instructions, agents_md_content)

    @patch.object(LLMService, "init_tools", new_callable=AsyncMock)
    async def test_thread_mode_without_agents_md_unchanged(self, mock_init_tools):
        """Test: Non-agent mode without AGENTS.md — params.instructions unchanged."""
        mock_init_tools.return_value = []

        params = self._make_params(
            assistant_id=None,
            files={"README.md": "# Just a readme"},
        )
        original_instructions = params.instructions
        result = await self.service.assistant(params)

        self.assertEqual(result.instructions, original_instructions)


if __name__ == "__main__":
    unittest.main()
