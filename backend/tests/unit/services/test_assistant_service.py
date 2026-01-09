"""Unit tests for AssistantService public agent functionality."""

import unittest
from uuid import uuid4
from langgraph.store.memory import InMemoryStore
from src.services.assistant import AssistantService
from src.schemas.entities.llm import Assistant, PublicAssistant


class TestAssistantServicePublic(unittest.IsolatedAsyncioTestCase):
    """Tests for public assistant functionality."""

    async def asyncSetUp(self):
        """Set up test fixtures."""
        self.store = InMemoryStore()
        self.user_id = str(uuid4())
        self.service = AssistantService(user_id=self.user_id, store=self.store)
        self.assistant_data = {
            "name": "Test Assistant",
            "description": "A test assistant for unit testing",
            "tools": ["web_search"],
            "system_prompt": "You are a helpful assistant. SECRET!",
            "instructions": None,
            "mcp": {"server": {"url": "https://internal.example.com"}},
            "a2a": {"agent": {"api_key": "secret-key"}},
            "metadata": {"internal_id": "classified"},
            "public": False,
        }

    async def test_is_valid_uuid_returns_true_for_valid(self):
        """Test UUID validation with valid UUID."""
        valid_uuid = str(uuid4())
        result = AssistantService._is_valid_uuid(valid_uuid)
        self.assertTrue(result)

    async def test_is_valid_uuid_returns_false_for_invalid(self):
        """Test UUID validation with invalid strings."""
        invalid_values = ["not-a-uuid", "12345", "", None, "abc-def-ghi"]
        for value in invalid_values:
            result = AssistantService._is_valid_uuid(value)
            self.assertFalse(result, f"Expected False for: {value}")

    async def test_get_public_returns_none_for_invalid_uuid(self):
        """Test that get_public returns None for invalid UUID format."""
        result = await self.service.get_public("not-a-valid-uuid")
        self.assertIsNone(result)

    async def test_get_public_returns_none_when_not_found(self):
        """Test that get_public returns None when assistant doesn't exist."""
        result = await self.service.get_public(str(uuid4()))
        self.assertIsNone(result)

    async def test_get_public_returns_assistant_when_published(self):
        """Test that get_public returns assistant after publishing."""
        assistant_id = str(uuid4())

        # Create assistant in user namespace
        await self.service.update(assistant_id, self.assistant_data)

        # Publish
        await self.service.publish(assistant_id)

        # Get from public namespace
        result = await self.service.get_public(assistant_id)

        self.assertIsNotNone(result)
        self.assertEqual(result.name, "Test Assistant")
        self.assertTrue(result.public)

    async def test_publish_sets_owner_id_and_published_at(self):
        """Test that publishing sets owner_id and published_at correctly."""
        assistant_id = str(uuid4())

        # Create assistant
        await self.service.update(assistant_id, self.assistant_data)

        # Publish
        result = await self.service.publish(assistant_id)

        self.assertTrue(result)

        # Verify owner_id and published_at are set
        public_assistant = await self.service.get_public(assistant_id)
        self.assertEqual(public_assistant.owner_id, self.user_id)
        self.assertIsNotNone(public_assistant.published_at)

    async def test_publish_fails_for_nonexistent_assistant(self):
        """Test that publishing a non-existent assistant returns False."""
        result = await self.service.publish(str(uuid4()))
        self.assertFalse(result)

    async def test_publish_is_idempotent(self):
        """Test that publishing an already public assistant succeeds."""
        assistant_id = str(uuid4())

        # Create and publish
        await self.service.update(assistant_id, self.assistant_data)
        await self.service.publish(assistant_id)

        # Publish again - should succeed
        result = await self.service.publish(assistant_id)
        self.assertTrue(result)

    async def test_unpublish_removes_from_public_namespace(self):
        """Test that unpublishing removes assistant from public namespace."""
        assistant_id = str(uuid4())

        # Create, publish, then unpublish
        await self.service.update(assistant_id, self.assistant_data)
        await self.service.publish(assistant_id)
        await self.service.unpublish(assistant_id)

        # Should no longer be in public namespace
        result = await self.service.get_public(assistant_id)
        self.assertIsNone(result)

        # Should still be in user namespace
        user_assistant = await self.service.get(assistant_id)
        self.assertIsNotNone(user_assistant)
        self.assertFalse(user_assistant.public)

    async def test_unpublish_is_idempotent(self):
        """Test that unpublishing a private assistant succeeds."""
        assistant_id = str(uuid4())

        # Create (not published)
        await self.service.update(assistant_id, self.assistant_data)

        # Unpublish - should succeed even though not public
        result = await self.service.unpublish(assistant_id)
        self.assertTrue(result)

    async def test_unpublish_fails_for_nonexistent_assistant(self):
        """Test that unpublishing a non-existent assistant returns False."""
        result = await self.service.unpublish(str(uuid4()))
        self.assertFalse(result)

    async def test_update_syncs_to_public_if_public(self):
        """Test that updating a public assistant syncs to public namespace."""
        assistant_id = str(uuid4())

        # Create and publish
        await self.service.update(assistant_id, self.assistant_data)
        await self.service.publish(assistant_id)

        # Update with new description
        updated_data = self.assistant_data.copy()
        updated_data["description"] = "Updated description"
        updated_data["public"] = True
        updated_data["owner_id"] = self.user_id
        await self.service.update(assistant_id, updated_data)

        # Verify public copy was updated
        public_assistant = await self.service.get_public(assistant_id)
        self.assertEqual(public_assistant.description, "Updated description")

    async def test_delete_removes_from_public_namespace(self):
        """Test that deleting a public assistant removes from public namespace."""
        assistant_id = str(uuid4())

        # Create and publish
        await self.service.update(assistant_id, self.assistant_data)
        await self.service.publish(assistant_id)

        # Delete
        await self.service.delete(assistant_id)

        # Should be removed from both namespaces
        self.assertIsNone(await self.service.get(assistant_id))
        self.assertIsNone(await self.service.get_public(assistant_id))

    async def test_search_public_returns_public_assistants(self):
        """Test that search_public returns public assistants."""
        # Create and publish multiple assistants
        for i in range(3):
            assistant_id = str(uuid4())
            data = self.assistant_data.copy()
            data["name"] = f"Public Agent {i}"
            await self.service.update(assistant_id, data)
            await self.service.publish(assistant_id)

        # Search public
        results = await self.service.search_public(limit=10)
        self.assertEqual(len(results), 3)

    async def test_search_public_respects_pagination(self):
        """Test that search_public respects limit and offset."""
        # Create and publish multiple assistants
        for i in range(5):
            assistant_id = str(uuid4())
            data = self.assistant_data.copy()
            data["name"] = f"Public Agent {i}"
            await self.service.update(assistant_id, data)
            await self.service.publish(assistant_id)

        # Test limit
        results = await self.service.search_public(limit=2)
        self.assertEqual(len(results), 2)

        # Test offset
        results = await self.service.search_public(limit=10, offset=3)
        self.assertEqual(len(results), 2)


class TestPublicAssistantModel(unittest.TestCase):
    """Tests for PublicAssistant response model."""

    def test_from_assistant_includes_safe_fields(self):
        """Test that from_assistant includes expected safe fields."""
        full_assistant = Assistant(
            id="test-id",
            name="Test Assistant",
            description="A test assistant",
            model="gpt-4",
            system_prompt="SECRET PROMPT",
            tools=["secret_tool"],
            public=True,
            owner_id="owner-123",
        )

        public = PublicAssistant.from_assistant(full_assistant)

        self.assertEqual(public.id, "test-id")
        self.assertEqual(public.name, "Test Assistant")
        self.assertEqual(public.description, "A test assistant")
        self.assertEqual(public.model, "gpt-4")
        self.assertEqual(public.owner_id, "owner-123")
        self.assertIsNotNone(public.slug)

    def test_from_assistant_excludes_sensitive_fields(self):
        """Test that PublicAssistant excludes sensitive fields."""
        full_assistant = Assistant(
            id="test-id",
            name="Sensitive Agent",
            description="Has secrets",
            model="gpt-4",
            system_prompt="API_KEY=sk-secret-12345. Password is hunter2",
            tools=["secret_database_tool"],
            mcp={"server": {"url": "https://internal.example.com"}},
            a2a={"agent": {"api_key": "internal-key"}},
            metadata={"internal_id": "classified"},
            public=True,
            owner_id="owner-123",
        )

        public = PublicAssistant.from_assistant(full_assistant)

        # Verify sensitive fields are NOT present
        self.assertFalse(hasattr(public, "system_prompt"))
        self.assertFalse(hasattr(public, "instructions"))
        self.assertFalse(hasattr(public, "tools"))
        self.assertFalse(hasattr(public, "mcp"))
        self.assertFalse(hasattr(public, "a2a"))
        self.assertFalse(hasattr(public, "metadata"))
        self.assertFalse(hasattr(public, "subagents"))


if __name__ == "__main__":
    unittest.main()
