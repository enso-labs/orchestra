from typing import Callable, Literal, Any
from langchain_core.tools import BaseTool
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.prebuilt import create_react_agent

# from langgraph.store.base import BaseStore
from langgraph.graph.state import CompiledStateGraph
from deepagents import create_deep_agent, SubAgent
from src.services.memory import memory_service


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
    graph_id: Literal["react", "deepagent"] = "react",
    tools: list[BaseTool] = [],
    subagents: list[SubAgent] = [],
    prompt: str = "You are a helpful assistant.",
    model: str = "openai:gpt-5-nano",
    checkpointer: BaseCheckpointSaver | None = None,
    # store: BaseStore | None = None,
) -> CompiledStateGraph:
    if graph_id == "react":
        return create_react_agent(
            model=model,
            tools=tools,
            prompt=prompt,
            checkpointer=checkpointer,
            # store=store,
        )

    if graph_id == "deepagent":
        return create_deep_agent(
            model=model,
            tools=tools,
            instructions=prompt,
            checkpointer=checkpointer,
            subagents=subagents,
            # store=store,
        )

    raise ValueError(f"Invalid graph name: {graph_id}")
