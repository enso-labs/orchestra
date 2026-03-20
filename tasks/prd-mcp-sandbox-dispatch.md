# PRD: MCP Sandbox Dispatch Wiring (Phase 2 — Feature #890)

## Ralph Story Mapping

> This PRD covers **Ralph US-015 through US-023** (Phase 2 — Sandbox dispatch wiring).

## Introduction

Wire `McpSandboxBackend` into the existing extensible sandbox dispatch system so that users can run code execution through a remote MCP sandbox server. The MCP sandbox URL is user-configurable via the Settings page (stored in `UserSettings`), not a hardcoded environment variable. This phase updates the fallback chain to: Daytona -> MCP (if URL configured) -> State, and threads the MCP sandbox URL through all three agent execution paths (invoke, stream, worker).

**Dependency:** Phase 1 of Feature #890 must be completed first — it delivers the `McpSandboxBackend` class that this phase wires into the dispatch system.

## Goals

- Add `MCP = "mcp"` to the `SandboxType` enum and register it in the sandbox factory registry
- Store a user-configurable `mcp_sandbox_url` in `UserSettings`, readable and writable via the existing settings API
- Update `resolve_sandbox_backend()` to support MCP in the fallback chain: Daytona -> MCP (if URL configured) -> State
- Thread `mcp_sandbox_url` through all three execution paths: `LLMController` (invoke + stream), `stream_generator`, and `_execute_agent_stream` (worker)
- Add MCP-specific error handling with `is_mcp_sandbox_error()` helper and `mcp_sandbox_unreachable` SSE error type
- Maintain full backward compatibility — existing Daytona and State flows must be completely unaffected

## User Stories

### US-001: Add MCP to SandboxType enum and UserSettings schema

**Description:** As a developer, I need the `SandboxType` enum extended with `MCP = "mcp"` and a new `default_mcp_sandbox_url` field on `UserSettings` so the system has typed, validated representation of MCP sandbox configuration.

**Acceptance Criteria:**
- [ ] `MCP = "mcp"` added to `SandboxType` enum in `backend/src/schemas/entities/settings.py`
- [ ] `default_mcp_sandbox_url: Optional[str] = Field(default=None, description="User's MCP sandbox server URL")` added to `UserSettings`
- [ ] Existing `SandboxType.DAYTONA` and `SandboxType.STATE` values are unchanged
- [ ] `make format` passes
- [ ] `make lint` passes

### US-002: Add mcp_sandbox_url to API schemas

**Description:** As an API consumer, I need `mcp_sandbox_url` exposed in the settings response and patchable via the defaults endpoint so the frontend (Phase 3+) or API clients can read and write the URL.

**Acceptance Criteria:**
- [ ] `mcp_sandbox_url: Optional[str] = None` added to `DefaultsResponse` in `backend/src/schemas/entities/settings.py`
- [ ] `mcp_sandbox_url: Optional[str] = Field(default=None, description="MCP sandbox server URL, or null to clear")` added to `PatchDefaultsRequest`
- [ ] `mcp_sandbox_url` field is included in `_build_response()` mapping in `backend/src/routes/v0/settings.py` (maps `settings.default_mcp_sandbox_url` to `defaults.mcp_sandbox_url`)
- [ ] `"mcp_sandbox_url": "default_mcp_sandbox_url"` added to `_DEFAULTS_FIELD_MAP` in `UserSettingsRepo`
- [ ] `PATCH /settings/default` with `{"mcp_sandbox_url": "http://localhost:3005"}` stores the value and returns it in the response
- [ ] `PATCH /settings/default` with `{"mcp_sandbox_url": null}` clears the value
- [ ] `GET /settings` includes `mcp_sandbox_url` in the `defaults` object
- [ ] `make format` passes
- [ ] `make lint` passes
- [ ] `make test` passes

### US-003: Add MCP sandbox factory and register in _SANDBOX_FACTORIES

**Description:** As a developer, I need a `_create_mcp_backend_checked()` factory function and its registration in the sandbox factory registry so that `resolve_sandbox_backend()` can create MCP-backed `CompositeBackend` instances.

**Acceptance Criteria:**
- [ ] `_create_mcp_backend_checked(runtime, mcp_sandbox_url)` factory added to `backend/src/agents/__init__.py`
- [ ] Factory returns `(CompositeBackend, None)` on success, `None` when URL is missing or `McpSandboxBackend` cannot be instantiated
- [ ] Factory imports `McpSandboxBackend` from the Phase 1 module (conditional import, safe when not installed)
- [ ] `"mcp"` key added to `_SANDBOX_FACTORIES` dict, pointing to the factory callable
- [ ] Factory validates that `mcp_sandbox_url` is a non-empty string before attempting instantiation
- [ ] `make format` passes
- [ ] `make lint` passes

### US-004: Update resolve_sandbox_backend() with MCP dispatch rules

**Description:** As a developer, I need `resolve_sandbox_backend()` to accept an `mcp_sandbox_url` parameter and implement the updated fallback chain so MCP is tried between Daytona and State when the URL is configured.

**Acceptance Criteria:**
- [ ] `resolve_sandbox_backend()` signature updated: `resolve_sandbox_backend(runtime, sandbox_type=None, mcp_sandbox_url=None)`
- [ ] Dispatch rules implemented:
  - `None` / `"auto"` -> try Daytona, then MCP (if `mcp_sandbox_url` is set), then State
  - `"state"` -> StateBackend directly (no Daytona, no MCP)
  - `"daytona"` -> try Daytona, fallback to State (unchanged from current behavior)
  - `"mcp"` -> try MCP (if `mcp_sandbox_url` is set), fallback to State
  - Unknown value -> treated as `"auto"`
- [ ] Return type remains `tuple[CompositeBackend, Any, str]` where third element is `"daytona"`, `"mcp"`, or `"state"`
- [ ] When `sandbox_type="mcp"` but `mcp_sandbox_url` is `None`/empty, falls back to State (no error)
- [ ] Existing Daytona and State dispatch paths are completely unmodified for non-MCP sandbox types
- [ ] `make format` passes
- [ ] `make lint` passes
- [ ] `make test` passes

### US-005: Add MCP error handling helpers

**Description:** As a developer, I need an `is_mcp_sandbox_error()` helper function and an `mcp_sandbox_unreachable` SSE error type so MCP failures are identifiable and can trigger appropriate fallback or user-facing error messages.

**Acceptance Criteria:**
- [ ] `is_mcp_sandbox_error(exc: Exception) -> bool` added to `backend/src/agents/__init__.py`
- [ ] Helper checks for connection errors (e.g., `ConnectionError`, `TimeoutError`, `OSError`) when communicating with the MCP sandbox URL
- [ ] Helper returns `False` when MCP is not involved (safe no-op)
- [ ] `mcp_sandbox_unreachable` error type defined as a constant string for SSE error events
- [ ] `make format` passes
- [ ] `make lint` passes

### US-006: Wire mcp_sandbox_url through LLMController

**Description:** As a user, I want my MCP sandbox URL applied when I invoke or stream an agent, so my configured MCP sandbox is used in all execution paths.

**Acceptance Criteria:**
- [ ] `_resolve_user_settings()` returns 4-tuple `(model, api_key, default_sandbox, mcp_sandbox_url)` instead of current 3-tuple
- [ ] `mcp_sandbox_url` read from the already-fetched `settings` object via `settings.default_mcp_sandbox_url`
- [ ] `mcp_sandbox_url` passed to `resolve_sandbox_backend(runtime, sandbox_type=default_sandbox, mcp_sandbox_url=mcp_sandbox_url)` in `llm_invoke()`
- [ ] `mcp_sandbox_url` passed through to `stream_generator()` in `llm_stream()`
- [ ] MCP error handling added to `llm_invoke()` exception handler, mirroring the existing Daytona error pattern:
  - `sandbox_type="mcp"` -> surface the error
  - `sandbox_type=None/"auto"` with `effective_type="mcp"` -> fallback to State and retry
- [ ] `make format` passes
- [ ] `make lint` passes
- [ ] `make test` passes

### US-007: Wire mcp_sandbox_url through stream_generator

**Description:** As a developer, I need `stream_generator()` to accept and forward the MCP sandbox URL so streaming execution uses the correct backend.

**Acceptance Criteria:**
- [ ] `mcp_sandbox_url: str | None = None` parameter added to `stream_generator()` signature
- [ ] Parameter passed to `resolve_sandbox_backend(runtime, sandbox_type=sandbox_type, mcp_sandbox_url=mcp_sandbox_url)`
- [ ] MCP error handling added to the exception handler in `stream_generator()`:
  - `sandbox_type="mcp"` -> emit `mcp_sandbox_unreachable` SSE error event
  - `sandbox_type=None/"auto"` with `effective_type="mcp"` -> fallback to State and retry stream
- [ ] SSE error event format: `("mcp_sandbox_unreachable", "<detail>")` — follows existing `("error", str(e))` tuple pattern but with distinct type for frontend toast handling
- [ ] `make format` passes
- [ ] `make lint` passes
- [ ] `make test` passes

### US-008: Wire mcp_sandbox_url through worker tasks

**Description:** As a developer, I need `_execute_agent_stream()` in the distributed worker to read and forward the MCP sandbox URL from user settings.

**Acceptance Criteria:**
- [ ] `settings.default_mcp_sandbox_url` read from the already-fetched settings object in `_execute_agent_stream()`
- [ ] Value passed to `resolve_sandbox_backend(runtime, sandbox_type=default_sandbox, mcp_sandbox_url=mcp_sandbox_url)`
- [ ] MCP error handling added to the exception handler, mirroring the existing Daytona error pattern:
  - `sandbox_type="mcp"` -> write `mcp_sandbox_unreachable` error to Redis stream
  - `sandbox_type=None/"auto"` with `effective_type="mcp"` -> fallback to State and retry
- [ ] `make format` passes
- [ ] `make lint` passes
- [ ] `make test` passes

### US-009: Integration validation

**Description:** As a developer, I need to verify that the full MCP sandbox dispatch pipeline works end-to-end via curl commands against the running API.

**Acceptance Criteria:**
- [ ] `make format` passes
- [ ] `make lint` passes
- [ ] `make test` passes (all existing tests green, no regressions)
- [ ] Verify `GET /settings` returns `mcp_sandbox_url: null` for a user with no URL configured
- [ ] Verify `PATCH /settings/default` with `{"mcp_sandbox_url": "http://localhost:3005"}` stores the URL
- [ ] Verify `GET /settings` returns the stored `mcp_sandbox_url` value
- [ ] Verify `PATCH /settings/default` with `{"sandbox": "mcp"}` sets the sandbox type to `"mcp"`
- [ ] Verify `PATCH /settings/default` with `{"mcp_sandbox_url": null}` clears the URL
- [ ] Verify that when `sandbox="mcp"` but no URL is configured, agent execution falls back to State without error
- [ ] Verify that when `sandbox="auto"` (or null), existing Daytona/State behavior is unchanged
- [ ] Provide curl examples:
  ```bash
  # Login
  curl -X POST http://localhost:8000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "admin@example.com", "password": "test1234"}'

  # Set MCP sandbox URL
  curl -X PATCH http://localhost:8000/api/v0/settings/default \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <token>" \
    -d '{"mcp_sandbox_url": "http://localhost:3005"}'

  # Set sandbox type to mcp
  curl -X PATCH http://localhost:8000/api/v0/settings/default \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <token>" \
    -d '{"sandbox": "mcp"}'

  # Read settings
  curl -X GET http://localhost:8000/api/v0/settings \
    -H "Authorization: Bearer <token>"

  # Clear MCP sandbox URL
  curl -X PATCH http://localhost:8000/api/v0/settings/default \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <token>" \
    -d '{"mcp_sandbox_url": null}'
  ```

## Functional Requirements

- **FR-1:** The `SandboxType` enum must include `MCP = "mcp"` alongside existing `DAYTONA` and `STATE` values
- **FR-2:** `UserSettings` must store a `default_mcp_sandbox_url: Optional[str]` field for the user's MCP sandbox server URL
- **FR-3:** `GET /settings` must include `mcp_sandbox_url` in the `defaults` response object
- **FR-4:** `PATCH /settings/default` must accept `mcp_sandbox_url` to set or clear the URL
- **FR-5:** `PATCH /settings/default` must accept `sandbox: "mcp"` as a valid sandbox type
- **FR-6:** `resolve_sandbox_backend()` must accept an `mcp_sandbox_url` parameter and implement the dispatch rules:
  - `None`/`"auto"` -> Daytona -> MCP (if URL) -> State
  - `"state"` -> State only
  - `"daytona"` -> Daytona -> State
  - `"mcp"` -> MCP (if URL) -> State
- **FR-7:** When `sandbox_type="mcp"` but no URL is configured, the system must fall back to State silently (no crash)
- **FR-8:** `is_mcp_sandbox_error()` must correctly identify MCP sandbox connection failures
- **FR-9:** MCP errors in SSE streams must use the `mcp_sandbox_unreachable` error type
- **FR-10:** All three execution paths (invoke, stream, worker) must read `mcp_sandbox_url` from user settings and pass it to the dispatch function
- **FR-11:** When auto mode selects MCP and it fails at runtime, the system must fall back to State and retry (mirroring Daytona auto-fallback behavior)

## Non-Goals (Out of Scope)

- **No frontend UI for MCP sandbox settings** — frontend components for configuring `mcp_sandbox_url` are deferred to Phase 3+
- **No native MCP tool integration** — this phase wires the sandbox backend only, not MCP tool discovery or registration
- **No exec_server changes** — the MCP sandbox server itself is not modified; we only consume its URL
- **No URL validation or health checks** — the URL is stored as-is; connectivity is tested at dispatch time, not at save time
- **No per-assistant or per-chat MCP URL overrides** — the URL is per-user only (stored in `UserSettings`)
- **No migration of existing data** — the new field defaults to `None` which means MCP is not available
- **No hardcoded `MCP_SANDBOX_URL` environment variable** — the URL comes exclusively from user settings

## Technical Considerations

- **Phase 1 dependency:** `McpSandboxBackend` must exist before this phase can be implemented. The import should be conditional (try/except) to avoid breaking the app when Phase 1 is not yet merged.
- **Regression safety:** Existing Daytona and State dispatch paths must remain completely untouched for users who do not configure an MCP sandbox URL. The `resolve_sandbox_backend()` changes should be additive — when `mcp_sandbox_url` is `None`, the function behaves identically to its current implementation.
- **URL source:** The MCP sandbox URL is stored in `UserSettings.default_mcp_sandbox_url` and read through the same `settings_repo._get_or_create()` call that already fetches `default_sandbox`, `default_model`, etc. No additional database queries are needed.
- **Error handling pattern:** MCP errors follow the same pattern as Daytona errors — a type-checking helper (`is_mcp_sandbox_error()`) and branching logic in each execution path's exception handler. The `mcp_sandbox_unreachable` error type allows the frontend to display a targeted error message (e.g., "Your MCP sandbox server is unreachable").
- **Factory signature (RESOLVED):** `_create_mcp_backend_checked(runtime, mcp_sandbox_url)` takes 2 params unlike `_create_daytona_backend_checked(runtime)` (1 param) because the URL comes from user settings, not an env var. **The MCP factory should be special-cased in `resolve_sandbox_backend()`** rather than forced into the generic `_SANDBOX_FACTORIES` single-param dispatch. The `_SANDBOX_FACTORIES` dict can include `"mcp"` for type-recognition purposes, but the actual MCP factory call happens directly in the resolver with the extra `mcp_sandbox_url` param.
- **3 caller sites** must be updated: `LLMController._resolve_user_settings()` + `llm_invoke()` + `llm_stream()`, `stream_generator()`, and `_execute_agent_stream()`. All three already fetch user settings; we read one more field (`default_mcp_sandbox_url`) and pass it through.
- **Redis cache compatibility:** The new `default_mcp_sandbox_url` field on `UserSettings` is `Optional[str]` with default `None`, so existing cached settings will deserialize correctly via Pydantic's `model_validate()`.

## Success Metrics

- `PATCH /settings/default` with `{"sandbox": "mcp", "mcp_sandbox_url": "http://..."}` succeeds and is reflected in subsequent `GET /settings` responses
- `resolve_sandbox_backend(runtime, sandbox_type="mcp", mcp_sandbox_url="http://...")` returns an MCP-backed `CompositeBackend` with `effective_type="mcp"`
- `resolve_sandbox_backend(runtime, sandbox_type="mcp", mcp_sandbox_url=None)` falls back to State gracefully
- `resolve_sandbox_backend(runtime, sandbox_type=None, mcp_sandbox_url="http://...")` tries Daytona first, then MCP, then State
- All existing tests pass with zero modifications (no regressions)
- `make format`, `make lint`, and `make test` all pass at every user story boundary

## Open Questions

- Should `_create_mcp_backend_checked()` perform a lightweight health-check ping to the MCP URL during dispatch (adds latency but catches unreachable servers early), or defer failure to the first tool execution?
- Should invalid URLs (e.g., missing scheme, non-HTTP) be rejected at `PATCH /settings/default` time with a 400, or stored as-is and validated only at dispatch?
- ~~If Phase 1 introduces a specific exception type for MCP sandbox errors (e.g., `McpSandboxError`), should `is_mcp_sandbox_error()` check for that type?~~ RESOLVED: Yes, `is_mcp_sandbox_error()` should check for `McpSandboxError` (from Phase 1) in addition to generic connection errors (`ConnectionError`, `TimeoutError`, `OSError`). That is the helper's purpose.
