"""Unit tests for CompactingMiddleware and SummarizationMiddleware."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage

from src.utils.compacting import SummarizationMiddleware


# --- Helper factories ---


def _make_messages(
    n: int, content_size: int = 100, include_system: bool = False
) -> list[BaseMessage]:
    """Create a list of messages with predictable token estimates.

    Each message has content of `content_size` chars → ~content_size//4 tokens.
    """
    msgs: list[BaseMessage] = []
    if include_system:
        msgs.append(SystemMessage(content="You are a helpful assistant."))
    for i in range(n):
        if i % 2 == 0:
            msgs.append(HumanMessage(content="x" * content_size))
        else:
            msgs.append(AIMessage(content="y" * content_size))
    return msgs


# --- CompactingMiddleware (ABC) tests ---


class TestEstimateTokens:
    def test_empty_list(self) -> None:
        mw = SummarizationMiddleware(token_threshold=100, recent_messages=2)
        assert mw.estimate_tokens([]) == 0

    def test_simple_content(self) -> None:
        mw = SummarizationMiddleware(token_threshold=100, recent_messages=2)
        msgs = [HumanMessage(content="a" * 400)]
        assert mw.estimate_tokens(msgs) == 100

    def test_non_string_content(self) -> None:
        mw = SummarizationMiddleware(token_threshold=100, recent_messages=2)
        msg = HumanMessage(content=[{"type": "text", "text": "hello"}])
        # str() representation will be used
        result = mw.estimate_tokens([msg])
        assert result > 0


class TestShouldCompact:
    def test_under_threshold(self) -> None:
        mw = SummarizationMiddleware(token_threshold=1000, recent_messages=2)
        msgs = _make_messages(2, content_size=100)  # ~50 tokens
        assert mw.should_compact(msgs) is False

    def test_over_threshold(self) -> None:
        mw = SummarizationMiddleware(token_threshold=10, recent_messages=2)
        msgs = _make_messages(5, content_size=100)  # ~125 tokens
        assert mw.should_compact(msgs) is True


class TestSplitMessages:
    def test_system_messages_separated(self) -> None:
        mw = SummarizationMiddleware(token_threshold=100, recent_messages=2)
        msgs = _make_messages(6, include_system=True)
        system, middle, recent = mw.split_messages(msgs)
        assert len(system) == 1
        assert all(isinstance(m, SystemMessage) for m in system)
        assert len(recent) == 2

    def test_few_messages_no_middle(self) -> None:
        mw = SummarizationMiddleware(token_threshold=100, recent_messages=6)
        msgs = _make_messages(4)
        system, middle, recent = mw.split_messages(msgs)
        assert middle == []
        assert len(recent) == 4


# --- SummarizationMiddleware tests ---


class TestSummarizationNoOp:
    @pytest.mark.asyncio
    async def test_no_op_under_threshold(self) -> None:
        mw = SummarizationMiddleware(token_threshold=999999, recent_messages=2)
        msgs = _make_messages(3, content_size=100)
        result = await mw.compact(msgs)
        assert result is msgs  # same object, untouched

    @pytest.mark.asyncio
    async def test_no_op_when_no_middle_messages(self) -> None:
        mw = SummarizationMiddleware(token_threshold=1, recent_messages=10)
        msgs = _make_messages(3, content_size=100)
        result = await mw.compact(msgs)
        assert result is msgs

    @pytest.mark.asyncio
    async def test_no_op_when_model_is_none(self) -> None:
        """Compaction is skipped when model is None to prevent init_chat_model(None)."""
        mw = SummarizationMiddleware(token_threshold=10, recent_messages=2, model=None)
        msgs = _make_messages(6, content_size=100)  # Would trigger compaction
        result = await mw.compact(msgs)
        assert result is msgs  # returned unchanged, no LLM call


class TestSummarizationCompaction:
    @pytest.mark.asyncio
    @patch("src.utils.compacting.init_chat_model")
    async def test_triggers_compaction(self, mock_init: MagicMock) -> None:
        mock_llm = AsyncMock()
        mock_llm.ainvoke.return_value = AIMessage(content="Summary of conversation.")
        mock_init.return_value = mock_llm

        mw = SummarizationMiddleware(token_threshold=10, recent_messages=2)
        msgs = _make_messages(6, content_size=100)
        result = await mw.compact(msgs)

        assert len(result) < len(msgs)
        mock_llm.ainvoke.assert_awaited_once()

    @pytest.mark.asyncio
    @patch("src.utils.compacting.init_chat_model")
    async def test_system_prompt_never_summarized(self, mock_init: MagicMock) -> None:
        mock_llm = AsyncMock()
        mock_llm.ainvoke.return_value = AIMessage(content="Summary.")
        mock_init.return_value = mock_llm

        mw = SummarizationMiddleware(token_threshold=10, recent_messages=2)
        msgs = _make_messages(6, content_size=100, include_system=True)
        result = await mw.compact(msgs)

        # System message preserved at the front
        assert isinstance(result[0], SystemMessage)
        assert result[0].content == "You are a helpful assistant."

    @pytest.mark.asyncio
    @patch("src.utils.compacting.init_chat_model")
    async def test_recent_messages_preserved(self, mock_init: MagicMock) -> None:
        mock_llm = AsyncMock()
        mock_llm.ainvoke.return_value = AIMessage(content="Summary.")
        mock_init.return_value = mock_llm

        recent_count = 3
        mw = SummarizationMiddleware(token_threshold=10, recent_messages=recent_count)
        msgs = _make_messages(8, content_size=100)
        result = await mw.compact(msgs)

        # Last `recent_count` messages should be the same objects
        assert result[-recent_count:] == msgs[-recent_count:]

    @pytest.mark.asyncio
    @patch("src.utils.compacting.init_chat_model")
    async def test_summary_has_prefix(self, mock_init: MagicMock) -> None:
        mock_llm = AsyncMock()
        mock_llm.ainvoke.return_value = AIMessage(content="Key facts here.")
        mock_init.return_value = mock_llm

        mw = SummarizationMiddleware(token_threshold=10, recent_messages=2)
        msgs = _make_messages(6, content_size=100)
        result = await mw.compact(msgs)

        summary_msg = result[0]  # no system msgs, so summary is first
        assert isinstance(summary_msg, SystemMessage)
        assert summary_msg.content.startswith("[CONVERSATION SUMMARY]")

    @pytest.mark.asyncio
    @patch("src.utils.compacting.init_chat_model")
    async def test_summary_has_compacted_metadata(self, mock_init: MagicMock) -> None:
        mock_llm = AsyncMock()
        mock_llm.ainvoke.return_value = AIMessage(content="Summary.")
        mock_init.return_value = mock_llm

        mw = SummarizationMiddleware(token_threshold=10, recent_messages=2)
        msgs = _make_messages(6, content_size=100)
        result = await mw.compact(msgs)

        summary_msg = result[0]
        assert summary_msg.metadata["compacted"] is True

    @pytest.mark.asyncio
    @patch("src.utils.compacting.init_chat_model")
    async def test_summary_has_original_count(self, mock_init: MagicMock) -> None:
        mock_llm = AsyncMock()
        mock_llm.ainvoke.return_value = AIMessage(content="Summary.")
        mock_init.return_value = mock_llm

        mw = SummarizationMiddleware(token_threshold=10, recent_messages=2)
        msgs = _make_messages(6, content_size=100)
        result = await mw.compact(msgs)

        summary_msg = result[0]
        # 6 messages - 2 recent = 4 middle messages summarized
        assert summary_msg.metadata["original_count"] == 4

    @pytest.mark.asyncio
    @patch("src.utils.compacting.init_chat_model")
    async def test_uses_configured_model(self, mock_init: MagicMock) -> None:
        mock_llm = AsyncMock()
        mock_llm.ainvoke.return_value = AIMessage(content="Summary.")
        mock_init.return_value = mock_llm

        mw = SummarizationMiddleware(
            token_threshold=10, recent_messages=2, model="openai:gpt-4"
        )
        msgs = _make_messages(6, content_size=100)
        await mw.compact(msgs)

        mock_init.assert_called_once_with("openai:gpt-4")


class TestCustomOverrides:
    def test_custom_threshold(self) -> None:
        mw = SummarizationMiddleware(token_threshold=500, recent_messages=2)
        assert mw.token_threshold == 500

    def test_custom_recent_messages(self) -> None:
        mw = SummarizationMiddleware(token_threshold=100, recent_messages=10)
        assert mw.recent_messages == 10

    def test_defaults_from_constants(self) -> None:
        from src.constants.llm import (
            DEFAULT_COMPACTION_RECENT_MESSAGES,
            DEFAULT_COMPACTION_TOKEN_THRESHOLD,
        )

        mw = SummarizationMiddleware()
        assert mw.token_threshold == DEFAULT_COMPACTION_TOKEN_THRESHOLD
        assert mw.recent_messages == DEFAULT_COMPACTION_RECENT_MESSAGES
