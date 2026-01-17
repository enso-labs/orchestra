# PRD: Simplify LLM Streaming Endpoint

## Introduction

Refactor the FastAPI LLM streaming endpoints (`/api/llm/stream` and `/api/threads/{thread_id}/stream`) to improve long-term maintainability through clear separation of concerns, consolidated shared logic, and comprehensive test coverage. The current implementation mixes agent construction, streaming orchestration, serialization, and state persistence within a single 100+ line async generator, making it difficult for new developers to understand and extend.

## Goals

- Extract shared logic between `LLMController` and `stream.py` into a dedicated service layer
- Separate distributed worker mode into its own distinct endpoint (`/api/llm/stream/distributed`)
- Create explicit lifecycle boundaries: orchestration, formatting, and persistence
- Improve cancellation/disconnect handling with explicit detection
- Achieve comprehensive test coverage for all extracted components
- Preserve existing SSE wire format and client contract exactly

## Current Architecture Analysis

### Files in Scope
| File | Lines | Responsibility |
|------|-------|----------------|
| `backend/src/routes/v0/llm.py` | 73-136 | Route handler, distributed mode branching |
| `backend/src/routes/v0/thread.py` | 233-271 | Distributed stream consumer endpoint |
| `backend/src/controllers/llm.py` | 101-112 | Controller thin wrapper |
| `backend/src/utils/stream.py` | 180-351 | Core streaming logic, Redis consumer |

### Identified Complexity Issues
| Area | Symptom | Root Cause | Risk | Simplification Move |
|------|---------|------------|------|---------------------|
| `stream_generator()` | 113 lines, 4 responsibilities | No separation of concerns | Hard to test, modify | Extract orchestrator + formatter |
| Runtime init | Duplicated in controller + stream | No shared service | Inconsistent behavior | Extract to `StreamingService` |
| Mode handlers | 6 handler functions, only 1 used | Dead code | Confusion | Remove unused handlers |
| Store update | Duplicated in controller + stream | Copy-paste | Bug divergence | Consolidate in service |
| Cancellation | Implicit via generator exhaustion | No explicit handling | Silent failures | Add disconnect detection |
| Distributed mode | Inline conditional in same endpoint | Coupled paths | Testing difficulty | Separate endpoint |

## User Stories

### US-001: Extract StreamingService Layer
**Description:** As a developer, I need shared streaming logic in a single service so that controller and stream module stay in sync.

**Acceptance Criteria:**
- [ ] Create `backend/src/services/streaming.py` with `StreamingService` class
- [ ] Move `init_runtime()`, `init_backend()`, and `construct_agent()` orchestration to service
- [ ] Move store update logic (`_update_store`) to service
- [ ] `LLMController` delegates to `StreamingService`
- [ ] `stream_generator()` delegates to `StreamingService`
- [ ] No duplicate initialization code remains
- [ ] Typecheck passes (`make format`)
- [ ] Existing tests pass (`make test`)

### US-002: Create Explicit Event Model
**Description:** As a developer, I need a typed event model so that stream output is predictable and testable.

**Acceptance Criteria:**
- [ ] Create `backend/src/schemas/events/stream.py` with event types:
  - `MetadataEvent(thread_id, assistant_id, project_id)`
  - `MessageEvent(message_dict, metadata)`
  - `ValuesEvent(files, todos, messages)`
  - `ErrorEvent(error_message, error_code)`
  - `DoneEvent()`
- [ ] Events have `to_sse()` method returning formatted `data: {...}\n\n` string
- [ ] All events are JSON-serializable
- [ ] Typecheck passes

### US-003: Extract Stream Formatter
**Description:** As a developer, I need serialization logic separated from orchestration so that I can test formatting independently.

**Acceptance Criteria:**
- [ ] Create `StreamFormatter` class in `backend/src/utils/stream_formatter.py`
- [ ] Move `handle_multi_mode()` logic into formatter
- [ ] Remove unused handler functions (`handle_tasks_mode`, `handle_debug_mode`, `handle_updates_mode`)
- [ ] Keep only `handle_messages_mode` and `handle_values_mode` (used by `["messages", "values"]` stream mode)
- [ ] Formatter accepts raw chunks, returns typed `StreamEvent` objects
- [ ] Typecheck passes
- [ ] Unit tests for formatter with sample chunks

### US-004: Refactor stream_generator with Clear Lifecycle
**Description:** As a developer, I need `stream_generator()` to have explicit phases so that the flow is understandable.

**Acceptance Criteria:**
- [ ] Restructure `stream_generator()` into explicit phases:
  1. **Setup**: Get dependencies from `StreamingService`
  2. **Metadata**: Yield metadata event
  3. **Stream**: Iterate agent, format chunks, yield events
  4. **Finalize**: Update store via `StreamingService`
- [ ] Each phase is clearly commented/separated
- [ ] Function reduced to <60 lines
- [ ] Error handling uses typed `ErrorEvent`
- [ ] Typecheck passes
- [ ] Existing behavior preserved (verified via integration test)

### US-005: Add Explicit Cancellation Handling
**Description:** As a developer, I need explicit disconnect detection so that resources are cleaned up properly when clients disconnect.

**Acceptance Criteria:**
- [ ] Add `asyncio.CancelledError` handling in `stream_generator()`
- [ ] Log cancellation events with thread_id
- [ ] Ensure store update runs in `finally` block even on cancellation
- [ ] Add request disconnect check using `request.is_disconnected()` (passed from route handler)
- [ ] Typecheck passes
- [ ] Unit test for cancellation scenario

### US-006: Separate Distributed Mode Endpoint
**Description:** As a developer, I need distributed streaming in its own endpoint so that sync and async paths are independently testable.

**Acceptance Criteria:**
- [ ] Create new endpoint `POST /api/llm/stream/distributed` in `llm.py`
- [ ] Move distributed worker enqueue logic to new endpoint
- [ ] Remove `DISTRIBUTED_WORKERS` conditional from main `/stream` endpoint
- [ ] Main `/stream` endpoint only handles sync streaming
- [ ] New endpoint returns `{"thread_id": str, "poll_url": str}` with HTTP 202
- [ ] Update client documentation/comments
- [ ] Typecheck passes
- [ ] Existing distributed flow still works

### US-007: Consolidate Redis Stream Consumer
**Description:** As a developer, I need the Redis stream consumer to use the same event model for consistency.

**Acceptance Criteria:**
- [ ] Refactor `stream_from_redis()` to use `StreamEvent` types
- [ ] Add explicit timeout configuration via `StreamingService`
- [ ] Improve error event format to match sync stream errors
- [ ] Add keep-alive interval configuration
- [ ] Typecheck passes

### US-008: Unit Tests for StreamingService
**Description:** As a developer, I need unit tests for the service layer to ensure reliability.

**Acceptance Criteria:**
- [ ] Create `backend/tests/unit/services/test_streaming_service.py`
- [ ] Test `init_runtime()` returns valid `ToolRuntime`
- [ ] Test `init_backend()` returns valid `CompositeBackend`
- [ ] Test `update_store()` calls thread service correctly
- [ ] Mock external dependencies (store, checkpointer)
- [ ] All tests pass

### US-009: Unit Tests for StreamFormatter
**Description:** As a developer, I need formatter tests to lock serialization behavior.

**Acceptance Criteria:**
- [ ] Create `backend/tests/unit/utils/test_stream_formatter.py`
- [ ] Test message chunk formatting (AIMessageChunk, ToolMessage)
- [ ] Test values chunk formatting (files, todos, messages)
- [ ] Test error event formatting
- [ ] Test edge cases (empty content, missing fields)
- [ ] All tests pass

### US-010: Integration Tests for Stream Endpoints
**Description:** As a developer, I need integration tests to verify end-to-end streaming behavior.

**Acceptance Criteria:**
- [ ] Create `backend/tests/integration/test_llm_stream.py`
- [ ] Test sync stream returns valid SSE format
- [ ] Test metadata event is first event
- [ ] Test error events have correct format
- [ ] Test stream completes with proper store update
- [ ] Test cancellation cleans up properly
- [ ] All tests pass

### US-011: Integration Tests for Distributed Stream
**Description:** As a developer, I need tests for the distributed streaming path.

**Acceptance Criteria:**
- [ ] Create `backend/tests/integration/test_distributed_stream.py`
- [ ] Test `/stream/distributed` returns 202 with thread_id
- [ ] Test `/threads/{thread_id}/stream` consumes Redis stream
- [ ] Test keep-alive events during idle periods
- [ ] Test error propagation from worker
- [ ] Mock Redis for unit testing, use real Redis for integration
- [ ] All tests pass

## Functional Requirements

- **FR-1:** `StreamingService` must provide `init_runtime()`, `init_backend()`, `construct_agent()`, and `update_store()` methods
- **FR-2:** `StreamEvent` types must serialize to SSE format: `data: ["type", {payload}]\n\n`
- **FR-3:** `StreamFormatter` must handle `["messages", "values"]` stream mode chunks
- **FR-4:** `stream_generator()` must yield events in order: metadata, messages/values, done
- **FR-5:** Cancellation must trigger cleanup and log the disconnection
- **FR-6:** `POST /api/llm/stream/distributed` must enqueue to TaskIQ and return 202
- **FR-7:** `GET /api/threads/{thread_id}/stream` must consume Redis stream with configurable timeout
- **FR-8:** All endpoints must preserve existing response headers (`Cache-Control`, `Connection`, `X-Accel-Buffering`)

## Non-Goals (Out of Scope)

- Changing the SSE wire format or event types clients receive
- Adding new streaming features (tracing, metrics, auth hooks)
- Refactoring the TaskIQ worker implementation
- Modifying the LangGraph agent construction logic
- Changing the checkpoint/store persistence model
- WebSocket support (current SSE-only approach preserved)
- Performance optimization (focus is maintainability)

## Technical Considerations

### Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Route Handlers                            │
│  /api/llm/stream (sync)  │  /api/llm/stream/distributed (async) │
└──────────────┬───────────┴──────────────┬───────────────────────┘
               │                          │
               ▼                          ▼
┌──────────────────────────┐   ┌─────────────────────────┐
│     LLMController        │   │   TaskIQ Worker Queue   │
│  (thin orchestration)    │   │                         │
└──────────────┬───────────┘   └─────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────┐
│                      StreamingService                             │
│  - init_runtime()     - init_backend()    - construct_agent()    │
│  - update_store()     - get_config()                             │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────┐
│                      stream_generator()                           │
│  Phase 1: Setup (via StreamingService)                           │
│  Phase 2: Yield MetadataEvent                                    │
│  Phase 3: Stream loop (agent.astream → StreamFormatter → yield)  │
│  Phase 4: Finalize (StreamingService.update_store)               │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────┐
│                      StreamFormatter                              │
│  - format_message_chunk()   - format_values_chunk()              │
│  - to_sse()                                                      │
└──────────────────────────────────────────────────────────────────┘
```

### File Changes Summary

| Action | File |
|--------|------|
| CREATE | `backend/src/services/streaming.py` |
| CREATE | `backend/src/schemas/events/stream.py` |
| CREATE | `backend/src/utils/stream_formatter.py` |
| MODIFY | `backend/src/routes/v0/llm.py` (separate distributed endpoint) |
| MODIFY | `backend/src/controllers/llm.py` (delegate to service) |
| MODIFY | `backend/src/utils/stream.py` (simplify, use service + formatter) |
| CREATE | `backend/tests/unit/services/test_streaming_service.py` |
| CREATE | `backend/tests/unit/utils/test_stream_formatter.py` |
| CREATE | `backend/tests/integration/test_llm_stream.py` |
| CREATE | `backend/tests/integration/test_distributed_stream.py` |

### Dependencies
- No new external dependencies
- Uses existing: `langgraph`, `langchain_core`, `ujson`, `redis.asyncio`

### Breaking Changes
- New endpoint path for distributed mode (`/api/llm/stream/distributed`)
- Clients using distributed mode need to update to new endpoint
- Sync streaming clients unaffected

## Success Metrics

- `stream_generator()` reduced from ~113 lines to <60 lines
- Zero duplicate initialization code between controller and stream module
- 100% test coverage for `StreamingService` and `StreamFormatter`
- All existing integration tests pass without modification
- New developer can understand streaming flow in <15 minutes (code review feedback)

## Open Questions

1. Should we add OpenTelemetry tracing hooks as part of this refactor, or keep as a separate future enhancement?
2. Is the keep-alive interval (currently hardcoded in `stream_from_redis`) acceptable, or should it be configurable via environment variable?
3. Should error events include stack traces in non-production environments for debugging?

## Extensibility Proof

**Example: Adding Request Tracing**

With the new architecture, adding OpenTelemetry tracing requires changes in ONE place:

```python
# In StreamingService.construct_agent()
async def construct_agent(self, ..., trace_context: Optional[TraceContext] = None):
    with tracer.start_span("construct_agent", context=trace_context):
        # existing logic
        ...
```

```python
# In stream_generator()
async def stream_generator(...):
    with tracer.start_span("stream_generator") as span:
        span.set_attribute("thread_id", config["configurable"]["thread_id"])
        # existing phases unchanged
        ...
```

No changes needed to route handlers, formatter, or event model. Clear injection point at service layer.
