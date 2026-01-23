"""
Bash Tool - CLI-side execution marker

This tool is registered in the backend to allow the LLM to generate bash_tool
calls, but actual execution happens on the CLI side (client machine).

The CLI intercepts bash_tool calls before they reach the backend and executes
them locally with user consent. This tool exists only as a schema definition
to enable the LLM to generate properly structured tool calls.

Security Note:
- The backend NEVER executes bash commands
- If this tool is somehow invoked on the backend, it raises NotImplementedError
- All execution happens client-side with mandatory user consent
"""

from pydantic import BaseModel, Field
from langchain_core.tools import tool


class BashToolInput(BaseModel):
    """Input schema for the bash_tool."""

    command: str = Field(
        description="The bash command to execute on the user's local machine"
    )
    working_directory: str | None = Field(
        default=None,
        description="Working directory for command execution (defaults to current directory)",
    )
    timeout_ms: int | None = Field(
        default=30000,
        description="Timeout in milliseconds (default: 30000, max: 300000)",
    )


@tool(args_schema=BashToolInput)
def bash_tool(
    command: str,
    working_directory: str | None = None,
    timeout_ms: int | None = 30000,
) -> str:
    """
    Execute a bash command on the user's local machine.

    This tool runs bash commands locally on the CLI user's machine, NOT on the server.
    The user must explicitly approve each command before execution.

    Use cases:
    - File system operations (ls, mkdir, cp, mv)
    - Git commands (git status, git log, git diff)
    - Package management (npm, pip, cargo)
    - Building and testing code
    - System information gathering

    Security notes:
    - Commands run with the user's permissions
    - User sees and must approve each command
    - Dangerous commands (rm -rf /, fork bombs) are blocked
    - Output is captured and returned

    Args:
        command: The bash command to execute
        working_directory: Optional working directory for the command
        timeout_ms: Timeout in milliseconds (default 30s, max 5min)

    Returns:
        Command output (stdout + stderr) and exit code
    """
    # This should never be called on the backend
    # The CLI intercepts bash_tool calls and executes them locally
    raise NotImplementedError(
        "bash_tool is executed on the CLI side, not the backend. "
        "If you're seeing this error, the CLI failed to intercept the tool call. "
        "Ensure you're using the CLI with --bash flag enabled."
    )


# Export as list for consistency with other tool modules
BASH_TOOLS = [bash_tool]
