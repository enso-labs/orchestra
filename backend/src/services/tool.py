from langchain_core.runnables import RunnableConfig
from langchain_core.tools import StructuredTool
from langchain_mcp_adapters.client import MultiServerMCPClient

from langgraph.store.base import BaseStore

from src.schemas.entities.a2a import A2AServer, McpServer
from src.tools import init_tool_library
from src.utils.a2a import A2ACardResolver
# from src.schemas.entities import ArcadeConfig
from src.utils.logger import logger
from src.utils.tools import attach_tool_details, create_api_tool
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

    async def tool_details(self):
        try:
            tool_details = []
            tool_library = init_tool_library(user_id=self.user_id)
            user_tools: list[StructuredTool] = await self.tool_repo.search()
            base_tools = set[str]()
            for tool in user_tools + tool_library:
                tool: StructuredTool = attach_tool_details(tool)
                tool_dict = tool.model_dump()
                try:
                    tool_dict["args_schema"] = tool_dict["args_schema"].model_json_schema()
                except Exception as e:
                    logger.error(f"Error formatting args schema for {tool.name}: {e}")
                    tool_dict["args_schema"] = tool_dict.get("args_schema", None)
                metadata = tool_dict["metadata"]
                if metadata and metadata.get("base_tool"):
                    base_tools.add(metadata.get("base_tool"))

                if tool.name not in base_tools:
                    ## Does NOT indicate whether async or sync, so we remove
                    # tool_dict['coroutine'] = tool_dict['coroutine'] is not None
                    del tool_dict["func"]
                    del tool_dict["coroutine"]
                    tool_details.append(tool_dict)
            return tool_details
        except Exception as e:
            logger.exception(f"Error fetching tool details: {e}")
            return []

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

    # @staticmethod
    # def arcade_tools(
    #     arcade: ArcadeConfig,
    # ) -> list[StructuredTool]:
    #     from langchain_arcade import ArcadeToolManager

    #     manager = ArcadeToolManager(api_key=ARCADE_API_KEY)
    #     tools = manager.get_tools(tools=arcade.tools, toolkits=arcade.toolkits)
    #     return tools

    # async def invoke_default_tool(self, name: str, input: dict, config: dict = None):
    #     tool: StructuredTool = next(
    #         (tool for tool in TOOL_LIBRARY if tool.name == name), None
    #     )
    #     if not tool:
    #         raise ValueError(f"Tool {name} not found")
    #     return await tool.ainvoke(
    #         input=input,
    #         config={"configurable": {"user_id": self.user_id, **config}}
    #         if self.user_id
    #         else None,
    #     )

    async def invoke_ephemeral_tool(self, name: str, config: dict, input: dict):
        try:
            api_config = config.get("api_tool")
            if not api_config:
                raise ValueError("Only 'api_tool' config is supported for ephemeral invocation")

            tool = create_api_tool(
                name=name,
                description="Ephemeral tool",
                base_url=api_config.get("base_url"),
                method=api_config.get("method", "GET"),
                endpoint=api_config.get("endpoint"),
                args_schema=api_config.get("args_schema"),
                headers=api_config.get("headers"),
            )
            return await self.invoke_structured_tool(tool, input)
        except Exception as e:
            logger.exception(f"Error invoking ephemeral tool {name}: {e}")
            return {"error": str(e)}

    async def invoke_structured_tool(
        self, structured_tool: StructuredTool, input: dict
    ):
        try:
            return await structured_tool.ainvoke(
                input=input, config={"metadata": structured_tool.metadata}
            )
        except Exception as e:
            logger.exception(
                f"Error invoking structured tool {structured_tool.name}: {e}"
            )
            return {"error": str(e)}


tool_service = ToolService()
