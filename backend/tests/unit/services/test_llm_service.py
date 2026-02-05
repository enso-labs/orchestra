"""Unit and integration tests for LLMService."""

import pytest
from unittest.mock import AsyncMock

from loguru import logger

from src.constants.llm import DEFAULT_SYSTEM_PROMPT
from src.schemas.entities.llm import Assistant, LLMRequest
from src.services.llm import LLMService


class TestExtractAgentsMd:
    """Tests for the extract_agents_md static method."""

    def test_none_files_returns_none(self):
        assert LLMService.extract_agents_md(None) is None

    def test_empty_dict_returns_none(self):
        assert LLMService.extract_agents_md({}) is None

    def test_missing_agents_md_key_returns_none(self):
        assert LLMService.extract_agents_md({"README.md": "content"}) is None

    def test_string_value_returns_stripped_content(self):
        result = LLMService.extract_agents_md({"AGENTS.md": "  hello world  "})
        assert result == "hello world"

    def test_dict_with_content_as_string(self):
        result = LLMService.extract_agents_md(
            {"AGENTS.md": {"content": "  instructions  "}}
        )
        assert result == "instructions"

    def test_dict_with_content_as_list(self):
        result = LLMService.extract_agents_md(
            {"AGENTS.md": {"content": ["line1", "line2", "line3"]}}
        )
        assert result == "line1\nline2\nline3"

    def test_dict_with_content_as_none(self):
        result = LLMService.extract_agents_md({"AGENTS.md": {"content": None}})
        assert result is None

    def test_list_value_returns_joined_content(self):
        result = LLMService.extract_agents_md({"AGENTS.md": ["line1", "line2"]})
        assert result == "line1\nline2"

    def test_empty_string_returns_none(self):
        assert LLMService.extract_agents_md({"AGENTS.md": ""}) is None

    def test_whitespace_only_returns_none(self):
        assert LLMService.extract_agents_md({"AGENTS.md": "   \n\t  "}) is None


def _make_llm_request(**overrides) -> LLMRequest:
    """Helper to build a minimal LLMRequest for testing."""
    defaults = {
        "input": {"messages": [{"role": "user", "content": "hi"}]},
        "metadata": {},
    }
    defaults.update(overrides)
    return LLMRequest(**defaults)


def _make_assistant(**overrides) -> Assistant:
    """Helper to build a minimal Assistant for testing."""
    defaults = {
        "name": "Test",
        "tools": [],
    }
    defaults.update(overrides)
    return Assistant(**defaults)


def _make_service() -> LLMService:
    """Helper to build an LLMService with mocked dependencies."""
    assistant_service = AsyncMock()
    assistant_service.get = AsyncMock(return_value=None)
    assistant_service.get_public = AsyncMock(return_value=None)
    svc = LLMService(
        user_id="test-user",
        assistant_service=assistant_service,
        config={"configurable": {"thread_id": "t1"}, "metadata": {}},
    )
    svc.init_tools = AsyncMock(return_value=[])
    return svc


class TestAssistantAgentsMdInjection:
    """Integration tests for AGENTS.md injection in LLMService.assistant()."""

    @pytest.mark.asyncio
    async def test_agent_with_agents_md_injects_instructions(self):
        """Agent with AGENTS.md in files => instructions contains AGENTS.md content."""
        svc = _make_service()
        assistant = _make_assistant(
            files={"AGENTS.md": "Be a coding agent"},
        )
        svc.assistant_service.get.return_value = assistant

        params = _make_llm_request(metadata={"assistant_id": "a1"})
        result = await svc.assistant(params)

        assert result.instructions == "Be a coding agent"
        assert result.system_prompt == DEFAULT_SYSTEM_PROMPT

    @pytest.mark.asyncio
    async def test_agent_without_agents_md_uses_original(self):
        """Agent without AGENTS.md => uses original system_prompt, no instructions."""
        svc = _make_service()
        assistant = _make_assistant(
            system_prompt="Custom prompt",
            files={"README.md": "readme content"},
        )
        svc.assistant_service.get.return_value = assistant

        params = _make_llm_request(metadata={"assistant_id": "a1"})
        result = await svc.assistant(params)

        assert result.system_prompt == "Custom prompt"
        assert result.instructions is None

    @pytest.mark.asyncio
    async def test_agent_agents_md_overrides_existing_instructions_with_warning(self):
        """Agent with AGENTS.md AND existing instructions => AGENTS.md wins, warning logged."""
        svc = _make_service()
        assistant = _make_assistant(
            instructions="Old instructions",
            files={"AGENTS.md": "New from AGENTS.md"},
        )
        svc.assistant_service.get.return_value = assistant

        captured: list[str] = []
        sink_id = logger.add(lambda msg: captured.append(str(msg)), level="WARNING")

        params = _make_llm_request(metadata={"assistant_id": "a1"})
        try:
            result = await svc.assistant(params)
        finally:
            logger.remove(sink_id)

        assert result.instructions == "New from AGENTS.md"
        assert any("overrides existing instructions" in m for m in captured)

    @pytest.mark.asyncio
    async def test_non_agent_with_agents_md_injects_instructions(self):
        """Non-agent mode with AGENTS.md in input files => instructions set."""
        svc = _make_service()

        params = _make_llm_request(
            input={
                "messages": [{"role": "user", "content": "hi"}],
                "files": {"AGENTS.md": "Thread-level instructions"},
            },
        )
        result = await svc.assistant(params)

        assert result.instructions == "Thread-level instructions"
        assert result.system_prompt == DEFAULT_SYSTEM_PROMPT

    @pytest.mark.asyncio
    async def test_non_agent_without_agents_md_unchanged(self):
        """Non-agent mode without AGENTS.md => instructions unchanged."""
        svc = _make_service()

        params = _make_llm_request(
            input={
                "messages": [{"role": "user", "content": "hi"}],
                "files": {"other.txt": "data"},
            },
        )
        result = await svc.assistant(params)

        assert result.instructions == ""
        assert result.system_prompt == DEFAULT_SYSTEM_PROMPT
