# PROPOSAL: Worker Abort Signal Implementation

**Agent**: GUARDIAN (Security, Error Handling, Edge Cases, Testing)
**Feature**: User-triggered abort signals to distributed workers
**Date**: 2026-01-19

---

## 1. Executive Summary

This proposal outlines a secure, robust implementation for propagating user-initiated abort signals to TaskIQ distributed workers. The solution leverages Redis as a signaling mechanism with proper authorization checks, graceful degradation on failure, and comprehensive test coverage. The design prioritizes security (ensuring only authorized users can abort their own tasks), resilience (handling race conditions and partial failures), and observability (logging all abort operations for audit trails).

---

## 2. Architectural Analysis

### 2.1 Current System State

**Worker Architecture**:
- TaskIQ with Redis Streams broker (`backend/src/workers/broker.py`)
- Tasks enqueued via `run_agent_stream.kiq()` with thread-based isolation
- Results streamed to Redis streams (`agent:stream:{thread_id}`)
- No current mechanism for external abort signals to running workers

**Authentication/Authorization**:
- JWT-based authentication via `backend/src/utils/auth.py`
- API key support with hashed storage
- Thread ownership tracked via `user_id` in checkpointer metadata
- `verify_credentials` and `get_optional_user_from_token` dependencies

**Error Handling Patterns**:
- Comprehensive exception hierarchy in `backend/src/services/errors.py`
- Retryable vs. permanent error classification
- Checkpoint connection errors handled gracefully without task failure
- SSE error propagation via Redis stream error markers

**Frontend Abort Handling**:
- `AbortController` in `useChat.ts` for client-side abort
- `StreamSource.close()` terminates SSE connection
- No backend notification when user aborts

### 2.2 Security Assessment

**Current Vulnerabilities**:
1. **No backend abort mechanism**: Client can close SSE but worker continues execution, wasting resources
2. **Thread ownership not enforced on stream endpoint**: `get_optional_user_from_token` allows optional auth
3. **No audit trail**: Abort operations not logged for security review
4. **Resource exhaustion**: Orphaned workers continue consuming resources after disconnect

**Authorization Requirements**:
- Only the user who initiated a task should be able to abort it
- Admin users may need override capability for operational tasks
- API tokens should inherit user permissions for abort operations

### 2.3 Potential Vulnerability Points

1. **Race conditions**: Abort signal arrives after task completes
2. **Task ID enumeration**: Malicious actor guessing thread_ids to abort others' tasks
3. **Replay attacks**: Captured abort signals being replayed
4. **Signal flooding**: DoS via excessive abort requests
5. **Partial cancellation**: Worker receives signal mid-stream, leaving inconsistent state

---

## 3. Implementation Strategy

### 3.1 Architecture Overview

```
[Frontend]                    [API]                      [Redis]              [Worker]
    |                          |                           |                     |
    |-- POST /abort/{tid} ---->|                           |                     |
    |                          |-- Verify ownership ------>|                     |
    |                          |-- SET abort:{tid} "1" -->|                     |
    |<-- 202 Accepted ---------|                           |                     |
    |                          |                           |                     |
    |                          |                           |<-- Check abort -----|
    |                          |                           |                     |
    |                          |                           |-- abort:{tid}=1 -->|
    |                          |                           |                     |
    |                          |                           |<-- XADD aborted ---|
    |<-- SSE: aborted ---------|<--------------------------|                     |
```

### 3.2 Backend Implementation

#### Step 1: Redis Abort Signal Key Structure

```python
# Key pattern: abort:signal:{thread_id}
# Value: JSON with abort metadata
# TTL: 300 seconds (matches stream TTL)

ABORT_SIGNAL_KEY = "abort:signal:{thread_id}"
ABORT_SIGNAL_TTL = 300
```

#### Step 2: New Abort Endpoint

**File**: `backend/src/routes/v0/thread.py`

```python
from fastapi import APIRouter, HTTPException, Depends, status
from src.utils.auth import verify_credentials
from src.schemas.models import ProtectedUser
from src.services.abort import AbortService

@router.post(
    "/threads/{thread_id}/abort",
    name="Abort Thread Execution",
    operation_id="ruska_abort_thread",
    tags=["Thread"],
    status_code=status.HTTP_202_ACCEPTED,
)
async def abort_thread(
    thread_id: str,
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    """
    Request abortion of a running thread task.

    Security:
    - Requires authentication
    - Verifies user owns the thread before signaling abort
    - Logs abort request for audit trail

    Returns:
        202 Accepted: Abort signal sent (worker may not receive immediately)
        403 Forbidden: User does not own this thread
        404 Not Found: Thread does not exist
    """
    abort_service = AbortService(user_id=user.id, store=store)

    try:
        result = await abort_service.request_abort(thread_id)
        return {"status": "accepted", "thread_id": thread_id, "message": result}
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
```

#### Step 3: Abort Service

**File**: `backend/src/services/abort.py` (NEW)

```python
"""Service for managing task abort signals.

Security considerations:
- All abort operations require authenticated user
- Thread ownership verified before signaling
- All operations logged for audit trail
- Rate limiting via existing limiter middleware
"""

import redis.asyncio as redis
from datetime import datetime
from typing import Optional
from langgraph.store.base import BaseStore

from src.workers.broker import REDIS_URL
from src.services.thread import ThreadService
from src.utils.logger import logger

ABORT_SIGNAL_PREFIX = "abort:signal:"
ABORT_SIGNAL_TTL = 300  # 5 minutes


class AbortService:
    """Manages abort signal propagation to workers.

    Design principles:
    - Fire-and-forget signaling (worker polls for signal)
    - Ownership verification before signal
    - Idempotent operations (multiple abort calls are safe)
    """

    def __init__(self, user_id: str, store: BaseStore):
        self.user_id = user_id
        self.store = store
        self.thread_service = ThreadService(user_id=user_id, store=store)

    async def request_abort(self, thread_id: str) -> str:
        """Request abortion of a running task.

        Args:
            thread_id: The thread ID to abort

        Returns:
            Status message

        Raises:
            PermissionError: If user doesn't own the thread
            ValueError: If thread doesn't exist
        """
        # Step 1: Verify thread exists and user owns it
        await self._verify_thread_ownership(thread_id)

        # Step 2: Set abort signal in Redis
        await self._set_abort_signal(thread_id)

        # Step 3: Log for audit trail
        logger.info(
            "abort_signal_sent",
            extra={
                "event": "abort_signal_sent",
                "thread_id": thread_id,
                "user_id": self.user_id,
                "timestamp": datetime.utcnow().isoformat(),
            }
        )

        return "Abort signal sent. Task will terminate at next checkpoint."

    async def _verify_thread_ownership(self, thread_id: str) -> None:
        """Verify the current user owns the specified thread.

        Raises:
            ValueError: Thread does not exist
            PermissionError: User does not own thread
        """
        thread = await self.thread_service.get(thread_id)

        if not thread:
            logger.warning(
                "abort_thread_not_found",
                extra={
                    "event": "abort_thread_not_found",
                    "thread_id": thread_id,
                    "user_id": self.user_id,
                }
            )
            raise ValueError(f"Thread {thread_id} not found")

        # Thread ownership is verified by the store's namespace filtering
        # If get() returns None, user doesn't have access
        # Additional explicit check for security
        thread_user_id = thread.value.get("user_id")
        if thread_user_id and str(thread_user_id) != str(self.user_id):
            logger.warning(
                "abort_unauthorized_attempt",
                extra={
                    "event": "abort_unauthorized_attempt",
                    "thread_id": thread_id,
                    "requesting_user": self.user_id,
                    "thread_owner": thread_user_id,
                }
            )
            raise PermissionError(f"Not authorized to abort thread {thread_id}")

    async def _set_abort_signal(self, thread_id: str) -> None:
        """Set abort signal in Redis for worker to poll."""
        redis_client = redis.from_url(REDIS_URL)
        try:
            key = f"{ABORT_SIGNAL_PREFIX}{thread_id}"
            signal_data = {
                "requested_by": self.user_id,
                "requested_at": datetime.utcnow().isoformat(),
            }
            await redis_client.set(key, str(signal_data), ex=ABORT_SIGNAL_TTL)
        finally:
            await redis_client.aclose()

    @staticmethod
    async def check_abort_signal(thread_id: str) -> bool:
        """Check if an abort signal exists for a thread.

        Used by workers to poll for abort requests.

        Args:
            thread_id: Thread ID to check

        Returns:
            True if abort signal exists, False otherwise
        """
        redis_client = redis.from_url(REDIS_URL)
        try:
            key = f"{ABORT_SIGNAL_PREFIX}{thread_id}"
            return await redis_client.exists(key) > 0
        finally:
            await redis_client.aclose()

    @staticmethod
    async def clear_abort_signal(thread_id: str) -> None:
        """Clear abort signal after task terminates.

        Called by worker after processing abort.
        """
        redis_client = redis.from_url(REDIS_URL)
        try:
            key = f"{ABORT_SIGNAL_PREFIX}{thread_id}"
            await redis_client.delete(key)
        finally:
            await redis_client.aclose()
```

#### Step 4: Worker Abort Checking

**File**: `backend/src/workers/tasks.py` (MODIFIED)

```python
# Add abort checking to the streaming loop

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
) -> dict:
    """Execute the agent stream logic with abort signal checking."""
    from src.services.abort import AbortService

    # ... existing setup code ...

    # Track chunks for abort checking (check every N chunks)
    ABORT_CHECK_INTERVAL = 10
    chunk_count = 0

    async for chunk in agent.astream(
        params.input,
        stream_mode=["messages", "values"],
        config=config,
        context=ctx_schema,
    ):
        # Periodic abort signal check
        chunk_count += 1
        if chunk_count % ABORT_CHECK_INTERVAL == 0:
            if await AbortService.check_abort_signal(thread_id):
                logger.info(
                    "task_aborted_by_user",
                    extra={
                        "event": "task_aborted_by_user",
                        "thread_id": thread_id,
                        "chunks_processed": chunk_count,
                    }
                )
                # Send abort marker to stream
                await redis_client.xadd(
                    stream_key,
                    {"aborted": "true", "reason": "User requested abort"}
                )
                await redis_client.expire(stream_key, 300)
                # Clean up signal
                await AbortService.clear_abort_signal(thread_id)
                return {"status": "aborted", "stream_key": stream_key}

        # ... existing chunk processing ...
        stream_chunk = handle_multi_mode(chunk)
        if stream_chunk:
            # ... existing logic ...
            await redis_client.xadd(stream_key, {"data": data})

    # ... existing completion logic ...
```

#### Step 5: Stream Consumer Abort Handling

**File**: `backend/src/utils/stream.py` (MODIFIED)

```python
async def stream_from_redis(thread_id: str):
    """Consume Redis stream with abort signal support."""
    # ... existing setup ...

    try:
        while True:
            messages = await redis_client.xread(
                {stream_key: last_id},
                block=STREAM_TIMEOUT_MS,
            )

            if not messages:
                yield ": keep-alive\n\n"
                continue

            for stream, entries in messages:
                for entry_id, data in entries:
                    last_id = entry_id

                    # Handle abort marker
                    if b"aborted" in data:
                        reason = data.get(b"reason", b"Unknown").decode()
                        yield f'data: {{"type": "aborted", "reason": "{reason}"}}\n\n'
                        yield "data: [DONE]\n\n"
                        return

                    # ... existing done/error/data handling ...
    # ... existing exception handling ...
```

### 3.3 Frontend Implementation

#### Step 1: Abort Service Function

**File**: `frontend/src/lib/services/threadService.ts` (ADD)

```typescript
/**
 * Request abortion of a running thread task.
 *
 * @param threadId - The thread ID to abort
 * @returns Response from the abort endpoint
 * @throws Error on auth failure, not found, or forbidden
 */
export const abortThread = async (threadId: string): Promise<{ status: string; message: string }> => {
    try {
        const response = await apiClient.post(
            `/threads/${threadId}/abort`,
            {},
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${getAuthToken()}`,
                },
            }
        );
        return response.data;
    } catch (error: any) {
        console.error("Error aborting thread:", error);
        if (error.response?.status === 403) {
            throw new Error("Not authorized to abort this thread");
        }
        if (error.response?.status === 404) {
            throw new Error("Thread not found");
        }
        throw new Error(error.response?.data?.detail || "Failed to abort thread");
    }
};
```

#### Step 2: Enhanced useChat Hook

**File**: `frontend/src/hooks/useChat.ts` (MODIFY)

```typescript
import { abortThread } from "@/lib/services/threadService";

// In useChat hook, modify abortQuery:
const abortQuery = async () => {
    if (controller) {
        // Close local SSE connection
        controller.abort();
        setController(null);
    }

    // Signal backend to abort worker task
    if (metadata?.thread_id) {
        try {
            await abortThread(metadata.thread_id);
            console.log("Backend abort signal sent");
        } catch (error) {
            // Log but don't fail - local abort already happened
            console.warn("Failed to send backend abort signal:", error);
        }
    }

    setLoading(false);
};
```

#### Step 3: Stream Event Handling

**File**: `frontend/src/lib/utils/fetchStreamReader.ts` (MODIFY)

```typescript
// Add handling for aborted event type
const processEvent = (data: string): StreamEvent | null => {
    // ... existing code ...

    if (parsed.type === "aborted") {
        return {
            type: "error",
            data: { error: `Task aborted: ${parsed.reason}` }
        };
    }

    // ... rest of existing code ...
};
```

### 3.4 File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `backend/src/services/abort.py` | CREATE | New abort signal service |
| `backend/src/routes/v0/thread.py` | MODIFY | Add abort endpoint |
| `backend/src/workers/tasks.py` | MODIFY | Add abort signal polling |
| `backend/src/utils/stream.py` | MODIFY | Handle abort in SSE consumer |
| `frontend/src/lib/services/threadService.ts` | MODIFY | Add abortThread function |
| `frontend/src/hooks/useChat.ts` | MODIFY | Enhance abortQuery with backend call |
| `frontend/src/lib/utils/fetchStreamReader.ts` | MODIFY | Handle aborted event type |
| `backend/tests/unit/services/test_abort_service.py` | CREATE | Unit tests for abort service |
| `backend/tests/unit/routes/test_abort_endpoint.py` | CREATE | Route tests |
| `backend/tests/integration/test_abort_flow.py` | CREATE | End-to-end abort tests |

---

## 4. Design Decisions

### 4.1 Security Trade-offs

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| Polling vs. Push | Workers poll for abort signals | Slight latency (up to N chunks) vs. complexity of pub/sub |
| Thread-level ownership | Store namespace provides implicit filtering | Relies on store implementation correctness |
| Signal TTL | 5-minute TTL prevents stale signals | Long-running tasks may miss signals if not checking frequently |
| No admin override | Initial implementation user-only | Simplicity vs. operational flexibility |

### 4.2 Error Handling Approach

```
Abort Request Flow:
    |
    v
[Auth Check] --fail--> 401 Unauthorized
    |
    v
[Thread Exists?] --no--> 404 Not Found
    |
    v
[User Owns Thread?] --no--> 403 Forbidden (logged as security event)
    |
    v
[Set Redis Signal] --fail--> 500 Internal Error (retry on transient)
    |
    v
[202 Accepted] --> Worker will abort at next checkpoint
```

**Graceful Degradation**:
- If Redis signal fails: Log error, return 500, client retries
- If worker misses signal: Task completes normally (no data loss)
- If signal races with completion: Signal ignored, task completes

### 4.3 Alignment with Existing Patterns

- Follows existing `CheckpointError` exception hierarchy pattern
- Uses same Redis client pattern as `stream_from_redis`
- Matches existing service layer structure (`ServiceContext` pattern)
- Consistent with `ThreadService` for ownership verification
- Logging follows established structured logging patterns

---

## 5. Risk Assessment

### 5.1 Security Vulnerabilities to Address

| Vulnerability | Mitigation | Priority |
|--------------|------------|----------|
| Unauthorized abort | Ownership verification before signaling | HIGH |
| Thread ID enumeration | UUIDs + ownership check prevents abuse | MEDIUM |
| Signal replay | TTL expiration + idempotent operations | LOW |
| DoS via abort spam | Rate limiting on endpoint | MEDIUM |
| Audit trail gaps | Comprehensive logging with user context | MEDIUM |

### 5.2 Edge Cases Requiring Special Handling

| Edge Case | Handling |
|-----------|----------|
| Abort after task completes | Signal expires via TTL, no effect |
| Multiple rapid abort requests | Idempotent SET operation, safe |
| Worker crash before signal check | Stream orphaned, normal TTL cleanup |
| Network partition during abort | Client retry, server idempotent |
| Concurrent abort + task completion | Race resolves naturally (either aborts or completes) |
| User deletes thread while aborting | Abort signal orphaned, TTL cleans up |

### 5.3 Testing Requirements

**Unit Tests** (backend/tests/unit/):
- `test_abort_service.py`:
  - `test_request_abort_success`: Happy path
  - `test_request_abort_thread_not_found`: 404 case
  - `test_request_abort_unauthorized`: 403 case
  - `test_check_abort_signal_exists`: Signal polling
  - `test_check_abort_signal_missing`: No signal
  - `test_clear_abort_signal`: Cleanup
  - `test_abort_signal_idempotent`: Multiple calls safe

**Integration Tests** (backend/tests/integration/):
- `test_abort_flow.py`:
  - `test_abort_endpoint_requires_auth`: 401 without token
  - `test_abort_endpoint_verifies_ownership`: 403 for other user's thread
  - `test_abort_signal_stops_worker`: Full flow test
  - `test_abort_with_distributed_stream`: End-to-end with polling

**Frontend Tests** (frontend/src/tests/):
- `test_abort_thread_service`: API call tests
- `test_use_chat_abort_flow`: Hook integration

---

## 6. Estimated Complexity

### 6.1 Scope Assessment

| Component | Effort | Complexity |
|-----------|--------|------------|
| AbortService | 2-3 hours | Low |
| Abort Endpoint | 1-2 hours | Low |
| Worker Modification | 2-3 hours | Medium |
| Stream Handler Update | 1 hour | Low |
| Frontend Changes | 2 hours | Low |
| Unit Tests | 3-4 hours | Medium |
| Integration Tests | 2-3 hours | Medium |
| Documentation | 1 hour | Low |

**Total Estimate**: 14-19 hours (2-3 developer days)

### 6.2 Risk Level

**MEDIUM**

Justification:
- Core components are well-understood (Redis, TaskIQ)
- Pattern follows existing service layer conventions
- Main risk is race condition handling (mitigated by design)
- No database schema changes required

### 6.3 Suggested Implementation Order

1. **Phase 1 - Core Backend** (Priority: HIGH)
   - Create `AbortService` with tests
   - Add abort endpoint with auth
   - Unit test coverage

2. **Phase 2 - Worker Integration** (Priority: HIGH)
   - Modify `_execute_agent_stream` for signal checking
   - Update stream consumer for abort marker
   - Integration test: signal to worker

3. **Phase 3 - Frontend Integration** (Priority: MEDIUM)
   - Add `abortThread` service function
   - Modify `useChat.abortQuery`
   - Handle `aborted` event in stream reader

4. **Phase 4 - Hardening** (Priority: MEDIUM)
   - Add rate limiting to abort endpoint
   - Comprehensive logging review
   - Edge case testing
   - Documentation

---

## 7. Appendix: Security Checklist

- [ ] Abort endpoint requires authentication (`verify_credentials`)
- [ ] Thread ownership verified before signaling
- [ ] Unauthorized attempts logged with user context
- [ ] Signal TTL prevents stale/orphaned signals
- [ ] Rate limiting applied to prevent DoS
- [ ] No sensitive data in abort signal payload
- [ ] Audit log captures: user, thread, timestamp, outcome
- [ ] Frontend gracefully handles abort failures
- [ ] Worker abort is non-blocking (doesn't crash on signal check failure)
- [ ] Tests cover all auth/authz scenarios
