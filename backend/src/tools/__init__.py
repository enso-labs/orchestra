from src.constants import APP_ENV, MICROSOFT_TEAMS_WEBHOOK_URL
from src.tools.search import SEARCH_TOOLS
from src.tools.test import TEST_TOOLS
from src.tools.code import PYTHON_CODE_INTERPRETER_TOOLS
from src.tools.finance import FINANCE_TOOLS
from src.tools.gridsite import GRIDSIDE_TOOLS

TOOL_LIBRARY = [
    *SEARCH_TOOLS,
    *PYTHON_CODE_INTERPRETER_TOOLS,
    *FINANCE_TOOLS,
]

if MICROSOFT_TEAMS_WEBHOOK_URL:
    TOOL_LIBRARY.extend(GRIDSIDE_TOOLS)

if APP_ENV == "test":
    TOOL_LIBRARY.extend(TEST_TOOLS)
