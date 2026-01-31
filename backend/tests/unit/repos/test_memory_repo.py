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
        memory = await self.repo.create(content="hello world")
        self.assertIsInstance(memory, Memory)
        self.assertTrue(memory.id.startswith("memory_"))
        self.assertEqual(memory.content, "hello world")
        self.assertIsNotNone(memory.created_at)
        self.assertIsNotNone(memory.updated_at)

    async def test_get_memory(self) -> None:
        """Get a memory by ID."""
        created = await self.repo.create(content="test get")
        fetched = await self.repo.get(created.id)
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched.id, created.id)
        self.assertEqual(fetched.content, "test get")

    async def test_get_memory_not_found(self) -> None:
        """Get a non-existent memory returns None."""
        result = await self.repo.get("nonexistent_id")
        self.assertIsNone(result)

    async def test_update_memory(self) -> None:
        """Update a memory's content."""
        created = await self.repo.create(content="original")
        updated = await self.repo.update(memory_id=created.id, content="updated")
        self.assertIsNotNone(updated)
        self.assertEqual(updated.content, "updated")
        self.assertEqual(updated.id, created.id)
        self.assertEqual(updated.created_at, created.created_at)
        self.assertGreaterEqual(updated.updated_at, created.updated_at)

    async def test_update_memory_not_found(self) -> None:
        """Update a non-existent memory returns None."""
        result = await self.repo.update(memory_id="nonexistent", content="x")
        self.assertIsNone(result)

    async def test_delete_memory(self) -> None:
        """Delete a memory returns True, subsequent get returns None."""
        created = await self.repo.create(content="to delete")
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
            await self.repo.create(content=f"memory {i}")
        memories, total = await self.repo.list(limit=2, offset=0)
        self.assertEqual(len(memories), 2)
        self.assertEqual(total, 5)

        memories2, total2 = await self.repo.list(limit=10, offset=3)
        self.assertEqual(len(memories2), 2)
        self.assertEqual(total2, 5)


if __name__ == "__main__":
    unittest.main()
