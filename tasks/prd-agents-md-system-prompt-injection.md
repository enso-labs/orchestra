# PRD: AGENTS.md System Prompt Injection

## Introduction

Add support for injecting AGENTS.md file content as the `instructions` field in the LLM system prompt. When an assistant or thread has an `AGENTS.md` file in its files map, the content is automatically extracted and injected into the system prompt via the existing `instructions` mechanism. This enables users to configure agent behavior through a familiar markdown file convention (similar to Claude Code's CLAUDE.md) without requiring changes to any schema, controller, route, or worker code. The entire feature is a single-file backend change in `LLMService.assistant()`.

## Goals

- Automatically extract `AGENTS.md` content from assistant files or thread-level files and inject it as `instructions`
- Support both agent mode (assistant with files) and non-agent/thread mode (per-request files)
- Handle multiple content formats: plain string, dict with `content` key (string or list), and list
- AGENTS.md takes precedence over existing `instructions` field when present
- Maintain full backward compatibility -- agents without AGENTS.md behave identically to today
- Zero changes to schemas, controllers, routes, workers, or schedulers

## User Stories

### US-001: Add `extract_agents_md()` Helper Method
**Description:** As a developer, I need a static helper method on `LLMService` that safely extracts AGENTS.md content from a files dict, handling all possible content formats from the frontend and backend.

**Acceptance Criteria:**
- [ ] Add `@staticmethod extract_agents_md(files: dict | None) -> str | None` to `LLMService` in `backend/src/services/llm.py`
- [ ] Returns `None` when `files` is `None` or empty
- [ ] Returns `None` when `"AGENTS.md"` key is not present (exact match)
- [ ] Handles `str` values: strips and returns content
- [ ] Handles `dict` values with `"content"` key where content is `str`: strips and returns
- [ ] Handles `dict` values with `"content"` key where content is `list[str]`: joins with newlines, strips, returns (frontend `FileData` format)
- [ ] Handles `list` values: joins with newlines, strips, returns
- [ ] Returns `None` for empty or whitespace-only content after extraction
- [ ] Typecheck passes

### US-002: Inject AGENTS.md in Agent Mode
**Description:** As a user who has created an assistant with an AGENTS.md file, I want the agent to automatically use that file's content as its instructions so that I can configure agent behavior through a markdown file.

**Acceptance Criteria:**
- [ ] In `LLMService.assistant()`, after assistant is loaded and before `default_system_prompt()` is called, check `assistant.files` for AGENTS.md
- [ ] If AGENTS.md content is found, set `assistant.system_prompt = None` and `assistant.instructions = agents_md_content`
- [ ] Log info message with content length when AGENTS.md is injected
- [ ] Log warning when AGENTS.md overrides an existing `instructions` field on the assistant
- [ ] `default_system_prompt()` returns `DEFAULT_SYSTEM_PROMPT` when `system_prompt` is `None` (existing behavior, no change needed)
- [ ] `to_llm_request()` carries both `system_prompt=DEFAULT_SYSTEM_PROMPT` and `instructions=<AGENTS.md content>` to `construct_agent()`
- [ ] Final prompt composition: `DEFAULT_SYSTEM_PROMPT + "---" + "INSTRUCTIONS:\n{AGENTS.md content}" + "---" + metadata`
- [ ] Agents without AGENTS.md in their files behave identically to current behavior
- [ ] Typecheck passes
- [ ] Files modified: `backend/src/services/llm.py` only

### US-003: Inject AGENTS.md in Non-Agent (Thread) Mode
**Description:** As a user sending files alongside my messages without using an assistant, I want the system to check for AGENTS.md in my thread-level files and use it as instructions.

**Acceptance Criteria:**
- [ ] In `LLMService.assistant()`, in the non-agent branch (no `assistant_id`), check `params.input.files` for AGENTS.md before `default_system_prompt()` is called
- [ ] If AGENTS.md content is found, set `params.instructions = agents_md_content`
- [ ] Log info message with content length when AGENTS.md is injected in thread mode
- [ ] No mutual exclusion validator on `LLMRequest` -- both `system_prompt` and `instructions` coexist
- [ ] Requests without AGENTS.md in their files behave identically to current behavior
- [ ] Typecheck passes
- [ ] Files modified: `backend/src/services/llm.py` only

### US-004: Unit Tests for `extract_agents_md()`
**Description:** As a developer, I need comprehensive unit tests for the extraction helper to ensure correct handling of all content formats and edge cases.

**Acceptance Criteria:**
- [ ] Create `backend/tests/unit/services/test_llm_service.py`
- [ ] Test: `None` files dict returns `None`
- [ ] Test: Empty files dict returns `None`
- [ ] Test: Files dict without `"AGENTS.md"` key returns `None`
- [ ] Test: AGENTS.md as plain string returns stripped content
- [ ] Test: AGENTS.md as dict with `"content"` as string returns stripped content
- [ ] Test: AGENTS.md as dict with `"content"` as list of strings returns joined content
- [ ] Test: AGENTS.md as dict with `"content"` as `None` returns `None`
- [ ] Test: AGENTS.md as list of strings returns joined content
- [ ] Test: AGENTS.md with empty string value returns `None`
- [ ] Test: AGENTS.md with whitespace-only value returns `None`
- [ ] All tests pass
- [ ] Typecheck passes

### US-005: Integration Tests for AGENTS.md Injection in `assistant()`
**Description:** As a developer, I need async integration tests verifying that `LLMService.assistant()` correctly injects AGENTS.md content in both agent and non-agent modes.

**Acceptance Criteria:**
- [ ] Add tests to `backend/tests/unit/services/test_llm_service.py`
- [ ] Test: Agent with AGENTS.md in `assistant.files` -- returned `LLMRequest.instructions` contains AGENTS.md content
- [ ] Test: Agent without AGENTS.md -- returned `LLMRequest` uses original `instructions`/`system_prompt`
- [ ] Test: Agent with AGENTS.md AND existing `instructions` -- AGENTS.md wins, warning is logged
- [ ] Test: Non-agent mode with AGENTS.md in `params.input.files` -- `params.instructions` is set
- [ ] Test: Non-agent mode without AGENTS.md -- `params.instructions` unchanged
- [ ] Mock `AssistantService.get()` to return controlled `Assistant` objects
- [ ] Use `pytest` with `@pytest.mark.asyncio`
- [ ] All tests pass
- [ ] Typecheck passes

## Functional Requirements

- FR-1: The system must check `assistant.files` for `"AGENTS.md"` when an assistant is loaded
- FR-2: The system must check `params.input.files` for `"AGENTS.md"` when no assistant is loaded
- FR-3: AGENTS.md content takes precedence over existing `instructions` field when present
- FR-4: When AGENTS.md is found in agent mode, `system_prompt` must be set to `None` so that `default_system_prompt()` returns `DEFAULT_SYSTEM_PROMPT`
- FR-5: The `extract_agents_md()` helper must handle: plain strings, dicts with `content` key (str or list), and lists
- FR-6: Empty or whitespace-only AGENTS.md content must be treated as absent (no injection)
- FR-7: All four production code paths (invoke, stream, distributed worker, scheduled) must be covered by the single injection point
- FR-8: No schema changes to `Assistant`, `LLMRequest`, `LLMInput`, or any other Pydantic model
- FR-9: Direct attribute assignment on `Assistant` must bypass the `validate_system_prompt_or_instructions` model validator
- FR-10: No double injection -- `instructions` must flow from `LLMService.assistant()` to `construct_agent()` exactly once
- FR-11: Info-level log when AGENTS.md injection occurs, warning-level log when overriding existing instructions

## Non-Goals

- No case-insensitive or path-normalized key lookup (exact `"AGENTS.md"` match for v1)
- No AGENTS.md validation, linting, or size limits
- No changes to the `Assistant` Pydantic model schema
- No removal of `system_prompt`/`instructions` fields from the backend model
- No frontend changes (AGENTS.md is already createable via the file panel)
- No AGENTS.md content caching or memoization
- No priority merging between agent-level and thread-level AGENTS.md (agent-level wins when assistant is loaded)

## Technical Considerations

- **Single injection point:** `LLMService.assistant()` at `backend/src/services/llm.py` line 124 is the sole code change location. All four production paths (invoke, stream, distributed worker, scheduled) call this method before `construct_agent()`.
- **Pydantic validator safety:** The `Assistant.validate_system_prompt_or_instructions` model validator (`mode="after"`) only fires during model construction. Direct attribute assignment on an already-constructed `Assistant` instance does not re-trigger the validator.
- **`LLMRequest` has no mutual exclusion validator:** Both `system_prompt` and `instructions` can coexist on `LLMRequest`, allowing AGENTS.md content to flow alongside the default system prompt.
- **Distributed worker serialization:** `LLMRequest.instructions` has `exclude=True`, so it's dropped during `model_dump()`. This is safe because the worker calls `LLMService.assistant()` after deserialization, re-extracting AGENTS.md content inside the worker process.
- **Frontend `FileData` format:** Thread-level files from the frontend arrive as `{"content": ["line1", "line2"], "created_at": "..."}`. The extraction helper must explicitly handle `content` as `list[str]` by joining with newlines.
- **Prompt composition:** The existing `init_system_prompt()` in `backend/src/utils/format.py` already composes `system_prompt + instructions + metadata`. No changes needed.
- **`to_llm_request()` does not forward files:** `Assistant.to_llm_request()` does not include `assistant.files` in the resulting `LLMRequest`. AGENTS.md extraction must happen before this conversion.

## Success Metrics

- Agents with AGENTS.md in their files receive the file content as instructions in their system prompt
- Thread-level AGENTS.md files are injected as instructions for non-agent conversations
- Agents without AGENTS.md behave identically to current behavior (zero regressions)
- All existing tests pass with no modifications
- All new tests pass
- Type checker passes on all modified files

## Open Questions

- Should a warning be logged for very large AGENTS.md content (e.g., >10,000 characters)? (Deferred to follow-up)
- Should case-insensitive key lookup be supported in future iterations? (Deferred to follow-up)
