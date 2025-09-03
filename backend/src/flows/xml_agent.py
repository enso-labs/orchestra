import json
import random
import asyncio
from typing import Annotated, TypedDict
from langchain_core.tools import tool
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_core.runnables.config import RunnableConfig
from langgraph.types import interrupt
from langgraph.graph import StateGraph, START
from langchain_core.tools import BaseTool, StructuredTool
from langchain.chat_models import init_chat_model
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from langchain_core.messages import (
	BaseMessage,
	HumanMessage,
	ToolMessage,
	AIMessage,
	SystemMessage
)
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.store.base import BaseStore

###########################################
## Parser
###########################################
def input_parser(
	messages: list[BaseMessage],
	llm_response_prefix: str = "\n\n ai_response:"
) -> str:
	xml_lines = ["<thread>"]
	for message in messages:
		if isinstance(message, HumanMessage):
			xml_lines.append(
				f'  <event id="{message.id}" type="{message.type}">{message.content}</event>'
			)
		elif isinstance(message, ToolMessage):
			xml_lines.append(
				f'  <event id="{message.tool_call_id}" type="tool_output" name="{message.name}" status="{message.status}">{message.content}</event>'
			)
		elif isinstance(message, AIMessage):
			if getattr(message, "tool_calls", None):
				for tool_call in message.tool_calls:
					xml_lines.append(
						f'  <event id="{tool_call["id"]}" type="tool_input" name="{tool_call["name"]}">{json.dumps(tool_call["args"])}</event>'
					)
			else:
				xml_lines.append(
					f'  <event id="{message.id}" type="{message.type}">{message.content}</event>'
				)
	xml_lines.append("</thread>")
	return "\n".join(xml_lines) + llm_response_prefix

###########################################
## Tools
###########################################
@tool(description="Get the weather in a given city")
def get_weather(location: str) -> str:
	return f"The weather in {location} is sunny and 80 degrees"

@tool(description="Get the stock price of a given symbol")
def get_stock_price(symbol: str) -> str:
	return f"The stock price of {symbol} is {random.randint(100, 1000)}"

@tool(description="Request assistance from a human")
def human_assistance(query: str) -> str:
	human_response = interrupt({"query": query})
	return human_response["data"]

TOOLS = [get_weather, get_stock_price, human_assistance]

###########################################
## Graph
###########################################
def create_enso_graph(
    tools: list[StructuredTool], 
    mcp: dict = {},
    store: BaseStore = None, # type: ignore
    checkpointer: BaseCheckpointSaver = None # type: ignore
):
	mcp_client = MultiServerMCPClient(mcp)
	mcp_tools = asyncio.run(mcp_client.get_tools())
	combined_tools = tools + mcp_tools
	
	class AgentState(TypedDict):
		messages: Annotated[list[BaseMessage], add_messages]

	workflow = StateGraph(AgentState)
	async def agent(state: AgentState, config: RunnableConfig):
		prompt_str = input_parser(state["messages"])
		model = init_chat_model(
			model=config.get("configurable", {}).get("model", "openai:gpt-5-nano"),
			temperature=config.get("configurable", {}).get("temperature", 0.7),
			timeout=config.get("configurable", {}).get("timeout", 30),
		).bind_tools(combined_tools)
		response = await model.ainvoke([
			SystemMessage(content=config.get("configurable", {}).get("system", "You are a helpful assistant.")),
			HumanMessage(content=prompt_str)
		])
		return {"messages": [response]}

	workflow.add_node("agent", agent)
	workflow.add_node("tools", ToolNode(tools=combined_tools))
	workflow.add_conditional_edges("agent", tools_condition)
	workflow.add_edge("tools", "agent")
	workflow.add_edge(START, "agent")
	workflow.compile(name="xml_agent", debug=True, checkpointer=checkpointer, store=store)
	return workflow

# graph = create_enso_graph(TOOLS, mcp={
# 	"web_scrape": {
# 		"url": "http://localhost:8050/mcp",
# 		"transport": "streamable_http",
# 	}
# })