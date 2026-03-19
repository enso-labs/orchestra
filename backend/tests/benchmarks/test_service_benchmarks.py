"""Benchmarks for service layer and agent initialization.

Measures CPU-bound bottlenecks in service construction, tool resolution,
prompt assembly, and Pydantic schema serialization/validation — all
isolated from I/O via InMemoryStore and mocks.
"""

import asyncio
from datetime import datetime, timezone
from unittest.mock import patch
from uuid import uuid4

import pytest
from langgraph.store.memory import InMemoryStore

from src.schemas.entities.llm import (
    Assistant,
    Config,
    LLMInput,
    LLMRequest,
    PublicAssistant,
)
from src.schemas.entities.store import Thread
from src.services.assistant import AssistantService
from src.services.llm import LLMService
from src.services.tool import ToolService
from langchain_core.messages import SystemMessage
from src.utils.format import init_system_prompt

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

BENCH_USER = "bench-svc-user-0000"
WARN_THRESHOLD_MS = 50  # Flag any operation >50ms


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def _make_assistant_dict(index: int = 0, tool_count: int = 3) -> dict:
    """Return kwargs for AssistantService.update()."""
    return {
        "name": f"Bench Assistant {index}",
        "description": f"Service benchmark assistant #{index}.",
        "tools": [f"tool_{i}" for i in range(tool_count)],
        "system_prompt": f"You are benchmark assistant {index}. Help with tasks.",
        "instructions": None,
        "mcp": {},
        "a2a": {},
        "metadata": {"tag": "benchmark", "index": index},
        "public": False,
    }


def _make_runnable_config(
    user_id: str = BENCH_USER,
    thread_id: str = None,
    assistant_id: str = None,
    with_timezone: bool = True,
) -> dict:
    """Build a RunnableConfig dict for prompt assembly benchmarks."""
    metadata = {
        "user_id": user_id,
        "language": "en-US",
    }
    if with_timezone:
        metadata["current_utc"] = datetime.now(timezone.utc).isoformat()
        metadata["timezone"] = "America/New_York"
    return {
        "configurable": {
            "user_id": user_id,
            "thread_id": thread_id or str(uuid4()),
            "assistant_id": assistant_id,
        },
        "metadata": metadata,
    }


def _make_large_messages(count: int) -> list[dict]:
    """Build a list of ChatMessage-like dicts."""
    return [{"role": "user" if i % 2 == 0 else "assistant", "content": f"Message {i} " * 20} for i in range(count)]


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def svc_store():
    """Fresh InMemoryStore for service benchmarks."""
    return InMemoryStore()


@pytest.fixture
def assistant_svc(svc_store):
    return AssistantService(user_id=BENCH_USER, store=svc_store)


@pytest.fixture
def tool_svc(svc_store):
    return ToolService(user_id=BENCH_USER, store=svc_store)


@pytest.fixture
def llm_svc(svc_store, tool_svc, assistant_svc):
    config = _make_runnable_config()
    return LLMService(
        user_id=BENCH_USER,
        store=svc_store,
        tool_service=tool_svc,
        assistant_service=assistant_svc,
        config=config,
    )


# ===========================================================================
# 1. Service construction benchmarks
# ===========================================================================


def test_bench_assistant_service_init(benchmark):
    """Benchmark AssistantService construction."""

    def _call():
        store = InMemoryStore()
        return AssistantService(user_id=BENCH_USER, store=store)

    result = benchmark(_call)
    assert result is not None


def test_bench_tool_service_init(benchmark):
    """Benchmark ToolService construction."""

    def _call():
        store = InMemoryStore()
        return ToolService(user_id=BENCH_USER, store=store)

    result = benchmark(_call)
    assert result is not None


def test_bench_llm_service_init(benchmark):
    """Benchmark LLMService construction with dependencies."""

    def _call():
        store = InMemoryStore()
        tool_svc = ToolService(user_id=BENCH_USER, store=store)
        asst_svc = AssistantService(user_id=BENCH_USER, store=store)
        config = _make_runnable_config()
        return LLMService(
            user_id=BENCH_USER,
            store=store,
            tool_service=tool_svc,
            assistant_service=asst_svc,
            config=config,
        )

    result = benchmark(_call)
    assert result is not None


# ===========================================================================
# 2. Tool resolution benchmarks
# ===========================================================================


def test_bench_init_tool_library(benchmark):
    """Benchmark init_tool_library() — loads all default + optional tools."""
    from src.tools import init_tool_library

    def _call():
        return init_tool_library(user_id=BENCH_USER)

    result = benchmark(_call)
    assert len(result) > 0


def test_bench_tool_resolution_with_names(benchmark, llm_svc):
    """Benchmark LLMService.init_tools() with tool name resolution."""

    with patch("src.services.llm.A2AServers") as mock_a2a:
        mock_a2a.return_value.fetch_agent_cards_as_tools.return_value = []

        def _call():
            return _run(llm_svc.init_tools(tools=["web_search", "code_interpreter"], a2a={}, mcp={}))

        result = benchmark(_call)
        assert isinstance(result, list)


def test_bench_tool_resolution_empty(benchmark, llm_svc):
    """Benchmark LLMService.init_tools() with no tools requested."""

    with patch("src.services.llm.A2AServers") as mock_a2a:
        mock_a2a.return_value.fetch_agent_cards_as_tools.return_value = []

        def _call():
            return _run(llm_svc.init_tools(tools=[], a2a={}, mcp={}))

        result = benchmark(_call)
        assert isinstance(result, list)


# ===========================================================================
# 3. Prompt assembly benchmarks
# ===========================================================================


def _extract_text(result) -> str:
    """Extract text from init_system_prompt result (str or SystemMessage)."""
    if isinstance(result, str):
        return result
    if isinstance(result, SystemMessage):
        blocks = result.content
        if isinstance(blocks, str):
            return blocks
        return "\n".join(b.get("text", "") for b in blocks if isinstance(b, dict))
    return str(result)


def test_bench_prompt_assembly_basic(benchmark):
    """Benchmark init_system_prompt() with minimal config."""
    config = _make_runnable_config(with_timezone=False)

    def _call():
        return init_system_prompt("You are a helpful assistant.", config)

    result = benchmark(_call)
    text = _extract_text(result)
    assert "helpful assistant" in text


def test_bench_prompt_assembly_full(benchmark):
    """Benchmark init_system_prompt() with timezone + instructions."""
    config = _make_runnable_config(with_timezone=True)

    def _call():
        return init_system_prompt(
            "You are a helpful assistant with extensive knowledge.",
            config,
            instructions="Always be concise. Use bullet points when possible.",
        )

    result = benchmark(_call)
    text = _extract_text(result)
    assert "INSTRUCTIONS" in text
    assert "TIMEZONE" in text


def test_bench_prompt_assembly_long_prompt(benchmark):
    """Benchmark init_system_prompt() with a large system prompt."""
    long_prompt = "You are a helpful assistant. " * 200  # ~5KB prompt
    config = _make_runnable_config(with_timezone=True)

    def _call():
        return init_system_prompt(long_prompt, config, instructions="Be thorough." * 50)

    result = benchmark(_call)
    text = _extract_text(result)
    assert len(text) > 5000


# ===========================================================================
# 4. Assistant.to_llm_request conversion
# ===========================================================================


def test_bench_assistant_to_llm_request(benchmark):
    """Benchmark converting an Assistant to an LLMRequest."""
    assistant = Assistant(
        id=str(uuid4()),
        name="Benchmark Bot",
        description="A benchmark assistant",
        tools=["web_search", "code_interpreter", "send_webhook_to_channel"],
        system_prompt="You are a helpful assistant.",
        mcp={},
        a2a={},
        metadata={"env": "bench"},
    )
    llm_input = LLMInput(messages=[{"role": "user", "content": "Hello"}])
    config = Config(user_id=BENCH_USER, thread_id=str(uuid4()))

    def _call():
        return assistant.to_llm_request(input=llm_input, metadata=config)

    result = benchmark(_call)
    assert result.system_prompt == "You are a helpful assistant."


# ===========================================================================
# 5. Pydantic schema validation benchmarks
# ===========================================================================


def test_bench_assistant_validation(benchmark):
    """Benchmark Assistant model validation from dict."""
    data = {
        "name": "Bench Assistant",
        "description": "A benchmark assistant for perf testing.",
        "tools": [f"tool_{i}" for i in range(10)],
        "system_prompt": "You are a helpful assistant with many capabilities.",
        "subagents": [{"name": f"sub_{i}", "model": "gpt-4"} for i in range(3)],
        "mcp": {"server1": {"url": "http://localhost:8080"}},
        "a2a": {"agent1": {"base_url": "http://localhost:9090"}},
        "files": {f"file_{i}.py": f"# content {i}" for i in range(5)},
        "metadata": {"tag": "benchmark", "version": 2},
        "public": False,
    }

    def _call():
        return Assistant(**data)

    result = benchmark(_call)
    assert result.name == "Bench Assistant"
    assert result.slug == "bench-assistant"


def test_bench_assistant_validation_large(benchmark):
    """Benchmark Assistant validation with many tools and large files dict."""
    data = {
        "name": "Large Assistant",
        "description": "A large assistant with many tools and files.",
        "tools": [f"tool_{i}" for i in range(50)],
        "system_prompt": "You are a large assistant. " * 100,
        "files": {f"path/to/file_{i}.py": f"def func_{i}():\n    pass\n" * 20 for i in range(20)},
        "metadata": {f"key_{i}": f"value_{i}" for i in range(20)},
        "public": True,
        "owner_id": str(uuid4()),
    }

    def _call():
        return Assistant(**data)

    result = benchmark(_call)
    assert len(result.tools) == 50


def test_bench_llm_request_validation(benchmark):
    """Benchmark LLMRequest validation with nested models."""
    data = {
        "input": {"messages": _make_large_messages(20)},
        "model": "openai:gpt-4",
        "system_prompt": "You are helpful.",
        "tools": ["web_search", "code_interpreter"],
        "metadata": {"user_id": BENCH_USER, "thread_id": str(uuid4())},
    }

    def _call():
        return LLMRequest(**data)

    result = benchmark(_call)
    assert len(result.input.messages) == 20


def test_bench_llm_request_validation_large(benchmark):
    """Benchmark LLMRequest with a large conversation history."""
    data = {
        "input": {"messages": _make_large_messages(100)},
        "model": "anthropic:claude-sonnet-4-6",
        "system_prompt": "You are a highly capable assistant." * 50,
        "instructions": "Follow these detailed instructions." * 30,
        "tools": [f"tool_{i}" for i in range(20)],
        "metadata": {
            "user_id": BENCH_USER,
            "thread_id": str(uuid4()),
            "assistant_id": str(uuid4()),
        },
    }

    def _call():
        return LLMRequest(**data)

    result = benchmark(_call)
    assert len(result.input.messages) == 100


# ===========================================================================
# 6. Pydantic schema serialization benchmarks
# ===========================================================================


def test_bench_assistant_serialization(benchmark):
    """Benchmark Assistant.model_dump() serialization."""
    assistant = Assistant(
        id=str(uuid4()),
        name="Serialize Test",
        description="Testing serialization speed.",
        tools=[f"tool_{i}" for i in range(10)],
        system_prompt="You are a helpful assistant.",
        files={f"file_{i}.txt": f"content {i}" for i in range(10)},
        metadata={"env": "bench"},
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    def _call():
        return assistant.model_dump()

    result = benchmark(_call)
    assert result["name"] == "Serialize Test"


def test_bench_assistant_json_serialization(benchmark):
    """Benchmark Assistant.model_dump_json() JSON serialization."""
    assistant = Assistant(
        id=str(uuid4()),
        name="JSON Serialize Test",
        description="Testing JSON serialization speed.",
        tools=[f"tool_{i}" for i in range(20)],
        system_prompt="You are a helpful assistant.",
        files={f"file_{i}.txt": f"content {i}" * 50 for i in range(10)},
        metadata={"env": "bench", "tags": ["perf", "test"]},
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    def _call():
        return assistant.model_dump_json()

    result = benchmark(_call)
    assert "JSON Serialize Test" in result


def test_bench_llm_request_serialization(benchmark):
    """Benchmark LLMRequest.model_dump() with nested models."""
    request = LLMRequest(
        input=LLMInput(messages=[{"role": "user", "content": f"Message {i}" * 10} for i in range(50)]),
        model="openai:gpt-4",
        system_prompt="You are a helpful assistant.",
        tools=[f"tool_{i}" for i in range(15)],
        metadata=Config(user_id=BENCH_USER, thread_id=str(uuid4())),
    )

    def _call():
        return request.model_dump()

    result = benchmark(_call)
    assert len(result["input"]["messages"]) == 50


def test_bench_thread_serialization_large(benchmark):
    """Benchmark Thread serialization with many messages."""
    thread = Thread(
        id=str(uuid4()),
        title="Large benchmark thread",
        messages=[{"role": "user" if i % 2 == 0 else "assistant", "content": f"Message {i} " * 30} for i in range(200)],
        metadata={"tag": "benchmark"},
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    def _call():
        return thread.model_dump()

    result = benchmark(_call)
    assert len(result["messages"]) == 200


# ===========================================================================
# 7. LLMInput message conversion
# ===========================================================================


def test_bench_message_conversion_small(benchmark):
    """Benchmark LLMInput.to_langchain_messages() with 10 messages."""

    def _call():
        inp = LLMInput(messages=_make_large_messages(10))
        inp.to_langchain_messages()
        return inp

    result = benchmark(_call)
    assert len(result.messages) == 10


def test_bench_message_conversion_large(benchmark):
    """Benchmark LLMInput.to_langchain_messages() with 100 messages."""

    def _call():
        inp = LLMInput(messages=_make_large_messages(100))
        inp.to_langchain_messages()
        return inp

    result = benchmark(_call)
    assert len(result.messages) == 100


# ===========================================================================
# 8. PublicAssistant projection
# ===========================================================================


def test_bench_public_assistant_projection(benchmark):
    """Benchmark PublicAssistant.from_assistant() safe projection."""
    assistant = Assistant(
        id=str(uuid4()),
        name="Public Bot",
        description="A public assistant.",
        tools=["web_search"],
        system_prompt="Secret system prompt that should not leak.",
        files={"secret.txt": "top secret content"},
        metadata={"internal": True},
        public=True,
        owner_id=str(uuid4()),
        published_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    def _call():
        return PublicAssistant.from_assistant(assistant)

    result = benchmark(_call)
    assert result.name == "Public Bot"


# ===========================================================================
# 9. AssistantService CRUD (async, business logic isolated)
# ===========================================================================


def test_bench_assistant_service_create(benchmark, assistant_svc):
    """Benchmark AssistantService.update() — create an assistant."""
    counter = {"i": 0}

    def _call():
        counter["i"] += 1
        aid = str(uuid4())
        data = _make_assistant_dict(counter["i"])
        _run(assistant_svc.update(aid, data))
        return aid

    result = benchmark(_call)
    assert result is not None


def test_bench_assistant_service_get(benchmark, assistant_svc):
    """Benchmark AssistantService.get() — fetch a single assistant."""
    aid = str(uuid4())
    _run(assistant_svc.update(aid, _make_assistant_dict(0)))

    def _call():
        return _run(assistant_svc.get(aid))

    result = benchmark(_call)
    assert result is not None
    assert result.name == "Bench Assistant 0"


def test_bench_assistant_service_search(benchmark, assistant_svc):
    """Benchmark AssistantService.search() with 50 assistants."""
    for i in range(50):
        _run(assistant_svc.update(str(uuid4()), _make_assistant_dict(i)))

    def _call():
        return _run(assistant_svc.search(limit=50))

    result = benchmark(_call)
    assert len(result) == 50
