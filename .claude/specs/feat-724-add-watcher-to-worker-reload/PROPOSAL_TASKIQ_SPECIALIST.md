# Proposal: Add File-Watching Reload to TaskIQ Worker

**Author:** AGENT_3 -- TASKIQ_SPECIALIST
**Issue:** #724
**Date:** 2026-02-01

---

## 1. Executive Summary

TaskIQ already ships with native `--reload` and `--reload-dir` support built into its CLI. The implementation is straightforward: add these flags to the existing `dev.worker` Makefile target. No custom file-watcher code is needed.

The `--reload` flag uses `watchdog` under the hood (bundled with taskiq) to monitor Python files for changes and gracefully restart worker processes when modifications are detected.

**Recommendation:** Use the native flags. Total effort is minimal -- a one-line Makefile change plus optional configuration.

---

## 2. Architectural Analysis

### 2.1 Current Worker Startup

The worker is started via:

```
# backend/Makefile, line 6-7
dev.worker:
    @set -a && . ~/.env/orchestra/.env.backend && set +a && uv run taskiq worker src.workers.tasks:broker
```

### 2.2 TaskIQ Native Reload Mechanism

From the CLI help output, TaskIQ provides:

| Flag | Description |
|------|-------------|
| `--reload` | Enables file-watching auto-reload |
| `--reload-dir RELOAD_DIRS` | Directories to watch (can be specified multiple times) |
| `--do-not-use-gitignore` | Disables `.gitignore`-based exclusion from the watcher |
| `--shutdown-timeout SHUTDOWN_TIMEOUT` | Grace period for in-flight tasks before forced kill |

When `--reload` is active, TaskIQ runs the worker subprocess under a parent process that monitors the filesystem. On detecting a change, the parent sends SIGTERM to the worker child, waits for `shutdown-timeout`, then spawns a fresh worker process. This is architecturally identical to how uvicorn's `--reload` works.

### 2.3 Worker Lifecycle Hooks

The codebase has startup/shutdown hooks in `backend/src/workers/broker.py`:

- **`on_startup`**: Initializes `WorkerState` (resilient checkpointer singleton)
- **`on_shutdown`**: Calls `WorkerState.shutdown()` (closes DB connections)

These hooks fire correctly on each reload cycle because TaskIQ triggers a full worker process restart. The shutdown hook runs before the old process exits, and the startup hook runs when the new process initializes.

### 2.4 WorkerState Singleton

`WorkerState` in `backend/src/workers/state.py` uses class-level attributes (`_instance`, `_checkpointer`, `_initialized`). Since each reload creates a fresh process, these singletons are naturally reset. No code changes are required.

---

## 3. Implementation Strategy

### 3.1 Phase 1: Makefile Change (Required)

Update `backend/Makefile`:

```makefile
dev.worker:
	@set -a && . ~/.env/orchestra/.env.backend && set +a && \
	uv run taskiq worker src.workers.tasks:broker --reload --reload-dir src
```

Key choices:
- `--reload-dir src` scopes watching to `backend/src/` only, avoiding unnecessary restarts from test file changes, migrations, etc.
- No `--do-not-use-gitignore` needed; the default gitignore-aware behavior is correct since `__pycache__`, `.venv`, etc. should be excluded.

### 3.2 Phase 2: Shutdown Timeout Tuning (Optional)

If agent tasks are long-running (they can be -- `run_agent_stream` streams LLM output), consider:

```makefile
dev.worker:
	@set -a && . ~/.env/orchestra/.env.backend && set +a && \
	uv run taskiq worker src.workers.tasks:broker --reload --reload-dir src --shutdown-timeout 10
```

The default shutdown timeout in TaskIQ is 5 seconds. For development, 10 seconds gives more breathing room for in-flight tasks to complete gracefully.

### 3.3 Phase 3: Watchdog Dependency (Verify)

TaskIQ's reload feature requires `watchdog`. Check if it is already installed:

```bash
uv run pip show watchdog
```

If not present, it may need to be added to `pyproject.toml` as a dev dependency, or taskiq may bundle it. TaskIQ typically declares `watchdog` as an optional dependency in its `[reload]` extra:

```bash
uv add --dev watchdog
```

Or if taskiq provides an extra:

```bash
uv add "taskiq[reload]"
```

---

## 4. Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Custom watcher vs native | Native `--reload` | Zero custom code, battle-tested, consistent with uvicorn pattern the team already uses |
| Watch scope | `--reload-dir src` | Avoids spurious restarts from test/migration/config changes |
| Shutdown timeout | 10s (dev) | Balances fast reload with graceful task completion |
| Production reload | Disabled | `--reload` is dev-only; production workers should be restarted via deployment pipeline |

---

## 5. Risk Assessment

### 5.1 In-Flight Tasks During Reload

**Risk: MEDIUM (dev only)**

When a reload triggers, TaskIQ sends SIGTERM to the worker. If a `run_agent_stream` task is mid-execution:

- The Redis stream will have a partial result (no `done` marker)
- The client SSE listener will timeout waiting for completion
- The checkpoint update at the end of `_execute_agent_stream` will not run

**Mitigation:** This is acceptable in development. The developer just triggered a code change, so they expect disruption. The task can be re-triggered manually. In production, `--reload` is never used.

### 5.2 WorkerState Cleanup

**Risk: LOW**

The `on_shutdown` hook calls `WorkerState.shutdown()` which closes the PostgreSQL checkpointer connection. If SIGTERM arrives and the shutdown hook executes, cleanup happens correctly. If the process is force-killed after the shutdown timeout, the database connection will be orphaned but will be reclaimed by PostgreSQL's `idle_in_transaction_session_timeout` or TCP keepalive.

### 5.3 Redis Connection Leak

**Risk: LOW**

Each task creates its own `redis_client` in `run_agent_stream` and closes it in the `finally` block. If the process is killed mid-task, the Redis connection will be orphaned but Redis handles this gracefully via TCP keepalive / timeout.

### 5.4 Broker Reconnection

**Risk: NONE**

The `RedisStreamBroker` connection is established fresh on each worker process startup. Since reload creates a new process, there is no stale connection concern.

### 5.5 Watchdog Compatibility

**Risk: LOW**

`watchdog` uses OS-native file system events (inotify on Linux, FSEvents on macOS). Under WSL2 (which this environment uses), inotify works for files within the WSL filesystem. If the project is on a Windows mount (`/mnt/c/...`), file events may not propagate reliably. The working directory (`/home/ryaneggz/...`) is on the WSL filesystem, so this should not be an issue.

---

## 6. Estimated Complexity

| Item | Effort |
|------|--------|
| Makefile change | 5 minutes |
| Verify/add watchdog dependency | 10 minutes |
| Test reload behavior manually | 15 minutes |
| Document in README/contributing guide | 10 minutes |
| **Total** | **~40 minutes** |

This is a trivial change. The heavy lifting is already done by TaskIQ's built-in reload infrastructure.

---

## 7. Files to Modify

| File | Change |
|------|--------|
| `backend/Makefile` | Add `--reload --reload-dir src` to `dev.worker` target |
| `backend/pyproject.toml` | Add `watchdog` dev dependency if not already present |

No changes needed to:
- `backend/src/workers/broker.py` -- lifecycle hooks already handle restart correctly
- `backend/src/workers/state.py` -- singleton resets naturally on process restart
- `backend/src/workers/tasks.py` -- no changes needed
