import os
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from src.services.prompt.defaults import (
    get_default_system_prompt,
    get_default_system_prompt_path,
    get_default_system_prompt_source,
)


def test_file_source_returns_checked_in_default_prompt(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DEFAULT_SYSTEM_PROMPT_SOURCE", "file")
    monkeypatch.delenv("DEFAULT_SYSTEM_PROMPT_PATH", raising=False)

    expected = (
        get_default_system_prompt_path().read_bytes().decode("utf-8-sig").replace("\r\n", "\n").replace("\r", "\n")
    )

    with patch("src.services.prompt.defaults.fetch_prompt") as mock_fetch_prompt:
        prompt = get_default_system_prompt()

    assert prompt == expected
    mock_fetch_prompt.assert_not_called()


def test_file_source_reloads_when_file_mtime_changes(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    prompt_path = tmp_path / "default.md"
    prompt_path.write_text("first prompt", encoding="utf-8")

    monkeypatch.setenv("DEFAULT_SYSTEM_PROMPT_SOURCE", "file")
    monkeypatch.setenv("DEFAULT_SYSTEM_PROMPT_PATH", str(prompt_path))

    assert get_default_system_prompt() == "first prompt"

    prompt_path.write_text("second prompt", encoding="utf-8")
    stat = prompt_path.stat()
    os.utime(prompt_path, ns=(stat.st_atime_ns, stat.st_mtime_ns + 1_000_000))

    assert get_default_system_prompt() == "second prompt"


def test_langsmith_source_calls_helper_only_when_explicitly_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DEFAULT_SYSTEM_PROMPT_SOURCE", "langsmith")
    monkeypatch.setenv("DEFAULT_SYSTEM_PROMPT_LANGSMITH_NAME", "custom-default")

    with patch(
        "src.services.prompt.defaults.fetch_prompt",
        return_value=SimpleNamespace(content="langsmith prompt"),
    ) as mock_fetch_prompt:
        prompt = get_default_system_prompt()

    assert get_default_system_prompt_source() == "langsmith"
    assert prompt == "langsmith prompt"
    mock_fetch_prompt.assert_called_once_with("custom-default")


def test_invalid_prompt_source_raises_runtime_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DEFAULT_SYSTEM_PROMPT_SOURCE", "invalid")

    with pytest.raises(RuntimeError, match="DEFAULT_SYSTEM_PROMPT_SOURCE"):
        get_default_system_prompt()


def test_missing_prompt_file_raises_runtime_error(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    prompt_path = tmp_path / "missing.md"

    monkeypatch.setenv("DEFAULT_SYSTEM_PROMPT_SOURCE", "file")
    monkeypatch.setenv("DEFAULT_SYSTEM_PROMPT_PATH", str(prompt_path))

    with pytest.raises(RuntimeError, match=str(prompt_path.resolve())):
        get_default_system_prompt()


def test_unreadable_prompt_file_raises_runtime_error(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    prompt_path = tmp_path / "default.md"
    prompt_path.write_text("prompt", encoding="utf-8")

    monkeypatch.setenv("DEFAULT_SYSTEM_PROMPT_SOURCE", "file")
    monkeypatch.setenv("DEFAULT_SYSTEM_PROMPT_PATH", str(prompt_path))

    with (
        patch("pathlib.Path.read_bytes", side_effect=PermissionError("permission denied")),
        pytest.raises(RuntimeError, match="permission denied"),
    ):
        get_default_system_prompt()
