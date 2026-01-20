# COUNCIL REVIEW: Worker Abort Signal Implementation

**Feature Under Review:** User-triggered abort signals for distributed workers
**Date:** 2026-01-19
**Council Session:** Elite Council Synthesis

---

## 1. Proposal Comparison Matrix

| Aspect | ARCHITECT | CRAFTSMAN | GUARDIAN | Council Verdict |
|--------|-----------|-----------|----------|-----------------|
| **Signal Mechanism** | Redis Pub/Sub + Key | Redis Key Polling | Redis Key Polling | **Redis Key Polling** (simpler, sufficient) |
| **Check Frequency** | Every chunk | Every chunk | Every N chunks (10) | **Every chunk** (immediate response) |
| **Ownership Verification** | None (simple endpoint) | None (simple endpoint) | Full verification via ThreadService | **Full verification** (security required) |
| **Service Location** | `utils/abort.py` | `services/abort.py` | `services/abort.py` | **`services/abort.py`** (follows SOLID) |
| **CancellationToken** | Yes (Pub/Sub listener) | No (stateless polling) | No (stateless polling) | **No** (polling simpler) |
| **Pre-start Check** | Yes (abort key) | No (not addressed) | No (not addressed) | **Yes** (handles race condition) |
| **Audit Logging** | Basic | Basic | Comprehensive with user context | **Comprehensive** (security audit) |
| **Risk Level** | Medium | Low | Medium | **Medium** |
| **Estimated Effort** | 2-3 days | ~12 hours | 14-19 hours | **2-3 days** (with full testing) |

---

## 2. Consensus Points

All three proposals agree on the following:

### 2.1 Core Architecture
- **Redis-based signaling**: Use Redis as the transport mechanism for abort signals
- **Cooperative cancellation**: Workers check for abort signals at safe checkpoints rather than forceful termination
- **Thread-scoped signals**: Key pattern `abort:{thread_id}` or `abort:signal:{thread_id}`
- **TTL-based cleanup**: 5-minute TTL (300 seconds) matching stream TTL for automatic cleanup

### 2.2 API Design
- **New endpoint**: `POST /threads/{thread_id}/abort`
- **Status code**: 202 Accepted (fire-and-forget semantics)
- **Authentication**: Requires `verify_credentials` dependency

### 2.3 Worker Integration
- **Modify `_execute_agent_stream()`**: Add abort signal checking in the streaming loop
- **Graceful termination**: Send "aborted" event to stream before returning
- **Clear signal after abort**: Prevent stale signals affecting subsequent tasks

### 2.4 Frontend Integration
- **New service function**: `abortThread(threadId: string)` in threadService.ts
- **Enhanced `abortQuery()`**: Call backend abort API in addition to local `controller.abort()`
- **Fire-and-forget pattern**: Don't block UI on backend abort response

### 2.5 Files to Change
All proposals agree on these core files:
- `backend/src/services/abort.py` (NEW)
- `backend/src/routes/v0/thread.py` (MODIFY)
- `backend/src/workers/tasks.py` (MODIFY)
- `frontend/src/lib/services/threadService.ts` (MODIFY)
- `frontend/src/hooks/useChat.ts` (MODIFY)

---

## 3. Divergence Analysis

### 3.1 Signal Mechanism: Pub/Sub vs. Polling

**ARCHITECT** proposes Redis Pub/Sub with a `CancellationToken` class that listens for signals in a background task.

**CRAFTSMAN & GUARDIAN** propose simple Redis key polling where workers check for the existence of an abort key.

**Council Decision: Redis Key Polling**

Rationale:
- Pub/Sub adds complexity (background listeners, resource cleanup, connection management)
- Polling is sufficient for abort signals (checking every chunk is fast enough)
- Key polling aligns with existing Redis patterns in the codebase
- Simpler to test and debug
- Lower risk of resource leaks

### 3.2 Check Frequency

**ARCHITECT & CRAFTSMAN** check for abort signal on every chunk.

**GUARDIAN** proposes checking every N chunks (10) to reduce Redis calls.

**Council Decision: Check Every Chunk**

Rationale:
- Redis EXISTS is O(1) and extremely fast (~0.1ms)
- Users expect immediate response when clicking "Stop"
- LLM chunk frequency is low enough that per-chunk checks are not a bottleneck
- Simplifies implementation (no counter management)

### 3.3 Ownership Verification

**ARCHITECT & CRAFTSMAN** propose simple endpoints without explicit ownership verification.

**GUARDIAN** proposes full ownership verification via ThreadService before signaling.

**Council Decision: Full Ownership Verification (GUARDIAN's approach)**

Rationale:
- **Security requirement**: Users must only abort their own tasks
- Prevents malicious thread ID enumeration attacks
- Audit logging of unauthorized attempts is essential for security review
- ThreadService already exists and provides consistent ownership checking
- Minor additional latency is acceptable for security

### 3.4 Service Location and Structure

**ARCHITECT** places abort utilities in `utils/abort.py` as functions.

**CRAFTSMAN & GUARDIAN** place abort service in `services/abort.py` as a class.

**Council Decision: `services/abort.py` as a class (CRAFTSMAN/GUARDIAN)**

Rationale:
- Follows SOLID principles (Single Responsibility)
- Aligns with existing service layer patterns (`ThreadService`, etc.)
- Class allows for dependency injection and easier testing
- Supports future extensions (priority levels, batch aborts, audit logging)

### 3.5 Pre-start Abort Check

**ARCHITECT** includes a pre-start check using a separate `aborted:{thread_id}` key for tasks that haven't started yet.

**CRAFTSMAN & GUARDIAN** do not explicitly address this race condition.

**Council Decision: Include Pre-start Check (ARCHITECT's approach)**

Rationale:
- Handles race condition where abort signal arrives before task starts
- Essential for immediate abort requests on newly-created threads
- Minor addition that prevents confusing UX scenarios
- Can use the same key with TTL (check before starting task)

---

## 4. Unified Implementation Plan

Based on council synthesis, here is the recommended architecture:

### 4.1 Backend Service: `backend/src/services/abort.py`

```python
"""Abort signal service for distributed worker coordination.

Security: All abort operations require authenticated user with thread ownership.
Audit: All operations logged with user context for security review.
Design: Stateless polling with Redis keys + TTL for automatic cleanup.
"""

import redis.asyncio as redis
from datetime import datetime
from langgraph.store.base import BaseStore

from src.workers.broker import REDIS_URL
from src.services.thread import ThreadService
from src.utils.logger import logger

ABORT_SIGNAL_PREFIX = "abort:signal:"
ABORT_SIGNAL_TTL = 300  # 5 minutes


class AbortService:
    """Manages abort signal propagation to workers with ownership verification."""

    def __init__(self, user_id: str, store: BaseStore):
        self.user_id = user_id
        self.store = store
        self.thread_service = ThreadService(user_id=user_id, store=store)

    async def request_abort(self, thread_id: str) -> str:
        """Request abortion with ownership verification and audit logging."""
        await self._verify_thread_ownership(thread_id)
        await self._set_abort_signal(thread_id)

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
        """Verify user owns thread. Raises ValueError (404) or PermissionError (403)."""
        thread = await self.thread_service.get(thread_id)
        if not thread:
            logger.warning("abort_thread_not_found", extra={...})
            raise ValueError(f"Thread {thread_id} not found")
        # Additional ownership check for explicit security
        # ...

    async def _set_abort_signal(self, thread_id: str) -> None:
        """Set abort signal in Redis with TTL."""
        # ...

    @staticmethod
    async def check_abort_signal(thread_id: str) -> bool:
        """Check if abort signal exists (used by workers)."""
        # ...

    @staticmethod
    async def clear_abort_signal(thread_id: str) -> None:
        """Clear abort signal after task terminates."""
        # ...
```

### 4.2 Recommended Architecture Flow

```
[Frontend]                    [API]                      [Redis]              [Worker]
    |                          |                           |                     |
    |-- POST /abort/{tid} ---->|                           |                     |
    |                          |-- verify_credentials --->|                     |
    |                          |-- _verify_ownership ---->|                     |
    |                          |-- SET abort:signal:tid ->|                     |
    |<-- 202 Accepted ---------|                           |                     |
    |                          |                           |                     |
    |                          |                           |<-- Pre-start check--|
    |                          |                           |                     |
    |                          |                           |<-- Check per chunk--|
    |                          |                           |                     |
    |                          |                           |-- signal exists -->|
    |                          |                           |                     |
    |                          |                           |<-- XADD "aborted" -|
    |<-- SSE: aborted ---------|<--------------------------|                     |
```

### 4.3 Key Implementation Details

1. **Redis Key Pattern**: `abort:signal:{thread_id}` with 300s TTL
2. **Worker Check**: Every chunk (O(1) Redis EXISTS)
3. **Pre-start Check**: Before entering streaming loop
4. **Audit Logging**: All abort requests logged with user_id, thread_id, timestamp
5. **Security**: PermissionError(403) for unauthorized, ValueError(404) for not found
6. **Frontend**: Fire-and-forget pattern (don't block UI on backend response)

---

## 5. Risk Consolidation

### 5.1 Combined Risk Assessment

| Risk | Source | Severity | Likelihood | Mitigation |
|------|--------|----------|------------|------------|
| Unauthorized abort | GUARDIAN | High | Medium | Ownership verification + audit logging |
| Abort signal lost | ARCHITECT | Medium | Low | TTL cleanup, client retry |
| Worker hangs in astream() | ARCHITECT | Low | Medium | Accept limitation; LLM calls atomic |
| Race: abort before start | ARCHITECT | Medium | Low | Pre-start check with TTL |
| Memory leak | ARCHITECT | Low | Low | Simple polling (no listeners) |
| Signal flooding/DoS | GUARDIAN | Medium | Low | Rate limiting on endpoint |
| Thread ID enumeration | GUARDIAN | Medium | Low | UUIDs + ownership check |
| Stale signals | ALL | Low | Low | TTL-based automatic cleanup |

### 5.2 Mitigation Strategies (Prioritized)

1. **HIGH PRIORITY**: Ownership verification before signaling
2. **HIGH PRIORITY**: Comprehensive audit logging
3. **MEDIUM PRIORITY**: Pre-start abort check
4. **MEDIUM PRIORITY**: Rate limiting on abort endpoint
5. **LOW PRIORITY**: Retry mechanism in frontend

---

## 6. Final Verdict

### GO Decision

**Recommendation: GO** - Proceed with implementation

**Confidence Level: HIGH**

### Justification

1. **Consensus on core architecture**: All proposals agree on Redis-based signaling with cooperative cancellation
2. **Security addressed**: GUARDIAN's ownership verification provides necessary protection
3. **Simplicity**: Polling approach is simpler than Pub/Sub with equivalent functionality
4. **Low risk**: No database schema changes, backward compatible, uses existing infrastructure
5. **Clear implementation path**: Well-defined files and changes

### Required Conditions

1. **Must implement** ownership verification (GUARDIAN's approach)
2. **Must implement** pre-start abort check (ARCHITECT's approach)
3. **Must implement** comprehensive audit logging
4. **Should implement** rate limiting before production deployment
5. **Must include** unit tests for auth/authz scenarios

### Implementation Sequence

1. **Phase 1 (Day 1)**: Backend Core
   - Create `AbortService` with ownership verification
   - Add abort endpoint to `thread.py`
   - Unit tests for auth/authz

2. **Phase 2 (Day 1-2)**: Worker Integration
   - Pre-start abort check
   - Per-chunk abort checking in `_execute_agent_stream`
   - "aborted" event in stream

3. **Phase 3 (Day 2)**: Frontend Integration
   - `abortThread()` service function
   - Enhanced `abortQuery()` in useChat
   - "aborted" event handling

4. **Phase 4 (Day 2-3)**: Hardening
   - Rate limiting
   - Edge case testing
   - Integration tests

### Summary

The council recommends a **hybrid approach** that combines:
- **CRAFTSMAN's** clean code structure (service layer, SOLID principles)
- **GUARDIAN's** security measures (ownership verification, audit logging)
- **ARCHITECT's** pre-start check (race condition handling)
- **Simplified polling** instead of Pub/Sub (all agents' simpler alternative)

Total estimated effort: **2-3 developer days** with comprehensive testing.
