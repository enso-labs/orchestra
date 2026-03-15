# PRD: User-Configurable `stream_mode` Parameter

## Introduction

Add an optional `stream_mode` parameter to the `/llm/stream` API endpoint, allowing API consumers to control which LangGraph stream modes they receive. Currently, `stream_mode` is hard-coded as `["messages", "values"]` in three backend locations. LangGraph supports 7 modes (`messages`, `values`, `updates`, `tasks`, `debug`, `custom`, `checkpoints`), and individual chunk handlers already exist but are unused. This feature exposes that flexibility to API power users and CLI consumers while preserving the current default behavior for all existing clients.

## Goals

- Accept `stream_mode` as an optional `list[str]` on `LLMRequest`, validated at the API boundary
- Default to `["messages", "values"]` when omitted (identical to current behavior)
- Thread the parameter through both sync (`stream_generator`) and distributed (`run_agent_stream` TaskIQ) pipelines
- Refactor `handle_multi_mode()` to dispatch all LangGraph stream mode chunk types
- Fix existing `handle_updates_mode()` bug (potential `UnboundLocalError`)
- Honor the exact list the user passes — no force-including modes the user didn't request
- Update OpenAPI examples to document the new parameter

## User Stories

### US-001: Add `stream_mode` field to `LLMRequest` schema
**Description:** As an API consumer, I want to pass `stream_mode` as a list of strings in my request body so that I control which stream event types I receive.

**Acceptance Criteria:**
- [ ] `LLMRequest` has `stream_mode: Optional[List[str]]` field defaulting to `None`
- [ ] Validator rejects invalid mode names with 422 and lists valid options
- [ ] Single string input (e.g., `"updates"`) is coerced to a list (`["updates"]`)
- [ ] Empty list `[]` is coerced to `None` (falls back to default)
- [ ] Duplicate modes are deduplicated while preserving order
- [ ] `resolved_stream_mode` property returns `["messages", "values"]` when field is `None`
- [ ] Field is silently ignored by `/llm/invoke` (non-streaming endpoint)
- [ ] `make format` and `make lint` pass

### US-002: Thread `stream_mode` through sync streaming pipeline
**Description:** As an API consumer using sync mode, I want my `stream_mode` choice to control what `agent.astream()` receives so that I only get the event types I requested.

**Acceptance Criteria:**
- [ ] `stream_generator()` accepts `stream_mode: list[str] | None` parameter
- [ ] Hard-coded `["messages", "values"]` at line 294 replaced with resolved parameter
- [ ] `LLMController.llm_stream()` forwards `params.resolved_stream_mode` to `stream_generator()`
- [ ] `LLMService.assistant()` preserves `stream_mode` when reconstructing request from assistant config
- [ ] SSE output contains only event types matching the requested modes (plus metadata and done markers)
- [ ] Default behavior (no `stream_mode` sent) produces identical output to current implementation
- [ ] `make test` passes

### US-003: Thread `stream_mode` through distributed worker pipeline
**Description:** As an API consumer using distributed mode, I want my `stream_mode` to propagate through the TaskIQ worker so that the Redis stream contains only the event types I requested.

**Acceptance Criteria:**
- [ ] `run_agent_stream()` TaskIQ task accepts `stream_mode: list[str] | None = None` kwarg
- [ ] `stream_mode` passed as explicit argument to `.kiq()` in the route handler (not buried in task_dict)
- [ ] `_execute_agent_stream()` uses dynamic `stream_mode` in both primary and Daytona fallback `agent.astream()` calls
- [ ] Hard-coded `["messages", "values"]` at lines ~422 and ~514 of `tasks.py` replaced
- [ ] In-flight tasks (enqueued before deployment) receive `None` and fall back to default — no breakage
- [ ] `stream_from_redis()` requires NO changes (confirmed mode-agnostic)
- [ ] `make test` passes

### US-004: Refactor `handle_multi_mode()` to dispatch all stream modes
**Description:** As a developer, I need `handle_multi_mode()` to correctly process chunks from any LangGraph stream mode so that new modes like `updates`, `tasks`, and `debug` are not silently dropped.

**Acceptance Criteria:**
- [ ] `handle_multi_mode()` dispatches `"messages"` chunks (existing behavior preserved exactly)
- [ ] `handle_multi_mode()` dispatches `"values"` chunks (existing behavior preserved exactly)
- [ ] `handle_multi_mode()` dispatches `"updates"` chunks via `handle_updates_mode()`
- [ ] `handle_multi_mode()` dispatches `"tasks"` chunks via `handle_tasks_mode()`
- [ ] `handle_multi_mode()` dispatches `"debug"` chunks via `handle_debug_mode()`
- [ ] `handle_multi_mode()` passes through `"custom"` chunks as-is
- [ ] Unrecognized mode names logged as warning, return `None` (not crash)
- [ ] `make test` passes

### US-005: Fix `handle_updates_mode()` bug and make generic
**Description:** As a developer, I need `handle_updates_mode()` fixed so it doesn't raise `UnboundLocalError` and handles arbitrary graph node names generically.

**Acceptance Criteria:**
- [ ] Function iterates `payload.items()` — handles any node name, not just `"agent"` and `"tools"`
- [ ] For each node with a `"messages"` key, messages are converted via `_to_dict()`
- [ ] Nodes without `"messages"` are passed through unchanged
- [ ] No `UnboundLocalError` when payload has neither `"agent"` nor `"tools"` key
- [ ] Returns dict preserving node-name structure (e.g., `{"agent": {"messages": [...]}}`)
- [ ] Unit test covers: agent-only, tools-only, both, neither, unknown node names
- [ ] `make test` passes

### US-006: Add unit tests for stream_mode validation and dispatch
**Description:** As a developer, I want comprehensive tests ensuring stream_mode validation and chunk dispatch work correctly.

**Acceptance Criteria:**
- [ ] Test: `LLMRequest` without `stream_mode` has `None`, `resolved_stream_mode` returns `["messages", "values"]`
- [ ] Test: valid modes `["messages", "values", "updates"]` accepted
- [ ] Test: invalid mode `["messages", "invalid"]` raises `ValidationError`
- [ ] Test: empty list `[]` results in `None`
- [ ] Test: single string `"messages"` coerced to `["messages"]`
- [ ] Test: duplicates `["messages", "messages"]` deduped to `["messages"]`
- [ ] Test: `stream_mode` survives `model_dump()` + `LLMRequest(**dict)` round-trip
- [ ] Test: `handle_multi_mode()` processes `("updates", {...})` tuples correctly
- [ ] Test: `handle_multi_mode()` processes `("tasks", {...})` tuples correctly
- [ ] Test: `handle_multi_mode()` processes `("debug", {...})` tuples correctly
- [ ] All tests pass via `make test`

### US-007: Update OpenAPI examples
**Description:** As an API consumer, I want to see `stream_mode` in the API docs so I know how to use the parameter.

**Acceptance Criteria:**
- [ ] New example added to `LLM_STREAM_EXAMPLES` showing `stream_mode: ["messages", "values", "updates"]`
- [ ] Existing examples unchanged (backward compat)
- [ ] Field description in schema explains valid values, default behavior, and that it's ignored by `/llm/invoke`
- [ ] `make format` passes

## Functional Requirements

- FR-1: `LLMRequest` accepts optional `stream_mode: list[str]` with Pydantic validation against the set `{"messages", "values", "updates", "tasks", "debug", "custom", "checkpoints"}`
- FR-2: When `stream_mode` is `None` or omitted, the system uses `["messages", "values"]` (current default)
- FR-3: When `stream_mode` is provided, the system passes it directly to `agent.astream()` — no modes are force-added or removed
- FR-4: `stream_generator()` accepts a `stream_mode` parameter and uses it instead of the hard-coded list
- FR-5: `LLMController.llm_stream()` reads `stream_mode` from the resolved request and passes it to `stream_generator()`
- FR-6: `LLMService.assistant()` preserves `stream_mode` when reconstructing `LLMRequest` from assistant config
- FR-7: `run_agent_stream()` TaskIQ task accepts `stream_mode` as an explicit kwarg with `None` default
- FR-8: The distributed route handler passes `params.stream_mode` to `.kiq()` as a separate argument
- FR-9: `_execute_agent_stream()` uses the dynamic `stream_mode` in both primary and Daytona fallback streaming loops
- FR-10: `handle_multi_mode()` dispatches chunks for all 7 LangGraph stream modes: messages, values, updates, tasks, debug, custom, checkpoints
- FR-11: `handle_updates_mode()` iterates `payload.items()` generically — supports arbitrary graph node names, converts `messages` arrays via `_to_dict()`
- FR-12: Invalid `stream_mode` values are rejected at the API boundary with a 422 response listing valid options
- FR-13: A new OpenAPI example demonstrates the `stream_mode` parameter

## Non-Goals

- No frontend UI for selecting stream modes (this is an API-only feature for power users)
- No frontend SSE parser changes (existing parser already drops unknown event types gracefully)
- No `useChat.ts` handler changes for new event types (deferred to future frontend work)
- No wiki documentation updates (deferred)
- No `stream_mode` persistence on `Assistant` model (it's a request-time parameter)
- No automatic mode inference based on agent type or configuration
- No rate limiting or quota differences based on stream mode selection

## Technical Considerations

- **LangGraph StreamMode type**: `('values', 'updates', 'checkpoints', 'tasks', 'debug', 'messages', 'custom')` — imported from `langgraph.types`
- **Multi-mode chunk format**: When `stream_mode` is a list, LangGraph returns tuples `(mode_name, payload)`. The existing `handle_multi_mode()` already expects this tuple format but only handles 2 of 7 modes
- **Existing handlers**: `handle_tasks_mode()`, `handle_messages_mode()`, `handle_debug_mode()`, `handle_updates_mode()`, `handle_values_mode()` all exist in `stream.py` — leverage them rather than writing new ones
- **TaskIQ serialization**: `list[str]` serializes cleanly via JSON. Adding a kwarg with `None` default provides backward compat for in-flight tasks
- **`stream_from_redis()`**: Confirmed mode-agnostic — just relays `data` bytes. No changes needed
- **Files/todos extraction**: Currently depends on `"values"` mode chunks. If user omits `"values"`, files/todos won't update during streaming but the `finally` block still persists final state from checkpoint. This is an acceptable trade-off documented in the API description
- **Daytona fallback**: Both the primary and fallback streaming loops in `tasks.py` must use the dynamic `stream_mode`

### Key Files

| File | Lines of Interest | Purpose |
|------|-------------------|---------|
| `backend/src/schemas/entities/llm.py` | `LLMRequest` class | Add field + validator |
| `backend/src/utils/stream.py` | L180-213, L216-412 | Refactor `handle_multi_mode`, update `stream_generator` |
| `backend/src/controllers/llm.py` | `llm_stream()` | Thread parameter |
| `backend/src/routes/v0/llm.py` | L72-159 | Pass to `.kiq()` |
| `backend/src/workers/tasks.py` | L420-425, L512-516 | Replace hard-coded modes |
| `backend/src/services/llm.py` | `assistant()` | Preserve stream_mode |
| `backend/src/constants/examples/__init__.py` | `LLM_STREAM_EXAMPLES` | Add example |

## Success Metrics

- API consumers can pass `stream_mode` and receive only the event types they requested
- Default behavior (no `stream_mode`) produces byte-identical SSE output to current implementation
- All existing tests pass without modification
- New tests cover validation, dispatch, and round-trip serialization
- No regressions in streaming latency or throughput

## Open Questions

- Should `stream_mode` be addable to `Assistant.metadata` for per-agent defaults? (Deferred — not in scope)
- Should the `"checkpoints"` mode be validated but warned as experimental? (LangGraph docs unclear on stability)
- If a user sends `stream_mode=["updates"]` only, should the API docs recommend also including `"messages"` for real-time rendering? (Yes — document in field description, don't enforce)
