from typing import Optional
import uuid
from datetime import datetime, timezone

from src.repos.base_repo import BaseRepo
from src.schemas.entities.settings import UserSettings, ProviderKeyStatus
from src.utils.security import encrypt_value, decrypt_value
from src.constants import UserTokenKey

# Single well-known key for the one settings record per user
_SETTINGS_KEY = "default"


class UserSettingsRepo(BaseRepo):
    def __init__(self, user_id: str, store):
        super().__init__(user_id, store, "user_settings")

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _validate_provider(self, provider: str) -> None:
        """Raise ValueError if provider is not in UserTokenKey."""
        valid = UserTokenKey.values()
        if provider not in valid:
            raise ValueError(f"Invalid provider '{provider}'. Must be one of: {valid}")

    async def _get_or_create(self) -> UserSettings:
        """Return existing settings or create an empty record."""
        item = await self._get(_SETTINGS_KEY)
        if item:
            return UserSettings.model_validate(item.value)
        settings = UserSettings(
            id=str(uuid.uuid4()),
            user_id=self.user_id,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        await self._set(_SETTINGS_KEY, settings)
        return settings

    def _decrypt_keys(self, settings: UserSettings) -> dict[str, str]:
        """Return decrypted key map, or empty dict if nothing stored."""
        if not settings.encrypted_keys:
            return {}
        return decrypt_value(settings.encrypted_keys)

    def _encrypt_keys(self, keys: dict[str, str]) -> Optional[str]:
        if not keys:
            return None
        return encrypt_value(keys)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def get_settings(self) -> tuple[UserSettings, list[ProviderKeyStatus]]:
        """Return settings and provider key statuses (no raw keys)."""
        settings = await self._get_or_create()
        keys = self._decrypt_keys(settings)
        statuses = [
            ProviderKeyStatus(provider=p.value, is_set=(p.value in keys))
            for p in UserTokenKey
        ]
        return settings, statuses

    async def set_default_model(self, model: Optional[str]) -> UserSettings:
        settings = await self._get_or_create()
        settings.default_model = model
        settings.updated_at = datetime.now(timezone.utc)
        await self._set(_SETTINGS_KEY, settings)
        return settings

    async def upsert_provider_key(self, provider: str, api_key: str) -> UserSettings:
        self._validate_provider(provider)
        settings = await self._get_or_create()
        keys = self._decrypt_keys(settings)
        keys[provider] = api_key
        settings.encrypted_keys = self._encrypt_keys(keys)
        settings.updated_at = datetime.now(timezone.utc)
        await self._set(_SETTINGS_KEY, settings)
        return settings

    async def delete_provider_key(self, provider: str) -> UserSettings:
        self._validate_provider(provider)
        settings = await self._get_or_create()
        keys = self._decrypt_keys(settings)
        keys.pop(provider, None)
        settings.encrypted_keys = self._encrypt_keys(keys)
        settings.updated_at = datetime.now(timezone.utc)
        await self._set(_SETTINGS_KEY, settings)
        return settings

    async def get_all_decrypted_keys(self) -> dict[str, str]:
        """Return all decrypted provider keys as a dict."""
        settings = await self._get_or_create()
        return self._decrypt_keys(settings)

    async def get_decrypted_key(self, provider: str) -> Optional[str]:
        """Return the raw decrypted key for a single provider, or None."""
        self._validate_provider(provider)
        settings = await self._get_or_create()
        keys = self._decrypt_keys(settings)
        return keys.get(provider)
