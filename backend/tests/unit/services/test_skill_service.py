"""Unit tests for SkillService business logic."""

import unittest

from langgraph.store.memory import InMemoryStore

from src.schemas.entities.skill import SkillCreate, SkillUpdate
from src.services.skill import SkillService


TEST_USER_ID = "test-user-skill-service"


def _make_create(name: str = "test-skill", **kwargs) -> SkillCreate:
    defaults = {
        "name": name,
        "description": "A test skill",
        "content": "# Test\nDo something useful.",
        "tags": ["test"],
        "allowed_tools": [],
    }
    defaults.update(kwargs)
    return SkillCreate(**defaults)


class TestSkillService(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.store = InMemoryStore()
        self.service = SkillService(user_id=TEST_USER_ID, store=self.store)

    async def test_create_skill(self) -> None:
        """Create a skill through service."""
        data = _make_create()
        skill = await self.service.create(data)
        self.assertEqual(skill.name, "test-skill")
        self.assertEqual(skill.description, "A test skill")
        self.assertFalse(skill.disabled)

    async def test_toggle_disabled_false_to_true(self) -> None:
        """Toggle flips disabled from False to True."""
        await self.service.create(_make_create())
        toggled = await self.service.toggle("test-skill")
        self.assertIsNotNone(toggled)
        self.assertTrue(toggled.disabled)

    async def test_toggle_disabled_true_to_false(self) -> None:
        """Toggle flips disabled from True back to False."""
        await self.service.create(_make_create())
        await self.service.toggle("test-skill")
        toggled_back = await self.service.toggle("test-skill")
        self.assertIsNotNone(toggled_back)
        self.assertFalse(toggled_back.disabled)

    async def test_toggle_not_found(self) -> None:
        """Toggle a non-existent skill returns None."""
        result = await self.service.toggle("nonexistent")
        self.assertIsNone(result)

    async def test_search_enabled_only(self) -> None:
        """search_enabled returns only skills where disabled=False."""
        await self.service.create(_make_create(name="enabled-one"))
        await self.service.create(_make_create(name="enabled-two"))
        await self.service.create(_make_create(name="disabled-one"))
        await self.service.toggle("disabled-one")

        enabled, total = await self.service.search_enabled()
        enabled_names = [s.name for s in enabled]
        self.assertIn("enabled-one", enabled_names)
        self.assertIn("enabled-two", enabled_names)
        self.assertNotIn("disabled-one", enabled_names)
        self.assertEqual(total, 2)

    async def test_search_returns_all(self) -> None:
        """search returns all skills regardless of disabled state."""
        await self.service.create(_make_create(name="active-skill"))
        await self.service.create(_make_create(name="inactive-skill"))
        await self.service.toggle("inactive-skill")

        skills, total = await self.service.search()
        self.assertEqual(total, 2)

    async def test_update_through_service(self) -> None:
        """Update a skill through the service."""
        await self.service.create(_make_create())
        update = SkillUpdate(description="Updated description")
        updated = await self.service.update("test-skill", update)
        self.assertIsNotNone(updated)
        self.assertEqual(updated.description, "Updated description")
        self.assertEqual(updated.content, "# Test\nDo something useful.")

    async def test_delete_through_service(self) -> None:
        """Delete a skill through the service."""
        await self.service.create(_make_create())
        success = await self.service.delete("test-skill")
        self.assertTrue(success)
        skill = await self.service.get("test-skill")
        self.assertIsNone(skill)


if __name__ == "__main__":
    unittest.main()
