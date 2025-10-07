from langchain_core.tools import StructuredTool, BaseTool
from typing import Any

from src.services.mcp import McpService
from src.schemas.entities import ArcadeConfig
from src.schemas.entities.a2a import A2AServer

from src.tools.search import web_search, web_scrape
from src.tools.image import generate_image, refine_image
from src.tools.a2a import init_a2a_tools
from src.tools.arcade import init_arcade_tools
from src.tools.api import generate_tools_from_openapi_json
from src.tools.test import TEST_TOOLS, get_stock_price, get_weather, human_assistance

TOOL_LIBRARY = [
    web_search,
    web_scrape,
    generate_image,
    refine_image,
    get_stock_price,
    get_weather,
    human_assistance,
]


def default_tools(tools: list[str]) -> list[BaseTool]:
    if not tools:
        return []
    default_tools = [tool for tool in TOOL_LIBRARY if tool.name in tools]
    return default_tools


def attach_tool_details(tool):
    if tool["id"] == "shell_exec":
        tool["tags"] = ["shell"]
    elif tool["id"] == "sql_query_read" or tool["id"] == "sql_query_write":
        tool["tags"] = ["sql"]
    elif tool["id"] == "search_engine":
        tool["tags"] = ["search"]
    elif tool["id"] == "generate_image" or tool["id"] == "refine_image":
        tool["tags"] = ["image", "generation", "openai"]
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
