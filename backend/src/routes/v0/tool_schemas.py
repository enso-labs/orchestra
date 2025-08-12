"""
Tool-related schemas and data models.

This module contains Pydantic models for tool-related API requests and responses.
"""

from typing import Dict, Any, Optional, Literal
from pydantic import BaseModel, Field


class MCPInfo(BaseModel):
    """Schema for MCP (Model Context Protocol) configuration."""
    mcp: Optional[Dict[str, Any]] = None
    mcpServers: Optional[Dict[str, Any]] = None
    
    model_config = {
        "json_schema_extra": {"example": {
            "mcpServers": {
                "server1": {
                    "command": "example-command",
                    "args": ["--arg1", "value1"]
                }
            }
        }}
    }


class ToolRequest(BaseModel):
    """Schema for tool invocation requests."""
    args: Dict[str, Any]


class ToolInvocationResponse(BaseModel):
    """Schema for tool invocation responses."""
    output: Any = None
    success: bool
    error: Optional[str] = None
    traceback: Optional[str] = None