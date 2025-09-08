from typing import Type, Literal, Any, AsyncGenerator
from dataclasses import dataclass

from langchain_core.tools import BaseTool
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.prebuilt import create_react_agent
from langgraph.runtime import get_runtime
from langgraph.store.base import BaseStore
from langchain_core.messages import BaseMessage, AIMessage
from langgraph.graph.state import CompiledStateGraph
from langchain_core.runnables.config import RunnableConfig
from deepagents import create_deep_agent, SubAgent


from src.services.memory import memory_service
from src.services.memory import in_memory_store
from src.services.checkpoint import in_memory_checkpointer
from src.tools.memory import MEMORY_TOOLS
from src.schemas.entities import LLMRequest, LLMStreamRequest
from src.utils.logger import logger
from src.services.checkpoint import checkpoint_service
from src.services.thread import thread_service
from src.utils.format import get_time
from src.tools import TOOL_LIBRARY
from src.schemas.contexts import ContextSchema


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


# TODO: Not sure we need store based on construction of memory_service.
# TODO: Need to investigate if we need to use store or not.
def graph_builder(
    tools: list[BaseTool] = [],
    subagents: list[SubAgent] = [],
    prompt: str = "You are a helpful assistant.",
    model: str = "openai:gpt-5-nano",
    context_schema: Type[Any] | None = None,
    checkpointer: BaseCheckpointSaver | None = None,
    store: BaseStore | None = None,
    graph_id: Literal["react", "deepagent"] = "react",
) -> CompiledStateGraph:
    if graph_id == "react":
        return create_react_agent(
            model=model,
            tools=tools,
            prompt=prompt,
            checkpointer=checkpointer,
            context_schema=context_schema,
            # store=store,
        )

    if graph_id == "deepagent":
        return create_deep_agent(
            model=model,
            tools=tools,
            subagents=subagents,
            instructions=prompt,
            checkpointer=checkpointer,
            context_schema=context_schema,
            # store=store,
        )


################################################################################
### Construct Agent
################################################################################
async def construct_agent(params: LLMRequest | LLMStreamRequest):
    # Add config if it exists
    config = (
        RunnableConfig(
            configurable=params.metadata.model_dump(), metadata={"model": params.model}
        )
        if params.metadata
        else None
    )

    tools = TOOL_LIBRARY
    prompt = params.system
    if config:
        ## Construct the prompt
        memory_prompt = await add_memories_to_system()
        prompt = (
            params.system + "\n" + memory_prompt if memory_prompt else params.system
        )
        tools = tools + MEMORY_TOOLS

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
        context_schema=ContextSchema,
        prompt=prompt,
        checkpointer=in_memory_checkpointer if config else None,
        store=in_memory_store if config else None,
    )
    return agent


class Orchestra:
    def __init__(
        self,
        tools: list[BaseTool],
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
        self.graph = graph_builder(
            tools=self.tools,
            model=self.model,
            prompt=self.prompt,
            context_schema=self.context_schema,
            checkpointer=self.checkpointer,
            store=self.store,
        )

    def invoke(self, messages: list[BaseMessage]):
        return self.graph.invoke(messages, self.config)

    def stream(self, messages: list[BaseMessage]):
        return self.graph.stream(messages, self.config)

    def ainvoke(self, messages: list[BaseMessage]):
        return self.graph.ainvoke(messages, self.config)

    def astream(
        self,
        messages: list[BaseMessage],
        stream_mode: str = "messages",
        context: dict[str, Any] = None,
    ) -> AsyncGenerator[BaseMessage, None]:
        return self.graph.astream(
            messages, self.config, stream_mode=stream_mode, context=context
        )

    def aget_state(self, config: RunnableConfig = None):
        if config is None:
            config = self.config
        return self.graph.aget_state(config)

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
                    self.config, {"messages": messages}
                )

                # Extract thread and checkpoint IDs from config
                configurable = new_config.get("configurable")
                thread_id = configurable.get("thread_id")
                checkpoint_id = configurable.get("checkpoint_id")

                # Update thread with new message and timestamp
                await thread_service.update(
                    thread_id,
                    {
                        "thread_id": thread_id,
                        "checkpoint_id": checkpoint_id,
                        "messages": [last_message],
                        "updated_at": get_time(),
                    },
                )

                # Log the update for debugging
                logger.info(f"final_state Updated: {str(new_config)}")
                return new_config
        # Return None if no checkpointer or update not performed
        return None
