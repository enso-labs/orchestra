"""Skill service for managing skill templates."""

from typing import Optional
from src.schemas.entities.skill import SkillTemplate
from src.constants.skills import BUILTIN_SKILLS


class SkillService:
    """Service for retrieving and managing skill templates."""

    def __init__(self, user_id: Optional[str] = None):
        self.user_id = user_id

    async def get_enabled_skills(
        self, categories: Optional[list[str]] = None
    ) -> list[SkillTemplate]:
        """Get all enabled skills, optionally filtered by category."""
        skills = [s for s in BUILTIN_SKILLS if s.enabled]

        if categories:
            skills = [s for s in skills if s.category in categories]

        return skills

    async def get_skill(self, slug: str) -> Optional[SkillTemplate]:
        """Get a skill by its slug."""
        for skill in BUILTIN_SKILLS:
            if skill.slug == slug:
                return skill
        return None

    async def get_all_skills(self) -> list[SkillTemplate]:
        """Get all skills regardless of enabled status."""
        return list(BUILTIN_SKILLS)


# Default service instance
skill_service = SkillService()
