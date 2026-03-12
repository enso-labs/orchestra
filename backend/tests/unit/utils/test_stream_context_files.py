from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.schemas.entities.llm import LLMInput
from src.utils.stream import stream_generator


class FakeMessage:
    def __init__(self):
        self.role = "user"
        self.content = "Hello"
        self.model = None


@pytest.mark.asyncio
async def test_stream_generator_uses_resolved_context_files():
    llm_input = LLMInput(messages=[{"role": "user", "content": "Hello"}])
    llm_input.messages[-1] = FakeMessage()

    service_context = MagicMock()
    service_context.user_id = "user-1"
    service_context.store = MagicMock()
    service_context.memory_service = MagicMock()

    agent = AsyncMock()
    agent.model = "openai:gpt-4o"

    async def fake_astream(*_args, **_kwargs):
        yield ("values", {"messages": [], "files": {}, "todos": []})

    agent.astream = fake_astream

    @asynccontextmanager
    async def fake_checkpoint_db():
        yield MagicMock()

    with (
        patch(
            "src.utils.stream.prepare_memory_files",
            AsyncMock(
                return_value=(
                    {
                        "/memory.md": {"content": ["memory"]},
                        "/config.md": {"content": ["memory config"]},
                    },
                    ["/memory.md", "/config.md"],
                )
            ),
        ),
        patch(
            "src.utils.stream.resolve_context_files",
            AsyncMock(return_value={"/resolved.md": {"content": ["resolved"]}}),
        ) as mock_resolve_context_files,
        patch("src.utils.stream.get_checkpoint_db", fake_checkpoint_db),
        patch("src.utils.stream.resolve_sandbox_backend", return_value=(MagicMock(), None, "state")),
        patch("src.utils.stream.construct_agent", AsyncMock(return_value=agent)) as mock_construct_agent,
    ):
        chunks = [
            chunk
            async for chunk in stream_generator(
                input=llm_input,
                model="openai:gpt-4o",
                system_prompt="system",
                tools=[],
                subagents=[],
                config={
                    "configurable": {"thread_id": "t1"},
                    "metadata": {"files": {"/config.md": {"content": ["config"]}}},
                },
                service_context=service_context,
            )
        ]

    assert chunks
    mock_resolve_context_files.assert_awaited_once()
    assert mock_construct_agent.await_args.kwargs["memory"] == ["/config.md"]
