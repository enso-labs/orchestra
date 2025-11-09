from typing import List
from langchain_core.tools import BaseTool
from src.constants import APP_ENV
from src.tools.search import SEARCH_TOOLS
from src.tools.test import TEST_TOOLS
from src.tools.code import PYTHON_CODE_INTERPRETER_TOOLS
from src.tools.finance import FINANCE_TOOLS
from src.tools.ms_teams import MICROSOFT_TEAMS_TOOLS

def init_tool_library():
    tool_lib = [
        *SEARCH_TOOLS,
        *PYTHON_CODE_INTERPRETER_TOOLS,
        *FINANCE_TOOLS,
        *MICROSOFT_TEAMS_TOOLS,
    ]
    if APP_ENV == "test":
        tool_lib.extend(TEST_TOOLS)
    return tool_lib

TOOL_LIBRARY: List[BaseTool] = init_tool_library()