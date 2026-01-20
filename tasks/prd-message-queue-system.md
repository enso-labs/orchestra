# PRD: Message Queue System for DeepAgents

## Introduction

Implement a backend-driven message queue system that allows users to submit multiple messages while the DeepAgent is processing a response. Messages are queued in Redis and execute sequentially as each completes. Users can view, pause, edit, remove, and reorder queued messages through a visual panel above the chat input.

This feature solves the common user frustration of waiting for an AI response before submitting follow-up thoughts, enabling a more natural "brain dump" workflow where users can capture multiple ideas quickly.

## Goals

- Allow users to submit messages while the agent is actively processing
- Persist queue state in Redis across page refreshes and sessions
- Provide full queue control: pause, resume, edit, remove, reorder
- Display queue status in real-time via SSE events
- Maintain security through user-scoped namespacing and authorization
- Support distributed multi-instance deployment (Redis required)

## User Stories

### US-001: Queue Messages While Processing
**Description:** As a user, I want to submit multiple messages without waiting for the current response to complete so that I can capture my thoughts quickly and have them processed sequentially.

**Acceptance Criteria:**
- [ ] Messages submitted while agent is processing are added to Redis queue
- [ ] Queue persists across page refreshes (stored in Redis, not local state)
- [ ] User sees queued messages displayed above the chat input
- [ ] Messages execute in FIFO order as each completes
- [ ] Queue key uses pattern `queue:{user_id}:{thread_id}:*` for security
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-002: Pause Queued Messages
**Description:** As a user, I want to pause a queued message to prevent it from executing so that I can reconsider whether I want to send that thought.

**Acceptance Criteria:**
- [ ] Pause button visible on pending queue items
- [ ] Paused messages remain in queue but are skipped during processing
- [ ] Paused messages show visual indicator (different color/icon)
- [ ] Resume button appears on paused messages
- [ ] Pause state persists across page refreshes
- [ ] Only pending messages can be paused (not processing/completed)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-003: Edit Queued Messages
**Description:** As a user, I want to edit the content of a queued message before it executes so that I can refine my thoughts while waiting.

**Acceptance Criteria:**
- [ ] Edit button visible on pending and paused messages only
- [ ] Edit mode shows inline text editor with current content
- [ ] Save and Cancel buttons in edit mode
- [ ] Edited messages show "edited" indicator
- [ ] Edit blocked with error toast if another tab modified (version conflict)
- [ ] Original position in queue preserved after edit
- [ ] Processing messages cannot be edited
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-004: Remove Queued Messages
**Description:** As a user, I want to remove a message from the queue so that I can cancel a thought I no longer want to send.

**Acceptance Criteria:**
- [ ] Remove/delete button visible on pending and paused messages
- [ ] Removed messages disappear immediately from queue display
- [ ] Subsequent messages shift up in position automatically
- [ ] Removal is immediate (no confirmation modal required)
- [ ] Processing messages cannot be removed
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: View Queue Status
**Description:** As a user, I want to see which message is currently executing and which are waiting so that I can understand the processing progress.

**Acceptance Criteria:**
- [ ] Queue panel displays above ChatInput as a stack (bottom-to-top order)
- [ ] Currently executing message shows loading/spinner indicator
- [ ] Queue position number visible for each pending message
- [ ] Status badges: pending (default), processing (spinner), paused (gray)
- [ ] Queue updates in real-time via SSE events
- [ ] Panel collapses/hides when queue is empty
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-006: Automatic Queue Processing
**Description:** As a user, I want the next queued message to automatically execute when the current one finishes so that I don't have to manually trigger each message.

**Acceptance Criteria:**
- [ ] When agent stream emits `[DONE]`, worker checks for next pending message
- [ ] Next pending message automatically starts processing (self-chain)
- [ ] Paused messages are skipped in processing order
- [ ] Queue empties naturally as all messages complete
- [ ] If all remaining messages are paused, execution stops until one is resumed
- [ ] Resuming a paused message triggers processing if queue was idle
- [ ] Typecheck/lint passes

## Functional Requirements

### Queue Management
- FR-1: Store queue data in Redis using sorted set (ZSET) with timestamp scores for FIFO ordering
- FR-2: Use key pattern `queue:{user_id}:{thread_id}:messages` for the queue ZSET
- FR-3: Store full item payloads in `queue:{user_id}:{thread_id}:items:{id}` hashes
- FR-4: Track queue status in `queue:{user_id}:{thread_id}:status` (idle/processing/paused)
- FR-5: Enforce maximum queue length of 50 items per thread
- FR-6: Apply 24-hour TTL to queue items for automatic cleanup

### Queue Item States
- FR-7: Support states: `pending`, `processing`, `paused`, `completed`, `failed`, `cancelled`
- FR-8: Valid transitions: pending→processing, pending→paused, paused→pending, processing→completed/failed
- FR-9: Include `version` field on items for optimistic locking (increment on each update)

### API Endpoints
- FR-10: `GET /threads/{thread_id}/queue` - List all queued messages
- FR-11: `POST /threads/{thread_id}/queue` - Add message to queue (returns 201)
- FR-12: `GET /threads/{thread_id}/queue/{queue_id}` - Get specific message
- FR-13: `PATCH /threads/{thread_id}/queue/{queue_id}` - Edit message content/position
- FR-14: `DELETE /threads/{thread_id}/queue/{queue_id}` - Remove message (returns 204)
- FR-15: `POST /threads/{thread_id}/queue/{queue_id}/pause` - Pause message
- FR-16: `POST /threads/{thread_id}/queue/{queue_id}/resume` - Resume message
- FR-17: `POST /threads/{thread_id}/queue/reorder` - Bulk reorder messages

### Worker Integration
- FR-18: On `[DONE]` signal, worker calls atomic Lua script to pop next pending message
- FR-19: Lua script atomically: check pause flag → verify status → update to processing → return item
- FR-20: Worker self-chains via `kiq()` to process next message if found
- FR-21: Mark message as `completed` or `failed` after processing

### Real-time Updates
- FR-22: Emit SSE events for queue changes: `queue:added`, `queue:removed`, `queue:updated`
- FR-23: Emit `queue:executing` when next message starts processing
- FR-24: Emit `queue:paused` and `queue:resumed` for status changes
- FR-25: Emit `queue:sync` with full state on SSE reconnection

### Authorization
- FR-26: Verify user owns thread before any queue operation
- FR-27: Include `user_id` in Redis key namespace to prevent IDOR attacks
- FR-28: Return 403 Forbidden for unauthorized access attempts

### Error Handling
- FR-29: Return 409 Conflict when edit version doesn't match (optimistic lock failure)
- FR-30: Return 400 Bad Request when attempting to modify processing items
- FR-31: Return 400 Bad Request when queue is full (50+ items)

## Non-Goals (Out of Scope)

- **In-memory fallback**: No fallback when Redis is unavailable (multi-instance deployment requires Redis)
- **Circuit breaker**: Deferred to post-MVP hardening phase
- **Rate limiting**: Deferred to post-MVP (60/min enqueue, 120/min aggregate)
- **Conflict resolution UI**: No "their changes vs your changes" dialog - just error toast
- **Queue analytics**: No tracking of queue usage patterns or metrics
- **Cross-thread queues**: Each queue is scoped to a single thread
- **Priority levels**: All messages are equal priority, FIFO only
- **Scheduled messages**: No "send at time X" functionality
- **Message templates**: No saved/reusable message templates

## Design Considerations

### Queue Panel UI
- Position: Above ChatInput component, below message list
- Layout: Vertical stack with newest at bottom (matches chat flow)
- Item display: Message preview (truncated), status badge, action buttons
- Actions: Edit (pencil icon), Pause/Resume (pause/play icon), Remove (X icon)
- Indicators: Position number, "edited" badge, loading spinner for processing

### Visual States
| State | Background | Badge | Actions Available |
|-------|-----------|-------|-------------------|
| Pending | Default | Blue "Pending" | Edit, Pause, Remove |
| Processing | Highlighted | Spinner "Processing" | None |
| Paused | Muted/Gray | Gray "Paused" | Edit, Resume, Remove |

### Existing Components to Reuse
- Badge component for status indicators
- Button components for actions
- Toast system for error notifications
- SSE handling from existing `useChat` hook

## Technical Considerations

### Redis Data Structure
```
queue:{user_id}:{thread_id}:messages     # ZSET - score=timestamp, member=item_id
queue:{user_id}:{thread_id}:items:{id}   # Hash - full item payload
queue:{user_id}:{thread_id}:status       # String - "idle" | "processing" | "paused"
queue:{user_id}:{thread_id}:current      # String - current processing item_id
queue:{user_id}:{thread_id}:lock         # String - worker_id (30s TTL for crash recovery)
```

### Atomic Dequeue Lua Script
Required to prevent race condition between `[DONE]` signal and pause action:
```lua
-- KEYS[1] = queue ZSET, KEYS[2] = pause flag, KEYS[3] = item hash prefix
local paused = redis.call('GET', KEYS[2])
if paused == '1' then return nil end
local items = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
if #items == 0 then return nil end
local item_id = items[1]
-- ... verify status, update to processing, return item
```

### Dependencies
- Redis (existing infrastructure via `broker.py`, `stream.py`)
- TaskIQ workers (existing via `tasks.py`)
- SSE streaming (existing via `stream.py`)
- Pydantic for schemas (existing pattern)

### Key Files to Create
| File | Purpose |
|------|---------|
| `backend/src/utils/redis_pool.py` | Connection pool singleton |
| `backend/src/schemas/entities/queue.py` | Pydantic models |
| `backend/src/services/queue.py` | QueueService class |
| `backend/src/routes/v0/queue.py` | REST endpoints |
| `frontend/src/lib/entities/queue.ts` | TypeScript types |
| `frontend/src/lib/services/queueService.ts` | API client |
| `frontend/src/hooks/useMessageQueue.ts` | React state hook |
| `frontend/src/components/queue/QueuePanel.tsx` | Queue display |
| `frontend/src/components/queue/QueueItem.tsx` | Individual item |

### Key Files to Modify
| File | Change |
|------|--------|
| `backend/src/workers/tasks.py` | Check queue on `[DONE]`, self-chain |
| `backend/src/routes/v0/llm.py` | Enqueue if thread is busy |
| `backend/src/utils/stream.py` | Add queue SSE event types |
| `frontend/src/components/inputs/ChatInput.tsx` | Integrate QueuePanel |
| `frontend/src/hooks/useChat.ts` | Handle queue SSE events |

## Success Metrics

- Users can submit messages while agent is processing without errors
- Queue state persists correctly across page refreshes (100% reliability)
- Optimistic locking prevents data corruption from concurrent edits
- Queue operations complete in <100ms (Redis latency)
- SSE events update UI within 500ms of backend state change
- No IDOR vulnerabilities (user-scoped namespacing verified)

## Open Questions

1. **Resolved**: Optimistic lock conflicts show error toast, user must refresh (per user decision)
2. **Resolved**: Multi-instance deployment only, no in-memory fallback (per user decision)
3. Should there be a visual/audio notification when a queued message starts processing?
4. Should the queue panel be collapsible/minimizable by the user?
5. What happens to the queue if the user navigates away and back - should we show a "queue restored" notification?

---

## Implementation Phases

### Phase 1: Backend Foundation (TDD)
- Redis connection pool singleton
- Pydantic schemas for queue entities
- Exception hierarchy (QueueError, ConcurrentModificationError)
- QueueService core methods with unit tests

### Phase 2: Worker Integration
- Atomic dequeue Lua script
- Modify `run_agent_stream` to check queue on `[DONE]`
- Modify `/llm/stream` to enqueue when busy
- Integration tests for queue flow

### Phase 3: API Endpoints
- REST routes for all queue operations
- Authorization checks on all endpoints
- SSE event emission for queue changes

### Phase 4: cURL Workflow Validation (REQUIRED GATE)

**IMPORTANT:** This phase is a mandatory gate before any frontend work begins. All API endpoints must be validated via cURL workflows to ensure:
1. Backend tests that passed actually validate real API behavior
2. Response schemas match expected contracts
3. Error handling works correctly (401, 403, 409, 400)
4. The frontend can be built against a stable, verified API

**Validation Checklist:**
- [ ] All cURL commands execute successfully against running backend
- [ ] Response bodies match Pydantic schema definitions
- [ ] Authorization failures return correct status codes
- [ ] Optimistic locking conflicts return 409
- [ ] Invalid state transitions return 400

**cURL Validation Script:**
```bash
#!/bin/bash
# Run from project root with backend running on localhost:8000

set -e  # Exit on first failure

echo "=== Queue API cURL Validation ==="

# 1. Get auth token
echo "\n[1/12] Authenticating..."
TOKEN=$(curl -sf -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "test1234"}' \
  | jq -r '.access_token')
[ -n "$TOKEN" ] && echo "OK: Got auth token" || { echo "FAIL: Auth failed"; exit 1; }

# 2. Create test thread
echo "\n[2/12] Creating test thread..."
THREAD_ID=$(curl -sf -X POST http://localhost:8000/api/threads \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"metadata": {"test": true}}' | jq -r '.thread_id')
[ -n "$THREAD_ID" ] && echo "OK: Created thread $THREAD_ID" || { echo "FAIL: Thread creation failed"; exit 1; }

# 3. GET empty queue (should return empty list)
echo "\n[3/12] GET /threads/{thread_id}/queue (empty)..."
QUEUE_LIST=$(curl -sf -X GET "http://localhost:8000/api/threads/$THREAD_ID/queue" \
  -H "Authorization: Bearer $TOKEN")
[ "$(echo $QUEUE_LIST | jq '.messages | length')" -eq 0 ] && echo "OK: Empty queue" || { echo "FAIL: Expected empty queue"; exit 1; }

# 4. POST add first message to queue
echo "\n[4/12] POST /threads/{thread_id}/queue (add message)..."
ITEM1=$(curl -sf -X POST "http://localhost:8000/api/threads/$THREAD_ID/queue" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "First queued message"}' \
  -w "\n%{http_code}" | { read body; read code; [ "$code" = "201" ] && echo "$body"; })
QUEUE_ID1=$(echo $ITEM1 | jq -r '.id')
[ -n "$QUEUE_ID1" ] && echo "OK: Created queue item $QUEUE_ID1" || { echo "FAIL: POST returned unexpected response"; exit 1; }

# 5. POST add second message
echo "\n[5/12] POST /threads/{thread_id}/queue (add second message)..."
ITEM2=$(curl -sf -X POST "http://localhost:8000/api/threads/$THREAD_ID/queue" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Second queued message"}')
QUEUE_ID2=$(echo $ITEM2 | jq -r '.id')
[ -n "$QUEUE_ID2" ] && echo "OK: Created queue item $QUEUE_ID2" || { echo "FAIL: Second POST failed"; exit 1; }

# 6. GET queue list (should have 2 items)
echo "\n[6/12] GET /threads/{thread_id}/queue (verify 2 items)..."
QUEUE_LIST=$(curl -sf -X GET "http://localhost:8000/api/threads/$THREAD_ID/queue" \
  -H "Authorization: Bearer $TOKEN")
[ "$(echo $QUEUE_LIST | jq '.messages | length')" -eq 2 ] && echo "OK: Queue has 2 items" || { echo "FAIL: Expected 2 items"; exit 1; }

# 7. GET specific queue item
echo "\n[7/12] GET /threads/{thread_id}/queue/{queue_id}..."
ITEM_GET=$(curl -sf -X GET "http://localhost:8000/api/threads/$THREAD_ID/queue/$QUEUE_ID1" \
  -H "Authorization: Bearer $TOKEN")
[ "$(echo $ITEM_GET | jq -r '.id')" = "$QUEUE_ID1" ] && echo "OK: Got specific item" || { echo "FAIL: GET item failed"; exit 1; }

# 8. PATCH edit message content
echo "\n[8/12] PATCH /threads/{thread_id}/queue/{queue_id} (edit)..."
VERSION=$(echo $ITEM_GET | jq -r '.version')
EDITED=$(curl -sf -X PATCH "http://localhost:8000/api/threads/$THREAD_ID/queue/$QUEUE_ID1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"content\": \"Edited message content\", \"expected_version\": $VERSION}")
[ "$(echo $EDITED | jq -r '.content')" = "Edited message content" ] && echo "OK: Edit successful" || { echo "FAIL: Edit failed"; exit 1; }

# 9. PATCH with wrong version (expect 409)
echo "\n[9/12] PATCH with stale version (expect 409 Conflict)..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "http://localhost:8000/api/threads/$THREAD_ID/queue/$QUEUE_ID1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"content\": \"Should fail\", \"expected_version\": $VERSION}")
[ "$HTTP_CODE" = "409" ] && echo "OK: Got 409 Conflict" || { echo "FAIL: Expected 409, got $HTTP_CODE"; exit 1; }

# 10. POST pause message
echo "\n[10/12] POST /threads/{thread_id}/queue/{queue_id}/pause..."
PAUSED=$(curl -sf -X POST "http://localhost:8000/api/threads/$THREAD_ID/queue/$QUEUE_ID1/pause" \
  -H "Authorization: Bearer $TOKEN")
[ "$(echo $PAUSED | jq -r '.status')" = "paused" ] && echo "OK: Message paused" || { echo "FAIL: Pause failed"; exit 1; }

# 11. POST resume message
echo "\n[11/12] POST /threads/{thread_id}/queue/{queue_id}/resume..."
RESUMED=$(curl -sf -X POST "http://localhost:8000/api/threads/$THREAD_ID/queue/$QUEUE_ID1/resume" \
  -H "Authorization: Bearer $TOKEN")
[ "$(echo $RESUMED | jq -r '.status')" = "pending" ] && echo "OK: Message resumed" || { echo "FAIL: Resume failed"; exit 1; }

# 12. DELETE remove message
echo "\n[12/12] DELETE /threads/{thread_id}/queue/{queue_id}..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "http://localhost:8000/api/threads/$THREAD_ID/queue/$QUEUE_ID1" \
  -H "Authorization: Bearer $TOKEN")
[ "$HTTP_CODE" = "204" ] && echo "OK: Delete returned 204" || { echo "FAIL: Expected 204, got $HTTP_CODE"; exit 1; }

# Verify deletion
QUEUE_LIST=$(curl -sf -X GET "http://localhost:8000/api/threads/$THREAD_ID/queue" \
  -H "Authorization: Bearer $TOKEN")
[ "$(echo $QUEUE_LIST | jq '.messages | length')" -eq 1 ] && echo "OK: Queue has 1 item after delete" || { echo "FAIL: Delete verification failed"; exit 1; }

echo "\n=== ALL VALIDATIONS PASSED ==="
echo "Frontend development may proceed."
```

**Authorization Validation:**
```bash
# Test 401 Unauthorized (no token)
echo "Testing 401 Unauthorized..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "http://localhost:8000/api/threads/$THREAD_ID/queue")
[ "$HTTP_CODE" = "401" ] && echo "OK: Got 401" || echo "FAIL: Expected 401"

# Test 403 Forbidden (wrong user's thread)
echo "Testing 403 Forbidden..."
# Create second user, get their token, try to access first user's thread
# (Implementation depends on test user setup)
```

**Error Case Validation:**
```bash
# Test 400 Bad Request - modify processing item
# (Requires item to be in processing state - may need worker integration)

# Test 400 Bad Request - queue full (50+ items)
echo "Testing queue limit..."
for i in {1..51}; do
  curl -sf -X POST "http://localhost:8000/api/threads/$THREAD_ID/queue" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"content\": \"Message $i\"}" > /dev/null
done
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:8000/api/threads/$THREAD_ID/queue" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Should fail - queue full"}')
[ "$HTTP_CODE" = "400" ] && echo "OK: Got 400 for full queue" || echo "FAIL: Expected 400"
```

### Phase 5: Frontend Integration
- TypeScript types matching backend schemas
- Queue service API client
- `useMessageQueue` hook for state management
- `QueuePanel` and `QueueItem` components
- Integration into ChatInput and useChat

---

## Phase Gate Rules

| Gate | Condition | Blocks |
|------|-----------|--------|
| **Phase 1 → 2** | Unit tests pass (`pytest tests/unit -v`) | Worker integration |
| **Phase 2 → 3** | Integration tests pass (`pytest tests/integration -v`) | API routes |
| **Phase 3 → 4** | All cURL validations pass | Frontend work |
| **Phase 4 → 5** | cURL script exits with code 0 | Frontend work |

**Rule:** No frontend code may be written until Phase 4 cURL validation completes successfully. This ensures the API contract is stable and verified before UI implementation begins.

---

*Reference: `.claude/specs/message-queue-system/REVIEW.md` for Elite Council technical decisions*
*Reference: `.claude/specs/message-queue-system/TASKS.md` for detailed implementation checklist*

---

## Ralph Instructions

1. Work on the next incomplete criterion (marked `[ ]`)
2. Check off completed criteria (change `[ ]` to `[x]`)
3. Run `make test` after changes to verify unit tests pass
4. Run `make format` to ensure code style compliance
5. Commit your changes frequently with descriptive messages
6. When ALL criteria are `[x]`, output: `<ralph>COMPLETE</ralph>`
7. If stuck on the same issue 3+ times, output: `<ralph>GUTTER</ralph>`