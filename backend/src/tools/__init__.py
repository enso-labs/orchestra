from src.constants import APP_ENV
from src.tools.search import SEARCH_TOOLS
from src.tools.test import TEST_TOOLS
from src.tools.code import PYTHON_CODE_INTERPRETER_TOOLS

TOOL_LIBRARY = [
    *SEARCH_TOOLS,
    *PYTHON_CODE_INTERPRETER_TOOLS,
]

if APP_ENV == "test":
    TOOL_LIBRARY.extend(TEST_TOOLS)
