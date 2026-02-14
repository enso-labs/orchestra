# PRD: Make Daytona the Default Sandbox Backend

## Introduction

The codebase has significant tech debt around sandbox backend selection. Three execution paths (invoke, stream, worker) each duplicate ~25 lines of conditional routing logic (`if sandbox_backend == "daytona"` ... `else` use StateBackend). A user settings UI/API exists for choosing the sandbox backend, but with only one option ("daytona"), it adds complexity without value. All users are already on Daytona.

This refactoring makes Daytona the always-attempted default backend with silent fallback to StateBackend when unavailable, removes all `sandbox_backend` settings infrastructure (backend API, frontend UI, database field), and consolidates duplicated routing into a single `resolve_sandbox_backend()` helper.

## Goals

- Eliminate duplicated sandbox routing logic across 3 execution paths into one shared helper
- Make Daytona the always-attempted default with silent fallback to StateBackend
- Remove the `sandbox_backend` user settings field, API endpoint, and frontend UI
- Reduce code surface area and simplify onboarding for new contributors
- Maintain identical runtime behavior for all users (Daytona first, StateBackend fallback)

## User Stories

### US-001: Create unified resolve_sandbox_backend() helper
**Description:** As a developer, I want a single function that tries Daytona first and falls back to StateBackend so that all execution paths share one source of truth.

**Acceptance Criteria:**
- [ ] `resolve_sandbox_backend(runtime, routes=routes)` added to `backend/src/agents/__init__.py`
- [ ] Function returns `tuple[CompositeBackend, Any]` (backend, daytona_sandbox_or_None)
- [ ] When Daytona capability is supported, returns Daytona-backed CompositeBackend and sandbox reference
- [ ] When Daytona capability is not supported, stops sandbox (if created) and returns StateBackend-backed CompositeBackend with None
- [ ] Fallback is completely silent (no log messages, no SystemMessage, no SSE events)
- [ ] Import `validate_daytona_execute_capability` from `src.agents.daytona`
- [ ] `init_backend()` function removed from `backend/src/agents/__init__.py`
- [ ] Typecheck passes (`cd backend && mypy src/agents/__init__.py` or equivalent)

### US-002: Simplify invoke execution path
**Description:** As a developer, I want the invoke path in `llm.py` to use the shared helper so that sandbox routing is not duplicated.

**Acceptance Criteria:**
- [ ] `_resolve_user_settings()` returns 2-tuple `(model, api_key)` instead of 3-tuple
- [ ] All `settings.sandbox_backend` references removed from `_resolve_user_settings()`
- [ ] `llm_invoke()` replaces the ~25-line conditional block with a call to `resolve_sandbox_backend()`
- [ ] `self.init_backend()` method deleted from the controller class
- [ ] Imports updated: add `resolve_sandbox_backend`, remove `create_daytona_backend`, `daytona_fallback_message`, `validate_daytona_execute_capability`
- [ ] Typecheck passes

### US-003: Simplify stream execution path
**Description:** As a developer, I want the stream path in `stream.py` to use the shared helper so that sandbox routing is not duplicated.

**Acceptance Criteria:**
- [ ] `sandbox_backend` parameter removed from `stream_generator()` signature
- [ ] Conditional sandbox routing block replaced with call to `resolve_sandbox_backend()`
- [ ] Imports updated: replace `create_daytona_backend, init_backend` with `resolve_sandbox_backend`, remove daytona-specific imports
- [ ] `llm_stream()` in `llm.py` no longer passes `sandbox_backend` to `stream_generator()`
- [ ] Typecheck passes

### US-004: Simplify worker execution path
**Description:** As a developer, I want the worker path in `tasks.py` to use the shared helper so that sandbox routing is not duplicated.

**Acceptance Criteria:**
- [ ] `sandbox_backend` lookup from `UserSettingsRepo` removed from `_execute_agent_stream()`
- [ ] `api_key` resolution kept intact
- [ ] Conditional sandbox routing block replaced with call to `resolve_sandbox_backend()`
- [ ] Inner imports updated: replace `create_daytona_backend, init_backend` with `resolve_sandbox_backend`, remove daytona-specific imports
- [ ] Typecheck passes

### US-005: Remove sandbox_backend from backend settings infrastructure
**Description:** As a developer, I want to remove all sandbox_backend references from the settings schema, repo, and API so that the dead configuration surface is eliminated.

**Acceptance Criteria:**
- [ ] `sandbox_backend` field removed from `UserSettings` model in `settings.py`
- [ ] `sandbox_backend` field removed from `UserSettingsResponse` model in `settings.py`
- [ ] `UpdateSandboxBackendRequest` class deleted from `settings.py`
- [ ] `set_sandbox_backend()` method deleted from `user_settings_repo.py`
- [ ] `PUT /settings/sandbox-backend` endpoint deleted from `settings.py` route file
- [ ] `_VALID_SANDBOX_BACKENDS` constant deleted from settings route file
- [ ] `sandbox_backend=...` removed from all `UserSettingsResponse(...)` constructors in route file
- [ ] `GET /settings` response no longer includes `sandbox_backend` field
- [ ] Typecheck passes

### US-006: Remove sandbox_backend from frontend
**Description:** As a user, I should no longer see a sandbox backend selector in the settings page since it serves no purpose.

**Acceptance Criteria:**
- [ ] `frontend/src/components/settings/SandboxBackendSettings.tsx` deleted
- [ ] `frontend/src/components/settings/SandboxBackendSettings.test.tsx` deleted
- [ ] `SandboxBackend` type removed from `userSettingsService.ts`
- [ ] `sandbox_backend` removed from `UserSettingsResponse` in `userSettingsService.ts`
- [ ] `updateSandboxBackend()` function deleted from `userSettingsService.ts`
- [ ] `<SandboxBackendSettings />` import and usage removed from `settings/index.tsx`
- [ ] `frontend/src/tests/services/userSettingsService.test.ts` deleted (only tested sandbox_backend)
- [ ] Frontend typecheck passes (`cd frontend && npx tsc --noEmit`)
- [ ] Verify in browser using agent-browser skill: settings page loads without sandbox backend section

### US-007: Clean up dead backend code
**Description:** As a developer, I want dead code removed so that the codebase stays lean and navigable.

**Acceptance Criteria:**
- [ ] `daytona_fallback_message()` removed from `backend/src/agents/daytona.py`
- [ ] `validate_daytona_execute_capability()` and constants kept in `daytona.py` (still used by new helper)
- [ ] `init_backend` fully removed from `backend/src/agents/__init__.py` (no remaining callers)
- [ ] No orphaned imports across all modified files
- [ ] Typecheck passes

### US-008: Update and rewrite unit tests
**Description:** As a developer, I want the test suite to validate the new always-Daytona behavior so that regressions are caught.

**Acceptance Criteria:**
- [ ] `test_daytona.py`: `create_daytona_backend()` calls updated (remove `api_key=` arg)
- [ ] `test_daytona.py`: New tests added for `resolve_sandbox_backend()` (Daytona success path, fallback path, sandbox cleanup on fallback)
- [ ] `test_daytona_capability.py`: Kept as-is (still valid)
- [ ] `test_daytona_cross_path.py`: Rewritten to remove all `sandbox_backend` params, assert Daytona is always attempted, assert silent fallback (no SystemMessage/SSE/Redis fallback messages)
- [ ] `test_stream_daytona_backend_routing.py`: Rewritten to remove `sandbox_backend` param from all `stream_generator()` calls, test always-Daytona with silent fallback
- [ ] All other test files referencing `sandbox_backend`: assertions/mocks removed
- [ ] `cd backend && make test` passes
- [ ] `cd frontend && npm run test` passes

## Functional Requirements

- FR-1: `resolve_sandbox_backend()` must always attempt Daytona first via `create_daytona_backend()` + `validate_daytona_execute_capability()`
- FR-2: When Daytona capability is supported, the function must return a Daytona-backed `CompositeBackend` and the sandbox reference
- FR-3: When Daytona capability is not supported, the function must stop the sandbox (if created), return a `StateBackend`-backed `CompositeBackend`, and return `None` for the sandbox
- FR-4: Fallback must be completely silent -- no log warnings, no `SystemMessage`, no SSE events, no Redis messages to the user
- FR-5: The `sandbox_backend` field must be removed from the `UserSettings` model and `UserSettingsResponse`
- FR-6: The `PUT /settings/sandbox-backend` API endpoint must be deleted
- FR-7: The `GET /settings` response must no longer include `sandbox_backend`
- FR-8: The frontend settings page must not render any sandbox backend selector
- FR-9: All three execution paths (invoke, stream, worker) must use `resolve_sandbox_backend()` instead of inline conditional logic

## Non-Goals

- No changes to Daytona connection/configuration logic itself
- No changes to how `create_daytona_backend()` works internally
- No changes to `StoreBackend` routing logic (memory/config routes stay the same)
- No database migration needed (field simply stops being read/written)
- No deprecation period or backward-compatibility shim -- the setting was internal-only
- No logging or telemetry for fallback events (silent by design)

## Technical Considerations

- `create_daytona_backend()` may return `(None, None)` when env vars are missing -- helper must handle this gracefully
- `validate_daytona_execute_capability()` is the authoritative check for whether Daytona can execute -- reuse the existing function
- The `CompositeBackend` pattern with `routes` dict for `StoreBackend` must be preserved identically in all 3 paths
- Sandbox `.stop()` on fallback must be wrapped in try/except to avoid masking the real fallback reason
- No database migration required -- `sandbox_backend` in Redis/settings store will simply be ignored

## Testing Plan

### Automated Tests
| Test File | What to Validate |
|-----------|-----------------|
| `test_daytona.py` | `resolve_sandbox_backend()` returns Daytona backend when capable, StateBackend when not, cleans up sandbox on fallback |
| `test_daytona_capability.py` | Unchanged -- validates capability detection logic |
| `test_daytona_cross_path.py` | All 3 paths always attempt Daytona, silent fallback produces no messages |
| `test_stream_daytona_backend_routing.py` | `stream_generator()` no longer accepts `sandbox_backend`, uses helper correctly |

### Agent-Browser Validation (Pre-Manual)
| Check | Steps |
|-------|-------|
| Settings page loads | Navigate to settings page, confirm no errors |
| No sandbox backend section | Verify the sandbox backend selector component is absent from the settings page |
| Other settings intact | Verify remaining settings (model, API key, etc.) still render and function |

### Manual Review Checklist
| # | Check | How to Verify |
|---|-------|--------------|
| 1 | Backend tests pass | `cd backend && make test` |
| 2 | Frontend tests pass | `cd frontend && npm run test` |
| 3 | Code formatted | `cd backend && make format` |
| 4 | GET /settings clean | `curl` or browser devtools: response has no `sandbox_backend` field |
| 5 | PUT /settings/sandbox-backend gone | `curl -X PUT .../settings/sandbox-backend` returns 404 |
| 6 | Settings UI clean | Open settings page in browser, confirm no sandbox backend section |
| 7 | Invoke path works | Send a non-streaming LLM request, confirm it completes successfully |
| 8 | Stream path works | Send a streaming LLM request, confirm it streams correctly |
| 9 | Worker path works | Trigger a background agent task, confirm it executes correctly |

## Success Metrics

- ~75 lines of duplicated conditional routing reduced to ~10 lines in one shared helper
- 3 frontend files deleted, 1 backend endpoint removed, 1 schema field removed
- All existing tests pass or are rewritten to validate new behavior
- Zero user-visible behavior change (Daytona still used when available, StateBackend when not)

## Open Questions

- None -- the plan is fully specified and all users are already on Daytona.
