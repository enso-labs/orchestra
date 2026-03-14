from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from src.agents import construct_agent, init_graph


@pytest.mark.asyncio
async def test_construct_agent_builds_system_prompt_string_for_openai() -> None:
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
    assert isinstance(call_kwargs["system_prompt"], str)
    assert "Be concise." in call_kwargs["system_prompt"]


@pytest.mark.asyncio
async def test_construct_agent_builds_system_prompt_string_for_non_openai() -> None:
    service_context = SimpleNamespace(config={}, store=MagicMock())

    with patch("src.agents.Orchestra") as mock_orchestra:
        await construct_agent(
            instructions="Be concise.",
            system_prompt="You are a helpful assistant.",
            model="anthropic:claude-sonnet-4-5",
            tools=[],
            service_context=service_context,
        )

    call_kwargs = mock_orchestra.call_args.kwargs
    assert isinstance(call_kwargs["system_prompt"], str)
    assert "Be concise." in call_kwargs["system_prompt"]


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
