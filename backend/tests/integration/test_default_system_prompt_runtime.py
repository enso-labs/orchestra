from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi import Request
from httpx import ASGITransport, AsyncClient
from langgraph.store.memory import InMemoryStore

from main import app
from src.services.db import get_store


class _TestInMemoryStore(InMemoryStore):
    def __init__(self) -> None:
        super().__init__()
        self.fields = ["page_content", "metadata"]


@pytest.fixture
async def async_client() -> AsyncClient:
    store = _TestInMemoryStore()

    def override_get_store(_req: Request):
        return store

    app.dependency_overrides[get_store] = override_get_store
    app.state.store = store

    transport = ASGITransport(app=app)
    with patch("src.utils.auth.is_authorized_model", return_value=True):
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            yield client

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_stream_uses_file_backed_default_prompt_without_touching_langsmith(
    async_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    prompt_path = tmp_path / "default.md"
    prompt_path.write_text("runtime file prompt", encoding="utf-8")

    monkeypatch.setenv("DEFAULT_SYSTEM_PROMPT_SOURCE", "file")
    monkeypatch.setenv("DEFAULT_SYSTEM_PROMPT_PATH", str(prompt_path))

    captured = {}

    async def fake_stream_generator(**kwargs):
        captured.update(kwargs)
        yield "data: [done]\n\n"

    with (
        patch("src.controllers.llm.stream_generator", fake_stream_generator),
        patch("src.services.prompt.defaults.fetch_prompt", side_effect=AssertionError("LangSmith should not be used")),
    ):
        async with async_client.stream(
            "POST",
            "/api/llm/stream",
            json={"input": {"messages": [{"role": "user", "content": "Hello"}]}},
        ) as response:
            assert response.status_code == 200
            async for _chunk in response.aiter_text():
                break

    assert captured["system_prompt"] == "runtime file prompt"


@pytest.mark.asyncio
async def test_stream_uses_langsmith_prompt_only_when_source_is_langsmith(
    async_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DEFAULT_SYSTEM_PROMPT_SOURCE", "langsmith")
    monkeypatch.setenv("DEFAULT_SYSTEM_PROMPT_LANGSMITH_NAME", "runtime-langsmith")

    captured = {}

    async def fake_stream_generator(**kwargs):
        captured.update(kwargs)
        yield "data: [done]\n\n"

    with (
        patch("src.controllers.llm.stream_generator", fake_stream_generator),
        patch(
            "src.services.prompt.defaults.fetch_prompt",
            return_value=SimpleNamespace(content="runtime langsmith prompt"),
        ) as mock_fetch_prompt,
    ):
        async with async_client.stream(
            "POST",
            "/api/llm/stream",
            json={"input": {"messages": [{"role": "user", "content": "Hello"}]}},
        ) as response:
            assert response.status_code == 200
            async for _chunk in response.aiter_text():
                break

    assert captured["system_prompt"] == "runtime langsmith prompt"
    assert mock_fetch_prompt.call_count >= 1
    assert all(call.args == ("runtime-langsmith",) for call in mock_fetch_prompt.call_args_list)
