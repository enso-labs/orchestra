from src.schemas.entities import ArcadeConfig
from langchain_core.tools import StructuredTool
from langchain_arcade import ArcadeToolManager
from src.constants import ARCADE_API_KEY


def init_arcade_tools(
    arcade: ArcadeConfig,
) -> list[StructuredTool]:
    manager = ArcadeToolManager(api_key=ARCADE_API_KEY)
    tools = manager.get_tools(tools=arcade.tools, toolkits=arcade.toolkits)
    return tools
