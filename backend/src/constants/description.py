from enum import Enum

class Description(Enum):
    ARCADE_TOOLS = (
        "List all tools from Arcade.dev.\n\n"
        "For more information, see the [Arcade.dev API Reference]"
        "(https://reference.arcade.dev/v013/reference#tag/tools/GET/v1/tools)."
    )
    ARCADE_TOOL = (
        "Get a specific tool from Arcade.dev.\n\n"
        "For more information, see the [Arcade.dev API Reference]"
        "(https://reference.arcade.dev/v013/reference#tag/tools/GET/v1/tools/{name})."
    )
