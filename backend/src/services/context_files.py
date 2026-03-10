from __future__ import annotations

from copy import deepcopy
from typing import Any

from langgraph.store.base import BaseStore

from src.repos.user_settings_repo import UserSettingsRepo


async def resolve_context_files(
    *,
    user_id: str | None,
    store: BaseStore,
    memory_files: dict[str, Any] | None,
    explicit_files: dict[str, Any] | None,
) -> dict[str, Any]:
    """Merge memory, persisted settings files, tombstones, and explicit files.

    Precedence is:
    1. explicit request/session files
    2. settings persistent files
    3. memory files
    """

    persisted_files: dict[str, Any] = {}
    deleted_files: set[str] = set()

    if user_id:
        settings_repo = UserSettingsRepo(user_id, store)
        settings = await settings_repo._get_or_create()
        persisted_files = {
            path: file_data.model_dump() if hasattr(file_data, "model_dump") else deepcopy(file_data)
            for path, file_data in (settings.default_files or {}).items()
        }
        deleted_files = set(settings.default_deleted_files or [])

    implicit_files = deepcopy(memory_files or {})
    implicit_files.update(deepcopy(persisted_files))

    for deleted_path in deleted_files:
        implicit_files.pop(deleted_path, None)

    return {
        **implicit_files,
        **deepcopy(explicit_files or {}),
    }
