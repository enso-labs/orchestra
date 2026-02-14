"""Unit tests for prepare_skill_files() helper."""

import unittest

from langgraph.store.memory import InMemoryStore

from src.agents import prepare_skill_files
from src.schemas.entities.skill import SkillCreate
from src.services.skill import SkillService


TEST_USER_ID = "test-user-skill-files"


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


class TestPrepareSkillFilesEmpty(unittest.IsolatedAsyncioTestCase):
    """Tests for cases that should return ({}, None)."""

    async def test_returns_empty_when_user_id_is_none(self) -> None:
        store = InMemoryStore()
        service = SkillService(user_id=TEST_USER_ID, store=store)
        files, sources = await prepare_skill_files(None, service)
        self.assertEqual(files, {})
        self.assertIsNone(sources)

    async def test_returns_empty_when_user_id_is_empty_string(self) -> None:
        store = InMemoryStore()
        service = SkillService(user_id=TEST_USER_ID, store=store)
        files, sources = await prepare_skill_files("", service)
        self.assertEqual(files, {})
        self.assertIsNone(sources)

    async def test_returns_empty_when_no_skills_exist(self) -> None:
        store = InMemoryStore()
        service = SkillService(user_id=TEST_USER_ID, store=store)
        files, sources = await prepare_skill_files(TEST_USER_ID, service)
        self.assertEqual(files, {})
        self.assertIsNone(sources)

    async def test_returns_empty_when_all_skills_disabled(self) -> None:
        store = InMemoryStore()
        service = SkillService(user_id=TEST_USER_ID, store=store)
        await service.create(_make_create(name="disabled-skill"))
        await service.toggle("disabled-skill")

        files, sources = await prepare_skill_files(TEST_USER_ID, service)
        self.assertEqual(files, {})
        self.assertIsNone(sources)


class TestPrepareSkillFilesWithSkills(unittest.IsolatedAsyncioTestCase):
    """Tests for cases that should return populated files_map and sources."""

    async def test_generates_correct_paths_for_enabled_skills(self) -> None:
        store = InMemoryStore()
        service = SkillService(user_id=TEST_USER_ID, store=store)
        await service.create(_make_create(name="my-skill"))
        await service.create(_make_create(name="another-skill"))

        files, sources = await prepare_skill_files(TEST_USER_ID, service)

        self.assertIn("/skills/my-skill/SKILL.md", files)
        self.assertIn("/skills/another-skill/SKILL.md", files)
        self.assertEqual(len(files), 2)

    async def test_skill_md_content_includes_yaml_frontmatter(self) -> None:
        store = InMemoryStore()
        service = SkillService(user_id=TEST_USER_ID, store=store)
        await service.create(
            _make_create(name="yaml-test", description="Test YAML", tags=["a", "b"])
        )

        files, _ = await prepare_skill_files(TEST_USER_ID, service)
        file_data = files["/skills/yaml-test/SKILL.md"]
        content = file_data["content"]
        # content is a list of lines from create_file_data
        full_text = "\n".join(content) if isinstance(content, list) else content
        self.assertIn("---", full_text)
        self.assertIn("name: yaml-test", full_text)
        self.assertIn("description: Test YAML", full_text)

    async def test_disabled_skills_excluded(self) -> None:
        store = InMemoryStore()
        service = SkillService(user_id=TEST_USER_ID, store=store)
        await service.create(_make_create(name="enabled-skill"))
        await service.create(_make_create(name="disabled-skill"))
        await service.toggle("disabled-skill")

        files, sources = await prepare_skill_files(TEST_USER_ID, service)

        self.assertIn("/skills/enabled-skill/SKILL.md", files)
        self.assertNotIn("/skills/disabled-skill/SKILL.md", files)

    async def test_returns_skill_source_paths(self) -> None:
        store = InMemoryStore()
        service = SkillService(user_id=TEST_USER_ID, store=store)
        await service.create(_make_create(name="source-test"))

        _, sources = await prepare_skill_files(TEST_USER_ID, service)

        self.assertIsNotNone(sources)
        self.assertIsInstance(sources, list)
        self.assertTrue(len(sources) > 0)
        self.assertIn("/skills/", sources)


if __name__ == "__main__":
    unittest.main()
