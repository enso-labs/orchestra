from typing import Type, Literal, Any, AsyncGenerator, Optional
from uuid import uuid4
from langchain_core.tools import BaseTool
from langgraph.checkpoint.base import BaseCheckpointSaver
from langchain.agents import create_agent
from langgraph.store.base import BaseStore
from langchain_core.messages import BaseMessage, AIMessage
from langgraph.graph.state import CompiledStateGraph
from langchain_core.runnables.config import RunnableConfig
from langchain_mcp_adapters.client import MultiServerMCPClient
from deepagents import async_create_deep_agent, SubAgent


from src.services.memory import memory_service
from src.tools.memory import MEMORY_TOOLS
from src.schemas.entities import LLMRequest, LLMStreamRequest
from src.utils.logger import logger
from src.services.checkpoint import checkpoint_service
from src.services.thread import thread_service
from src.utils.format import get_time
from src.tools import default_tools
from src.schemas.contexts import ContextSchema
from src.schemas.entities.a2a import A2AServers


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
    prompt: str = "You are a helpful assistant.",
    model: str = "openai:gpt-5-nano",
    context_schema: Type[Any] | None = None,
    checkpointer: BaseCheckpointSaver | None = None,
    store: BaseStore | None = None,
    graph_id: Literal[
        "react", "deepagents", "deepagent", "create_react_agent", "create_deep_agent"
    ] = "react",
) -> CompiledStateGraph:
    if graph_id in ["react", "create_react_agent", "create_agent"] and not subagents:
        return create_agent(
            model=model,
            tools=tools,
            prompt=prompt,
            checkpointer=checkpointer,
            context_schema=context_schema,
            store=store,
        )

    deep_agent = async_create_deep_agent(
        model=model,
        tools=tools,
        subagents=subagents,
        instructions=prompt,
        checkpointer=checkpointer,
    )
    deep_agent.context_schema = context_schema
    deep_agent.store = store
    return deep_agent


# async def init_tools(params: LLMRequest | LLMStreamRequest):
#     tools = default_tools(params.tools)
#     a2a = A2AServers(a2a=params.a2a)
#     if a2a.validate():
#         tools = tools + a2a.fetch_agent_cards_as_tools(params.metadata.thread_id)
#     if params.mcp:
#         mcp_client = MultiServerMCPClient(params.mcp)
#         tools = tools + await mcp_client.get_tools()
#     return tools


async def init_tools(
    tools: list[BaseTool],
    a2a: A2AServers,
    mcp: dict = None,
    thread_id: str = None,
) -> list[BaseTool]:
    """Initialize tools for a subagent."""
    tools = default_tools(tools)
    a2a = A2AServers(a2a=a2a)
    if a2a.validate() and thread_id:
        tools = tools + a2a.fetch_agent_cards_as_tools(thread_id)
    if mcp:
        mcp_client = MultiServerMCPClient(mcp)
        tools = tools + await mcp_client.get_tools()
    return tools


async def init_subagents(params: LLMRequest | LLMStreamRequest) -> list[SubAgent]:
    result = []
    for subagent in params.subagents:
        subagent_dict = {
            "name": subagent.slug,
            "description": subagent.description,
            "prompt": subagent.prompt,
            "tools": await init_tools(
                subagent.tools, subagent.a2a, subagent.mcp, params.metadata.thread_id
            ),
        }

        # if getattr(subagent, "model", None) is not None:
        #     subagent_dict["model"] = subagent.model
        result.append(subagent_dict)
    return result


async def init_memories(params: LLMRequest | LLMStreamRequest, tools: list[BaseTool]):
    memory_prompt = await add_memories_to_system()
    prompt = params.system + "\n" + memory_prompt if memory_prompt else params.system
    return tools + MEMORY_TOOLS, prompt


def init_config(params: LLMRequest | LLMStreamRequest):
    if params.metadata:
        return RunnableConfig(
            configurable=params.metadata.model_dump(),
            max_concurrency=10,
            recursion_limit=100,
        )
    else:
        return None


################################################################################
### Construct Agent
################################################################################
async def construct_agent(
    params: LLMRequest | LLMStreamRequest,
    checkpointer: BaseCheckpointSaver = None,
    store: BaseStore = None,
):
    try:
        params.metadata.thread_id = params.metadata.thread_id or str(uuid4())
        # Add config if it exists
        config = init_config(params)
        # Initialize tools
        tools = await init_tools(
            tools=params.tools,
            a2a=params.a2a,
            mcp=params.mcp,
            thread_id=params.metadata.thread_id,
        )
        prompt = params.system
        if config:
            tools, prompt = await init_memories(params, tools)

        if params.subagents:
            sub_agents = await init_subagents(params)
            params.subagents = sub_agents

        # Asynchronous LLM call
        agent = Orchestra(
            graph_id=(
                params.metadata.graph_id
                if params.metadata and params.metadata.graph_id
                else "react"
            ),
            config=config,
            model=params.model,
            tools=tools,
            subagents=params.subagents,
            context_schema=ContextSchema,
            prompt=prompt,
            checkpointer=checkpointer,
            store=store,
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
        prompt: str = "You are a helpful assistant.",
        config: RunnableConfig = None,
        context_schema: Type[Any] | None = None,
        checkpointer: BaseCheckpointSaver = None,
        store: BaseStore = None,
        graph_id: Literal["react", "deepagent"] = "react",
    ):
        self.tools = tools
        self.model = model
        self.prompt = prompt
        self.config = config
        self.context_schema = context_schema
        self.store = store
        self.checkpointer = checkpointer
        self.subagents = subagents
        self.graph = graph_builder(
            tools=self.tools,
            subagents=self.subagents,
            model=self.model,
            prompt=self.prompt,
            context_schema=self.context_schema,
            checkpointer=self.checkpointer,
            store=self.store,
            graph_id=graph_id,
        )

    def astream(
        self,
        messages: list[BaseMessage],
        stream_mode: str = "messages",
        context: dict[str, Any] = None,
    ) -> AsyncGenerator[BaseMessage, None]:
        return self.graph.astream(
            messages, self.config, stream_mode=stream_mode, context=context
        )

    async def aget_state(self, config: RunnableConfig = None):
        if config is None:
            config = self.config
        state = await self.graph.aget_state(config)
        return state

    async def add_model_to_ai_message(self, model: str) -> RunnableConfig | None:
        # Only proceed if a checkpointer is set
        if self.checkpointer:
            # Get the latest state from the graph
            final_state = await self.aget_state()
            messages = final_state.values.get("messages")
            last_message = messages[-1] if messages else None

            # Update the model attribute if the last message is an AIMessage
            if isinstance(last_message, AIMessage):
                messages[-1].model = model  # Set model on last AI message

                # Update checkpoint state with modified messages
                new_config = await checkpoint_service.update_checkpoint_state(
                    final_state.config, {"messages": messages}
                )

                # Extract thread and checkpoint IDs from config
                configurable = new_config.get("configurable")
                thread_id = configurable.get("thread_id")
                checkpoint_id = configurable.get("checkpoint_id")
                assistant_id = final_state.metadata.get("assistant_id")
                user_id = final_state.metadata.get("user_id")

                # Update thread with new message and timestamp
                thread_service.user_id = user_id
                await thread_service.update(
                    thread_id=thread_id,
                    data={
                        "thread_id": thread_id,
                        "checkpoint_id": checkpoint_id,
                        "messages": [last_message.model_dump()],
                        "updated_at": get_time(),
                    },
                    assistant_id=assistant_id,
                )

                # Log the update for debugging
                logger.info(f"final_state Updated: {str(new_config)}")
                return new_config
        # Return None if no checkpointer or update not performed
        return None
