from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

from src.schemas.entities.store import BaseEntity


class SandboxType(str, Enum):
    """Supported sandbox backend types."""

    DAYTONA = "daytona"
    STATE = "state"


class ProviderKeyStatus(BaseModel):
    """Status of a provider API key (never exposes the raw key)."""

    provider: str = Field(..., description="Provider name matching UserTokenKey enum")
    is_set: bool = Field(default=False, description="Whether a key is configured for this provider")


class UserSettings(BaseEntity):
    """Persisted user settings entity."""

    user_id: str = Field(..., description="ID of the user who owns these settings")
    default_model: Optional[str] = Field(default=None, description="User's default AI model identifier")
    encrypted_keys: Optional[str] = Field(default=None, description="Fernet-encrypted JSON blob of provider API keys")
    default_sandbox: Optional[str] = Field(default=None, description="User's default sandbox backend type")
    default_tools: Optional[list[str]] = Field(default=None, description="User's default tool selection")
    default_mcp: Optional[dict] = Field(default=None, description="User's default MCP server configuration")
    default_a2a: Optional[dict] = Field(default=None, description="User's default A2A agent configuration")
    default_subagents: Optional[list[str]] = Field(default=None, description="User's default subagent selection")
    default_model_visibility: Optional[list[str]] = Field(
        default=None, description="User's default model visibility list"
    )


class DefaultsResponse(BaseModel):
    """Nested defaults sub-object in the API response."""

    model: Optional[str] = None
    sandbox: Optional[str] = None
    tools: Optional[list[str]] = None
    mcp: Optional[dict] = None
    a2a: Optional[dict] = None
    subagents: Optional[list[str]] = None
    model_visibility: Optional[list[str]] = None


class UserSettingsResponse(BaseModel):
    """API response model – never includes raw keys."""

    defaults: DefaultsResponse = Field(default_factory=DefaultsResponse)
    provider_keys: list[ProviderKeyStatus] = Field(default_factory=list)


class PatchDefaultsRequest(BaseModel):
    """Request to partially update user default settings."""

    model: Optional[str] = Field(default=None, description="Model identifier to set as default, or null to clear")
    sandbox: Optional[str] = Field(default=None, description="Sandbox type to set as default, or null to clear")
    tools: Optional[list[str]] = Field(default=None, description="Default tool selection, or null to clear")
    mcp: Optional[dict] = Field(default=None, description="Default MCP server config, or null to clear")
    a2a: Optional[dict] = Field(default=None, description="Default A2A agent config, or null to clear")
    subagents: Optional[list[str]] = Field(default=None, description="Default subagent selection, or null to clear")
    model_visibility: Optional[list[str]] = Field(default=None, description="Model visibility list, or null to clear")


class UpsertProviderKeyRequest(BaseModel):
    """Request to add or update a provider API key."""

    provider: str = Field(..., description="Provider name matching UserTokenKey enum")
    api_key: str = Field(..., description="The API key value to store (encrypted)")
