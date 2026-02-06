"""Unit tests for LLMService.extract_agents_md() helper method."""

import unittest

from src.services.llm import LLMService


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


if __name__ == "__main__":
    unittest.main()
