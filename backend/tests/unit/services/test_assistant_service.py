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


class TestAssistantServiceFiles(unittest.IsolatedAsyncioTestCase):
    """Tests for files property on assistants."""

    async def asyncSetUp(self):
        """Set up test fixtures."""
        self.store = InMemoryStore()
        self.user_id = str(uuid4())
        self.service = AssistantService(user_id=self.user_id, store=self.store)
        self.assistant_data = {
            "name": "Test Assistant",
            "description": "A test assistant for unit testing",
            "tools": ["web_search"],
            "system_prompt": "You are a helpful assistant.",
            "instructions": None,
        }

    async def test_assistant_with_files_property(self):
        """Test that Assistant model accepts files property."""
        assistant_data = {
            "name": "Test Assistant",
            "description": "Test",
            "tools": [],
            "files": {
                "/README.md": "# Hello World",
                "/src/main.py": "print('hello')",
            },
        }
        assistant = Assistant(**assistant_data)
        self.assertEqual(assistant.files["/README.md"], "# Hello World")
        self.assertEqual(assistant.files["/src/main.py"], "print('hello')")

    async def test_assistant_files_defaults_to_empty_dict(self):
        """Test that files defaults to empty dict when not provided."""
        assistant_data = {
            "name": "Test Assistant",
            "description": "Test",
            "tools": [],
        }
        assistant = Assistant(**assistant_data)
        self.assertEqual(assistant.files, {})

    async def test_update_persists_files(self):
        """Test that files is persisted when updating assistant."""
        assistant_id = str(uuid4())
        assistant_data = {
            **self.assistant_data,
            "files": {"/test.txt": "test content"},
        }

        await self.service.update(assistant_id, assistant_data)

        retrieved = await self.service.get(assistant_id)
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved.files["/test.txt"], "test content")

    async def test_get_returns_files(self):
        """Test that get() returns assistant with files intact."""
        assistant_id = str(uuid4())
        files = {
            "/app.py": "import flask",
            "/requirements.txt": "flask==2.0",
        }
        assistant_data = {**self.assistant_data, "files": files}

        await self.service.update(assistant_id, assistant_data)
        retrieved = await self.service.get(assistant_id)

        self.assertEqual(retrieved.files, files)

    async def test_publish_preserves_files_in_public_namespace(self):
        """Test that publishing preserves files data in the public namespace.

        Note: The get_public method returns a full Assistant model.
        PublicAssistant (used for API responses) would strip sensitive fields.
        """
        assistant_id = str(uuid4())
        files = {"/readme.md": "# Public Readme"}
        assistant_data = {**self.assistant_data, "files": files}

        await self.service.update(assistant_id, assistant_data)
        await self.service.publish(assistant_id)

        public_assistant = await self.service.get_public(assistant_id)
        # get_public returns Assistant model (full data)
        # API endpoint should convert to PublicAssistant to strip sensitive fields
        self.assertIsNotNone(public_assistant)
        self.assertTrue(public_assistant.public)
        self.assertEqual(public_assistant.files, files)


class TestAssistantServiceFork(unittest.IsolatedAsyncioTestCase):
    """Tests for assistant fork/remix functionality."""

    async def asyncSetUp(self):
        """Set up test fixtures."""
        self.store = InMemoryStore()
        self.owner_id = str(uuid4())
        self.target_user_id = str(uuid4())
        self.service = AssistantService(user_id=self.owner_id, store=self.store)
        self.assistant_data = {
            "name": "Forkable Agent",
            "description": "An agent designed for forking tests",
            "tools": ["web_search"],
            "system_prompt": "You are a helpful assistant.",
            "instructions": None,
            "mcp": {"server": {"url": "https://example.com"}},
            "a2a": {"agent": {"api_key": "secret-key"}},
            "metadata": {"category": "test"},
            "public": False,
        }

    async def _create_and_publish(self, assistant_id: str = None) -> str:
        """Helper to create and publish an assistant."""
        if assistant_id is None:
            assistant_id = str(uuid4())
        await self.service.update(assistant_id, self.assistant_data)
        await self.service.publish(assistant_id)
        return assistant_id

    async def test_fork_creates_new_assistant_in_target_namespace(self):
        """Test that fork creates a new assistant in the target user's namespace."""
        source_id = await self._create_and_publish()

        # Fork into target user's namespace
        new_id = await self.service.fork(source_id, self.target_user_id)

        self.assertIsNotNone(new_id)
        self.assertNotEqual(new_id, source_id)

        # Verify the forked assistant exists in the target user's namespace
        target_service = AssistantService(user_id=self.target_user_id, store=self.store)
        forked = await target_service.get(new_id)

        self.assertIsNotNone(forked)
        self.assertEqual(forked.name, "Forkable Agent")
        self.assertEqual(forked.description, "An agent designed for forking tests")

    async def test_fork_increments_fork_count_on_source(self):
        """Test that forking increments fork_count on the source assistant."""
        source_id = await self._create_and_publish()

        # Verify initial fork_count is 0
        source_before = await self.service.get_public(source_id)
        self.assertEqual(source_before.fork_count, 0)

        # Fork once
        await self.service.fork(source_id, self.target_user_id)

        # Verify fork_count incremented to 1
        source_after = await self.service.get_public(source_id)
        self.assertEqual(source_after.fork_count, 1)

        # Fork again from a different user
        another_user = str(uuid4())
        await self.service.fork(source_id, another_user)

        # Verify fork_count incremented to 2
        source_after2 = await self.service.get_public(source_id)
        self.assertEqual(source_after2.fork_count, 2)

    async def test_fork_sets_forked_from_in_metadata(self):
        """Test that the forked assistant has forked_from in its metadata."""
        source_id = await self._create_and_publish()

        new_id = await self.service.fork(source_id, self.target_user_id)

        target_service = AssistantService(user_id=self.target_user_id, store=self.store)
        forked = await target_service.get(new_id)

        self.assertIn("forked_from", forked.metadata)
        self.assertEqual(forked.metadata["forked_from"], source_id)

    async def test_fork_preserves_original_metadata(self):
        """Test that fork preserves existing metadata alongside forked_from."""
        source_id = await self._create_and_publish()

        new_id = await self.service.fork(source_id, self.target_user_id)

        target_service = AssistantService(user_id=self.target_user_id, store=self.store)
        forked = await target_service.get(new_id)

        self.assertEqual(forked.metadata["category"], "test")
        self.assertEqual(forked.metadata["forked_from"], source_id)

    async def test_fork_returns_none_for_nonexistent_assistant(self):
        """Test that fork returns None when the source assistant doesn't exist."""
        fake_id = str(uuid4())
        result = await self.service.fork(fake_id, self.target_user_id)
        self.assertIsNone(result)

    async def test_fork_returns_none_for_invalid_uuid(self):
        """Test that fork returns None for an invalid UUID format."""
        result = await self.service.fork("not-a-valid-uuid", self.target_user_id)
        self.assertIsNone(result)

    async def test_fork_returns_none_for_unpublished_assistant(self):
        """Test that fork returns None when the assistant is not published (not in public namespace)."""
        assistant_id = str(uuid4())
        await self.service.update(assistant_id, self.assistant_data)

        # Attempt to fork an unpublished assistant
        result = await self.service.fork(assistant_id, self.target_user_id)
        self.assertIsNone(result)

    async def test_fork_strips_public_fields_on_copy(self):
        """Test that the forked assistant has public=False, owner_id=None, published_at=None."""
        source_id = await self._create_and_publish()

        new_id = await self.service.fork(source_id, self.target_user_id)

        target_service = AssistantService(user_id=self.target_user_id, store=self.store)
        forked = await target_service.get(new_id)

        self.assertFalse(forked.public)
        self.assertIsNone(forked.owner_id)
        self.assertIsNone(forked.published_at)

    async def test_fork_resets_fork_count_on_copy(self):
        """Test that the forked assistant starts with fork_count=0."""
        source_id = await self._create_and_publish()

        # Fork once to increment source fork_count
        first_fork_id = await self.service.fork(source_id, self.target_user_id)

        # Verify source has fork_count=1
        source = await self.service.get_public(source_id)
        self.assertEqual(source.fork_count, 1)

        # Verify the forked copy has fork_count=0
        target_service = AssistantService(user_id=self.target_user_id, store=self.store)
        forked = await target_service.get(first_fork_id)
        self.assertEqual(forked.fork_count, 0)

    async def test_fork_copies_tools_and_config(self):
        """Test that fork deep-copies tools, system_prompt, and other config."""
        source_id = await self._create_and_publish()

        new_id = await self.service.fork(source_id, self.target_user_id)

        target_service = AssistantService(user_id=self.target_user_id, store=self.store)
        forked = await target_service.get(new_id)

        self.assertEqual(forked.tools, ["web_search"])
        self.assertEqual(forked.system_prompt, "You are a helpful assistant.")

    async def test_fork_does_not_modify_source_assistant(self):
        """Test that forking does not change the source assistant's data (except fork_count)."""
        source_id = await self._create_and_publish()

        source_before = await self.service.get_public(source_id)
        original_name = source_before.name
        original_description = source_before.description

        await self.service.fork(source_id, self.target_user_id)

        source_after = await self.service.get_public(source_id)
        self.assertEqual(source_after.name, original_name)
        self.assertEqual(source_after.description, original_description)
        self.assertTrue(source_after.public)
        self.assertIsNotNone(source_after.owner_id)


if __name__ == "__main__":
    unittest.main()
