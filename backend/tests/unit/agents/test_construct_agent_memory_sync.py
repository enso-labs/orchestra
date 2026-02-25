"""Unit tests for MemorySyncMiddleware wiring in construct_agent()."""

import pytest
from unittest.mock import MagicMock, patch

from src.utils.middleware import MemorySyncMiddleware


def _make_service_context(user_id="user-1"):
    """Build a mock ServiceContext."""
    ctx = MagicMock()
    ctx.user_id = user_id
    ctx.store = MagicMock()
    ctx.config = {"configurable": {"thread_id": "t1"}}
    return ctx


@pytest.mark.asyncio
class TestConstructAgentMemorySyncWiring:
    """Tests that MemorySyncMiddleware is correctly wired into construct_agent()."""

    async def test_middleware_added_when_memory_and_original_content_provided(self):
        """MemorySyncMiddleware should be in the middleware stack when both memory and original_content are given."""
        ctx = _make_service_context()
        memory_sources = ["/AGENTS.md"]
        original_content = {"/AGENTS.md": "original text"}

        with patch("src.agents.Orchestra") as MockOrchestra:
            MockOrchestra.return_value = MagicMock()

            from src.agents import construct_agent

            await construct_agent(
                instructions="test",
                system_prompt="test",
                model="test-model",
                tools=[],
                service_context=ctx,
                memory=memory_sources,
                original_content=original_content,
            )

            call_kwargs = MockOrchestra.call_args[1]
            middleware_list = call_kwargs["middleware"]
            sync_middlewares = [m for m in middleware_list if isinstance(m, MemorySyncMiddleware)]
            assert len(sync_middlewares) == 1
            assert sync_middlewares[0].memory_sources == set(memory_sources)
            assert sync_middlewares[0].original_content == original_content

    async def test_middleware_not_added_when_memory_is_none(self):
        """MemorySyncMiddleware should NOT be added when memory is None."""
        ctx = _make_service_context()

        with patch("src.agents.Orchestra") as MockOrchestra:
            MockOrchestra.return_value = MagicMock()

            from src.agents import construct_agent

            await construct_agent(
                instructions="test",
                system_prompt="test",
                model="test-model",
                tools=[],
                service_context=ctx,
                memory=None,
                original_content={"/AGENTS.md": "text"},
            )

            call_kwargs = MockOrchestra.call_args[1]
            middleware_list = call_kwargs["middleware"]
            sync_middlewares = [m for m in middleware_list if isinstance(m, MemorySyncMiddleware)]
            assert len(sync_middlewares) == 0

    async def test_middleware_not_added_when_original_content_is_none(self):
        """MemorySyncMiddleware should NOT be added when original_content is None."""
        ctx = _make_service_context()

        with patch("src.agents.Orchestra") as MockOrchestra:
            MockOrchestra.return_value = MagicMock()

            from src.agents import construct_agent

            await construct_agent(
                instructions="test",
                system_prompt="test",
                model="test-model",
                tools=[],
                service_context=ctx,
                memory=["/AGENTS.md"],
                original_content=None,
            )

            call_kwargs = MockOrchestra.call_args[1]
            middleware_list = call_kwargs["middleware"]
            sync_middlewares = [m for m in middleware_list if isinstance(m, MemorySyncMiddleware)]
            assert len(sync_middlewares) == 0

    async def test_middleware_not_added_when_no_user_id(self):
        """MemorySyncMiddleware should NOT be added when service_context has no user_id."""
        ctx = _make_service_context(user_id=None)

        with patch("src.agents.Orchestra") as MockOrchestra:
            MockOrchestra.return_value = MagicMock()

            from src.agents import construct_agent

            await construct_agent(
                instructions="test",
                system_prompt="test",
                model="test-model",
                tools=[],
                service_context=ctx,
                memory=["/AGENTS.md"],
                original_content={"/AGENTS.md": "text"},
            )

            call_kwargs = MockOrchestra.call_args[1]
            middleware_list = call_kwargs["middleware"]
            sync_middlewares = [m for m in middleware_list if isinstance(m, MemorySyncMiddleware)]
            assert len(sync_middlewares) == 0

    async def test_middleware_uses_correct_memory_repo(self):
        """MemorySyncMiddleware should be created with a MemoryRepo built from service_context."""
        ctx = _make_service_context(user_id="user-42")

        with (
            patch("src.agents.Orchestra") as MockOrchestra,
            patch("src.repos.memory_repo.MemoryRepo") as MockMemoryRepo,
        ):
            MockOrchestra.return_value = MagicMock()
            mock_repo_instance = MagicMock()
            MockMemoryRepo.return_value = mock_repo_instance

            from src.agents import construct_agent

            await construct_agent(
                instructions="test",
                system_prompt="test",
                model="test-model",
                tools=[],
                service_context=ctx,
                memory=["/AGENTS.md"],
                original_content={"/AGENTS.md": "text"},
            )

            MockMemoryRepo.assert_called_once_with(user_id="user-42", store=ctx.store)
            call_kwargs = MockOrchestra.call_args[1]
            middleware_list = call_kwargs["middleware"]
            sync_middlewares = [m for m in middleware_list if isinstance(m, MemorySyncMiddleware)]
            assert sync_middlewares[0].memory_repo is mock_repo_instance

    async def test_existing_middleware_preserved(self):
        """User-supplied middleware should still be present alongside MemorySyncMiddleware."""
        ctx = _make_service_context()
        custom_mw = MagicMock()

        with patch("src.agents.Orchestra") as MockOrchestra:
            MockOrchestra.return_value = MagicMock()

            from src.agents import construct_agent

            await construct_agent(
                instructions="test",
                system_prompt="test",
                model="test-model",
                tools=[],
                middleware=[custom_mw],
                service_context=ctx,
                memory=["/AGENTS.md"],
                original_content={"/AGENTS.md": "text"},
            )

            call_kwargs = MockOrchestra.call_args[1]
            middleware_list = call_kwargs["middleware"]
            assert custom_mw in middleware_list
            sync_middlewares = [m for m in middleware_list if isinstance(m, MemorySyncMiddleware)]
            assert len(sync_middlewares) == 1
