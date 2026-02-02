# PRD: Add File-Watching Reload to TaskIQ Worker

**Issue:** #724
**Branch:** feat/724-add-watcher-to-worker-reload
**Date:** 2026-02-01

## Overview

Add auto-reload capability to the TaskIQ worker for development, mirroring uvicorn's `--reload` behavior. TaskIQ already has native `--reload` and `--reload-dir` CLI flags built in (v0.12.1). The implementation requires updating the Makefile dev target and verifying the watcher dependency.

## User Stories

### US-001: Verify and Add Watcher Dependency
**As a** developer,
**I want** the watcher dependency to be available in the backend environment,
**So that** the TaskIQ `--reload` flag works correctly.

**Acceptance Criteria:**
- [ ] Check if `watchdog` or `watchfiles` is importable in the backend venv
- [ ] If neither is present, add `watchdog` to dev dependencies in `backend/pyproject.toml`
- [ ] Typecheck passes

**Files:** `backend/pyproject.toml`
**Priority:** 1

### US-002: Update Makefile dev.worker Target with Reload Flag
**As a** developer running Ralph autonomous loops,
**I want** the TaskIQ worker to automatically reload when Python source files change,
**So that** code changes are immediately reflected without manual worker restarts.

**Acceptance Criteria:**
- [ ] `backend/Makefile` `dev.worker` target includes `--reload --reload-dir src`
- [ ] Production `docker-compose.yml` worker entrypoint is NOT modified
- [ ] Typecheck passes

**Files:** `backend/Makefile`
**Priority:** 2

### US-003: Verify Reload Behavior Works End-to-End
**As a** developer,
**I want** to confirm the worker restarts when source files change,
**So that** I can trust the reload mechanism works correctly.

**Acceptance Criteria:**
- [ ] Worker starts successfully with `make dev.worker` (or equivalent command)
- [ ] Worker lifecycle hooks (startup/shutdown) fire correctly on reload
- [ ] Existing tests pass (`make test`)
- [ ] Formatting is clean (`make format`)

**Files:** None (verification only)
**Priority:** 3
