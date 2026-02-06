# PRD: Native DeepAgents Memory for Streaming API

## Introduction

Standardize how user memories are injected into agent context by adopting the DeepAgents `MemoryMiddleware` pattern. Currently, `add_memories_to_system()` manually concatenates memory text into the system prompt string. This approach is fragile, non-standard, and bypasses the middleware pipeline that DeepAgents provides.

This feature wires the existing `memory` parameter on `create_deep_agent()` so that user memories are loaded as files via the `StateBackend` and injected by `MemoryMiddleware` at agent startup. This aligns Orchestra with DeepAgents best practices for injectable context, making memory handling consistent, testable, and maintainable.

**4 files modified, 0 files created.** *(Initial implementation — US-001 through US-007 are complete.)*

**Bug fix iteration (US-008, US-009):** Testing revealed that `prepare_memory_files()` returns no results because the module-level `memory_service` singleton uses an `InMemoryStore` while the UI persists memories to `AsyncPostgresStore` (PostgreSQL). Additionally, the value parsing reads `value["memory"]` but `MemoryRepo` stores data under `value["content"]`.

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

---

## Bug Fix Iteration

The following stories address bugs discovered during end-to-end testing of US-001 through US-007. Memories created through the Settings UI were not visible to `prepare_memory_files()` due to two root causes.

### US-008: Use `service_context.memory_service` instead of singleton `memory_service`
**Description:** As a developer, I need all three entry points to use the `MemoryService` instance from `ServiceContext` (which is backed by `AsyncPostgresStore`) instead of the module-level singleton (which uses `InMemoryStore`), so that memories persisted through the UI are actually found at agent runtime.

**Acceptance Criteria:**
- [ ] In `stream_generator()` (`backend/src/utils/stream.py`): replace `memory_service` singleton with `service_context.memory_service` when calling `prepare_memory_files()`
- [ ] In `_execute_agent_stream()` (`backend/src/workers/tasks.py`): replace `memory_service` singleton with `service_context.memory_service` when calling `prepare_memory_files()`
- [ ] In `llm_invoke()` (`backend/src/controllers/llm.py`): replace `memory_service` singleton with `self.service_context.memory_service` when calling `prepare_memory_files()`
- [ ] Remove the now-unnecessary `from src.services.memory import memory_service` import from `stream.py`, `tasks.py` (inside `_execute_agent_stream`), and `llm.py`
- [ ] Remove the `memory_svc.user_id = user_id` mutation in `prepare_memory_files()` — `ServiceContext` already initialises `MemoryService` with the correct `user_id`
- [ ] Agent correctly retrieves memories that were created through the Settings UI
- [ ] Typecheck/lint passes (`make format`)

**Notes:**
- `ServiceContext` already creates `self.memory_service = MemoryService(user_id=self.user_id, store=store)` at `backend/src/contexts/service.py:35` with the correct `AsyncPostgresStore`
- The module-level singleton at `backend/src/services/memory.py:31` (`memory_service = MemoryService()`) defaults to `get_store_in_memory()` which returns an `InMemoryStore` — this is why searches return empty
- In `stream.py`, `service_context` is already a function parameter. In `tasks.py`, `service_context` is already a parameter. In `llm.py`, use `self.service_context`
- The `add_memories_to_system()` function still uses the singleton — that function is legacy and not part of this fix

### US-009: Fix memory value parsing to use `content` key from `MemoryRepo`
**Description:** As a developer, I need `prepare_memory_files()` to correctly extract memory text from the data structure used by `MemoryRepo`, so that memory content is properly formatted in the markdown file.

**Acceptance Criteria:**
- [ ] In `prepare_memory_files()` (`backend/src/agents/__init__.py`): change `value.get("memory", str(value))` to `value.get("content", str(value))` to match `MemoryRepo`'s storage format
- [ ] Update existing unit tests in `backend/tests/unit/agents/test_prepare_memory_files.py` to use `{"content": "text"}` instead of `{"memory": "text"}` in mock `SearchItem` values
- [ ] Add a test case that uses the full `MemoryRepo` value structure: `{"id": "memory_xxx", "content": "...", "metadata": {}, "created_at": "...", "updated_at": "..."}`
- [ ] Verify that bullet lines correctly extract the `content` field value
- [ ] All tests pass (`make test`)
- [ ] Typecheck/lint passes (`make format`)

**Notes:**
- `MemoryRepo.create()` stores `Memory(id=..., content=..., metadata=..., created_at=..., updated_at=...)` via `BaseRepo._set()` which calls `value.model_dump(exclude_none=True, mode="json")` — the resulting dict has a `content` key, NOT a `memory` key
- The `SearchItem.dict()` returns `{"key": "...", "value": {"id": "...", "content": "...", ...}}` — the `value` sub-dict uses `content`
- The fallback `str(value)` for non-dict values should remain for safety
- Existing tests mock `SearchItem` with `MagicMock()` whose `.dict()` returns `{"key": "...", "value": {"memory": "text"}}` — these need updating to `{"key": "...", "value": {"content": "text"}}`

---

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
- FR-10: All entry points must use the `MemoryService` instance from `ServiceContext` (backed by `AsyncPostgresStore`) — never the module-level singleton (backed by `InMemoryStore`)
- FR-11: `prepare_memory_files()` must parse memory values using the `content` key (matching `MemoryRepo` storage format), not the `memory` key

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
- **Store mismatch (Bug)**: The module-level `memory_service` singleton in `backend/src/services/memory.py:31` uses `get_store_in_memory()` (`InMemoryStore`), while the UI persists via `AsyncPostgresStore`. `ServiceContext` already creates a correctly-backed `MemoryService` at `backend/src/contexts/service.py:35` — entry points should use `service_context.memory_service`
- **Value structure mismatch (Bug)**: `MemoryRepo` stores `Memory` model instances via `model_dump()`, producing `{"id": ..., "content": ..., "metadata": ..., "created_at": ..., "updated_at": ...}`. The `content` key holds the memory text, not `memory`

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
- ~~Why does `prepare_memory_files()` return empty results?~~ **Resolved:** Store instance mismatch (US-008) and value key mismatch (US-009)
