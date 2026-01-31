from typing import Optional
from pydantic import BaseModel, Field

from src.schemas.entities.store import BaseEntity


class ProviderKeyStatus(BaseModel):
    """Status of a provider API key (never exposes the raw key)."""

    provider: str = Field(..., description="Provider name matching UserTokenKey enum")
    is_set: bool = Field(
        default=False, description="Whether a key is configured for this provider"
    )


class UserSettings(BaseEntity):
    """Persisted user settings entity."""

    user_id: str = Field(..., description="ID of the user who owns these settings")
    default_model: Optional[str] = Field(
        default=None, description="User's default AI model identifier"
    )
    encrypted_keys: Optional[str] = Field(
        default=None, description="Fernet-encrypted JSON blob of provider API keys"
    )


class UserSettingsResponse(BaseModel):
    """API response model – never includes raw keys."""

    default_model: Optional[str] = None
    provider_keys: list[ProviderKeyStatus] = Field(default_factory=list)


class UpdateDefaultModelRequest(BaseModel):
    """Request to set a user's default model."""

    model: Optional[str] = Field(
        default=None,
        description="Model identifier to set as default, or null to clear",
    )


class UpsertProviderKeyRequest(BaseModel):
    """Request to add or update a provider API key."""

    provider: str = Field(..., description="Provider name matching UserTokenKey enum")
    api_key: str = Field(..., description="The API key value to store (encrypted)")
