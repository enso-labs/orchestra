---
task: Simplify LLM streaming endpoint architecture
test_command: "make test"
---

# Task: Simplify LLM Streaming Endpoint

Refactor the FastAPI LLM streaming endpoints (`/api/llm/stream` and `/api/threads/{thread_id}/stream`) to improve maintainability through clear separation of concerns, consolidated shared logic, and comprehensive test coverage.

## Requirements

1. Extract shared logic between `LLMController` and `stream.py` into a dedicated service layer
2. Separate distributed worker mode into its own endpoint (`/api/llm/stream/distributed`)
3. Create explicit lifecycle boundaries: orchestration, formatting, and persistence
4. Improve cancellation/disconnect handling with explicit detection
5. Achieve comprehensive test coverage for all extracted components
6. Preserve existing SSE wire format and client contract exactly

## Files in Scope

| File | Lines | Responsibility |
|------|-------|----------------|
| `backend/src/routes/v0/llm.py` | 73-136 | Route handler, distributed mode branching |
| `backend/src/routes/v0/thread.py` | 233-271 | Distributed stream consumer endpoint |
| `backend/src/controllers/llm.py` | 101-112 | Controller thin wrapper |
| `backend/src/utils/stream.py` | 180-351 | Core streaming logic, Redis consumer |

## Success Criteria

### US-001: Extract StreamingService Layer
1. [ ] Create `backend/src/services/streaming.py` with `StreamingService` class
2. [ ] Move `init_runtime()`, `init_backend()`, and `construct_agent()` to service
3. [ ] Move store update logic (`_update_store`) to service
4. [ ] `LLMController` delegates to `StreamingService`
5. [ ] `stream_generator()` delegates to `StreamingService`
6. [ ] Typecheck passes (`make format`) and tests pass (`make test`)

### US-002: Create Explicit Event Model
7. [ ] Create `backend/src/schemas/events/stream.py` with event types: `MetadataEvent`, `MessageEvent`, `ValuesEvent`, `ErrorEvent`, `DoneEvent`
8. [ ] Events have `to_sse()` method returning formatted `data: {...}\n\n` string
9. [ ] All events are JSON-serializable

### US-003: Extract Stream Formatter
10. [ ] Create `StreamFormatter` class in `backend/src/utils/stream_formatter.py`
11. [ ] Move `handle_multi_mode()` logic into formatter
12. [ ] Remove unused handlers (`handle_tasks_mode`, `handle_debug_mode`, `handle_updates_mode`)
13. [ ] Keep only `handle_messages_mode` and `handle_values_mode`
14. [ ] Unit tests for formatter with sample chunks

### US-004: Refactor stream_generator with Clear Lifecycle
15. [ ] Restructure `stream_generator()` into phases: Setup, Metadata, Stream, Finalize
16. [ ] Function reduced to <60 lines
17. [ ] Error handling uses typed `ErrorEvent`

### US-005: Add Explicit Cancellation Handling
18. [ ] Add `asyncio.CancelledError` handling in `stream_generator()`
19. [ ] Log cancellation events with thread_id
20. [ ] Ensure store update runs in `finally` block even on cancellation
21. [ ] Add request disconnect check using `request.is_disconnected()`
22. [ ] Unit test for cancellation scenario

### US-006: Separate Distributed Mode Endpoint
23. [ ] Create new endpoint `POST /api/llm/stream/distributed` in `llm.py`
24. [ ] Move distributed worker enqueue logic to new endpoint
25. [ ] Remove `DISTRIBUTED_WORKERS` conditional from main `/stream` endpoint
26. [ ] New endpoint returns `{"thread_id": str, "poll_url": str}` with HTTP 202

### US-007: Consolidate Redis Stream Consumer
27. [ ] Refactor `stream_from_redis()` to use `StreamEvent` types
28. [ ] Add explicit timeout configuration via `StreamingService`
29. [ ] Improve error event format to match sync stream errors

### US-008: Unit Tests for StreamingService
30. [ ] Create `backend/tests/unit/services/test_streaming_service.py`
31. [ ] Test `init_runtime()`, `init_backend()`, `update_store()` methods
32. [ ] Mock external dependencies (store, checkpointer)

### US-009: Unit Tests for StreamFormatter
33. [ ] Create `backend/tests/unit/utils/test_stream_formatter.py`
34. [ ] Test message chunk formatting (AIMessageChunk, ToolMessage)
35. [ ] Test values chunk formatting and error event formatting

### US-010: Integration Tests for Stream Endpoints
36. [ ] Create `backend/tests/integration/test_llm_stream.py`
37. [ ] Test sync stream returns valid SSE format
38. [ ] Test metadata event is first event
39. [ ] Test cancellation cleans up properly
40. [ ] All tests pass
41. [ ] CURL validation: `POST /api/llm/stream` returns SSE with Content-Type: text/event-stream
42. [ ] CURL validation: metadata event is first in stream response
43. [ ] Document CURL examples in task notes

### US-011: Integration Tests for Distributed Stream
44. [ ] Create `backend/tests/integration/test_distributed_stream.py`
45. [ ] Test `/stream/distributed` returns 202 with thread_id
46. [ ] Test `/threads/{thread_id}/stream` consumes Redis stream
47. [ ] All tests pass
48. [ ] CURL validation: `POST /api/llm/stream/distributed` returns 202 with thread_id and poll_url
49. [ ] CURL validation: `GET /api/threads/{thread_id}/stream` returns SSE stream
50. [ ] Document CURL examples in task notes

## File Changes Summary

| Action | File |
|--------|------|
| CREATE | `backend/src/services/streaming.py` |
| CREATE | `backend/src/schemas/events/stream.py` |
| CREATE | `backend/src/utils/stream_formatter.py` |
| MODIFY | `backend/src/routes/v0/llm.py` |
| MODIFY | `backend/src/controllers/llm.py` |
| MODIFY | `backend/src/utils/stream.py` |
| CREATE | `backend/tests/unit/services/test_streaming_service.py` |
| CREATE | `backend/tests/unit/utils/test_stream_formatter.py` |
| CREATE | `backend/tests/integration/test_llm_stream.py` |
| CREATE | `backend/tests/integration/test_distributed_stream.py` |

## Non-Goals

- Changing the SSE wire format or event types clients receive
- Adding new streaming features (tracing, metrics, auth hooks)
- Refactoring the TaskIQ worker implementation
- Modifying the LangGraph agent construction logic
- WebSocket support (current SSE-only approach preserved)

---

## Ralph Instructions

1. Work on the next incomplete criterion (marked [ ])
2. Check off completed criteria (change [ ] to [x])
3. Run tests after changes (`make test`)
4. Commit your changes frequently
5. When ALL criteria are [x], output: `<ralph>COMPLETE</ralph>`
6. If stuck on the same issue 3+ times, output: `<ralph>GUTTER</ralph>`
