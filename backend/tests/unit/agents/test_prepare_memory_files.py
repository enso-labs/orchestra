"""Unit tests for prepare_memory_files() helper."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.agents import prepare_memory_files


def _make_search_item(memory_text: str, mem_id: str = "AGENTS.md", enabled: bool = True) -> MagicMock:
    """Create a mock SearchItem whose .dict() returns the expected shape."""
    item = MagicMock()
    item.dict.return_value = {
        "key": mem_id,
        "value": {
            "id": mem_id,
            "content": memory_text,
            "enabled": enabled,
        },
    }
    return item


@pytest.mark.asyncio
class TestPrepareMemoryFilesEmpty:
    """Tests for cases that should return ({}, None, {})."""

    async def test_returns_empty_when_user_id_is_none(self) -> None:
        memory_svc = MagicMock()
        result = await prepare_memory_files(None, memory_svc)
        assert result == ({}, None, {})

    async def test_returns_empty_when_user_id_is_empty_string(self) -> None:
        memory_svc = MagicMock()
        result = await prepare_memory_files("", memory_svc)
        assert result == ({}, None, {})

    async def test_returns_empty_when_search_returns_empty_list(self) -> None:
        memory_svc = MagicMock()
        memory_svc.search = AsyncMock(return_value=[])
        result = await prepare_memory_files("user-123", memory_svc)
        assert result == ({}, None, {})

    async def test_returns_empty_and_logs_warning_on_exception(self) -> None:
        memory_svc = MagicMock()
        memory_svc.search = AsyncMock(side_effect=RuntimeError("db down"))

        with patch("src.agents.logger") as mock_logger:
            result = await prepare_memory_files("user-123", memory_svc)

        assert result == ({}, None, {})
        mock_logger.warning.assert_called_once()
        assert "user-123" in mock_logger.warning.call_args[0][0]


@pytest.mark.asyncio
class TestPrepareMemoryFilesWithMemories:
    """Tests for cases that should return populated files_map, sources, and original_content."""

    async def test_returns_separate_files_per_memory(self) -> None:
        memories = [
            _make_search_item("Remember to call Bob", mem_id="AGENTS.md"),
            _make_search_item("User prefers dark mode", mem_id="USER.md"),
        ]
        memory_svc = MagicMock()
        memory_svc.search = AsyncMock(return_value=memories)

        files_map, sources, original_content = await prepare_memory_files("user-123", memory_svc)

        assert "/AGENTS.md" in files_map
        assert "/USER.md" in files_map
        assert "/AGENTS.md" in sources
        assert "/USER.md" in sources
        assert len(sources) == 2

    async def test_file_data_has_required_keys(self) -> None:
        memories = [_make_search_item("test content", mem_id="AGENTS.md")]
        memory_svc = MagicMock()
        memory_svc.search = AsyncMock(return_value=memories)

        files_map, _, _ = await prepare_memory_files("user-123", memory_svc)

        file_data = files_map["/AGENTS.md"]
        assert "content" in file_data
        assert "created_at" in file_data
        assert "modified_at" in file_data

    async def test_formats_memory_content(self) -> None:
        memories = [
            _make_search_item("Remember to call Bob", mem_id="AGENTS.md"),
        ]
        memory_svc = MagicMock()
        memory_svc.search = AsyncMock(return_value=memories)

        files_map, _, _ = await prepare_memory_files("user-123", memory_svc)

        content_lines = files_map["/AGENTS.md"]["content"]
        assert content_lines == ["Remember to call Bob"]

    async def test_handles_single_memory(self) -> None:
        memory_svc = MagicMock()
        memory_svc.search = AsyncMock(return_value=[_make_search_item("Only one memory", mem_id="NOTES.md")])

        files_map, sources, original_content = await prepare_memory_files("user-789", memory_svc)

        assert sources == ["/NOTES.md"]
        assert files_map["/NOTES.md"]["content"] == ["Only one memory"]

    async def test_skips_disabled_memories(self) -> None:
        memories = [
            _make_search_item("enabled content", mem_id="AGENTS.md", enabled=True),
            _make_search_item("disabled content", mem_id="USER.md", enabled=False),
        ]
        memory_svc = MagicMock()
        memory_svc.search = AsyncMock(return_value=memories)

        files_map, sources, original_content = await prepare_memory_files("user-123", memory_svc)

        assert "/AGENTS.md" in files_map
        assert "/USER.md" not in files_map
        assert sources == ["/AGENTS.md"]

    async def test_returns_none_sources_when_all_disabled(self) -> None:
        memories = [
            _make_search_item("disabled", mem_id="AGENTS.md", enabled=False),
        ]
        memory_svc = MagicMock()
        memory_svc.search = AsyncMock(return_value=memories)

        files_map, sources, original_content = await prepare_memory_files("user-123", memory_svc)

        assert files_map == {}
        assert sources is None
        assert original_content == {}

    async def test_handles_full_memory_repo_value_structure(self) -> None:
        """When value matches the full MemoryRepo structure, content is extracted."""
        item = MagicMock()
        item.dict.return_value = {
            "key": "AGENTS.md",
            "value": {
                "id": "AGENTS.md",
                "content": "User likes Python over JavaScript",
                "enabled": True,
                "metadata": {},
                "created_at": "2026-02-05T12:00:00",
                "updated_at": "2026-02-05T12:00:00",
            },
        }

        memory_svc = MagicMock()
        memory_svc.search = AsyncMock(return_value=[item])

        files_map, sources, original_content = await prepare_memory_files("user-123", memory_svc)

        assert sources == ["/AGENTS.md"]
        assert files_map["/AGENTS.md"]["content"] == ["User likes Python over JavaScript"]

    async def test_handles_non_dict_value(self) -> None:
        """When value is not a dict, it should be stringified."""
        item = MagicMock()
        item.dict.return_value = {"key": "k1", "value": "plain string value"}

        memory_svc = MagicMock()
        memory_svc.search = AsyncMock(return_value=[item])

        files_map, sources, original_content = await prepare_memory_files("user-123", memory_svc)

        assert sources == ["/AGENTS.md"]
        assert files_map["/AGENTS.md"]["content"] == ["plain string value"]


@pytest.mark.asyncio
class TestPrepareMemoryFilesOriginalContent:
    """Tests for the original_content dict returned as the third element."""

    async def test_original_content_maps_path_to_raw_string(self) -> None:
        memories = [
            _make_search_item("Remember to call Bob", mem_id="AGENTS.md"),
            _make_search_item("User prefers dark mode", mem_id="USER.md"),
        ]
        memory_svc = MagicMock()
        memory_svc.search = AsyncMock(return_value=memories)

        _, _, original_content = await prepare_memory_files("user-123", memory_svc)

        assert original_content == {
            "/AGENTS.md": "Remember to call Bob",
            "/USER.md": "User prefers dark mode",
        }

    async def test_original_content_empty_when_all_disabled(self) -> None:
        memories = [
            _make_search_item("disabled", mem_id="AGENTS.md", enabled=False),
        ]
        memory_svc = MagicMock()
        memory_svc.search = AsyncMock(return_value=memories)

        _, _, original_content = await prepare_memory_files("user-123", memory_svc)

        assert original_content == {}

    async def test_original_content_excludes_disabled_memories(self) -> None:
        memories = [
            _make_search_item("enabled content", mem_id="AGENTS.md", enabled=True),
            _make_search_item("disabled content", mem_id="USER.md", enabled=False),
        ]
        memory_svc = MagicMock()
        memory_svc.search = AsyncMock(return_value=memories)

        _, _, original_content = await prepare_memory_files("user-123", memory_svc)

        assert "/AGENTS.md" in original_content
        assert "/USER.md" not in original_content

    async def test_original_content_for_non_dict_value(self) -> None:
        item = MagicMock()
        item.dict.return_value = {"key": "k1", "value": "plain string value"}

        memory_svc = MagicMock()
        memory_svc.search = AsyncMock(return_value=[item])

        _, _, original_content = await prepare_memory_files("user-123", memory_svc)

        assert original_content == {"/AGENTS.md": "plain string value"}
