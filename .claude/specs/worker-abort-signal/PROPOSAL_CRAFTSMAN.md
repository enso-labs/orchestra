# Worker Abort Signal Implementation Proposal

**Agent:** CRAFTSMAN (Clean Code, Maintainability, SOLID Principles)
**Feature:** User-triggered abort signals for distributed workers
**Date:** 2026-01-19

---

## 1. Executive Summary

This proposal outlines a clean, maintainable implementation for sending abort signals from the frontend to distributed TaskIQ workers. The solution introduces a Redis-based abort signaling mechanism that respects separation of concerns, maintains the existing stream architecture, and provides graceful termination handling with proper cleanup. The implementation follows SOLID principles with a dedicated `AbortSignalService` that can be extended for different abort scenarios without modifying existing code.

---

## 2. Architectural Analysis

### 2.1 Current Code Quality Assessment

**Strengths:**
- Well-structured separation between routes, controllers, and services
- Consistent use of Pydantic models for data validation
- Clean async/await patterns throughout the codebase
- Redis already integrated via TaskIQ for worker communication
- Frontend already has `AbortController` patterns in `useChat.ts`

**Gaps for Abort Functionality:**
1. **No abort channel exists**: Workers stream data via Redis but have no mechanism to receive abort signals
2. **Client abort is local-only**: `abortQuery()` in `useChat.ts` only closes the SSE connection; it does not notify the backend
3. **Task manager has cancel stub**: `InMemoryTaskManager.on_cancel_task()` returns `TaskNotCancelableError` unconditionally
4. **No task ID tracking**: Distributed mode uses `thread_id` but no unique `task_id` for abort targeting

**Code Patterns Observed:**
```python
# Current abort handling in frontend (local only)
const abortQuery = () => {
    if (controller) {
        controller.abort();  // Only closes client connection
        setController(null);
    }
};
```

### 2.2 Proposed Code Structure

```
backend/src/
├── services/
│   └── abort.py          # NEW: AbortSignalService (single responsibility)
├── workers/
│   ├── tasks.py          # MODIFY: Add abort signal checking
│   └── state.py          # MODIFY: Add abort registry to WorkerState
├── routes/v0/
│   └── thread.py         # MODIFY: Add POST /threads/{thread_id}/abort
└── schemas/entities/
    └── abort.py          # NEW: AbortRequest, AbortResponse models

frontend/src/
├── lib/services/
│   └── threadService.ts  # MODIFY: Add abortThread()
├── hooks/
│   └── useChat.ts        # MODIFY: Call abort API before local abort
└── lib/entities/
    └── stream.ts         # MODIFY: Add AbortedEvent type
```

### 2.3 Separation of Concerns

| Layer | Responsibility | Files |
|-------|---------------|-------|
| **Transport** | Redis pubsub/key for abort signals | `services/abort.py` |
| **Coordination** | Worker checks abort status, graceful exit | `workers/tasks.py` |
| **API** | REST endpoint for abort requests | `routes/v0/thread.py` |
| **Client** | UI trigger, connection cleanup | `useChat.ts` |

---

## 3. Implementation Strategy

### 3.1 Backend: Abort Signal Service

**File:** `/home/ryaneggz/ruska-ai/orchestra/backend/src/services/abort.py`

```python
"""Abort signal service for distributed worker coordination.

This service provides a clean interface for sending and checking abort signals
via Redis. It follows the Single Responsibility Principle by handling only
abort signal management.

Design:
- Uses Redis keys with TTL for automatic cleanup
- Signal pattern: abort:thread:{thread_id}
- Workers poll this key during streaming
"""

import redis.asyncio as redis
from src.workers.broker import REDIS_URL
from src.utils.logger import logger

# TTL for abort signals (5 minutes) - matches stream TTL
ABORT_SIGNAL_TTL = 300


class AbortSignalService:
    """Manages abort signals for distributed task execution.

    This service is stateless and creates Redis connections per operation,
    following the same pattern as stream_from_redis() for consistency.
    """

    @staticmethod
    def _get_abort_key(thread_id: str) -> str:
        """Generate Redis key for abort signal."""
        return f"abort:thread:{thread_id}"

    @classmethod
    async def send_abort(cls, thread_id: str) -> bool:
        """Send abort signal for a thread's active task.

        Args:
            thread_id: The thread ID to abort

        Returns:
            True if signal was published successfully
        """
        redis_client = redis.from_url(REDIS_URL)
        try:
            abort_key = cls._get_abort_key(thread_id)
            await redis_client.set(abort_key, "1", ex=ABORT_SIGNAL_TTL)
            logger.info(
                "abort_signal_sent",
                extra={
                    "event": "abort_signal_sent",
                    "thread_id": thread_id,
                },
            )
            return True
        except Exception as e:
            logger.error(
                "abort_signal_failed",
                extra={
                    "event": "abort_signal_failed",
                    "thread_id": thread_id,
                    "error": str(e),
                },
            )
            return False
        finally:
            await redis_client.aclose()

    @classmethod
    async def check_abort(cls, thread_id: str) -> bool:
        """Check if abort signal exists for a thread.

        Args:
            thread_id: The thread ID to check

        Returns:
            True if abort signal is present
        """
        redis_client = redis.from_url(REDIS_URL)
        try:
            abort_key = cls._get_abort_key(thread_id)
            return await redis_client.exists(abort_key) > 0
        finally:
            await redis_client.aclose()

    @classmethod
    async def clear_abort(cls, thread_id: str) -> None:
        """Clear abort signal after task termination.

        Called by worker after graceful shutdown to prevent
        stale signals affecting subsequent tasks.
        """
        redis_client = redis.from_url(REDIS_URL)
        try:
            abort_key = cls._get_abort_key(thread_id)
            await redis_client.delete(abort_key)
        finally:
            await redis_client.aclose()
```

### 3.2 Backend: Worker Task Modification

**File:** `/home/ryaneggz/ruska-ai/orchestra/backend/src/workers/tasks.py`

Add abort checking to the streaming loop:

```python
# At top of file, add import:
from src.services.abort import AbortSignalService

# Inside _execute_agent_stream(), modify the streaming loop:

async for chunk in agent.astream(
    params.input,
    stream_mode=["messages", "values"],
    config=config,
    context=ctx_schema,
):
    # Check for abort signal before processing each chunk
    if await AbortSignalService.check_abort(thread_id):
        logger.info(
            "task_aborted_by_user",
            extra={
                "event": "task_aborted_by_user",
                "thread_id": thread_id,
            },
        )
        # Send abort acknowledgment to client
        await redis_client.xadd(
            stream_key,
            {"data": ujson.dumps(("aborted", {"reason": "user_requested"}))}
        )
        await redis_client.xadd(stream_key, {"done": "true"})
        await redis_client.expire(stream_key, 300)

        # Clear abort signal
        await AbortSignalService.clear_abort(thread_id)

        return {"status": "aborted", "stream_key": stream_key}

    # Existing chunk processing...
    stream_chunk = handle_multi_mode(chunk)
    if stream_chunk:
        # ... existing logic
```

### 3.3 Backend: API Endpoint

**File:** `/home/ryaneggz/ruska-ai/orchestra/backend/src/routes/v0/thread.py`

Add abort endpoint:

```python
from src.services.abort import AbortSignalService

@router.post(
    "/threads/{thread_id}/abort",
    name="Abort Thread Task",
    operation_id="ruska_abort_thread",
    tags=["Thread"],
    status_code=status.HTTP_202_ACCEPTED,
)
async def abort_thread(
    thread_id: str,
    user: ProtectedUser = Depends(verify_credentials),
):
    """
    Send abort signal to a running distributed worker task.

    The worker will gracefully terminate at the next iteration checkpoint,
    sending an 'aborted' event before closing the stream.

    Args:
        thread_id: The thread ID of the running task

    Returns:
        202 Accepted if signal was sent successfully
        404 if thread not found (optional validation)
    """
    try:
        success = await AbortSignalService.send_abort(thread_id)
        if success:
            return {"thread_id": thread_id, "status": "abort_requested"}
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send abort signal",
            )
    except Exception as e:
        logger.exception(f"Error aborting thread {thread_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
```

### 3.4 Backend: Pydantic Models

**File:** `/home/ryaneggz/ruska-ai/orchestra/backend/src/schemas/entities/abort.py`

```python
"""Abort signal schemas for API validation."""

from pydantic import BaseModel, Field
from typing import Literal, Optional


class AbortRequest(BaseModel):
    """Request body for abort endpoint (optional, for future extensions)."""
    reason: Optional[str] = Field(
        default=None,
        description="Optional reason for the abort request",
        max_length=500,
    )


class AbortResponse(BaseModel):
    """Response from abort endpoint."""
    thread_id: str
    status: Literal["abort_requested", "not_found", "error"]
    message: Optional[str] = None
```

### 3.5 Frontend: Thread Service Extension

**File:** `/home/ryaneggz/ruska-ai/orchestra/frontend/src/lib/services/threadService.ts`

```typescript
/**
 * Sends an abort signal to a running distributed worker task.
 *
 * @param threadId - The thread ID of the running task
 * @returns Promise resolving to abort response
 */
export const abortThread = async (threadId: string): Promise<{ thread_id: string; status: string }> => {
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
        throw new Error(error.response?.data?.detail || "Failed to abort thread");
    }
};
```

### 3.6 Frontend: Chat Hook Modification

**File:** `/home/ryaneggz/ruska-ai/orchestra/frontend/src/hooks/useChat.ts`

Modify `abortQuery` to call the backend:

```typescript
import { abortThread } from "@/lib/services/threadService";

// Inside useChat hook:

const abortQuery = async () => {
    // Get thread_id from metadata for distributed mode abort
    const threadId = metadata?.thread_id;

    // Send abort signal to backend (fire-and-forget for UX)
    if (threadId) {
        abortThread(threadId).catch((err) => {
            console.warn("Failed to send abort signal to server:", err);
        });
    }

    // Immediately close local connection for responsive UX
    if (controller) {
        controller.abort();
        setController(null);
    }

    setLoading(false);
    setLoadingMessage("");
};
```

### 3.7 Frontend: Stream Event Types

**File:** `/home/ryaneggz/ruska-ai/orchestra/frontend/src/lib/entities/stream.ts`

Add aborted event type:

```typescript
export interface AbortedEvent {
    type: "aborted";
    data: {
        reason: string;
    };
}

export type SSEEvent = MetadataEvent | MessagesEvent | ValuesEvent | ErrorEvent | AbortedEvent;
```

### 3.8 Frontend: Stream Handler Update

**File:** `/home/ryaneggz/ruska-ai/orchestra/frontend/src/lib/utils/fetchStreamReader.ts`

Add aborted event parsing:

```typescript
private parseEvent(parsed: unknown): SSEEvent | null {
    if (!Array.isArray(parsed) || parsed.length !== 2) return null;

    const [type, payload] = parsed;

    switch (type) {
        case "metadata":
            return { type: "metadata", data: payload };
        case "messages":
            return { type: "messages", data: payload };
        case "values":
            return { type: "values", data: payload };
        case "error":
            return { type: "error", data: payload };
        case "aborted":  // NEW
            return { type: "aborted", data: payload };
        default:
            return null;
    }
}
```

---

## 4. Design Decisions

### 4.1 Trade-offs: Complexity vs. Flexibility

| Approach | Complexity | Flexibility | Chosen |
|----------|-----------|-------------|--------|
| Redis Key polling | Low | Medium | Yes |
| Redis Pub/Sub | Medium | High | No (overkill for 1:1) |
| TaskIQ task revocation | Low | Low | No (no graceful handling) |
| Shared memory flag | Low | Low | No (doesn't work across processes) |

**Rationale:** Redis key polling is chosen because:
1. Aligns with existing Redis usage patterns
2. Simple to implement and test
3. Provides graceful termination (worker controls exit point)
4. Automatic cleanup via TTL

### 4.2 Keeping Implementation Simple Yet Extensible

**Open/Closed Principle:**
- `AbortSignalService` is a class that can be extended for different abort scenarios
- New abort reasons can be added without modifying existing code
- Future: Add priority levels, batch aborts, or audit logging by subclassing

**Single Responsibility:**
- `AbortSignalService`: Only manages abort signals
- Worker task: Only checks abort status, doesn't manage signal lifecycle
- API route: Only validates and forwards requests

### 4.3 Alignment with Existing Conventions

| Pattern | Existing Example | New Implementation |
|---------|-----------------|-------------------|
| Redis key naming | `agent:stream:{thread_id}` | `abort:thread:{thread_id}` |
| TTL handling | `redis_client.expire(stream_key, 300)` | `ABORT_SIGNAL_TTL = 300` |
| Service structure | `services/errors.py` | `services/abort.py` |
| Async patterns | `stream_from_redis()` | `AbortSignalService.send_abort()` |

---

## 5. Risk Assessment

### 5.1 Code Maintainability Concerns

| Risk | Mitigation |
|------|------------|
| Abort check adds latency | Check is O(1) Redis GET; negligible impact |
| Stale abort signals | TTL ensures automatic cleanup |
| Race condition on startup | Clear abort signal before task starts |
| Frontend/backend version mismatch | Graceful degradation - old clients just close connection |

### 5.2 Technical Debt Implications

**Low Debt Introduction:**
- Service is isolated and testable
- No modifications to core streaming logic structure
- Backward compatible (existing abort behavior preserved)

**Potential Future Debt:**
- If multiple abort reasons needed, consider enum-based approach
- If audit trail required, add abort event logging to database

### 5.3 Testing Strategy

**Unit Tests:**

```python
# backend/tests/unit/services/test_abort_service.py

import pytest
from unittest.mock import AsyncMock, patch
from src.services.abort import AbortSignalService


class TestAbortSignalService:
    @pytest.mark.asyncio
    async def test_send_abort_creates_key(self):
        with patch("src.services.abort.redis.from_url") as mock_redis:
            mock_client = AsyncMock()
            mock_redis.return_value = mock_client

            result = await AbortSignalService.send_abort("test-thread-123")

            assert result is True
            mock_client.set.assert_called_once_with(
                "abort:thread:test-thread-123",
                "1",
                ex=300
            )

    @pytest.mark.asyncio
    async def test_check_abort_returns_true_when_exists(self):
        with patch("src.services.abort.redis.from_url") as mock_redis:
            mock_client = AsyncMock()
            mock_client.exists.return_value = 1
            mock_redis.return_value = mock_client

            result = await AbortSignalService.check_abort("test-thread-123")

            assert result is True

    @pytest.mark.asyncio
    async def test_clear_abort_deletes_key(self):
        with patch("src.services.abort.redis.from_url") as mock_redis:
            mock_client = AsyncMock()
            mock_redis.return_value = mock_client

            await AbortSignalService.clear_abort("test-thread-123")

            mock_client.delete.assert_called_once_with(
                "abort:thread:test-thread-123"
            )
```

**Integration Tests:**

```typescript
// frontend/src/tests/services/abortService.test.ts

import { describe, it, expect, vi } from "vitest";
import { abortThread } from "@/lib/services/threadService";
import apiClient from "@/lib/utils/apiClient";

vi.mock("@/lib/utils/apiClient");

describe("abortThread", () => {
    it("sends POST request to abort endpoint", async () => {
        const mockResponse = { data: { thread_id: "test-123", status: "abort_requested" } };
        vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

        const result = await abortThread("test-123");

        expect(apiClient.post).toHaveBeenCalledWith(
            "/threads/test-123/abort",
            {},
            expect.objectContaining({
                headers: expect.objectContaining({
                    "Content-Type": "application/json",
                }),
            })
        );
        expect(result.status).toBe("abort_requested");
    });
});
```

**E2E Test Scenario:**
1. Start a long-running agent task (e.g., with sleep tool)
2. Click stop button in UI
3. Verify stream receives "aborted" event
4. Verify worker logs show graceful termination

---

## 6. Estimated Complexity

### Scope: **Medium**

| Component | Effort | Files Changed |
|-----------|--------|---------------|
| Backend AbortSignalService | 2 hours | 1 new file |
| Backend worker integration | 2 hours | 1 file modified |
| Backend API endpoint | 1 hour | 1 file modified |
| Backend Pydantic models | 30 min | 1 new file |
| Frontend service | 1 hour | 1 file modified |
| Frontend hook | 1 hour | 1 file modified |
| Frontend types | 30 min | 2 files modified |
| Unit tests | 2 hours | 2 new files |
| Integration testing | 2 hours | Manual + E2E |
| **Total** | **~12 hours** | **9 files** |

### Risk Level: **Low**

- Uses existing Redis infrastructure
- Backward compatible with current behavior
- Graceful degradation if signal not received
- No database schema changes

### Suggested Implementation Order

1. **Phase 1: Backend Core** (Day 1)
   - Create `AbortSignalService`
   - Add Pydantic models
   - Implement API endpoint
   - Write unit tests

2. **Phase 2: Worker Integration** (Day 1-2)
   - Modify `_execute_agent_stream()` to check abort
   - Test with manual Redis key insertion
   - Verify graceful termination

3. **Phase 3: Frontend Integration** (Day 2)
   - Add `abortThread()` to service
   - Modify `abortQuery()` hook
   - Update stream event types
   - Test end-to-end flow

4. **Phase 4: Polish** (Day 2-3)
   - Add logging and monitoring
   - Handle edge cases (rapid abort/restart)
   - Documentation updates

---

## 7. API Validation Examples

After implementation, validate with these curl commands:

```bash
# Login to get token
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "test1234"}'

# Start a distributed stream (returns thread_id)
curl -X POST http://localhost:8000/api/llm/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "input": {"messages": [{"role": "user", "content": "Count slowly from 1 to 100"}]},
    "model": "gpt-4o-mini",
    "tools": []
  }'
# Expected: {"thread_id": "abc-123", "distributed": true}

# Abort the running task
curl -X POST http://localhost:8000/api/threads/abc-123/abort \
  -H "Authorization: Bearer <token>"
# Expected: {"thread_id": "abc-123", "status": "abort_requested"}
```

---

## 8. Summary

This proposal provides a clean, maintainable solution for user-triggered abort signals that:

1. **Respects SOLID principles**: Single-purpose `AbortSignalService`, open for extension
2. **Maintains separation of concerns**: Clear boundaries between transport, coordination, and UI
3. **Follows existing patterns**: Redis keys, async services, Pydantic models
4. **Provides graceful degradation**: Old clients still work, just close connection locally
5. **Is testable**: Isolated service with mockable dependencies
6. **Has low risk**: No schema changes, backward compatible, automatic cleanup

The implementation adds approximately 9 files (4 new, 5 modified) with an estimated effort of 12 hours for a fully tested solution.
