from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from langchain_core.messages import SystemMessage

from src.agents import construct_agent
from src.schemas.entities.llm import Assistant, LLMRequest
from src.services.llm import LLMService


def _build_llm_service() -> LLMService:
    tool_service = SimpleNamespace(
        mcp_tools=AsyncMock(return_value=[]),
        tool_repo=SimpleNamespace(search=AsyncMock(return_value=[])),
    )
    assistant_service = SimpleNamespace(
        get=AsyncMock(return_value=None),
        get_public=AsyncMock(return_value=None),
    )
    return LLMService(
        user_id="user-1",
        store=MagicMock(),
        tool_service=tool_service,
        assistant_service=assistant_service,
        config={"configurable": {"thread_id": "thread-1"}, "metadata": {}},
    )


def test_llm_request_system_prompt_uses_runtime_default_factory(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    prompt_path = tmp_path / "default.md"
    prompt_path.write_text("file prompt", encoding="utf-8")

    monkeypatch.setenv("DEFAULT_SYSTEM_PROMPT_SOURCE", "file")
    monkeypatch.setenv("DEFAULT_SYSTEM_PROMPT_PATH", str(prompt_path))

    request = LLMRequest(input={"messages": [{"role": "user", "content": "Hello"}]})

    assert request.system_prompt == "file prompt"
    assert "system_prompt" not in request.model_fields_set


def test_llm_service_default_system_prompt_uses_file_prompt_when_missing(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    prompt_path = tmp_path / "default.md"
    prompt_path.write_text("service default", encoding="utf-8")

    monkeypatch.setenv("DEFAULT_SYSTEM_PROMPT_SOURCE", "file")
    monkeypatch.setenv("DEFAULT_SYSTEM_PROMPT_PATH", str(prompt_path))

    service = _build_llm_service()
    request = LLMRequest(
        input={"messages": [{"role": "user", "content": "Hello"}]},
        system_prompt=None,
    )

    assert service.default_system_prompt(request) == "service default"


@pytest.mark.asyncio
async def test_explicit_request_system_prompt_beats_assistant_system_prompt() -> None:
    service = _build_llm_service()
    service.assistant_service.get.return_value = Assistant(
        id="assistant-1",
        name="Assistant",
        tools=[],
        system_prompt="assistant prompt",
    )

    params = LLMRequest(
        input={"messages": [{"role": "user", "content": "Hello"}]},
        system_prompt="request prompt",
        metadata={"assistant_id": "assistant-1"},
    )

    resolved = await service.assistant(params)

    assert resolved.system_prompt == "request prompt"


@pytest.mark.asyncio
async def test_assistant_system_prompt_beats_default_when_request_has_no_override(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    prompt_path = tmp_path / "default.md"
    prompt_path.write_text("file default", encoding="utf-8")

    monkeypatch.setenv("DEFAULT_SYSTEM_PROMPT_SOURCE", "file")
    monkeypatch.setenv("DEFAULT_SYSTEM_PROMPT_PATH", str(prompt_path))

    service = _build_llm_service()
    service.assistant_service.get.return_value = Assistant(
        id="assistant-1",
        name="Assistant",
        tools=[],
        system_prompt="assistant prompt",
    )

    params = LLMRequest(
        input={"messages": [{"role": "user", "content": "Hello"}]},
        system_prompt=None,
        metadata={"assistant_id": "assistant-1"},
    )

    resolved = await service.assistant(params)

    assert resolved.system_prompt == "assistant prompt"


@pytest.mark.asyncio
async def test_construct_agent_appends_instructions_after_selected_base_prompt() -> None:
    service_context = SimpleNamespace(config={}, store=MagicMock())

    with pytest.MonkeyPatch.context() as monkeypatch:
        captured = {}

        class FakeOrchestra:
            def __init__(self, **kwargs):
                captured.update(kwargs)

        monkeypatch.setattr("src.agents.Orchestra", FakeOrchestra)
        await construct_agent(
            instructions="Follow the repo rules.",
            system_prompt="chosen base prompt",
            model="openai:gpt-4o",
            tools=[],
            service_context=service_context,
        )

    prompt = captured["system_prompt"]
    # init_system_prompt now returns SystemMessage with content blocks
    if isinstance(prompt, SystemMessage):
        blocks = prompt.content
        all_text = "\n".join(b.get("text", "") for b in blocks if isinstance(b, dict))
        assert "chosen base prompt" in all_text
        assert "INSTRUCTIONS:\nFollow the repo rules." in all_text
    else:
        assert prompt.startswith("chosen base prompt")
        assert "INSTRUCTIONS:\nFollow the repo rules." in prompt
