# Proposal: Add File-Watching Reload to TaskIQ Worker

**Agent**: PROCESS_WATCHER
**Issue**: #724
**Date**: 2026-02-01

---

## 1. Executive Summary

TaskIQ v0.12.1 already ships with built-in `--reload` and `--reload-dir` CLI flags that use `watchfiles` under the hood to restart worker processes on file changes. The implementation for this feature is a one-line change to the Makefile `dev.worker` target and a corresponding update to the Docker Compose entrypoint for container-based development.

## 2. Architectural Analysis

### Current State

- **Makefile target** (`backend/Makefile:7`): `uv run taskiq worker src.workers.tasks:broker` -- no reload flag.
- **Docker Compose** (`docker-compose.yml:58`): `entrypoint: ["uv", "run", "taskiq", "worker", "src.workers.tasks:broker"]` -- no reload flag; production service, should NOT reload.
- **Worker lifecycle**: The broker in `src/workers/broker.py` registers `startup` and `shutdown` hooks that initialize/teardown the `WorkerState` singleton (checkpointer). These hooks fire correctly on each worker process restart since TaskIQ's reload mechanism spawns a fresh subprocess.
- **Dev server precedent**: `uvicorn main:app --reload` already provides hot-reload for the API server.

### TaskIQ Reload Internals

TaskIQ's `--reload` flag (present since v0.11+) works as follows:

1. The parent process starts a `watchfiles` filesystem watcher on the specified directories (defaults to cwd).
2. On detected change, it sends SIGTERM to the child worker process.
3. The child receives SIGTERM, runs shutdown hooks (including `WorkerState.shutdown()`), and exits.
4. The parent spawns a new child worker process, which runs startup hooks (including `WorkerState.initialize()`).

This is the same proven pattern that uvicorn uses. No custom watcher code is needed.

### Integration Points

| Component | Impact | Notes |
|-----------|--------|-------|
| `broker.py` startup/shutdown hooks | None | Already gracefully handle init/teardown; fire correctly on subprocess restart |
| `WorkerState` singleton | None | Re-initialized in fresh subprocess; no stale state risk |
| Redis connections in tasks | None | Created per-task; no lifecycle concern |
| `watchfiles` dependency | Already present | Transitive dependency of `uvicorn[standard]` |

## 3. Implementation Strategy

### Step 1: Update Makefile (dev-only reload)

**File**: `backend/Makefile`
**Change**: Add `--reload` flag to `dev.worker` target.

```makefile
# Before
dev.worker:
	@set -a && . ~/.env/orchestra/.env.backend && set +a && uv run taskiq worker src.workers.tasks:broker

# After
dev.worker:
	@set -a && . ~/.env/orchestra/.env.backend && set +a && uv run taskiq worker src.workers.tasks:broker --reload --reload-dir src
```

Scoping `--reload-dir` to `src` avoids unnecessary restarts from changes to tests, migrations, seeds, or other non-runtime files.

### Step 2: (Optional) Add a dedicated dev compose override

If container-based local development is desired, create `docker-compose.override.yml` or a dev profile that adds `--reload` and volume-mounts the source code. The production `docker-compose.yml` must NOT use `--reload`.

**File**: `docker-compose.override.yml` (new, optional)

```yaml
services:
  worker:
    entrypoint: ["uv", "run", "taskiq", "worker", "src.workers.tasks:broker", "--reload", "--reload-dir", "src"]
    volumes:
      - ./backend/src:/app/src
```

### Step 3: Verify `watchfiles` availability

```bash
uv run python -c "import watchfiles; print(watchfiles.__version__)"
```

If not present (unlikely given uvicorn dependency), add `watchfiles>=0.21.0` to the dev dependency group in `pyproject.toml`.

### Summary of File Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `backend/Makefile` | Modify | Add `--reload --reload-dir src` to `dev.worker` |
| `docker-compose.override.yml` | Create (optional) | Dev override with reload + volume mount |
| `backend/pyproject.toml` | Modify (if needed) | Add `watchfiles` to dev deps if not already transitive |

## 4. Design Decisions

### Decision: Use TaskIQ's built-in `--reload` instead of a custom watcher

**Chosen**: Built-in `--reload` flag
**Rejected alternatives**:
- **Custom `watchfiles` wrapper script**: Unnecessary complexity; duplicates existing functionality.
- **`watchdog` + subprocess management**: More flexible but requires significant code for graceful shutdown, signal handling, and edge cases that TaskIQ already handles.
- **`watchmedo` CLI (from watchdog)**: External tool dependency with no advantage over the built-in flag.

**Rationale**: The feature already exists in the installed version of TaskIQ. Writing custom code would be over-engineering.

### Decision: Scope reload directory to `src/`

**Rationale**: Watching the entire `backend/` directory would trigger restarts on test file changes, migration edits, seed data updates, and documentation changes -- all of which are irrelevant to the running worker. Scoping to `src/` provides precise, relevant restarts.

### Decision: Do NOT enable reload in production Docker Compose

**Rationale**: File watching in production is a security and stability risk. The reload mechanism is for development only. Production containers use immutable images.

## 5. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| In-flight task interrupted by reload | Medium | Medium | TaskIQ sends SIGTERM and waits for `shutdown_timeout` (default 5s). Long-running agent tasks may be killed. Developers should be aware that active tasks will not survive a reload. This is acceptable for dev environments. |
| `watchfiles` not installed | Low | Low | Already a transitive dependency of uvicorn. Verify during implementation. |
| Stale worker state after reload | None | N/A | Each reload spawns a fresh subprocess; `WorkerState` re-initializes cleanly via startup hooks. |
| Accidental use of `--reload` in production | Low | High | Reload flag is only in the Makefile (dev tool) and optional override file, not in the production `docker-compose.yml`. |

## 6. Estimated Complexity

- **Size**: **Small** -- The core change is adding two CLI flags to one line in the Makefile.
- **Risk Level**: **Low** -- Uses a built-in, well-tested feature of TaskIQ. No new code paths in the application.
- **Estimated effort**: Under 30 minutes including verification.
