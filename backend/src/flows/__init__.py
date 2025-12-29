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
from deepagents.backends import CompositeBackend, StateBackend, StoreBackend


from src.constants import APP_ENV
from src.contexts.service import ServiceContext
from src.constants.llm import DEFAULT_SYSTEM_PROMPT
from src.schemas.entities.llm import Assistant, LLMInput
from src.services.memory import memory_service
from src.tools.memory import MEMORY_TOOLS
from src.schemas.entities import LLMRequest
from src.utils.logger import logger
from src.utils.format import init_system_prompt
from src.schemas.contexts import ContextSchema
from src.schemas.entities.a2a import A2AServers
from src.utils.middleware import DEFAULT_MIDDLEWARE
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


def graph_builder(
    tools: list[BaseTool] = [],
    subagents: list[SubAgent] = [],
    system_prompt: str = "You are a helpful assistant.",
    model: str = "openai:gpt-5-nano",
    context_schema: Type[ContextSchema] | None = None,
    checkpointer: BaseCheckpointSaver | None = None,
    store: BaseStore | None = None,
    middleware: list[Callable] = None,
    backend: CompositeBackend = None,
    graph_id: Literal["deepagent", "react"] = "deepagent",
) -> CompiledStateGraph:
    from langchain.chat_models import init_chat_model
    llm = init_chat_model(model=model)
    if graph_id in ["react", "create_react_agent", "create_agent"] and not subagents:
        return create_agent(
            model=llm,
            tools=tools,
            system_prompt=system_prompt,
            checkpointer=checkpointer,
            context_schema=context_schema,
            store=store,
        )

    deep_agent = create_deep_agent(
        model=llm,
        tools=tools,
        subagents=subagents,
        system_prompt=system_prompt,
        checkpointer=checkpointer,
        context_schema=context_schema,
        middleware= DEFAULT_MIDDLEWARE + middleware,
        store=store,
        cache=CACHE_LLM,
        backend=backend,
        debug=APP_ENV == "development" or APP_ENV == "test",
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
    result = []
    for subagent in subagents:
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
    metadata = params.metadata.model_dump()
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
):
    try:
        if service_context.config.get("metadata", {}).get("user_id"):
            tools, system_prompt = await init_memories(system_prompt, tools)
        else:
            ## Automatically select for unauthenticated users
            middleware = [
                # dynamic_model_selection
            ]

        if subagents:
            subagents = await init_subagents(subagents, service_context)

        # Asynchronous LLM call
        agent = Orchestra(
            graph_id="deepagent",
            model=model,
            tools=tools,
            subagents=subagents,
            system_prompt=init_system_prompt(
                system_prompt, service_context.config or {}, instructions
            ),
            checkpointer=checkpointer,
            store=service_context.store,
            middleware=middleware,
            context_schema=ContextSchema,
            backend=backend,
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
        model: str = "openai:gpt-5-nano",
        system_prompt: str = "You are a helpful assistant.",
        # config: RunnableConfig = None,
        context_schema: Type[Any] | None = None,
        checkpointer: BaseCheckpointSaver = None,
        store: BaseStore = None,
        middleware: list[Callable] = None,
        graph_id: Literal["react", "deepagent"] = "deepagent",
        backend: CompositeBackend = None,
    ):
        self.tools = tools
        self.model = model
        self.system_prompt = system_prompt
        # self.config = config
        self.context_schema = context_schema
        self.store = store
        self.checkpointer = checkpointer
        self.subagents = subagents
        self.graph = graph_builder(
            tools=self.tools,
            subagents=self.subagents,
            model=self.model,
            system_prompt=self.system_prompt,
            context_schema=self.context_schema,
            checkpointer=self.checkpointer,
            store=self.store,
            graph_id=graph_id,
            middleware=middleware,
            backend=backend,
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
