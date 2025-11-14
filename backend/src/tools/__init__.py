from typing import List
from langchain_core.tools import BaseTool
from src.constants import APP_ENV
from src.tools.search import SEARCH_TOOLS
from src.tools.test import TEST_TOOLS
from src.tools.code import PYTHON_CODE_INTERPRETER_TOOLS
from src.tools.finance import FINANCE_TOOLS
from src.tools.ms_teams import MICROSOFT_TEAMS_TOOLS


def default_tools() -> list[BaseTool]:
    default_tools = [
        *SEARCH_TOOLS,
        *PYTHON_CODE_INTERPRETER_TOOLS,
        *FINANCE_TOOLS,
    ]
    if APP_ENV == "test":
        default_tools.extend(TEST_TOOLS)
    return default_tools


def auth_tools(user_id: str) -> list[BaseTool]:
    auth_tools = [
        *MICROSOFT_TEAMS_TOOLS,
    ]
    for tool in auth_tools:
        tool.metadata = {"user_id": user_id}
    return auth_tools

def init_tool_library(user_id: str = None) -> list[BaseTool]:
    tool_lib = default_tools()
    if user_id:
        tool_lib.extend(auth_tools(user_id))
    
    return tool_lib

TOOL_LIBRARY: List[BaseTool] = init_tool_library()