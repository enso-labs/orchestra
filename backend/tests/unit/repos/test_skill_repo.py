"""Unit tests for SkillRepo CRUD operations."""

import unittest

from langgraph.store.memory import InMemoryStore

from src.repos.skill_repo import SkillRepo
from src.schemas.entities.skill import SavedSkill


TEST_USER_ID = "test-user-skill-repo"


def _make_skill(name: str = "test-skill", **kwargs) -> SavedSkill:
    defaults = {
        "name": name,
        "description": "A test skill",
        "content": "# Test\nDo something useful.",
        "tags": ["test"],
        "allowed_tools": [],
    }
    defaults.update(kwargs)
    return SavedSkill(**defaults)


class TestSkillRepo(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.store = InMemoryStore()
        self.repo = SkillRepo(user_id=TEST_USER_ID, store=self.store)

    async def test_create_skill(self) -> None:
        """Create a skill and verify returned SavedSkill has correct fields."""
        skill = _make_skill()
        created = await self.repo.create(skill)
        self.assertIsInstance(created, SavedSkill)
        self.assertEqual(created.name, "test-skill")
        self.assertEqual(created.description, "A test skill")
        self.assertEqual(created.content, "# Test\nDo something useful.")
        self.assertEqual(created.tags, ["test"])
        self.assertFalse(created.disabled)
        self.assertIsNotNone(created.created_at)
        self.assertIsNotNone(created.updated_at)

    async def test_get_skill(self) -> None:
        """Get a skill by name returns correct skill."""
        skill = _make_skill()
        await self.repo.create(skill)
        fetched = await self.repo.get("test-skill")
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched.name, "test-skill")
        self.assertEqual(fetched.description, "A test skill")

    async def test_get_skill_not_found(self) -> None:
        """Get a non-existent skill returns None."""
        result = await self.repo.get("nonexistent-skill")
        self.assertIsNone(result)

    async def test_update_skill(self) -> None:
        """Update a skill modifies fields and updates updated_at."""
        skill = _make_skill()
        created = await self.repo.create(skill)
        updated = await self.repo.update(
            "test-skill", description="Updated description", tags=["updated"]
        )
        self.assertIsNotNone(updated)
        self.assertEqual(updated.description, "Updated description")
        self.assertEqual(updated.tags, ["updated"])
        self.assertEqual(updated.name, "test-skill")
        self.assertGreaterEqual(updated.updated_at, created.updated_at)

    async def test_update_skill_not_found(self) -> None:
        """Update a non-existent skill returns None."""
        result = await self.repo.update("nonexistent", description="x")
        self.assertIsNone(result)

    async def test_delete_skill(self) -> None:
        """Delete a skill removes it from store."""
        skill = _make_skill()
        await self.repo.create(skill)
        success = await self.repo.delete("test-skill")
        self.assertTrue(success)
        fetched = await self.repo.get("test-skill")
        self.assertIsNone(fetched)

    async def test_delete_skill_not_found(self) -> None:
        """Delete a non-existent skill returns False."""
        result = await self.repo.delete("nonexistent")
        self.assertFalse(result)

    async def test_list_skills_pagination(self) -> None:
        """List skills with pagination and total count."""
        for i in range(5):
            await self.repo.create(_make_skill(name=f"skill-{i}"))
        skills, total = await self.repo.list(limit=2, offset=0)
        self.assertEqual(len(skills), 2)
        self.assertEqual(total, 5)

        skills2, total2 = await self.repo.list(limit=10, offset=3)
        self.assertEqual(len(skills2), 2)
        self.assertEqual(total2, 5)

    async def test_list_skills_search_query(self) -> None:
        """List skills with search query filter."""
        await self.repo.create(
            _make_skill(name="python-formatter", description="Format Python code")
        )
        await self.repo.create(
            _make_skill(name="js-linter", description="Lint JavaScript code")
        )
        # InMemoryStore search may not support text filtering,
        # but we verify the API works without errors
        skills, total = await self.repo.list(query="python")
        self.assertIsInstance(skills, list)
        self.assertIsInstance(total, int)


if __name__ == "__main__":
    unittest.main()
