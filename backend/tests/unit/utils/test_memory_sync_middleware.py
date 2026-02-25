"""Unit tests for MemorySyncMiddleware."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.utils.middleware import MemorySyncMiddleware


def _make_file_data(content: str) -> dict:
    """Create a FileData-shaped dict from a content string."""
    return {
        "content": content.split("\n") if content else [],
        "created_at": "2026-02-25T00:00:00",
        "modified_at": "2026-02-25T00:00:00",
    }


def _make_memory_repo(**overrides) -> MagicMock:
    """Create a mock MemoryRepo with an async update method."""
    repo = MagicMock()
    repo.update = AsyncMock(**overrides)
    return repo


@pytest.mark.asyncio
class TestMemorySyncMiddlewareBasic:
    """Basic construction and no-op cases."""

    async def test_no_changes_does_not_call_update(self) -> None:
        repo = _make_memory_repo()
        mw = MemorySyncMiddleware(
            memory_repo=repo,
            memory_sources=["/AGENTS.md"],
            original_content={"/AGENTS.md": "hello"},
        )
        state = {"files": {"/AGENTS.md": _make_file_data("hello")}}

        await mw.aafter_agent(state, MagicMock())

        repo.update.assert_not_called()

    async def test_empty_memory_sources_does_not_call_update(self) -> None:
        repo = _make_memory_repo()
        mw = MemorySyncMiddleware(
            memory_repo=repo,
            memory_sources=[],
            original_content={},
        )
        state = {"files": {"/AGENTS.md": _make_file_data("hello")}}

        await mw.aafter_agent(state, MagicMock())

        repo.update.assert_not_called()

    async def test_missing_file_in_state_does_not_call_update(self) -> None:
        repo = _make_memory_repo()
        mw = MemorySyncMiddleware(
            memory_repo=repo,
            memory_sources=["/AGENTS.md"],
            original_content={"/AGENTS.md": "hello"},
        )
        state = {"files": {}}

        await mw.aafter_agent(state, MagicMock())

        repo.update.assert_not_called()

    async def test_no_files_key_in_state_does_not_crash(self) -> None:
        repo = _make_memory_repo()
        mw = MemorySyncMiddleware(
            memory_repo=repo,
            memory_sources=["/AGENTS.md"],
            original_content={"/AGENTS.md": "hello"},
        )
        state = {}

        await mw.aafter_agent(state, MagicMock())

        repo.update.assert_not_called()


@pytest.mark.asyncio
class TestMemorySyncMiddlewareChangedFiles:
    """Cases where memory files have been modified."""

    async def test_changed_file_triggers_update(self) -> None:
        repo = _make_memory_repo()
        mw = MemorySyncMiddleware(
            memory_repo=repo,
            memory_sources=["/AGENTS.md"],
            original_content={"/AGENTS.md": "original content"},
        )
        state = {"files": {"/AGENTS.md": _make_file_data("updated content")}}

        await mw.aafter_agent(state, MagicMock())

        repo.update.assert_awaited_once_with(memory_id="AGENTS.md", content="updated content")

    async def test_multiple_changed_files_trigger_multiple_updates(self) -> None:
        repo = _make_memory_repo()
        mw = MemorySyncMiddleware(
            memory_repo=repo,
            memory_sources=["/AGENTS.md", "/USER.md"],
            original_content={"/AGENTS.md": "old a", "/USER.md": "old b"},
        )
        state = {
            "files": {
                "/AGENTS.md": _make_file_data("new a"),
                "/USER.md": _make_file_data("new b"),
            }
        }

        await mw.aafter_agent(state, MagicMock())

        assert repo.update.await_count == 2
        calls = {c.kwargs["memory_id"]: c.kwargs["content"] for c in repo.update.await_args_list}
        assert calls["AGENTS.md"] == "new a"
        assert calls["USER.md"] == "new b"

    async def test_only_changed_files_are_synced(self) -> None:
        repo = _make_memory_repo()
        mw = MemorySyncMiddleware(
            memory_repo=repo,
            memory_sources=["/AGENTS.md", "/USER.md"],
            original_content={"/AGENTS.md": "same", "/USER.md": "old"},
        )
        state = {
            "files": {
                "/AGENTS.md": _make_file_data("same"),
                "/USER.md": _make_file_data("new"),
            }
        }

        await mw.aafter_agent(state, MagicMock())

        repo.update.assert_awaited_once_with(memory_id="USER.md", content="new")

    async def test_multiline_content_joined_correctly(self) -> None:
        repo = _make_memory_repo()
        original = "line1\nline2\nline3"
        mw = MemorySyncMiddleware(
            memory_repo=repo,
            memory_sources=["/NOTES.md"],
            original_content={"/NOTES.md": original},
        )
        new_content = "line1\nline2\nline3\nline4"
        state = {"files": {"/NOTES.md": _make_file_data(new_content)}}

        await mw.aafter_agent(state, MagicMock())

        repo.update.assert_awaited_once_with(memory_id="NOTES.md", content=new_content)


@pytest.mark.asyncio
class TestMemorySyncMiddlewareNonMemoryFiles:
    """Non-memory files must NOT be synced."""

    async def test_non_memory_file_changes_are_ignored(self) -> None:
        repo = _make_memory_repo()
        mw = MemorySyncMiddleware(
            memory_repo=repo,
            memory_sources=["/AGENTS.md"],
            original_content={"/AGENTS.md": "hello"},
        )
        state = {
            "files": {
                "/AGENTS.md": _make_file_data("hello"),
                "/other/file.py": _make_file_data("print('changed')"),
            }
        }

        await mw.aafter_agent(state, MagicMock())

        repo.update.assert_not_called()


@pytest.mark.asyncio
class TestMemorySyncMiddlewareErrorHandling:
    """Errors in sync must be logged but not raised."""

    async def test_update_failure_does_not_raise(self) -> None:
        repo = _make_memory_repo(side_effect=RuntimeError("db down"))
        mw = MemorySyncMiddleware(
            memory_repo=repo,
            memory_sources=["/AGENTS.md"],
            original_content={"/AGENTS.md": "old"},
        )
        state = {"files": {"/AGENTS.md": _make_file_data("new")}}

        # Should not raise
        result = await mw.aafter_agent(state, MagicMock())

        assert result is None

    async def test_update_failure_is_logged(self) -> None:
        repo = _make_memory_repo(side_effect=RuntimeError("db down"))
        mw = MemorySyncMiddleware(
            memory_repo=repo,
            memory_sources=["/AGENTS.md"],
            original_content={"/AGENTS.md": "old"},
        )
        state = {"files": {"/AGENTS.md": _make_file_data("new")}}

        with patch("src.utils.middleware.logger") as mock_logger:
            result = await mw.aafter_agent(state, MagicMock())

        assert result is None
        mock_logger.warning.assert_called_once()
        assert "Memory sync failed" in mock_logger.warning.call_args[0][0]

    async def test_partial_failure_does_not_sync_remaining(self) -> None:
        """If update fails on first file, subsequent files are also skipped (caught at top level)."""
        repo = _make_memory_repo(side_effect=RuntimeError("db down"))
        mw = MemorySyncMiddleware(
            memory_repo=repo,
            memory_sources=["/A.md", "/B.md"],
            original_content={"/A.md": "old_a", "/B.md": "old_b"},
        )
        state = {
            "files": {
                "/A.md": _make_file_data("new_a"),
                "/B.md": _make_file_data("new_b"),
            }
        }

        # Should not raise even though update fails
        result = await mw.aafter_agent(state, MagicMock())
        assert result is None


@pytest.mark.asyncio
class TestMemorySyncMiddlewareReturnValue:
    """The middleware should always return None (no state updates needed)."""

    async def test_returns_none_on_changes(self) -> None:
        repo = _make_memory_repo()
        mw = MemorySyncMiddleware(
            memory_repo=repo,
            memory_sources=["/AGENTS.md"],
            original_content={"/AGENTS.md": "old"},
        )
        state = {"files": {"/AGENTS.md": _make_file_data("new")}}

        result = await mw.aafter_agent(state, MagicMock())

        assert result is None

    async def test_returns_none_on_no_changes(self) -> None:
        repo = _make_memory_repo()
        mw = MemorySyncMiddleware(
            memory_repo=repo,
            memory_sources=["/AGENTS.md"],
            original_content={"/AGENTS.md": "same"},
        )
        state = {"files": {"/AGENTS.md": _make_file_data("same")}}

        result = await mw.aafter_agent(state, MagicMock())

        assert result is None
