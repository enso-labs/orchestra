from langchain_core.tools import StructuredTool, BaseTool
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_arcade import ArcadeToolManager

from src.schemas.entities.a2a import A2AServer
from src.tools import TOOL_LIBRARY
from src.utils.a2a import A2ACardResolver
from src.schemas.entities import ArcadeConfig
from src.utils.logger import logger
from src.utils.tools import attach_tool_details
from src.constants import ARCADE_API_KEY


class ToolService:
    def default_tools(self, tools: list[str]) -> list[BaseTool]:
        if not tools:
            return []
        default_tools = [tool for tool in TOOL_LIBRARY if tool.name in tools]
        return default_tools

    @staticmethod
    def tool_details():
        tool_details = []
        for tool in TOOL_LIBRARY:
            updated_tool = attach_tool_details(tool)
            tool_details.append(
                {
                    "name": updated_tool.name,
                    "description": updated_tool.description,
                    "args": updated_tool.args,
                    "tags": updated_tool.tags,
                    "metadata": updated_tool.metadata,
                }
            )
        return tool_details

    @staticmethod
    async def mcp_tools(mcp: dict):
        try:
            mcp_client = MultiServerMCPClient(mcp)
            mcp_tools = await mcp_client.get_tools()
            return mcp_tools
        except Exception as e:
            logger.error(f"Error fetching MCP tools: {e}")
            return []

    @staticmethod
    def a2a_tools(a2a: dict[str, A2AServer]):
        agent_cards = []
        for server_name, server in a2a.items():
            try:
                a2a_card_resolver = A2ACardResolver(
                    server.base_url, server.agent_card_path
                )
                agent_card = a2a_card_resolver.get_agent_card()
                agent_cards.append(agent_card)
            except Exception as e:
                logger.error(f"Error fetching agent card for {server.base_url}: {e}")
        return agent_cards

    @staticmethod
    def arcade_tools(
        arcade: ArcadeConfig,
    ) -> list[StructuredTool]:
        manager = ArcadeToolManager(api_key=ARCADE_API_KEY)
        tools = manager.get_tools(tools=arcade.tools, toolkits=arcade.toolkits)
        return tools


tool_service = ToolService()
