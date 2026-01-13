# Implementation Tasks: Frontend Distributed Workers Integration

**Feature**: Distributed Workers for LLM Streaming (Frontend)
**Based on**: REVIEW.md Council Decision
**Estimated Effort**: 2-3 days

---

## Pre-Implementation

-   [x] Review FINAL_REPORT.md API contract
-   [x] Review REVIEW.md council decisions
-   [ ] Create feature branch: `feature/frontend-distributed-workers`
-   [ ] Verify development environment (`npm run dev` works)

---

## Phase 1: Type Definitions

-   [x] **Task 1.1**: Create stream type definitions

    -   File: `src/lib/entities/stream.ts` (NEW)
    -   Contents:
        -   `DistributedStreamResponse` interface
        -   `SSEEventType` union type
        -   `MetadataEvent`, `MessagesEvent`, `ValuesEvent`, `ErrorEvent` interfaces
        -   `StreamEvent` union type
        -   `DoneSignal` interface
        -   `isDistributedResponse()` type guard
    -   Acceptance: Types compile without errors ✓

-   [x] **Task 1.2**: Create Zod validation schemas
    -   File: `src/validations/stream.ts` (NEW)
    -   Contents:
        -   `DistributedResponseSchema`
        -   `SSEEventSchema`
        -   `parseStreamEvent()` helper
    -   Acceptance: Schemas validate test data correctly ✓

---

## Phase 2: Stream Infrastructure

-   [x] **Task 2.1**: Implement FetchStreamReader

    -   File: `src/lib/utils/fetchStreamReader.ts` (NEW)
    -   Contents:
        -   Class with `start()`, `close()` methods
        -   Custom SSE parsing from fetch response body
        -   Support for Authorization headers
        -   AbortController integration
        -   Event callbacks: `onEvent`, `onError`, `onClose`
    -   Acceptance: Can read SSE from GET endpoint with auth ✓

-   [x] **Task 2.2**: Implement StreamSource interface
    -   File: `src/lib/utils/streamSource.ts` (NEW)
    -   Contents:
        -   `StreamSource` interface definition
        -   `SyncStreamSource` class (wraps POST response)
        -   `DistributedStreamSource` class (uses FetchStreamReader)
    -   Acceptance: Both classes implement same interface ✓

---

## Phase 3: Service Layer

-   [x] **Task 3.1**: Add initiateStream() to threadService

    -   File: `src/lib/services/threadService.ts` (MODIFY)
    -   Changes:
        -   Add `initiateStream(payload: StreamRequest): Promise<StreamSource>`
        -   Handle 200 → SyncStreamSource
        -   Handle 202 → parse JSON → DistributedStreamSource
        -   Handle error status codes appropriately
    -   Acceptance: Function returns correct source type based on response ✓

-   [x] **Task 3.2**: Add stream type exports
    -   File: `src/lib/services/index.ts` (MODIFY if exists)
    -   Changes: Export new stream-related functions
    -   Acceptance: Clean imports from service layer ✓

---

## Phase 4: Hook Integration

-   [x] **Task 4.1**: Update useChat to use initiateStream

    -   File: `src/hooks/useChat.ts` (MODIFY)
    -   Changes:
        -   Import `initiateStream` from threadService
        -   Modify `handleSSE()` to use new abstraction
        -   Convert StreamEvent to legacy format for handleMessages()
        -   Preserve all existing handleMessages() logic
    -   Acceptance: Chat works in sync mode (regression test) ✓

-   [x] **Task 4.2**: Add distributed mode handling

    -   File: `src/hooks/useChat.ts` (MODIFY)
    -   Changes:
        -   Detect distributed response
        -   Store thread_id from 202 response
        -   Start polling via DistributedStreamSource
        -   Handle [DONE] signal to stop polling
    -   Acceptance: Distributed mode completes successfully ✓

-   [x] **Task 4.3**: Add optimistic UI updates
    -   File: `src/hooks/useChat.ts` (MODIFY)
    -   Changes:
        -   Show user message immediately on submit
        -   Show "processing" state during distributed wait
        -   Smooth transition when stream starts
    -   Acceptance: No perceived delay after submit ✓

---

## Phase 5: Error Handling

-   [x] **Task 5.1**: Add error classification

    -   File: `src/lib/utils/streamError.ts` (NEW)
    -   Contents:
        -   `StreamError` interface
        -   `classifyError()` function
        -   Error codes: NETWORK, AUTH, TIMEOUT, SERVER, PARSE
    -   Acceptance: Errors are correctly classified ✓

-   [x] **Task 5.2**: Add retry logic

    -   File: `src/lib/utils/streamSource.ts` (MODIFY)
    -   Changes:
        -   Exponential backoff for retryable errors
        -   Max 3 retries
        -   Emit final error after retries exhausted
    -   Acceptance: Transient errors recover automatically ✓

-   [x] **Task 5.3**: Add UI error states
    -   File: `src/hooks/useChat.ts` (MODIFY)
    -   Changes:
        -   Display error toast for stream failures
        -   Clear loading state on error
        -   Allow retry from UI
    -   Acceptance: User sees helpful error message ✓

---

## Phase 6: Testing

-   [x] **Task 6.1**: Unit tests for FetchStreamReader

    -   File: `src/tests/utils/fetchStreamReader.test.ts` (NEW)
    -   Tests:
        -   Parses valid SSE events
        -   Handles [DONE] signal
        -   Handles network errors
        -   Abort controller works
    -   Acceptance: All tests pass (11 tests) ✓

-   [x] **Task 6.2**: Unit tests for StreamSource classes

    -   File: `src/tests/utils/streamSource.test.ts` (NEW)
    -   Tests:
        -   SyncStreamSource reads from response body
        -   DistributedStreamSource polls GET endpoint
        -   Both emit events in same format
    -   Acceptance: All tests pass (9 tests) ✓

-   [x] **Task 6.3**: Integration tests for distributed flow
    -   File: `src/tests/integration/distributedStream.test.ts` (NEW)
    -   Tests:
        -   POST returns 202 → polling starts
        -   Events are processed correctly
        -   Multi-turn works with thread_id
        -   Error recovery works
    -   Acceptance: All tests pass (9 tests) ✓

---

## Phase 7: Validation

-   [ ] **Task 7.1**: Manual testing - sync mode

    -   Steps:
        1. Set `DISTRIBUTED_WORKERS=false` on backend
        2. Send chat message
        3. Verify stream works as before
    -   Acceptance: No regression

-   [ ] **Task 7.2**: Manual testing - distributed mode

    -   Steps:
        1. Set `DISTRIBUTED_WORKERS=true` on backend
        2. Start TaskIQ worker
        3. Send chat message
        4. Verify stream completes
        5. Send follow-up message
        6. Verify context preserved
    -   Acceptance: Multi-turn works

-   [ ] **Task 7.3**: Manual testing - error cases
    -   Steps:
        1. Stop TaskIQ worker
        2. Send message
        3. Verify timeout/error displayed
    -   Acceptance: User sees helpful error

---

## Completion Checklist

-   [x] All unit tests pass (`npm run test`) - 151 tests passing
-   [x] No linting errors (`npm run lint`) - 0 errors
-   [x] No TypeScript errors (`npm run build`) - 0 errors
-   [ ] Manual validation complete
-   [ ] Code reviewed against REVIEW.md decisions
-   [ ] PR created with change summary

---

## Progress Log

| Task | Status   | Completed  | Notes                                        |
| ---- | -------- | ---------- | -------------------------------------------- |
| 1.1  | Complete | 2026-01-12 | Stream type definitions created              |
| 1.2  | Complete | 2026-01-12 | Zod schemas with parseStreamEvent helper     |
| 2.1  | Complete | 2026-01-12 | FetchStreamReader + ResponseBodyReader       |
| 2.2  | Complete | 2026-01-12 | StreamSource interface with implementations  |
| 3.1  | Complete | 2026-01-12 | initiateStream() handles 200/202 responses   |
| 3.2  | Complete | 2026-01-12 | Exports added to services/index.ts           |
| 4.1  | Complete | 2026-01-12 | handleSSEUnified() created, legacy preserved |
| 4.2  | Complete | 2026-01-12 | Distributed mode handled via StreamSource    |
| 4.3  | Complete | 2026-01-12 | Optimistic user message + processing state   |
| 5.1  | Complete | 2026-01-12 | streamError.ts with classifyError()          |
| 5.2  | Complete | 2026-01-12 | Retry logic in DistributedStreamSource       |
| 5.3  | Complete | 2026-01-12 | Error alerts and loading state cleanup       |
| 6.1  | Complete | 2026-01-12 | 11 tests for FetchStreamReader               |
| 6.2  | Complete | 2026-01-12 | 9 tests for StreamSource classes             |
| 6.3  | Complete | 2026-01-12 | 9 integration tests for distributed flow     |
| 7.1  | Pending  | -          | Manual testing - sync mode                   |
| 7.2  | Pending  | -          | Manual testing - distributed mode            |
| 7.3  | Pending  | -          | Manual testing - error cases                 |

**Total Tasks**: 18
**Completed**: 15
**Remaining**: 3 (manual testing only)
