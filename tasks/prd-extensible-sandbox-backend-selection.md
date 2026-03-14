# PRD: Extensible Sandbox/Backend Selection

## Introduction

Re-introduce user-configurable sandbox selection using an extensible registry pattern. The current `resolve_sandbox_backend()` in `backend/src/agents/__init__.py` hardcodes the strategy: try Daytona, silently fall back to `StateBackend`. Issue #769 asks us to let users pick their default sandbox in Settings, have the backend respect that choice, and make adding new backends trivial (~3 lines of code).

The fallback behavior is governed by whether the Daytona API key is configured in the user's provider key settings. If the key is set and Daytona is available, it's used; otherwise the system falls back to `StateBackend`.

## Goals

- Allow users to configure their preferred sandbox backend (`auto`, `daytona`, `state`) from the Settings page
- Implement an extensible registry pattern (enum + dict + factory functions) so adding a new backend requires only 1 enum value + 1 factory function + 1 dict entry
- Thread the user's sandbox preference through all 3 agent execution paths (invoke, stream, worker)
- Maintain full backward compatibility: default behavior (`auto`) is identical to current behavior
- Achieve high test coverage for the new dispatch logic

## User Stories

### US-001: Add SandboxType enum and schema fields
**Description:** As a developer, I need a `SandboxType` enum and schema fields so the system has a typed, validated representation of sandbox choices.

**Acceptance Criteria:**
- [ ] `SandboxType(str, Enum)` added to `backend/src/schemas/entities/settings.py` with values `auto`, `daytona`, `state`
- [ ] `default_sandbox: Optional[str] = None` field added to `UserSettings` entity
- [ ] `default_sandbox: Optional[str] = None` field added to `UserSettingsResponse` model
- [ ] `UpdateDefaultSandboxRequest(BaseModel)` added with `sandbox: Optional[str]` field
- [ ] Typecheck passes (`make format`)

### US-002: Add set_default_sandbox repo method
**Description:** As a developer, I need a repository method to persist the user's sandbox preference so it can be read back on every agent invocation.

**Acceptance Criteria:**
- [ ] `set_default_sandbox(sandbox)` method added to `UserSettingsRepo`, mirroring `set_default_model()`
- [ ] Method validates input against `SandboxType` enum values; raises `ValueError` for invalid input
- [ ] `None` input clears the setting (same as clearing default model)
- [ ] Unit test: `test_set_default_sandbox` stores and returns the value
- [ ] Unit test: `test_clear_default_sandbox` null clears the value
- [ ] Unit test: `test_set_invalid_sandbox_raises` rejects invalid values
- [ ] `make test` passes

### US-003: Add PUT /settings/default-sandbox endpoint
**Description:** As a frontend client, I need an API endpoint to read and update the user's default sandbox setting.

**Acceptance Criteria:**
- [ ] `PUT /settings/default-sandbox` endpoint added to `backend/src/routes/v0/settings.py`, mirroring `update_default_model`
- [ ] Endpoint accepts `UpdateDefaultSandboxRequest` body
- [ ] `ValueError` from repo is caught and returns HTTP 400
- [ ] All existing settings endpoint responses updated to include `default_sandbox` field
- [ ] Route test: `test_get_settings_includes_default_sandbox` verifies field in GET response
- [ ] Route test: `test_set_default_sandbox` verifies PUT stores and returns value
- [ ] Route test: `test_set_invalid_sandbox_returns_400` verifies invalid input returns 400
- [ ] `make test` passes

### US-004: Implement registry pattern in resolve_sandbox_backend
**Description:** As a developer, I need `resolve_sandbox_backend()` to accept a `sandbox_type` parameter and dispatch to the correct factory, so the function is extensible without modifying its core logic.

**Acceptance Criteria:**
- [ ] `_create_daytona_backend_checked(runtime)` factory extracted -- wraps existing Daytona creation logic, raises `RuntimeError` on failure
- [ ] `_create_state_backend(runtime)` factory extracted -- creates `StateBackend`
- [ ] `_SANDBOX_FACTORIES` dict maps `SandboxType` values to factory callables
- [ ] `resolve_sandbox_backend(runtime, sandbox_type=None)` dispatch logic:
  - `None` / `"auto"`: try Daytona, fall back to State (current behavior, backward-compatible)
  - `"state"`: State directly, skip Daytona entirely
  - `"daytona"`: try Daytona, fall back to State if unavailable
  - Unknown value: treat as `auto`
- [ ] Unit test: `test_auto_uses_daytona_when_available` -- `sandbox_type=None` uses Daytona
- [ ] Unit test: `test_auto_falls_back_to_state` -- `sandbox_type=None` falls back when Daytona unavailable
- [ ] Unit test: `test_explicit_state_skips_daytona` -- `sandbox_type="state"` never calls `create_daytona_backend`
- [ ] Unit test: `test_explicit_daytona_falls_back_gracefully` -- `sandbox_type="daytona"` falls back if unavailable
- [ ] `make test` passes

### US-005: Wire sandbox_type through LLMController
**Description:** As a user, I want my sandbox preference applied when I invoke or stream an agent, so my setting is respected in all execution paths.

**Acceptance Criteria:**
- [ ] `_resolve_user_settings()` returns 3-tuple `(model, api_key, default_sandbox)` instead of 2-tuple
- [ ] `default_sandbox` read from the already-fetched `settings` object
- [ ] `sandbox_type` passed to `resolve_sandbox_backend()` in `llm_invoke()` (line ~128)
- [ ] `sandbox_type` passed through to `stream_generator()` in `llm_stream()` (line ~163)
- [ ] `make test` passes

### US-006: Wire sandbox_type through stream_generator
**Description:** As a developer, I need `stream_generator()` to accept and forward the sandbox preference so streaming execution uses the correct backend.

**Acceptance Criteria:**
- [ ] `sandbox_type: str | None = None` parameter added to `stream_generator()`
- [ ] Parameter passed to `resolve_sandbox_backend(runtime, sandbox_type)` at line ~222
- [ ] `make test` passes

### US-007: Wire sandbox_type through worker tasks
**Description:** As a developer, I need `_execute_agent_stream()` in the distributed worker to read and forward the sandbox preference from user settings.

**Acceptance Criteria:**
- [ ] `settings.default_sandbox` read from the already-fetched settings object in `_execute_agent_stream()`
- [ ] Value passed to `resolve_sandbox_backend(runtime, sandbox_type)` at line ~255
- [ ] `make test` passes

### US-008: Frontend service types and API call
**Description:** As a frontend developer, I need TypeScript types and an API function to interact with the new sandbox settings endpoint.

**Acceptance Criteria:**
- [ ] `SandboxType` type exported: `"auto" | "daytona" | "state"`
- [ ] `default_sandbox: string | null` field added to `UserSettingsResponse` interface
- [ ] `updateDefaultSandbox(sandbox: string | null)` function added that PUTs to `/settings/default-sandbox`
- [ ] `npm run test` passes
- [ ] `npm run build` passes

### US-009: SandboxSettings frontend component
**Description:** As a user, I want a dropdown in the Settings page to choose my default sandbox backend.

**Acceptance Criteria:**
- [ ] New file `frontend/src/components/settings/SandboxSettings.tsx` created
- [ ] Follows `DefaultModelSettings.tsx` pattern (Card + Select dropdown)
- [ ] 3 options displayed: Auto (Recommended), Daytona, Local
- [ ] Current value fetched from `getSettings()` on mount
- [ ] Selection calls `updateDefaultSandbox()` and shows toast on success/error
- [ ] Verify in browser using agent-browser skill

### US-010: Wire SandboxSettings into Settings page
**Description:** As a user, I want the sandbox selector visible on the Settings page between existing settings sections.

**Acceptance Criteria:**
- [ ] `SandboxSettings` imported in `frontend/src/pages/settings/index.tsx`
- [ ] Rendered between `<DefaultModelSettings />` and `<UserApiKeysSettings />`
- [ ] `npm run test` passes
- [ ] `npm run build` passes
- [ ] Verify in browser using agent-browser skill

## Functional Requirements

- FR-1: The system must store a `default_sandbox` preference per user in the settings entity
- FR-2: The `SandboxType` enum must support values `auto`, `daytona`, and `state`
- FR-3: `PUT /settings/default-sandbox` must accept a `sandbox` field and persist it; invalid values return HTTP 400
- FR-4: `GET /settings` must include `default_sandbox` in the response
- FR-5: All existing settings mutation endpoints must include `default_sandbox` in their responses
- FR-6: `resolve_sandbox_backend()` must accept an optional `sandbox_type` parameter and dispatch accordingly
- FR-7: When `sandbox_type` is `"state"`, the system must skip Daytona entirely and use `StateBackend` directly
- FR-8: When `sandbox_type` is `"daytona"` or `"auto"` (or `None`), the system must try Daytona first and fall back to `StateBackend`
- FR-9: Unknown `sandbox_type` values must be treated as `"auto"` (no errors)
- FR-10: The frontend Settings page must display a sandbox selection dropdown with options: Auto (Recommended), Daytona, Local
- FR-11: Adding a new backend type in the future must require only: 1 enum value + 1 factory function + 1 dict entry

## Non-Goals

- No per-assistant or per-chat sandbox overrides (per-user only)
- No plugin loader, abstract base classes, or metaclass patterns
- No automatic detection of which backends are available (users choose explicitly)
- No migration of existing data (new field defaults to `null` which means `auto`)
- No backend-side notification when Daytona falls back to State (silent fallback)
- No feature flags or gradual rollout -- available to all users immediately

## Technical Considerations

- **Pattern:** Enum + Registry Dict + Factory Functions. The `_SANDBOX_FACTORIES` dict maps `SandboxType` values to callable factory functions. `resolve_sandbox_backend()` looks up the factory and calls it. This is the simplest extensible pattern.
- **Backward compatibility:** `sandbox_type=None` preserves exact current behavior (try Daytona, fall back to State). No existing call sites break.
- **3 call sites** must be updated: `LLMController` (invoke + stream), `stream_generator` (direct streaming), `_execute_agent_stream` (distributed worker). All three already fetch user settings; we just read one more field.
- **Frontend pattern:** Mirror `DefaultModelSettings.tsx` using a simpler `Select` component (fixed 3 options vs. searchable model list).
- **Schema:** `default_sandbox` is stored as `Optional[str]` (not the enum directly) for flexibility. Validation happens at the repo layer.

## Success Metrics

- Adding a new backend type requires exactly 3 lines of code changes (1 enum value + 1 factory + 1 dict entry)
- All existing tests continue to pass with zero modifications
- 10+ new unit tests covering sandbox dispatch, repo CRUD, and route validation
- `resolve_sandbox_backend()` function remains under 30 lines of code
- No regressions in agent execution (auto mode is identical to prior behavior)

## Open Questions

- Should we surface Daytona availability status in the frontend (e.g., grayed-out option if API key not configured)?
- Should the `ruska-ai/sandboxes` package (referenced in issue) be added as a future `SandboxType` option now, or deferred to a follow-up?
