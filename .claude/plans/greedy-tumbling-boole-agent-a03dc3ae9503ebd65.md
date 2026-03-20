# Acceptance Criteria Alignment Audit — MCP Sandbox Feature #890

## Artifact Legend

| Abbreviation | File |
|---|---|
| **PRD** | `.ralph/prd.json` (59 user stories, the master source) |
| **Spec-001** | `.claude/specs/.../001-mcp-sandbox-backend.md` |
| **Spec-002** | `.claude/specs/.../002-sandbox-dispatch.md` |
| **Spec-003** | `.claude/specs/.../003-frontend-mcp-option.md` |
| **Spec-004** | `.claude/specs/.../004-exec-server-structured.md` |
| **Spec-005** | `.claude/specs/.../005-mcp-sandbox-v2.md` |
| **Task-Backend** | `tasks/prd-mcp-sandbox-backend.md` |
| **Task-Dispatch** | `tasks/prd-mcp-sandbox-dispatch.md` |
| **Task-Frontend** | `tasks/prd-mcp-sandbox-frontend.md` |
| **Task-ExecServer** | `tasks/prd-mcp-sandbox-exec-server.md` |
| **Task-V2** | `tasks/prd-mcp-sandbox-v2-native.md` |

---

## CRITICAL Contradictions (Would Cause Implementation Bugs)

### C-1: Constructor Signature — `base_url` vs `url` vs keyword-only

| Artifact | Constructor Signature |
|---|---|
| PRD US-001 | `__init__(self, *, base_url: str, api_key: str \| None = None)` |
| Spec-001 (skeleton) | `__init__(self, url: str, api_key: str \| None = None)` |
| Spec-001 (usage) | `McpSandboxBackend(url="http://localhost:3005/mcp")` |
| Task-Backend US-001 | `__init__(self, *, base_url: str, api_key: str \| None = None)` |
| Spec-002 (factory) | `McpSandboxBackend(url=mcp_sandbox_url)` |
| Spec-005 (usage) | `McpSandboxBackend(url="http://localhost:3005/mcp")` |

**Contradiction:** PRD and Task-Backend use `base_url` as keyword-only (`*`). Spec-001, Spec-002, and Spec-005 use `url` as a positional parameter. An implementer following the spec would use `url`, while someone following the PRD/task would use `base_url`. The factory in Spec-002 calls `McpSandboxBackend(url=mcp_sandbox_url)` which would fail if the constructor expects `base_url`.

**Impact:** Factory instantiation in `_create_mcp_backend_checked()` will crash with `TypeError` if the parameter name is wrong.

### C-2: URL Semantics — Base URL vs Full MCP Endpoint URL

| Artifact | What the URL Represents |
|---|---|
| PRD US-001 | `base_url` = server root (e.g., `http://localhost:3005`), `/mcp` appended internally |
| PRD US-004 | Posts to `{base_url}/mcp` |
| PRD US-005 | `id` returns `f"mcp-sandbox:{self._base_url}"` -> `"mcp-sandbox:http://localhost:3005"` |
| Spec-001 (skeleton) | `url` = "Full MCP endpoint URL (e.g., `http://localhost:3005/mcp`)" |
| Spec-001 (usage) | `McpSandboxBackend(url="http://localhost:3005/mcp")` |
| Spec-001 (class) | Has `_base_url()` helper: "Derive base URL from MCP URL (strip /mcp path)" |
| Task-Backend US-001 | `base_url` stored with trailing slash stripped; no mention of `/mcp` being part of it |
| Task-Backend US-002 | Posts to `{base_url}/mcp` |
| Task-Backend open Q5 | "Should the backend accept `base_url` only, or a full URL with `/mcp` path?" |

**Contradiction:** The PRD stores a `base_url` like `http://localhost:3005` and appends `/mcp` internally. The Spec stores a `url` like `http://localhost:3005/mcp` (full endpoint) and strips `/mcp` to derive the base URL. These are inverse approaches. The `id` property in the PRD returns `mcp-sandbox:http://localhost:3005`, but if the Spec approach is followed, the stored URL includes `/mcp` so the id would be `mcp-sandbox:http://localhost:3005/mcp`.

**Impact:** The health check, session termination (DELETE), and `id` property will all generate wrong URLs if the URL convention is mismatched.

### C-3: `httpx.AsyncClient` vs `httpx.Client` (Sync vs Async)

| Artifact | HTTP Client |
|---|---|
| PRD US-001 | "An `httpx.AsyncClient` is created" |
| PRD US-004 (execute) | Async (implies async client) |
| Task-Backend (considerations) | "Should we use `httpx.Client` (sync) to match `DaytonaSandbox` pattern, or `httpx.AsyncClient`?" and "The sync approach is simpler and matches existing patterns." |
| Spec-001 (class skeleton) | `httpx.AsyncClient(timeout=httpx.Timeout(130.0))` |
| Spec-001 (skeleton) | All methods are `async def` |

**Contradiction:** The Task-Backend's Technical Considerations section strongly recommends `httpx.Client` (sync) for consistency with `DaytonaSandbox`, noting that `BaseSandbox.execute()` is synchronous. However, the PRD, the spec, and the class skeleton all use `httpx.AsyncClient` with `async def` methods. The Task even asks this as an open question while the PRD has already decided on async.

**Impact:** If sync is used, all the `await` calls in the spec code snippets would fail. If async is used, there may be compatibility issues with `BaseSandbox`'s sync `execute()` contract.

### C-4: Default Client Timeout — 120s vs 130s

| Artifact | Timeout |
|---|---|
| PRD US-001 | "default timeout of 120 seconds" |
| Spec-001 (skeleton) | `httpx.Timeout(130.0)` |
| Task-Backend | Open question: "Should the default timeout (120s) match the exec_server's timeout (120s)?" |

**Contradiction:** The PRD says 120 seconds. The spec skeleton code says 130 seconds. The task identifies this as an open question. 130s would give 10s headroom above the exec_server's 120s internal limit, but the PRD explicitly says 120s.

**Impact:** With a 120s client timeout and a 120s server timeout, race conditions could cause premature client-side timeouts when the server is at its limit.

### C-5: MCP Protocol Version — "2024-11-05" vs "2025-03-26"

| Artifact | Protocol Version |
|---|---|
| PRD US-003 | Not specified directly |
| Spec-001 (protocol details) | `"protocolVersion": "2024-11-05"` |
| Task-Backend US-002 | `"protocolVersion": "2025-03-26"` |

**Contradiction:** The spec uses `"2024-11-05"` in the JSON-RPC initialize example. The task uses `"2025-03-26"`. These are different MCP protocol versions with potentially different capabilities.

**Impact:** Using the wrong protocol version could cause the exec_server to reject the handshake or behave differently.

### C-6: Tool Name Contradiction — `exec_command` vs `execute` in Phase 1

| Artifact | Phase 1 Tool Name |
|---|---|
| PRD US-004 | `exec_command` |
| PRD US-024 | Rename `exec_command` to `execute` in Phase 4 |
| PRD US-049 | Phase 5 supports both `execute` (new) and `exec_command` (old) |
| Spec-001 | `exec_command` (consistent) |
| Spec-004 | Renames to `execute`, removes `exec_command` |
| Task-Backend | `exec_command` (consistent) |

**Consistent within phases** but the rename creates a **breaking change** in Spec-004 ("No backward compatibility alias") while PRD US-049/Spec-005 expects to support both. If Spec-004 is deployed without Spec-005, the existing Phase 1 backend will break because `exec_command` no longer exists.

**Impact:** Deployment ordering matters. If exec_server is updated (Phase 4) before the backend is updated (Phase 5), the Phase 1 backend calling `exec_command` will fail with tool-not-found errors.

### C-7: `_ensure_initialized()` vs `_ensure_session()` Method Name

| Artifact | Method Name |
|---|---|
| PRD US-003, US-004, US-011 | `_ensure_initialized()` |
| Spec-001 (skeleton) | `_ensure_session()` |
| Spec-005 | `_ensure_session()` |
| Task-Backend US-002, US-003 | `_ensure_initialized()` |
| Task-V2 US-001 | `_ensure_session()` |

**Contradiction:** PRD and Task-Backend use `_ensure_initialized()`. Specs use `_ensure_session()`. These are the same method with different names.

**Impact:** Tests and cross-references in PRD user stories referencing `_ensure_initialized()` would fail if the spec's `_ensure_session()` name is implemented.

### C-8: `clientInfo.name` — "orchestra" vs "orchestra-backend"

| Artifact | clientInfo.name |
|---|---|
| Spec-001 (protocol details) | `"name": "orchestra"` |
| Task-Backend US-002 | `"name": "orchestra-backend"` |

**Contradiction:** Different client identity strings in the MCP handshake.

**Impact:** Minor functionally (servers typically log this), but indicates spec drift.

---

## MAJOR Inconsistencies (Significant Discrepancy)

### M-1: Health Check Timeout — 5s vs 3s

| Artifact | Health Timeout |
|---|---|
| PRD US-008 | 5 seconds |
| PRD US-014 (test) | "Test: health() uses a 5-second timeout" |
| Task-Backend US-007 | 5 seconds |
| Task-Frontend US-006 | 3 seconds ("Fetch uses a short timeout (3 seconds)") |
| Spec-003 | Not specified for backend; frontend hook: no timeout mentioned in AC |

**Discrepancy:** The backend health check uses 5 seconds. The frontend health hook uses 3 seconds. These serve different purposes (backend: server-to-server, frontend: browser-to-server), but the inconsistency should be documented.

### M-2: upload_files() Error Values — "permission_denied" Only vs "permission_denied" + "invalid_path"

| Artifact | Error Values |
|---|---|
| PRD US-006 | `error="permission_denied"` on non-zero exit |
| Task-Backend US-005 | `error="permission_denied"` on non-zero exit PLUS `error="invalid_path"` for paths not starting with `/` |

**Discrepancy:** The Task-Backend adds an `invalid_path` error case for paths not starting with `/`. The PRD does not mention path validation at all. This is an additional AC in the task not present in the PRD.

### M-3: download_files() Error Values — "file_not_found" Only vs "file_not_found" + "invalid_path"

| Artifact | Error Values |
|---|---|
| PRD US-007 | `error="file_not_found"` on non-zero exit |
| Task-Backend US-006 | `error="file_not_found"` PLUS `error="invalid_path"` for paths not starting with `/` |

**Discrepancy:** Same pattern as M-2. The task adds path validation not present in the PRD.

### M-4: `_resolve_user_settings()` Return — 4-tuple Naming

| Artifact | 4th Element Name |
|---|---|
| PRD US-020 | "4-tuple (model, api_key, default_sandbox, mcp_sandbox_url)" |
| Spec-002 (code) | `default_mcp_sandbox_url` (from settings attribute) |
| Task-Dispatch US-006 | "4-tuple (model, api_key, default_sandbox, mcp_sandbox_url)" |

**Consistent** on the return value but the internal variable name (`default_mcp_sandbox_url` on the settings object vs `mcp_sandbox_url` as the return tuple element) could cause confusion.

### M-5: `_ensure_initialized()` `_request_id` Post-Init Value

| Artifact | `_request_id` After Init |
|---|---|
| PRD US-003 | "Sets `self._request_id = 1` (since ID 1 was used for init)" |
| Task-Backend US-002 | "Sets `self._initialized = True` and `self._request_id = 1` (since ID 1 was used for init)" |
| Spec-001 | Not explicitly specified for `_request_id` post-init value |

**Discrepancy:** PRD and Task agree that `_request_id` is set to 1 after init (meaning the next execute call will use id=2). The spec does not specify this, relying on the implementer to increment before use.

### M-6: Session Error Detection — HTTP 400 Only vs Broader Check

| Artifact | Session Error Trigger |
|---|---|
| PRD US-004 | "On session-related error (HTTP 400)" |
| Task-Backend US-003 | "HTTP 400 with 'Invalid or missing session ID', or connection error" |
| Spec-001 | "On session error (e.g., 400 'Invalid or missing session ID')" |

**Discrepancy:** Task-Backend expands session errors to include connection errors. PRD and Spec limit to HTTP 400. Connection errors during a tool call could be transient network issues, not session issues.

### M-7: SSE Error Event Format — Tuple vs Object

| Artifact | SSE Event Format |
|---|---|
| Spec-002 (code snippet) | `ujson.dumps(("mcp_sandbox_unreachable", str(e)))` (tuple) |
| Task-Dispatch US-007 | `("error", {"type": "mcp_sandbox_unreachable", "message": "<detail>"})` (object nested in error tuple) |
| Task-Frontend US-009 | `["mcp_sandbox_unreachable", {"message": "Connection refused"}]` (array with object) |
| Spec-003 | `("mcp_sandbox_unreachable", "<error message>")` via SSE stream |

**Contradiction:** Four different SSE event formats across three artifacts:
1. Spec-002: `["mcp_sandbox_unreachable", "error string"]`
2. Task-Dispatch: `["error", {"type": "mcp_sandbox_unreachable", "message": "..."}]`
3. Task-Frontend: `["mcp_sandbox_unreachable", {"message": "..."}]`
4. Spec-003: `("mcp_sandbox_unreachable", "error message")`

**Impact:** The frontend SSE parser and backend SSE emitter MUST agree on format. This mismatch would cause the frontend to fail silently or mis-parse the error event.

### M-8: ThreadSandboxStatus File Path

| Artifact | File Path |
|---|---|
| Spec-003 | `frontend/src/components/tools/ThreadSandboxStatus.tsx` |
| Task-Frontend (Files Changed) | `frontend/src/components/status/ThreadSandboxStatus.tsx` |

**Contradiction:** The file is referenced under two different directories (`tools/` vs `status/`). Only one can be correct.

### M-9: _SANDBOX_FACTORIES Registration Pattern

| Artifact | Registration Approach |
|---|---|
| PRD US-017 | "`'mcp'` key added to `_SANDBOX_FACTORIES` dict" |
| Spec-002 (code) | Shows `_SANDBOX_FACTORIES` registration but notes "MCP needs special handling since it requires the URL" |
| Task-Dispatch US-003 | "`'mcp'` key added to `_SANDBOX_FACTORIES` dict, pointing to the factory callable" |
| Spec-002 (resolve code) | Actually bypasses `_SANDBOX_FACTORIES` and calls factory directly in the dispatch logic |

**Discrepancy:** The PRD and Task say to register in the dict, but the Spec-002 code snippet shows the dispatch function calling the MCP factory directly (not through the dict lookup) because the MCP factory needs the URL parameter. This creates ambiguity about whether the factory is actually in the dict or handled as a special case.

### M-10: `execute()` `timeout` Parameter Type — `int | None` vs `float | None`

| Artifact | Timeout Type |
|---|---|
| PRD US-004 | `timeout: int \| None = None` |
| Spec-001 (skeleton) | `timeout: float \| None = None` |
| Task-Backend US-003 | `timeout: int \| None = None` |

**Contradiction:** PRD and Task use `int`, Spec uses `float`. httpx accepts both, but the type annotation matters for type checking.

---

## MINOR Inconsistencies (Cosmetic / Documentation Drift)

### m-1: PRD US Numbering vs Spec/Task US Numbering

The PRD has 59 user stories (US-001 through US-059) spanning all 5 phases. The specs and tasks have their own independent US numbering per phase. For example:
- PRD US-015 = Task-Dispatch US-001 (Add MCP to SandboxType)
- PRD US-024 = Task-ExecServer US-001 (Rename exec_command)

This is not a bug but makes cross-referencing difficult.

### m-2: Missing "Typecheck passes" AC in Some Task Stories

| Task-Backend | Missing From |
|---|---|
| US-001 through US-009 | All have `make format` but not all have explicit "Typecheck passes" (some only have format+lint) |

The PRD consistently includes "Typecheck passes" in every story. Some task stories omit it.

### m-3: Health Check Endpoint Derivation

| Artifact | How Health URL is Derived |
|---|---|
| Spec-001 | "GETs `/health` endpoint (derived from MCP URL by stripping `/mcp` path)" |
| PRD US-008 | "Sends GET to `{base_url}/health`" |
| Task-Backend US-007 | "Sends GET to `{base_url}/health`" |
| Task-Frontend US-006 | "strip trailing `/mcp` suffix from URL, append `/health`" |

These are consistent given the URL convention difference (C-2), but the derivation approach differs: PRD/Task assume `base_url` already excludes `/mcp`, while Spec/Frontend task strip `/mcp` from the full URL.

### m-4: Spec-001 Says "No exit_code Line Means 0" But Also "Regex: Last Match Wins"

Spec-001 has two slightly different descriptions:
- "Success: text ends with nothing (no exit_code line means 0)"
- "Regex: `r'exit_code:\s*(\d+)'` -- search the full text, last match wins"

The "last match wins" implies scanning for multiple matches, while the PRD's regex `r'exit_code:\s*(\d+)'` just uses `re.search()` which finds the first match. The Task-V2 says "last match" explicitly. The PRD and Spec-001 do not specify first vs last match.

### m-5: Missing Test AC in PRD for `is_mcp_sandbox_error()` and `McpSandboxError`

PRD US-002 (McpSandboxError) and US-019 (is_mcp_sandbox_error) do not have corresponding test user stories. The PRD's test stories (US-010 through US-014) cover the main class but not the error helpers from Phase 2.

### m-6: `_parse_meta` Return Type

| Artifact | Return Type |
|---|---|
| PRD US-047 | `tuple[int \| None, str \| None]` |
| Spec-005 | `_parse_meta(result: dict) -> tuple[int, str]` (no Optional) |
| Task-V2 US-002 | `tuple[int \| None, str \| None]` |

**Discrepancy:** Spec-005 omits `None` types in the return, while PRD and Task correctly indicate the values can be None.

### m-7: `is_mcp_sandbox_error` Checks `McpSandboxError` Type

| Artifact | Checks McpSandboxError? |
|---|---|
| PRD US-019 | "Checks for ConnectionError, TimeoutError, OSError, and McpSandboxError" |
| Task-Dispatch US-005 | "Checks for connection errors (e.g., ConnectionError, TimeoutError, OSError)" — does NOT mention McpSandboxError |
| Task-Dispatch Open Q | "If Phase 1 introduces McpSandboxError... should is_mcp_sandbox_error() check for that type?" |

The PRD explicitly includes `McpSandboxError` in the check list. The Task leaves it as an open question.

---

## Missing ACs (Present in One Artifact, Absent in Corresponding Artifact)

### Missing-1: PRD US-005 (`id` property) has `f"mcp-sandbox:{self._base_url}"` format
- **Present in:** PRD, Task-Backend
- **Absent from:** Spec-001 (says "Return sandbox URL or generated UUID" but does not specify the format string)

### Missing-2: Path validation for upload/download (`invalid_path` error)
- **Present in:** Task-Backend US-005, US-006
- **Absent from:** PRD US-006, US-007; Spec-001

### Missing-3: Conformance test count
- **Present in:** Spec-004 ("24/24 tests passed" in example)
- **Absent from:** Task-ExecServer (says "N/M tests passed" generically)

### Missing-4: Frontend `ThreadSandboxStatus` reading `mcp_sandbox_url` from `getSettings()`
- **Present in:** PRD US-043, Task-Frontend US-008
- **Absent from:** Spec-003 (mentions it briefly but does not detail the data flow)

### Missing-5: `notifications/initialized` Notification
- **Present in:** PRD US-003, Task-Backend US-002
- **Absent from:** Spec-001 (protocol section shows `initialize` but does not mention the `notifications/initialized` follow-up)

Actually, Spec-001 does mention session lifecycle steps but does not include `notifications/initialized` in the protocol details section or the class skeleton. The PRD and Task-Backend both require it.

### Missing-6: `_request_id` Increment Mechanics
- **Present in:** PRD US-004 ("Increments self._request_id and uses it as the JSON-RPC id")
- **Present in:** Task-Backend US-003 (same)
- **Absent from:** Spec-001 class skeleton (shows `self._request_id = 0` in init but does not detail increment logic)

---

## Specificity Gaps

### SG-1: Health Check Response Validation
- **PRD US-008:** "Returns True if response is HTTP 200 and JSON body contains 'status': 'ok'" (specific)
- **Spec-001:** "Check exec_server health via GET /health" (vague — no validation criteria)

### SG-2: Session Reconnection Retry Count
- **PRD US-004:** "retries once" (specific)
- **Spec-001:** "retry once before raising" (consistent)
- **Task-Backend US-003:** "retries once" (consistent)

### SG-3: Frontend Health Check `isHealthy` Criteria
- **PRD US-041:** "true on 2xx, false on any error" (specific)
- **Task-Frontend US-006:** "true when GET returns 2xx, false on any error or non-2xx" (specific, consistent)
- **Spec-003:** "isHealthy: boolean | null" in hook signature but checking criteria not detailed in AC

### SG-4: Exit Code Regex — First vs Last Match
- **PRD/Task-Backend:** Do not specify first vs last
- **Spec-001:** "last match wins"
- **Task-V2:** "last match is used"

---

## Overall Alignment Score: 5 / 10

### Justification

**What works well:**
- The overall feature architecture is consistent across all layers: 5-phase approach, BaseSandbox extension, MCP JSON-RPC protocol, fallback chains
- The PRD is comprehensive with 59 user stories and detailed ACs
- The specs provide good implementation guidance with code snippets
- Phase dependencies are correctly identified across all artifacts

**What needs resolution before implementation:**
- **3 showstopper contradictions (C-1, C-2, C-3):** The constructor parameter name/semantics, URL convention, and sync-vs-async decisions are fundamental to the class design. An implementer cannot proceed without resolving these first.
- **2 protocol contradictions (C-5, C-8):** Different MCP protocol versions and client names would cause handshake issues
- **1 deployment hazard (C-6):** The exec_server rename to `execute` (no alias) creates a breaking change window
- **1 critical format mismatch (M-7):** The SSE error event format for `mcp_sandbox_unreachable` differs across 4 artifacts. Backend and frontend MUST agree.
- **1 file path conflict (M-8):** ThreadSandboxStatus is referenced under two different directories
- Multiple method name inconsistencies (C-7) that would cause test failures

The PRD is the most complete and internally consistent artifact. The specs introduce implementation details that sometimes contradict the PRD. The tasks generally track the PRD well but add extra requirements (path validation) and leave open questions that the PRD has already resolved. The cross-boundary concerns (SSE format, URL convention) are the most dangerous because they span multiple implementers working on different phases.

### Recommended Resolution Priority

1. **Decide constructor signature**: `url` vs `base_url`, positional vs keyword-only, full MCP URL vs base URL
2. **Decide sync vs async**: `httpx.Client` vs `httpx.AsyncClient`
3. **Standardize SSE error event format** for `mcp_sandbox_unreachable`
4. **Pick MCP protocol version**: `2024-11-05` vs `2025-03-26`
5. **Standardize method name**: `_ensure_initialized()` vs `_ensure_session()`
6. **Standardize timeout**: 120s vs 130s for default client timeout
7. **Resolve ThreadSandboxStatus file path**: `tools/` vs `status/`
8. **Address deployment ordering** for exec_command -> execute rename
9. **Decide on exit code regex**: first match vs last match
10. **Decide on path validation**: include `invalid_path` or not
