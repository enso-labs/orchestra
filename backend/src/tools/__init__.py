from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.prebuilt import ToolNode
from langchain_core.tools import StructuredTool
from typing import Any

from src.services.mcp import McpService
from src.schemas.entities import ArcadeConfig
from src.schemas.entities.a2a import A2AServer
from src.tools.retrieval import retrieval_query
from src.tools.shell import shell_exec
from src.tools.search import search_engine
from src.tools.a2a import init_a2a_tools
from src.tools.arcade import init_arcade_tools
from src.tools.api import generate_tools_from_openapi_json

TOOL_LIBRARY = [
    shell_exec,
    retrieval_query,
    search_engine,
]
TOOL_NODE = ToolNode(TOOL_LIBRARY)


###################################### UTILS ######################################
def dynamic_tools(selected_tools: list[str] | str, metadata: dict = None):
    # Convert string to list if single string provided
    if isinstance(selected_tools, str):
        selected_tools = [selected_tools]

    if metadata and metadata.get("collection"):
        selected_tools.append("retrieval_query")

    # Filter tools by name
    filtered_tools = [tool for tool in TOOL_LIBRARY if tool.name in selected_tools]

    if len(filtered_tools) == 0:
        raise ValueError(f"No tools found by the names: {', '.join(selected_tools)}")

    # Update metadata for each tool
    for tool in filtered_tools:
        tool.metadata = metadata

    return filtered_tools


async def mcp_client(config: dict):
    async with MultiServerMCPClient(config) as client:
        return client.get_tools()


async def get_mcp_tools(config: dict):
    async with MultiServerMCPClient(config) as client:
        return client.get_tools()


def attach_tool_details(tool):
    if tool["id"] == "shell_exec":
        tool["tags"] = ["shell"]
    elif tool["id"] == "sql_query_read" or tool["id"] == "sql_query_write":
        tool["tags"] = ["sql"]
    elif tool["id"] == "search_engine":
        tool["tags"] = ["search"]
    elif (
        tool["id"] == "retrieval_query"
        or tool["id"] == "retrieval_add"
        or tool["id"] == "retrieval_load"
    ):
        tool["tags"] = ["retrieval"]
    # elif tool['id'] == "get_stock_price" or tool['id'] == "get_stock_info" or tool['id'] == "get_stock_news" or tool['id'] == "get_stock_history" or tool['id'] == "get_stock_dividends" or tool['id'] == "get_stock_actions" or tool['id'] == "get_stock_financials" or tool['id'] == "get_stock_recommendations" or tool['id'] == "get_stock_holders":
    #     tool['tags'] = ["finance"]
    return tool


async def init_tools(
    tools: list[Any],
    metadata: dict = None,
) -> list[StructuredTool]:
    structured_tools = []
    filtered_tools = [
        tool
        for tool in tools
        if tool is not None and tool != "" and tool != {} and tool != []
    ]

    for tool in filtered_tools:
        tools_to_add = []

        if isinstance(tool, dict) and any(
            isinstance(v, A2AServer) for v in tool.values()
        ):
            tools_to_add = init_a2a_tools(thread_id=metadata.get("thread_id"), a2a=tool)
        elif isinstance(tool, ArcadeConfig) and (tool.tools or tool.toolkits):
            tools_to_add = init_arcade_tools(arcade=tool)
        elif isinstance(tool, dict) and not tool.get("spec", None):
            mcp_service = McpService(tool)
            tools_to_add = await mcp_service.get_tools()
        elif isinstance(tool, dict) and tool.get("spec"):
            tools_to_add = generate_tools_from_openapi_json(
                tool.get("spec"), headers=tool.get("headers", {})
            )
        elif isinstance(tool, str):
            tools_to_add = dynamic_tools(selected_tools=tool)

        if tools_to_add:
            if metadata:
                for t in tools_to_add:
                    t.metadata = metadata
            structured_tools.extend(tools_to_add)

    return structured_tools


__all__ = [
    "init_a2a_tools",
    "init_arcade_tools",
]
