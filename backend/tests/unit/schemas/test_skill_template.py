"""Test skill template schema module."""

import unittest
from src.schemas.entities.skill import SkillTemplate, SkillsResponse


class TestSkillTemplate(unittest.TestCase):
    """Tests for SkillTemplate schema."""

    def test_skill_template_creation(self):
        """Test valid skill template creation."""
        skill = SkillTemplate(
            name="Test Skill",
            description="A test skill",
            system_prompt="You are a test agent.",
            tools=["web_search"]
        )

        assert skill.name == "Test Skill"
        assert skill.description == "A test skill"
        assert skill.enabled is True
        assert skill.category == "general"

    def test_slug_generation(self):
        """Test that slug is correctly computed from name."""
        skill = SkillTemplate(
            name="Test Skill Name",
            description="Test",
            system_prompt="Prompt"
        )

        assert skill.slug == "test-skill-name"

    def test_slug_with_special_characters(self):
        """Test slug generation with special characters."""
        skill = SkillTemplate(
            name="Test Skill (v2.0)",
            description="Test",
            system_prompt="Prompt"
        )

        # Should only contain alphanumeric and hyphens
        assert "-" in skill.slug or skill.slug.isalnum()
        assert " " not in skill.slug
        assert "(" not in skill.slug

    def test_to_subagent_dict(self):
        """Test conversion to subagent dictionary format."""
        skill = SkillTemplate(
            name="Test Skill",
            description="Test description",
            system_prompt="Test prompt",
            tools=["tool1", "tool2"]
        )

        result = skill.to_subagent_dict()

        assert result["name"] == "test-skill"
        assert result["description"] == "Test description"
        assert result["system_prompt"] == "Test prompt"
        assert result["tools"] == ["tool1", "tool2"]
        assert "model" not in result

    def test_to_subagent_dict_with_model(self):
        """Test conversion includes model when specified."""
        skill = SkillTemplate(
            name="Test Skill",
            description="Test",
            system_prompt="Prompt",
            model="gpt-4"
        )

        result = skill.to_subagent_dict()

        assert result["model"] == "gpt-4"

    def test_default_tools_empty_list(self):
        """Test that tools defaults to empty list."""
        skill = SkillTemplate(
            name="Test",
            description="Test",
            system_prompt="Prompt"
        )

        assert skill.tools == []

    def test_disabled_skill(self):
        """Test creating a disabled skill."""
        skill = SkillTemplate(
            name="Disabled Skill",
            description="Test",
            system_prompt="Prompt",
            enabled=False
        )

        assert skill.enabled is False


class TestSkillsResponse(unittest.TestCase):
    """Tests for SkillsResponse schema."""

    def test_skills_response_total(self):
        """Test that total is computed from skills list."""
        skill1 = SkillTemplate(
            name="Skill 1",
            description="Test",
            system_prompt="Prompt"
        )
        skill2 = SkillTemplate(
            name="Skill 2",
            description="Test",
            system_prompt="Prompt"
        )

        response = SkillsResponse(skills=[skill1, skill2])

        assert response.total == 2

    def test_empty_skills_response(self):
        """Test empty skills response."""
        response = SkillsResponse(skills=[])

        assert response.total == 0
        assert response.skills == []
