"""Unit tests for prepare_memory_files() helper."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.agents import prepare_memory_files


def _make_search_item(memory_text: str) -> MagicMock:
    """Create a mock SearchItem whose .dict() returns the expected shape."""
    item = MagicMock()
    item.dict.return_value = {"key": "some-key", "value": {"content": memory_text}}
    return item


@pytest.mark.asyncio
class TestPrepareMemoryFilesEmpty:
    """Tests for cases that should return ({}, None)."""

    async def test_returns_empty_when_user_id_is_none(self) -> None:
        memory_svc = MagicMock()
        result = await prepare_memory_files(None, memory_svc)
        assert result == ({}, None)

    async def test_returns_empty_when_user_id_is_empty_string(self) -> None:
        memory_svc = MagicMock()
        result = await prepare_memory_files("", memory_svc)
        assert result == ({}, None)

    async def test_returns_empty_when_search_returns_empty_list(self) -> None:
        memory_svc = MagicMock()
        memory_svc.search = AsyncMock(return_value=[])
        result = await prepare_memory_files("user-123", memory_svc)
        assert result == ({}, None)

    async def test_returns_empty_and_logs_warning_on_exception(self) -> None:
        memory_svc = MagicMock()
        memory_svc.search = AsyncMock(side_effect=RuntimeError("db down"))

        with patch("src.agents.logger") as mock_logger:
            result = await prepare_memory_files("user-123", memory_svc)

        assert result == ({}, None)
        mock_logger.warning.assert_called_once()
        assert "user-123" in mock_logger.warning.call_args[0][0]


@pytest.mark.asyncio
class TestPrepareMemoryFilesWithMemories:
    """Tests for cases that should return populated files_map and sources."""

    async def test_returns_files_map_and_sources_when_memories_exist(self) -> None:
        memories = [
            _make_search_item("Remember to call Bob"),
            _make_search_item("User prefers dark mode"),
        ]
        memory_svc = MagicMock()
        memory_svc.search = AsyncMock(return_value=memories)

        files_map, sources = await prepare_memory_files("user-123", memory_svc)

        assert sources == ["/AGENTS.md"]
        assert "/AGENTS.md" in files_map
        file_data = files_map["/AGENTS.md"]
        assert "content" in file_data
        assert "created_at" in file_data
        assert "modified_at" in file_data

    async def test_formats_memories_as_markdown_bullets(self) -> None:
        memories = [
            _make_search_item("Remember to call Bob"),
            _make_search_item("User prefers dark mode"),
        ]
        memory_svc = MagicMock()
        memory_svc.search = AsyncMock(return_value=memories)

        files_map, _ = await prepare_memory_files("user-123", memory_svc)

        content_lines = files_map["/AGENTS.md"]["content"]
        assert content_lines == [
            "Remember to call Bob",
            "User prefers dark mode",
        ]

    async def test_handles_single_memory(self) -> None:
        memory_svc = MagicMock()
        memory_svc.search = AsyncMock(
            return_value=[_make_search_item("Only one memory")]
        )

        files_map, sources = await prepare_memory_files("user-789", memory_svc)

        assert sources == ["/AGENTS.md"]
        assert files_map["/AGENTS.md"]["content"] == ["Only one memory"]

    async def test_handles_full_memory_repo_value_structure(self) -> None:
        """When value matches the full MemoryRepo structure, content is extracted."""
        item = MagicMock()
        item.dict.return_value = {
            "key": "memory_abc123",
            "value": {
                "id": "memory_abc123",
                "content": "User likes Python over JavaScript",
                "metadata": {},
                "created_at": "2026-02-05T12:00:00",
                "updated_at": "2026-02-05T12:00:00",
            },
        }

        memory_svc = MagicMock()
        memory_svc.search = AsyncMock(return_value=[item])

        files_map, sources = await prepare_memory_files("user-123", memory_svc)

        assert sources == ["/AGENTS.md"]
        assert files_map["/AGENTS.md"]["content"] == [
            "User likes Python over JavaScript"
        ]

    async def test_handles_non_dict_value(self) -> None:
        """When value is not a dict, it should be stringified."""
        item = MagicMock()
        item.dict.return_value = {"key": "k1", "value": "plain string value"}

        memory_svc = MagicMock()
        memory_svc.search = AsyncMock(return_value=[item])

        files_map, sources = await prepare_memory_files("user-123", memory_svc)

        assert sources == ["/AGENTS.md"]
        assert files_map["/AGENTS.md"]["content"] == ["plain string value"]
