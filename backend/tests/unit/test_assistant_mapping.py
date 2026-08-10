"""Assistant-to-production-graph mapping contract tests."""

from types import SimpleNamespace

from src.services.assistant_mapping import (
    PRODUCTION_GRAPH_ID,
    assistant_run_context,
    build_run_request,
    production_assistant_id,
)


def test_custom_assistant_is_carried_as_context_on_one_production_graph():
    assistant = SimpleNamespace(
        id="custom-assistant",
        model="openai:gpt-4.1-mini",
        system_prompt="Be concise",
        instructions=None,
        tools=["search"],
        subagents=[],
        mcp={},
        a2a={},
        files={"/notes.md": {"content": "hello"}},
        metadata={"theme": "default"},
    )
    request = build_run_request(assistant, "hello", "thread-1")

    assert PRODUCTION_GRAPH_ID == "orchestra"
    assert request["assistant_id"] == production_assistant_id()
    assert request["context"]["assistant_id"] == "custom-assistant"
    assert request["config"]["configurable"]["model"] == "openai:gpt-4.1-mini"
    assert request["input"]["messages"][0]["content"] == "hello"
    assert "owner_id" not in assistant_run_context(assistant)
