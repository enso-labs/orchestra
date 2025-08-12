"""
Server configuration validation logic.

This module contains all validation functions for different server types
and their configurations, providing clear error messages and validation rules.
"""

from typing import List, Dict, Any
from .server_schemas import Config, ValidationResponse


def validate_mcp_config(config: dict) -> List[dict]:
    """
    Validate MCP (Model Context Protocol) server configuration.
    
    Args:
        config: The MCP server configuration dictionary
        
    Returns:
        List of validation errors (empty if valid)
    """
    errors = []
    
    if not isinstance(config, dict):
        errors.append({
            "field": "config",
            "message": "Configuration must be an object"
        })
        return errors
    
    if "transport" not in config:
        errors.append({
            "field": "config.transport",
            "message": "Transport is required"
        })
    elif config["transport"] not in ["sse"]:
        errors.append({
            "field": "config.transport",
            "message": "Transport must be one of: sse"
        })
    
    if "url" not in config:
        errors.append({
            "field": "config.url",
            "message": "URL is required"
        })
    
    return errors


def validate_a2a_config(config: dict) -> List[dict]:
    """
    Validate A2A (Agent to Agent) server configuration.
    
    Args:
        config: The A2A server configuration dictionary
        
    Returns:
        List of validation errors (empty if valid)
    """
    errors = []
    
    if not isinstance(config, dict):
        errors.append({
            "field": "config",
            "message": "Configuration must be an object"
        })
        return errors
        
    if "base_url" not in config:
        errors.append({
            "field": "config.base_url",
            "message": "Base URL is required"
        })
        
    if "agent_card_path" not in config:
        errors.append({
            "field": "config.agent_card_path",
            "message": "Agent card path is required"
        })
    
    return errors


async def validate_server_config(server_data: Config) -> ValidationResponse:
    """
    Validate a server configuration based on its type.
    
    Args:
        server_data: The server configuration to validate
        
    Returns:
        ValidationResponse indicating success and any errors found
    """
    errors = []
    
    # Validate server type
    if server_data.type not in ["mcp", "a2a"]:
        errors.append({
            "field": "type",
            "message": "Server type must be either 'mcp' or 'a2a'"
        })
        return ValidationResponse(valid=False, errors=errors)
    
    # Validate configuration based on server type
    if server_data.type == "mcp":
        mcp_errors = validate_mcp_config(server_data.config)
        errors.extend(mcp_errors)
    elif server_data.type == "a2a":
        a2a_errors = validate_a2a_config(server_data.config)
        errors.extend(a2a_errors)
    
    return ValidationResponse(
        valid=len(errors) == 0,
        errors=errors
    )