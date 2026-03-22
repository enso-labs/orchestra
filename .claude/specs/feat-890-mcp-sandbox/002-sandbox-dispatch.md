---
task: Sandbox Dispatch Wiring (Feature #890)
test_command: "cd backend && uv run pytest tests/unit/agents/ -v"
---

# Task: Sandbox Dispatch Wiring (Feature #890)

> **IMPORTANT**: Before implementing this feature, READ `/CLAUDE.md` first.

Wire `McpSandboxBackend` into the existing sandbox dispatch system. The MCP sandbox URL is **user-configurable** via the settings page (stored in `UserSettings`), not a hardcoded env var. Update the fallback chain to Daytona -> MCP (if URL configured) -> State, and add MCP-specific error handling to controllers and stream generator.

**Depends on**: Spec 001 (McpSandboxBackend class must exist)

## Requirements

1. **Add `MCP = "mcp"` to `SandboxType` enum** in `backend/src/schemas/entities/settings.py`
2. **Add `default_mcp_sandbox_url` field to `UserSettings`**:
   - `default_mcp_sandbox_url: Optional[str] = Field(default=None, description="User's MCP sandbox endpoint URL")`
   - This is the user-configured sandbox URL (e.g., `http://localhost:3005/mcp`)
3. **Add `mcp_sandbox_url` to API schemas**:
   - Add to `DefaultsResponse`: `mcp_sandbox_url: Optional[str] = None`
   - Add to `PatchDefaultsRequest`: `mcp_sandbox_url: Optional[str] = Field(default=None, description="MCP sandbox endpoint URL, or null to clear")`
4. **Wire settings repo** to read/write `mcp_sandbox_url`:
   - Update `backend/src/routes/v0/settings.py` to map `UserSettings.default_mcp_sandbox_url` <-> `DefaultsResponse.mcp_sandbox_url` and handle PATCH
5. **Add `_create_mcp_backend_checked()` factory** in `backend/src/agents/__init__.py`:
   - Accepts `runtime` and `mcp_sandbox_url: str` parameters
   - Instantiates `McpSandboxBackend(base_url=mcp_sandbox_url)`
   - Validates backend has `execute()` capability (same pattern as Daytona)
   - Returns `(CompositeBackend(default=mcp_backend), None)` on success, `None` on failure
6. **Register `"mcp"` in `_SANDBOX_FACTORIES`** — though MCP needs special handling since it requires the URL from user settings
7. **Update `resolve_sandbox_backend()`**:
   - Add `mcp_sandbox_url: str | None = None` parameter
   - Updated dispatch rules:
     - `None` / `"auto"` — try Daytona first, then MCP (if URL provided), then State
     - `"state"` — StateBackend directly
     - `"daytona"` — try Daytona, fall back to State
     - `"mcp"` — try MCP (if URL provided), fall back to State
   - Fallback chain: Daytona -> MCP -> State
8. **Update callers of `resolve_sandbox_backend()`** to pass `mcp_sandbox_url`:
   - `backend/src/controllers/llm.py` — read `default_mcp_sandbox_url` from settings, pass to dispatch
   - `backend/src/utils/stream.py` — same pattern
   - `backend/src/workers/tasks.py` — same pattern (if it calls resolve_sandbox_backend)
9. **Add MCP error handling** in `controllers/llm.py` and `utils/stream.py`:
   - Follow the existing Daytona error handling pattern
   - When `sandbox_type == "mcp"` and MCP fails: return specific error type `mcp_sandbox_unreachable` in the SSE stream so frontend can show the user-approved fallback toast
   - When `sandbox_type in (None, "auto")` and MCP fails: silently fall back to State (same as Daytona auto-fallback)
10. **Add `is_mcp_sandbox_error()` helper** in `backend/src/agents/__init__.py`:
    - Check if an exception is an MCP sandbox connection error (httpx.ConnectError, httpx.TimeoutException, etc.)

## Files to Modify

| File | Changes |
|------|---------|
| `backend/src/schemas/entities/settings.py` | Add `MCP` to `SandboxType` enum, add `default_mcp_sandbox_url` to `UserSettings`, `DefaultsResponse`, `PatchDefaultsRequest` |
| `backend/src/agents/__init__.py` | Add `_create_mcp_backend_checked()`, register in factories, update `resolve_sandbox_backend()` signature and logic, add `is_mcp_sandbox_error()` |
| `backend/src/controllers/llm.py` | Read `default_mcp_sandbox_url` from settings, pass to `resolve_sandbox_backend()`, add MCP error handling with `mcp_sandbox_unreachable` error type |
| `backend/src/utils/stream.py` | Accept and pass `mcp_sandbox_url`, add MCP error handling with `mcp_sandbox_unreachable` SSE event |
| `backend/src/routes/v0/settings.py` | Map `default_mcp_sandbox_url` field in settings CRUD |
| `backend/src/workers/tasks.py` | Pass `mcp_sandbox_url` if it calls `resolve_sandbox_backend()` |

## Code Changes (Key Snippets)

### settings.py — SandboxType enum:
```python
class SandboxType(str, Enum):
    DAYTONA = "daytona"
    STATE = "state"
    MCP = "mcp"
```

### settings.py — UserSettings:
```python
class UserSettings(BaseEntity):
    # ... existing fields ...
    default_mcp_sandbox_url: Optional[str] = Field(
        default=None, description="User's MCP sandbox endpoint URL"
    )
```

### agents/__init__.py — factory:
```python
def _create_mcp_backend_checked(
    runtime: ToolRuntime,
    mcp_sandbox_url: str,
) -> tuple[CompositeBackend, None] | None:
    from src.agents.mcp_sandbox import McpSandboxBackend
    try:
        mcp_backend = McpSandboxBackend(base_url=mcp_sandbox_url)
        backend = CompositeBackend(default=mcp_backend, routes={})
        return backend, None
    except Exception as exc:
        logger.error(f"Failed to create MCP sandbox backend: {exc}")
        return None
```

### agents/__init__.py — updated resolve_sandbox_backend:
```python
def resolve_sandbox_backend(
    runtime: ToolRuntime,
    sandbox_type: str | None = None,
    mcp_sandbox_url: str | None = None,
) -> tuple[CompositeBackend, Any, str]:
    effective = sandbox_type if sandbox_type in _SANDBOX_FACTORIES else None

    if effective == "state":
        backend, sandbox = _create_state_backend(runtime)
        return backend, sandbox, "state"

    if effective == "mcp":
        if mcp_sandbox_url:
            result = _create_mcp_backend_checked(runtime, mcp_sandbox_url)
            if result is not None:
                return result[0], result[1], "mcp"
        # MCP requested but unavailable — fall back to state
        backend, sandbox = _create_state_backend(runtime)
        return backend, sandbox, "state"

    # "daytona" or auto (None) — try Daytona first, then MCP, then State
    result = _create_daytona_backend_checked(runtime)
    if result is not None:
        return result[0], result[1], "daytona"

    # Try MCP if URL is configured
    if mcp_sandbox_url:
        result = _create_mcp_backend_checked(runtime, mcp_sandbox_url)
        if result is not None:
            return result[0], result[1], "mcp"

    # Fallback: plain StateBackend
    backend, sandbox = _create_state_backend(runtime)
    return backend, sandbox, "state"
```

### controllers/llm.py — MCP error handling:
```python
# In _resolve_user_settings, also read mcp_sandbox_url:
default_mcp_sandbox_url = getattr(settings, "default_mcp_sandbox_url", None)
return model, api_key, default_sandbox, default_mcp_sandbox_url

# In llm_invoke/llm_stream, pass mcp_sandbox_url:
backend, _sandbox, effective_type = resolve_sandbox_backend(
    runtime, sandbox_type=default_sandbox, mcp_sandbox_url=default_mcp_sandbox_url
)

# MCP error handling (in except block):
if is_mcp_sandbox_error(e):
    if default_sandbox == "mcp":
        # Explicit MCP mode: return mcp_sandbox_unreachable error
        logger.error(f"MCP sandbox error (mcp mode): {e}")
        raise  # Let frontend handle via toast
    elif default_sandbox in (None, "auto") and effective_type == "mcp":
        # Auto mode: silent fallback to State
        logger.warning(f"MCP sandbox error in auto mode, falling back to state: {e}")
        fallback_backend, _ = _create_state_backend(runtime)
        # ... retry with fallback_backend ...
```

### utils/stream.py — MCP error SSE event:
```python
# In the except block, after Daytona error handling:
elif is_mcp_sandbox_error(e):
    if sandbox_type == "mcp":
        logger.error(f"MCP sandbox error (mcp mode): {e}")
        error_msg = ujson.dumps(("mcp_sandbox_unreachable", str(e)))
        yield f"data: {error_msg}\n\n"
    elif sandbox_type in (None, "auto") and effective_type == "mcp":
        # Auto mode: silent fallback
        logger.warning(f"MCP sandbox error in auto mode, falling back: {e}")
        fallback_backend, _ = _create_state_backend(runtime)
        agent = await construct_agent(...)
        async for chunk in agent.astream(input, **astream_kwargs):
            sse_line = _process_and_format_chunk(chunk, agent.model, state)
            if sse_line:
                yield sse_line
```

## Success Criteria

1. [ ] `SandboxType` enum includes `MCP = "mcp"` value
2. [ ] `UserSettings` has `default_mcp_sandbox_url: Optional[str]` field
3. [ ] `DefaultsResponse` includes `mcp_sandbox_url` field
4. [ ] `PatchDefaultsRequest` includes `mcp_sandbox_url` field
5. [ ] Settings API PATCH endpoint accepts and persists `mcp_sandbox_url`
6. [ ] Settings API GET endpoint returns `mcp_sandbox_url` in defaults
7. [ ] `_create_mcp_backend_checked()` factory exists and creates `McpSandboxBackend` from user's URL
8. [ ] `resolve_sandbox_backend()` accepts `mcp_sandbox_url` parameter
9. [ ] Dispatch chain: Daytona -> MCP (if URL configured) -> State for auto/None
10. [ ] Explicit `sandbox_type="mcp"` tries MCP, falls back to State if unavailable
11. [ ] `is_mcp_sandbox_error()` helper correctly identifies MCP connection errors
12. [ ] `controllers/llm.py` reads `default_mcp_sandbox_url` from settings and passes to dispatch
13. [ ] `utils/stream.py` handles MCP errors with `mcp_sandbox_unreachable` SSE event type
14. [ ] No hardcoded `MCP_SANDBOX_URL` env var — URL comes exclusively from user settings
15. [ ] Existing Daytona and State sandbox flows are unaffected (regression-safe)
16. [ ] Code passes `make format` and `make lint`

## Example Output

```bash
# Verify SandboxType enum
cd backend && uv run python -c "from src.schemas.entities.settings import SandboxType; print(SandboxType.MCP)"
# SandboxType.MCP

# Verify factory registration
cd backend && uv run python -c "from src.agents import _SANDBOX_FACTORIES; print(list(_SANDBOX_FACTORIES.keys()))"
# ['daytona', 'state', 'mcp']

# API: Set MCP sandbox URL
curl -X PATCH http://localhost:8000/api/settings/default \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mcp_sandbox_url": "http://localhost:3005/mcp", "sandbox": "mcp"}'
# {"defaults": {"sandbox": "mcp", "mcp_sandbox_url": "http://localhost:3005/mcp", ...}}
```

---

## Ralph Instructions

1. Work on the next incomplete criterion (marked [ ])
2. Check off completed criteria (change [ ] to [x])
3. Run tests after changes: `cd backend && uv run pytest tests/unit/agents/ -v`
4. Run format after changes: `cd backend && make format`
5. Commit your changes frequently
6. When ALL criteria are [x], output: `<ralph>COMPLETE</ralph>`
7. If stuck on the same issue 3+ times, output: `<ralph>GUTTER</ralph>`
