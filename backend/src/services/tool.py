import asyncio
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import StructuredTool, BaseTool
from langchain_mcp_adapters.client import MultiServerMCPClient

from langgraph.store.base import BaseStore

from src.repos.tool_repo import SavedTool
from src.schemas.entities.a2a import A2AServer, McpServer
from src.tools import TOOL_LIBRARY, init_tool_library
from src.utils.a2a import A2ACardResolver
from src.schemas.entities import ArcadeConfig
from src.utils.logger import logger
from src.utils.tools import attach_tool_details
from src.constants import ARCADE_API_KEY
from src.services.db import get_store_in_memory
from src.repos.tool_repo import ToolRepo


class ToolService:
    def __init__(
        self, 
        user_id: str = None,
        store: BaseStore = get_store_in_memory(),
        config: RunnableConfig = None,
    ):
        self.user_id = user_id
        self.store = store
        self.tool_repo = ToolRepo(user_id=user_id, store=store, config=config)
        
    @staticmethod
    def default_tools(tools: list[str]) -> list[BaseTool]:
        default_tools = [tool for tool in TOOL_LIBRARY if tool.name in tools]
        return default_tools
    
    
    def library(self) -> list[BaseTool]:
        tool_lib = init_tool_library(self.user_id)
        return tool_lib

    async def tool_details(self):
        tool_details = []
        user_tools: list[StructuredTool] = await self.tool_repo.search()
        for tool in user_tools:
            updated_tool = attach_tool_details(tool)
            tool_details.append(
                {
                    "name": updated_tool.name,
                    "description": updated_tool.description,
                    "args": tool.args,
                    "tags": tool.tags,
                    # "metadata": updated_tool.metadata,
                }
            )
        return tool_details

    @staticmethod
    async def mcp_tools(mcp: dict[str, McpServer]):
        try:
            mcp_client = MultiServerMCPClient(mcp)
            mcp_tools = await mcp_client.get_tools()
            return mcp_tools
        except Exception as e:
            logger.error(f"Error fetching MCP tools: {e}")
            return []

    @staticmethod
    def agent_cards(a2a: dict[str, A2AServer]):
        agent_cards = []
        for _, server in a2a.items():
            try:
                a2a_card_resolver = A2ACardResolver(
                    server.base_url, server.agent_card_path
                )
                agent_card = a2a_card_resolver.get_agent_card()
                agent_cards.append(agent_card.model_dump())
            except Exception as e:
                logger.error(f"Error fetching agent card for {server.base_url}: {e}")
        return agent_cards

    @staticmethod
    def arcade_tools(
        arcade: ArcadeConfig,
    ) -> list[StructuredTool]:
        from langchain_arcade import ArcadeToolManager
        manager = ArcadeToolManager(api_key=ARCADE_API_KEY)
        tools = manager.get_tools(tools=arcade.tools, toolkits=arcade.toolkits)
        return tools

    async def invoke_default_tool(self, name: str, input: dict, config: dict = None):
        tool: StructuredTool = next(
            (tool for tool in TOOL_LIBRARY if tool.name == name), None
        )
        if not tool:
            raise ValueError(f"Tool {name} not found")
        return await tool.ainvoke(
            input=input,
            config={"configurable": {"user_id": self.user_id, **config}}
            if self.user_id
            else None,
        )
        
    async def invoke_saved_tool(self, saved_tool: SavedTool, input: dict):
        structured_tool = saved_tool.to_structured_tool()
        return await structured_tool.ainvoke(
            input=input,
            config={"metadata": structured_tool.metadata}
        )


tool_service = ToolService()
