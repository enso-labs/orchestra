"""Integration tests for memory edit persistence across sessions.

These tests exercise the full pipeline:
  1. MemoryRepo.create() -> stores a memory in InMemoryStore
  2. prepare_memory_files() -> loads memories and returns original_content
  3. Agent simulates file edits (mutating state["files"])
  4. MemorySyncMiddleware.aafter_agent() -> detects diffs and calls MemoryRepo.update()
  5. MemoryRepo.get() -> confirms the persisted content matches the edit
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from langgraph.store.memory import InMemoryStore

from src.agents import prepare_memory_files
from src.repos.memory_repo import MemoryRepo
from src.services.memory import MemoryService
from src.utils.middleware import MemorySyncMiddleware


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_file_data(content: str) -> dict:
    """Create a FileData-shaped dict from a content string."""
    return {
        "content": content.split("\n") if content else [],
        "created_at": "2026-02-25T00:00:00",
        "modified_at": "2026-02-25T00:00:00",
    }


async def _setup_memory(store: InMemoryStore, user_id: str, path: str, content: str) -> MemoryRepo:
    """Create a MemoryRepo and persist a single memory."""
    repo = MemoryRepo(user_id=user_id, store=store)
    await repo.create(content=content, path=path)
    return repo


async def _prepare_and_build_middleware(
    store: InMemoryStore,
    user_id: str,
    repo: MemoryRepo,
) -> tuple[MemorySyncMiddleware, dict[str, str], list[str]]:
    """Load memories via prepare_memory_files and build a MemorySyncMiddleware.

    Returns (middleware, original_content, memory_sources).
    """
    memory_svc = MemoryService(user_id=user_id, store=store)
    files_map, memory_sources, original_content = await prepare_memory_files(user_id, memory_svc)
    assert memory_sources is not None, "Expected memory_sources to be populated"

    mw = MemorySyncMiddleware(
        memory_repo=repo,
        memory_sources=memory_sources,
        original_content=original_content,
    )
    return mw, original_content, memory_sources


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestMemoryEditPersistence:
    """Create memory -> edit file in state -> verify MemoryRepo updated."""

    async def test_edited_memory_persisted_to_repo(self) -> None:
        """A memory file edited during a session should be written back to MemoryRepo."""
        store = InMemoryStore()
        user_id = "user-integration-1"
        mem_path = "AGENTS.md"

        repo = await _setup_memory(store, user_id, mem_path, "original content")
        mw, original_content, memory_sources = await _prepare_and_build_middleware(store, user_id, repo)

        # Verify original content was loaded correctly
        assert original_content[f"/{mem_path}"] == "original content"

        # Simulate an agent editing the memory file
        state = {
            "files": {
                f"/{mem_path}": _make_file_data("updated content"),
            },
        }
        await mw.aafter_agent(state, MagicMock())

        # Verify the edit was persisted
        persisted = await repo.get(mem_path)
        assert persisted is not None
        assert persisted.content == "updated content"

    async def test_unchanged_memory_not_overwritten(self) -> None:
        """A memory file that was NOT edited should retain its original content."""
        store = InMemoryStore()
        user_id = "user-integration-2"
        mem_path = "AGENTS.md"

        repo = await _setup_memory(store, user_id, mem_path, "original content")
        mw, _, _ = await _prepare_and_build_middleware(store, user_id, repo)

        # State still has original content — no edit
        state = {
            "files": {
                f"/{mem_path}": _make_file_data("original content"),
            },
        }
        await mw.aafter_agent(state, MagicMock())

        persisted = await repo.get(mem_path)
        assert persisted is not None
        assert persisted.content == "original content"


@pytest.mark.asyncio
class TestNonMemoryFilesIgnored:
    """Non-memory file writes should NOT update MemoryRepo."""

    async def test_non_memory_file_does_not_trigger_repo_update(self) -> None:
        """Files not in memory_sources must not cause any MemoryRepo writes."""
        store = InMemoryStore()
        user_id = "user-integration-3"
        mem_path = "AGENTS.md"

        repo = await _setup_memory(store, user_id, mem_path, "original content")
        mw, _, _ = await _prepare_and_build_middleware(store, user_id, repo)

        # State has original memory unchanged, PLUS a non-memory file that changed
        state = {
            "files": {
                f"/{mem_path}": _make_file_data("original content"),
                "/workspace/app.py": _make_file_data("print('hello')"),
            },
        }
        await mw.aafter_agent(state, MagicMock())

        # Memory should be untouched
        persisted = await repo.get(mem_path)
        assert persisted is not None
        assert persisted.content == "original content"

    async def test_only_memory_files_updated_when_both_change(self) -> None:
        """When both memory and non-memory files change, only memory files are synced."""
        store = InMemoryStore()
        user_id = "user-integration-4"
        mem_path = "AGENTS.md"

        repo = await _setup_memory(store, user_id, mem_path, "old memory")
        mw, _, _ = await _prepare_and_build_middleware(store, user_id, repo)

        state = {
            "files": {
                f"/{mem_path}": _make_file_data("new memory"),
                "/workspace/utils.py": _make_file_data("def helper(): pass"),
            },
        }
        await mw.aafter_agent(state, MagicMock())

        # Memory should be updated
        persisted = await repo.get(mem_path)
        assert persisted.content == "new memory"


@pytest.mark.asyncio
class TestMultipleEditsInSession:
    """Multiple memory edits in a single session — final content synced."""

    async def test_multiple_memory_files_all_synced(self) -> None:
        """When multiple memory files are edited, all are persisted."""
        store = InMemoryStore()
        user_id = "user-integration-5"

        repo = MemoryRepo(user_id=user_id, store=store)
        await repo.create(content="old agents", path="AGENTS.md")
        await repo.create(content="old user", path="USER.md")

        memory_svc = MemoryService(user_id=user_id, store=store)
        files_map, memory_sources, original_content = await prepare_memory_files(user_id, memory_svc)

        mw = MemorySyncMiddleware(
            memory_repo=repo,
            memory_sources=memory_sources,
            original_content=original_content,
        )

        state = {
            "files": {
                "/AGENTS.md": _make_file_data("new agents"),
                "/USER.md": _make_file_data("new user"),
            },
        }
        await mw.aafter_agent(state, MagicMock())

        agents = await repo.get("AGENTS.md")
        user = await repo.get("USER.md")
        assert agents.content == "new agents"
        assert user.content == "new user"

    async def test_only_changed_files_synced_in_multi_memory_session(self) -> None:
        """When only some memory files change, unchanged ones are left alone."""
        store = InMemoryStore()
        user_id = "user-integration-6"

        repo = MemoryRepo(user_id=user_id, store=store)
        await repo.create(content="unchanged agents", path="AGENTS.md")
        await repo.create(content="old user", path="USER.md")

        memory_svc = MemoryService(user_id=user_id, store=store)
        files_map, memory_sources, original_content = await prepare_memory_files(user_id, memory_svc)

        mw = MemorySyncMiddleware(
            memory_repo=repo,
            memory_sources=memory_sources,
            original_content=original_content,
        )

        state = {
            "files": {
                "/AGENTS.md": _make_file_data("unchanged agents"),  # same as original
                "/USER.md": _make_file_data("new user"),  # changed
            },
        }
        await mw.aafter_agent(state, MagicMock())

        agents = await repo.get("AGENTS.md")
        user = await repo.get("USER.md")
        assert agents.content == "unchanged agents"
        assert user.content == "new user"

    async def test_final_content_is_what_gets_persisted(self) -> None:
        """The content at the END of the session is what gets written — not intermediate edits."""
        store = InMemoryStore()
        user_id = "user-integration-7"

        repo = await _setup_memory(store, user_id, "AGENTS.md", "v1")
        mw, _, _ = await _prepare_and_build_middleware(store, user_id, repo)

        # aafter_agent sees the final state — "v3" is the last edit
        state = {
            "files": {
                "/AGENTS.md": _make_file_data("v3"),
            },
        }
        await mw.aafter_agent(state, MagicMock())

        persisted = await repo.get("AGENTS.md")
        assert persisted.content == "v3"


@pytest.mark.asyncio
class TestRepoUpdateFailureResilience:
    """MemoryRepo.update() failure must not crash the agent."""

    async def test_update_failure_does_not_raise(self) -> None:
        """If MemoryRepo.update() throws, the middleware swallows the error."""
        store = InMemoryStore()
        user_id = "user-integration-8"

        repo = await _setup_memory(store, user_id, "AGENTS.md", "original")
        mw, _, _ = await _prepare_and_build_middleware(store, user_id, repo)

        # Patch update to fail
        repo.update = AsyncMock(side_effect=RuntimeError("database connection lost"))

        state = {
            "files": {
                "/AGENTS.md": _make_file_data("edited"),
            },
        }

        # Must not raise
        result = await mw.aafter_agent(state, MagicMock())
        assert result is None

    async def test_update_failure_is_logged(self) -> None:
        """When MemoryRepo.update() fails, a warning is logged."""
        store = InMemoryStore()
        user_id = "user-integration-9"

        repo = await _setup_memory(store, user_id, "AGENTS.md", "original")
        mw, _, _ = await _prepare_and_build_middleware(store, user_id, repo)

        repo.update = AsyncMock(side_effect=RuntimeError("timeout"))

        state = {
            "files": {
                "/AGENTS.md": _make_file_data("edited"),
            },
        }

        with patch("src.utils.middleware.logger") as mock_logger:
            await mw.aafter_agent(state, MagicMock())

        mock_logger.warning.assert_called_once()
        assert "Memory sync failed" in mock_logger.warning.call_args[0][0]

    async def test_partial_failure_with_multiple_memories(self) -> None:
        """If the first memory update fails, the exception is caught at the top level."""
        store = InMemoryStore()
        user_id = "user-integration-10"

        repo = MemoryRepo(user_id=user_id, store=store)
        await repo.create(content="old a", path="A.md")
        await repo.create(content="old b", path="B.md")

        memory_svc = MemoryService(user_id=user_id, store=store)
        _, memory_sources, original_content = await prepare_memory_files(user_id, memory_svc)

        mw = MemorySyncMiddleware(
            memory_repo=repo,
            memory_sources=memory_sources,
            original_content=original_content,
        )

        # Make update fail
        repo.update = AsyncMock(side_effect=RuntimeError("disk full"))

        state = {
            "files": {
                "/A.md": _make_file_data("new a"),
                "/B.md": _make_file_data("new b"),
            },
        }

        # Must not raise even though both updates would fail
        result = await mw.aafter_agent(state, MagicMock())
        assert result is None
