from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from langchain_core.messages import SystemMessage

from src.agents import construct_agent, init_graph
from src.utils.format import init_system_prompt


@pytest.mark.asyncio
async def test_construct_agent_builds_system_prompt_for_openai() -> None:
    service_context = SimpleNamespace(config={}, store=MagicMock())

    with patch("src.agents.Orchestra") as mock_orchestra:
        await construct_agent(
            instructions="Be concise.",
            system_prompt="You are a helpful assistant.",
            model="openai:gpt-4o",
            tools=[],
            service_context=service_context,
        )

    call_kwargs = mock_orchestra.call_args.kwargs
    prompt = call_kwargs["system_prompt"]
    # With default language metadata, returns SystemMessage with cache blocks
    assert isinstance(prompt, SystemMessage)
    blocks = prompt.content
    assert any("Be concise." in b.get("text", "") for b in blocks if isinstance(b, dict))


@pytest.mark.asyncio
async def test_construct_agent_builds_system_prompt_for_anthropic_with_metadata() -> None:
    service_context = SimpleNamespace(
        config={
            "metadata": {
                "current_utc": "2025-01-01T00:00:00+00:00",
                "timezone": "America/New_York",
                "language": "en-US",
            }
        },
        store=MagicMock(),
    )

    with patch("src.agents.Orchestra") as mock_orchestra:
        await construct_agent(
            instructions="Be concise.",
            system_prompt="You are a helpful assistant.",
            model="anthropic:claude-sonnet-4-5",
            tools=[],
            service_context=service_context,
        )

    call_kwargs = mock_orchestra.call_args.kwargs
    prompt = call_kwargs["system_prompt"]
    assert isinstance(prompt, SystemMessage)


def test_init_graph_passes_api_key_to_init_chat_model() -> None:
    with (
        patch("langchain.chat_models.init_chat_model", return_value=MagicMock()) as mock_init_chat_model,
        patch("src.agents.create_deep_agent", return_value=MagicMock()) as mock_create_agent,
    ):
        init_graph(
            tools=[],
            subagents=[],
            model="openai:gpt-4o",
            system_prompt="You are a helpful assistant.\n---\n",
            middleware=[],
            api_key="sk-test-key",
        )

    mock_init_chat_model.assert_called_once_with(
        model="openai:gpt-4o",
        api_key="sk-test-key",
    )
    mock_create_agent.assert_called_once()


class TestSystemPromptCacheBlocks:
    """Tests for init_system_prompt() content block structure."""

    def test_returns_string_when_no_metadata(self) -> None:
        """No metadata at all → plain string (backward compat for subagents)."""
        # Pass metadata with no language default to trigger string fallback
        result = init_system_prompt("Hello", {"metadata": {"language": None}})
        assert isinstance(result, str)
        assert result == "Hello"

    def test_returns_system_message_with_default_language(self) -> None:
        """Default language in empty config → SystemMessage with stable meta."""
        result = init_system_prompt("Hello", {})
        assert isinstance(result, SystemMessage)
        blocks = result.content
        assert isinstance(blocks, list)
        # Should have: base prompt + stable meta (LANGUAGE)
        assert any("LANGUAGE: en-US" in b.get("text", "") for b in blocks if isinstance(b, dict))

    def test_returns_system_message_with_metadata(self) -> None:
        """With UTC + timezone → SystemMessage with content blocks."""
        config = {
            "metadata": {
                "current_utc": "2025-01-01T00:00:00+00:00",
                "timezone": "America/New_York",
                "language": "en-US",
            }
        }
        result = init_system_prompt("You are helpful.", config)
        assert isinstance(result, SystemMessage)

    def test_static_blocks_have_cache_control(self) -> None:
        """Static blocks must have cache_control for Anthropic caching."""
        config = {
            "metadata": {
                "current_utc": "2025-01-01T00:00:00+00:00",
                "timezone": "UTC",
                "language": "en-US",
            }
        }
        result = init_system_prompt("System prompt.", config, instructions="Be concise.")
        assert isinstance(result, SystemMessage)
        blocks = result.content
        assert isinstance(blocks, list)

        # Static blocks: system_prompt, instructions, stable meta (TIMEZONE + LANGUAGE)
        # All should have cache_control
        cached_blocks = [b for b in blocks if isinstance(b, dict) and "cache_control" in b]
        assert len(cached_blocks) >= 3
        for block in cached_blocks:
            assert block["cache_control"] == {"type": "ephemeral"}

    def test_dynamic_metadata_block_has_no_cache_control(self) -> None:
        """Dynamic metadata block must NOT have cache_control."""
        config = {
            "metadata": {
                "current_utc": "2025-01-01T00:00:00+00:00",
                "timezone": "UTC",
                "language": "en-US",
            }
        }
        result = init_system_prompt("System prompt.", config)
        assert isinstance(result, SystemMessage)
        blocks = result.content
        # Last block is dynamic metadata
        last_block = blocks[-1]
        assert "cache_control" not in last_block

    def test_dynamic_block_contains_time_data(self) -> None:
        """Dynamic metadata block should contain time info; stable meta in cached block."""
        config = {
            "metadata": {
                "current_utc": "2025-06-15T12:00:00+00:00",
                "timezone": "Europe/London",
                "language": "en-GB",
            }
        }
        result = init_system_prompt("Base prompt.", config)
        assert isinstance(result, SystemMessage)
        blocks = result.content

        # Last block (dynamic, uncached) has time-varying data
        last_block = blocks[-1]
        assert "cache_control" not in last_block
        assert "CURRENT_UTC:" in last_block["text"]

        # Stable metadata (TIMEZONE, LANGUAGE) in a cached block
        all_text = "\n".join(b.get("text", "") for b in blocks if isinstance(b, dict))
        assert "TIMEZONE: Europe/London" in all_text
        assert "LANGUAGE: en-GB" in all_text

    def test_instructions_block_structure(self) -> None:
        """Instructions should be in a separate cached block."""
        config = {
            "metadata": {
                "current_utc": "2025-01-01T00:00:00+00:00",
                "language": "en-US",
            }
        }
        result = init_system_prompt("System prompt.", config, instructions="Step 1: Do X.")
        assert isinstance(result, SystemMessage)
        blocks = result.content
        # Block 0: system prompt, Block 1: instructions, Block 2: metadata
        assert "System prompt." in blocks[0]["text"]
        assert "INSTRUCTIONS:" in blocks[1]["text"]
        assert "Step 1: Do X." in blocks[1]["text"]

    def test_returns_system_message_with_instructions_only(self) -> None:
        """Instructions with language → SystemMessage with cached blocks."""
        config = {"metadata": {"language": "en-US"}}
        result = init_system_prompt("Base.", config, instructions="Do X.")
        assert isinstance(result, SystemMessage)
        blocks = result.content
        assert isinstance(blocks, list)
        # Should have: base prompt + instructions + stable meta (LANGUAGE) = 3
        assert len(blocks) == 3
        # All blocks should be cached (no time-varying data)
        for block in blocks:
            assert "cache_control" in block


class TestCacheTTLOverride:
    """Tests for ANTHROPIC_PROMPT_CACHE_TTL env var in middleware stack."""

    def test_default_ttl_no_extra_middleware(self) -> None:
        """Default 5m TTL should not add extra AnthropicPromptCachingMiddleware."""
        from src.utils.middleware import init_default_middleware, AnthropicPromptCachingMiddleware

        middleware_list = init_default_middleware(backend=None)
        anthropic_mw = [m for m in middleware_list if isinstance(m, AnthropicPromptCachingMiddleware)]
        assert len(anthropic_mw) == 0

    @patch("src.utils.middleware.ANTHROPIC_PROMPT_CACHE_TTL", "1h")
    def test_1h_ttl_adds_anthropic_middleware(self) -> None:
        """Setting TTL to 1h should add AnthropicPromptCachingMiddleware."""
        from src.utils.middleware import init_default_middleware, AnthropicPromptCachingMiddleware

        middleware_list = init_default_middleware(backend=None)
        anthropic_mw = [m for m in middleware_list if isinstance(m, AnthropicPromptCachingMiddleware)]
        assert len(anthropic_mw) == 1
        assert anthropic_mw[0].ttl == "1h"
