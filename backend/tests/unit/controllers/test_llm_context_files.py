from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.controllers.llm import LLMController
from src.schemas.entities.llm import LLMRequest


@pytest.mark.asyncio
async def test_llm_invoke_uses_resolved_context_files():
    params = LLMRequest(input={"messages": [{"role": "user", "content": "Hello"}]})
    controller = LLMController(
        user_id="user-1",
        store=MagicMock(),
        config={"configurable": {}, "metadata": {}},
    )

    agent = AsyncMock()
    agent.invoke = AsyncMock(return_value={"messages": []})

    @asynccontextmanager
    async def fake_checkpoint_db():
        yield MagicMock()

    with (
        patch("src.controllers.llm.init_config", return_value={"configurable": {}, "metadata": {}}),
        patch.object(controller.service_context.llm_service, "assistant", AsyncMock(return_value=params)),
        patch.object(controller, "_resolve_user_settings", AsyncMock(return_value=("openai:gpt-4o", None, None))),
        patch(
            "src.controllers.llm.prepare_memory_files",
            AsyncMock(return_value=({"/memory.md": {"content": ["memory"]}}, [])),
        ),
        patch(
            "src.controllers.llm.resolve_context_files",
            AsyncMock(return_value={"/resolved.md": {"content": ["resolved"]}}),
        ) as mock_resolve_context_files,
        patch("src.controllers.llm.get_checkpoint_db", fake_checkpoint_db),
        patch("src.controllers.llm.resolve_sandbox_backend", return_value=(MagicMock(), None, "state")),
        patch("src.controllers.llm.construct_agent", AsyncMock(return_value=agent)),
    ):
        await controller.llm_invoke(params)

    mock_resolve_context_files.assert_awaited_once()
    assert params.input.files == {"/resolved.md": {"content": ["resolved"]}}
    agent.invoke.assert_awaited_once()
