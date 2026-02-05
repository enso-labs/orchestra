# PRD: Update create_deep_agent Scaffolding

## Summary

Orchestra's `create_deep_agent()` scaffolding is out of date with the latest `deepagents` library. The library now auto-applies an internal `SummarizationMiddleware`, supports new parameters (`skills`, `memory`, `name`, `response_format`, `interrupt_on`), and ships middleware that overlaps with Orchestra's custom `compaction_middleware`. This causes a **critical double-summarization bug** where every model call runs two compaction passes, wasting tokens and producing unpredictable context windows.

This PRD defines the work to (1) eliminate the double-summarization conflict via a feature-flagged removal of Orchestra's custom compaction, (2) wire the five new `create_deep_agent()` parameters through Orchestra's full call chain (schemas, controller, stream, agents, Orchestra class), (3) update tests to reflect the new middleware stack, (4) add markdown documentation cells and `name` parameter usage to the example notebooks, and (5) deprecate `system_prompt`/`instructions` in favor of AGENTS.md files loaded via the `memory` parameter, aligning with the deepagents library's recommended pattern.

## Background

Orchestra wraps the `deepagents` library's `create_deep_agent()` function to build steerable AI agents. When `deepagents==0.3.8` was current, it did **not** ship an internal `SummarizationMiddleware`, so Orchestra built its own in `backend/src/utils/compacting.py`. The header comment in that file explicitly states this decision.

The latest `deepagents` version has changed significantly:
- **Auto-applied middleware**: `SummarizationMiddleware`, `AnthropicPromptCachingMiddleware`, `PatchToolCallsMiddleware`, `TodoListMiddleware`, `FilesystemMiddleware`, and `SubAgentMiddleware` are now applied internally by `create_deep_agent()` before user-provided middleware is appended.
- **New parameters**: `skills`, `memory`, `name`, `response_format`, and `interrupt_on` are accepted but not currently passed by Orchestra.
- **BackendFactory support**: The `backend` parameter now also accepts a callable `BackendFactory`, in addition to `BackendProtocol`.

Orchestra's existing call chain (`LLMController` -> `stream_generator` / `construct_agent` -> `Orchestra` -> `init_graph` -> `create_deep_agent`) does not forward these new parameters, and the duplicate `compaction_middleware` in `init_default_middleware()` creates a confirmed conflict with the internal `SummarizationMiddleware`.

## Goals

- **Eliminate double-summarization**: Remove Orchestra's `compaction_middleware` from the default middleware stack, using a feature flag for safe rollback.
- **Expose new API surface**: Wire `skills`, `memory`, `name`, `response_format`, and `interrupt_on` through the full call chain so API consumers and assistants can configure them.
- **Maintain backward compatibility**: All new fields are `Optional` with `None` defaults. Existing API requests, assistants, and tests must continue to work unchanged.
- **Improve observability**: Pass `name` to `create_deep_agent()` for better LangSmith tracing and log identification.
- **Update example notebooks**: Add markdown documentation cells to all existing notebooks, add `name` parameter usage, and clean up stale patterns (internal API imports, dead code).
- **Deprecate system_prompt/instructions**: Soft-deprecate the `system_prompt` and `instructions` fields on schemas, and migrate the agent pipeline to use AGENTS.md files via the `memory` parameter instead of passing `system_prompt` directly to `create_deep_agent()`, behind a feature flag for safe rollback.

## Non-Goals

- **Adopting `memory` parameter for user memories**: Orchestra's `add_memories_to_system()` loads user memories from the LangGraph Store. The `memory` parameter in `create_deep_agent()` loads project context (AGENTS.md files) from the backend filesystem. These serve different purposes. Migrating user memories to `MemoryMiddleware` is out of scope.
- **Building frontend HITL UI**: The `interrupt_on` parameter will be wired through the backend, but the frontend interrupt/resume flow is a separate effort.
- **Creating new example notebooks**: The Notebook Architect recommended 3 new notebooks (`skills_and_memory.ipynb`, `structured_output.ipynb`, `human_in_the_loop.ipynb`). These are deferred until the backend parameters are fully wired and validated.
- **Adopting `BackendFactory` pattern**: Converting Orchestra's eager `init_backend()` to a lazy factory is a low-priority optimization that can be done separately.
- **Implementing `response_format` in existing controllers**: Wiring the parameter through is in scope; building structured output workflows is not.

## User Stories

### US-001: Remove duplicate compaction middleware behind feature flag

**Description:** As a backend developer, I want to remove Orchestra's custom `compaction_middleware` from the default middleware stack so that only the internal `SummarizationMiddleware` handles message compaction, eliminating double summarization.

**Priority:** P0

**Files:**
- `backend/src/utils/middleware.py`
- `backend/src/utils/compacting.py`

**Acceptance Criteria:**
- [ ] `init_default_middleware()` conditionally excludes `compaction_middleware` based on the `USE_INTERNAL_SUMMARIZATION` environment variable (default: `"true"`)
- [ ] When `USE_INTERNAL_SUMMARIZATION=true` (default), `compaction_middleware` is NOT in the returned middleware list
- [ ] When `USE_INTERNAL_SUMMARIZATION=false`, `compaction_middleware` IS in the returned middleware list (rollback path)
- [ ] `compacting.py` header comment is updated to note deprecation and reference issue #734
- [ ] The `compaction_middleware` import in `middleware.py` remains (used by the feature flag branch) but is guarded
- [ ] Typecheck passes
- [ ] All existing tests pass

---

### US-002: Update middleware integration tests for new stack

**Description:** As a backend developer, I want the middleware integration tests to reflect the updated default middleware stack (without `compaction_middleware` by default) so that the test suite validates the correct middleware composition.

**Priority:** P0

**Files:**
- `backend/tests/unit/utils/test_middleware_integration.py`
- `backend/tests/unit/utils/test_compacting.py`

**Acceptance Criteria:**
- [ ] `test_middleware_integration.py` asserts that `init_default_middleware()` returns 5 items (was 6) when `USE_INTERNAL_SUMMARIZATION=true`
- [ ] `test_middleware_integration.py` includes a test verifying `compaction_middleware` is NOT in the default stack
- [ ] `test_middleware_integration.py` includes a test verifying `compaction_middleware` IS in the stack when `USE_INTERNAL_SUMMARIZATION=false`
- [ ] `test_compacting.py` retains existing tests for the `SummarizationMiddleware` class itself (unit tests for the compaction logic remain valid)
- [ ] Typecheck passes
- [ ] All existing tests pass

---

### US-003: Add new fields to LLMRequest and Assistant schemas

**Description:** As an API consumer, I want to pass `skills`, `memory`, `agent_name`, `response_format`, and `interrupt_on` in my API requests so that I can configure the new `create_deep_agent()` parameters.

**Priority:** P1

**Files:**
- `backend/src/schemas/entities/llm.py`

**Acceptance Criteria:**
- [ ] `LLMRequest` has new Optional fields: `skills: Optional[List[str]]`, `memory: Optional[List[str]]`, `agent_name: Optional[str]`, `response_format: Optional[Dict[str, Any]]`, `interrupt_on: Optional[Dict[str, Any]]` -- all default to `None`
- [ ] `Assistant` has new Optional fields: `skills: Optional[List[str]]`, `memory: Optional[List[str]]`, `agent_name: Optional[str]`, `response_format: Optional[Dict[str, Any]]`, `interrupt_on: Optional[Dict[str, Any]]` -- all default to `None`
- [ ] `Assistant.to_llm_request()` propagates the five new fields to the returned `LLMRequest`
- [ ] Existing API requests without the new fields continue to work (backward compatible)
- [ ] Typecheck passes
- [ ] All existing tests pass

---

### US-004: Add schema tests for new LLMRequest and Assistant fields

**Description:** As a backend developer, I want unit tests covering the new schema fields so that I can verify they default correctly and propagate through `to_llm_request()`.

**Priority:** P1

**Files:**
- `backend/tests/unit/schemas/test_llm_schemas.py` (new file, or add to existing test file if one exists)

**Acceptance Criteria:**
- [ ] Test that `LLMRequest` new fields all default to `None` when not provided
- [ ] Test that `LLMRequest` new fields are set correctly when provided
- [ ] Test that `Assistant.to_llm_request()` propagates all five new fields
- [ ] Typecheck passes
- [ ] All existing tests pass

---

### US-005: Wire new parameters through init_graph and Orchestra class

**Description:** As a backend developer, I want `init_graph()` and `Orchestra.__init__()` to accept and forward `skills`, `memory`, `name`, `response_format`, and `interrupt_on` to `create_deep_agent()` so that the new API surface is available to the agent construction pipeline.

**Priority:** P1

**Files:**
- `backend/src/agents/__init__.py`

**Acceptance Criteria:**
- [ ] `init_graph()` signature includes: `skills: list[str] | None = None`, `memory: list[str] | None = None`, `name: str | None = None`, `response_format: Any | None = None`, `interrupt_on: dict[str, Any] | None = None`
- [ ] `init_graph()` passes all five new parameters to `create_deep_agent()`
- [ ] `Orchestra.__init__()` signature includes the same five new parameters
- [ ] `Orchestra.__init__()` forwards the five parameters to `init_graph()`
- [ ] `construct_agent()` signature includes: `skills`, `memory`, `agent_name`, `response_format`, `interrupt_on`
- [ ] `construct_agent()` forwards the parameters to `Orchestra()` (mapping `agent_name` to `name`)
- [ ] Typecheck passes
- [ ] All existing tests pass

---

### US-006: Wire new parameters through LLMController and stream_generator

**Description:** As a backend developer, I want `LLMController.llm_invoke()`, `LLMController.llm_stream()`, and `stream_generator()` to pass the new parameters through to `construct_agent()` so that the full request-to-agent pipeline supports the new configuration.

**Priority:** P1

**Files:**
- `backend/src/controllers/llm.py`
- `backend/src/utils/stream.py`

**Acceptance Criteria:**
- [ ] `LLMController.llm_invoke()` reads `skills`, `memory`, `agent_name`, `response_format`, `interrupt_on` from `params` and passes them to `construct_agent()`
- [ ] `LLMController.llm_stream()` reads the same fields from `assistant` and passes them to `stream_generator()`
- [ ] `stream_generator()` signature includes the five new parameters
- [ ] `stream_generator()` passes them to `construct_agent()`
- [ ] Typecheck passes
- [ ] All existing tests pass

---

### US-007: Add integration test for new parameter propagation

**Description:** As a backend developer, I want an integration test that verifies the new parameters flow from `init_graph()` through to `create_deep_agent()` so that I can confirm end-to-end wiring works.

**Priority:** P1

**Files:**
- `backend/tests/unit/agents/test_init_graph.py` (new file)

**Acceptance Criteria:**
- [ ] Test mocks `create_deep_agent` and verifies `init_graph()` passes `skills`, `memory`, `name`, `response_format`, `interrupt_on` through to the mock
- [ ] Test verifies that `None` defaults are passed when no new parameters are provided
- [ ] Typecheck passes
- [ ] All existing tests pass

---

### US-008: Deprecate compaction constants in llm.py

**Description:** As a backend developer, I want the `DEFAULT_COMPACTION_*` constants in `backend/src/constants/llm.py` to be marked as deprecated so that future contributors understand they are no longer actively used by the default middleware stack.

**Priority:** P2

**Files:**
- `backend/src/constants/llm.py`

**Acceptance Criteria:**
- [ ] `DEFAULT_COMPACTION_TOKEN_THRESHOLD`, `DEFAULT_COMPACTION_RECENT_MESSAGES`, and `DEFAULT_COMPACTION_MODEL` have deprecation comments referencing issue #734
- [ ] Constants are NOT removed (they are still used when `USE_INTERNAL_SUMMARIZATION=false`)
- [ ] Typecheck passes
- [ ] All existing tests pass

---

### US-009: Add markdown cells and name parameter to existing example notebooks

**Description:** As a developer reading the example notebooks, I want markdown documentation cells explaining each section and the `name` parameter set on all agents so that I can understand the examples without reading all code and get better traces.

**Priority:** P2

**Files:**
- `examples/agents/deep_agent_backend.ipynb`
- `examples/agents/stream_subagent_updates.ipynb`
- `examples/agents/RLM.ipynb`

**Acceptance Criteria:**
- [ ] Each notebook has a title markdown cell with purpose, features covered, and prerequisites
- [ ] Each major code section is preceded by a markdown cell explaining what it demonstrates
- [ ] All `create_deep_agent()` calls include the `name` parameter with a descriptive kebab-case value
- [ ] Dead code (commented-out imports, unused provider installs) is removed
- [ ] `deep_agent_backend.ipynb` removes direct `ToolRuntime` import/construction (uses public API only)
- [ ] `stream_subagent_updates.ipynb` removes unused package installs (`langchain-anthropic`, `langchain-groq`, `langchain-xai`)
- [ ] `RLM.ipynb` cells with V3/V4 (raw LangGraph implementations) are either removed or clearly separated into an "Advanced: Raw LangGraph" section with a warning that these do not use `create_deep_agent()`
- [ ] Notebook outputs are cleared
- [ ] Typecheck passes (N/A for notebooks, but no Python syntax errors)
- [ ] All existing tests pass

---

### US-010: Soft-deprecate system_prompt and instructions on LLMRequest and Assistant schemas

**Description:** As a backend developer, I want the `system_prompt` and `instructions` fields on `LLMRequest` and `Assistant` to be marked as deprecated so that developers understand they should migrate to AGENTS.md files loaded via the `memory` parameter, aligning with the deepagents library's recommended pattern.

**Priority:** P2

**Files:**
- `backend/src/schemas/entities/llm.py`

**Acceptance Criteria:**
- [ ] `system_prompt` field on `Assistant` has a deprecation comment referencing #734 and recommending AGENTS.md via `memory` parameter
- [ ] `instructions` field on `Assistant` has a deprecation comment referencing #734 and recommending AGENTS.md via `memory` parameter
- [ ] `system_prompt` field on `LLMRequest` has a deprecation comment referencing #734 and recommending AGENTS.md via `memory` parameter
- [ ] `instructions` field on `LLMRequest` has a deprecation comment referencing #734 and recommending AGENTS.md via `memory` parameter
- [ ] `validate_system_prompt_or_instructions` validator has a deprecation comment noting both fields are deprecated in favor of AGENTS.md
- [ ] Field `description` values updated to note deprecation (e.g., `"Deprecated (#734): Use AGENTS.md via memory parameter instead."`)
- [ ] Fields are NOT removed (soft deprecation only -- still functional for backward compatibility and rollback)
- [ ] Typecheck passes
- [ ] All existing tests pass

---

### US-011: Migrate system_prompt/instructions to AGENTS.md via memory parameter in agent pipeline

**Description:** As a backend developer, I want `init_graph()` to stop passing `system_prompt` directly to `create_deep_agent()` and instead write the system prompt content as an AGENTS.md file to the backend filesystem and pass it via the `memory` parameter, aligning with the deepagents library's recommended pattern where agent instructions are provided through AGENTS.md files.

**Priority:** P1

**Files:**
- `backend/src/agents/__init__.py`

**Acceptance Criteria:**
- [ ] `init_graph()` conditionally controls how system_prompt reaches `create_deep_agent()` based on the `USE_AGENTS_MD_INSTRUCTIONS` environment variable (default: `"true"`)
- [ ] When `USE_AGENTS_MD_INSTRUCTIONS=true` (default):
  - [ ] System prompt content (including merged instructions) is written to the backend filesystem as an AGENTS.md file
  - [ ] The AGENTS.md file path is prepended to the `memory` list
  - [ ] `system_prompt=None` is passed to `create_deep_agent()` (the library uses its internal default or reads from AGENTS.md)
  - [ ] User-provided `memory` paths are preserved alongside the generated AGENTS.md path
- [ ] When `USE_AGENTS_MD_INSTRUCTIONS=false` (rollback):
  - [ ] `system_prompt` is passed directly to `create_deep_agent()` as before (existing behavior preserved)
  - [ ] `memory` is passed through unchanged
- [ ] Typecheck passes
- [ ] All existing tests pass

---

### US-012: Deprecate init_system_prompt() and update construct_agent() for AGENTS.md migration

**Description:** As a backend developer, I want `construct_agent()` to support the AGENTS.md-first instruction pattern by passing `instructions` content through the `memory` parameter rather than merging it into `system_prompt` via `init_system_prompt()`, and I want `init_system_prompt()` marked as deprecated.

**Priority:** P1

**Files:**
- `backend/src/agents/__init__.py`
- `backend/src/utils/format.py`

**Acceptance Criteria:**
- [ ] When `USE_AGENTS_MD_INSTRUCTIONS=true`, `construct_agent()` passes `instructions` content to `Orchestra`/`init_graph()` via a mechanism that writes it as AGENTS.md (rather than calling `init_system_prompt()` to merge into system_prompt)
- [ ] When `USE_AGENTS_MD_INSTRUCTIONS=false`, `construct_agent()` continues using `init_system_prompt()` to merge `instructions` into `system_prompt` (rollback path)
- [ ] `init_system_prompt()` in `format.py` has a deprecation comment noting it is only used when `USE_AGENTS_MD_INSTRUCTIONS=false` and referencing #734
- [ ] Metadata (timezone, language, UTC time) previously injected by `init_system_prompt()` is preserved in the AGENTS.md content or handled through an alternative mechanism
- [ ] Subagent system prompts are also migrated to the AGENTS.md pattern when the flag is enabled
- [ ] Typecheck passes
- [ ] All existing tests pass

---

### US-013: Add tests for system_prompt → AGENTS.md migration

**Description:** As a backend developer, I want tests verifying that the system_prompt → AGENTS.md migration works correctly with both feature flag states, ensuring no regressions in either mode.

**Priority:** P1

**Files:**
- `backend/tests/unit/agents/test_init_graph.py`

**Acceptance Criteria:**
- [ ] Test that when `USE_AGENTS_MD_INSTRUCTIONS=true`, `init_graph()` does NOT pass `system_prompt` to `create_deep_agent()`
- [ ] Test that when `USE_AGENTS_MD_INSTRUCTIONS=true`, system_prompt content is written to the backend as an AGENTS.md file and the file path is included in the `memory` list
- [ ] Test that when `USE_AGENTS_MD_INSTRUCTIONS=false`, `init_graph()` passes `system_prompt` to `create_deep_agent()` as before
- [ ] Test that user-provided `memory` paths are preserved alongside the generated AGENTS.md path (no data loss)
- [ ] Test that `None` system_prompt does not generate an AGENTS.md file
- [ ] Typecheck passes
- [ ] All existing tests pass

---

### US-014: Frontend QA validation of backend changes using agent-browser

**Description:** As a QA engineer, I want to validate that the backend changes from US-001 through US-009 do not break the frontend application by performing end-to-end browser testing using the `agent-browser` CLI, ensuring login, assistant management, and chat functionality all work correctly.

**Priority:** P1

**Files:**
- No code changes — this is a QA validation story only

**Acceptance Criteria:**
- [ ] Dev servers are running from the correct worktree (frontend on 5173, backend on 8000). Use `npm run dev:claude` for frontend if `npm run dev` fails, or `npx vite --host 0.0.0.0 --port 5173` as fallback
- [ ] Login works: Navigate to `http://localhost:5173`, login with `admin@example.com` / `test1234`, verify redirect to main app
- [ ] Assistant list loads: Navigate to agents/assistants page, verify at least one assistant is listed without errors
- [ ] Assistant creation works: Create a new assistant with name, description, model, and tools — verify it saves successfully and appears in the list
- [ ] Chat works end-to-end: Open a chat thread with an assistant, send a message, verify a streamed response is received without errors
- [ ] Console is clean: Run `agent-browser console` and `agent-browser errors` — verify no JavaScript errors or failed API requests related to the schema changes
- [ ] Screenshot evidence: Capture screenshots of (1) logged-in dashboard, (2) assistant list, (3) successful chat response — save to `.ralph/qa-screenshots/` directory
- [ ] No regressions from middleware changes: The chat response completes successfully, confirming the compaction middleware removal (US-001) does not break streaming

---

### US-015: Backend API backward compatibility validation

**Description:** As a QA engineer, I want to validate that the backend API accepts requests both with and without the new optional fields (skills, memory, agent_name, response_format, interrupt_on) by making curl requests against the running backend, confirming backward compatibility.

**Priority:** P1

**Files:**
- No code changes — this is a QA validation story only

**Acceptance Criteria:**
- [ ] Backend is running on port 8000 from the correct worktree
- [ ] Login request succeeds: `curl -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"test1234"}'` returns a token
- [ ] Invoke without new fields works: `curl -X POST http://localhost:8000/api/v0/llm/invoke` with only `input.messages` succeeds (backward compatible)
- [ ] Invoke with new fields works: `curl -X POST http://localhost:8000/api/v0/llm/invoke` including `skills`, `memory`, and `agent_name` fields returns a valid response (no 422 validation error)
- [ ] OpenAPI schema includes new fields: `curl http://localhost:8000/openapi.json` contains the new optional fields in the LLMRequest schema definition
- [ ] Log evidence: Append curl commands and response summaries to progress.txt

---

## Technical Notes

### Cross-cutting concern: Feature flag for compaction removal

The Backend Integration Architect recommends a feature-flag approach rather than hard-removing `compaction_middleware`. The flag `USE_INTERNAL_SUMMARIZATION` (env var, default `"true"`) allows toggling between the internal `SummarizationMiddleware` and Orchestra's custom implementation without code changes. This is the recommended approach for US-001.

After validation in production, a follow-up task should remove the feature flag and fully delete the `compaction_middleware` code path.

### Cross-cutting concern: Dual memory systems

Orchestra has two memory injection systems that serve different purposes:
1. **User memories** (`add_memories_to_system()` + `MEMORY_TOOLS`): Loads user-specific todos, notes, reminders from the LangGraph Store. This remains unchanged.
2. **Project context** (`memory` parameter / `MemoryMiddleware`): Loads AGENTS.md files from the backend filesystem for project-level context. This is what the new `memory` parameter enables.

These are complementary, not duplicative. US-005/US-006 wire the `memory` parameter through but do not replace the existing `add_memories_to_system()` flow.

### Cross-cutting concern: AutoEvictMiddleware vs FilesystemMiddleware

The internal `FilesystemMiddleware` and Orchestra's `AutoEvictMiddleware` both interact with the backend's `write()` method but serve different purposes:
- `FilesystemMiddleware`: Handles the agent's virtual filesystem operations (read, write, list files).
- `AutoEvictMiddleware`: Evicts large tool call results to the filesystem when they exceed a token threshold.

These operate on different triggers and have been assessed as **low risk** for conflict. No action is needed.

### Cross-cutting concern: system_prompt/instructions deprecation and AGENTS.md migration

The `deepagents` library recommends using AGENTS.md files (loaded via the `memory` parameter and `MemoryMiddleware`) for agent instructions, rather than passing `system_prompt` directly to `create_deep_agent()`. Orchestra currently uses `system_prompt` and `instructions` fields on `LLMRequest`/`Assistant`, which are merged by `init_system_prompt()` in `format.py` and passed as `create_deep_agent(system_prompt=...)`.

US-010 through US-013 implement a phased migration:

1. **US-010** (soft deprecation): Add deprecation comments to schema fields. No behavioral change.
2. **US-011** (pipeline migration): Behind `USE_AGENTS_MD_INSTRUCTIONS` feature flag (default `"true"`), `init_graph()` writes system_prompt content as an AGENTS.md file to the backend filesystem and passes the path via the `memory` parameter instead of passing `system_prompt` directly.
3. **US-012** (utility deprecation): `init_system_prompt()` is marked deprecated, only used in rollback path. `construct_agent()` updated to route `instructions` through the AGENTS.md mechanism.
4. **US-013** (tests): Verify both flag states work correctly.

**Interaction with AGENTS.md injection PRD**: The separate `prd-agents-md-system-prompt-injection.md` handles extracting user-created AGENTS.md files from `assistant.files` and injecting content as `instructions`. With US-011/US-012, those injected `instructions` will flow through the memory parameter as AGENTS.md files rather than being merged into `system_prompt` via `init_system_prompt()`. The two features are complementary.

**Metadata handling**: `init_system_prompt()` currently appends timezone, language, and UTC time to the composed prompt. When `USE_AGENTS_MD_INSTRUCTIONS=true`, this metadata must be preserved — either appended to the AGENTS.md content or handled through an alternative mechanism (e.g., a separate metadata file in memory, or a minimal system_prompt containing only metadata).

After validation in production, a follow-up task should remove the feature flag and fully delete the `init_system_prompt()` code path.

### Story dependency order

```
US-001 (remove compaction) -----> US-002 (update middleware tests)
                                    |
US-003 (schema changes) ---------> US-004 (schema tests)
        |
        v
US-005 (agents/__init__.py) -----> US-007 (init_graph tests)
        |
        v
US-006 (controller + stream)
        |
        v
US-008 (deprecate constants)   -- independent, can run any time after US-001
US-009 (notebook updates)       -- independent, can run any time

US-010 (deprecate schema fields)   -- independent, can run any time
US-011 (pipeline migration)  ----> US-013 (migration tests)
        |
        v
US-012 (deprecate init_system_prompt)

US-014 (frontend QA via agent-browser)  -- depends on US-001 through US-009
US-015 (backend API curl validation)    -- depends on US-001 through US-009
```

US-001 and US-003 can run in parallel (they touch different files). US-005 depends on US-003 (needs the schema fields to exist). US-006 depends on US-005 (needs the `construct_agent()` signature to be updated). US-002 depends on US-001. US-004 depends on US-003. US-007 depends on US-005.

US-010 is independent (comments only). US-011 depends on US-005/US-006 (needs the memory parameter wired through). US-012 depends on US-011. US-013 depends on US-011.

US-014 and US-015 are QA validation stories — no code changes, only browser and curl verification. They depend on US-001 through US-009 being complete (all currently passing). US-014 uses `agent-browser` CLI, US-015 uses `curl`.

### Internal middleware stack after changes

After US-001 is applied (with `USE_INTERNAL_SUMMARIZATION=true`), the effective middleware stack will be:

```
create_deep_agent() internal stack:
  1. TodoListMiddleware
  2. MemoryMiddleware             (if memory != None)
  3. SkillsMiddleware             (if skills != None)
  4. FilesystemMiddleware
  5. SubAgentMiddleware
  6. SummarizationMiddleware      (auto-applied, model-profile-aware)
  7. AnthropicPromptCachingMiddleware
  8. PatchToolCallsMiddleware

Orchestra's appended middleware (via init_default_middleware()):
  9.  add_ai_message_metadata
  10. retry_model
  11. PIIMiddleware (credit_card)
  12. PIIMiddleware (api_key)
  13. AutoEvictMiddleware

  14. HumanInTheLoopMiddleware    (if interrupt_on != None, added by create_deep_agent)
```

### Internal vs Orchestra SummarizationMiddleware comparison

| Feature | Internal (deepagents) | Orchestra Custom |
|---|---|---|
| Trigger mechanism | Model profile fraction (85%) or token count (170k) | Token estimate (`len/4` heuristic, 170k threshold) |
| Backend offloading | Yes, to `/conversation_history/{thread_id}.md` | No |
| Message removal | `RemoveMessage(id=REMOVE_ALL_MESSAGES)` | Replaces in state directly |
| Summary format | `HumanMessage` with `lc_source='summarization'` | `SystemMessage` with `[CONVERSATION SUMMARY]` prefix |
| Tool arg truncation | Yes, configurable | No |
| Error handling | Aborts if offload fails (preserves messages) | Logs warning, returns original messages |

The internal implementation is production-grade with backend persistence, proper message ID handling, and argument truncation. Orchestra's custom implementation was a reasonable stopgap that should now be retired.

## Testing Strategy

### Unit tests to update

| Test File | Changes |
|---|---|
| `backend/tests/unit/utils/test_middleware_integration.py` | Update stack length assertions (6 -> 5). Add feature flag toggle tests. Verify `compaction_middleware` exclusion. |
| `backend/tests/unit/utils/test_compacting.py` | Keep existing tests for the `SummarizationMiddleware` class (they test the class directly, not the middleware stack). Add comment noting the class is deprecated. |

### Unit tests to add

| Test File | Purpose |
|---|---|
| `backend/tests/unit/schemas/test_llm_schemas.py` | Verify new fields default to `None`, are set when provided, and propagate through `to_llm_request()`. |
| `backend/tests/unit/agents/test_init_graph.py` | Mock `create_deep_agent` and verify new parameters are forwarded. Verify `None` defaults. |

### Manual validation

After all stories are complete, run the following:

```bash
# Full test suite
make test

# Test backward compatibility (no new fields)
curl -X POST http://localhost:8000/api/v0/llm/invoke \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"input": {"messages": [{"role": "user", "content": "Hello"}]}}'

# Test with new parameters
curl -X POST http://localhost:8000/api/v0/llm/invoke \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "input": {"messages": [{"role": "user", "content": "Hello"}]},
    "skills": ["/skills/user/"],
    "memory": ["/memory/AGENTS.md"],
    "agent_name": "test-agent"
  }'

# Test with feature flag reverted
USE_INTERNAL_SUMMARIZATION=false make dev
# Then repeat backward-compatibility test above
```

### Long conversation validation

After removing `compaction_middleware`, test with a conversation exceeding 170k estimated tokens to verify the internal `SummarizationMiddleware` triggers correctly and produces a summary `HumanMessage` with `lc_source='summarization'`.

## Rollback Plan

### Level 1: Toggle feature flag (no code change)

Set `USE_INTERNAL_SUMMARIZATION=false` in the environment. Orchestra's custom `compaction_middleware` re-enters the middleware stack. Double summarization returns, but the system works as it did before. **Deployment time: seconds.**

### Level 2: Revert compaction change (1-2 files)

If the feature flag approach itself causes issues:
1. Remove the `USE_INTERNAL_SUMMARIZATION` guard from `init_default_middleware()`.
2. Re-add `compaction_middleware` unconditionally to the returned list.
3. Revert the deprecation comment in `compacting.py`.

**Deployment time: minutes.** This is a 2-file revert.

### Level 3: Revert schema and plumbing changes

If the new schema fields cause serialization or API issues:
1. `git revert` the commits from US-003 through US-006.
2. All new fields have `None` defaults, so removing them should not break existing data in the store.

**Deployment time: standard deploy cycle.**

### Level 4: Full revert

`git revert` all commits from this PRD. The system returns to the pre-#734 state.
