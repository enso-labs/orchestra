"""Unit tests for MemoryRepo CRUD operations."""

import unittest

from langgraph.store.memory import InMemoryStore

from src.repos.memory_repo import MemoryRepo
from src.schemas.entities.memory import Memory


TEST_USER_ID = "test-user-memory-repo"


class TestMemoryRepo(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.store = InMemoryStore()
        self.repo = MemoryRepo(user_id=TEST_USER_ID, store=self.store)

    async def test_create_memory(self) -> None:
        """Create a memory and verify fields."""
        memory = await self.repo.create(content="hello world", path="AGENTS.md")
        self.assertIsInstance(memory, Memory)
        self.assertEqual(memory.id, "AGENTS.md")
        self.assertEqual(memory.content, "hello world")
        self.assertTrue(memory.enabled)
        self.assertIsNotNone(memory.created_at)
        self.assertIsNotNone(memory.updated_at)

    async def test_create_memory_default_path(self) -> None:
        """Create a memory without path uses default AGENTS.md."""
        memory = await self.repo.create(content="hello world")
        self.assertEqual(memory.id, "AGENTS.md")

    async def test_create_memory_custom_path(self) -> None:
        """Create a memory with a custom path."""
        memory = await self.repo.create(content="user prefs", path="USER.md")
        self.assertEqual(memory.id, "USER.md")

    async def test_create_memory_upsert(self) -> None:
        """Creating with same path overwrites (upsert)."""
        await self.repo.create(content="v1", path="AGENTS.md")
        memory = await self.repo.create(content="v2", path="AGENTS.md")
        self.assertEqual(memory.content, "v2")
        fetched = await self.repo.get("AGENTS.md")
        self.assertEqual(fetched.content, "v2")

    async def test_get_memory(self) -> None:
        """Get a memory by ID (path)."""
        created = await self.repo.create(content="test get", path="USER.md")
        fetched = await self.repo.get(created.id)
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched.id, "USER.md")
        self.assertEqual(fetched.content, "test get")

    async def test_get_memory_not_found(self) -> None:
        """Get a non-existent memory returns None."""
        result = await self.repo.get("nonexistent_id")
        self.assertIsNone(result)

    async def test_update_memory(self) -> None:
        """Update a memory's content."""
        created = await self.repo.create(content="original", path="AGENTS.md")
        updated = await self.repo.update(memory_id=created.id, content="updated")
        self.assertIsNotNone(updated)
        self.assertEqual(updated.content, "updated")
        self.assertEqual(updated.id, created.id)
        self.assertEqual(updated.created_at, created.created_at)
        self.assertGreaterEqual(updated.updated_at, created.updated_at)

    async def test_update_memory_enabled(self) -> None:
        """Update a memory's enabled flag."""
        created = await self.repo.create(content="test", path="AGENTS.md")
        self.assertTrue(created.enabled)
        updated = await self.repo.update(
            memory_id=created.id, content="test", enabled=False
        )
        self.assertFalse(updated.enabled)
        # Toggle back
        updated2 = await self.repo.update(
            memory_id=created.id, content="test", enabled=True
        )
        self.assertTrue(updated2.enabled)

    async def test_update_memory_preserves_enabled(self) -> None:
        """Update without enabled param preserves existing enabled state."""
        created = await self.repo.create(content="test", path="AGENTS.md")
        # Disable first
        await self.repo.update(memory_id=created.id, content="test", enabled=False)
        # Update content only — enabled should remain False
        updated = await self.repo.update(memory_id=created.id, content="new content")
        self.assertFalse(updated.enabled)

    async def test_update_memory_not_found(self) -> None:
        """Update a non-existent memory returns None."""
        result = await self.repo.update(memory_id="nonexistent", content="x")
        self.assertIsNone(result)

    async def test_delete_memory(self) -> None:
        """Delete a memory returns True, subsequent get returns None."""
        created = await self.repo.create(content="to delete", path="DELETE.md")
        success = await self.repo.delete(created.id)
        self.assertTrue(success)
        fetched = await self.repo.get(created.id)
        self.assertIsNone(fetched)

    async def test_delete_memory_not_found(self) -> None:
        """Delete a non-existent memory returns False."""
        result = await self.repo.delete("nonexistent")
        self.assertFalse(result)

    async def test_list_memories_pagination(self) -> None:
        """List memories with pagination and total count."""
        for i in range(5):
            await self.repo.create(content=f"memory {i}", path=f"file_{i}.md")
        memories, total = await self.repo.list(limit=2, offset=0)
        self.assertEqual(len(memories), 2)
        self.assertEqual(total, 5)

        memories2, total2 = await self.repo.list(limit=10, offset=3)
        self.assertEqual(len(memories2), 2)
        self.assertEqual(total2, 5)


if __name__ == "__main__":
    unittest.main()
