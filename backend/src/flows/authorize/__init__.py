from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode
from langchain_core.tools import StructuredTool

from .utils.nodes import call_agent, should_continue, authorize


# Creates the graph to build
def authorize_builder(tools: list[StructuredTool]):
    # Build the workflow graph using StateGraph
    workflow = StateGraph(MessagesState)

    # Add nodes (steps) to the graph
    workflow.add_node("agent", call_agent)
    workflow.add_node("tools", ToolNode(tools))
    workflow.add_node("authorization", authorize)

    # Define the edges and control flow between nodes
    workflow.add_edge(START, "agent")
    workflow.add_conditional_edges(
        "agent", should_continue, ["authorization", "tools", END]
    )
    workflow.add_edge("authorization", "tools")
    workflow.add_edge("tools", "agent")
    return workflow
