# PRD: Native DeepAgents Skills Support

## Introduction

Enable progressive skill loading for Orchestra agents by wiring the `skills` parameter through the agent construction chain to `create_deep_agent()`. Skills are SKILL.md files stored in the agent's virtual filesystem that are loaded on-demand when the agent determines they're relevant to the current prompt. The `deepagents==0.3.8` library already supports `skills: list[str] | None` on `create_deep_agent()`, but Orchestra does not currently pass this parameter. Additionally, `Assistant.files` (which contain skill content) are not merged into the `ToolRuntime` state, so even if skills were enabled, the `StateBackend` couldn't serve them.

This feature threads `skills` through the full agent construction chain and ensures `Assistant.files` are merged into the runtime `files_map` so the `StateBackend` can serve skill content on demand.

**5 files modified, 0 files created.**

## Goals

- Pass the `skills` parameter from `Assistant` through to `create_deep_agent()` so progressive skill loading is activated
- Add `skills` field to `Assistant` and `LLMRequest` schemas so skills can be configured per-assistant and per-request
- Merge `Assistant.files` into `ToolRuntime` state so skill content stored in assistant files is available to the `StateBackend`
- Thread `skills` consistently across all three agent entry points: streaming (`stream.py`), worker (`tasks.py`), and direct invoke (`llm.py`)
- Maintain backward compatibility — agents without `skills` configured work identically to today

## User Stories

### US-001: Add `skills` field to `Assistant` schema
**Description:** As a developer, I need the `Assistant` model to accept a `skills` field so users can configure skill directory paths when creating or updating an assistant.

**Acceptance Criteria:**
- [ ] `Assistant` model in `backend/src/schemas/entities/llm.py` has a new `skills: Optional[List[str]]` field with `default_factory=list`
- [ ] Field description reads: "Skill directory paths for progressive loading (e.g., ['./skills/'])"
- [ ] `to_llm_request()` passes `self.skills` to `LLMRequest`
- [ ] Existing assistants without `skills` default to empty list (no behavior change)
- [ ] Typecheck/lint passes (`make format`)

### US-002: Add `skills` field to `LLMRequest` schema
**Description:** As a developer, I need the `LLMRequest` model to carry the `skills` field so it can be forwarded through the agent construction chain.

**Acceptance Criteria:**
- [ ] `LLMRequest` model in `backend/src/schemas/entities/llm.py` has a new `skills: Optional[List[str]]` field with `default_factory=list`
- [ ] Field is placed after the `subagents` field
- [ ] Typecheck/lint passes (`make format`)

### US-003: Thread `skills` through `init_graph()` to `create_deep_agent()`
**Description:** As a developer, I need `init_graph()` to accept and forward a `skills` parameter so that `create_deep_agent()` receives it and activates progressive skill loading.

**Acceptance Criteria:**
- [ ] `init_graph()` in `backend/src/agents/__init__.py` accepts `skills: list[str] | None = None`
- [ ] `skills` is passed to `create_deep_agent(skills=skills)`
- [ ] When `skills=None`, `create_deep_agent()` does not activate skill loading (existing behavior preserved)
- [ ] When `skills=["./skills/"]`, the agent is configured to look for skills in that directory
- [ ] Typecheck/lint passes (`make format`)

### US-004: Thread `skills` through `Orchestra.__init__()`
**Description:** As a developer, I need the `Orchestra` class to accept and forward a `skills` parameter to `init_graph()`.

**Acceptance Criteria:**
- [ ] `Orchestra.__init__()` in `backend/src/agents/__init__.py` accepts `skills: list[str] | None = None`
- [ ] `skills` is passed to `init_graph(skills=skills)`
- [ ] Typecheck/lint passes (`make format`)

### US-005: Thread `skills` through `construct_agent()`
**Description:** As a developer, I need `construct_agent()` to accept and forward a `skills` parameter to `Orchestra()`.

**Acceptance Criteria:**
- [ ] `construct_agent()` in `backend/src/agents/__init__.py` accepts `skills: list[str] | None = None`
- [ ] `skills` is passed to `Orchestra(skills=skills)`
- [ ] Typecheck/lint passes (`make format`)

### US-006: Merge `Assistant.files` into runtime state and pass `skills` in streaming entry point
**Description:** As an end user chatting via the streaming API, I want the agent to have access to skill files stored in my assistant configuration so it can progressively load relevant skills during conversation.

**Acceptance Criteria:**
- [ ] `stream_generator()` in `backend/src/utils/stream.py` accepts `files: dict | None = None` and `skills: list[str] | None = None` parameters
- [ ] Assistant-level files are merged into `files_map`: `files_map = {**(files or {}), **(config["metadata"].get("files", {}) or input.files or {})}`
- [ ] `skills` is passed to `construct_agent()` via the `skills` kwarg
- [ ] `llm_stream()` in `backend/src/controllers/llm.py` passes `assistant.skills` and `assistant.files` to `stream_generator()`
- [ ] Agent can discover and load SKILL.md files from the virtual filesystem
- [ ] Agent works normally when no skills are configured
- [ ] Typecheck/lint passes (`make format`)

### US-007: Pass `skills` and merge `Assistant.files` in direct invoke entry point
**Description:** As an API consumer using the direct invoke endpoint, I want the agent to have access to skills for consistent behavior across invoke and stream paths.

**Acceptance Criteria:**
- [ ] `llm_invoke()` in `backend/src/controllers/llm.py` merges assistant files into `params.input.files` before `init_backend()`
- [ ] `skills` is passed to `construct_agent()` via the `skills` kwarg
- [ ] Typecheck/lint passes (`make format`)

### US-008: Thread `skills` and merge files in worker entry point
**Description:** As an end user with distributed agent tasks, I want those background agents to also have access to skills for consistent behavior.

**Acceptance Criteria:**
- [ ] `_execute_agent_stream()` in `backend/src/workers/tasks.py` passes `skills` to `construct_agent()`
- [ ] Assistant files are merged into `files_map` in the worker path
- [ ] Typecheck/lint passes (`make format`)

## Functional Requirements

- FR-1: Add `skills: Optional[List[str]]` field to `Assistant` model with `default_factory=list`
- FR-2: Add `skills: Optional[List[str]]` field to `LLMRequest` model with `default_factory=list`
- FR-3: `Assistant.to_llm_request()` must include `skills=self.skills` in the returned `LLMRequest`
- FR-4: `init_graph()` must accept `skills: list[str] | None = None` and pass it to `create_deep_agent()`
- FR-5: `Orchestra.__init__()` must accept `skills: list[str] | None = None` and pass it to `init_graph()`
- FR-6: `construct_agent()` must accept `skills: list[str] | None = None` and pass it to `Orchestra()`
- FR-7: `stream_generator()` must accept `files: dict | None = None` and `skills: list[str] | None = None`, merging assistant files into `files_map` with request files taking precedence
- FR-8: `llm_stream()` must pass `assistant.skills` and `assistant.files` to `stream_generator()`
- FR-9: `llm_invoke()` must merge assistant files into request files and pass `skills` to `construct_agent()`
- FR-10: `_execute_agent_stream()` must pass `skills` to `construct_agent()`
- FR-11: When `skills` is `None` or empty, `create_deep_agent()` must not activate skill loading (backward compatible)

## Non-Goals

- No changes to how skills are authored or their YAML frontmatter format
- No UI for managing skills (API-only for now)
- No automatic skill discovery from external sources
- No changes to `CompositeBackend` routing or `StoreBackend` internals
- No changes to SSE events, Redis streaming, or abort handling
- No skill sharing across assistants or users
- No validation of SKILL.md content format at the API layer

## Technical Considerations

- **`create_deep_agent()` signature**: Confirmed `skills: list[str] | None = None` is an accepted keyword-only parameter in `deepagents==0.3.8`
- **`StateBackend` serves files**: When `files_map` contains entries like `/skills/my-skill/SKILL.md`, the `StateBackend` serves them as virtual files. The agent's skill loading mechanism reads from these paths.
- **File merge order**: Assistant-level files are the base, request-level files override. This means: `{**assistant.files, **request.files}`. This allows per-request file overrides while skill content persists from the assistant config.
- **Similar pattern to memory**: This follows the same pattern established in `prd-native-deepagents-memory.md` — threading a parameter through `init_graph` -> `Orchestra` -> `construct_agent` -> `create_deep_agent()`.
- **Worker tasks**: The worker path (`tasks.py`) reconstructs `LLMRequest` from a dict, so `skills` must serialize/deserialize correctly via Pydantic (it does, since `List[str]` is natively JSON-serializable).

## Success Metrics

- All existing tests pass (`make test`) with no regressions
- `create_deep_agent()` receives `skills` parameter when an assistant has skills configured
- Agent can access SKILL.md files stored in `Assistant.files` via the `StateBackend`
- No behavior change for existing assistants without skills configured
- Skills work consistently across streaming, invoke, and worker entry points

## Open Questions

- Should there be an API endpoint to manage skills independently from `Assistant.files`, or is the current approach of embedding skill content in `files` sufficient?
- Should skill directory paths be validated at the schema level (e.g., must start with `./` or `/`)?
- Should `PublicAssistant` expose the `skills` field for public agents, or keep it owner-only like `files`?
