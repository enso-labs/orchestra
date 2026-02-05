import os
import tempfile

from typing import Callable, Type, Literal, Any, AsyncGenerator, Optional
from uuid import uuid4
from langchain.tools import ToolRuntime
from langchain_core.language_models import BaseChatModel
from langchain_core.tools import BaseTool
from langgraph.checkpoint.base import BaseCheckpointSaver
from langchain.agents import create_agent
from langgraph.store.base import BaseStore
from langchain_core.messages import BaseMessage
from langgraph.graph.state import CompiledStateGraph
from langchain_core.runnables.config import RunnableConfig
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.cache.memory import InMemoryCache
from deepagents import SubAgent, create_deep_agent
from deepagents.backends import CompositeBackend, StateBackend


from src.constants import APP_ENV
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

    formatted_memories = (
        "\n".join(memory_to_xml(memory) for memory in memories)
        if memories
        else "No memories found."
    )

    return (
        "You have the following general memories "
        "(these can include things like todos, notes, "
        "reminders, or other information you wanted to remember):\n\n"
        f"<context>{formatted_memories}</context>"
    )


def init_graph(
    tools: list[BaseTool] = [],
    subagents: list[SubAgent] = [],
    system_prompt: str = None,
    model: str = DEFAULT_CHAT_MODEL,
    context_schema: Type[ContextSchema] | None = None,
    checkpointer: BaseCheckpointSaver | None = None,
    store: BaseStore | None = None,
    middleware: list[Callable] = None,
    backend: CompositeBackend = None,
    api_key: str | None = None,
    skills: list[str] | None = None,
    memory: list[str] | None = None,
    name: str | None = None,
    response_format: Any | None = None,
    interrupt_on: dict[str, Any] | None = None,
) -> CompiledStateGraph:
    from langchain.chat_models import init_chat_model

    if not model:
        model = DEFAULT_CHAT_MODEL

    kwargs: dict[str, Any] = {"model": model}
    if api_key:
        kwargs["api_key"] = api_key
    llm = init_chat_model(**kwargs)

    # Feature flag: write system_prompt to AGENTS.md and load via memory parameter
    use_agents_md = os.getenv("USE_AGENTS_MD_INSTRUCTIONS", "true").lower() == "true"

    effective_system_prompt = system_prompt
    effective_memory = list(memory) if memory else []

    if use_agents_md and system_prompt:
        # Write system prompt content to a temporary AGENTS.md file
        agents_md_dir = tempfile.mkdtemp(prefix="orchestra_agents_md_")
        agents_md_path = os.path.join(agents_md_dir, "AGENTS.md")
        with open(agents_md_path, "w") as f:
            f.write(system_prompt)
        # Prepend AGENTS.md path to memory list
        effective_memory.insert(0, agents_md_path)
        effective_system_prompt = None

    deep_agent = create_deep_agent(
        model=llm,
        tools=tools,
        subagents=subagents,
        system_prompt=effective_system_prompt,
        checkpointer=checkpointer,
        context_schema=context_schema,
        middleware=init_default_middleware(backend=backend) + middleware,
        store=store,
        cache=CACHE_LLM,
        backend=backend,
        debug=APP_ENV == "development" or APP_ENV == "test",
        skills=skills,
        memory=effective_memory or None,
        name=name,
        response_format=response_format,
        interrupt_on=interrupt_on,
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
            items = await service_context.tool_service.tool_repo.search(
                filter={"name": tool}
            )
            if items:
                structured_tool = items[0]
                tool_metadata = {structured_tool.name: structured_tool.metadata}
                service_context.config["metadata"] = {
                    **tool_metadata,
                    **service_context.config["metadata"],
                }
                tools_list.append(structured_tool)
    return tools_list


async def init_subagents(
    subagents: list[Assistant], service_context: ServiceContext
) -> list[SubAgent]:
    use_agents_md = os.getenv("USE_AGENTS_MD_INSTRUCTIONS", "true").lower() == "true"
    result = []
    for subagent in subagents:
        if use_agents_md:
            # Build AGENTS.md content for this subagent
            base_prompt = subagent.system_prompt or DEFAULT_SYSTEM_PROMPT
            agents_md_content = _build_agents_md_content(
                base_prompt, {}, subagent.instructions
            )
            agents_md_dir = tempfile.mkdtemp(prefix="orchestra_subagent_agents_md_")
            agents_md_path = os.path.join(agents_md_dir, "AGENTS.md")
            with open(agents_md_path, "w") as f:
                f.write(agents_md_content)
            subagent_dict = {
                "name": subagent.slug,
                "description": subagent.description,
                "system_prompt": None,
                "memory": [agents_md_path],
                "tools": await init_tools(
                    subagent.tools, subagent.a2a, subagent.mcp, service_context
                ),
            }
        else:
            # Rollback path: use init_system_prompt() as before
            system_prompt = subagent.system_prompt or init_system_prompt(
                DEFAULT_SYSTEM_PROMPT, {}, subagent.instructions
            )
            subagent_dict = {
                "name": subagent.slug,
                "description": subagent.description,
                "system_prompt": system_prompt,
                "tools": await init_tools(
                    subagent.tools, subagent.a2a, subagent.mcp, service_context
                ),
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


def init_backend(runtime: ToolRuntime, *, routes):
    """Factory function that creates a CompositeBackend with custom routes."""
    built_routes = {}
    for prefix, backend_or_factory in routes.items():
        if callable(backend_or_factory):
            built_routes[prefix] = backend_or_factory(runtime)
        else:
            built_routes[prefix] = backend_or_factory
    default_state = StateBackend(runtime)
    return CompositeBackend(default=default_state, routes=built_routes)


def _build_metadata_lines(config: dict) -> list[str]:
    """Extract metadata lines (timezone, language, UTC time) from config.

    This replicates the metadata section that init_system_prompt() appends,
    so the same information is available when using the AGENTS.md path.
    """
    lines: list[str] = []
    metadata = config.get("metadata", {}) if config else {}
    current_utc = metadata.get("current_utc")
    timezone_val = metadata.get("timezone")
    lang = metadata.get("language", "en-US")
    if current_utc:
        try:
            import pytz
            from dateutil.parser import isoparse

            dt_utc = isoparse(current_utc)
            if timezone_val:
                tz = pytz.timezone(timezone_val)
                dt_local = dt_utc.astimezone(tz)
                lines.append(f"LOCAL_TIME: {dt_local.isoformat()}")
                lines.append(f"CURRENT_UTC: {dt_utc.isoformat()}")
            else:
                lines.append(f"CURRENT_UTC: {dt_utc.isoformat()}")
        except Exception:
            lines.append(f"CURRENT_UTC: {current_utc}")
    elif timezone_val:
        from datetime import datetime, timezone as tz_mod

        now_iso = datetime.now(tz_mod.utc).isoformat()
        lines.append(f"CURRENT_UTC: {now_iso}")
    if timezone_val:
        lines.append(f"TIMEZONE: {timezone_val}")
    if lang:
        lines.append(f"LANGUAGE: {lang}")
    return lines


def _build_agents_md_content(
    system_prompt: str, config: dict, instructions: str = None
) -> str:
    """Build AGENTS.md content from system_prompt, instructions, and config metadata."""
    lines = [system_prompt]
    if instructions:
        lines.append("---")
        lines.append(f"INSTRUCTIONS:\n{instructions}")
    lines.append("---")
    lines.extend(_build_metadata_lines(config))
    return "\n".join(lines) + "\n"


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
    skills: list[str] | None = None,
    memory: list[str] | None = None,
    agent_name: str | None = None,
    response_format: Any | None = None,
    interrupt_on: dict[str, Any] | None = None,
):
    try:
        use_agents_md = (
            os.getenv("USE_AGENTS_MD_INSTRUCTIONS", "true").lower() == "true"
        )

        if subagents:
            subagents = await init_subagents(subagents, service_context)

        if use_agents_md:
            # Build AGENTS.md content with system_prompt + instructions + metadata
            effective_system_prompt = None
            effective_memory = list(memory) if memory else []
            agents_md_content = _build_agents_md_content(
                system_prompt, service_context.config or {}, instructions
            )
            agents_md_dir = tempfile.mkdtemp(prefix="orchestra_agents_md_")
            agents_md_path = os.path.join(agents_md_dir, "AGENTS.md")
            with open(agents_md_path, "w") as f:
                f.write(agents_md_content)
            effective_memory.insert(0, agents_md_path)
        else:
            # Rollback path: use init_system_prompt() as before
            effective_system_prompt = init_system_prompt(
                system_prompt, service_context.config or {}, instructions
            )
            effective_memory = memory

        # Asynchronous LLM call
        agent = Orchestra(
            graph_id="deepagent",
            model=model,
            tools=tools,
            subagents=subagents,
            system_prompt=effective_system_prompt,
            checkpointer=checkpointer,
            store=service_context.store,
            middleware=middleware,
            context_schema=ContextSchema,
            backend=backend,
            api_key=api_key,
            skills=skills,
            memory=effective_memory or None,
            name=agent_name,
            response_format=response_format,
            interrupt_on=interrupt_on,
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
        skills: list[str] | None = None,
        memory: list[str] | None = None,
        name: str | None = None,
        response_format: Any | None = None,
        interrupt_on: dict[str, Any] | None = None,
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
            skills=skills,
            memory=memory,
            name=name,
            response_format=response_format,
            interrupt_on=interrupt_on,
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
        return self.graph.astream(
            messages, config=config, stream_mode=stream_mode, context=context
        )
