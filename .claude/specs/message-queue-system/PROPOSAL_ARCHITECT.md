# Message Queue System for DeepAgents - Architectural Proposal

**Author:** AGENT_1: ARCHITECT
**Date:** 2026-01-19
**Status:** Draft

---

## 1. Executive Summary

I recommend implementing a **Redis-backed message queue** that extends the existing Redis Streams infrastructure to enable non-blocking message submission. The queue will use a **per-thread queue model** where messages are stored in Redis with state tracking (pending, processing, paused), and a **queue processor service** that monitors for `[DONE]` signals to dequeue and execute the next message. This approach minimizes changes to the existing streaming architecture while providing persistence across agent cycles.

---

## 2. Architectural Analysis

### 2.1 Current State Assessment

The Orchestra codebase already has robust infrastructure that this feature can leverage:

**Backend Infrastructure:**
| Component | File | Purpose | Relevance |
|-----------|------|---------|-----------|
| Redis Broker | `backend/src/workers/broker.py` | TaskIQ Redis Streams broker for distributed workers | Direct integration point - already handles Redis connection lifecycle |
| Stream Utilities | `backend/src/utils/stream.py` | SSE generation and Redis stream consumption | Contains `[DONE]` signal emission (line 336) - key trigger point |
| Abort Service | `backend/src/services/abort.py` | Redis-based abort signal management | Pattern to follow for queue state management |
| Worker Tasks | `backend/src/workers/tasks.py` | Distributed agent execution | Execution entry point - will invoke queue processor |
| Thread Routes | `backend/src/routes/v0/thread.py` | Thread CRUD and streaming endpoints | Will host new queue management endpoints |
| LLM Route | `backend/src/routes/v0/llm.py` | Stream initiation | Modified to enqueue messages |

**Frontend Infrastructure:**
| Component | File | Purpose | Relevance |
|-----------|------|---------|-----------|
| useChat Hook | `frontend/src/hooks/useChat.ts` | Manages streaming and message state | Handles `[DONE]` signal (line 340-346) - triggers queue processing |
| ChatInput | `frontend/src/components/inputs/ChatInput.tsx` | User message submission | UI location for queue display |
| Stream Types | `frontend/src/lib/entities/stream.ts` | SSE event type definitions | Extend for queue events |

**Key Discovery - [DONE] Signal Flow:**
```
Worker Task (tasks.py:297)
    -> Redis Stream entry {"done": "true"}
    -> stream_from_redis (stream.py:336) yields "data: [DONE]\n\n"
    -> Frontend SSE handler (useChat.ts:340) detects "[DONE]" string
    -> setLoading(false), setController(null)
```

This is the critical integration point. When `[DONE]` is received, the frontend stops loading. We will intercept this to trigger queue processing on the backend instead.

### 2.2 Proposed Architecture

```
                                    +------------------+
                                    |   Redis         |
                                    |  +-----------+  |
                                    |  | Message   |  |
                                    |  | Queue     |  |
                                    |  | (Hash)    |  |
                                    |  +-----------+  |
                                    |  +-----------+  |
                                    |  | Queue     |  |
                                    |  | State     |  |
                                    |  | (Sorted)  |  |
                                    |  +-----------+  |
                                    +--------+--------+
                                             |
        +------------------------------------+------------------------------------+
        |                                    |                                    |
+-------v-------+                   +--------v--------+                  +--------v--------+
|   Frontend    |                   |   API Server    |                  | TaskIQ Worker   |
|               |                   |                 |                  |                 |
| ChatInput     | ---enqueue------> | POST /queue     | ---kiq()-------> | run_agent_stream|
| QueuePanel    | <--websub-------- | GET  /queue     |                  |                 |
|               |                   | PATCH /queue/:id|                  | on [DONE] ---+  |
|               |                   | DELETE /queue/:id                  |              |  |
+---------------+                   +-----------------+                  |   dequeue() <+  |
                                                                         | run_agent_stream|
                                                                         +-----------------+
```

**Data Model:**

```
Redis Key: queue:thread:{thread_id}:messages
Type: Sorted Set (ZSET) - score = timestamp for ordering
Member: JSON-encoded queue item

Redis Key: queue:thread:{thread_id}:items:{item_id}
Type: Hash - stores full message payload
Fields: id, content, status, created_at, updated_at, payload

Redis Key: queue:thread:{thread_id}:processing
Type: String - current item_id being processed (for idempotency)
```

**Queue Item States:**
```python
class QueueItemStatus(str, Enum):
    PENDING = "pending"      # Waiting in queue
    PROCESSING = "processing" # Currently being executed
    PAUSED = "paused"        # Blocked from execution
    COMPLETED = "completed"  # Finished (briefly before removal)
    FAILED = "failed"        # Execution failed
```

### 2.3 Integration Points

1. **Message Submission (Enqueue)**
   - `POST /llm/stream` modified to enqueue if queue is non-empty or currently processing
   - New `POST /threads/{thread_id}/queue` for explicit queue additions

2. **Queue Processing (Dequeue)**
   - Worker `run_agent_stream` checks for next item on `[DONE]`
   - Self-invokes `run_agent_stream.kiq()` with next item
   - Emits queue update events to Redis Pub/Sub for real-time UI

3. **Queue Management**
   - `GET /threads/{thread_id}/queue` - list queued messages
   - `PATCH /threads/{thread_id}/queue/{item_id}` - edit/pause message
   - `DELETE /threads/{thread_id}/queue/{item_id}` - remove message

4. **Frontend Integration**
   - New `QueuePanel` component above `ChatInput`
   - Subscribe to Redis Pub/Sub channel for real-time updates
   - Visual queue management (drag to reorder, edit, remove, pause)

---

## 3. Implementation Strategy

### 3.1 Phase 1: Backend Queue Infrastructure (Priority: High)

**New Files:**
```
backend/src/services/queue.py          # Queue service with Redis operations
backend/src/schemas/entities/queue.py  # Pydantic models for queue items
backend/src/routes/v0/queue.py         # REST endpoints for queue management
```

**Modified Files:**
```
backend/src/workers/tasks.py           # Add queue check on completion
backend/src/routes/v0/llm.py           # Modify stream to check queue state
backend/src/workers/broker.py          # Add queue pub/sub channel setup
```

**Queue Service Implementation Pattern:**
```python
# backend/src/services/queue.py
class MessageQueueService:
    """Redis-backed message queue with persistence."""

    QUEUE_PREFIX = "queue:thread:"
    QUEUE_TTL = 86400  # 24 hours

    def __init__(self, thread_id: str, user_id: str):
        self.thread_id = thread_id
        self.user_id = user_id
        self.queue_key = f"{self.QUEUE_PREFIX}{thread_id}:messages"
        self.items_prefix = f"{self.QUEUE_PREFIX}{thread_id}:items:"
        self.processing_key = f"{self.QUEUE_PREFIX}{thread_id}:processing"

    async def enqueue(self, payload: LLMRequest, position: int = None) -> QueueItem:
        """Add message to queue. Position=None appends to end."""

    async def dequeue(self) -> Optional[QueueItem]:
        """Get and mark next pending item as processing."""

    async def peek(self) -> Optional[QueueItem]:
        """View next item without removing."""

    async def update(self, item_id: str, updates: QueueItemUpdate) -> QueueItem:
        """Update item content or status (pause/resume)."""

    async def remove(self, item_id: str) -> bool:
        """Remove item from queue."""

    async def list_items(self, include_completed: bool = False) -> List[QueueItem]:
        """List all queue items ordered by position."""

    async def is_processing(self) -> bool:
        """Check if a message is currently being processed."""

    async def clear_processing(self) -> None:
        """Clear processing flag after completion."""

    @staticmethod
    async def publish_update(thread_id: str, event: QueueEvent) -> None:
        """Publish queue state change to Pub/Sub."""
```

### 3.2 Phase 2: Worker Integration (Priority: High)

**Modify `backend/src/workers/tasks.py`:**

```python
# At the end of _execute_agent_stream, after "Signal completion"
async def _execute_agent_stream(...) -> dict:
    # ... existing streaming code ...

    # Signal completion (existing)
    await redis_client.xadd(stream_key, {"done": "true"})
    await redis_client.expire(stream_key, 300)

    # NEW: Check queue for next message
    from src.services.queue import MessageQueueService

    queue_service = MessageQueueService(thread_id=thread_id, user_id=user_id)
    await queue_service.clear_processing()

    next_item = await queue_service.dequeue()
    if next_item:
        logger.info(f"Queue: processing next item {next_item.id} for thread {thread_id}")

        # Publish queue update event
        await queue_service.publish_update(
            thread_id,
            QueueEvent(type="item_started", item_id=next_item.id)
        )

        # Chain to next execution
        await run_agent_stream.kiq(
            task_dict=next_item.payload,
            user_id=user_id,
            thread_id=thread_id,
        )
    else:
        # Publish queue empty event
        await queue_service.publish_update(
            thread_id,
            QueueEvent(type="queue_empty")
        )

    return {"status": "complete", "stream_key": stream_key}
```

### 3.3 Phase 3: API Endpoints (Priority: Medium)

**New Route File `backend/src/routes/v0/queue.py`:**

```python
router = APIRouter(tags=["Queue"], prefix="/threads/{thread_id}/queue")

@router.get("")
async def list_queue(thread_id: str, user: ProtectedUser = Depends(verify_credentials)):
    """List all queued messages for a thread."""

@router.post("")
async def enqueue_message(
    thread_id: str,
    request: QueueEnqueueRequest,
    user: ProtectedUser = Depends(verify_credentials)
):
    """Add a message to the queue."""

@router.patch("/{item_id}")
async def update_queue_item(
    thread_id: str,
    item_id: str,
    updates: QueueItemUpdate,
    user: ProtectedUser = Depends(verify_credentials)
):
    """Update a queued message (content, position, or status)."""

@router.delete("/{item_id}")
async def remove_queue_item(
    thread_id: str,
    item_id: str,
    user: ProtectedUser = Depends(verify_credentials)
):
    """Remove a message from the queue."""

@router.post("/{item_id}/pause")
async def pause_queue_item(thread_id: str, item_id: str, ...):
    """Pause a queued message (blocks execution but stays in queue)."""

@router.post("/{item_id}/resume")
async def resume_queue_item(thread_id: str, item_id: str, ...):
    """Resume a paused message."""
```

### 3.4 Phase 4: LLM Stream Modification (Priority: Medium)

**Modify `backend/src/routes/v0/llm.py`:**

```python
@llm_router.post("/stream")
async def llm_stream(request: Request, params: LLMRequest, ...):
    """Modified to check queue state before processing."""

    user_id = user.id if user else None
    thread_id = params.metadata.thread_id or str(uuid4())

    # NEW: Check if thread is currently processing
    queue_service = MessageQueueService(thread_id=thread_id, user_id=user_id)

    if await queue_service.is_processing():
        # Thread busy - enqueue this request
        item = await queue_service.enqueue(params)

        return JSONResponse(
            content={
                "queued": True,
                "queue_item_id": item.id,
                "position": item.position,
                "thread_id": thread_id,
            },
            status_code=status.HTTP_202_ACCEPTED,
        )

    # Not processing - proceed normally but mark as processing
    await queue_service.set_processing()

    # ... existing distributed/sync handling ...
```

### 3.5 Phase 5: Frontend Integration (Priority: Medium)

**New Files:**
```
frontend/src/components/queue/QueuePanel.tsx      # Queue display and management
frontend/src/components/queue/QueueItem.tsx       # Individual queue item component
frontend/src/hooks/useMessageQueue.ts             # Queue state management hook
frontend/src/lib/services/queueService.ts         # API client for queue operations
frontend/src/lib/entities/queue.ts                # TypeScript types for queue
```

**Modified Files:**
```
frontend/src/components/inputs/ChatInput.tsx      # Integrate QueuePanel
frontend/src/hooks/useChat.ts                     # Handle queue responses
frontend/src/lib/utils/streamSource.ts            # Add queue event handling
```

**Queue Panel Design (above ChatInput):**
```
+------------------------------------------+
|  Queue (3 pending)                    [x]|
+------------------------------------------+
| [pause] [edit] [x]  "Analyze the data..."| <- drag handle for reorder
| [pause] [edit] [x]  "Generate report..." |
| [pause] [edit] [x]  "Send summary..."    |
+------------------------------------------+
|  [textarea for new message]              |
|  [Send] [Mic]                            |
+------------------------------------------+
```

**Queue Hook Pattern:**
```typescript
// frontend/src/hooks/useMessageQueue.ts
export function useMessageQueue(threadId: string | null) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Subscribe to queue updates via SSE
  useEffect(() => {
    if (!threadId) return;

    const eventSource = new EventSource(
      `${VITE_API_URL}/threads/${threadId}/queue/events`
    );

    eventSource.onmessage = (event) => {
      const update = JSON.parse(event.data);
      handleQueueUpdate(update);
    };

    return () => eventSource.close();
  }, [threadId]);

  // Queue operations
  const enqueue = async (content: string) => { ... };
  const pause = async (itemId: string) => { ... };
  const resume = async (itemId: string) => { ... };
  const edit = async (itemId: string, content: string) => { ... };
  const remove = async (itemId: string) => { ... };
  const reorder = async (itemId: string, newPosition: number) => { ... };

  return { items, isProcessing, enqueue, pause, resume, edit, remove, reorder };
}
```

---

## 4. Design Decisions

### 4.1 Why Redis Sorted Sets + Hashes?

| Alternative | Pros | Cons | Decision |
|-------------|------|------|----------|
| Redis List | Simple FIFO | No random access for edit/remove | Rejected |
| Redis Stream | Built-in ordering, consumer groups | Overkill for queue, complex editing | Rejected |
| **Redis ZSET + Hash** | Ordered by score, random access, atomic ops | Slightly more complex | **Selected** |
| PostgreSQL | Transactional, existing schema | Polling required, latency | Rejected |

**Rationale:** Redis ZSET provides ordered storage (score = enqueue timestamp), while Hash stores full payloads. This allows O(1) position updates via ZADD and efficient range queries for listing.

### 4.2 Why Backend-Driven Queue Processing?

The requirement specifies "backend-driven design (not frontend responsibility)." This means:

1. **[DONE] triggers backend action** - Worker checks queue on completion
2. **Self-chaining execution** - Worker invokes itself for next item
3. **Frontend is observer** - Receives updates via Pub/Sub, doesn't orchestrate

This prevents race conditions where multiple frontend tabs could trigger duplicate executions.

### 4.3 Why Per-Thread Queues vs Global Queue?

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Global Queue | Simpler data model | Concurrent threads conflict, ordering complex | Rejected |
| **Per-Thread Queue** | Natural isolation, clear ownership | Slightly more keys | **Selected** |

**Rationale:** Each thread maintains conversational context. Queuing messages per-thread preserves this context and allows independent processing.

### 4.4 State Persistence Strategy

**Redis with TTL:**
- Queue items expire after 24 hours (configurable)
- Processing flag expires after 30 minutes (prevents zombie locks)
- Aligns with existing abort signal pattern (5-minute TTL)

**No PostgreSQL Storage:**
- Queued messages are transient intent, not conversation history
- Completed messages are stored via existing thread service
- Avoids schema changes and migration complexity

### 4.5 Pause vs Remove Semantics

- **Pause:** Item stays in queue but is skipped during dequeue. User can resume later.
- **Remove:** Item is deleted from queue. Useful for canceling accidental submissions.

Pause is implemented via status field rather than separate data structure.

---

## 5. Risk Assessment

### 5.1 Potential Pitfalls

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Race condition on dequeue** | Duplicate processing | Use Redis WATCH/MULTI for atomic dequeue |
| **Worker crash mid-processing** | Stuck queue | Processing flag TTL (30min) auto-clears |
| **Redis connection failure** | Queue operations fail | Existing resilient connection patterns |
| **Large queue memory usage** | Redis OOM | Per-thread item limit (e.g., 50 items) |
| **Long-running message blocks queue** | User frustration | Timeout with auto-dequeue, skip to next |

### 5.2 Edge Cases

1. **First message on new thread:** No thread_id yet. Generate UUID, include in queued response.
2. **User closes browser mid-queue:** Queue persists in Redis. Resumes on reconnect.
3. **Concurrent submissions from multiple tabs:** All enqueued correctly via atomic ZADD.
4. **Pause then edit:** Allowed. Edit doesn't change pause status.
5. **Remove currently processing item:** Processing continues, but next dequeue skips it.
6. **Empty queue with paused items:** Processing stops. Frontend shows "paused" state.

### 5.3 Testing Considerations

**Unit Tests:**
```
tests/unit/services/test_queue_service.py
- test_enqueue_appends_to_end
- test_enqueue_at_position
- test_dequeue_returns_first_pending
- test_dequeue_skips_paused
- test_update_content
- test_update_position_reorders
- test_remove_deletes_item
- test_concurrent_dequeue_atomic
```

**Integration Tests:**
```
tests/integration/test_queue_flow.py
- test_stream_enqueues_when_busy
- test_done_triggers_next_message
- test_pause_blocks_dequeue
- test_resume_continues_queue
- test_edit_updates_payload
```

**Frontend Tests:**
```
src/tests/hooks/useMessageQueue.test.ts
src/tests/components/QueuePanel.test.tsx
```

---

## 6. Estimated Complexity

| Dimension | Assessment | Notes |
|-----------|------------|-------|
| **Scope** | **Medium** | 3-4 new files backend, 4-5 new files frontend |
| **Risk Level** | **Medium** | Redis patterns well-established, but new state management |
| **Effort** | ~3-4 days | Phase 1-2: 1.5 days, Phase 3-4: 1 day, Phase 5: 1.5 days |

### 6.1 Suggested Implementation Order

1. **Day 1 (Backend Core):**
   - `QueueItem` schema
   - `MessageQueueService` with enqueue/dequeue/list
   - Unit tests for service

2. **Day 2 (Worker Integration):**
   - Modify `run_agent_stream` to check queue on completion
   - Modify `llm_stream` to check processing state
   - Integration test for full flow

3. **Day 3 (API Endpoints):**
   - Queue REST routes (CRUD)
   - Pub/Sub event publishing
   - API tests

4. **Day 4 (Frontend):**
   - `useMessageQueue` hook
   - `QueuePanel` component
   - Integration with `ChatInput`
   - UI tests

---

## 7. Appendix: Key Code References

### 7.1 Existing [DONE] Signal Emission

**`backend/src/utils/stream.py:336`**
```python
if b"done" in data:
    yield "data: [DONE]\n\n"
    return
```

### 7.2 Existing [DONE] Signal Handling

**`frontend/src/hooks/useChat.ts:340`**
```typescript
if (e.data === "[DONE]") {
    console.log("Stream complete: [DONE] received");
    source.close();
    setController(null);
    setLoading(false);
    return;
}
```

### 7.3 Existing Abort Signal Pattern

**`backend/src/services/abort.py:149-166`**
```python
async def _set_abort_signal(self, thread_id: str) -> None:
    redis_client = redis.from_url(REDIS_URL)
    try:
        key = f"{ABORT_SIGNAL_PREFIX}{thread_id}"
        signal_data = {
            "requested_by": self.user_id,
            "requested_at": datetime.now(timezone.utc).isoformat(),
        }
        await redis_client.set(key, json.dumps(signal_data), ex=ABORT_SIGNAL_TTL)
    finally:
        await redis_client.aclose()
```

### 7.4 Worker Task Self-Invocation Pattern

**`backend/src/routes/v0/llm.py:110-114`**
```python
await run_agent_stream.kiq(
    task_dict=params.model_dump(),
    user_id=str(user_id) if user_id else "",
    thread_id=thread_id,
)
```

---

## 8. Summary

This proposal extends Orchestra's existing Redis infrastructure to implement a robust message queue system. The design:

- **Leverages existing patterns** (abort signals, worker tasks, Redis streams)
- **Maintains TDD compatibility** (minimal changes, clear test boundaries)
- **Ensures backend authority** (queue processing driven by worker, not frontend)
- **Provides user control** (pause, edit, remove, reorder operations)
- **Scales horizontally** (per-thread isolation, stateless workers)

The medium complexity and risk level reflect the well-understood patterns being extended. With proper testing and phased implementation, this feature can be delivered incrementally while maintaining system stability.
