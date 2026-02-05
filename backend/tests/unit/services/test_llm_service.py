"""Unit tests for LLMService.extract_agents_md() helper."""

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
