"""Unit tests for StreamingService.

Tests cover:
- init_runtime() returns valid ToolRuntime
- init_backend() returns valid CompositeBackend
- update_store() calls thread service correctly
- get_redis_stream_config() returns proper configuration
"""

import os
import unittest
from typing import cast
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from langchain_core.runnables import RunnableConfig
from langgraph.store.memory import InMemoryStore

from src.services.streaming import (
    StreamingService,
    REDIS_STREAM_TIMEOUT_MS,
    REDIS_KEEPALIVE_INTERVAL_MS,
)


def _make_config(user_id: str, thread_id: str | None = None) -> RunnableConfig:
    """Create a RunnableConfig for testing."""
    return cast(
        RunnableConfig,
        {
            "configurable": {
                "user_id": user_id,
                "thread_id": thread_id or str(uuid4()),
            },
            "metadata": {},
        },
    )


class TestStreamingServiceInit(unittest.TestCase):
    """Tests for StreamingService initialization."""

    def setUp(self):
        """Set up test fixtures."""
        self.user_id = str(uuid4())
        self.store = InMemoryStore()
        self.config = _make_config(self.user_id)

    def test_init_with_all_params(self):
        """Test service initializes with all parameters."""
        service = StreamingService(
            user_id=self.user_id,
            store=self.store,
            config=self.config,
        )

        self.assertEqual(service.user_id, self.user_id)
        self.assertEqual(service.store, self.store)
        self.assertEqual(service.config, self.config)
        self.assertIsNotNone(service.service_context)

    def test_init_with_minimal_params(self):
        """Test service initializes with minimal parameters (mock service_context)."""
        mock_context = MagicMock()
        service = StreamingService(service_context=mock_context)

        self.assertIsNone(service.user_id)
        self.assertIsNone(service.store)
        self.assertIsNone(service.config)
        self.assertEqual(service.service_context, mock_context)

    def test_init_with_service_context(self):
        """Test service initializes with custom service context."""
        mock_context = MagicMock()
        service = StreamingService(
            user_id=self.user_id,
            store=self.store,
            config=self.config,
            service_context=mock_context,
        )

        self.assertEqual(service.service_context, mock_context)


class TestStreamingServiceInitRuntime(unittest.TestCase):
    """Tests for init_runtime() method."""

    def setUp(self):
        """Set up test fixtures."""
        self.user_id = str(uuid4())
        self.store = InMemoryStore()
        self.config = _make_config(self.user_id)
        self.service = StreamingService(
            user_id=self.user_id,
            store=self.store,
            config=self.config,
        )

    def test_init_runtime_returns_tool_runtime(self):
        """Test init_runtime() returns a ToolRuntime instance."""
        from langchain.tools import ToolRuntime

        runtime = self.service.init_runtime(model="gpt-4")

        self.assertIsInstance(runtime, ToolRuntime)

    def test_init_runtime_with_model(self):
        """Test init_runtime() sets the model in context."""
        runtime = self.service.init_runtime(model="gpt-4-turbo")

        self.assertEqual(runtime.context.model, "gpt-4-turbo")

    def test_init_runtime_with_files(self):
        """Test init_runtime() includes files in state."""
        files = {"/test.py": "print('hello')"}
        runtime = self.service.init_runtime(model="gpt-4", files=files)

        self.assertEqual(runtime.state["files"], files)

    def test_init_runtime_without_files(self):
        """Test init_runtime() defaults files to empty dict."""
        runtime = self.service.init_runtime(model="gpt-4")

        self.assertEqual(runtime.state["files"], {})

    def test_init_runtime_with_tool_call_id(self):
        """Test init_runtime() accepts custom tool_call_id."""
        runtime = self.service.init_runtime(model="gpt-4", tool_call_id="custom_tc_001")

        self.assertEqual(runtime.tool_call_id, "custom_tc_001")

    def test_init_runtime_default_tool_call_id(self):
        """Test init_runtime() uses default tool_call_id."""
        runtime = self.service.init_runtime(model="gpt-4")

        self.assertEqual(runtime.tool_call_id, "tc_runtime_init")

    def test_init_runtime_has_empty_messages(self):
        """Test init_runtime() initializes with empty messages."""
        runtime = self.service.init_runtime(model="gpt-4")

        self.assertEqual(runtime.state["messages"], [])

    def test_init_runtime_has_store(self):
        """Test init_runtime() includes store reference."""
        runtime = self.service.init_runtime(model="gpt-4")

        self.assertEqual(runtime.store, self.store)

    def test_init_runtime_has_config(self):
        """Test init_runtime() includes config reference."""
        runtime = self.service.init_runtime(model="gpt-4")

        self.assertEqual(runtime.config, self.config)

    def test_init_runtime_has_stream_writer(self):
        """Test init_runtime() includes a no-op stream_writer."""
        runtime = self.service.init_runtime(model="gpt-4")

        # Should be callable and not raise
        result = runtime.stream_writer("test")
        self.assertIsNone(result)


class TestStreamingServiceInitBackend(unittest.TestCase):
    """Tests for init_backend() method."""

    def setUp(self):
        """Set up test fixtures."""
        self.user_id = str(uuid4())
        self.store = InMemoryStore()
        self.config = _make_config(self.user_id)
        self.service = StreamingService(
            user_id=self.user_id,
            store=self.store,
            config=self.config,
        )

    def test_init_backend_returns_composite_backend(self):
        """Test init_backend() returns a CompositeBackend instance."""
        from deepagents.backends import CompositeBackend

        runtime = self.service.init_runtime(model="gpt-4")
        backend = self.service.init_backend(runtime)

        self.assertIsInstance(backend, CompositeBackend)

    def test_init_backend_default_routes(self):
        """Test init_backend() creates default routes for user memories and config."""
        runtime = self.service.init_runtime(model="gpt-4")
        backend = self.service.init_backend(runtime)

        # CompositeBackend has routes attribute
        expected_memory_route = f"/users/{self.user_id}/memories/"
        expected_config_route = f"/users/{self.user_id}/config/"

        self.assertIn(expected_memory_route, backend.routes)
        self.assertIn(expected_config_route, backend.routes)

    def test_init_backend_custom_routes(self):
        """Test init_backend() accepts custom routes."""
        from deepagents.backends import StoreBackend

        runtime = self.service.init_runtime(model="gpt-4")
        custom_backend = StoreBackend(runtime)
        custom_routes = {"/custom/": custom_backend}

        backend = self.service.init_backend(runtime, routes=custom_routes)

        self.assertIn("/custom/", backend.routes)
        self.assertNotIn(f"/users/{self.user_id}/memories/", backend.routes)

    def test_init_backend_has_default_state_backend(self):
        """Test init_backend() includes default StateBackend."""
        runtime = self.service.init_runtime(model="gpt-4")
        backend = self.service.init_backend(runtime)

        # CompositeBackend should have a default attribute
        self.assertIsNotNone(backend.default)


def _make_config_extended(
    user_id: str,
    thread_id: str,
    assistant_id: str | None = None,
    project_id: str | None = None,
) -> RunnableConfig:
    """Create a RunnableConfig with extended configurable fields."""
    return cast(
        RunnableConfig,
        {
            "configurable": {
                "user_id": user_id,
                "thread_id": thread_id,
                "assistant_id": assistant_id,
                "project_id": project_id,
            },
            "metadata": {},
        },
    )


class TestStreamingServiceUpdateStore(unittest.IsolatedAsyncioTestCase):
    """Tests for update_store() method."""

    async def asyncSetUp(self):
        """Set up test fixtures."""
        self.user_id = str(uuid4())
        self.thread_id = str(uuid4())
        self.assistant_id = str(uuid4())
        self.project_id = str(uuid4())
        self.store = InMemoryStore()
        self.config = _make_config_extended(
            self.user_id, self.thread_id, self.assistant_id, self.project_id
        )

    async def test_update_store_calls_thread_service(self):
        """Test update_store() calls thread_service.update()."""
        mock_thread_service = AsyncMock()
        mock_service_context = MagicMock()
        mock_service_context.thread_service = mock_thread_service
        mock_service_context.store = MagicMock()

        service = StreamingService(
            user_id=self.user_id,
            store=self.store,
            config=self.config,
            service_context=mock_service_context,
        )

        # Create mock agent
        mock_agent = MagicMock()
        mock_state = MagicMock()
        mock_state.config = {"configurable": {"checkpoint_id": "ckpt_123"}}
        mock_state.values = {"messages": [{"role": "user", "content": "Hello"}]}
        mock_agent.graph.aget_state = AsyncMock(return_value=mock_state)

        await service.update_store(mock_agent, self.config)

        mock_thread_service.update.assert_called_once()

    async def test_update_store_includes_thread_id(self):
        """Test update_store() includes thread_id in update data."""
        mock_thread_service = AsyncMock()
        mock_service_context = MagicMock()
        mock_service_context.thread_service = mock_thread_service
        mock_service_context.store = MagicMock()

        service = StreamingService(
            user_id=self.user_id,
            store=self.store,
            config=self.config,
            service_context=mock_service_context,
        )

        mock_agent = MagicMock()
        mock_state = MagicMock()
        mock_state.config = {"configurable": {}}
        mock_state.values = {"messages": []}
        mock_agent.graph.aget_state = AsyncMock(return_value=mock_state)

        await service.update_store(mock_agent, self.config)

        call_kwargs = mock_thread_service.update.call_args
        self.assertEqual(call_kwargs.kwargs["thread_id"], self.thread_id)
        self.assertEqual(call_kwargs.kwargs["data"]["thread_id"], self.thread_id)

    async def test_update_store_includes_messages(self):
        """Test update_store() includes messages in update data."""
        mock_thread_service = AsyncMock()
        mock_service_context = MagicMock()
        mock_service_context.thread_service = mock_thread_service
        mock_service_context.store = MagicMock()

        service = StreamingService(
            user_id=self.user_id,
            store=self.store,
            config=self.config,
            service_context=mock_service_context,
        )

        test_messages = [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there!"},
        ]

        mock_agent = MagicMock()
        mock_state = MagicMock()
        mock_state.config = {"configurable": {}}
        mock_state.values = {"messages": test_messages}
        mock_agent.graph.aget_state = AsyncMock(return_value=mock_state)

        await service.update_store(mock_agent, self.config)

        call_kwargs = mock_thread_service.update.call_args
        self.assertEqual(call_kwargs.kwargs["data"]["messages"], test_messages)

    async def test_update_store_includes_files_when_provided(self):
        """Test update_store() includes files when provided."""
        mock_thread_service = AsyncMock()
        mock_service_context = MagicMock()
        mock_service_context.thread_service = mock_thread_service
        mock_service_context.store = MagicMock()

        service = StreamingService(
            user_id=self.user_id,
            store=self.store,
            config=self.config,
            service_context=mock_service_context,
        )

        test_files = {"/test.py": "print('hello')"}

        mock_agent = MagicMock()
        mock_state = MagicMock()
        mock_state.config = {"configurable": {}}
        mock_state.values = {"messages": []}
        mock_agent.graph.aget_state = AsyncMock(return_value=mock_state)

        await service.update_store(mock_agent, self.config, files=test_files)

        call_kwargs = mock_thread_service.update.call_args
        self.assertEqual(call_kwargs.kwargs["data"]["files"], test_files)

    async def test_update_store_excludes_files_when_none(self):
        """Test update_store() excludes files from update when None."""
        mock_thread_service = AsyncMock()
        mock_service_context = MagicMock()
        mock_service_context.thread_service = mock_thread_service
        mock_service_context.store = MagicMock()

        service = StreamingService(
            user_id=self.user_id,
            store=self.store,
            config=self.config,
            service_context=mock_service_context,
        )

        mock_agent = MagicMock()
        mock_state = MagicMock()
        mock_state.config = {"configurable": {}}
        mock_state.values = {"messages": []}
        mock_agent.graph.aget_state = AsyncMock(return_value=mock_state)

        await service.update_store(mock_agent, self.config, files=None)

        call_kwargs = mock_thread_service.update.call_args
        self.assertNotIn("files", call_kwargs.kwargs["data"])

    async def test_update_store_includes_todos_when_provided(self):
        """Test update_store() includes todos when provided."""
        mock_thread_service = AsyncMock()
        mock_service_context = MagicMock()
        mock_service_context.thread_service = mock_thread_service
        mock_service_context.store = MagicMock()

        service = StreamingService(
            user_id=self.user_id,
            store=self.store,
            config=self.config,
            service_context=mock_service_context,
        )

        test_todos = [{"id": "1", "text": "Test todo", "done": False}]

        mock_agent = MagicMock()
        mock_state = MagicMock()
        mock_state.config = {"configurable": {}}
        mock_state.values = {"messages": []}
        mock_agent.graph.aget_state = AsyncMock(return_value=mock_state)

        await service.update_store(mock_agent, self.config, todos=test_todos)

        call_kwargs = mock_thread_service.update.call_args
        self.assertEqual(call_kwargs.kwargs["data"]["todos"], test_todos)

    async def test_update_store_skips_when_no_user_id(self):
        """Test update_store() returns early when user_id is None."""
        mock_thread_service = AsyncMock()
        mock_service_context = MagicMock()
        mock_service_context.thread_service = mock_thread_service

        service = StreamingService(
            user_id=None,  # No user_id
            store=self.store,
            config=self.config,
            service_context=mock_service_context,
        )

        mock_agent = MagicMock()

        await service.update_store(mock_agent, self.config)

        mock_thread_service.update.assert_not_called()

    async def test_update_store_sets_store_fields(self):
        """Test update_store() sets store.fields before updating."""
        mock_thread_service = AsyncMock()
        mock_store = MagicMock()
        mock_service_context = MagicMock()
        mock_service_context.thread_service = mock_thread_service
        mock_service_context.store = mock_store

        service = StreamingService(
            user_id=self.user_id,
            store=self.store,
            config=self.config,
            service_context=mock_service_context,
        )

        mock_agent = MagicMock()
        mock_state = MagicMock()
        mock_state.config = {"configurable": {}}
        mock_state.values = {"messages": []}
        mock_agent.graph.aget_state = AsyncMock(return_value=mock_state)

        await service.update_store(mock_agent, self.config)

        self.assertEqual(mock_store.fields, ["messages", "files"])

    async def test_update_store_raises_on_error(self):
        """Test update_store() re-raises exceptions after logging."""
        mock_thread_service = AsyncMock()
        mock_thread_service.update.side_effect = ValueError("Test error")
        mock_service_context = MagicMock()
        mock_service_context.thread_service = mock_thread_service
        mock_service_context.store = MagicMock()

        service = StreamingService(
            user_id=self.user_id,
            store=self.store,
            config=self.config,
            service_context=mock_service_context,
        )

        mock_agent = MagicMock()
        mock_state = MagicMock()
        mock_state.config = {"configurable": {}}
        mock_state.values = {"messages": []}
        mock_agent.graph.aget_state = AsyncMock(return_value=mock_state)

        with self.assertRaises(ValueError):
            await service.update_store(mock_agent, self.config)


class TestStreamingServiceFromRequest(unittest.TestCase):
    """Tests for from_request() factory method."""

    def setUp(self):
        """Set up test fixtures."""
        self.user_id = str(uuid4())
        self.store = InMemoryStore()
        self.config = _make_config(self.user_id)

    def test_from_request_creates_service(self):
        """Test from_request() creates a StreamingService instance."""
        mock_request = MagicMock()
        mock_request.model = "gpt-4"

        service = StreamingService.from_request(
            request=mock_request,
            user_id=self.user_id,
            store=self.store,
            config=self.config,
        )

        self.assertIsInstance(service, StreamingService)
        self.assertEqual(service.user_id, self.user_id)
        self.assertEqual(service.store, self.store)
        self.assertEqual(service.config, self.config)

    def test_from_request_with_none_user_id(self):
        """Test from_request() handles None user_id."""
        mock_request = MagicMock()

        service = StreamingService.from_request(
            request=mock_request,
            user_id=None,
            store=self.store,
            config=self.config,
        )

        self.assertIsNone(service.user_id)


class TestStreamingServiceRedisConfig(unittest.TestCase):
    """Tests for get_redis_stream_config() method."""

    def test_get_redis_stream_config_returns_dict(self):
        """Test get_redis_stream_config() returns a dictionary."""
        config = StreamingService.get_redis_stream_config()

        self.assertIsInstance(config, dict)

    def test_get_redis_stream_config_has_timeout(self):
        """Test get_redis_stream_config() includes timeout_ms."""
        config = StreamingService.get_redis_stream_config()

        self.assertIn("timeout_ms", config)
        self.assertIsInstance(config["timeout_ms"], int)

    def test_get_redis_stream_config_has_keepalive(self):
        """Test get_redis_stream_config() includes keepalive_ms."""
        config = StreamingService.get_redis_stream_config()

        self.assertIn("keepalive_ms", config)
        self.assertIsInstance(config["keepalive_ms"], int)

    def test_get_redis_stream_config_default_values(self):
        """Test get_redis_stream_config() returns expected default values."""
        config = StreamingService.get_redis_stream_config()

        # Default values from environment or constants
        self.assertEqual(config["timeout_ms"], REDIS_STREAM_TIMEOUT_MS)
        self.assertEqual(config["keepalive_ms"], REDIS_KEEPALIVE_INTERVAL_MS)

    @patch.dict(os.environ, {"REDIS_STREAM_TIMEOUT_MS": "120000"})
    def test_get_redis_stream_config_respects_timeout_env(self):
        """Test get_redis_stream_config() respects REDIS_STREAM_TIMEOUT_MS env var."""
        # Need to reimport to pick up new env value
        import importlib
        import src.services.streaming as streaming_module

        importlib.reload(streaming_module)

        config = streaming_module.StreamingService.get_redis_stream_config()
        self.assertEqual(config["timeout_ms"], 120000)

        # Restore original module
        importlib.reload(streaming_module)

    @patch.dict(os.environ, {"REDIS_KEEPALIVE_INTERVAL_MS": "15000"})
    def test_get_redis_stream_config_respects_keepalive_env(self):
        """Test get_redis_stream_config() respects REDIS_KEEPALIVE_INTERVAL_MS env var."""
        # Need to reimport to pick up new env value
        import importlib
        import src.services.streaming as streaming_module

        importlib.reload(streaming_module)

        config = streaming_module.StreamingService.get_redis_stream_config()
        self.assertEqual(config["keepalive_ms"], 15000)

        # Restore original module
        importlib.reload(streaming_module)


class TestStreamingServiceInitContext(unittest.TestCase):
    """Tests for init_context() method."""

    def setUp(self):
        """Set up test fixtures."""
        self.user_id = str(uuid4())
        self.store = InMemoryStore()
        self.config = _make_config(self.user_id)
        self.service = StreamingService(
            user_id=self.user_id,
            store=self.store,
            config=self.config,
        )

    def test_init_context_returns_context_schema(self):
        """Test init_context() returns a ContextSchema instance."""
        from src.schemas.contexts import ContextSchema

        context = self.service.init_context(model="gpt-4")

        self.assertIsInstance(context, ContextSchema)

    def test_init_context_sets_model(self):
        """Test init_context() sets the model correctly."""
        context = self.service.init_context(model="gpt-4-turbo")

        self.assertEqual(context.model, "gpt-4-turbo")

    def test_init_context_uses_service_user_id(self):
        """Test init_context() uses service user_id when not provided."""
        context = self.service.init_context(model="gpt-4")

        self.assertEqual(context.user_id, self.user_id)

    def test_init_context_overrides_user_id(self):
        """Test init_context() can override user_id."""
        other_user = str(uuid4())
        context = self.service.init_context(model="gpt-4", user_id=other_user)

        self.assertEqual(context.user_id, other_user)


if __name__ == "__main__":
    unittest.main()
