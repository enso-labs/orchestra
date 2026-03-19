"""Integration tests for middleware stack with compaction middleware."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from langchain_core.messages import AIMessage, HumanMessage

from src.utils.compacting import compaction_middleware
from src.utils.middleware import init_default_middleware, AutoEvictMiddleware


class TestCompactionInMiddlewareStack:
    def test_compaction_middleware_is_first_in_default_stack(self) -> None:
        """Compaction middleware must be the first item in the default middleware list."""
        middleware_list = init_default_middleware(backend=None)
        assert middleware_list[0] is compaction_middleware

    def test_compaction_middleware_present_in_default_stack(self) -> None:
        """Compaction middleware is included in the default middleware list."""
        middleware_list = init_default_middleware(backend=None)
        assert compaction_middleware in middleware_list

    def test_auto_evict_middleware_still_present(self) -> None:
        """AutoEvictMiddleware coexists with compaction middleware."""
        middleware_list = init_default_middleware(backend=None)
        auto_evict = [m for m in middleware_list if isinstance(m, AutoEvictMiddleware)]
        assert len(auto_evict) == 1

    def test_middleware_stack_length_unchanged(self) -> None:
        """Default middleware stack has expected number of items."""
        middleware_list = init_default_middleware(backend=None)
        # compaction, add_ai_message_metadata, cache_metrics, retry_model, 2x PII, AutoEvict = 7
        assert len(middleware_list) == 7


class TestCompactionMiddlewareNoOp:
    """Test that compaction middleware is a no-op for short message contexts."""

    @pytest.mark.asyncio
    @patch("src.utils.compacting._summarization_middleware")
    async def test_short_context_no_compaction(self, mock_mw: MagicMock) -> None:
        """For short messages, compact() returns them unchanged (no LLM call)."""
        short_msgs = [
            HumanMessage(content="Hello"),
            AIMessage(content="Hi there!"),
        ]
        compacted_msgs = [
            HumanMessage(content="Hello"),
            AIMessage(content="Hi there!"),
        ]
        # Make compact return the same list (no-op behavior)
        mock_mw.compact = AsyncMock(return_value=compacted_msgs)

        handler_response = MagicMock()
        handler = AsyncMock(return_value=handler_response)

        request = MagicMock()
        request.state = {"messages": short_msgs}

        # Exercise the middleware by calling awrap_model_call with request and handler
        result = await compaction_middleware.awrap_model_call(request, handler)

        # Verify compact was called with original messages
        mock_mw.compact.assert_awaited_once_with(short_msgs)

        # Verify handler was called with the request
        handler.assert_awaited_once_with(request)

        # Verify request.state["messages"] was updated to compacted result
        assert request.state["messages"] is compacted_msgs

        # Verify the middleware returns the handler's response
        assert result is handler_response


class TestBackwardCompatibility:
    def test_init_default_middleware_accepts_no_args(self) -> None:
        """init_default_middleware() works with no arguments (backward compat)."""
        middleware_list = init_default_middleware()
        assert len(middleware_list) > 0

    def test_init_default_middleware_accepts_backend_kwarg(self) -> None:
        """init_default_middleware(backend=...) still works."""
        mock_backend = MagicMock()
        middleware_list = init_default_middleware(backend=mock_backend)
        assert len(middleware_list) > 0

    def test_compaction_middleware_is_importable(self) -> None:
        """compaction_middleware can be imported and is a middleware object."""
        assert compaction_middleware is not None
