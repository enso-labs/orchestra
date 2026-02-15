from typing import List
from langchain_core.tools import BaseTool
from src.constants import APP_ENV
from src.tools.search import SEARCH_TOOLS
from src.tools.test import TEST_TOOLS
from src.tools.code import PYTHON_CODE_INTERPRETER_TOOLS
from src.tools.finance import FINANCE_TOOLS
from src.tools.ms_teams import MICROSOFT_TEAMS_TOOLS
from src.tools.api import API_TOOLS
from src.tools.bash_tool import BASH_TOOLS
from src.tools.memory import MEMORY_TOOLS


def default_tools() -> list[BaseTool]:
    default_tools = [
        *SEARCH_TOOLS,
        *PYTHON_CODE_INTERPRETER_TOOLS,
        *FINANCE_TOOLS,
        *MEMORY_TOOLS,
    ]
    if APP_ENV == "test":
        default_tools.extend(TEST_TOOLS)
    return default_tools


def auth_tools(user_id: str) -> list[BaseTool]:
    auth_tools = [
        *MICROSOFT_TEAMS_TOOLS,
        *API_TOOLS,
    ]
    for tool in auth_tools:
        tool.metadata = {"user_id": user_id}
    return auth_tools


def optional_tools() -> list[BaseTool]:
    """Tools that are available when explicitly requested but not enabled by default.

    These tools are included in the tool library but NOT in default_tools().
    They must be explicitly requested via the tools array in the API request.
    """
    return [
        *BASH_TOOLS,  # CLI-side execution, requires --bash flag on CLI
    ]


def init_tool_library(user_id: str | None = None, default: bool = True) -> list[BaseTool]:
    tool_lib = []
    if default:
        tool_lib.extend(default_tools())
    if user_id:
        tool_lib.extend(auth_tools(user_id))
    # Always include optional tools so they can be requested by name
    tool_lib.extend(optional_tools())

    return tool_lib


TOOL_LIBRARY: List[BaseTool] = init_tool_library()
