# PRD: Native DeepAgents Memory for Streaming API

## Introduction

Standardize how user memories are injected into agent context by adopting the DeepAgents `MemoryMiddleware` pattern. Currently, `add_memories_to_system()` manually concatenates memory text into the system prompt string. This approach is fragile, non-standard, and bypasses the middleware pipeline that DeepAgents provides.

This feature wires the existing `memory` parameter on `create_deep_agent()` so that user memories are loaded as files via the `StateBackend` and injected by `MemoryMiddleware` at agent startup. This aligns Orchestra with DeepAgents best practices for injectable context, making memory handling consistent, testable, and maintainable.

**4 files modified, 0 files created.**

## Goals

- Adopt the DeepAgents `MemoryMiddleware` as the standard mechanism for injecting user memories into agent context
- Eliminate the ad-hoc `add_memories_to_system()` string concatenation approach
- Wire memory injection consistently across all three agent entry points: streaming (`stream.py`), worker (`tasks.py`), and direct invoke (`llm.py`)
- Maintain backward compatibility — agents without a `user_id` or without stored memories work identically to today
- Gracefully handle memory fetch failures without breaking agent execution

## User Stories

### US-001: Add `prepare_memory_files()` helper to agents module
**Description:** As a developer, I need a reusable async helper that fetches user memories and formats them as a file for the `StateBackend`, so all entry points can share the same memory loading logic.

**Acceptance Criteria:**
- [ ] New `prepare_memory_files(user_id, memory_svc)` function in `backend/src/agents/__init__.py`
- [ ] Imports `create_file_data` from `deepagents.backends.utils`
- [ ] Returns `tuple[dict, list[str] | None]` — a `files_map` entry and a memory sources list (or empty dict / `None`)
- [ ] Returns `({}, None)` when `user_id` is falsy
- [ ] Returns `({}, None)` when `MemoryService.search()` returns empty
- [ ] Catches exceptions from `MemoryService.search()`, logs a warning, and returns `({}, None)`
- [ ] Formats memories as markdown bullet list under path `/memories.md`
- [ ] Typecheck/lint passes (`make format`)

### US-002: Thread `memory` parameter through `init_graph`, `Orchestra`, and `construct_agent`
**Description:** As a developer, I need the `memory` parameter plumbed through the agent construction chain so that `create_deep_agent()` receives it and activates `MemoryMiddleware`.

**Acceptance Criteria:**
- [ ] `init_graph()` accepts `memory: list[str] | None = None` and passes it to `create_deep_agent()`
- [ ] `Orchestra.__init__()` accepts `memory: list[str] | None = None` and passes it to `init_graph()`
- [ ] `construct_agent()` accepts `memory: list[str] | None = None` and passes it to `Orchestra()`
- [ ] When `memory=None`, `create_deep_agent()` does not add `MemoryMiddleware` (existing behavior preserved)
- [ ] When `memory=["/memories.md"]`, `MemoryMiddleware` is added to the middleware stack
- [ ] Typecheck/lint passes (`make format`)

### US-003: Wire memory into streaming entry point (`stream.py`)
**Description:** As an end user chatting via the streaming API, I want the agent to automatically recall my stored memories so responses are personalized without me needing to repeat context.

**Acceptance Criteria:**
- [ ] `stream_generator()` in `backend/src/utils/stream.py` calls `prepare_memory_files()` before creating `ToolRuntime`
- [ ] Memory files are merged into `files_map` with user-provided files taking precedence (`{**memory_files, **files_map}`)
- [ ] `memory_sources` is passed to `construct_agent()` via the `memory` kwarg
- [ ] Agent responds with knowledge of stored memories when queried
- [ ] Agent works normally when no memories exist
- [ ] Typecheck/lint passes (`make format`)

### US-004: Wire memory into worker entry point (`tasks.py`)
**Description:** As an end user with scheduled or distributed agent tasks, I want those background agents to also have access to my memories for consistent personalized behavior.

**Acceptance Criteria:**
- [ ] `_execute_agent_stream()` in `backend/src/workers/tasks.py` calls `prepare_memory_files()` before creating `ToolRuntime`
- [ ] Memory files are merged into `files_map` with user-provided files taking precedence
- [ ] `memory_sources` is passed to `construct_agent()` via the `memory` kwarg
- [ ] Typecheck/lint passes (`make format`)

### US-005: Wire memory into direct invoke entry point (`llm.py`)
**Description:** As an API consumer using the direct invoke endpoint, I want the agent to have access to my memories for personalized responses.

**Acceptance Criteria:**
- [ ] `llm_invoke()` in `backend/src/controllers/llm.py` calls `prepare_memory_files()` before `init_backend()`
- [ ] Memory files are merged into `params.input.files` with existing files taking precedence
- [ ] `memory_sources` is passed to `construct_agent()` via the `memory` kwarg
- [ ] Typecheck/lint passes (`make format`)

### US-006: Add unit tests for `prepare_memory_files()`
**Description:** As a developer, I need tests covering the new helper function to ensure correctness and prevent regressions.

**Acceptance Criteria:**
- [ ] Test file at `backend/tests/unit/agents/test_prepare_memory_files.py`
- [ ] Test: returns `({}, None)` when `user_id` is `None`
- [ ] Test: returns `({}, None)` when `user_id` is empty string
- [ ] Test: returns `({}, None)` when `MemoryService.search()` returns empty list
- [ ] Test: returns `({}, None)` and logs warning when `MemoryService.search()` raises exception
- [ ] Test: returns correctly formatted `files_map` and `["/memories.md"]` when memories exist
- [ ] Test: verifies markdown bullet format of memory content
- [ ] All tests pass (`make test`)

### US-007: Update API documentation with memory behavior
**Description:** As an API consumer, I want the documentation to describe that agents now automatically load user memories, so I understand the personalization behavior.

**Acceptance Criteria:**
- [ ] Update relevant docstrings in `stream_generator()`, `_execute_agent_stream()`, and `llm_invoke()` to mention memory loading
- [ ] Add a note to the `construct_agent()` docstring about the `memory` parameter
- [ ] Typecheck/lint passes (`make format`)

## Functional Requirements

- FR-1: The system must fetch user memories via `MemoryService.search()` when a `user_id` is present
- FR-2: The system must format fetched memories as a markdown bullet list and wrap with `create_file_data()` from `deepagents.backends.utils`
- FR-3: The system must store memory content in `files_map` under the key `/memories.md`, served by the default `StateBackend`
- FR-4: The system must pass `memory=["/memories.md"]` to `create_deep_agent()` which adds `MemoryMiddleware` to the middleware stack
- FR-5: `MemoryMiddleware.abefore_agent()` must download `/memories.md` from `StateBackend` and inject its content into the system prompt via `modify_request()`
- FR-6: When merging memory files into `files_map`, user-provided files must take precedence over memory files
- FR-7: When `user_id` is absent, empty, or memory fetch fails, the system must proceed without `MemoryMiddleware` (no error, no degraded behavior)
- FR-8: The `MemoryService.search()` default limit of 20 memories must be respected; `SummarizationMiddleware` handles context window limits downstream
- FR-9: All three entry points (stream, worker, invoke) must behave identically with respect to memory loading

## Non-Goals

- No changes to the `CompositeBackend` routing or `StoreBackend` configuration
- No changes to runtime memory tools (`upsert_memory`, `search_memory`, etc.)
- No changes to SSE events, Redis streaming, or abort handling
- No custom token/character limits on memory content (deferred to `SummarizationMiddleware`)
- No memory sharing across users or team-level memories
- No changes to how `MemoryMiddleware` itself works internally
- No removal of legacy `add_memories_to_system()` in this PR (can be deprecated separately)

## Technical Considerations

- **Existing `add_memories_to_system()`**: The current function at `backend/src/agents/__init__.py:36` manually concatenates memory XML into the system prompt. The new approach replaces this with the file-based `MemoryMiddleware` pattern. The old function is NOT removed in this PR to avoid breaking anything that may still reference it — deprecation is a follow-up.
- **`create_file_data()` utility**: Imported from `deepagents.backends.utils` — wraps content into the format expected by `StateBackend`
- **`MemoryMiddleware` lifecycle**: At agent startup, `abefore_agent()` downloads the file from backend and calls `modify_request()` to inject content into the system prompt
- **`SummarizationMiddleware`**: Already in the middleware stack via `init_default_middleware()` — handles cases where injected memory content makes the context too large
- **Import location**: `prepare_memory_files` is imported locally in `stream.py`, `tasks.py`, and `llm.py` to avoid circular imports

## Success Metrics

- All existing tests pass (`make test`) with no regressions
- New unit tests for `prepare_memory_files()` pass with full coverage of edge cases
- Agent responds with knowledge of stored memories when queried via streaming, worker, and invoke entry points
- Agent functions normally when no memories exist or memory fetch fails
- No measurable latency increase beyond the memory fetch call itself

## Open Questions

- Should `add_memories_to_system()` be formally deprecated with a warning log in this PR, or handled in a follow-up?
- Should the memory file path (`/memories.md`) be configurable or is a constant sufficient?
- Should there be an upper bound on memory count beyond the default `limit=20` from `MemoryService.search()`?
