# MCP Sandbox Artifact Alignment Audit

## Context

Three artifact layers describe Feature #890 (MCP Sandbox):
- **Specs** (5 files): `.claude/specs/feat-890-mcp-sandbox/001-005`
- **PRD Tasks** (5 files): `tasks/prd-mcp-sandbox-{backend,dispatch,exec-server,frontend,v2-native}.md`
- **Ralph PRD**: `.ralph/prd.json` (59 user stories, US-001 through US-059)

This audit identifies alignment gaps that must be resolved **before Ralph execution begins**.

---

## Council Scores

| Auditor | Score | Summary |
|---------|-------|---------|
| Story Coverage | **9/10** | All 59 stories covered across all layers. Minor ID numbering drift. |
| Acceptance Criteria | **5/10** | 8 critical contradictions, 10 major inconsistencies found. |
| Dependency & Sequencing | **5/10** | 3 critical sequencing issues, 4 moderate gaps. |
| Technical Consistency | **6.5/10** | 5 high-severity codebase mismatches, 5 medium. |

**Composite Score: 6.4/10** — Story coverage is excellent but implementation-level specs have dangerous contradictions.

---

## CRITICAL Issues (Must Fix Before Implementation)

### C-1: Constructor parameter name — `base_url` vs `url`
- **Ralph/PRD**: `__init__(self, *, base_url: str, api_key: str | None = None)`
- **Specs 001/002/005**: Use `url` as the parameter name; factory calls `McpSandboxBackend(url=mcp_sandbox_url)`
- **Impact**: Factory call crashes with `TypeError` at runtime
- **Resolution**: Standardize on `base_url` (matches PRD and Ralph). Update specs 001, 002, 005.

### C-2: URL semantics — base URL vs full MCP endpoint
- **PRD**: Stores `http://localhost:3005`, appends `/mcp` internally
- **Spec 001**: Stores `http://localhost:3005/mcp`, strips `/mcp` to derive base
- **Impact**: Health check, DELETE, and id property generate wrong URLs
- **Resolution**: Standardize on base URL convention (PRD approach). Update spec 001.

### C-3: Sync vs Async HTTP client
- **PRD/Specs**: `httpx.AsyncClient` with `async def` methods
- **Task-Backend**: Recommends `httpx.Client` (sync) for DaytonaSandbox consistency
- **Impact**: Architecture-level decision affecting every method signature
- **Resolution**: Verify whether `BaseSandbox.execute()` is sync or async in `deepagents`. If sync, use `httpx.Client`. If async, keep `AsyncClient`. Update the losing artifact.

### C-4: MCP protocol version
- **Spec 001**: `"2024-11-05"`
- **Task-Backend**: `"2025-03-26"`
- **Impact**: Wrong version may cause handshake rejection
- **Resolution**: Check actual exec_server's expected version. Standardize across all artifacts.

### C-5: SSE error event format — 4 different formats
- **Spec 002**: `("mcp_sandbox_unreachable", "error string")`
- **Task-Dispatch**: `("error", {"type": "mcp_sandbox_unreachable", "message": "..."})`
- **Task-Frontend**: `("mcp_sandbox_unreachable", {"message": "..."})`
- **Spec 003**: `("mcp_sandbox_unreachable", "error message")`
- **Impact**: Frontend toast handler will never fire if format mismatches
- **Resolution**: Check existing `daytona_unreachable` event format for precedent. Standardize all 4.

### C-6: Tool name rename without backward compat creates breakage window
- **Phase 1** (P1): Backend hardcodes `exec_command`
- **Phase 4** (P4): Exec server renames to `execute` with NO alias
- **Phase 5** (P5): Backend adds dual-name support
- **Impact**: Between P4 deploy and P5 deploy, sandbox is completely broken
- **Resolution**: Either (a) Phase 4 keeps `exec_command` as alias until Phase 5 ships, or (b) Phase 1 uses dual-name from the start.

### C-7: Private method name — `_ensure_initialized()` vs `_ensure_session()`
- **PRD/Task-Backend**: `_ensure_initialized()`
- **Specs**: `_ensure_session()`
- **Impact**: Tests reference wrong method name
- **Resolution**: Standardize on `_ensure_initialized()` (matches PRD). Update specs.

### C-8: Default client timeout — 120s vs 130s
- **PRD**: 120 seconds
- **Spec 001**: 130 seconds (`httpx.Timeout(130.0)`)
- **Resolution**: Pick one (120s aligns with exec_server's max timeout). Update spec 001.

---

## MAJOR Issues (Should Fix)

### M-1: Health check timeout disagreement
- Backend: 5s (PRD/Task-Backend) vs Frontend: 3s (Task-Frontend)
- **Resolution**: Backend health() uses 5s. Frontend useSandboxHealth uses its own timeout (3s is fine for UX). Document both.

### M-2: `_resolve_user_settings` breaking change (3-tuple to 4-tuple)
- File: `backend/src/controllers/llm.py:70`
- Must update BOTH `llm_invoke` (line ~121) and `llm_stream` (line ~211)
- Worker at `backend/src/workers/tasks.py:421-431` duplicates this logic inline and also needs updating
- **Resolution**: Update all 3 callsites in the same commit (US-020/US-021/US-022).

### M-3: MCP factory signature mismatch with `_SANDBOX_FACTORIES` pattern
- Existing factories: `factory(runtime)` — single param
- MCP factory: `_create_mcp_backend_checked(runtime, mcp_sandbox_url)` — two params
- Can't register in generic `_SANDBOX_FACTORIES` dict and call through same dispatch
- **Resolution**: Either special-case MCP in `resolve_sandbox_backend()` or add `mcp_sandbox_url` to all factory signatures (adapter pattern).

### M-4: `ThreadSandboxStatus` wrong file path in spec 003
- Spec 003: `frontend/src/components/tools/ThreadSandboxStatus.tsx`
- Actual: `frontend/src/components/status/ThreadSandboxStatus.tsx`
- **Resolution**: Fix spec 003.

### M-5: `upload_files()`/`download_files()` path validation
- Task-Backend adds `invalid_path` error for paths not starting with `/`
- PRD has no such validation
- **Resolution**: Add path validation (defense in depth). Update Ralph ACs.

### M-6: `execute()` timeout parameter type
- `int | None` (PRD/Ralph) vs `float | None` (Spec 001)
- **Resolution**: Use `int | None` (matches BaseSandbox convention). Update spec 001.

### M-7: `clientInfo.name` in initialize payload
- `"orchestra"` (Spec 001) vs `"orchestra-backend"` (Task-Backend)
- **Resolution**: Use `"orchestra"` for brevity. Update task.

### M-8: `_parse_meta` return type
- `tuple[int | None, str | None]` (PRD) vs `tuple[int, str]` without Optional (Spec 005)
- **Resolution**: Must be Optional since `_meta` may be absent. Use PRD version.

### M-9: Exit code regex — first match vs last match
- Spec 001 says "last match wins", PRD doesn't specify
- **Resolution**: Document "first match" (simpler, `re.search` default). Update spec.

### M-10: `is_mcp_sandbox_error()` — include McpSandboxError or not
- PRD: includes it
- Task-Dispatch: leaves as open question
- **Resolution**: Include it (the purpose of the helper). Update task.

---

## STRUCTURAL Issues (Sequencing & Dependencies)

### S-1: Phase 4 is in a different git repository
Ralph processes stories sequentially in the orchestra repo. Phase 4 (US-024-035) operates in the `sandboxes/` submodule (separate `ruska-ai/sandboxes` repo). Ralph cannot:
- Commit to the submodule
- Build Docker images
- Start containers
- Run `conformance.sh`

**Resolution**: Extract Phase 4 stories into a separate Ralph run targeting the sandboxes repo, OR execute Phase 4 manually before Ralph processes Phase 5.

### S-2: Phase 3/4 parallelism wasted by priority ordering
Ralph serializes P4 (priorities 24-35) entirely before P3 (priorities 36-45). Both are independent.

**Resolution**: If sequential execution is required, this is acceptable (just slower). If parallelism is desired, Phase 3 priorities should be interleaved with Phase 4.

### S-3: Integration gates lack service prerequisites
- US-023 (P2 integration): Needs running API
- US-045 (P3 integration): Needs running frontend + exec_server for health dot
- US-059 (P5 integration): Needs running exec_server

**Resolution**: Add notes to these stories clarifying what services must be running. Ralph can't start services, so these gates may need manual validation.

### S-4: PRD task files use local US-XXX numbering
Each PRD task resets to US-001. Cross-referencing with Ralph's global US-001-059 requires knowing the phase mapping.

**Resolution**: Add a mapping header to each PRD task file: "This file covers Ralph US-015 through US-023."

---

## MINOR Issues

1. Spec 003 health dot `bg-green-500, h-2 w-2` matches PRD exactly — no issue
2. PRD notes field is empty on all 59 stories — Phase 4 submodule constraint only noted in last few
3. Open design questions in PRD tasks (CORS proxying, file size limits) not tracked in Ralph
4. Spec files use numbered requirements (1-16) instead of US-XXX IDs

---

## Recommended Fix Order

1. **Resolve C-3 first** (sync vs async) — this is architectural and affects everything
2. **Fix C-1 + C-2** (constructor + URL convention) — affects factory, health, id property
3. **Fix C-5** (SSE event format) — check existing Daytona pattern for precedent
4. **Fix C-6** (tool rename strategy) — decide alias vs dual-name-from-start
5. **Fix C-4** (protocol version) — verify against actual exec_server
6. **Fix C-7 + C-8** (method name + timeout) — straightforward standardization
7. **Fix S-1** (Phase 4 execution strategy) — before Ralph starts
8. **Apply all MAJOR fixes** — batch update to specs, PRD tasks, and prd.json
9. **Re-run alignment audit** after fixes

---

## Verification

After applying fixes:
- `grep -r "base_url\|url=" .claude/specs/ tasks/` — confirm constructor param standardized
- `grep -r "AsyncClient\|Client" .claude/specs/ tasks/` — confirm sync/async standardized
- `grep -r "mcp_sandbox_unreachable" .claude/specs/ tasks/` — confirm SSE format standardized
- `grep -r "2024-11-05\|2025-03-26" .claude/specs/ tasks/` — confirm protocol version standardized
- `grep -r "_ensure_initialized\|_ensure_session" .claude/specs/ tasks/` — confirm method name standardized
- Cross-check Ralph prd.json ACs against updated specs for consistency
