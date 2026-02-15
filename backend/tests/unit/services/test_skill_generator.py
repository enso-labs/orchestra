"""Unit tests for SkillGeneratorService."""

import unittest
from unittest.mock import AsyncMock, patch, MagicMock

from src.services.skill_generator import SkillGeneratorService


MOCK_GENERATED_CONTENT = """\
## Purpose

This skill enables automated code review by analyzing code changes and providing actionable feedback.

## Instructions

1. Analyze the diff or code snippet provided.
2. Identify potential issues: bugs, security vulnerabilities, performance concerns.
3. Suggest improvements with concrete code examples.
4. Summarize findings in a structured report.

## Examples

### Example: Reviewing a Python function

Input: A function with an SQL injection vulnerability.

Output: Flag the vulnerability, suggest parameterized queries, provide corrected code.

## Guidelines

- Focus on high-impact issues first.
- Provide specific line references when possible.
- Keep suggestions actionable and concise."""


class TestSkillGeneratorService(unittest.IsolatedAsyncioTestCase):
    def _mock_llm(self, content: str = MOCK_GENERATED_CONTENT):
        """Create a mock LLM that returns the given content."""
        mock_response = MagicMock()
        mock_response.content = content
        mock_llm = AsyncMock()
        mock_llm.ainvoke = AsyncMock(return_value=mock_response)
        return mock_llm

    @patch("src.services.skill_generator.init_chat_model")
    async def test_generated_content_includes_expected_sections(
        self, mock_init: MagicMock
    ) -> None:
        """Generated content includes expected sections like Purpose and Instructions."""
        mock_init.return_value = self._mock_llm()
        service = SkillGeneratorService()
        result = await service.generate(
            name="code-review",
            description="Automated code review skill",
        )
        self.assertIn("## Purpose", result["content"])
        self.assertIn("## Instructions", result["content"])

    @patch("src.services.skill_generator.init_chat_model")
    async def test_skill_name_passed_to_llm(self, mock_init: MagicMock) -> None:
        """Skill name is included in the prompt sent to the LLM."""
        mock_llm = self._mock_llm()
        mock_init.return_value = mock_llm
        service = SkillGeneratorService()
        await service.generate(
            name="code-review",
            description="Automated code review",
        )
        call_args = mock_llm.ainvoke.call_args[0][0]
        user_message = call_args[1].content
        self.assertIn("code-review", user_message)

    @patch("src.services.skill_generator.init_chat_model")
    async def test_tags_passed_through_to_output(self, mock_init: MagicMock) -> None:
        """Tags are passed through to the output dict."""
        mock_init.return_value = self._mock_llm()
        service = SkillGeneratorService()
        result = await service.generate(
            name="code-review",
            description="Automated code review",
            tags=["python", "review"],
        )
        self.assertEqual(result["tags"], ["python", "review"])

    @patch("src.services.skill_generator.init_chat_model")
    async def test_tags_included_in_prompt(self, mock_init: MagicMock) -> None:
        """Tags are included in the user prompt sent to the LLM."""
        mock_llm = self._mock_llm()
        mock_init.return_value = mock_llm
        service = SkillGeneratorService()
        await service.generate(
            name="code-review",
            description="Review code",
            tags=["python", "security"],
        )
        call_args = mock_llm.ainvoke.call_args[0][0]
        user_message = call_args[1].content
        self.assertIn("python", user_message)
        self.assertIn("security", user_message)

    @patch("src.services.skill_generator.init_chat_model")
    async def test_content_respects_word_count(self, mock_init: MagicMock) -> None:
        """Generated content is under 5000 words."""
        mock_init.return_value = self._mock_llm()
        service = SkillGeneratorService()
        result = await service.generate(
            name="code-review",
            description="Automated code review",
        )
        word_count = len(result["content"].split())
        self.assertLess(word_count, 5000)

    @patch("src.services.skill_generator.init_chat_model")
    async def test_description_passed_through(self, mock_init: MagicMock) -> None:
        """Description is passed through to the output."""
        mock_init.return_value = self._mock_llm()
        service = SkillGeneratorService()
        result = await service.generate(
            name="code-review",
            description="Automated code review skill for Python",
        )
        self.assertEqual(
            result["description"], "Automated code review skill for Python"
        )

    @patch("src.services.skill_generator.init_chat_model")
    async def test_empty_tags_default(self, mock_init: MagicMock) -> None:
        """Empty tags default to empty list in output."""
        mock_init.return_value = self._mock_llm()
        service = SkillGeneratorService()
        result = await service.generate(
            name="code-review",
            description="Review code",
        )
        self.assertEqual(result["tags"], [])

    @patch("src.services.skill_generator.init_chat_model")
    async def test_llm_error_raises(self, mock_init: MagicMock) -> None:
        """LLM invocation error is raised to the caller."""
        mock_llm = AsyncMock()
        mock_llm.ainvoke = AsyncMock(side_effect=RuntimeError("LLM unavailable"))
        mock_init.return_value = mock_llm
        service = SkillGeneratorService()
        with self.assertRaises(RuntimeError):
            await service.generate(
                name="code-review",
                description="Review code",
            )


if __name__ == "__main__":
    unittest.main()
