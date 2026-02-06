# PRD: AGENTS.md Feature Implementation & Documentation

## Introduction

Implement the AGENTS.md system prompt injection feature and document it in the wiki. AGENTS.md is a convention (similar to Claude Code's `CLAUDE.md` or OpenAI Codex's `AGENTS.md`) that lets users configure agent behavior by uploading a markdown file to an assistant. When present, the file's content is automatically extracted and injected as `instructions` in the agent's system prompt. This PRD covers: backend implementation of the injection logic, unit/integration tests, wiki reference documentation, a step-by-step tutorial with browser screenshots, and llm.txt updates.

**Reference:** [DeepAgents Customization — Memory](https://docs.langchain.com/oss/python/deepagents/customization#memory)

## Goals

- Implement `extract_agents_md()` helper and injection logic in `LLMService.assistant()` (single-file backend change)
- Support both agent mode (assistant files) and thread mode (per-request files)
- Handle all content formats: plain string, dict with `content` key (str or list), and list
- Maintain full backward compatibility — agents without AGENTS.md behave identically
- Create wiki reference page documenting AGENTS.md API behavior
- Create wiki tutorial page with agent-browser screenshots showing end-to-end workflow
- Update `website/public/llm.txt` with AGENTS.md documentation
- Link to DeepAgents customization docs as upstream reference

## User Stories

### US-001: Add `extract_agents_md()` Helper Method to LLMService
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
- [ ] Typecheck passes (`make format`)

### US-002: Inject AGENTS.md in Agent Mode (Assistant with Files)
**Description:** As a user who has created an assistant with an AGENTS.md file, I want the agent to automatically use that file's content as its instructions so that I can configure agent behavior through a familiar markdown convention.

**Acceptance Criteria:**
- [ ] In `LLMService.assistant()`, after assistant is loaded and before `default_system_prompt()` is called, check `assistant.files` for AGENTS.md using `extract_agents_md()`
- [ ] If AGENTS.md content is found, set `assistant.system_prompt = None` and `assistant.instructions = agents_md_content`
- [ ] Log info message with content length when AGENTS.md is injected
- [ ] Log warning when AGENTS.md overrides an existing `instructions` field on the assistant
- [ ] Agents without AGENTS.md in their files behave identically to current behavior
- [ ] Typecheck passes (`make format`)
- [ ] Files modified: `backend/src/services/llm.py` only

### US-003: Inject AGENTS.md in Non-Agent (Thread) Mode
**Description:** As a user sending files alongside my messages without using an assistant, I want the system to check for AGENTS.md in my thread-level files and use it as instructions.

**Acceptance Criteria:**
- [ ] In `LLMService.assistant()`, in the non-agent branch (no `assistant_id`), check `params.input.files` for AGENTS.md before `default_system_prompt()` is called
- [ ] If AGENTS.md content is found, set `params.instructions = agents_md_content`
- [ ] Log info message with content length when AGENTS.md is injected in thread mode
- [ ] Requests without AGENTS.md in their files behave identically to current behavior
- [ ] Typecheck passes (`make format`)
- [ ] Files modified: `backend/src/services/llm.py` only

### US-004: Unit Tests for `extract_agents_md()`
**Description:** As a developer, I need comprehensive unit tests for the extraction helper to ensure correct handling of all content formats and edge cases.

**Acceptance Criteria:**
- [ ] Create `backend/tests/unit/services/test_extract_agents_md.py`
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
- [ ] All tests pass (`make test`)
- [ ] Typecheck passes (`make format`)

### US-005: Integration Tests for AGENTS.md Injection in `assistant()`
**Description:** As a developer, I need async integration tests verifying that `LLMService.assistant()` correctly injects AGENTS.md content in both agent and non-agent modes.

**Acceptance Criteria:**
- [ ] Add tests to `backend/tests/unit/services/test_extract_agents_md.py`
- [ ] Test: Agent with AGENTS.md in `assistant.files` — returned `LLMRequest.instructions` contains AGENTS.md content
- [ ] Test: Agent without AGENTS.md — returned `LLMRequest` uses original `instructions`/`system_prompt`
- [ ] Test: Agent with AGENTS.md AND existing `instructions` — AGENTS.md wins, warning is logged
- [ ] Test: Non-agent mode with AGENTS.md in `params.input.files` — `params.instructions` is set
- [ ] Test: Non-agent mode without AGENTS.md — `params.instructions` unchanged
- [ ] Mock `AssistantService.get()` to return controlled `Assistant` objects
- [ ] Use `pytest` with `@pytest.mark.asyncio`
- [ ] All tests pass (`make test`)
- [ ] Typecheck passes (`make format`)

### US-006: Initialize Wiki Submodule and Add AGENTS.md Sidebar Entries
**Description:** As a documentation reader, I want AGENTS.md to appear in the wiki sidebar under "Core Features" so I can find it easily.

**Acceptance Criteria:**
- [ ] Add `"agents-md/index"` to the `Core Features` category items in `wiki/sidebars.ts`
- [ ] Add `"agents-md/tutorial"` to the `Tutorials` category items in `wiki/sidebars.ts`
- [ ] Create directory `wiki/docs/agents-md/`
- [ ] Typecheck passes (wiki builds without errors)

### US-007: Write AGENTS.md Reference Documentation Page
**Description:** As a developer or API consumer, I want a reference page explaining what AGENTS.md is, how it works, supported formats, and the API behavior so I can use it programmatically.

**Acceptance Criteria:**
- [ ] Create `wiki/docs/agents-md/index.md`
- [ ] Include sections: Overview, How It Works, Supported Formats, API Usage (curl examples), Precedence Rules, Connection to DeepAgents Memory
- [ ] Reference the DeepAgents customization docs: `https://docs.langchain.com/oss/python/deepagents/customization#memory`
- [ ] Explain that AGENTS.md follows the same convention as Claude Code's CLAUDE.md and OpenAI Codex's AGENTS.md
- [ ] Include example AGENTS.md content showing how to define agent persona, rules, and behavior
- [ ] Document both agent mode and thread mode injection
- [ ] Include curl examples showing how to create an assistant with AGENTS.md via API

### US-008: Write AGENTS.md Tutorial Page with Screenshots
**Description:** As a new user, I want a step-by-step tutorial with screenshots showing how to create an assistant with AGENTS.md and see it in action.

**Acceptance Criteria:**
- [ ] Create `wiki/docs/agents-md/tutorial.md`
- [ ] Use `agent-browser` skill to capture screenshots of the workflow in **light mode**
- [ ] Step 1: Navigate to Assistants page, screenshot
- [ ] Step 2: Create new assistant, screenshot
- [ ] Step 3: Upload/create AGENTS.md file in assistant file panel, screenshot
- [ ] Step 4: Open a thread with the assistant and chat, showing behavior reflects AGENTS.md content, screenshot
- [ ] Store screenshots in `wiki/docs/agents-md/img/` directory
- [ ] Include alt text for all images
- [ ] **Verify in browser using agent-browser skill**

### US-009: Update llm.txt with AGENTS.md Documentation
**Description:** As an external AI agent or LLM search engine, I need llm.txt to reflect the AGENTS.md feature so I can accurately inform users about it.

**Acceptance Criteria:**
- [ ] Update `website/public/llm.txt` with AGENTS.md feature description
- [ ] Include: what AGENTS.md is, how to use it, supported formats
- [ ] Follow existing llm.txt style and structure

## Functional Requirements

- FR-1: The system must check `assistant.files` for `"AGENTS.md"` when an assistant is loaded in `LLMService.assistant()`
- FR-2: The system must check `params.input.files` for `"AGENTS.md"` when no assistant is loaded
- FR-3: AGENTS.md content takes precedence over existing `instructions` field when present
- FR-4: When AGENTS.md is found in agent mode, `system_prompt` must be set to `None` so `default_system_prompt()` returns `DEFAULT_SYSTEM_PROMPT`
- FR-5: The `extract_agents_md()` helper must handle: plain strings, dicts with `content` key (str or list), and lists
- FR-6: Empty or whitespace-only AGENTS.md content must be treated as absent (no injection)
- FR-7: All four production code paths (invoke, stream, distributed worker, scheduled) are covered by the single injection point in `LLMService.assistant()`
- FR-8: No schema changes to `Assistant`, `LLMRequest`, `LLMInput`, or any other Pydantic model
- FR-9: Direct attribute assignment on `Assistant` must bypass the `validate_system_prompt_or_instructions` model validator
- FR-10: Info-level log when AGENTS.md injection occurs, warning-level log when overriding existing instructions
- FR-11: Wiki documentation must be created with two pages: reference and tutorial
- FR-12: Tutorial must include browser screenshots captured via agent-browser skill in light mode
- FR-13: `llm.txt` must be updated to reflect the AGENTS.md feature

## Non-Goals

- No case-insensitive or path-normalized key lookup (exact `"AGENTS.md"` match for v1)
- No AGENTS.md validation, linting, or size limits
- No changes to the `Assistant` Pydantic model schema
- No frontend changes (AGENTS.md is already createable via the file panel)
- No AGENTS.md content caching or memoization
- No priority merging between agent-level and thread-level AGENTS.md (agent-level wins)
- No removal of `system_prompt`/`instructions` fields from the backend model

## Technical Considerations

- **Single injection point:** `LLMService.assistant()` at `backend/src/services/llm.py` line 124 is the sole code change location. All four production paths (invoke, stream, distributed worker, scheduled) call this method.
- **Pydantic validator safety:** The `Assistant.validate_system_prompt_or_instructions` validator (mode="after") only fires during model construction. Direct attribute assignment on an already-constructed instance does not re-trigger it.
- **`LLMRequest` has no mutual exclusion validator:** Both `system_prompt` and `instructions` can coexist on `LLMRequest`.
- **Frontend `FileData` format:** Thread-level files from the frontend arrive as `{"content": ["line1", "line2"], "created_at": "..."}`. The extraction helper must handle `content` as `list[str]`.
- **Prompt composition:** The existing `init_system_prompt()` in `backend/src/utils/format.py` already composes `system_prompt + instructions + metadata`. No changes needed there.
- **DeepAgents Memory connection:** AGENTS.md injection uses the same underlying `memory` parameter on `create_deep_agent()` that user memories use. The AGENTS.md content flows through as `instructions` which gets composed into the final system prompt.
- **Existing PRD reference:** `tasks/prd-agents-md-system-prompt-injection.md` contains the original technical plan. Expert analyses in `.claude/plans/plan-agents-md-system-prompt-injection/SYNTHESIS.md` provide detailed implementation guidance.
- **Wiki pattern:** Follow the same documentation structure used for Memories (PR #744) — reference page + tutorial with screenshots.

## Success Metrics

- Agents with AGENTS.md in their files receive the content as instructions in their system prompt
- Thread-level AGENTS.md files are injected as instructions for non-agent conversations
- Agents without AGENTS.md behave identically to current behavior (zero regressions)
- All existing tests pass with no modifications
- All new tests pass
- Wiki documentation is complete with screenshots showing end-to-end workflow
- llm.txt accurately reflects the AGENTS.md feature
- Users can configure agent behavior purely through an AGENTS.md file, similar to Claude Code / Codex conventions

## Open Questions

- Should a warning be logged for very large AGENTS.md content (e.g., >10,000 characters)? (Deferred to follow-up)
- Should case-insensitive key lookup be supported in future iterations? (Deferred to follow-up)
