import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from langchain_core.messages import SystemMessage
from langgraph.store.memory import InMemoryStore

from src.controllers.llm import LLMController
from src.schemas.entities.llm import LLMRequest


class _DummyCheckpointCtx:
    async def __aenter__(self):
        return object()

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _FakeAgent:
    def __init__(self):
        self.graph = MagicMock()
        self.graph.aget_state = AsyncMock()
        self.invoke = AsyncMock(return_value={"ok": True})


class TestLLMInvokeBackendRouting(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.store = InMemoryStore()
        self.controller = LLMController(
            user_id="test-user", store=self.store, config={"configurable": {}}
        )
        self.controller._update_store = AsyncMock()

    def _request(self) -> LLMRequest:
        return LLMRequest(
            model="openai/gpt-4o-mini",
            metadata={"sandbox": "daytona"},
            input={"messages": [{"role": "user", "content": "hello"}]},
        )

    @patch("src.controllers.llm.get_checkpoint_db", return_value=_DummyCheckpointCtx())
    @patch("src.controllers.llm.prepare_memory_files", new_callable=AsyncMock)
    @patch("src.controllers.llm.construct_agent", new_callable=AsyncMock)
    @patch("src.controllers.llm.create_daytona_backend")
    async def test_invoke_ignores_metadata_sandbox_when_user_pref_not_daytona(
        self,
        mock_create_daytona_backend,
        mock_construct_agent,
        mock_prepare_memory_files,
        _mock_get_checkpoint_db,
    ):
        req = self._request()
        mock_prepare_memory_files.return_value = ({}, [])
        mock_construct_agent.return_value = _FakeAgent()

        self.controller._resolve_user_settings = AsyncMock(
            return_value=(req.model, None, None)
        )

        await self.controller.llm_invoke(req)

        mock_create_daytona_backend.assert_not_called()

    @patch("src.controllers.llm.get_checkpoint_db", return_value=_DummyCheckpointCtx())
    @patch("src.controllers.llm.prepare_memory_files", new_callable=AsyncMock)
    @patch("src.controllers.llm.construct_agent", new_callable=AsyncMock)
    @patch("src.controllers.llm.create_daytona_backend")
    async def test_invoke_uses_daytona_from_user_setting_and_cleans_up(
        self,
        mock_create_daytona_backend,
        mock_construct_agent,
        mock_prepare_memory_files,
        _mock_get_checkpoint_db,
    ):
        req = self._request()
        mock_prepare_memory_files.return_value = ({}, [])
        fake_agent = _FakeAgent()
        mock_construct_agent.return_value = fake_agent

        daytona_sandbox = MagicMock()
        daytona_backend = MagicMock()
        mock_create_daytona_backend.return_value = (daytona_sandbox, daytona_backend)

        self.controller._resolve_user_settings = AsyncMock(
            return_value=(req.model, "k", "daytona")
        )

        await self.controller.llm_invoke(req)

        mock_create_daytona_backend.assert_called_once_with(api_key="k")
        daytona_sandbox.stop.assert_called_once()

    @patch("src.controllers.llm.get_checkpoint_db", return_value=_DummyCheckpointCtx())
    @patch("src.controllers.llm.prepare_memory_files", new_callable=AsyncMock)
    @patch("src.controllers.llm.construct_agent", new_callable=AsyncMock)
    @patch("src.controllers.llm.create_daytona_backend")
    async def test_invoke_falls_back_to_state_backend_with_notice_when_daytona_unavailable(
        self,
        mock_create_daytona_backend,
        mock_construct_agent,
        mock_prepare_memory_files,
        _mock_get_checkpoint_db,
    ):
        req = self._request()
        mock_prepare_memory_files.return_value = ({}, [])
        mock_construct_agent.return_value = _FakeAgent()

        mock_create_daytona_backend.return_value = (MagicMock(), None)
        self.controller._resolve_user_settings = AsyncMock(
            return_value=(req.model, None, "daytona")
        )

        await self.controller.llm_invoke(req)

        self.assertTrue(
            any(
                isinstance(message, SystemMessage)
                and "falling back to default sandbox" in str(message.content)
                for message in req.input.messages
            )
        )


    @patch("src.controllers.llm.get_checkpoint_db", return_value=_DummyCheckpointCtx())
    @patch("src.controllers.llm.prepare_memory_files", new_callable=AsyncMock)
    @patch("src.controllers.llm.construct_agent", new_callable=AsyncMock)
    @patch("src.controllers.llm.create_daytona_backend")
    async def test_invoke_falls_back_when_backend_lacks_execute(
        self,
        mock_create_daytona_backend,
        mock_construct_agent,
        mock_prepare_memory_files,
        _mock_get_checkpoint_db,
    ):
        """When Daytona backend exists but has no execute(), fallback with notice."""
        req = self._request()
        mock_prepare_memory_files.return_value = ({}, [])
        mock_construct_agent.return_value = _FakeAgent()

        daytona_sandbox = MagicMock()
        # Create a backend object that deliberately lacks execute()
        daytona_backend = object()  # plain object has no execute attribute
        mock_create_daytona_backend.return_value = (daytona_sandbox, daytona_backend)
        self.controller._resolve_user_settings = AsyncMock(
            return_value=(req.model, "k", "daytona")
        )

        await self.controller.llm_invoke(req)

        # Should have fallback message appended
        self.assertTrue(
            any(
                isinstance(m, SystemMessage)
                and "falling back to default sandbox" in str(m.content)
                for m in req.input.messages
            )
        )
        # Sandbox should still be cleaned up
        daytona_sandbox.stop.assert_called_once()

    @patch("src.controllers.llm.get_checkpoint_db", return_value=_DummyCheckpointCtx())
    @patch("src.controllers.llm.prepare_memory_files", new_callable=AsyncMock)
    @patch("src.controllers.llm.construct_agent", new_callable=AsyncMock)
    @patch("src.controllers.llm.create_daytona_backend")
    async def test_invoke_daytona_success_passes_store_routes(
        self,
        mock_create_daytona_backend,
        mock_construct_agent,
        mock_prepare_memory_files,
        _mock_get_checkpoint_db,
    ):
        """When Daytona succeeds, CompositeBackend should include store routes for memories/config."""
        req = self._request()
        mock_prepare_memory_files.return_value = ({}, [])
        fake_agent = _FakeAgent()
        mock_construct_agent.return_value = fake_agent

        daytona_sandbox = MagicMock()
        daytona_backend = MagicMock()  # MagicMock has execute, so capability passes
        mock_create_daytona_backend.return_value = (daytona_sandbox, daytona_backend)
        self.controller._resolve_user_settings = AsyncMock(
            return_value=(req.model, "k", "daytona")
        )

        await self.controller.llm_invoke(req)

        # Verify construct_agent was called with a backend
        call_kwargs = mock_construct_agent.call_args[1]
        backend = call_kwargs["backend"]
        # Backend should be a CompositeBackend (not just the raw daytona_backend)
        from deepagents.backends import CompositeBackend
        self.assertIsInstance(backend, CompositeBackend)

        # No fallback message should be appended
        self.assertFalse(
            any(
                isinstance(m, SystemMessage)
                and "falling back" in str(m.content)
                for m in req.input.messages
            )
        )


class TestResolveUserSettings(unittest.IsolatedAsyncioTestCase):
    async def test_resolve_user_settings_returns_sandbox_backend_preference(self):
        from src.repos.user_settings_repo import UserSettingsRepo

        store = InMemoryStore()
        controller = LLMController(
            user_id="test-user-2", store=store, config={"configurable": {}}
        )
        repo = UserSettingsRepo(user_id="test-user-2", store=store)

        await repo.set_sandbox_backend("daytona")
        model, api_key, sandbox_backend = await controller._resolve_user_settings(
            "openai/gpt-4o-mini"
        )

        self.assertEqual(model, "openai/gpt-4o-mini")
        self.assertEqual(sandbox_backend, "daytona")
        self.assertFalse(api_key)
