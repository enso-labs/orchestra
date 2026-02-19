"""Local sandbox backend that runs commands via subprocess."""

from __future__ import annotations

import subprocess
from pathlib import Path
from uuid import uuid4

from deepagents.backends.protocol import (
    ExecuteResponse,
    FileDownloadResponse,
    FileUploadResponse,
)
from deepagents.backends.sandbox import BaseSandbox


class LocalSandbox(BaseSandbox):
    """Local sandbox that executes commands via subprocess in a workspace directory.

    Mirrors the DaytonaSandbox pattern: only ``execute()``, ``id``,
    ``download_files()``, and ``upload_files()`` are implemented here.
    All other file operations (read, write, edit, grep, glob, ls) are
    inherited from ``BaseSandbox`` which routes them through ``execute()``.
    """

    def __init__(self, *, root_dir: str | Path) -> None:
        self._root = Path(root_dir).expanduser().resolve()
        self._root.mkdir(parents=True, exist_ok=True)
        self._id = uuid4().hex
        self._timeout: int = 30 * 60  # 30 minutes, same as DaytonaSandbox

    @property
    def id(self) -> str:
        return self._id

    def execute(self, command: str) -> ExecuteResponse:
        """Execute a shell command in the workspace directory."""
        try:
            result = subprocess.run(
                command,
                shell=True,
                cwd=str(self._root),
                capture_output=True,
                text=True,
                timeout=self._timeout,
            )
            output = result.stdout
            if result.stderr:
                output = output + result.stderr if output else result.stderr
            return ExecuteResponse(
                output=output or "",
                exit_code=result.returncode,
                truncated=False,
            )
        except subprocess.TimeoutExpired:
            return ExecuteResponse(
                output="Command timed out",
                exit_code=124,
                truncated=False,
            )
        except Exception as exc:
            return ExecuteResponse(
                output=str(exc),
                exit_code=1,
                truncated=False,
            )

    def download_files(self, paths: list[str]) -> list[FileDownloadResponse]:
        """Read files from the workspace directory."""
        responses: list[FileDownloadResponse] = []
        for path in paths:
            if not path.startswith("/"):
                responses.append(FileDownloadResponse(path=path, content=None, error="invalid_path"))
                continue
            resolved = self._root / path.lstrip("/")
            if not resolved.is_file():
                responses.append(FileDownloadResponse(path=path, content=None, error="file_not_found"))
                continue
            try:
                content = resolved.read_bytes()
                responses.append(FileDownloadResponse(path=path, content=content, error=None))
            except PermissionError:
                responses.append(FileDownloadResponse(path=path, content=None, error="permission_denied"))
            except Exception:
                responses.append(FileDownloadResponse(path=path, content=None, error="file_not_found"))
        return responses

    def upload_files(self, files: list[tuple[str, bytes]]) -> list[FileUploadResponse]:
        """Write files to the workspace directory."""
        responses: list[FileUploadResponse] = []
        for path, content in files:
            if not path.startswith("/"):
                responses.append(FileUploadResponse(path=path, error="invalid_path"))
                continue
            resolved = self._root / path.lstrip("/")
            try:
                resolved.parent.mkdir(parents=True, exist_ok=True)
                resolved.write_bytes(content)
                responses.append(FileUploadResponse(path=path, error=None))
            except PermissionError:
                responses.append(FileUploadResponse(path=path, error="permission_denied"))
            except Exception:
                responses.append(FileUploadResponse(path=path, error="file_not_found"))
        return responses
