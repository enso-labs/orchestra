"""Unit tests for sync_skill_files_to_store() helper."""

import unittest

from langgraph.store.memory import InMemoryStore

from src.agents import sync_skill_files_to_store
from src.schemas.entities.skill import SkillCreate
from src.services.skill import SkillService


TEST_USER_ID = "test-user-sync"


def _make_file_data(content: str) -> dict:
    """Build a file_data dict matching create_file_data() output."""
    return {"content": content.split("\n")}


def _make_skill_md(
    name: str = "test-skill",
    description: str = "A test skill",
    tags: list[str] | None = None,
) -> str:
    """Build a SKILL.md string with YAML frontmatter."""
    tag_str = ", ".join(tags or [])
    return (
        f"---\n"
        f"name: {name}\n"
        f"description: {description}\n"
        f"tags: [{tag_str}]\n"
        f"allowed_tools: []\n"
        f"---\n"
        f"# {name}\nDo something useful."
    )


class TestSyncSkillFilesEmpty(unittest.IsolatedAsyncioTestCase):
    """Tests for cases that should return 0 synced."""

    async def test_returns_zero_when_files_map_is_empty(self) -> None:
        store = InMemoryStore()
        service = SkillService(user_id=TEST_USER_ID, store=store)
        count = await sync_skill_files_to_store({}, TEST_USER_ID, service)
        self.assertEqual(count, 0)

    async def test_returns_zero_when_files_map_is_none(self) -> None:
        store = InMemoryStore()
        service = SkillService(user_id=TEST_USER_ID, store=store)
        count = await sync_skill_files_to_store(None, TEST_USER_ID, service)
        self.assertEqual(count, 0)

    async def test_returns_zero_when_user_id_is_none(self) -> None:
        store = InMemoryStore()
        service = SkillService(user_id=TEST_USER_ID, store=store)
        files_map = {"/skills/test/SKILL.md": _make_file_data(_make_skill_md())}
        count = await sync_skill_files_to_store(files_map, None, service)
        self.assertEqual(count, 0)

    async def test_ignores_non_skill_paths(self) -> None:
        store = InMemoryStore()
        service = SkillService(user_id=TEST_USER_ID, store=store)
        files_map = {
            "/AGENTS.md": _make_file_data("# Agents"),
            "/memory/notes.md": _make_file_data("# Notes"),
            "/skills/README.md": _make_file_data("# README"),
        }
        count = await sync_skill_files_to_store(files_map, TEST_USER_ID, service)
        self.assertEqual(count, 0)


class TestSyncSkillFilesCreate(unittest.IsolatedAsyncioTestCase):
    """Tests for creating new skills from files_map."""

    async def test_creates_new_skill_from_valid_file(self) -> None:
        store = InMemoryStore()
        service = SkillService(user_id=TEST_USER_ID, store=store)
        files_map = {
            "/skills/my-new-skill/SKILL.md": _make_file_data(
                _make_skill_md(name="my-new-skill", description="Brand new skill")
            ),
        }
        count = await sync_skill_files_to_store(files_map, TEST_USER_ID, service)
        self.assertEqual(count, 1)

        # Verify skill was persisted
        skill = await service.get("my-new-skill")
        self.assertIsNotNone(skill)
        self.assertEqual(skill.name, "my-new-skill")
        self.assertEqual(skill.description, "Brand new skill")

    async def test_extracts_skill_name_from_path(self) -> None:
        store = InMemoryStore()
        service = SkillService(user_id=TEST_USER_ID, store=store)
        files_map = {
            "/skills/multi-word-name/SKILL.md": _make_file_data(
                _make_skill_md(name="multi-word-name")
            ),
        }
        count = await sync_skill_files_to_store(files_map, TEST_USER_ID, service)
        self.assertEqual(count, 1)

        skill = await service.get("multi-word-name")
        self.assertIsNotNone(skill)

    async def test_syncs_multiple_skills(self) -> None:
        store = InMemoryStore()
        service = SkillService(user_id=TEST_USER_ID, store=store)
        files_map = {
            "/skills/skill-a/SKILL.md": _make_file_data(_make_skill_md(name="skill-a")),
            "/skills/skill-b/SKILL.md": _make_file_data(_make_skill_md(name="skill-b")),
            "/skills/skill-c/SKILL.md": _make_file_data(_make_skill_md(name="skill-c")),
        }
        count = await sync_skill_files_to_store(files_map, TEST_USER_ID, service)
        self.assertEqual(count, 3)

        for name in ["skill-a", "skill-b", "skill-c"]:
            skill = await service.get(name)
            self.assertIsNotNone(skill, f"Skill {name} should exist")


class TestSyncSkillFilesUpdate(unittest.IsolatedAsyncioTestCase):
    """Tests for updating existing skills."""

    async def test_updates_existing_skill_not_duplicated(self) -> None:
        store = InMemoryStore()
        service = SkillService(user_id=TEST_USER_ID, store=store)

        # Create a skill first
        await service.create(
            SkillCreate(
                name="existing-skill",
                description="Original description",
                content="# Original",
                tags=["old"],
                allowed_tools=[],
            )
        )

        # Sync with updated content
        files_map = {
            "/skills/existing-skill/SKILL.md": _make_file_data(
                _make_skill_md(name="existing-skill", description="Updated description")
            ),
        }
        count = await sync_skill_files_to_store(files_map, TEST_USER_ID, service)
        self.assertEqual(count, 1)

        # Verify update (not duplication)
        skill = await service.get("existing-skill")
        self.assertIsNotNone(skill)
        self.assertEqual(skill.description, "Updated description")

        # Verify only one skill exists
        skills, total = await service.search()
        self.assertEqual(total, 1)


class TestSyncSkillFilesEdgeCases(unittest.IsolatedAsyncioTestCase):
    """Tests for edge cases: empty content, invalid YAML, etc."""

    async def test_skips_empty_content_files(self) -> None:
        store = InMemoryStore()
        service = SkillService(user_id=TEST_USER_ID, store=store)
        files_map = {
            "/skills/empty-skill/SKILL.md": _make_file_data(""),
        }
        count = await sync_skill_files_to_store(files_map, TEST_USER_ID, service)
        self.assertEqual(count, 0)

        # Verify skill was not created
        skill = await service.get("empty-skill")
        self.assertIsNone(skill)

    async def test_skips_whitespace_only_content(self) -> None:
        store = InMemoryStore()
        service = SkillService(user_id=TEST_USER_ID, store=store)
        files_map = {
            "/skills/blank-skill/SKILL.md": _make_file_data("   \n  \n  "),
        }
        count = await sync_skill_files_to_store(files_map, TEST_USER_ID, service)
        self.assertEqual(count, 0)

    async def test_skips_invalid_yaml_frontmatter(self) -> None:
        store = InMemoryStore()
        service = SkillService(user_id=TEST_USER_ID, store=store)
        invalid_yaml = "---\n: invalid: yaml: [broken\n---\n# Body"
        files_map = {
            "/skills/bad-yaml/SKILL.md": _make_file_data(invalid_yaml),
        }
        count = await sync_skill_files_to_store(files_map, TEST_USER_ID, service)
        self.assertEqual(count, 0)

        # Verify skill was not created
        skill = await service.get("bad-yaml")
        self.assertIsNone(skill)

    async def test_handles_no_frontmatter_gracefully(self) -> None:
        store = InMemoryStore()
        service = SkillService(user_id=TEST_USER_ID, store=store)
        # Content without frontmatter — split_front_matter returns (None, body)
        no_fm_content = "# Just a body\nNo frontmatter here."
        files_map = {
            "/skills/no-fm/SKILL.md": _make_file_data(no_fm_content),
        }
        count = await sync_skill_files_to_store(files_map, TEST_USER_ID, service)
        self.assertEqual(count, 1)

        skill = await service.get("no-fm")
        self.assertIsNotNone(skill)
        # Should use default description since no frontmatter
        self.assertEqual(skill.description, "Skill: no-fm")


class TestSyncSkillFilesFinalStatePreference(unittest.IsolatedAsyncioTestCase):
    """Tests verifying that final_state files take priority over accumulated files_map.

    These tests validate the contract used by stream_generator() where
    final_state.values.get("files", {}) is preferred over the streaming-
    accumulated files_map.
    """

    async def test_final_state_files_sync_when_accumulated_empty(self) -> None:
        """Accumulated files_map is empty but final_state files contain SKILL.md."""
        store = InMemoryStore()
        service = SkillService(user_id=TEST_USER_ID, store=store)

        # Simulate final_state files (the authoritative source)
        final_state_files = {
            "/skills/from-final/SKILL.md": _make_file_data(
                _make_skill_md(name="from-final", description="From final state")
            ),
        }

        # Accumulated files_map is empty (streaming missed the file)
        accumulated_files = {}

        # Sync with final_state files (what stream_generator would do)
        count = await sync_skill_files_to_store(
            final_state_files, TEST_USER_ID, service
        )
        self.assertEqual(count, 1)

        skill = await service.get("from-final")
        self.assertIsNotNone(skill)
        self.assertEqual(skill.description, "From final state")

        # Sync with accumulated (empty) would produce 0
        store2 = InMemoryStore()
        service2 = SkillService(user_id=TEST_USER_ID, store=store2)
        count2 = await sync_skill_files_to_store(
            accumulated_files, TEST_USER_ID, service2
        )
        self.assertEqual(count2, 0)

    async def test_final_state_overrides_stale_accumulated(self) -> None:
        """files_map has stale content, final_state has the correct version."""
        store = InMemoryStore()
        service = SkillService(user_id=TEST_USER_ID, store=store)

        # Stale accumulated version
        stale_files = {
            "/skills/my-skill/SKILL.md": _make_file_data(
                _make_skill_md(name="my-skill", description="Stale version")
            ),
        }

        # Final state has correct version
        final_state_files = {
            "/skills/my-skill/SKILL.md": _make_file_data(
                _make_skill_md(name="my-skill", description="Correct version")
            ),
        }

        # Sync with final_state files (preferred path)
        count = await sync_skill_files_to_store(
            final_state_files, TEST_USER_ID, service
        )
        self.assertEqual(count, 1)

        skill = await service.get("my-skill")
        self.assertIsNotNone(skill)
        self.assertEqual(skill.description, "Correct version")

    async def test_fallback_to_accumulated_when_final_state_unavailable(self) -> None:
        """When final_state is unavailable, accumulated files_map is used."""
        store = InMemoryStore()
        service = SkillService(user_id=TEST_USER_ID, store=store)

        # Accumulated files_map (fallback when final_state is None)
        accumulated_files = {
            "/skills/fallback-skill/SKILL.md": _make_file_data(
                _make_skill_md(name="fallback-skill", description="From accumulated")
            ),
        }

        # Sync with accumulated (simulates final_state being None)
        count = await sync_skill_files_to_store(
            accumulated_files, TEST_USER_ID, service
        )
        self.assertEqual(count, 1)

        skill = await service.get("fallback-skill")
        self.assertIsNotNone(skill)
        self.assertEqual(skill.description, "From accumulated")


if __name__ == "__main__":
    unittest.main()
