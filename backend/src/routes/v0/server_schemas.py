"""
Server configuration schemas and data models.

This module contains all Pydantic models used for server configuration
requests, responses, and validation across the server management API.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class Config(BaseModel):
    """Base configuration model for server types."""
    type: str = Field(..., description="Server type: 'mcp' or 'a2a'", pattern="^(mcp|a2a)$")
    config: dict


class ServerCreate(Config):
    """Schema for creating a new server configuration."""
    name: str
    description: Optional[str] = None
    documentation: Optional[str] = Field(None, description="Markdown documentation for the server")
    documentation_url: Optional[str] = Field(None, description="External URL for server documentation")
    public: bool = False


class ServerUpdate(BaseModel):
    """Schema for partial updates to server configuration."""
    name: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    config: Optional[dict] = None
    documentation: Optional[str] = None
    documentation_url: Optional[str] = None
    public: Optional[bool] = None


class ServerResponse(BaseModel):
    """Schema for server configuration responses."""
    id: str
    user_id: str
    name: str
    slug: str
    description: Optional[str] = None
    type: str
    config: dict
    documentation: Optional[str] = None
    documentation_url: Optional[str] = None
    public: bool
    created_at: str
    updated_at: str


class ServerListResponse(BaseModel):
    """Schema for paginated server list responses."""
    servers: List[ServerResponse]
    total: int
    limit: int
    offset: int


class ValidationResponse(BaseModel):
    """Schema for configuration validation responses."""
    valid: bool
    errors: List[dict] = []


class ConnectionTestResponse(BaseModel):
    """Schema for connection test responses."""
    success: bool
    latency_ms: Optional[int] = None
    message: Optional[str] = None
    error: Optional[str] = None
    details: Optional[dict] = None