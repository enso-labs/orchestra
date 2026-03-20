# Cross-Phase Dependency & Sequencing Audit: MCP Sandbox (#890)

## Executive Summary

The MCP Sandbox feature is decomposed into 5 phases with 59 user stories in Ralph's `prd.json`. The analysis reveals **3 critical sequencing risks**, **4 moderate dependency gaps**, and **2 minor ordering preferences**. The overall dependency alignment score is **5/10** -- functional but with real gaps that will cause execution failures if unaddressed.

---

## 1. Priority vs Dependency Conflict Analysis

### Ralph Priority Mapping

Ralph processes stories by ascending `priority` number. The actual execution order encoded in `prd.json` is:

| Phase | Description | Ralph Priority Range | Story IDs |
|-------|------------|---------------------|-----------|
| P1 | McpSandboxBackend Core | 1--14 | US-001 to US-014 |
| P2 | Sandbox Dispatch Wiring | 15--23 | US-015 to US-023 |
| P4 | exec_server Structured Tools | 24--35 | US-024 to US-035 |
| P3 | Frontend MCP Option | 36--45 | US-036 to US-045 |
| P5 | Native MCP Tool Overrides | 46--59 | US-046 to US-059 |

**Observation**: The numbering scheme (P1, P2, P4, P3, P5) is intentional -- P4 (exec_server) has lower priority numbers than P3 (frontend), meaning Ralph will execute P4 before P3. This contradicts the specs which say **P3 and P4 are independent and can run in parallel**.

### FINDING 1 (MODERATE): P3/P4 Sequencing is Suboptimal, Not Broken

- **Spec 003** (Frontend) header says: *"Independent: Can be implemented in parallel with Specs 001 and 004."*
- **Spec 004** (exec_server) header says: *"Independent: Can be implemented in parallel with Specs 001, 002, and 003."*
- **Ralph reality**: P4 (priorities 24--35) executes entirely before P3 (priorities 36--45).

**Impact**: This is not a blocker because P3 and P4 have no mutual dependency. However, it means Ralph serializes two parallelizable workstreams, adding unnecessary calendar time. The frontend can be developed with only the Phase 2 API contract (schema types), not the exec_server itself. Executing P4 before P3 is safe but wasteful.

**Risk Level**: LOW -- no execution failure, just suboptimal throughput.

### FINDING 2 (CRITICAL): P4 is in a Different Repository -- Ralph Cannot Execute It

- **prd.json US-024 through US-035** all have notes like: *"This is in the sandboxes/ submodule (separate ruska-ai/sandboxes repo). Commit inside sandboxes/ directory."*
- Ralph's sequential execution model operates within the orchestra repo. It runs `make format`, `make lint`, `make test` as acceptance criteria -- but these commands target the **orchestra backend**, not the sandboxes submodule.
- The acceptance criteria for P4 stories reference `Typecheck passes` but the sandboxes repo is JavaScript (Node.js), not Python. The `make test` criterion is meaningless in the sandboxes context.
- The conformance test (US-035) requires `bash tests/conformance.sh http://localhost:3005`, which requires a **running Docker container** of the exec_server.

**Impact**:
1. Ralph will attempt to execute P4 stories (priorities 24--35) in sequence after P2 completes, but `make format` / `make test` will pass vacuously (no sandboxes changes are visible to the orchestra backend test suite).
2. The conformance test requires Docker build + container startup, which Ralph's standard flow does not orchestrate.
3. Git operations must happen inside `sandboxes/` (a submodule), and then the submodule pointer in orchestra must be updated.

**Risk Level**: CRITICAL -- Ralph's execution model cannot correctly validate or commit P4 work without manual intervention or a custom workflow adapter.

### FINDING 3 (CRITICAL): P5 Depends on Both P2 AND P4, but P4 Validation is Unreliable

- **Spec 005** header: *"Depends on: Spec 002 (dispatch wiring) + Spec 004 (exec_server structured tools)"*
- **prd.json US-046** (P5 first story) has priority 46, after P4 (priority 35) and P3 (priority 45).
- P5 unit tests mock the exec_server, so they can run without a live P4 server. However:
  - US-049 `execute()` override depends on the `execute` tool name (renamed from `exec_command` in P4). If P4's rename hasn't been verified, the name assumption is untested.
  - US-058 (graceful degradation) explicitly tests compatibility with old exec_servers that only have `exec_command`. This story is valid regardless of P4 status.
  - US-059 (integration validation) includes *"Invoke integration-qa agent to validate cross-boundary alignment"* -- this requires the P4 exec_server to be running.

**Impact**: P5 unit tests will pass (mocked), but the integration gate (US-059) cannot be satisfied without a running P4 exec_server. Ralph will either skip this criterion or fail on it.

**Risk Level**: CRITICAL -- the integration gate at the end of the feature depends on a cross-repo deliverable that Ralph cannot orchestrate.

---

## 2. Implicit Dependencies Not Declared

### Phase 2 Dependencies on Phase 1

| P2 Story | Depends On (P1) | Declared? | Notes |
|----------|-----------------|-----------|-------|
| US-015 (SandboxType enum) | None | N/A | Pure schema change, no P1 dependency |
| US-016 (API schemas) | None | N/A | Pure schema change |
| US-017 (MCP factory) | US-001 (class skeleton) | **YES** (spec header) | Factory imports `McpSandboxBackend` |
| US-018 (resolve dispatch) | US-017 (factory) | **IMPLICIT** | Uses factory registered in US-017 |
| US-019 (error helper) | US-002 (McpSandboxError) | **NOT DECLARED** | `is_mcp_sandbox_error()` checks for `McpSandboxError` type |
| US-020 (LLMController wiring) | US-018 (dispatch rules) | **IMPLICIT** | Calls updated `resolve_sandbox_backend()` |
| US-021 (stream_generator) | US-018, US-019 | **IMPLICIT** | Uses dispatch + error helper |
| US-022 (worker tasks) | US-018, US-019 | **IMPLICIT** | Same pattern |
| US-023 (integration validation) | US-015 through US-022 | **IMPLICIT** | Gate story -- needs all prior P2 stories |

**FINDING 4 (MODERATE)**: US-019 (`is_mcp_sandbox_error`) depends on `McpSandboxError` being importable from `mcp_sandbox.py` (created in P1 US-002). This dependency is not declared in the PRD or prd.json. If Ralph somehow executed P2's US-019 before P1's US-002 completed, the import would fail. However, since Ralph's priority ordering guarantees P1 (1--14) runs before P2 (15--23), this is safe **in practice** despite the missing declaration.

### Phase 3 Dependencies on Phase 2

| P3 Story | Depends On (P2) | Declared? |
|----------|-----------------|-----------|
| US-036 (SandboxType union) | US-015 (backend SandboxType) | **NOT DECLARED** (but spec says "Independent") |
| US-037 (API type interfaces) | US-016 (backend API schemas) | **NOT DECLARED** |
| US-039 (URL input field) | US-016 (PATCH endpoint for mcp_sandbox_url) | **NOT DECLARED** |
| US-044 (SSE event handler) | US-021 (stream_generator emitting mcp_sandbox_unreachable) | **NOT DECLARED** |

**FINDING 5 (MODERATE)**: Spec 003 header says *"Independent: Can be implemented in parallel with Specs 001 and 004"* -- but it does NOT claim independence from Spec 002. The PRD says *"depends only on the API schema contract defined in Phase 2"*. This is honest, but the prd.json doesn't encode this dependency. In Ralph's execution order (P3 after P4 after P2), this happens to be satisfied, but it is a documentation gap.

**Specific risk**: US-044 (handle `mcp_sandbox_unreachable` SSE event) cannot be browser-tested until the backend (P2 US-021) emits that event. The frontend code can be written and unit-tested with mocks, but the integration story US-045 requires both backend and frontend to be deployed.

### Phase 5 Dependencies on Phase 4

| P5 Story | Depends On (P4) | Declared? |
|----------|-----------------|-----------|
| US-046 (tool discovery) | US-024+ (tools/list returns 9 tools) | **IMPLICIT** |
| US-047 (_parse_meta) | US-025 (_meta structure in responses) | **IMPLICIT** |
| US-048 (sandbox_id from _meta) | US-025, US-034 (sandbox_id in _meta and /health) | **IMPLICIT** |
| US-049 (execute dual name) | US-024 (rename exec_command -> execute) | **IMPLICIT** |
| US-050--057 (native overrides) | US-026--033 (corresponding exec_server tools) | **IMPLICIT** |
| US-058 (graceful degradation) | None (tests fallback when tools absent) | N/A |

**FINDING 6 (LOW)**: Every P5 native override story (US-050 through US-057) implicitly depends on the corresponding P4 tool existing. However, since P5 unit tests mock the exec_server responses, these dependencies don't block unit test execution. They only matter for integration testing.

---

## 3. Cross-Repository Sequencing

### The Sandboxes Submodule Problem

Phase 4 operates in `sandboxes/` which is a git submodule pointing to `ruska-ai/sandboxes`. This creates several issues:

**FINDING 7 (CRITICAL)**: **Ralph's sequential execution model breaks across repo boundaries**.

1. **Git operations**: Ralph commits changes to the orchestra repo. P4 changes must be committed to the sandboxes repo. Ralph would need to:
   - `cd sandboxes/` and commit there
   - Then `cd ..` and update the submodule pointer in orchestra
   - This is a two-step process not described in Ralph's workflow

2. **Testing**: P4 acceptance criteria include "Typecheck passes" -- but the sandboxes repo uses JavaScript, not Python. The orchestra `make test` command does not test sandboxes code. The actual test is `bash tests/conformance.sh http://localhost:3005` which requires:
   - Building the Docker image: `cd sandboxes/ubuntu && docker build -t exec-server-test .`
   - Running a container: `docker run -d -p 3005:3005 exec-server-test`
   - Running the test: `bash tests/conformance.sh http://localhost:3005`
   - Cleaning up: `docker stop exec-server-test`

3. **`make format` / `make lint`**: These orchestra-scoped commands are meaningless for JavaScript changes in the sandboxes submodule. The P4 stories list these as acceptance criteria but they'll pass vacuously since no Python files changed.

4. **Conformance tests (US-035)**: Requires a running Docker container. Ralph's standard test harness does not start Docker services. The `docker-compose.dev.yml` includes an optional `exec_server` profile (`COMPOSE_PROFILES=tools`), but Ralph doesn't know to use it.

### Implications for Integration Gates

- **US-023 (P2 integration)**: Does not require exec_server -- tests dispatch logic only. Safe.
- **US-045 (P3 integration)**: Requires backend APIs from P2. Uses agent-browser for UI testing. Does NOT require exec_server (health check can show red dot). **Partially safe** -- the health dot test needs a running exec_server to show green.
- **US-059 (P5 integration)**: Explicitly requires cross-boundary validation with the exec_server. **Not safe without manual intervention**.

---

## 4. Integration Gate Analysis

### US-023: P2 Integration Validation (Priority 23)

**Prerequisites needed**:
- All P1 stories (US-001 to US-014) complete -- McpSandboxBackend class exists
- All P2 stories (US-015 to US-022) complete -- dispatch wiring, API schemas, error handling

**Prerequisites declared**: None explicitly, but position at end of P2 implies all prior P2 stories.

**Assessment**: **CORRECT**. Ralph's priority ordering ensures all P1 and P2 stories complete before US-023. The acceptance criteria (API calls via curl) test the dispatch pipeline without needing a live exec_server. When `sandbox='mcp'` but no exec_server is running, the system should fall back to State -- which is exactly what US-023 tests.

**Risk**: LOW. One gap: US-023 doesn't test that the MCP backend actually connects to an exec_server. It only tests the fallback path. There is no P2 integration test that validates the happy path (MCP actually working).

### US-045: P3 Frontend Integration (Priority 45)

**Prerequisites needed**:
- P2 complete (backend APIs for settings/defaults)
- P3 stories US-036 to US-044 complete (frontend types, components, hooks)

**Prerequisites declared**: None explicitly.

**Assessment**: **MOSTLY CORRECT** but with a gap.

- The browser-based test (agent-browser) requires the backend running with P2 changes deployed -- not just frontend.
- Step 7: "Verify health dot color (green if exec_server running)" -- requires P4 to be deployed for green. If P4 is already complete (priorities 24--35 before P3's 36--45), this should work. **BUT** -- this assumes the Docker exec_server is running, which Ralph doesn't manage.
- Step 14: "Clear the MCP URL in Settings -- verify MCP option disappears and sandbox reverts to State" -- requires P2 backend for the PATCH call.

**Risk**: MODERATE. The agent-browser test is comprehensive but assumes both backend (P2) and exec_server (P4) are running. Ralph completing P4 stories doesn't mean the exec_server is deployed.

### US-059: P5 Integration Validation (Priority 59)

**Prerequisites needed**:
- All P1 stories (base class)
- All P2 stories (dispatch wiring)
- All P4 stories (exec_server with 9 native tools + _meta)
- All P5 stories US-046 to US-058

**Prerequisites declared**: "Invoke integration-qa agent to validate cross-boundary alignment"

**Assessment**: **INCOMPLETE PREREQUISITES**.

- Acceptance criteria say *"Minimum 25 new test cases"* -- these are unit tests with mocks, achievable.
- The criterion *"Invoke integration-qa agent"* implies an external validation step that is not a standard Ralph operation.
- There is no acceptance criterion that explicitly requires the exec_server conformance suite (US-035) to pass. The integration validation should reference US-035 as a prerequisite.

**Risk**: HIGH. This gate story is the final validation for the entire feature, but it doesn't explicitly require a live exec_server passing conformance tests. The 25 unit tests will pass with mocks, but the actual integration (Python backend talking to Node.js exec_server via MCP) is not validated.

---

## 5. Additional Sequencing Risks

### FINDING 8 (MODERATE): Tool Name Mismatch Window

P1 (US-004, priority 4) hardcodes `exec_command` as the tool name for `execute()`. P4 (US-024, priority 24) renames `exec_command` to `execute`. P5 (US-049, priority 49) adds dual-name support.

Between P1 completion and P5 completion, there is a **compatibility window** where:
- If someone deploys the P4 exec_server (with `execute` tool name) while the backend is still on P1 code (expecting `exec_command`), **all MCP sandbox calls will fail** because the tool name doesn't match.
- This window spans priorities 14--49 (roughly 35 stories).

**Mitigation**: P4 spec says "clean break, no backward compatibility alias." This means deploying P4's exec_server before P5 is merged will break P1's backend. The specs acknowledge this but don't enforce a deployment ordering.

### FINDING 9 (LOW): Phase 2 Return Tuple Change

P2 US-020 changes `_resolve_user_settings()` from a 3-tuple to a 4-tuple. All callers of this function must be updated atomically. If Ralph processes US-020 (LLMController) but hasn't yet processed US-021 (stream_generator) or US-022 (worker tasks), the intermediate state could have callers expecting different tuple lengths.

**Mitigation**: Ralph processes stories sequentially by priority, so US-020 (priority 20) completes before US-021 (priority 21) and US-022 (priority 22). Within a single story, the developer should update the function and all its callers. However, if US-020 only updates `_resolve_user_settings()` and its direct caller in `llm_invoke()`/`llm_stream()`, while US-021/US-022 update the other callers, there's a brief window where `make test` might fail.

**Actual risk**: LOW -- Ralph runs `make test` as an acceptance criterion for US-020, so if the intermediate state breaks tests, the story won't pass.

---

## 6. Dependency Alignment Score

### Score: 5/10

**Justification**:

**Positives (+)**:
- P1 -> P2 ordering is correct and enforced by priority numbers
- P2 -> P3/P5 ordering is correct
- Integration gates exist at the end of each major phase
- The specs clearly identify which phases are parallelizable vs sequential
- Graceful degradation (P5 US-058) explicitly handles the old-server case

**Negatives (-)**:
- **-2**: P4 cross-repository execution is fundamentally broken for Ralph's sequential model. No mechanism exists for Ralph to commit to the sandboxes submodule, build Docker images, or start containers.
- **-1**: P5 integration gate (US-059) doesn't explicitly require a running exec_server or reference the conformance suite (US-035).
- **-1**: Tool name mismatch window (P1 uses `exec_command`, P4 renames to `execute`, P5 adds dual support) creates a dangerous deployment ordering dependency that is documented in specs but not enforced in prd.json.
- **-1**: P3/P4 parallelism is possible but not exploited -- Ralph serializes them unnecessarily.

---

## 7. Recommendations

### Must Fix (Before Ralph Starts)

1. **Separate P4 from Ralph's sequential pipeline**. Create a dedicated task or branch for the sandboxes submodule work. Mark P4 stories in prd.json with a flag indicating they cannot be auto-executed by Ralph. Run the conformance suite manually or via CI.

2. **Add exec_server startup to US-059's acceptance criteria**. Add: "conformance.sh passes against a running exec_server built from Phase 4 code."

3. **Document the deployment ordering constraint**. Between P4 exec_server deployment and P5 backend deployment, there is a breaking change window (exec_command -> execute rename). Add a note to prd.json or a coordination document.

### Should Fix

4. **Interleave P3 and P4** if Ralph supports parallel execution (or split into two Ralph instances). P3 (frontend) and P4 (sandboxes) have zero mutual dependencies.

5. **Add explicit `dependsOn` fields to prd.json stories**. Currently dependencies are implicit (ordering by priority). Making them explicit enables future tooling to validate the dependency graph.

6. **Add a P2 happy-path integration test**. US-023 only tests the fallback path. Add a test that verifies MCP sandbox actually connects to a running exec_server when available.

### Nice to Have

7. **Move P4 acceptance criteria from `make format`/`make test` to sandboxes-appropriate commands** (e.g., `npm run lint` for the Node.js code, `bash tests/conformance.sh` for integration).

8. **Add a "deployment gate" story between P4 and P5** that verifies the exec_server Docker image is built and the conformance suite passes before P5 begins.
