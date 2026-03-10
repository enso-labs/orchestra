from langgraph.store.memory import InMemoryStore

import pytest

from src.repos.user_settings_repo import UserSettingsRepo
from src.services.context_files import resolve_context_files


@pytest.mark.asyncio
async def test_settings_override_memory_by_path():
    store = InMemoryStore()
    repo = UserSettingsRepo("user-1", store)
    await repo.patch_defaults(
        {
            "files": {
                "/shared.md": {
                    "content": ["settings"],
                }
            }
        }
    )

    resolved = await resolve_context_files(
        user_id="user-1",
        store=store,
        memory_files={"/shared.md": {"content": ["memory"]}, "/memory.md": {"content": ["keep"]}},
        explicit_files=None,
    )

    assert resolved["/shared.md"]["content"] == ["settings"]
    assert resolved["/memory.md"]["content"] == ["keep"]


@pytest.mark.asyncio
async def test_tombstones_remove_implicit_files():
    store = InMemoryStore()
    repo = UserSettingsRepo("user-1", store)
    await repo.patch_defaults({"deleted_files": ["/memory.md"]})

    resolved = await resolve_context_files(
        user_id="user-1",
        store=store,
        memory_files={"/memory.md": {"content": ["memory"]}},
        explicit_files=None,
    )

    assert "/memory.md" not in resolved


@pytest.mark.asyncio
async def test_explicit_files_override_tombstones():
    store = InMemoryStore()
    repo = UserSettingsRepo("user-1", store)
    await repo.patch_defaults({"deleted_files": ["/memory.md"]})

    resolved = await resolve_context_files(
        user_id="user-1",
        store=store,
        memory_files={"/memory.md": {"content": ["memory"]}},
        explicit_files={"/memory.md": {"content": ["explicit"]}},
    )

    assert resolved["/memory.md"]["content"] == ["explicit"]


@pytest.mark.asyncio
async def test_empty_settings_preserve_existing_memory_behavior():
    store = InMemoryStore()

    resolved = await resolve_context_files(
        user_id="user-1",
        store=store,
        memory_files={"/memory.md": {"content": ["memory"]}},
        explicit_files=None,
    )

    assert resolved == {"/memory.md": {"content": ["memory"]}}
