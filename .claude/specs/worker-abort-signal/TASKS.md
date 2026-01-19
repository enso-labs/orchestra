# Implementation Tasks: Worker Abort Signal

**Feature:** User-triggered abort signals for distributed workers
**Date:** 2026-01-19
**Based on:** Council Review synthesis of ARCHITECT, CRAFTSMAN, and GUARDIAN proposals

---

## Pre-Implementation

- [ ] Verify development environment setup
  - Files: `backend/.venv`, `frontend/node_modules`
  - Acceptance: `uv sync` and `npm install` complete without errors

- [ ] Create feature branch: `feat/worker-abort-signal`
  - Acceptance: Branch created from `development`

- [ ] Review REVIEW.md council decisions
  - Files: `.claude/specs/worker-abort-signal/REVIEW.md`
  - Acceptance: Understanding of hybrid approach confirmed

---

## Phase 1: Backend Core (Priority: HIGH)

### 1.1 Create AbortService

- [ ] Create `backend/src/services/abort.py` with AbortService class
  - Files: `backend/src/services/abort.py` (NEW)
  - Acceptance: Class implements:
    - `__init__(self, user_id: str, store: BaseStore)`
    - `async request_abort(thread_id: str) -> str`
    - `async _verify_thread_ownership(thread_id: str) -> None`
    - `async _set_abort_signal(thread_id: str) -> None`
    - `@staticmethod async check_abort_signal(thread_id: str) -> bool`
    - `@staticmethod async clear_abort_signal(thread_id: str) -> None`

- [ ] Implement ownership verification in AbortService
  - Files: `backend/src/services/abort.py`
  - Acceptance:
    - Uses ThreadService to verify thread exists
    - Raises `ValueError` if thread not found (404)
    - Raises `PermissionError` if user doesn't own thread (403)
    - Logs unauthorized attempts with user context

- [ ] Implement Redis abort signal methods
  - Files: `backend/src/services/abort.py`
  - Acceptance:
    - Key pattern: `abort:signal:{thread_id}`
    - TTL: 300 seconds
    - `check_abort_signal` returns bool (EXISTS > 0)
    - `clear_abort_signal` deletes key

- [ ] Add comprehensive audit logging
  - Files: `backend/src/services/abort.py`
  - Acceptance: All operations logged with:
    - `event` type
    - `thread_id`
    - `user_id`
    - `timestamp`

### 1.2 Create Abort API Endpoint

- [ ] Add abort endpoint to thread routes
  - Files: `backend/src/routes/v0/thread.py`
  - Acceptance:
    - Route: `POST /threads/{thread_id}/abort`
    - Status: 202 Accepted
    - Requires: `verify_credentials` dependency
    - Returns: `{"status": "accepted", "thread_id": ..., "message": ...}`

- [ ] Implement error handling for abort endpoint
  - Files: `backend/src/routes/v0/thread.py`
  - Acceptance:
    - 401: Missing/invalid authentication
    - 403: User doesn't own thread (PermissionError)
    - 404: Thread not found (ValueError)
    - 500: Redis/internal errors

### 1.3 Backend Unit Tests

- [ ] Create unit tests for AbortService
  - Files: `backend/tests/unit/services/test_abort_service.py` (NEW)
  - Acceptance: Tests cover:
    - `test_request_abort_success`
    - `test_request_abort_thread_not_found`
    - `test_request_abort_unauthorized`
    - `test_check_abort_signal_exists`
    - `test_check_abort_signal_missing`
    - `test_clear_abort_signal`
    - `test_abort_signal_idempotent`

- [ ] Run unit tests and verify passing
  - Acceptance: `uv run pytest tests/unit/services/test_abort_service.py -v` passes

---

## Phase 2: Worker Integration (Priority: HIGH)

### 2.1 Pre-start Abort Check

- [ ] Add pre-start abort check to `run_agent_stream` task
  - Files: `backend/src/workers/tasks.py`
  - Acceptance:
    - Check `AbortService.check_abort_signal(thread_id)` before starting
    - If aborted, write abort marker to stream and return early
    - Log pre-abort event

### 2.2 Per-chunk Abort Checking

- [ ] Add abort signal checking to streaming loop
  - Files: `backend/src/workers/tasks.py`
  - Acceptance:
    - Import `AbortService`
    - Check `check_abort_signal(thread_id)` on every chunk
    - On abort: log event, send abort marker to stream, clear signal, return

- [ ] Implement abort marker in stream
  - Files: `backend/src/workers/tasks.py`
  - Acceptance:
    - Format: `{"data": ujson.dumps(("aborted", {"reason": "user_requested"}))}`
    - Include `{"done": "true"}` after abort marker
    - Set stream expiry (300s)

### 2.3 Stream Consumer Update

- [ ] Handle abort marker in stream consumer
  - Files: `backend/src/utils/stream.py`
  - Acceptance:
    - Detect `"aborted"` tuple type in stream data
    - Yield SSE event: `data: {"type": "aborted", "reason": "..."}`
    - Yield `data: [DONE]` and return

### 2.4 Worker Integration Tests

- [ ] Test abort signal stops worker
  - Files: `backend/tests/integration/test_abort_flow.py` (NEW)
  - Acceptance: Test simulates abort signal and verifies worker terminates

---

## Phase 3: Frontend Integration (Priority: MEDIUM)

### 3.1 Thread Service Extension

- [ ] Add `abortThread` function to threadService
  - Files: `frontend/src/lib/services/threadService.ts`
  - Acceptance:
    - Function: `abortThread(threadId: string): Promise<{status: string; message: string}>`
    - Makes `POST /threads/{threadId}/abort`
    - Includes Authorization header
    - Handles 403, 404, 500 errors appropriately

### 3.2 Chat Hook Enhancement

- [ ] Modify `abortQuery` in useChat hook
  - Files: `frontend/src/hooks/useChat.ts`
  - Acceptance:
    - Import `abortThread` from threadService
    - If `metadata?.thread_id` exists, call `abortThread()` (fire-and-forget)
    - Log warning on failure (don't block)
    - Continue with local `controller.abort()`

### 3.3 Stream Event Types

- [ ] Add AbortedEvent type
  - Files: `frontend/src/lib/entities/stream.ts` (if exists) or create types
  - Acceptance:
    - Interface: `AbortedEvent { type: "aborted"; data: { reason: string } }`
    - Add to SSEEvent union type

### 3.4 Stream Handler Update

- [ ] Handle aborted event in stream reader
  - Files: `frontend/src/lib/utils/fetchStreamReader.ts`
  - Acceptance:
    - Parse `"aborted"` type in tuple format
    - Return appropriate event object

### 3.5 Frontend Tests

- [ ] Add tests for abortThread service
  - Files: `frontend/src/tests/services/threadService.test.ts` (NEW or extend)
  - Acceptance: Test POST request and error handling

- [ ] Run frontend tests
  - Acceptance: `npm run test` passes

---

## Phase 4: Hardening (Priority: MEDIUM)

### 4.1 Rate Limiting

- [ ] Consider adding rate limiting to abort endpoint
  - Files: `backend/src/routes/v0/thread.py`
  - Acceptance: Document decision (implement or defer)

### 4.2 Edge Case Testing

- [ ] Test double abort scenario
  - Acceptance: Multiple abort calls are idempotent, no errors

- [ ] Test abort after completion
  - Acceptance: Signal expires via TTL, no effect on completed task

- [ ] Test concurrent abort + task completion
  - Acceptance: Race resolves naturally (task either aborts or completes)

### 4.3 Integration Verification

- [ ] Manual E2E test: Start long task, click Stop, verify abort
  - Acceptance:
    - Stream receives "aborted" event
    - Worker logs show graceful termination
    - UI reflects stopped state

---

## Verification

- [ ] All backend tests passing
  - Acceptance: `make test` passes

- [ ] All frontend tests passing
  - Acceptance: `npm run test` passes

- [ ] No linting errors
  - Acceptance: `make format` and `npm run lint` clean

- [ ] Self-review against REVIEW.md
  - Acceptance: All council requirements implemented

- [ ] Ready for PR
  - Acceptance: All tasks checked, code reviewed

---

## Completion Signature

- **Total Tasks**: 30
- **Critical Path**: Phase 1 & 2 (Backend + Worker) must complete before Phase 3
- **Dependencies**:
  - Redis (existing)
  - TaskIQ workers (existing)
  - ThreadService (existing)

---

## curl Validation Examples

After implementation, validate with:

```bash
# 1. Login to get token
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "test1234"}'

# 2. Start a distributed stream (get thread_id)
curl -X POST http://localhost:8000/api/llm/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"input": {"messages": [{"role": "user", "content": "Count slowly from 1 to 100"}]}, "model": "gpt-4o-mini"}'
# Expected: {"thread_id": "abc-123", "distributed": true}

# 3. Abort the running task
curl -X POST http://localhost:8000/api/threads/abc-123/abort \
  -H "Authorization: Bearer <token>"
# Expected: {"status": "accepted", "thread_id": "abc-123", "message": "..."}

# 4. Test unauthorized abort (different user's thread)
# Expected: 403 Forbidden

# 5. Test abort nonexistent thread
curl -X POST http://localhost:8000/api/threads/nonexistent/abort \
  -H "Authorization: Bearer <token>"
# Expected: 404 Not Found
```

---

## Progress Log

_(To be updated during implementation)_

