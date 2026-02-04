"""Test skill service module."""

import unittest
from src.services.skill import SkillService, skill_service
from src.constants.skills import BUILTIN_SKILLS


class TestSkillService(unittest.IsolatedAsyncioTestCase):
    """Tests for SkillService."""

    async def asyncSetUp(self):
        self.service = SkillService(user_id="test-user")

    async def test_get_enabled_skills_returns_builtins(self):
        """Test that get_enabled_skills returns built-in skills."""
        skills = await self.service.get_enabled_skills()

        assert len(skills) >= 2
        assert any(s.slug == "research-agent" for s in skills)
        assert any(s.slug == "code-engineer" for s in skills)

    async def test_get_skill_by_slug(self):
        """Test retrieving specific skill by slug."""
        skill = await self.service.get_skill("research-agent")

        assert skill is not None
        assert skill.name == "Research Agent"
        assert "web_search" in skill.tools
        assert skill.category == "research"

    async def test_get_nonexistent_skill_returns_none(self):
        """Test that nonexistent skill returns None."""
        skill = await self.service.get_skill("nonexistent-skill")
        assert skill is None

    async def test_category_filtering(self):
        """Test filtering skills by category."""
        skills = await self.service.get_enabled_skills(categories=["research"])

        assert len(skills) >= 1
        assert all(s.category == "research" for s in skills)

    async def test_category_filtering_empty_result(self):
        """Test that filtering by nonexistent category returns empty list."""
        skills = await self.service.get_enabled_skills(categories=["nonexistent"])
        assert len(skills) == 0

    async def test_get_all_skills(self):
        """Test getting all skills regardless of enabled status."""
        skills = await self.service.get_all_skills()
        assert len(skills) == len(BUILTIN_SKILLS)

    async def test_default_service_instance(self):
        """Test that default service instance works."""
        skills = await skill_service.get_enabled_skills()
        assert len(skills) >= 2
