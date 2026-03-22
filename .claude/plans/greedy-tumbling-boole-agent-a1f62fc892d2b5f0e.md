# Story Coverage Audit: MCP Sandbox Feature (#890)

## Methodology

Mapped all 59 Ralph PRD user stories (US-001 through US-059) against:
- 5 spec files in `.claude/specs/feat-890-mcp-sandbox/`
- 5 PRD task files in `tasks/prd-mcp-sandbox-*.md`

**Key structural observation**: Both spec files and PRD task files use **internal numbering** (US-001, US-002, etc. within each file). These do NOT correspond to Ralph's global numbering (US-001 through US-059). The mapping must be done by **content matching**, not by ID matching.

---

## 1. Coverage Matrix

### Phase 1: McpSandboxBackend Core Class
**Spec**: `001-mcp-sandbox-backend.md` | **PRD Task**: `tasks/prd-mcp-sandbox-backend.md`

| Ralph ID | Ralph Title | Spec File | Spec Internal ID | PRD Task | PRD Internal ID | ID Mismatch? |
|----------|------------|-----------|-----------------|----------|----------------|--------------|
| US-001 | McpSandboxBackend class skeleton and constructor | 001 | Requirement 1-2 (class skeleton) | backend | US-001 | Yes - Ralph US-001 = PRD-backend US-001, but spec uses numbered requirements not US IDs |
| US-002 | Custom McpSandboxError exception class | 001 | Requirement 6 (mentions custom exception) | backend | US-008 | Yes - Ralph US-002 maps to PRD-backend US-008 |
| US-003 | MCP session initialization | 001 | Requirement 6 (session lifecycle) | backend | US-002 | Yes - Ralph US-003 maps to PRD-backend US-002 |
| US-004 | execute() method | 001 | Requirement 2 | backend | US-003 | Yes - Ralph US-004 maps to PRD-backend US-003 |
| US-005 | Sandbox id property | 001 | Requirement 3 | backend | US-004 | Yes - Ralph US-005 maps to PRD-backend US-004 |
| US-006 | upload_files() | 001 | Requirement 4 | backend | US-005 | Yes - Ralph US-006 maps to PRD-backend US-005 |
| US-007 | download_files() | 001 | Requirement 5 | backend | US-006 | Yes - Ralph US-007 maps to PRD-backend US-006 |
| US-008 | health() async method | 001 | Requirement 7 | backend | US-007 | Yes - Ralph US-008 maps to PRD-backend US-007 |
| US-009 | Client cleanup (close + context manager) | 001 | (mentioned in class skeleton as close()) | backend | US-009 | Match |
| US-010 | Unit tests -- constructor and id | 001 | Requirement 9 (create unit tests) | backend | US-010 | Match |
| US-011 | Unit tests -- MCP initialize handshake | 001 | Requirement 9 | backend | US-011 | Match |
| US-012 | Unit tests -- execute method | 001 | Requirement 9 | backend | US-012 | Match |
| US-013 | Unit tests -- upload and download files | 001 | Requirement 9 | backend | US-013 | Match |
| US-014 | Unit tests -- health check and cleanup | 001 | Requirement 9 | backend | US-014 | Match |

### Phase 2: Sandbox Dispatch Wiring
**Spec**: `002-sandbox-dispatch.md` | **PRD Task**: `tasks/prd-mcp-sandbox-dispatch.md`

| Ralph ID | Ralph Title | Spec File | Spec Internal ID | PRD Task | PRD Internal ID | ID Mismatch? |
|----------|------------|-----------|-----------------|----------|----------------|--------------|
| US-015 | Add MCP to SandboxType enum and UserSettings | 002 | Requirements 1-2 | dispatch | US-001 | Yes - Ralph US-015 = PRD-dispatch US-001 |
| US-016 | Add mcp_sandbox_url to API schemas and routes | 002 | Requirements 3-4 | dispatch | US-002 | Yes - Ralph US-016 = PRD-dispatch US-002 |
| US-017 | Add MCP sandbox factory and register | 002 | Requirements 5-6 | dispatch | US-003 | Yes - Ralph US-017 = PRD-dispatch US-003 |
| US-018 | Update resolve_sandbox_backend() | 002 | Requirement 7 | dispatch | US-004 | Yes - Ralph US-018 = PRD-dispatch US-004 |
| US-019 | Add is_mcp_sandbox_error() helper | 002 | Requirement 10 | dispatch | US-005 | Yes - Ralph US-019 = PRD-dispatch US-005 |
| US-020 | Wire mcp_sandbox_url through LLMController | 002 | Requirement 8 (controllers) | dispatch | US-006 | Yes - Ralph US-020 = PRD-dispatch US-006 |
| US-021 | Wire mcp_sandbox_url through stream_generator | 002 | Requirement 8 (stream) + 9 | dispatch | US-007 | Yes - Ralph US-021 = PRD-dispatch US-007 |
| US-022 | Wire mcp_sandbox_url through worker tasks | 002 | Requirement 8 (worker) | dispatch | US-008 | Yes - Ralph US-022 = PRD-dispatch US-008 |
| US-023 | Integration validation -- dispatch pipeline | 002 | (covered by success criteria 15-16) | dispatch | US-009 | Yes - Ralph US-023 = PRD-dispatch US-009 |

### Phase 4: exec_server Structured Tools (sandboxes submodule)
**Spec**: `004-exec-server-structured.md` | **PRD Task**: `tasks/prd-mcp-sandbox-exec-server.md`

| Ralph ID | Ralph Title | Spec File | Spec Internal ID | PRD Task | PRD Internal ID | ID Mismatch? |
|----------|------------|-----------|-----------------|----------|----------------|--------------|
| US-024 | Rename exec_command to execute | 004 | Requirement 1, 3 | exec-server | US-001 | Yes - Ralph US-024 = PRD-exec US-001 |
| US-025 | Add _meta structure to all tool responses | 004 | Requirement 2 | exec-server | US-002 | Yes - Ralph US-025 = PRD-exec US-002 |
| US-026 | Implement read MCP tool | 004 | Requirement 4 | exec-server | US-003 | Yes - Ralph US-026 = PRD-exec US-003 |
| US-027 | Implement write MCP tool | 004 | Requirement 5 | exec-server | US-004 | Yes - Ralph US-027 = PRD-exec US-004 |
| US-028 | Implement edit MCP tool | 004 | Requirement 6 | exec-server | US-005 | Yes - Ralph US-028 = PRD-exec US-005 |
| US-029 | Implement grep MCP tool | 004 | Requirement 7 | exec-server | US-006 | Yes - Ralph US-029 = PRD-exec US-006 |
| US-030 | Implement glob MCP tool | 004 | Requirement 8 | exec-server | US-007 | Yes - Ralph US-030 = PRD-exec US-007 |
| US-031 | Implement ls MCP tool | 004 | Requirement 9 | exec-server | US-008 | Yes - Ralph US-031 = PRD-exec US-008 |
| US-032 | Implement upload_file MCP tool | 004 | Requirement 10 | exec-server | US-009 | Yes - Ralph US-032 = PRD-exec US-009 |
| US-033 | Implement download_file MCP tool | 004 | Requirement 11 | exec-server | US-010 | Yes - Ralph US-033 = PRD-exec US-010 |
| US-034 | Infrastructure -- sandbox_id, python3, /workspace | 004 | Requirements 12-14 | exec-server | US-011 | Yes - Ralph US-034 = PRD-exec US-011 |
| US-035 | Conformance test suite for all 9 MCP tools | 004 | Requirement 16 | exec-server | US-012 | Yes - Ralph US-035 = PRD-exec US-012 |

### Phase 3: Frontend MCP Option + Health + Fallback UX
**Spec**: `003-frontend-mcp-option.md` | **PRD Task**: `tasks/prd-mcp-sandbox-frontend.md`

| Ralph ID | Ralph Title | Spec File | Spec Internal ID | PRD Task | PRD Internal ID | ID Mismatch? |
|----------|------------|-----------|-----------------|----------|----------------|--------------|
| US-036 | Extend SandboxType union and normalizeSandboxValue | 003 | Requirements 1, 5 | frontend | US-001 | Yes - Ralph US-036 = PRD-frontend US-001 |
| US-037 | Add mcp_sandbox_url to API type interfaces | 003 | Requirements 2-3 | frontend | US-002 | Yes - Ralph US-037 = PRD-frontend US-002 |
| US-038 | Add MCP entry to SANDBOX_OPTIONS | 003 | Requirement 4 | frontend | US-003 | Yes - Ralph US-038 = PRD-frontend US-003 |
| US-039 | Add MCP Sandbox URL input field | 003 | Requirement 6 | frontend | US-004 | Yes - Ralph US-039 = PRD-frontend US-004 |
| US-040 | MCP option visibility gating | 003 | Requirement 7 | frontend | US-005 | Yes - Ralph US-040 = PRD-frontend US-005 |
| US-041 | Create useSandboxHealth hook | 003 | Requirement 8 | frontend | US-006 | Yes - Ralph US-041 = PRD-frontend US-006 |
| US-042 | Health dot in SandboxSettings dropdown | 003 | Requirement 9 | frontend | US-007 | Yes - Ralph US-042 = PRD-frontend US-007 |
| US-043 | Health dot in ThreadSandboxStatus popover | 003 | Requirement 10 | frontend | US-008 | Yes - Ralph US-043 = PRD-frontend US-008 |
| US-044 | Handle mcp_sandbox_unreachable SSE event | 003 | Requirements 11-12 | frontend | US-009 | Yes - Ralph US-044 = PRD-frontend US-009 |
| US-045 | Frontend integration validation | 003 | (covered by success criteria 16) | frontend | US-010 | Yes - Ralph US-045 = PRD-frontend US-010 |

### Phase 5: McpSandboxBackend v2 Native MCP Tools
**Spec**: `005-mcp-sandbox-v2.md` | **PRD Task**: `tasks/prd-mcp-sandbox-v2-native.md`

| Ralph ID | Ralph Title | Spec File | Spec Internal ID | PRD Task | PRD Internal ID | ID Mismatch? |
|----------|------------|-----------|-----------------|----------|----------------|--------------|
| US-046 | Tool discovery on session init | 005 | Requirement 1-2 | v2-native | US-001 | Yes - Ralph US-046 = PRD-v2 US-001 |
| US-047 | Dual-mode exit code extraction | 005 | Requirement 3 | v2-native | US-002 | Yes - Ralph US-047 = PRD-v2 US-002 |
| US-048 | Sandbox ID from _meta.sandbox_id | 005 | Requirement 4 | v2-native | US-003 | Yes - Ralph US-048 = PRD-v2 US-003 |
| US-049 | Override execute() -- dual tool name | 005 | Requirement 5 | v2-native | US-004 | Yes - Ralph US-049 = PRD-v2 US-004 |
| US-050 | Override read() | 005 | Requirement 6 | v2-native | US-005 | Yes - Ralph US-050 = PRD-v2 US-005 |
| US-051 | Override write() | 005 | Requirement 7 | v2-native | US-006 | Yes - Ralph US-051 = PRD-v2 US-006 |
| US-052 | Override edit() | 005 | Requirement 8 | v2-native | US-007 | Yes - Ralph US-052 = PRD-v2 US-007 |
| US-053 | Override grep_raw() | 005 | Requirement 9 | v2-native | US-008 | Yes - Ralph US-053 = PRD-v2 US-008 |
| US-054 | Override glob_info() | 005 | Requirement 10 | v2-native | US-009 | Yes - Ralph US-054 = PRD-v2 US-009 |
| US-055 | Override ls_info() | 005 | Requirement 11 | v2-native | US-010 | Yes - Ralph US-055 = PRD-v2 US-010 |
| US-056 | Override upload_files() | 005 | Requirement 12 | v2-native | US-011 | Yes - Ralph US-056 = PRD-v2 US-011 |
| US-057 | Override download_files() | 005 | Requirement 13 | v2-native | US-012 | Yes - Ralph US-057 = PRD-v2 US-012 |
| US-058 | Graceful degradation -- old exec_server | 005 | Requirement 15 | v2-native | US-013 | Yes - Ralph US-058 = PRD-v2 US-013 |
| US-059 | Integration validation -- all tests pass | 005 | Requirement 16-17 | v2-native | US-014 | Yes - Ralph US-059 = PRD-v2 US-014 |

---

## 2. Orphan Detection

### Stories in Ralph PRD NOT covered by any spec: **NONE**
All 59 Ralph stories (US-001 through US-059) are covered by at least one spec file.

### Stories in Ralph PRD NOT covered by any PRD task: **NONE**
All 59 Ralph stories (US-001 through US-059) are covered by at least one PRD task file.

### Requirements in specs NOT reflected in Ralph PRD

**Spec 001 (001-mcp-sandbox-backend.md):**
- The spec mentions a `_call_tool()` private helper method and `_base_url()` helper in its class skeleton (line 131-138). These are implementation details, not separate stories in Ralph. **Not a gap** -- they are internal to the class implementation stories.
- The spec has a detailed "Technical Considerations" section about sync vs async `execute()` and `BaseSandbox` contract (lines 282-288). Ralph does not have a dedicated story for this design decision. **Not a gap** -- this is design guidance, not a deliverable.

**Spec 002 (002-sandbox-dispatch.md):**
- No orphan requirements found. All numbered requirements map to Ralph stories.

**Spec 003 (003-frontend-mcp-option.md):**
- The spec mentions `SSEEvent` type updates, `fetchStreamReader.ts` changes, and `useChat.ts` changes in its "Files Changed" table (lines 346-353). These are implementation detail files for US-044 (mcp_sandbox_unreachable handling). **Not a gap** -- covered by Ralph US-044.

**Spec 004 (004-exec-server-structured.md):**
- Requirement 15: "Update `tools/list` response: All 9 tools should be listed" -- This is covered implicitly in Ralph US-035 (conformance test validates tools/list). **Not a separate gap**.
- Success criterion 20: "All tool handlers run commands as `executor` user (unprivileged)" -- This is mentioned in individual Ralph stories' acceptance criteria. **Not a separate gap**.

**Spec 005 (005-mcp-sandbox-v2.md):**
- Requirement 14: "All native tool overrides must return the exact same types" (return type parity). This is covered implicitly across all override stories in Ralph (US-049 through US-057). Ralph US-059 integration validation also covers this. **Not a separate gap**.
- The spec's `_parse_json_lines()` helper is mentioned in requirement 9 (grep) and the implementation approach section. Ralph US-053 includes it in acceptance criteria. **Not a gap**.

### Requirements in PRD tasks NOT reflected in Ralph PRD

**PRD-backend:**
- FR-12: "All logging MUST use `src.utils.logger.logger`" -- This is an acceptance criterion in Ralph US-001 ("from src.utils.logger import logger is used for all logging"). **Not a gap**.
- FR-13: "A custom `McpSandboxError(Exception)` MUST be defined" -- This is Ralph US-002. **Not a gap**.
- The PRD-backend has a detailed "Open Questions" section (lines 305-309) covering sync/async, close() lifecycle, timeout matching, base64 for large files, and URL format. None of these resulted in separate Ralph stories. **Minor gap** -- these design decisions should be documented as notes on the relevant stories, but they are not missing deliverables.

**PRD-dispatch:**
- All requirements map cleanly to Ralph stories.

**PRD-frontend:**
- The PRD-frontend has detailed "Technical Considerations" sections about health endpoint derivation algorithm, SSE event handling pattern, toast retry mechanism, and visibility gating approach (lines 257-340). These are implementation guidance for existing Ralph stories. **Not gaps**.
- Open question about CORS proxying through backend API (line 373). Not reflected as a separate story. **Minor gap** -- but this is an open question, not a committed deliverable.

**PRD-exec-server:**
- FR-14: "Tool Registration" and FR-15: "Unprivileged Execution" are covered in individual tool stories' acceptance criteria. **Not gaps**.

**PRD-v2-native:**
- FR-10: "JSON lines parsing must handle empty text, single-line, and multi-line responses gracefully, skipping malformed lines" -- Covered in Ralph US-053 (grep_raw) acceptance criteria which mentions `_parse_json_lines`. **Not a separate gap**, though it's a cross-cutting concern used by US-053, US-054, and US-055.

---

## 3. ID Mismatch Summary

**Every PRD task file and spec file uses internal numbering that resets to US-001 within each file.** This is a systematic pattern, not an error:

| Layer | ID Range | Ralph Global Range |
|-------|----------|-------------------|
| PRD-backend | US-001 to US-014 | Ralph US-001 to US-014 |
| PRD-dispatch | US-001 to US-009 | Ralph US-015 to US-023 |
| PRD-exec-server | US-001 to US-012 | Ralph US-024 to US-035 |
| PRD-frontend | US-001 to US-010 | Ralph US-036 to US-045 |
| PRD-v2-native | US-001 to US-014 | Ralph US-046 to US-059 |

The spec files use numbered requirements (1, 2, 3...) rather than US-XXX IDs, making them even less directly comparable. However, the content aligns 1:1.

**Notable ID ordering differences between Ralph and PRD-backend:**
- Ralph US-002 (McpSandboxError) = PRD-backend US-008 (moved to later position)
- Ralph US-003 (session init) = PRD-backend US-002 (moved earlier)
- Ralph US-004 (execute) = PRD-backend US-003
- Ralph US-005 (id property) = PRD-backend US-004
- Ralph US-006 (upload_files) = PRD-backend US-005
- Ralph US-007 (download_files) = PRD-backend US-006
- Ralph US-008 (health) = PRD-backend US-007

The PRD-backend reordered the McpSandboxError story from position 2 (Ralph) to position 8 (PRD-backend), placing it after all the method implementations. All other phase PRD tasks maintain the same relative ordering as Ralph.

---

## 4. Overall Coverage Score: **9/10**

### Justification

**Strengths (pushing toward 10):**
- Perfect 59/59 story coverage: every Ralph story maps to both a spec file and a PRD task file
- Zero orphan stories in any direction (no Ralph stories missing from specs/PRDs, no spec/PRD requirements missing from Ralph)
- Consistent phase grouping: stories are logically grouped into 5 phases across all three layers
- Acceptance criteria alignment: Ralph's acceptance criteria are faithfully reflected in both specs and PRDs, often with additional implementation detail in the PRDs
- Dependency chains are explicit and consistent across all three layers

**Weaknesses (preventing 10):**
- **ID numbering mismatch (-0.5)**: PRD tasks use file-local US-001 numbering that collides with Ralph's global numbering. This creates potential confusion when referencing stories across documents. A developer looking at "US-003" needs to know which document to interpret it in context. The PRD-backend additionally reorders the McpSandboxError story relative to Ralph.
- **Spec files use requirement numbers, not US-IDs (-0.25)**: The specs use numbered requirements (1-16) rather than US-XXX identifiers, making cross-referencing between Ralph and specs require content matching rather than ID lookup.
- **Open questions untracked (-0.25)**: Several PRD files contain open design questions (sync/async execute, CORS proxying, file size limits, etc.) that are not tracked as notes on corresponding Ralph stories. These could block implementation if not resolved pre-development.

**Overall**: The three artifact layers are in excellent alignment. Content coverage is 100% with no gaps. The only friction is in the ID numbering scheme, which is a traceability inconvenience rather than a coverage gap.
