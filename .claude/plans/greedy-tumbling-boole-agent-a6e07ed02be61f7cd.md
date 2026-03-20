# Technical Consistency Audit: MCP Sandbox Feature (#890)

## Summary

Overall **Score: 6.5/10** -- The specifications, PRDs, and Ralph stories are largely consistent with each other in terms of design intent, but contain **15 concrete discrepancies** with the existing codebase that must be resolved before implementation. The most critical issues are constructor signature inconsistencies, a breaking change to `_resolve_user_settings`, and a missing field mapping in the settings repo.

---

## Dimension 1: API Contract Consistency

### DISCREPANCY 1 -- `_resolve_user_settings` 3-tuple to 4-tuple is a breaking change

**Severity: HIGH**

The existing `_resolve_user_settings()` at `/home/ryaneggz/ruska-ai/orchestra/backend/src/controllers/llm.py:70` returns a 3-tuple:

```python
async def _resolve_user_settings(self, model: str) -> tuple[str, str | None, str | None]:
    # Returns (model, api_key, default_sandbox)
```

All three callers unpack it as a 3-tuple:
- `llm_invoke` line 121: `params.model, api_key, default_sandbox = await self._resolve_user_settings(params.model)`
- `llm_stream` line 211: `assistant.model, api_key, default_sandbox = await self._resolve_user_settings(assistant.model)`

The specs (002-sandbox-dispatch.md, prd-mcp-sandbox-dispatch.md) and Ralph US-020 propose changing this to a 4-tuple `(model, api_key, default_sandbox, mcp_sandbox_url)`. **Every existing call site must be updated simultaneously or they will crash with a ValueError from tuple unpacking.** The artifacts correctly identify both callsites, but do not mention that the worker task (`_execute_agent_stream` in `tasks.py`) independently duplicates this logic (lines 421-431) rather than calling `_resolve_user_settings()`. The worker reads `default_sandbox` directly from `settings` -- the same pattern must be replicated for `mcp_sandbox_url`.

**Status: Acknowledged in artifacts** -- US-022 and prd-mcp-sandbox-dispatch US-008 both address the worker, but the worker does NOT call `_resolve_user_settings()` -- it has its own inline settings resolution. The spec says "mirrors LLMController._resolve_user_settings" which is accurate.

### DISCREPANCY 2 -- `DefaultsResponse` missing `mcp_sandbox_url` field in `_build_response()`

**Severity: HIGH**

The specs and PRDs propose adding `mcp_sandbox_url` to `DefaultsResponse`. The existing `_build_response()` in `/home/ryaneggz/ruska-ai/orchestra/backend/src/routes/v0/settings.py:24-40` explicitly maps each field:

```python
defaults=DefaultsResponse(
    model=settings.default_model,
    sandbox=settings.default_sandbox,
    # ... 9 explicit fields ...
    timezone=settings.default_timezone,
)
```

The specs (002-sandbox-dispatch.md criteria #3, prd-mcp-sandbox-dispatch US-002) correctly identify that `_build_response()` must be updated. However, they also reference `_DEFAULTS_FIELD_MAP` in `UserSettingsRepo` -- and this mapping at `/home/ryaneggz/ruska-ai/orchestra/backend/src/repos/user_settings_repo.py:188-200` does NOT currently have `mcp_sandbox_url`. Both the `_build_response()` mapping AND `_DEFAULTS_FIELD_MAP` must be updated. The PRD correctly identifies both.

**Status: Consistently identified across artifacts.**

### DISCREPANCY 3 -- `PatchDefaultsRequest` has no `mcp_sandbox_url` field yet

**Severity: MEDIUM**

The existing `PatchDefaultsRequest` in `settings.py:87-108` does not include `mcp_sandbox_url`. The `patch_defaults()` method in the repo uses `_DEFAULTS_FIELD_MAP` to translate short keys to entity field names. Both the field on `PatchDefaultsRequest` and the repo map entry are needed. Additionally, the `patch_defaults()` method validates `sandbox` against `SandboxType` enum values (line 204-207) -- once `MCP = "mcp"` is added to the enum, `sandbox: "mcp"` will be accepted automatically.

**Status: Consistently identified.**

### DISCREPANCY 4 -- SSE error event format inconsistency between spec and PRD

**Severity: MEDIUM**

The spec 002 (`002-sandbox-dispatch.md`) shows the SSE error as:
```python
error_msg = ujson.dumps(("mcp_sandbox_unreachable", str(e)))
```

But the frontend PRD (`prd-mcp-sandbox-frontend.md`) describes the SSE event as:
```
data: ["mcp_sandbox_unreachable", {"message": "Connection refused"}]
```

And the dispatch PRD (`prd-mcp-sandbox-dispatch.md` US-007) says:
```python
("error", {"type": "mcp_sandbox_unreachable", "message": "<detail>"})
```

These are **three different wire formats**. The existing Daytona pattern in `stream.py:417` uses:
```python
error_msg = ujson.dumps(("error", f"Daytona sandbox error: {e}"))
```

The artifacts must agree on ONE format. The existing pattern is `("error", <string>)`. To add a typed error, a structured format like `("error", {"type": "mcp_sandbox_unreachable", "message": str(e)})` would be the least disruptive, but the frontend must be updated to parse both string and dict payloads for the `"error"` event.

---

## Dimension 2: Existing Pattern Conformance

### DISCREPANCY 5 -- MCP factory signature differs from Daytona factory

**Severity: MEDIUM**

The existing `_create_daytona_backend_checked(runtime)` takes only `runtime` as a parameter and returns `tuple[CompositeBackend, Any] | None`. The proposed `_create_mcp_backend_checked(runtime, mcp_sandbox_url)` takes an extra parameter. This means it CANNOT be registered in `_SANDBOX_FACTORIES` the same way as Daytona, because the factory dispatch in `resolve_sandbox_backend()` (line 334) currently calls factories with just `runtime`:

```python
effective = sandbox_type if sandbox_type in _SANDBOX_FACTORIES else None
```

The specs acknowledge this -- they propose special-casing MCP in `resolve_sandbox_backend()` rather than using the factory dict generically. However, the Ralph story US-017 says `'mcp' key added to _SANDBOX_FACTORIES dict` while simultaneously noting the factory needs a URL parameter. This creates an inconsistency: registering in the dict is cosmetic since MCP can't be dispatched through the generic path.

**Recommendation:** Either update the factory protocol to accept `**kwargs`, or don't register MCP in `_SANDBOX_FACTORIES` and handle it explicitly in `resolve_sandbox_backend()`.

### DISCREPANCY 6 -- `is_mcp_sandbox_error()` does not check for `McpSandboxError`

**Severity: LOW**

The spec 002 and Ralph US-019 define `is_mcp_sandbox_error()` as checking for `ConnectionError, TimeoutError, OSError, and McpSandboxError`. The existing `is_daytona_error()` at `agents/__init__.py:49-53` uses `isinstance(exc, DaytonaError)` -- a single type check. The MCP version proposes checking multiple exception types, which is a different pattern. Additionally, `McpSandboxError` is defined in `mcp_sandbox.py` (spec 001), but `is_mcp_sandbox_error()` is in `agents/__init__.py` (spec 002). This means `agents/__init__.py` will need to import from `mcp_sandbox.py`, creating a cross-module dependency. The Daytona pattern avoids this because `DaytonaError` comes from an external package.

**Recommendation:** Use a conditional import (try/except) for `McpSandboxError`, mirroring the Daytona conditional import pattern at `agents/__init__.py:23-31`.

### DISCREPANCY 7 -- Frontend visibility gating pattern differs from Daytona

**Severity: LOW**

The existing Daytona gating in `SandboxSettings.tsx:35-43` uses `providerKeys` to filter:
```typescript
if (opt.value !== "daytona") return true;
return providerKeys.some(k => k.provider === "DAYTONA_API_KEY" && k.is_set);
```

The proposed MCP gating uses `mcp_sandbox_url` (a string from settings, not from `providerKeys`). This means:
1. `SandboxSettings.tsx` needs new state for `mcpSandboxUrl` (currently does not exist)
2. The `visibleOptions` memo must depend on both `providerKeys` AND `mcpSandboxUrl`
3. The `getSettings()` response must be parsed for `mcp_sandbox_url`

The specs correctly identify this, and the pattern is sound. The state management is different from Daytona (provider key vs. URL string) but the filtering logic is analogous. The frontend PRD and spec 003 handle this consistently.

---

## Dimension 3: Import Path Validity

### DISCREPANCY 8 -- Spec 001 references `BaseSandbox` from `deepagents.backends.sandbox`

**Severity: HIGH (needs verification)**

Spec 001 and the PRD reference:
```python
from deepagents.backends.sandbox import BaseSandbox, ExecuteResponse, FileUploadResponse, FileDownloadResponse
```

The codebase imports from `deepagents.backends`:
```python
from deepagents.backends import CompositeBackend, StateBackend
```
(at `agents/__init__.py:18`)

The exact module path `deepagents.backends.sandbox` for `BaseSandbox` is stated in the spec but **cannot be verified** without inspecting the installed `deepagents` package. The spec's PRD notes it's at `deepagents.backends.sandbox` and references `langchain_daytona/sandbox.py` as using the same base class.

**Recommendation:** Verify with `python -c "from deepagents.backends.sandbox import BaseSandbox"` before implementing.

### DISCREPANCY 9 -- Spec 001 constructor signature `base_url` vs `url`

**Severity: HIGH**

The spec 001 markdown shows **two different constructor signatures**:

1. In the PRD (`prd-mcp-sandbox-backend.md` US-001): `__init__(self, *, base_url: str, api_key: str | None = None)` -- keyword-only, parameter named `base_url`
2. In the spec class skeleton (`001-mcp-sandbox-backend.md`): `__init__(self, url: str, api_key: str | None = None)` -- positional, parameter named `url`
3. In the Ralph prd.json US-001: `__init__(self, *, base_url: str, api_key: str | None = None)` -- keyword-only, named `base_url`

The spec 002 factory code references:
```python
McpSandboxBackend(url=mcp_sandbox_url)
```

This inconsistency between `base_url` and `url` will cause an import-time or call-time error depending on which spec is followed.

The `id` property uses `self._base_url` in the PRD but the spec skeleton stores it as `self._url`. The Ralph stories reference both.

**Recommendation:** Standardize on one name. Given the `_base_url` property in the spec skeleton, `url` as constructor param with `self._url` as attribute (and `_base_url()` as a derived method) seems cleanest. But all specs must agree.

### DISCREPANCY 10 -- `execute()` timeout parameter type mismatch

**Severity: MEDIUM**

- Spec 001 class skeleton: `timeout: float | None = None`
- Ralph US-004: `timeout: int | None = None`
- PRD US-003: `timeout: int | None = None`

The exec_server (spec 004) expects `timeout?: number` in Zod (which maps to both int and float in JSON). Using `int` is more restrictive but the underlying httpx accepts both. This should be `int | None` for consistency with the PRD.

---

## Dimension 4: Method Signature Accuracy

### DISCREPANCY 11 -- `resolve_sandbox_backend()` current signature vs proposed

**Severity: HIGH**

Current signature at `agents/__init__.py:319-322`:
```python
def resolve_sandbox_backend(
    runtime: ToolRuntime,
    sandbox_type: str | None = None,
) -> tuple[CompositeBackend, Any, str]:
```

Proposed (spec 002, Ralph US-018):
```python
def resolve_sandbox_backend(
    runtime: ToolRuntime,
    sandbox_type: str | None = None,
    mcp_sandbox_url: str | None = None,
) -> tuple[CompositeBackend, Any, str]:
```

Adding a new keyword-only parameter with a default is backward-compatible. All existing callers pass `sandbox_type` as a keyword argument:
- `llm.py:142`: `resolve_sandbox_backend(runtime, sandbox_type=default_sandbox)`
- `stream.py:376`: `resolve_sandbox_backend(runtime, sandbox_type=sandbox_type)`
- `tasks.py:455`: `resolve_sandbox_backend(runtime, sandbox_type=default_sandbox)`

**Status: This is safe.** The new `mcp_sandbox_url` parameter with default `None` will not break any existing callers.

### DISCREPANCY 12 -- `stream_generator()` signature change

**Severity: MEDIUM**

Current signature at `stream.py:321-333`:
```python
async def stream_generator(
    input: LLMInput,
    model: BaseChatModel,
    system_prompt: str,
    tools: list[BaseTool],
    subagents: list[SubAgent],
    config: RunnableConfig,
    service_context: ServiceContext,
    instructions: str = None,
    api_key: str | None = None,
    sandbox_type: str | None = None,
    stream_mode: list[str] | None = None,
):
```

The spec proposes adding `mcp_sandbox_url: str | None = None`. The caller in `llm.py:213-225` passes keyword arguments:

```python
return stream_generator(
    input=assistant.input,
    ...
    sandbox_type=default_sandbox,
    stream_mode=assistant.resolved_stream_mode,
)
```

Adding `mcp_sandbox_url` as a new keyword-only parameter with default is safe, but the caller must also pass it. The spec and PRD correctly identify this.

---

## Dimension 5: Type System Consistency

### DISCREPANCY 13 -- `UserSettings.default_mcp_sandbox_url` vs `default_mcp` field name collision risk

**Severity: LOW**

The existing `UserSettings` has `default_mcp: Optional[dict]` (line 46 of settings.py) which is for MCP server configuration. The proposed new field is `default_mcp_sandbox_url: Optional[str]`. These are clearly different -- `default_mcp` is the MCP tool server config, `default_mcp_sandbox_url` is the sandbox server URL. However, the naming proximity could cause confusion. The spec/PRD are consistent with each other on the naming.

### DISCREPANCY 14 -- Frontend `SandboxType` is a string union, not an enum

**Severity: LOW**

Backend uses `SandboxType(str, Enum)` but frontend uses `type SandboxType = "daytona" | "state"`. The specs correctly propose adding `| "mcp"` to the frontend union and `MCP = "mcp"` to the backend enum. These are consistent.

### DISCREPANCY 15 -- `ThreadSandboxStatus.tsx` file path discrepancy in specs

**Severity: LOW**

Spec 003 references the file at:
```
frontend/src/components/tools/ThreadSandboxStatus.tsx
```

But the actual file is at:
```
frontend/src/components/status/ThreadSandboxStatus.tsx
```

The correct path is `/home/ryaneggz/ruska-ai/orchestra/frontend/src/components/status/ThreadSandboxStatus.tsx`. The spec's "Files" table at the bottom of 003 says `frontend/src/components/tools/ThreadSandboxStatus.tsx` -- **this is wrong**.

---

## Dimension 6: Cross-Artifact Consistency

### Phase dependency chain verification

The Ralph prd.json organizes 59 user stories across 5 phases (P1-P5) with priorities 1-59. The dependency chain is:

- **P1 (US-001 to US-014):** McpSandboxBackend class -- **no dependencies, self-contained**
- **P2 (US-015 to US-023):** Dispatch wiring -- **depends on P1** (needs `McpSandboxBackend`)
- **P3 (US-036 to US-045):** Frontend -- **independent** of P1/P4, depends on P2 API contract only
- **P4 (US-024 to US-035):** exec_server tools -- **independent** (separate submodule)
- **P5 (US-046 to US-059):** Native MCP tools -- **depends on P2 + P4**

The dependency chain is correctly specified. P3 frontend can be built against the API contract from P2 without needing the actual backend implementation.

### Spec-to-Ralph story mapping

All 5 specs map cleanly to Ralph user stories:
- Spec 001 -> Ralph US-001 to US-014 (P1)
- Spec 002 -> Ralph US-015 to US-023 (P2)
- Spec 003 -> Ralph US-036 to US-045 (P3)
- Spec 004 -> Ralph US-024 to US-035 (P4)
- Spec 005 -> Ralph US-046 to US-059 (P5)

The PRD files (`tasks/prd-*.md`) align with their corresponding specs. No orphaned stories.

### Tool name: `exec_command` vs `execute` transition

Spec 004 renames `exec_command` to `execute` (clean break, no alias). Spec 005 (v2) adds dual-name support (`execute` preferred, `exec_command` fallback). Spec 001 (Phase 1) uses `exec_command` exclusively. This is intentionally sequential:
1. P1 ships with `exec_command` (current exec_server)
2. P4 renames to `execute` (new exec_server)
3. P5 adds client-side support for both names

This is consistent and well-designed.

---

## Summary of All Discrepancies

| # | Severity | Description | Files Affected |
|---|----------|-------------|----------------|
| 1 | HIGH | `_resolve_user_settings` 3-to-4-tuple breaking change requires all callers updated simultaneously | `controllers/llm.py`, `workers/tasks.py` |
| 2 | HIGH | `_build_response()` must add `mcp_sandbox_url` mapping | `routes/v0/settings.py` |
| 3 | MEDIUM | `PatchDefaultsRequest` and `_DEFAULTS_FIELD_MAP` both need updates | `schemas/entities/settings.py`, `repos/user_settings_repo.py` |
| 4 | MEDIUM | SSE error event wire format inconsistent across 3 artifacts | `utils/stream.py`, frontend event handlers |
| 5 | MEDIUM | MCP factory can't fit generic `_SANDBOX_FACTORIES` dispatch protocol | `agents/__init__.py` |
| 6 | LOW | `is_mcp_sandbox_error()` needs conditional import pattern | `agents/__init__.py` |
| 7 | LOW | MCP visibility gating uses URL (not provider key) -- new state needed | `SandboxSettings.tsx`, `ThreadSandboxStatus.tsx` |
| 8 | HIGH | `deepagents.backends.sandbox.BaseSandbox` import path unverified | `agents/mcp_sandbox.py` (new) |
| 9 | HIGH | Constructor param named `base_url` in PRD vs `url` in spec skeleton | `agents/mcp_sandbox.py` (new), `agents/__init__.py` |
| 10 | MEDIUM | `execute()` timeout type: `float` in spec skeleton vs `int` in PRD/Ralph | `agents/mcp_sandbox.py` (new) |
| 11 | HIGH | `resolve_sandbox_backend()` signature change is safe (backward-compatible) | `agents/__init__.py` |
| 12 | MEDIUM | `stream_generator()` must pass new `mcp_sandbox_url` param | `utils/stream.py`, `controllers/llm.py` |
| 13 | LOW | `default_mcp` vs `default_mcp_sandbox_url` naming proximity | `schemas/entities/settings.py` |
| 14 | LOW | Frontend/backend type systems aligned (union vs enum) | N/A |
| 15 | LOW | `ThreadSandboxStatus.tsx` file path wrong in spec 003 | Spec 003 only |

---

## Score Justification: 6.5/10

**Positives (pushing score up):**
- The overall architecture is sound and well-decomposed across 5 phases
- Dependency ordering is correct -- phases can be parallelized as documented
- The fallback chain design (Daytona -> MCP -> State) follows the existing pattern cleanly
- Frontend patterns (visibility gating, health hook, toast) are well-aligned with existing code
- Return type parity requirements in Phase 5 are thorough and correct
- The worker task (`tasks.py`) is correctly identified as a third caller site

**Negatives (pushing score down):**
- **Constructor name disagreement** (`base_url` vs `url`) across 3 artifacts is a guaranteed implementation bug
- **SSE wire format** has 3 different proposals across the artifacts
- **The `_SANDBOX_FACTORIES` registration** is specified but impractical given the different factory signature
- **Import path for `BaseSandbox`** is assumed correct but unverified against the installed package
- **File path for ThreadSandboxStatus** is wrong in spec 003 (`tools/` vs `status/`)
- The `timeout` type inconsistency (`float` vs `int`) is minor but will cause a type-check failure if not resolved

The specs are internally well-structured and thorough. The main gaps are cross-artifact coordination issues (naming, wire formats) and a few assumptions about the codebase that don't match reality. Fixing the 5 HIGH-severity items before implementation would raise this to an 8/10.
