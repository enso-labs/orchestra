#!/usr/bin/env python3
"""Fail-closed static gate for the single Aegra runtime.

The scan reads Git's tracked plus non-ignored untracked file set and adds the
built frontend tree explicitly (build output is commonly ignored). Historical
changelog/task artifacts are an explicit allowlist; active source, tests,
config, docs, lockfiles, and assets are not exempt.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
HISTORICAL_PREFIXES = (".oh/tasks/", "evals/")
HISTORICAL_FILES = {"Changelog.md"}
ALLOWLIST_FILES = {"backend/scripts/cutover_static_scan.py"}
SKIP_DIRS = {".git", ".venv", "node_modules", ".pnpm", "__pycache__"}

FORBIDDEN = (
    re.compile(r"taskiq", re.IGNORECASE),
    re.compile(r"DISTRIBUTED_WORKERS"),
    re.compile(r"run_agent_stream"),
    re.compile(r"extract_trajectory"),
    re.compile(r"(?:src\.)?workers\.tasks"),
    re.compile(r"src\.controllers\.llm"),
    re.compile(r"src\.utils\.stream"),
    re.compile(r"src\.services\.(?:abort|idempotency|checkpoint_resilient|schedule)"),
    re.compile(r"src\.routes\.v0\.(?:llm|thread|schedule)"),
    re.compile(r"/(?:api/)?llm/(?:stream|invoke)"),
    re.compile(r"(?:SyncStreamSource|DistributedStreamSource|fetchStreamReader|streamThread|initiateStream)"),
    re.compile(r"(?:\bDLQ\b|dead[- ]letter)", re.IGNORECASE),
    re.compile(r":2026\b"),
    re.compile(r"VITE_USE_AGENT_PROTOCOL"),
    re.compile(r"continue-on-error"),
    re.compile(r"docker-compose\.aegra|aegra\.Dockerfile|(?:Aegra|aegra) sidecar", re.IGNORECASE),
)


def git_files() -> set[Path]:
    result = subprocess.run(
        ["git", "-C", str(REPO), "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        check=True,
        capture_output=True,
    )
    paths = {REPO / raw.decode() for raw in result.stdout.split(b"\0") if raw}
    built = REPO / "backend" / "src" / "public"
    if built.is_dir():
        paths.update(path for path in built.rglob("*") if path.is_file())
    return {path for path in paths if path.is_file()}


def is_historical(path: Path) -> bool:
    relative = path.relative_to(REPO).as_posix()
    return relative in HISTORICAL_FILES or relative in ALLOWLIST_FILES or relative.startswith(HISTORICAL_PREFIXES)


def should_scan(path: Path) -> bool:
    if is_historical(path):
        return False
    return not any(part in SKIP_DIRS for part in path.relative_to(REPO).parts)


def scan() -> list[tuple[str, int, str]]:
    findings: list[tuple[str, int, str]] = []
    for path in sorted(filter(should_scan, git_files())):
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        for line_number, line in enumerate(text.splitlines(), 1):
            for pattern in FORBIDDEN:
                if pattern.search(line):
                    findings.append((path.relative_to(REPO).as_posix(), line_number, line.strip()))
                    break
    return findings


def main() -> int:
    findings = scan()
    if findings:
        print("single-runtime static scan: FAIL")
        for path, line_number, line in findings:
            print(f"{path}:{line_number}: {line}")
        return 1

    compose = (REPO / "infra/docker-compose.yml").read_text(encoding="utf-8")
    if compose.count("\n    app:") != 1 or "\n    worker:" in compose:
        print("single-runtime static scan: FAIL (Compose runtime inventory)")
        return 1

    print(
        "single-runtime static scan: PASS "
        f"({len(git_files())} tracked/untracked files, built assets included; "
        "historical allowlist: Changelog.md, .oh/tasks/**, and evals/**)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
