# Proposal: Add File-Watching Reload to TaskIQ Worker

**Author:** DEVOPS_ARCHITECT (Agent 2)
**Issue:** #724
**Date:** 2026-02-01

---

## 1. Executive Summary

TaskIQ already ships with `--reload` and `--reload-dir` CLI flags, mirroring uvicorn's reload behavior. The implementation is straightforward: add these flags to every invocation point (Makefile, docker-compose, scripts) gated behind a dev-vs-prod distinction so production workers never restart on filesystem events.

The total change surface is approximately 3-4 files, with no new dependencies required.

## 2. Architectural Analysis

### Current State

| Invocation Point | Location | Command |
|---|---|---|
| Local dev | `backend/Makefile` (`dev.worker`) | `uv run taskiq worker src.workers.tasks:broker` |
| Docker prod | `docker-compose.yml` (line 58) | `entrypoint: ["uv", "run", "taskiq", "worker", "src.workers.tasks:broker"]` |

The dev server (`make dev`) already uses `uvicorn --reload`. The worker has no equivalent, forcing developers to manually restart the worker process after code changes.

### TaskIQ Built-in Reload Support

TaskIQ's CLI natively supports:

```
--reload              Enable auto-reload on file changes
--reload-dir DIRS     Directories to watch (defaults to cwd)
--do-not-use-gitignore  Watch files even if gitignored
```

This uses `watchdog` internally (already a transitive dependency of taskiq). No additional packages are needed.

### Key Constraint

The worker's `on_startup` hook initializes `WorkerState` (persistent checkpointer). A reload will trigger `on_shutdown` then `on_startup`, which correctly tears down and re-initializes this state. This is safe for development but adds latency per reload cycle (~1-2s for DB reconnection).

## 3. Implementation Strategy

### 3.1 Makefile Change

**File:** `backend/Makefile`

```makefile
# Current
dev.worker:
	@set -a && . ~/.env/orchestra/.env.backend && set +a && uv run taskiq worker src.workers.tasks:broker

# Proposed
dev.worker:
	@set -a && . ~/.env/orchestra/.env.backend && set +a && \
	uv run taskiq worker src.workers.tasks:broker --reload --reload-dir src
```

Adding `--reload-dir src` scopes the watcher to only the application source, avoiding spurious reloads from `.venv`, `migrations`, test files, or data directories.

### 3.2 Docker Compose Dev Override

**New file:** `docker-compose.dev.yml`

```yaml
services:
  worker:
    entrypoint:
      [
        "uv", "run", "taskiq", "worker", "src.workers.tasks:broker",
        "--reload", "--reload-dir", "src"
      ]
    volumes:
      - ./backend/src:/app/src
    deploy:
      replicas: 1
```

Usage: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up worker`

The volume mount enables the container to see host filesystem changes. The production `docker-compose.yml` remains unchanged (no reload, no volume mount, baked image).

### 3.3 Makefile Targets for Docker

**File:** `backend/Makefile` (or root Makefile if one exists)

```makefile
# Add convenience targets
docker.dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up

docker.prod:
	docker compose up
```

### 3.4 Environment Variable Alternative (Optional)

If the team prefers a single compose file with conditional behavior, use an environment variable instead of an override file:

**In `docker-compose.yml`:**

```yaml
worker:
  entrypoint: >-
    sh -c "uv run taskiq worker src.workers.tasks:broker
    $${WORKER_RELOAD:+--reload --reload-dir src}"
```

Set `WORKER_RELOAD=1` in `.env` for dev, omit for prod. However, the override file approach (3.2) is cleaner and more explicit.

## 4. Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Use TaskIQ built-in `--reload` | Yes | Zero new dependencies, proven mechanism, consistent with uvicorn pattern |
| Scope watch to `src/` only | Yes | Avoids reload storms from venv, migrations, data dirs |
| Docker override file vs env var | Override file | Explicit dev/prod separation; no shell interpolation in entrypoint |
| Modify production compose | No | Production workers must never auto-reload; keep the change isolated to dev paths |
| Add `watchdog` dependency | Not needed | Already a transitive dependency of `taskiq[reload]`; verify with `uv pip show watchdog` |

## 5. Risk Assessment

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| Reload during active task execution causes data loss | Medium | Low | TaskIQ's reload waits for the current task to finish before restarting the worker process (graceful shutdown via SIGTERM) |
| `watchdog` missing in container image | Low | Low | Verify `watchdog` is installed; if not, add to `pyproject.toml` dev dependencies |
| Frequent reloads during rapid saves (reload storms) | Low | Medium | TaskIQ debounces file events internally; `--reload-dir src` further limits scope |
| Volume mount performance on macOS Docker | Low | Medium | Only affects Docker-based dev; most developers use `make dev.worker` locally |
| Worker state (checkpointer) corruption on reload | Low | Low | `on_shutdown`/`on_startup` hooks handle teardown and re-init correctly |

## 6. Estimated Complexity

| Item | Effort |
|---|---|
| Makefile `dev.worker` update | 5 minutes |
| `docker-compose.dev.yml` creation | 15 minutes |
| Docker Makefile targets | 5 minutes |
| Testing local reload | 15 minutes |
| Testing Docker reload | 15 minutes |
| Documentation update (README) | 10 minutes |
| **Total** | **~1 hour** |

This is a low-risk, low-effort change that uses existing built-in functionality. No custom file-watcher scripts, no new dependencies, and no changes to production infrastructure.

## 7. Files Changed Summary

| File | Action | Description |
|---|---|---|
| `backend/Makefile` | Modify | Add `--reload --reload-dir src` to `dev.worker` target |
| `docker-compose.dev.yml` | Create | Dev override with reload flags and volume mount |
| `backend/Makefile` or root Makefile | Modify | Add `docker.dev` / `docker.prod` convenience targets |
