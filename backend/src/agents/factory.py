"""Production Aegra graph factory for Orchestra.

Aegra calls a graph export for more than a run.  It also calls the export while
reading thread state and while extracting assistant schemas.  Keeping those
paths in one factory is important: constructing a Daytona/MCP sandbox while
serving a schema request is both expensive and, for Daytona, a resource leak.

The factory deliberately does not provide a checkpointer.  Aegra owns the
checkpointer and injects it into the compiled graph for each request.
"""

from __future__ import annotations

import inspect
from collections.abc import AsyncIterator, Mapping
from contextlib import asynccontextmanager
from copy import deepcopy
from typing import Any
from uuid import uuid4

from langchain.tools import ToolRuntime
from langchain_core.runnables import RunnableConfig
from langgraph.store.base import BaseStore
from langgraph_sdk.runtime import ServerRuntime

try:
    from aegra_api.services.graph_factory import is_for_execution
except ImportError:  # pragma: no cover - only useful before aegra-api is installed

    def is_for_execution(access_context: str) -> bool:
        """Compatibility guard for source-only tooling without aegra-api."""
        return access_context == "threads.create_run"


from src.agents import (
    construct_agent,
    init_graph,
    prepare_memory_files,
    resolve_sandbox_backend,
)
from src.constants.llm import DEFAULT_CHAT_MODEL
from src.contexts.service import ServiceContext
from src.schemas.contexts import ContextSchema
from src.schemas.entities import Config, LLMRequest
from src.schemas.entities.llm import LLMInput
from src.services.context_files import resolve_context_files, select_memory_sources
from src.services.db import get_store_in_memory
from src.utils.logger import logger
from src.utils.llm import resolve_api_key
from src.repos.user_settings_repo import UserSettingsRepo


# Aegra's generated default assistant is not an Orchestra assistant.  The
# custom assistant ID is carried in run context/config and is resolved through
# Orchestra's existing store namespace instead of Aegra's unscoped store.
PRODUCTION_GRAPH_ID = "orchestra"


_READ_GRAPH: Any | None = None


def _as_dict(value: Any) -> dict[str, Any]:
    """Convert a runtime context/config value to a detached mapping."""
    if value is None:
        return {}
    if isinstance(value, Mapping):
        return dict(value)
    if hasattr(value, "model_dump"):
        dumped = value.model_dump()
        return dict(dumped) if isinstance(dumped, Mapping) else {}
    if hasattr(value, "__dict__"):
        return dict(value.__dict__)
    return {}


def _anonymous(user: Any) -> bool:
    """Return whether an Aegra user is guest-capable rather than tenant-authenticated."""
    if user is None:
        return True
    if not getattr(user, "is_authenticated", True):
        return True
    return getattr(user, "identity", None) in (None, "", "anonymous")


def _runtime_user_id(runtime: ServerRuntime[Any]) -> str | None:
    """Get the only trusted user identity: the Aegra runtime user."""
    user = getattr(runtime, "user", None)
    if _anonymous(user):
        return None
    return str(user.identity)


def _runtime_context(runtime: ServerRuntime[Any]) -> dict[str, Any]:
    """Return execution context without trusting a client identity field."""
    execution_runtime = getattr(runtime, "execution_runtime", None)
    if execution_runtime is None:
        return {}
    context = _as_dict(getattr(execution_runtime, "context", None))
    # ``user_id`` is server-owned.  Removing it here also prevents
    # ServiceContext's backwards-compatible config fallback from selecting a
    # forged identity for anonymous runs.
    context.pop("user_id", None)
    return context


def _sanitized_config(config: RunnableConfig | Mapping[str, Any] | None) -> dict[str, Any]:
    """Copy Aegra's config while removing client-controlled tenant identity."""
    result = deepcopy(_as_dict(config))
    configurable = _as_dict(result.get("configurable"))
    metadata = _as_dict(result.get("metadata"))
    configurable.pop("user_id", None)
    metadata.pop("user_id", None)
    result["configurable"] = configurable
    result["metadata"] = metadata
    return result


def _make_request(config: dict[str, Any], context: dict[str, Any]) -> LLMRequest:
    """Build the existing request model from Aegra assistant config/context."""
    configurable = _as_dict(config.get("configurable"))
    metadata = _as_dict(config.get("metadata"))
    values = {**configurable, **metadata, **context}
    values.pop("user_id", None)

    thread_id = values.get("thread_id") or str(uuid4())
    run_id = values.get("run_id") or config.get("run_id")
    assistant_id = values.get("assistant_id")
    project_id = values.get("project_id")

    request_metadata = Config(
        thread_id=str(thread_id),
        run_id=str(run_id) if run_id else None,
        assistant_id=str(assistant_id) if assistant_id else None,
        project_id=str(project_id) if project_id else None,
    )

    input_files = values.get("files") or {}
    if not isinstance(input_files, dict):
        input_files = {}

    # Aegra's context/config is the assistant configuration.  The graph input
    # itself arrives later from the Agent Protocol run and is intentionally not
    # fabricated here; an empty message list is sufficient for assistant/tool
    # resolution and keeps factory construction independent of the turn input.
    request_values: dict[str, Any] = {
        "input": LLMInput(messages=[], files=input_files),
        "model": values.get("model"),
        "reasoning_effort": values.get("reasoning_effort"),
        "tools": values.get("tools") or [],
        "a2a": values.get("a2a") or {},
        "mcp": values.get("mcp") or {},
        "subagents": values.get("subagents") or [],
        "metadata": request_metadata,
        "stream_mode": values.get("stream_mode"),
    }
    if values.get("system_prompt") is not None:
        request_values["system_prompt"] = values["system_prompt"]
    if values.get("instructions") is not None:
        request_values["instructions"] = values["instructions"]
    return LLMRequest(**request_values)


async def _resolve_user_settings(
    user_id: str | None,
    store: BaseStore,
    model: str | None,
    reasoning_effort: str | None,
) -> tuple[str, str | None, str | None, str | None, str | None, str | None]:
    """Resolve user defaults and provider credentials once per factory call."""
    if not user_id:
        return model or DEFAULT_CHAT_MODEL, None, None, None, None, reasoning_effort

    settings_repo = UserSettingsRepo(user_id, store)
    settings = await settings_repo._get_or_create()
    user_keys = settings_repo._decrypt_keys(settings)

    resolved_model = model or getattr(settings, "default_model", None) or DEFAULT_CHAT_MODEL
    resolved_reasoning = reasoning_effort or getattr(settings, "default_reasoning_effort", None)
    default_sandbox = getattr(settings, "default_sandbox", None)
    mcp_sandbox_url = getattr(settings, "default_mcp_sandbox_url", None)
    mcp_api_key = user_keys.get("MCP_SANDBOX_API_KEY") if user_keys else None
    api_key = resolve_api_key(resolved_model, user_keys if user_keys else None)
    return resolved_model, api_key, default_sandbox, mcp_sandbox_url, mcp_api_key, resolved_reasoning


def _build_tool_runtime(
    *,
    config: dict[str, Any],
    request: LLMRequest,
    user_id: str | None,
    store: BaseStore,
) -> ToolRuntime:
    """Create the runtime required by the existing sandbox resolver."""
    return ToolRuntime(
        state={"messages": [], "files": request.input.files or {}},
        context=ContextSchema(model=request.model or DEFAULT_CHAT_MODEL, user_id=user_id),
        tool_call_id=str(config.get("run_id") or "aegra-factory"),
        store=store,
        stream_writer=lambda _chunk: None,
        config=config,
    )


def _read_graph() -> Any:
    """Return a topology-compatible graph without user resources."""
    global _READ_GRAPH
    if _READ_GRAPH is None:
        _READ_GRAPH = init_graph(
            tools=[],
            subagents=[],
            model=DEFAULT_CHAT_MODEL,
            context_schema=ContextSchema,
            # Aegra injects these only for execution.  Keeping both unset is
            # what makes schema/state reads cheap and side-effect free.
            checkpointer=None,
            store=None,
            middleware=[],
            backend=None,
        )
    return _READ_GRAPH


async def _close_sandbox(sandbox: Any) -> None:
    """Stop a runtime sandbox, accepting both sync and async SDK methods."""
    if sandbox is None:
        return
    for method_name in ("stop", "close"):
        method = getattr(sandbox, method_name, None)
        if method is None:
            continue
        try:
            result = method()
            if inspect.isawaitable(result):
                await result
        except Exception as exc:  # pragma: no cover - defensive cleanup path
            logger.warning("sandbox_cleanup_failed", method=method_name, error=str(exc))
        break


@asynccontextmanager
async def build_graph(
    config: RunnableConfig,
    runtime: ServerRuntime[ContextSchema],
) -> AsyncIterator[Any]:
    """Build Orchestra's production graph for an Aegra request.

    Aegra invokes this function for schema/state reads as well as execution.
    The guard must remain before all assistant, settings, memory, MCP, and
    sandbox work: those resources are execution-only.
    """
    if not is_for_execution(runtime.access_context):
        yield _read_graph()
        return

    sanitized_config = _sanitized_config(config)
    context = _runtime_context(runtime)
    user_id = _runtime_user_id(runtime)
    store = getattr(runtime, "store", None) or get_store_in_memory()
    sandbox = None

    try:
        params = _make_request(sanitized_config, context)
        service_context = ServiceContext(
            user_id=user_id,
            store=store,
            config=sanitized_config,
        )

        # Resolve the canonical Orchestra assistant namespace once.  Public
        # guests resolve only the published namespace; authenticated users get
        # their own namespace first, matching the legacy behavior.
        params = await service_context.llm_service.assistant(params)
        (
            params.model,
            api_key,
            default_sandbox,
            mcp_sandbox_url,
            mcp_api_key,
            params.reasoning_effort,
        ) = await _resolve_user_settings(
            user_id,
            store,
            params.model,
            params.reasoning_effort,
        )

        memory_files, _memory_sources = await prepare_memory_files(
            user_id,
            service_context.memory_service,
        )
        explicit_files = params.input.files or {}
        memory_sources = select_memory_sources(
            explicit_files=explicit_files,
            memory_files=memory_files,
        )
        selected_memory_files = {path: memory_files[path] for path in (memory_sources or []) if path in memory_files}
        params.input.files = await resolve_context_files(
            user_id=user_id,
            store=store,
            memory_files=selected_memory_files,
            explicit_files=explicit_files,
        )

        tool_runtime = _build_tool_runtime(
            config=sanitized_config,
            request=params,
            user_id=user_id,
            store=store,
        )
        backend, sandbox, _effective_type = resolve_sandbox_backend(
            tool_runtime,
            sandbox_type=default_sandbox,
            mcp_sandbox_url=mcp_sandbox_url,
            mcp_api_key=mcp_api_key,
        )

        # Do not pass a checkpointer.  Aegra injects its own per-run saver after
        # this context manager yields the compiled graph.
        agent = await construct_agent(
            instructions=params.instructions,
            system_prompt=params.system_prompt,
            model=params.model,
            tools=params.tools,
            subagents=params.subagents,
            checkpointer=None,
            backend=backend,
            service_context=service_context,
            api_key=api_key,
            memory=memory_sources,
            reasoning_effort=params.reasoning_effort,
        )
        yield agent.graph
    finally:
        await _close_sandbox(sandbox)


__all__ = [
    "PRODUCTION_GRAPH_ID",
    "build_graph",
    "is_for_execution",
]
