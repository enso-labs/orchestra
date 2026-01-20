# Implementation Tasks: Message Queue System for DeepAgents

**Task:** Implement Backend-Driven Message Queue System
**Test Command:** `make test`
**Reference:** `REVIEW.md` for council decisions, `PROPOSAL_*.md` for detailed designs

---

## User Stories

### US-01: Queue Messages While Processing
**As a** user
**I want to** submit multiple messages without waiting for the current response to complete
**So that** I can capture my thoughts quickly and have them processed sequentially

**Acceptance Criteria:**
- [ ] Messages submitted while agent is processing are added to a queue
- [ ] Queue is stored in Redis and persists across page refreshes
- [ ] User sees queued messages displayed above the chat input
- [ ] Messages execute in order (FIFO) as each completes

### US-02: Pause Queued Messages
**As a** user
**I want to** pause a queued message to prevent it from executing
**So that** I can reconsider whether I want to send that thought

**Acceptance Criteria:**
- [ ] Paused messages remain in queue but are skipped during processing
- [ ] Paused messages show a visual indicator (different color/icon)
- [ ] I can resume a paused message to return it to pending state
- [ ] Pause state persists across page refreshes

### US-03: Edit Queued Messages
**As a** user
**I want to** edit the content of a queued message before it executes
**So that** I can refine my thoughts while waiting

**Acceptance Criteria:**
- [ ] I can edit pending or paused messages only (not processing)
- [ ] Edited messages show an "edited" indicator
- [ ] Edit is blocked with an error if another tab has modified it (optimistic locking)
- [ ] Original position in queue is preserved after edit

### US-04: Remove Queued Messages
**As a** user
**I want to** remove a message from the queue
**So that** I can cancel a thought I no longer want to send

**Acceptance Criteria:**
- [ ] I can remove pending or paused messages only
- [ ] Removed messages disappear from the queue display
- [ ] Subsequent messages shift up in position
- [ ] Removal is immediate (no confirmation modal)

### US-05: View Queue Status
**As a** user
**I want to** see which message is currently executing and which are waiting
**So that** I can understand the processing progress

**Acceptance Criteria:**
- [ ] Queue displays above ChatInput as a stack (bottom-to-top order)
- [ ] Currently executing message shows a loading indicator
- [ ] Queue position is visible for each pending message
- [ ] Queue updates in real-time as messages complete

### US-06: Automatic Queue Processing
**As a** user
**I want to** have the next queued message automatically execute when the current one finishes
**So that** I don't have to manually trigger each message

**Acceptance Criteria:**
- [ ] When agent stream emits `[DONE]`, next pending message executes
- [ ] Paused messages are skipped
- [ ] Queue empties naturally as all messages complete
- [ ] If all messages are paused, execution stops until one is resumed

---

## Pre-Implementation

- [ ] Verify development environment setup
  - Files: N/A
  - Acceptance: `make install` completes, Redis is running

- [ ] Create feature branch: `feature/message-queue-system`
  - Files: N/A
  - Acceptance: Branch created from `development`

- [ ] Review `REVIEW.md` council decisions
  - Files: `.claude/specs/message-queue-system/REVIEW.md`
  - Acceptance: Understand mandatory conditions before coding

---

## Phase 1: Backend Foundation (TDD)

### 1.1 Redis Connection Pool

- [ ] Create Redis connection pool singleton
  - Files: `backend/src/utils/redis_pool.py`
  - Acceptance: Pool reuses connections, configurable via env vars
  - Test first: `test_redis_pool_reuses_connections()`

- [ ] Add pool configuration constants
  - Files: `backend/src/constants/__init__.py`
  - Acceptance: `REDIS_POOL_MAX_CONNECTIONS`, `REDIS_POOL_MIN_CONNECTIONS` defined
  - Test first: Constants importable with default values

### 1.2 Pydantic Schemas (Test First)

- [ ] Create schema test file
  - Files: `backend/tests/unit/schemas/test_queue_schemas.py`
  - Acceptance: Tests for all schema validations defined before schemas

- [ ] Define `QueueItemStatus` enum
  - Files: `backend/src/schemas/entities/queue.py`
  - Acceptance: Values: `pending`, `processing`, `paused`, `completed`, `failed`, `cancelled`
  - Test: `test_queue_item_status_enum_values()`

- [ ] Define `QueueStatus` enum
  - Files: `backend/src/schemas/entities/queue.py`
  - Acceptance: Values: `idle`, `processing`, `paused`
  - Test: `test_queue_status_enum_values()`

- [ ] Define `QueuedMessage` model
  - Files: `backend/src/schemas/entities/queue.py`
  - Acceptance: Fields: `id`, `content`, `status`, `position`, `version`, `created_at`, `updated_at`, `metadata`
  - Test: `test_queued_message_defaults()`, `test_queued_message_version_increment()`

- [ ] Define `QueueState` model
  - Files: `backend/src/schemas/entities/queue.py`
  - Acceptance: Fields: `thread_id`, `user_id`, `status`, `messages`, `current_message_id`
  - Test: `test_queue_state_get_next_pending()`

- [ ] Define request/response models
  - Files: `backend/src/schemas/entities/queue.py`
  - Acceptance: `QueueAddRequest`, `QueueUpdateRequest`, `QueueReorderRequest`, `QueueListResponse`, `QueueStatusResponse`
  - Test: `test_queue_add_request_validation()`, `test_queue_update_requires_field()`

- [ ] Export schemas from entities `__init__.py`
  - Files: `backend/src/schemas/entities/__init__.py`
  - Acceptance: All queue schemas importable from `src.schemas.entities`

### 1.3 Exception Hierarchy

- [ ] Add queue exception classes
  - Files: `backend/src/services/errors.py`
  - Acceptance: `QueueError`, `RetryableQueueError`, `PermanentQueueError`, `ConcurrentModificationError`
  - Test first: `test_queue_error_sanitizes_redis_url()`

### 1.4 QueueService Core (Test First)

- [ ] Create service test file
  - Files: `backend/tests/unit/services/test_queue_service.py`
  - Acceptance: Test classes for authorization, CRUD, edge cases

- [ ] Implement `QueueService.__init__` with dependency injection
  - Files: `backend/src/services/queue.py`
  - Acceptance: Accepts `user_id`, `store`, follows `AbortService` pattern
  - Test: `test_queue_service_init()`

- [ ] Implement `get_queue_state(thread_id)`
  - Files: `backend/src/services/queue.py`
  - Acceptance: Returns `QueueState` from Redis, empty if no queue
  - Test: `test_get_queue_state_empty()`, `test_get_queue_state_with_items()`

- [ ] Implement `add_message(thread_id, content, metadata)`
  - Files: `backend/src/services/queue.py`
  - Acceptance: Creates `QueuedMessage` in Redis ZSET, verifies thread ownership
  - Test: `test_add_message_creates_item()`, `test_add_message_verifies_ownership()`

- [ ] Implement `update_message(thread_id, message_id, content, position)`
  - Files: `backend/src/services/queue.py`
  - Acceptance: Updates item, checks optimistic lock version, only pending/paused
  - Test: `test_update_message_changes_content()`, `test_update_rejects_processing_item()`, `test_update_rejects_stale_version()`

- [ ] Implement `remove_message(thread_id, message_id)`
  - Files: `backend/src/services/queue.py`
  - Acceptance: Removes from ZSET, only pending/paused
  - Test: `test_remove_message_deletes_item()`, `test_remove_rejects_processing_item()`

- [ ] Implement `pause_message(thread_id, message_id)`
  - Files: `backend/src/services/queue.py`
  - Acceptance: Sets status to `paused`, only from `pending`
  - Test: `test_pause_message_changes_status()`

- [ ] Implement `resume_message(thread_id, message_id)`
  - Files: `backend/src/services/queue.py`
  - Acceptance: Sets status to `pending`, only from `paused`
  - Test: `test_resume_message_changes_status()`

- [ ] Implement authorization verification
  - Files: `backend/src/services/queue.py`
  - Acceptance: Verifies `user_id` matches thread owner, raises `PermissionError`
  - Test: `test_queue_service_rejects_unauthorized_user()`

### 1.5 Static Worker Methods

- [ ] Implement `pop_next_message(thread_id)` with Lua script
  - Files: `backend/src/services/queue.py`
  - Acceptance: Atomic check pause + pop + status update, returns `QueuedMessage` or None
  - Test: `test_pop_next_returns_pending()`, `test_pop_next_skips_paused()`, `test_pop_next_atomic_with_pause()`

- [ ] Implement `complete_message(thread_id, message_id, success)`
  - Files: `backend/src/services/queue.py`
  - Acceptance: Marks `completed` or `failed`, resets queue status if empty
  - Test: `test_complete_message_marks_status()`

- [ ] Implement `has_pending_messages(thread_id)`
  - Files: `backend/src/services/queue.py`
  - Acceptance: Returns bool, checks for pending items
  - Test: `test_has_pending_messages()`

---

## Phase 2: Worker Integration (TDD)

### 2.1 Queue Check on [DONE]

- [ ] Create worker integration test file
  - Files: `backend/tests/integration/test_queue_flow.py`
  - Acceptance: Tests for [DONE] triggering next message

- [ ] Modify `run_agent_stream` to check queue on completion
  - Files: `backend/src/workers/tasks.py`
  - Acceptance: After [DONE], calls `pop_next_message()`, self-chains if found
  - Test: `test_done_triggers_next_queue_item()`

- [ ] Track current processing message ID
  - Files: `backend/src/workers/tasks.py`
  - Acceptance: Pass message_id through task, call `complete_message()` on finish
  - Test: `test_processing_message_tracked()`

### 2.2 Enqueue When Busy

- [ ] Modify `/llm/stream` to enqueue if processing
  - Files: `backend/src/routes/v0/llm.py`
  - Acceptance: If thread queue status is `processing`, add to queue instead of executing
  - Test: `test_stream_enqueues_when_busy()`

---

## Phase 3: API Endpoints (TDD)

### 3.1 Route Setup

- [ ] Create route test file
  - Files: `backend/tests/integration/test_queue_routes.py`
  - Acceptance: Tests for all endpoints with auth

- [ ] Create queue router file
  - Files: `backend/src/routes/v0/queue.py`
  - Acceptance: Router registered with prefix, tagged "Queue"

- [ ] Register router in `__init__.py`
  - Files: `backend/src/routes/v0/__init__.py`
  - Acceptance: Queue routes accessible at `/api/threads/{thread_id}/queue/*`

### 3.2 Endpoints

- [ ] Implement `GET /threads/{thread_id}/queue`
  - Files: `backend/src/routes/v0/queue.py`
  - Acceptance: Returns `QueueListResponse`, requires auth
  - Test: `test_get_queue_returns_list()`, `test_get_queue_requires_auth()`

- [ ] Implement `POST /threads/{thread_id}/queue`
  - Files: `backend/src/routes/v0/queue.py`
  - Acceptance: Accepts `QueueAddRequest`, returns `QueuedMessage`, 201 status
  - Test: `test_add_to_queue_creates_item()`, `test_add_to_queue_401_without_auth()`

- [ ] Implement `PATCH /threads/{thread_id}/queue/{queue_id}`
  - Files: `backend/src/routes/v0/queue.py`
  - Acceptance: Accepts `QueueUpdateRequest`, returns updated item
  - Test: `test_update_queue_item()`, `test_update_queue_item_409_version_conflict()`

- [ ] Implement `DELETE /threads/{thread_id}/queue/{queue_id}`
  - Files: `backend/src/routes/v0/queue.py`
  - Acceptance: Returns 204, item removed
  - Test: `test_delete_queue_item()`, `test_delete_queue_item_400_if_processing()`

- [ ] Implement `POST /threads/{thread_id}/queue/{queue_id}/pause`
  - Files: `backend/src/routes/v0/queue.py`
  - Acceptance: Returns `QueueStatusResponse`
  - Test: `test_pause_queue_item()`

- [ ] Implement `POST /threads/{thread_id}/queue/{queue_id}/resume`
  - Files: `backend/src/routes/v0/queue.py`
  - Acceptance: Returns `QueueStatusResponse`
  - Test: `test_resume_queue_item()`

- [ ] Implement `POST /threads/{thread_id}/queue/reorder`
  - Files: `backend/src/routes/v0/queue.py`
  - Acceptance: Accepts `QueueReorderRequest`, returns updated queue
  - Test: `test_reorder_queue()`

### 3.3 SSE Queue Events

- [ ] Add queue event types to stream
  - Files: `backend/src/utils/stream.py`
  - Acceptance: `queue:added`, `queue:removed`, `queue:executing`, `queue:sync` emitted
  - Test: `test_stream_emits_queue_executing_event()`

---

## Phase 4: Frontend Integration

### 4.1 TypeScript Types

- [ ] Create queue entity types
  - Files: `frontend/src/lib/entities/queue.ts`
  - Acceptance: Types match backend Pydantic schemas

- [ ] Export from entities index
  - Files: `frontend/src/lib/entities/index.ts`
  - Acceptance: All queue types importable

- [ ] Add queue SSE event types
  - Files: `frontend/src/lib/entities/stream.ts`
  - Acceptance: `QueueSSEEventType`, `isQueueSSEEvent` type guard

### 4.2 Service Layer

- [ ] Create queue service
  - Files: `frontend/src/lib/services/queueService.ts`
  - Acceptance: Functions: `getQueue`, `addToQueue`, `updateQueueItem`, `removeFromQueue`, `pauseQueueItem`, `resumeQueueItem`, `reorderQueue`

- [ ] Export from services index
  - Files: `frontend/src/lib/services/index.ts`
  - Acceptance: All queue functions importable

### 4.3 React Components

- [ ] Create `useMessageQueue` hook
  - Files: `frontend/src/hooks/useMessageQueue.ts`
  - Acceptance: Manages queue state, provides CRUD operations, handles SSE events

- [ ] Create `QueuePanel` component
  - Files: `frontend/src/components/queue/QueuePanel.tsx`
  - Acceptance: Displays above ChatInput, shows stacked messages bottom-to-top

- [ ] Create `QueueItem` component
  - Files: `frontend/src/components/queue/QueueItem.tsx`
  - Acceptance: Shows content, status, edit/pause/remove buttons

- [ ] Integrate `QueuePanel` into `ChatInput`
  - Files: `frontend/src/components/inputs/ChatInput.tsx`
  - Acceptance: Panel appears above input when queue has items

- [ ] Handle queue SSE events in `useChat`
  - Files: `frontend/src/hooks/useChat.ts`
  - Acceptance: Updates queue state on `queue:*` events

### 4.4 UI Validation

- [ ] Validate queue display with screenshot
  - Files: N/A (use dev-browser skill)
  - Acceptance: Queued messages visible above ChatInput, stacked bottom-to-top

- [ ] Validate edit mode with screenshot
  - Files: N/A (use dev-browser skill)
  - Acceptance: Edit UI shows, blocks queue processing

- [ ] Validate pause/resume with screenshot
  - Files: N/A (use dev-browser skill)
  - Acceptance: Paused items show indicator, skipped during processing

---

## Phase 5: Hardening

### 5.1 Resilience

- [ ] Implement circuit breaker for Redis
  - Files: `backend/src/services/queue.py`
  - Acceptance: Opens after 5 failures, closes after 30s recovery
  - Test: `test_circuit_breaker_opens_on_failures()`

- [ ] Implement in-memory fallback (sync mode only)
  - Files: `backend/src/services/queue_fallback.py`
  - Acceptance: Uses `asyncio.PriorityQueue`, activated when Redis unavailable
  - Test: `test_fallback_used_when_redis_down()`

### 5.2 Security

- [ ] Add rate limiting to queue endpoints
  - Files: `backend/src/routes/v0/queue.py`
  - Acceptance: 60/minute enqueue, 120/minute aggregate per user
  - Test: `test_queue_rate_limiting()`

- [ ] Add max queue length enforcement
  - Files: `backend/src/services/queue.py`
  - Acceptance: Reject with 400 if queue has 50+ items
  - Test: `test_queue_rejects_when_full()`

### 5.3 Cleanup

- [ ] Implement stale item cleanup task
  - Files: `backend/src/workers/tasks.py`
  - Acceptance: Periodic task removes items older than 24h
  - Test: `test_cleanup_removes_stale_items()`

---

## Verification

- [ ] All unit tests passing
  - Command: `cd backend && pytest tests/unit -v`
  - Acceptance: 0 failures

- [ ] All integration tests passing
  - Command: `cd backend && pytest tests/integration -v`
  - Acceptance: 0 failures

- [ ] Linting/formatting clean
  - Command: `make format && make lint`
  - Acceptance: No errors

- [ ] Full test suite
  - Command: `make test`
  - Acceptance: All tests pass

- [ ] Self-review against REVIEW.md
  - Files: `.claude/specs/message-queue-system/REVIEW.md`
  - Acceptance: All mandatory conditions met

- [ ] Ready for PR
  - Acceptance: Feature branch has clean commits, PR description ready

---

## Completion Signature

- **Total Tasks:** 65
- **Phases:** 5
- **Dependencies:** Redis (existing), TaskIQ (existing)

---

## curl Validation Commands

```bash
# Get auth token
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "test1234"}' \
  | jq -r '.access_token')

# Create thread
THREAD_ID=$(curl -s -X POST http://localhost:8000/api/threads \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"metadata": {}}' | jq -r '.thread_id')

# Add to queue
curl -s -X POST "http://localhost:8000/api/threads/$THREAD_ID/queue" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "First queued message"}' | jq

# List queue
curl -s -X GET "http://localhost:8000/api/threads/$THREAD_ID/queue" \
  -H "Authorization: Bearer $TOKEN" | jq

# Pause item
QUEUE_ID="<id from list>"
curl -s -X POST "http://localhost:8000/api/threads/$THREAD_ID/queue/$QUEUE_ID/pause" \
  -H "Authorization: Bearer $TOKEN" | jq

# Resume item
curl -s -X POST "http://localhost:8000/api/threads/$THREAD_ID/queue/$QUEUE_ID/resume" \
  -H "Authorization: Bearer $TOKEN" | jq

# Edit item
curl -s -X PATCH "http://localhost:8000/api/threads/$THREAD_ID/queue/$QUEUE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Updated message content"}' | jq

# Remove item
curl -s -X DELETE "http://localhost:8000/api/threads/$THREAD_ID/queue/$QUEUE_ID" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `backend/src/utils/redis_pool.py` | CREATE |
| `backend/src/schemas/entities/queue.py` | CREATE |
| `backend/src/schemas/entities/__init__.py` | MODIFY |
| `backend/src/services/queue.py` | CREATE |
| `backend/src/services/queue_fallback.py` | CREATE |
| `backend/src/services/errors.py` | MODIFY |
| `backend/src/routes/v0/queue.py` | CREATE |
| `backend/src/routes/v0/__init__.py` | MODIFY |
| `backend/src/routes/v0/llm.py` | MODIFY |
| `backend/src/workers/tasks.py` | MODIFY |
| `backend/src/utils/stream.py` | MODIFY |
| `backend/src/constants/__init__.py` | MODIFY |
| `backend/tests/unit/schemas/test_queue_schemas.py` | CREATE |
| `backend/tests/unit/services/test_queue_service.py` | CREATE |
| `backend/tests/integration/test_queue_routes.py` | CREATE |
| `backend/tests/integration/test_queue_flow.py` | CREATE |
| `frontend/src/lib/entities/queue.ts` | CREATE |
| `frontend/src/lib/entities/index.ts` | MODIFY |
| `frontend/src/lib/entities/stream.ts` | MODIFY |
| `frontend/src/lib/services/queueService.ts` | CREATE |
| `frontend/src/lib/services/index.ts` | MODIFY |
| `frontend/src/hooks/useMessageQueue.ts` | CREATE |
| `frontend/src/components/queue/QueuePanel.tsx` | CREATE |
| `frontend/src/components/queue/QueueItem.tsx` | CREATE |
| `frontend/src/components/inputs/ChatInput.tsx` | MODIFY |
| `frontend/src/hooks/useChat.ts` | MODIFY |

---

## Ralph Instructions

1. Work on the next incomplete criterion (marked `[ ]`)
2. Check off completed criteria (change `[ ]` to `[x]`)
3. Run `make test` after changes to verify unit tests pass
4. Run `make format` to ensure code style compliance
5. Commit your changes frequently with descriptive messages
6. When ALL criteria are `[x]`, output: `<ralph>COMPLETE</ralph>`
7. If stuck on the same issue 3+ times, output: `<ralph>GUTTER</ralph>`
