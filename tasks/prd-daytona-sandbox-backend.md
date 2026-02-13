# PRD: Daytona Sandbox Backend

## Introduction

Integrate `DaytonaSandbox` as an optional deepagents backend, giving agents full filesystem and execute tools in an isolated Daytona cloud sandbox. This replaces the in-memory `StateBackend` emulation with a real Linux environment where agents can install packages, read/write files, and execute commands.

Activated opt-in via persisted user setting `sandbox_backend = "daytona"` in `/settings` (not a per-request metadata flag and not a selectable tool). When Daytona is unavailable or creation fails, the system falls back to `StateBackend` and notifies the user via a system message in the response.

This is the second of two Daytona integration issues. It depends on [#750](https://github.com/ruska-ai/orchestra/issues/750) (Data Analysis Tool) for shared `DAYTONA_API_KEY` constants and `.example.env` setup.

**GitHub Issue:** [#751](https://github.com/ruska-ai/orchestra/issues/751)

**6 files modified, 0 files created.**

## Goals

- Add `DaytonaSandbox` as an optional deepagents backend activated via persisted user setting `sandbox_backend = "daytona"`
- Provide a `create_daytona_backend()` factory in `src/agents/__init__.py` that returns `(sandbox, backend)` or `(None, None)`
- Wire the Daytona backend through all three agent entry points: `llm.py` (invoke), `stream.py` (stream), `tasks.py` (worker)
- Fall back to `StateBackend` with a user-visible system message when Daytona is unavailable or fails
- Clean up sandbox resources (`sandbox.stop()`) in `finally` blocks to prevent orphaned cloud instances
- Maintain full backward compatibility — requests without `sandbox_backend` behave identically to today

## User Stories

### US-001: Add Daytona Sandbox Dependency
**Description:** As a developer, I need the `langchain-daytona` package added to backend dependencies so the `DaytonaSandbox` backend can be imported.

**Acceptance Criteria:**
- [ ] `langchain-daytona>=0.1.0` added to `backend/pyproject.toml` dependencies
- [ ] `uv sync` completes without errors
- [ ] `from langchain_daytona import DaytonaSandbox` succeeds after install
- [ ] `from daytona import Daytona` succeeds after install
- [ ] Typecheck/lint passes (`make format`)

### US-002: Conditional Import and Backend Factory
**Description:** As a developer, I need a `create_daytona_backend()` factory function in `src/agents/__init__.py` that creates a Daytona sandbox and wraps it in a backend, or returns `(None, None)` gracefully.

**Acceptance Criteria:**
- [ ] Conditional `try/except ImportError` for `Daytona` and `DaytonaSandbox` at module top-level in `src/agents/__init__.py`
- [ ] `DaytonaSandbox` set to `None` when package not installed (matches `src/tools/code.py` pattern)
- [ ] `create_daytona_backend(api_key: str | None = None)` function added
- [ ] Returns `(sandbox_instance, DaytonaSandbox_backend)` on success
- [ ] Returns `(None, None)` when: package missing, `Daytona` is `None`, or API key is unset
- [ ] Returns `(None, None)` and logs error when `client.create()` raises
- [ ] Uses `DAYTONA_API_KEY` from `src.constants` as fallback when no `api_key` argument provided
- [ ] Typecheck/lint passes (`make format`)

### US-003: Wire Daytona Backend into LLMController (llm.py)
**Description:** As a developer, I need `LLMController.llm_invoke()` to check persisted user setting `sandbox_backend == "daytona"` and use the Daytona backend instead of `StateBackend` when requested.

**Acceptance Criteria:**
- [ ] `llm_invoke()` in `src/controllers/llm.py` resolves user settings and checks `sandbox_backend` after resolving assistant config
- [ ] When `sandbox == "daytona"`: calls `create_daytona_backend(api_key)` to get `(daytona_sandbox, daytona_backend)`
- [ ] When Daytona backend is available: passes it as the default to `CompositeBackend` (store routes preserved)
- [ ] When Daytona backend creation fails: falls back to `StateBackend`, appends a system message to `params.input.messages` notifying the user (e.g. "Daytona sandbox unavailable, falling back to default sandbox.")
- [ ] `daytona_sandbox.stop()` called in the `finally` block after agent execution completes
- [ ] Requests without `sandbox_backend` behave identically to current behavior (no regression)
- [ ] Typecheck/lint passes (`make format`)

### US-004: Wire Daytona Backend into stream_generator (stream.py)
**Description:** As a developer, I need `stream_generator()` in `src/utils/stream.py` to support Daytona backend activation via resolved user settings (`sandbox_backend`), with the same fallback and cleanup behavior.

**Acceptance Criteria:**
- [ ] `stream_generator()` receives resolved `sandbox_backend` from settings resolution (not request metadata)
- [ ] When `sandbox_backend == "daytona"`: calls `create_daytona_backend()` and uses Daytona as the default backend in `CompositeBackend`
- [ ] When creation fails: falls back to `StateBackend` via existing `init_backend()`, yields a system message SSE event notifying the user
- [ ] `daytona_sandbox.stop()` called in the `finally` block (alongside existing checkpoint cleanup)
- [ ] Requests without `sandbox_backend` behave identically to current behavior
- [ ] Typecheck/lint passes (`make format`)

### US-005: Wire Daytona Backend into Worker Task (tasks.py)
**Description:** As a developer, I need `_execute_agent_stream()` in `src/workers/tasks.py` to support Daytona backend activation via user settings (`sandbox_backend`), with the same fallback and cleanup behavior.

**Acceptance Criteria:**
- [ ] `_execute_agent_stream()` resolves user settings and checks `sandbox_backend` for `"daytona"`
- [ ] When `sandbox_backend == "daytona"`: calls `create_daytona_backend()` and uses Daytona as the default backend in `CompositeBackend`
- [ ] When creation fails: falls back to `StateBackend` via existing `init_backend()`, writes a system message to the Redis stream
- [ ] `daytona_sandbox.stop()` called in the `finally` block (alongside existing checkpoint and Redis cleanup)
- [ ] Requests without `sandbox_backend` behave identically to current behavior
- [ ] Typecheck/lint passes (`make format`)

### US-006: Unit Tests for Backend Factory and Wiring
**Description:** As a developer, I need unit tests verifying the Daytona backend factory and fallback behavior.

**Acceptance Criteria:**
- [ ] Tests added to `backend/tests/unit/services/test_daytona.py` (extend file from #750 or create if #750 not yet merged)
- [ ] Test: `create_daytona_backend()` returns `(None, None)` when `DaytonaSandbox is None` (package not installed)
- [ ] Test: `create_daytona_backend()` returns `(None, None)` when API key is empty/None
- [ ] Test: `create_daytona_backend()` returns valid `(sandbox, backend)` with mocked `Daytona` client
- [ ] Test: `create_daytona_backend()` returns `(None, None)` and logs error when `client.create()` raises
- [ ] Test: `sandbox.stop()` is called during cleanup (mocked)
- [ ] `uv run pytest tests/unit/services/test_daytona.py -v` passes
- [ ] `make test` passes (no regressions)

## Functional Requirements

- FR-1: When `sandbox_backend == "daytona"` is set in user settings, the system must attempt to create a `DaytonaSandbox` backend via `create_daytona_backend()`
- FR-2: The `DaytonaSandbox` backend must be used as the `default` in `CompositeBackend`, with existing store routes (`/users/{id}/memories/`, `/users/{id}/config/`) preserved on `StoreBackend`
- FR-3: When Daytona backend creation fails (package missing, key unset, API error), the system must fall back to `StateBackend` and notify the user via a system message
- FR-4: The system must call `sandbox.stop()` in a `finally` block after every agent execution to prevent orphaned cloud sandboxes
- FR-5: All Daytona imports must be conditional (`try/except ImportError`) so the system runs without Daytona packages installed
- FR-6: The factory must accept an optional `api_key` parameter, falling back to `DAYTONA_API_KEY` from `src.constants`
- FR-7: Requests without `sandbox_backend` must behave identically to current behavior (zero regression)
- FR-8: The Daytona backend must be wired through all three entry points: `llm_invoke()`, `stream_generator()`, and `_execute_agent_stream()`

## Non-Goals (Out of Scope)

- **No `daytona_sandbox` tool** — that is covered by [#750](https://github.com/ruska-ai/orchestra/issues/750)
- **No constants/env changes** — `DAYTONA_API_KEY` is added by #750
- **No Manage Tools integration** — Daytona is backend infrastructure and must not be shown as a selectable tool
- **No persistent sandbox sessions** — each request creates and destroys a sandbox
- **No request-metadata sandbox toggle** — backend selection is resolved from persisted user settings
- **No assistant-level sandbox config** — activation is via user settings

## Technical Considerations

- **Settings-driven backend routing:** Backend selection should be resolved from persisted user settings (`sandbox_backend`) and threaded through invoke/stream/worker paths consistently.
- **CompositeBackend pattern:** Existing `init_backend()` at `src/agents/__init__.py:235` creates `CompositeBackend(default=StateBackend(runtime), routes=built_routes)`. For Daytona, replace the `default` with `DaytonaSandbox` while keeping routes unchanged.
- **Three entry points:** Backend is constructed in three places today:
  - `LLMController.init_backend()` at `src/controllers/llm.py:43` — used by `llm_invoke()`
  - `stream_generator()` at `src/utils/stream.py:226` — calls `init_backend(runtime, routes=routes)`
  - `_execute_agent_stream()` at `src/workers/tasks.py:237` — calls `init_backend(runtime, routes=routes)`
- **Cleanup placement:**
  - `llm.py`: add `daytona_sandbox.stop()` to the existing `finally` block at line 148
  - `stream.py`: add to the existing `finally` block at line 285
  - `tasks.py`: add to the end of `_execute_agent_stream()` (before return) or wrap in try/finally
- **Fallback notification:** When falling back, append a `SystemMessage` to the input messages or yield an SSE event so the user knows Daytona was requested but unavailable.

## Files to Modify

| File | Action | What Changes |
|------|--------|-------------|
| `backend/pyproject.toml` | EDIT | Add `langchain-daytona>=0.1.0` |
| `backend/src/agents/__init__.py` | EDIT | Add conditional import + `create_daytona_backend()` factory |
| `backend/src/controllers/llm.py` | EDIT | Resolve settings `sandbox_backend`, create Daytona backend, cleanup in `finally` |
| `backend/src/utils/stream.py` | EDIT | Use resolved `sandbox_backend`, create Daytona backend, cleanup in `finally` |
| `backend/src/workers/tasks.py` | EDIT | Resolve settings `sandbox_backend`, create Daytona backend, cleanup in `finally` |
| `backend/tests/unit/services/test_daytona.py` | EDIT/CREATE | Backend factory + cleanup tests |

## Success Metrics

- Zero orphaned Daytona sandbox instances after agent execution (verified via `finally` block cleanup)
- Fallback to `StateBackend` with user notification when Daytona unavailable — no silent failures
- `make test` passes with no regressions
- Requests without `sandbox_backend` produce identical behavior to current codebase

## Open Questions

- Should there be a configurable timeout on Daytona sandbox creation to avoid slow starts blocking the request?
- Should sandbox creation be retried once on transient failures, or fail immediately to the fallback?
- Should the fallback system message be configurable or hardcoded?
