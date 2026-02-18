from typing import Callable, Type, Literal, Any, AsyncGenerator, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from src.services.memory import MemoryService

from uuid import uuid4
from langchain.tools import ToolRuntime
from langchain_core.language_models import BaseChatModel
from langchain_core.tools import BaseTool
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.store.base import BaseStore
from langchain_core.messages import BaseMessage
from langgraph.graph.state import CompiledStateGraph
from langchain_core.runnables.config import RunnableConfig
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.cache.memory import InMemoryCache
from deepagents import SubAgent, create_deep_agent
from deepagents.backends import CompositeBackend, FilesystemBackend, StateBackend
from deepagents.backends.utils import create_file_data


# Conditional import for Daytona sandbox support
try:
    from daytona import Daytona, DaytonaConfig
    from langchain_daytona import DaytonaSandbox
except ImportError:
    Daytona = None  # type: ignore[assignment,misc]
    DaytonaConfig = None  # type: ignore[assignment,misc]
    DaytonaSandbox = None  # type: ignore[assignment,misc]

from src.constants import APP_ENV, BACKEND_TYPE, DAYTONA_API_KEY, WORKSPACE_ROOT
from src.contexts.service import ServiceContext
from src.constants.llm import DEFAULT_CHAT_MODEL, DEFAULT_SYSTEM_PROMPT
from src.schemas.entities.llm import Assistant, LLMInput
from src.services.memory import memory_service
from src.tools.memory import MEMORY_TOOLS
from src.schemas.entities import LLMRequest
from src.utils.logger import logger
from src.utils.format import init_system_prompt
from src.schemas.contexts import ContextSchema
from src.schemas.entities.a2a import A2AServers
from src.utils.middleware import init_default_middleware
from src.tools import default_tools


CACHE_LLM = InMemoryCache()


async def add_memories_to_system():
    memories = await memory_service.search()

    def memory_to_xml(memory):
        items = []
        for key, value in memory.dict().items():
            items.append(f"<{key}>{value}</{key}>")
        return f"<memory>{''.join(items)}</memory>"

    formatted_memories = "\n".join(memory_to_xml(memory) for memory in memories) if memories else "No memories found."

    return (
        "You have the following general memories "
        "(these can include things like todos, notes, "
        "reminders, or other information you wanted to remember):\n\n"
        f"<context>{formatted_memories}</context>"
    )


async def prepare_memory_files(
    user_id: str | None,
    memory_svc: "MemoryService",
) -> tuple[dict, list[str] | None]:
    """Fetch user memories and format them as a StateBackend file.

    Returns a (files_map, memory_sources) tuple suitable for passing to
    create_deep_agent via the ``memory`` kwarg.  When no memories are
    available the tuple is ``({}, None)`` so callers can safely unpack
    without extra guards.
    """
    if not user_id:
        return {}, None

    try:
        memories = await memory_svc.search()
    except Exception as exc:
        logger.warning(f"Failed to fetch memories for user {user_id}: {exc}")
        return {}, None

    if not memories:
        return {}, None

    files_map = {}
    sources = []
    for mem in memories:
        data = mem.dict()
        value = data.get("value", {})
        if isinstance(value, dict):
            # Skip disabled memories
            if not value.get("enabled", True):
                continue
            mem_id = value.get("id", "AGENTS.md")
            content = value.get("content", str(value))
        else:
            mem_id = "AGENTS.md"
            content = str(value)
        path = f"/{mem_id}" if not mem_id.startswith("/") else mem_id
        files_map[path] = create_file_data(content)
        sources.append(path)

    return files_map, sources if sources else None


def init_graph(
    tools: list[BaseTool] = [],
    subagents: list[SubAgent] = [],
    system_prompt: str = None,
    model: str | None = None,
    context_schema: Type[ContextSchema] | None = None,
    checkpointer: BaseCheckpointSaver | None = None,
    store: BaseStore | None = None,
    middleware: list[Callable] = None,
    backend: CompositeBackend = None,
    api_key: str | None = None,
    memory: list[str] | None = None,
) -> CompiledStateGraph:
    from langchain.chat_models import init_chat_model

    if not model:
        model = DEFAULT_CHAT_MODEL

    kwargs: dict[str, Any] = {"model": model}
    if api_key:
        kwargs["api_key"] = api_key
    llm = init_chat_model(**kwargs)

    deep_agent = create_deep_agent(
        model=llm,
        tools=tools,
        subagents=subagents,
        system_prompt=system_prompt,
        checkpointer=checkpointer,
        context_schema=context_schema,
        middleware=init_default_middleware(backend=backend) + middleware,
        store=store,
        cache=CACHE_LLM,
        backend=backend,
        debug=APP_ENV == "development" or APP_ENV == "test",
        memory=memory,
    )
    return deep_agent


async def init_tools(
    tools: list[BaseTool],
    a2a: A2AServers,
    mcp: dict = None,
    service_context: ServiceContext = None,
) -> list[BaseTool]:
    """Initialize tools for a subagent."""
    tool_map = {t.name: t for t in default_tools()}
    tools_list = [tool_map[name] for name in (tools or []) if name in tool_map]
    a2a = A2AServers(a2a=a2a)
    thread_id = service_context.config.get("configurable").get("thread_id")
    user_id = service_context.config.get("configurable").get("user_id")
    if a2a.validate() and thread_id:
        tools_list = tools_list + a2a.fetch_agent_cards_as_tools(thread_id)
    if mcp:
        mcp_client = MultiServerMCPClient(mcp)
        tools_list = tools_list + await mcp_client.get_tools()
    if user_id:
        for tool in tools:
            items = await service_context.tool_service.tool_repo.search(filter={"name": tool})
            if items:
                structured_tool = items[0]
                tool_metadata = {structured_tool.name: structured_tool.metadata}
                service_context.config["metadata"] = {
                    **tool_metadata,
                    **service_context.config["metadata"],
                }
                tools_list.append(structured_tool)
    return tools_list


async def init_subagents(subagents: list[Assistant], service_context: ServiceContext) -> list[SubAgent]:
    result = []
    for subagent in subagents:
        system_prompt = subagent.system_prompt or init_system_prompt(DEFAULT_SYSTEM_PROMPT, {}, subagent.instructions)
        subagent_dict = {
            "name": subagent.slug,
            "description": subagent.description,
            "system_prompt": system_prompt,
            "tools": await init_tools(subagent.tools, subagent.a2a, subagent.mcp, service_context),
        }

        if getattr(subagent, "model", None) is not None:
            subagent_dict["model"] = subagent.model
        result.append(subagent_dict)
    return result


async def init_memories(system_prompt: str, tools: list[BaseTool]):
    memory_prompt = await add_memories_to_system()
    prompt = system_prompt + "\n" + memory_prompt if memory_prompt else system_prompt
    return tools + MEMORY_TOOLS, prompt


def init_config(
    params: LLMRequest,
    user_id: str | None = None,
    max_concurrency: int = 4,
    recursion_limit: int = 500,
) -> RunnableConfig:
    # Handle both Pydantic models and plain dicts
    metadata = (
        params.metadata.model_dump()
        if hasattr(params.metadata, "model_dump")
        else dict(params.metadata)
        if params.metadata
        else {}
    )
    if user_id:
        metadata["user_id"] = user_id
    if not metadata.get("thread_id"):
        metadata["thread_id"] = str(uuid4())
    return RunnableConfig(
        configurable={
            "user_id": user_id,
            "thread_id": metadata.get("thread_id"),
            "assistant_id": metadata.get("assistant_id", None),
            "project_id": metadata.get("project_id", None),
            "files": params.input.files or {},
        },
        max_concurrency=max_concurrency,
        recursion_limit=recursion_limit,
        metadata=metadata,
    )


def create_daytona_backend():
    """Create a Daytona sandbox and return (sandbox, backend).

    Returns ``(None, None)`` when the package is not installed, the API key is
    missing, or sandbox creation fails for any reason.
    """
    if DaytonaSandbox is None or Daytona is None:
        return None, None

    key = DAYTONA_API_KEY
    if not key:
        return None, None

    try:
        client = Daytona(DaytonaConfig(api_key=key))  # type: ignore[misc]
        sandbox = client.create()
        backend = DaytonaSandbox(sandbox=sandbox)
        return sandbox, backend
    except Exception as exc:
        logger.error(f"Failed to create Daytona sandbox: {exc}")
        return None, None


def _create_daytona_backend_checked(
    runtime: ToolRuntime,
) -> tuple[CompositeBackend, Any] | None:
    """Try to create a Daytona-backed CompositeBackend.

    Returns ``(backend, sandbox)`` on success, or ``None`` if Daytona is
    unavailable or not capable.  Cleans up the sandbox on failure.
    """
    from src.agents.daytona import validate_daytona_execute_capability

    sandbox, daytona_backend = create_daytona_backend()
    if daytona_backend is not None:
        supported, _reason = validate_daytona_execute_capability(daytona_backend)
        if supported:
            backend = CompositeBackend(default=daytona_backend, routes={})
            return backend, sandbox

        # Daytona not capable — clean up sandbox silently
        if sandbox is not None:
            try:
                sandbox.stop()
            except Exception:
                pass

    return None


def _create_state_backend(
    runtime: ToolRuntime,
) -> tuple[CompositeBackend, None]:
    """Create a plain StateBackend-backed CompositeBackend."""
    default_state = StateBackend(runtime)
    backend = CompositeBackend(default=default_state, routes={})
    return backend, None


def _create_filesystem_backend(
    runtime: ToolRuntime,
) -> tuple[CompositeBackend, None]:
    """Create a FilesystemBackend-backed CompositeBackend using WORKSPACE_ROOT."""
    from pathlib import Path

    workspace = Path(WORKSPACE_ROOT)
    workspace.mkdir(parents=True, exist_ok=True)
    fs_backend = FilesystemBackend(root_dir=workspace)
    backend = CompositeBackend(default=fs_backend, routes={})
    return backend, None


_SANDBOX_FACTORIES: dict[str, Callable] = {
    "daytona": _create_daytona_backend_checked,
    "state": _create_state_backend,
    "filesystem": _create_filesystem_backend,
}


def resolve_sandbox_backend(
    runtime: ToolRuntime,
    sandbox_type: str | None = None,
) -> tuple[CompositeBackend, Any]:
    """Resolve a sandbox backend based on *sandbox_type* and BACKEND_TYPE env var.

    Dispatch rules:
    * ``"filesystem"`` — use FilesystemBackend with WORKSPACE_ROOT.
    * ``"state"`` — use StateBackend directly (never attempts Daytona).
    * ``"daytona"`` — try Daytona, fall back to State if unavailable.
    * ``None`` / ``"auto"`` — try Daytona first, fall back to State.
    * Any unknown value — treated as ``"auto"``.

    The *sandbox_type* parameter takes precedence. When not provided (or
    ``None``), the ``BACKEND_TYPE`` env var is consulted.

    Returns ``(backend, daytona_sandbox_or_None)``.
    """
    effective = sandbox_type or BACKEND_TYPE
    if effective not in _SANDBOX_FACTORIES:
        effective = None

    if effective == "state":
        return _create_state_backend(runtime)

    if effective == "filesystem":
        return _create_filesystem_backend(runtime)

    # "daytona" or auto (None) — try Daytona first
    result = _create_daytona_backend_checked(runtime)
    if result is not None:
        return result

    # Fallback: plain StateBackend (silent, no messages)
    return _create_state_backend(runtime)


################################################################################
### Construct Agent
################################################################################
async def construct_agent(
    instructions: str,
    system_prompt: str,
    model: BaseChatModel,
    tools: list[BaseTool],
    subagents: list[SubAgent] = [],
    middleware: list[Callable] = [],
    backend: CompositeBackend = None,
    checkpointer: BaseCheckpointSaver = None,
    service_context: ServiceContext = None,
    api_key: str | None = None,
    memory: list[str] | None = None,
):
    """Build and return an Orchestra agent instance.

    Args:
        memory: Optional list of file paths (e.g. ``["/AGENTS.md"]``) that
            reference files in the StateBackend. When provided, MemoryMiddleware
            is added to the agent's middleware stack so the agent can access
            user memories during execution.
    """
    try:
        if subagents:
            subagents = await init_subagents(subagents, service_context)

        # Asynchronous LLM call
        agent = Orchestra(
            graph_id="deepagent",
            model=model,
            tools=tools,
            subagents=subagents,
            system_prompt=init_system_prompt(system_prompt, service_context.config or {}, instructions),
            checkpointer=checkpointer,
            store=service_context.store,
            middleware=middleware,
            context_schema=ContextSchema,
            backend=backend,
            api_key=api_key,
            memory=memory,
        )
        return agent
    except Exception as e:
        logger.error(f"Error constructing agent: {e}")
        raise e


class Orchestra:
    def __init__(
        self,
        tools: list[BaseTool],
        subagents: Optional[list[SubAgent]] = None,
        model: str = DEFAULT_CHAT_MODEL,
        system_prompt: str | None = None,
        context_schema: Type[Any] | None = None,
        checkpointer: BaseCheckpointSaver = None,
        store: BaseStore = None,
        middleware: list[Callable] = None,
        graph_id: Literal["react", "deepagent"] = "deepagent",
        backend: CompositeBackend = None,
        api_key: str | None = None,
        memory: list[str] | None = None,
    ):
        self.tools = tools
        self.model = model
        self.system_prompt = system_prompt
        self.context_schema = context_schema
        self.store = store
        self.checkpointer = checkpointer
        self.subagents = subagents
        self.graph = init_graph(
            tools=self.tools,
            subagents=self.subagents,
            model=self.model,
            system_prompt=self.system_prompt,
            context_schema=self.context_schema,
            checkpointer=self.checkpointer,
            store=self.store,
            middleware=middleware,
            backend=backend,
            api_key=api_key,
            memory=memory,
        )

    async def invoke(
        self,
        input: LLMInput,
        config: RunnableConfig = None,
        context: dict[str, Any] = None,
    ) -> BaseMessage:
        input.to_langchain_messages()
        return await self.graph.ainvoke(
            input,
            config=config,
            context=context,
        )

    def astream(
        self,
        messages: list[BaseMessage],
        stream_mode: str = "messages",
        config: RunnableConfig = None,
        context: dict[str, Any] = None,
    ) -> AsyncGenerator[BaseMessage, None]:
        return self.graph.astream(messages, config=config, stream_mode=stream_mode, context=context)
