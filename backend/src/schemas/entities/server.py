import ipaddress
from datetime import datetime
from typing import Any, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, field_validator

from src.schemas.models.server import ServerTransport


def _is_private_url(url: str) -> bool:
    """Check if a URL points to a private/internal address (SSRF protection)."""
    from urllib.parse import urlparse

    parsed = urlparse(url)
    hostname = parsed.hostname
    if not hostname:
        return True

    # Block localhost variants
    if hostname in ("localhost", "127.0.0.1", "::1", "0.0.0.0"):
        return True

    # Block common internal hostnames
    if hostname.endswith(".local") or hostname.endswith(".internal"):
        return True

    try:
        addr = ipaddress.ip_address(hostname)
        return (
            addr.is_private
            or addr.is_loopback
            or addr.is_link_local
            or addr.is_reserved
        )
    except ValueError:
        # hostname is a domain name, not an IP - allow it
        pass

    return False


class ServerCreate(BaseModel):
    name: str = Field(
        ...,
        min_length=1,
        max_length=200,
        json_schema_extra={"example": "My MCP Server"},
    )
    url: str = Field(
        ...,
        min_length=1,
        json_schema_extra={"example": "https://mcp.example.com/sse"},
    )
    transport: ServerTransport = Field(
        default=ServerTransport.SSE,
        json_schema_extra={"example": "sse"},
    )
    config: Optional[dict[str, Any]] = Field(
        default=None,
        json_schema_extra={"example": {"api_key": "sk-..."}},
    )

    @field_validator("url")
    @classmethod
    def validate_url_not_private(cls, v: str) -> str:
        if not v.startswith(("http://", "https://")):
            raise ValueError("URL must start with http:// or https://")
        if _is_private_url(v):
            raise ValueError("URL must not point to a private or internal address")
        return v


class ServerUpdate(BaseModel):
    name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=200,
        json_schema_extra={"example": "Updated MCP Server"},
    )
    url: Optional[str] = Field(
        default=None,
        min_length=1,
        json_schema_extra={"example": "https://mcp.example.com/sse"},
    )
    transport: Optional[ServerTransport] = Field(
        default=None,
        json_schema_extra={"example": "sse"},
    )
    config: Optional[dict[str, Any]] = Field(
        default=None,
        json_schema_extra={"example": {"api_key": "sk-..."}},
    )

    @field_validator("url")
    @classmethod
    def validate_url_not_private(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not v.startswith(("http://", "https://")):
            raise ValueError("URL must start with http:// or https://")
        if _is_private_url(v):
            raise ValueError("URL must not point to a private or internal address")
        return v


def _redact_config(config: Optional[dict[str, Any]]) -> Optional[dict[str, str]]:
    """Redact secret values in config, showing only key names."""
    if not config:
        return config
    return {k: "***REDACTED***" for k in config}


class ServerResponse(BaseModel):
    id: UUID = Field(..., json_schema_extra={"example": str(uuid4())})
    name: str = Field(..., json_schema_extra={"example": "My MCP Server"})
    slug: str = Field(..., json_schema_extra={"example": "my-mcp-server"})
    url: str = Field(..., json_schema_extra={"example": "https://mcp.example.com/sse"})
    transport: ServerTransport = Field(..., json_schema_extra={"example": "sse"})
    config: Optional[dict[str, Any]] = Field(
        default=None,
        json_schema_extra={"example": {"api_key": "***REDACTED***"}},
    )
    user_id: UUID = Field(..., json_schema_extra={"example": str(uuid4())})
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @field_validator("config", mode="before")
    @classmethod
    def redact_secrets(cls, v: Any) -> Any:
        if isinstance(v, dict):
            return _redact_config(v)
        return v


class ServerTestConnectionRequest(BaseModel):
    url: str = Field(
        ...,
        min_length=1,
        json_schema_extra={"example": "https://mcp.example.com/sse"},
    )
    transport: ServerTransport = Field(
        default=ServerTransport.SSE,
        json_schema_extra={"example": "sse"},
    )
    config: Optional[dict[str, Any]] = Field(
        default=None,
        json_schema_extra={"example": {"api_key": "sk-..."}},
    )

    @field_validator("url")
    @classmethod
    def validate_url_not_private(cls, v: str) -> str:
        if not v.startswith(("http://", "https://")):
            raise ValueError("URL must start with http:// or https://")
        if _is_private_url(v):
            raise ValueError("URL must not point to a private or internal address")
        return v


class ServerTestConnectionResponse(BaseModel):
    success: bool
    message: str
    tools_count: Optional[int] = None


class ServerToolResponse(BaseModel):
    name: str
    description: Optional[str] = None
