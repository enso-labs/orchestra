from datetime import datetime, timezone
import uuid
from typing import Any, Optional

from src.repos.base_repo import BaseRepo
from src.schemas.entities.settings import PersistedContextFile, ProviderKeyStatus, SandboxType, UserSettings
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

    def _validate_absolute_path(self, path: str, field_name: str) -> str:
        if not isinstance(path, str) or not path.strip():
            raise ValueError(f"Invalid {field_name} path: expected a non-empty absolute path")
        if not path.startswith("/"):
            raise ValueError(f"Invalid {field_name} path '{path}': path must be absolute")
        return path

    def _normalize_default_files(self, files: Any) -> dict[str, PersistedContextFile] | None:
        if files is None:
            return None
        if not isinstance(files, dict):
            raise ValueError("Invalid files payload: expected an object keyed by absolute path")

        normalized: dict[str, PersistedContextFile] = {}
        for path, raw_value in files.items():
            absolute_path = self._validate_absolute_path(path, "files")
            if not isinstance(raw_value, dict):
                raise ValueError(f"Invalid files value for '{absolute_path}': expected an object")
            if "content" not in raw_value:
                raise ValueError(f"Invalid files value for '{absolute_path}': missing content")
            normalized[absolute_path] = PersistedContextFile.model_validate(raw_value)

        return normalized

    def _normalize_deleted_files(self, deleted_files: Any) -> list[str] | None:
        if deleted_files is None:
            return None
        if not isinstance(deleted_files, list):
            raise ValueError("Invalid deleted_files payload: expected a list of absolute paths")

        normalized = {self._validate_absolute_path(path, "deleted_files") for path in deleted_files}
        return sorted(normalized)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def get_settings(self) -> tuple[UserSettings, list[ProviderKeyStatus]]:
        """Return settings and provider key statuses (no raw keys)."""
        settings = await self._get_or_create()
        keys = self._decrypt_keys(settings)
        statuses = [ProviderKeyStatus(provider=p.value, is_set=(p.value in keys)) for p in UserTokenKey]
        return settings, statuses

    async def set_default_model(self, model: Optional[str]) -> UserSettings:
        settings = await self._get_or_create()
        settings.default_model = model
        settings.updated_at = datetime.now(timezone.utc)
        await self._set(_SETTINGS_KEY, settings)
        return settings

    async def set_default_sandbox(self, sandbox: Optional[str]) -> UserSettings:
        if sandbox is not None:
            valid = [e.value for e in SandboxType]
            if sandbox not in valid:
                raise ValueError(f"Invalid sandbox '{sandbox}'. Must be one of: {valid}")
        settings = await self._get_or_create()
        settings.default_sandbox = sandbox
        settings.updated_at = datetime.now(timezone.utc)
        await self._set(_SETTINGS_KEY, settings)
        return settings

    # Mapping: PATCH request key -> entity field name
    _DEFAULTS_FIELD_MAP = {
        "model": "default_model",
        "sandbox": "default_sandbox",
        "tools": "default_tools",
        "mcp": "default_mcp",
        "a2a": "default_a2a",
        "subagents": "default_subagents",
        "model_visibility": "default_model_visibility",
        "files": "default_files",
        "deleted_files": "default_deleted_files",
    }

    async def patch_defaults(self, data: dict) -> UserSettings:
        """Partially update default settings using short key names."""
        if "sandbox" in data and data["sandbox"] is not None:
            valid = [e.value for e in SandboxType]
            if data["sandbox"] not in valid:
                raise ValueError(f"Invalid sandbox '{data['sandbox']}'. Must be one of: {valid}")
        if "files" in data:
            data["files"] = self._normalize_default_files(data["files"])
        if "deleted_files" in data:
            data["deleted_files"] = self._normalize_deleted_files(data["deleted_files"])
        settings = await self._get_or_create()
        for key, value in data.items():
            field = self._DEFAULTS_FIELD_MAP.get(key)
            if field:
                setattr(settings, field, value)
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
