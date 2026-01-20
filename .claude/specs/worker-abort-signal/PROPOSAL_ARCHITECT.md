# PROPOSAL_ARCHITECT.md - Worker Abort Signal Implementation

**Feature:** Enable user-triggered abort signals to be propagated to distributed workers

**Author:** AGENT_1: ARCHITECT
**Date:** 2026-01-19
**Status:** Draft

---

## 1. Executive Summary

This proposal outlines an architecture for propagating abort/cancel signals from the frontend to distributed TaskIQ workers processing LLM agent streams. The recommended approach uses Redis pub/sub channels combined with cooperative cancellation patterns within the worker task, enabling graceful termination of long-running agent executions when users click "Stop" in the UI.

---

## 2. Architectural Analysis

### 2.1 Current State Assessment

#### Worker Communication Architecture

The Orchestra system uses a distributed worker pattern with the following key components:

1. **TaskIQ Workers** (`backend/src/workers/`)
   - Workers are spawned via `taskiq worker src.workers.tasks:broker`
   - Tasks are distributed via Redis Streams (`RedisStreamBroker`)
   - The primary task is `run_agent_stream` which processes LLM agent requests

2. **Task Execution Flow**
   ```
   Frontend POST /llm/stream
        |
        v (DISTRIBUTED_WORKERS=true)
   +--------------------+
   | llm.py:llm_stream  |  --> 202 Accepted + {thread_id, distributed: true}
   +--------------------+
        |
        v (run_agent_stream.kiq())
   +--------------------+
   | Redis Task Queue   |  <-- TaskIQ broker (orchestra_tasks stream)
   +--------------------+
        |
        v
   +--------------------+
   | TaskIQ Worker      |  --> Writes chunks to Redis stream (agent:stream:{thread_id})
   +--------------------+
        |
        v
   +--------------------+
   | GET /threads/{id}/ |  <-- Frontend polls this SSE endpoint
   | stream             |
   +--------------------+
   ```

3. **Streaming Infrastructure**
   - Workers write to Redis Streams: `agent:stream:{thread_id}`
   - Frontend consumes via SSE from `GET /threads/{thread_id}/stream`
   - `stream_from_redis()` in `backend/src/utils/stream.py` handles the SSE bridging

4. **Current Abort Behavior**
   - **Frontend**: `useChat.ts` has `abortQuery()` that calls `controller.abort()` (line 122-127)
   - This aborts the *SSE connection* but NOT the worker task
   - **Backend**: `on_cancel_task()` in `task_manager.py` returns `TaskNotCancelableError()` (line 111)
   - **Worker**: No mechanism to receive or respond to cancellation signals

#### Identified Gaps

1. No cancellation signal pathway from API to worker
2. Worker task runs to completion regardless of client disconnect
3. Redis stream continues accumulating data for aborted requests
4. No graceful cleanup of worker resources on abort

### 2.2 Proposed Architecture

The solution introduces a **Redis Pub/Sub based cooperative cancellation** pattern:

```
Frontend (User clicks Stop)
        |
        v
POST /threads/{thread_id}/abort
        |
        v
+------------------------+
| API publishes to       |
| abort:{thread_id}      |  --> Redis Pub/Sub channel
+------------------------+
        |
        v
+------------------------+
| Worker subscribes to   |
| abort:{thread_id}      |  --> Checks between stream iterations
+------------------------+
        |
        v (on cancel signal)
+------------------------+
| Worker gracefully      |
| terminates + cleanup   |
+------------------------+
```

#### Key Design Decisions

1. **Pub/Sub vs Polling**: Pub/Sub provides immediate signal delivery with minimal latency
2. **Cooperative Cancellation**: Workers check for cancel signals at safe points (between chunks)
3. **Thread-ID Based Channels**: Each thread has its own abort channel for precise targeting
4. **Graceful Termination**: Workers perform cleanup before exiting

### 2.3 Integration Points

| Component | File | Integration |
|-----------|------|-------------|
| Abort API Endpoint | `backend/src/routes/v0/thread.py` | New `POST /threads/{thread_id}/abort` route |
| Worker Task | `backend/src/workers/tasks.py` | Add cancellation token checking in stream loop |
| Worker State | `backend/src/workers/state.py` | Add abort signal subscription management |
| Frontend Hook | `frontend/src/hooks/useChat.ts` | Enhance `abortQuery()` to call abort API |
| Frontend Service | `frontend/src/lib/services/threadService.ts` | Add `abortThread()` service method |
| Stream Source | `frontend/src/lib/utils/streamSource.ts` | Add abort callback to `DistributedStreamSource` |

---

## 3. Implementation Strategy

### 3.1 Step-by-Step Implementation Plan

#### Phase 1: Backend Abort Signal Infrastructure

**Step 1.1: Create abort signal publisher**

Create a new utility module for abort signal management:

```python
# backend/src/utils/abort.py (NEW FILE)

import redis.asyncio as redis
from src.workers.broker import REDIS_URL
from src.utils.logger import logger

ABORT_CHANNEL_PREFIX = "abort:"

async def publish_abort_signal(thread_id: str) -> bool:
    """
    Publish an abort signal for a specific thread.

    Returns True if the signal was published successfully.
    """
    redis_client = redis.from_url(REDIS_URL)
    try:
        channel = f"{ABORT_CHANNEL_PREFIX}{thread_id}"
        await redis_client.publish(channel, "abort")
        logger.info(f"Published abort signal for thread: {thread_id}")
        return True
    finally:
        await redis_client.aclose()

async def mark_thread_aborted(thread_id: str) -> None:
    """
    Mark a thread as aborted in Redis (for workers that haven't started yet).
    Uses a short TTL key that workers check before starting.
    """
    redis_client = redis.from_url(REDIS_URL)
    try:
        abort_key = f"aborted:{thread_id}"
        await redis_client.setex(abort_key, 60, "1")  # 60s TTL
    finally:
        await redis_client.aclose()

async def is_thread_aborted(thread_id: str) -> bool:
    """Check if a thread has been marked as aborted."""
    redis_client = redis.from_url(REDIS_URL)
    try:
        abort_key = f"aborted:{thread_id}"
        return await redis_client.exists(abort_key)
    finally:
        await redis_client.aclose()
```

**Step 1.2: Add abort API endpoint**

Modify `backend/src/routes/v0/thread.py`:

```python
@router.post(
    "/threads/{thread_id}/abort",
    name="Abort Thread Processing",
    operation_id="ruska_abort_thread",
    tags=["Thread"],
    status_code=status.HTTP_202_ACCEPTED,
)
async def abort_thread(
    thread_id: str,
    user: ProtectedUser = Depends(verify_credentials),
):
    """
    Signal a distributed worker to abort processing for a thread.

    This sends a cancellation signal via Redis pub/sub to any worker
    currently processing this thread. The worker will gracefully
    terminate at the next safe checkpoint.
    """
    from src.utils.abort import publish_abort_signal, mark_thread_aborted

    try:
        # Mark as aborted (for workers not yet started)
        await mark_thread_aborted(thread_id)
        # Publish signal (for running workers)
        await publish_abort_signal(thread_id)

        return {"thread_id": thread_id, "status": "abort_requested"}
    except Exception as e:
        logger.exception(f"Error aborting thread {thread_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
```

#### Phase 2: Worker Abort Signal Handling

**Step 2.1: Create cancellation token class**

Add to `backend/src/workers/state.py`:

```python
class CancellationToken:
    """
    Cooperative cancellation token for worker tasks.

    Workers check this token periodically to determine if they should
    stop processing. The token is triggered via Redis pub/sub.
    """

    def __init__(self, thread_id: str):
        self.thread_id = thread_id
        self._cancelled = False
        self._pubsub = None
        self._listener_task = None

    @property
    def is_cancelled(self) -> bool:
        return self._cancelled

    async def start_listening(self) -> None:
        """Start listening for abort signals."""
        import redis.asyncio as redis
        from src.workers.broker import REDIS_URL

        redis_client = redis.from_url(REDIS_URL)
        self._pubsub = redis_client.pubsub()

        channel = f"abort:{self.thread_id}"
        await self._pubsub.subscribe(channel)

        # Start background listener
        self._listener_task = asyncio.create_task(self._listen())

    async def _listen(self) -> None:
        """Background task to listen for abort signals."""
        try:
            async for message in self._pubsub.listen():
                if message["type"] == "message":
                    self._cancelled = True
                    logger.info(f"Received abort signal for thread: {self.thread_id}")
                    break
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error in abort listener: {e}")

    async def cleanup(self) -> None:
        """Clean up resources."""
        if self._listener_task:
            self._listener_task.cancel()
            try:
                await self._listener_task
            except asyncio.CancelledError:
                pass
        if self._pubsub:
            await self._pubsub.unsubscribe()
            await self._pubsub.aclose()
```

**Step 2.2: Modify worker task to check cancellation**

Modify `backend/src/workers/tasks.py`:

```python
async def _execute_agent_stream(
    params,
    config,
    files_map,
    todos_list,
    service_context,
    checkpointer,
    user_id,
    thread_id,
    stream_key,
    redis_client,
    cancellation_token: CancellationToken = None,  # NEW PARAMETER
) -> dict:
    """Execute the agent stream logic with cancellation support."""
    # ... existing setup code ...

    # Stream to Redis using handle_multi_mode for format consistency
    async for chunk in agent.astream(
        params.input,
        stream_mode=["messages", "values"],
        config=config,
        context=ctx_schema,
    ):
        # CHECK FOR CANCELLATION
        if cancellation_token and cancellation_token.is_cancelled:
            logger.info(f"Agent stream aborted for thread: {thread_id}")
            await redis_client.xadd(
                stream_key,
                {"data": ujson.dumps(("aborted", {"reason": "user_cancelled"})), "done": "true"}
            )
            await redis_client.expire(stream_key, 300)
            return {"status": "aborted", "stream_key": stream_key}

        # ... existing chunk handling ...
```

Update the main task function to create and use the cancellation token:

```python
@broker.task(task_name="run_agent_stream")
async def run_agent_stream(
    task_dict: dict,
    user_id: str,
    thread_id: str,
) -> dict:
    from src.utils.abort import is_thread_aborted
    from src.workers.state import CancellationToken

    # Check if already aborted before starting
    if await is_thread_aborted(thread_id):
        logger.info(f"Thread {thread_id} was aborted before task started")
        # Write abort marker to stream for any listening clients
        redis_client = redis.from_url(REDIS_URL)
        stream_key = f"agent:stream:{thread_id}"
        await redis_client.xadd(
            stream_key,
            {"data": ujson.dumps(("aborted", {"reason": "pre_aborted"})), "done": "true"}
        )
        await redis_client.expire(stream_key, 300)
        await redis_client.aclose()
        return {"status": "aborted", "stream_key": stream_key}

    # Create cancellation token
    cancellation_token = CancellationToken(thread_id)
    await cancellation_token.start_listening()

    try:
        # ... existing task logic, passing cancellation_token to _execute_agent_stream ...
    finally:
        await cancellation_token.cleanup()
```

#### Phase 3: Frontend Integration

**Step 3.1: Add abort service method**

Add to `frontend/src/lib/services/threadService.ts`:

```typescript
/**
 * Sends an abort signal for a distributed worker task.
 * @param threadId - The thread ID to abort
 * @returns Promise resolving when abort signal is sent
 */
export const abortThread = async (threadId: string): Promise<void> => {
    const token = getAuthToken();
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${VITE_API_URL}/threads/${threadId}/abort`, {
        method: "POST",
        headers,
    });

    if (!response.ok) {
        throw new Error(`Failed to abort thread: ${response.status}`);
    }
};
```

**Step 3.2: Enhance DistributedStreamSource**

Modify `frontend/src/lib/utils/streamSource.ts`:

```typescript
export class DistributedStreamSource implements StreamSource {
    private reader: FetchStreamReader | null = null;
    private abortController: AbortController;
    private eventHandler: ((event: StreamEvent) => void) | null = null;
    private errorHandler: ((error: Error) => void) | null = null;
    private closeHandler: (() => void) | null = null;
    private threadId: string;
    private skipInitialDelay: boolean;
    private abortRequested: boolean = false;  // NEW

    // ... existing constructor and methods ...

    /**
     * Request server-side abort for distributed workers.
     * This sends a signal to stop the worker task in addition to
     * closing the client-side connection.
     */
    async requestAbort(): Promise<void> {
        if (this.abortRequested) return;
        this.abortRequested = true;

        try {
            const { abortThread } = await import("@/lib/services/threadService");
            await abortThread(this.threadId);
        } catch (error) {
            console.warn("Failed to send server-side abort:", error);
        }
    }

    close(): void {
        // Request server-side abort for distributed workers
        this.requestAbort();

        this.abortController.abort();
        this.reader?.close();
    }
}
```

**Step 3.3: Update useChat hook**

Modify `frontend/src/hooks/useChat.ts`:

```typescript
const abortQuery = async () => {
    if (controller) {
        controller.abort();
        setController(null);
    }

    // For distributed mode, also send server-side abort
    if (metadata?.thread_id) {
        try {
            const { abortThread } = await import("@/lib/services/threadService");
            await abortThread(metadata.thread_id);
        } catch (error) {
            console.warn("Failed to send server-side abort:", error);
        }
    }
};
```

### 3.2 File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `backend/src/utils/abort.py` | NEW | Abort signal utilities (publish, check) |
| `backend/src/routes/v0/thread.py` | MODIFY | Add POST /threads/{id}/abort endpoint |
| `backend/src/workers/state.py` | MODIFY | Add CancellationToken class |
| `backend/src/workers/tasks.py` | MODIFY | Add cancellation checks in stream loop |
| `frontend/src/lib/services/threadService.ts` | MODIFY | Add abortThread() function |
| `frontend/src/lib/utils/streamSource.ts` | MODIFY | Add requestAbort() to DistributedStreamSource |
| `frontend/src/hooks/useChat.ts` | MODIFY | Enhance abortQuery() for distributed mode |

### 3.3 Key Code Patterns to Follow

1. **Existing Conventions**
   - Use `redis.asyncio` for Redis operations (consistent with `tasks.py`)
   - Follow existing logger patterns (`logger.info`, `logger.exception`)
   - Use FastAPI dependency injection for user auth (`Depends(verify_credentials)`)
   - Match existing SSE event format for abort events

2. **Error Handling**
   - Wrap Redis operations in try/finally for proper cleanup
   - Log errors but don't fail silently on abort signal failures
   - Frontend should catch abort errors and log warnings (non-blocking)

3. **Resource Cleanup**
   - Always cleanup pub/sub connections
   - Cancel background tasks properly with asyncio.CancelledError handling
   - Set Redis key TTLs for abort markers

---

## 4. Design Decisions

### 4.1 Trade-offs Considered

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **Redis Pub/Sub** | Immediate delivery, low latency, simple | Requires pub/sub connection per task | **SELECTED** |
| **Redis Key Polling** | Simpler, no additional connections | Higher latency (poll interval), more Redis reads | Rejected |
| **TaskIQ Built-in Cancel** | Framework support | TaskIQ doesn't have native cancel for running tasks | Not available |
| **PostgreSQL Flag** | Persistent, auditable | Higher latency, DB load | Rejected |

### 4.2 Why This Approach

1. **Immediate Signal Delivery**: Pub/Sub provides near-instant signal delivery, critical for responsive UI
2. **Minimal Infrastructure**: Leverages existing Redis infrastructure
3. **Cooperative Pattern**: Allows workers to clean up gracefully (save partial state, close connections)
4. **Thread-Scoped**: Each thread has isolated cancellation, no cross-thread interference
5. **Pre-start Check**: The `aborted:{thread_id}` key handles race conditions where abort arrives before task starts

### 4.3 Alignment with Existing Patterns

- Uses same Redis client patterns as `tasks.py` and `stream.py`
- Follows existing SSE event format for abort notifications
- Maintains separation between sync and distributed modes
- Extends existing `StreamSource` interface cleanly
- Uses existing auth middleware patterns

---

## 5. Risk Assessment

### 5.1 Potential Pitfalls

| Risk | Impact | Mitigation |
|------|--------|------------|
| Pub/Sub message lost | Worker continues running | Use both pub/sub AND abort key check |
| Worker hangs in agent.astream() | Abort signal ignored until next chunk | Accept as limitation; LLM calls are atomic |
| Memory leak from orphaned listeners | Worker degradation | Ensure cleanup in finally blocks |
| Race condition: abort before task starts | Task runs anyway | Pre-start abort key check with TTL |
| Frontend abort during network issues | Server-side continues | Graceful degradation; task completes |

### 5.2 Edge Cases to Handle

1. **Double Abort**: User clicks stop multiple times
   - Solution: Idempotent abort endpoint, check `abortRequested` flag

2. **Abort After Completion**: Task finishes before signal arrives
   - Solution: No-op, task already done

3. **Abort During Checkpoint Write**: Data consistency
   - Solution: Check cancellation BEFORE writes, not during

4. **Reconnect After Abort**: User starts new conversation on same thread
   - Solution: Clear abort markers on new task start

5. **Worker Crash During Abort**: Cleanup not executed
   - Solution: TTL on abort keys, stream cleanup by consumer

### 5.3 Testing Considerations

1. **Unit Tests**
   - CancellationToken signal detection
   - Abort publisher/subscriber
   - Pre-start abort check

2. **Integration Tests**
   - Full abort flow: frontend -> API -> worker
   - Concurrent abort and completion
   - Network interruption scenarios

3. **Load Tests**
   - Many concurrent aborts
   - Pub/sub channel limits
   - Redis connection pool under load

---

## 6. Estimated Complexity

### 6.1 Scope Assessment

**Scope: Medium**

- New files: 1 (abort utilities)
- Modified files: 6
- New API endpoints: 1
- New frontend service methods: 1
- Estimated lines of code: ~200-250

### 6.2 Risk Level

**Risk Level: Medium**

- Introduces new async patterns (pub/sub listeners)
- Changes critical path (worker task execution)
- Requires careful resource cleanup
- Cross-component coordination (frontend, API, worker)

### 6.3 Implementation Priority Order

1. **Phase 1 - Backend Infrastructure** (Day 1)
   - `backend/src/utils/abort.py`
   - Abort API endpoint in `thread.py`

2. **Phase 2 - Worker Integration** (Day 1-2)
   - `CancellationToken` in `state.py`
   - Cancellation checks in `tasks.py`

3. **Phase 3 - Frontend Integration** (Day 2)
   - `abortThread()` service method
   - `DistributedStreamSource.requestAbort()`
   - `useChat.ts` enhancements

4. **Phase 4 - Testing & Hardening** (Day 3)
   - Unit tests
   - Integration tests
   - Edge case handling

### 6.4 Dependencies

- Redis (already deployed)
- TaskIQ workers (already running)
- No external service changes required

---

## 7. Summary

This proposal provides a robust, low-latency solution for propagating user abort signals to distributed workers. The Redis pub/sub approach aligns with existing infrastructure, provides immediate signal delivery, and allows for graceful task termination with proper cleanup.

The implementation is scoped to be deliverable in 2-3 days with thorough testing, and introduces minimal risk to existing functionality through cooperative cancellation patterns that check for signals at safe checkpoints rather than forceful termination.
