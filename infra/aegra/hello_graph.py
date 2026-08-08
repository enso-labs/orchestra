"""Minimal graph for the US-003 Aegra sidecar smoke test.

Deliberately trivial. Stage 1 proves the server boots, migrates, and reads the
existing store -- it does NOT prove Orchestra's agent works under Aegra. That is
US-008's factory graph, and conflating the two would let a green sidecar imply
far more than it shows.
"""

from typing import Annotated, TypedDict

from langgraph.graph import START, StateGraph
from langgraph.graph.message import add_messages


class State(TypedDict):
    messages: Annotated[list, add_messages]


def echo(state: State) -> State:
    """Echo the last message back, so a run produces observable output."""
    last = state["messages"][-1] if state["messages"] else None
    content = getattr(last, "content", "") if last else ""
    return {"messages": [{"role": "assistant", "content": f"sidecar ok: {content}"}]}


builder = StateGraph(State)
builder.add_node("echo", echo)
builder.add_edge(START, "echo")

graph = builder.compile()
