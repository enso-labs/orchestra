# Message Queue System - Elite Council Review

**Feature:** Message Queue System for DeepAgents
**Review Date:** 2026-01-19
**Council Members:** ARCHITECT, CRAFTSMAN, GUARDIAN, OPTIMIZER, INTEGRATOR
**Status:** FINAL REVIEW

---

## 1. Proposal Comparison Matrix

| Dimension | ARCHITECT | CRAFTSMAN | GUARDIAN | OPTIMIZER | INTEGRATOR |
|-----------|-----------|-----------|----------|-----------|------------|
| **Primary Focus** | System design, data model, worker integration | Clean code, service patterns, SOLID principles | Security, error handling, testing | Performance, Redis optimization, fallback | REST API, SSE events, TypeScript alignment |
| **Redis Structure** | ZSET + Hash per thread | ZSET with separate status keys | List + Hash + Lock key with user namespacing | ZSET with `BZPOPMIN`, connection pooling | Defers to backend design |
| **Queue Namespacing** | `queue:thread:{thread_id}` | `queue:{thread_id}` | `queue:{user_id}:{thread_id}` | `queue:messages:{user_id}` | N/A (API-focused) |
| **Processing Trigger** | Worker self-chains on `[DONE]` | Static worker methods | Atomic Lua scripts for race safety | `BZPOPMIN` blocking pop | SSE event emission |
| **Pause Implementation** | Status field in queue item | Separate queue status + item status | State machine with valid transitions | Negative scores in ZSET | `QueueItemStatus` enum |
| **In-Memory Fallback** | Not specified | InMemoryStore for tests | Not specified | `asyncio.PriorityQueue` wrapper | Not specified |
| **Authorization** | Implicit via thread ownership | ThreadService pattern | Multi-level: queue, item, operation | Per-user namespacing | `verify_credentials` dependency |
| **Error Handling** | Basic try/catch with logging | Service exception patterns | Full exception hierarchy with retry | Circuit breaker pattern | HTTP status codes |
| **Testing Strategy** | Unit + integration test files | TDD with mocks | Comprehensive: unit, integration, edge cases | Performance-focused | Contract validation |
| **Estimated Effort** | 3-4 days | 4.5 days (36 hours) | Not explicitly stated | 3-4 days (26 hours) | 3-4 days (27 hours) |
| **Risk Assessment** | Medium | Medium | Medium | Medium | Medium |

---

## 2. Consensus Points

All five proposals agree on the following fundamental design decisions:

### 2.1 Architecture Agreements

1. **Redis as Primary Storage**: All proposals recommend Redis for queue persistence, leveraging existing infrastructure from `broker.py`, `stream.py`, and `abort.py`.

2. **Redis Sorted Set (ZSET)**: Four of five proposals explicitly recommend ZSET over List for its O(log n) operations, support for position manipulation, and efficient edit/remove by ID.

3. **Per-Thread Queue Model**: All agree queues should be scoped to threads, maintaining conversational context isolation.

4. **Backend-Driven Processing**: All proposals emphasize backend authority for queue processing, with the worker triggering next-item execution on `[DONE]` signal.

5. **Service Layer Pattern**: All recommend following the existing `AbortService` pattern for the new `QueueService`.

6. **Pydantic Schema Definitions**: All propose a new `queue.py` schema file with `QueueItem`, `QueueItemStatus`, and related models.

7. **REST API Structure**: All agree on nested resource pattern: `/threads/{thread_id}/queue/*`.

8. **Status States**: All include at minimum: `pending`, `processing`, `paused`, `completed`, `failed`.

9. **Frontend Above ChatInput**: All specify the queue display component should appear above the chat input.

10. **Phased Implementation**: All recommend incremental delivery with backend first, then worker integration, then frontend.

### 2.2 Technical Agreements

| Agreement | Supporting Proposals |
|-----------|---------------------|
| Use timestamp as ZSET score for FIFO ordering | ARCHITECT, CRAFTSMAN, OPTIMIZER |
| UUID-based item identification (not positional) | ARCHITECT, GUARDIAN, CRAFTSMAN |
| TTL-based cleanup for stale items | All |
| Item-level ownership verification | ARCHITECT, CRAFTSMAN, GUARDIAN |
| Extend SSE for queue events | ARCHITECT, INTEGRATOR |
| Hash storage for full item payloads | ARCHITECT, OPTIMIZER |

---

## 3. Divergence Analysis

### 3.1 Queue Key Namespacing

**Conflict:**
- ARCHITECT: `queue:thread:{thread_id}:*`
- CRAFTSMAN: `queue:{thread_id}:*`
- GUARDIAN: `queue:{user_id}:{thread_id}:*`
- OPTIMIZER: `queue:messages:{user_id}:*`

**Resolution:**
Adopt GUARDIAN's namespacing pattern: `queue:{user_id}:{thread_id}:*`

**Rationale:**
- GUARDIAN's pattern provides defense-in-depth against IDOR attacks by including `user_id` in the key
- Enables efficient cleanup of all queues for a user (e.g., account deletion)
- Maintains thread isolation while adding user-level scoping
- Aligns with Redis best practices for multi-tenant data

### 3.2 Dequeue Mechanism

**Conflict:**
- ARCHITECT: Worker polls queue after `[DONE]`, uses `dequeue()` method
- OPTIMIZER: `BZPOPMIN` blocking pop for zero-latency
- GUARDIAN: Lua script for atomic pause-check-and-pop

**Resolution:**
Use GUARDIAN's atomic Lua script approach within the worker, not `BZPOPMIN`.

**Rationale:**
- `BZPOPMIN` is designed for consumer workers competing for items across queues, not our per-thread model
- Our workers already wake up on `[DONE]`; they need to check pause state atomically with dequeue
- Lua script guarantees atomicity: check pause flag, verify status, update to processing, return item
- This prevents the race condition GUARDIAN identified where pause is set between `[DONE]` and dequeue

**Lua Script (GUARDIAN's proposal, refined):**
```lua
-- KEYS[1] = queue sorted set, KEYS[2] = pause flag, KEYS[3] = item hash prefix
local paused = redis.call('GET', KEYS[2])
if paused == '1' then return nil end
local items = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
if #items == 0 then return nil end
local item_json = items[1]
local item = cjson.decode(item_json)
if item.status ~= 'pending' then return nil end
item.status = 'processing'
redis.call('ZREM', KEYS[1], item_json)
redis.call('ZADD', KEYS[1], items[2], cjson.encode(item))
return cjson.encode(item)
```

### 3.3 Connection Management

**Conflict:**
- ARCHITECT, CRAFTSMAN, GUARDIAN: Per-request `redis.from_url()` (following existing pattern)
- OPTIMIZER: Shared connection pool singleton

**Resolution:**
Adopt OPTIMIZER's connection pool approach with conservative parameters.

**Rationale:**
- OPTIMIZER correctly identifies per-request connections as a performance bottleneck
- Connection pool aligns with existing PostgreSQL pool pattern (`DB_POOL_MAX_SIZE`)
- Reduces latency by 3-5x per operation
- Single change benefits all Redis usage, not just queue

**Recommended Pool Configuration:**
```python
REDIS_POOL_MAX_CONNECTIONS = int(os.getenv("REDIS_POOL_MAX_CONNECTIONS", "20"))
REDIS_POOL_MIN_CONNECTIONS = int(os.getenv("REDIS_POOL_MIN_CONNECTIONS", "5"))
REDIS_SOCKET_TIMEOUT = float(os.getenv("REDIS_SOCKET_TIMEOUT", "5.0"))
```

### 3.4 In-Memory Fallback

**Conflict:**
- OPTIMIZER: Full `asyncio.PriorityQueue`-based fallback with `HybridMessageQueue`
- CRAFTSMAN: InMemoryStore for tests only, not production fallback
- Others: No fallback specified

**Resolution:**
Implement OPTIMIZER's in-memory fallback but scope it to single-instance mode only.

**Rationale:**
- In-memory fallback provides graceful degradation when Redis is unavailable
- However, in distributed mode (multiple API instances), in-memory state causes inconsistency
- Solution: Use fallback only when `DISTRIBUTED_WORKERS=false` (sync mode)
- Add `QUEUE_FALLBACK_ENABLED` environment variable (default: false in production)

### 3.5 Error Handling Strategy

**Conflict:**
- ARCHITECT: Basic logging with existing patterns
- CRAFTSMAN: Service-layer exceptions, re-raise to routes
- GUARDIAN: Full exception hierarchy (`RetryableQueueError`, `PermanentQueueError`, etc.)
- OPTIMIZER: Circuit breaker pattern

**Resolution:**
Adopt GUARDIAN's exception hierarchy with OPTIMIZER's circuit breaker for Redis failures.

**Rationale:**
- GUARDIAN's exception classification (retryable vs permanent) enables intelligent retry logic
- Circuit breaker prevents cascade failures when Redis is degraded
- Consistent with existing `CheckpointError` pattern in `errors.py`

**Exception Hierarchy:**
```
QueueError (base)
  |-- RetryableQueueError (connection issues, timeouts)
  |-- PermanentQueueError (validation, authorization failures)
  |-- QueueCorruptionError (invalid state, needs recovery)
  |-- ConcurrentModificationError (optimistic lock conflict)
```

### 3.6 Concurrency Control

**Conflict:**
- ARCHITECT: Redis `WATCH/MULTI` for atomic dequeue
- GUARDIAN: Optimistic locking with version numbers + Lua scripts
- OPTIMIZER: Distributed lock with worker ID

**Resolution:**
Adopt GUARDIAN's optimistic locking for edits, Lua scripts for dequeue.

**Rationale:**
- Version numbers enable multi-tab conflict detection (GUARDIAN's insight)
- Lua scripts are more efficient than `WATCH/MULTI` for atomic read-modify-write
- Distributed locks add complexity without clear benefit (our workers self-chain, don't compete)

**Implementation:**
- `QueueItem.version: int` - incremented on each modification
- Edit operations require `expected_version` parameter
- Mismatched version raises `ConcurrentModificationError`

### 3.7 Frontend State Updates

**Conflict:**
- ARCHITECT: Redis Pub/Sub subscription for real-time updates
- CRAFTSMAN: Polling via GET endpoint initially, SSE enhancement later
- INTEGRATOR: SSE stream with `queue:*` event prefix

**Resolution:**
Adopt INTEGRATOR's SSE approach, extending existing stream.

**Rationale:**
- SSE is already established for message streaming
- Adding Pub/Sub introduces new connection management on frontend
- SSE extension is backward-compatible (clients ignore unknown event types)
- Polling fallback remains available via GET endpoint

**SSE Event Types (from INTEGRATOR):**
- `queue:added` - New message queued
- `queue:removed` - Message removed
- `queue:paused` / `queue:resumed` - Status changes
- `queue:updated` - Content edited
- `queue:reordered` - Position changed
- `queue:executing` - Next message started
- `queue:sync` - Full state on reconnection

---

## 4. Unified Implementation Plan

### 4.1 Recommended Architecture

```
+------------------+     +------------------+     +------------------+
|    Frontend      |     |    Backend       |     |     Redis        |
|                  |     |                  |     |                  |
|  ChatInput       |---->|  QueueRoutes     |---->| queue:{user}:    |
|  QueuePanel      |<----|  QueueService    |<----| {thread}:messages|
|  useMessageQueue |     |  (Pool Singleton)|     | (ZSET)           |
+------------------+     +------------------+     |                  |
        ^                       |                 | queue:{user}:    |
        |                       v                 | {thread}:items   |
        |                +------------------+     | (Hash per item)  |
        |                |  TaskIQ Worker   |     |                  |
        |                |                  |     | queue:{user}:    |
        +---- SSE -------|  on [DONE]:      |     | {thread}:status  |
                         |  Lua atomic pop  |     | (String)         |
                         |  self-chain kiq()|     +------------------+
                         +------------------+
```

### 4.2 Data Model (Unified)

**Redis Keys:**
```
queue:{user_id}:{thread_id}:messages     # ZSET - score=timestamp, member=item_id
queue:{user_id}:{thread_id}:items:{id}   # Hash - full item payload
queue:{user_id}:{thread_id}:status       # String - "idle" | "processing" | "paused"
queue:{user_id}:{thread_id}:current      # String - current processing item_id
queue:{user_id}:{thread_id}:lock         # String - worker_id (30s TTL for crash recovery)
```

**Pydantic Schema (`backend/src/schemas/entities/queue.py`):**
```python
class QueueItemStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class QueueStatus(str, Enum):
    IDLE = "idle"
    PROCESSING = "processing"
    PAUSED = "paused"

class QueuedMessage(BaseModel):
    id: str
    content: str
    status: QueueItemStatus
    position: int
    version: int = 1  # Optimistic locking
    created_at: datetime
    updated_at: Optional[datetime]
    metadata: Dict[str, Any] = {}

class QueueState(BaseModel):
    thread_id: str
    user_id: str
    status: QueueStatus
    messages: List[QueuedMessage]
    current_message_id: Optional[str]
```

### 4.3 Implementation Sequence

**Phase 1: Foundation (Days 1-2)**

| Task | Files | Owner Focus |
|------|-------|-------------|
| Create Redis connection pool singleton | `backend/src/utils/redis_pool.py` | OPTIMIZER |
| Define Pydantic queue schemas | `backend/src/schemas/entities/queue.py` | CRAFTSMAN |
| Define TypeScript queue types | `frontend/src/lib/entities/queue.ts` | INTEGRATOR |
| Implement `QueueService` core methods | `backend/src/services/queue.py` | ARCHITECT |
| Add exception hierarchy | `backend/src/services/errors.py` | GUARDIAN |
| Unit tests for service | `backend/tests/unit/services/test_queue_service.py` | GUARDIAN |

**Phase 2: Worker Integration (Days 2-3)**

| Task | Files | Owner Focus |
|------|-------|-------------|
| Implement atomic dequeue Lua script | `backend/src/services/queue.py` | GUARDIAN |
| Modify `run_agent_stream` for queue check | `backend/src/workers/tasks.py` | ARCHITECT |
| Modify `/llm/stream` for enqueue-if-busy | `backend/src/routes/v0/llm.py` | ARCHITECT |
| Integration tests for queue flow | `backend/tests/integration/test_queue_flow.py` | GUARDIAN |

**Phase 3: API Endpoints (Days 3-4)**

| Task | Files | Owner Focus |
|------|-------|-------------|
| Create queue route handlers | `backend/src/routes/v0/queue.py` | INTEGRATOR |
| Add authorization checks | `backend/src/routes/v0/queue.py` | GUARDIAN |
| Implement SSE queue events | `backend/src/utils/stream.py` | INTEGRATOR |
| Create frontend queueService | `frontend/src/lib/services/queueService.ts` | INTEGRATOR |
| API integration tests | `backend/tests/integration/test_queue_routes.py` | GUARDIAN |

**Phase 4: Frontend Integration (Days 4-5)**

| Task | Files | Owner Focus |
|------|-------|-------------|
| Create `useMessageQueue` hook | `frontend/src/hooks/useMessageQueue.ts` | ARCHITECT |
| Create `QueuePanel` component | `frontend/src/components/queue/QueuePanel.tsx` | CRAFTSMAN |
| Create `QueueItem` component | `frontend/src/components/queue/QueueItem.tsx` | CRAFTSMAN |
| Integrate into `ChatInput` | `frontend/src/components/inputs/ChatInput.tsx` | ARCHITECT |
| Handle SSE queue events in `useChat` | `frontend/src/hooks/useChat.ts` | INTEGRATOR |
| Frontend tests | `frontend/src/tests/` | CRAFTSMAN |

**Phase 5: Hardening (Day 6)**

| Task | Files | Owner Focus |
|------|-------|-------------|
| Add circuit breaker for Redis | `backend/src/services/queue.py` | OPTIMIZER |
| Implement in-memory fallback | `backend/src/services/queue_fallback.py` | OPTIMIZER |
| Add rate limiting to queue endpoints | `backend/src/routes/v0/queue.py` | GUARDIAN |
| Cleanup task for stale items | `backend/src/workers/tasks.py` | OPTIMIZER |
| Edge case tests | `backend/tests/unit/services/test_queue_edge_cases.py` | GUARDIAN |

### 4.4 Critical Path Items

These items block subsequent work and must be completed first:

1. **Redis Connection Pool** - All Redis operations depend on this
2. **Pydantic Schemas** - Service layer and routes depend on these
3. **QueueService Core** - Worker integration and routes depend on this
4. **Lua Dequeue Script** - Worker integration depends on atomic operations
5. **Worker `[DONE]` Handler** - End-to-end flow depends on this

### 4.5 File Inventory

**New Backend Files:**
```
backend/src/utils/redis_pool.py              # Connection pool singleton
backend/src/schemas/entities/queue.py        # Pydantic models
backend/src/services/queue.py                # QueueService
backend/src/services/queue_fallback.py       # In-memory fallback (optional)
backend/src/routes/v0/queue.py               # REST endpoints
backend/tests/unit/services/test_queue_service.py
backend/tests/unit/schemas/test_queue_schemas.py
backend/tests/integration/test_queue_routes.py
backend/tests/integration/test_queue_flow.py
```

**Modified Backend Files:**
```
backend/src/workers/tasks.py                 # Queue check on [DONE]
backend/src/routes/v0/llm.py                 # Enqueue if busy
backend/src/routes/v0/__init__.py            # Register queue router
backend/src/utils/stream.py                  # SSE queue events
backend/src/services/errors.py               # Exception hierarchy
backend/src/constants/__init__.py            # Pool config constants
```

**New Frontend Files:**
```
frontend/src/lib/entities/queue.ts           # TypeScript types
frontend/src/lib/services/queueService.ts    # API client
frontend/src/hooks/useMessageQueue.ts        # Queue state hook
frontend/src/components/queue/QueuePanel.tsx # Queue display
frontend/src/components/queue/QueueItem.tsx  # Individual item
frontend/src/tests/hooks/useMessageQueue.test.ts
frontend/src/tests/components/QueuePanel.test.tsx
```

**Modified Frontend Files:**
```
frontend/src/components/inputs/ChatInput.tsx # Integrate QueuePanel
frontend/src/hooks/useChat.ts                # Handle queue SSE events
frontend/src/lib/entities/stream.ts          # Queue event types
frontend/src/lib/services/index.ts           # Export queueService
frontend/src/lib/entities/index.ts           # Export queue types
```

---

## 5. Risk Consolidation

### 5.1 Technical Risks

| Risk | Severity | Likelihood | Mitigation | Owner |
|------|----------|------------|------------|-------|
| **Race condition: [DONE] vs pause** | High | Medium | Lua atomic script | GUARDIAN |
| **Redis connection exhaustion** | Medium | Medium | Connection pool with limits | OPTIMIZER |
| **Worker crash mid-processing** | Medium | Low | Lock TTL auto-expire (30s) | GUARDIAN |
| **Concurrent edit conflict** | Medium | Medium | Optimistic locking with version | GUARDIAN |
| **Queue memory growth** | Medium | Low | Per-thread limit (50 items), TTL cleanup | OPTIMIZER |
| **SSE stream complexity** | Medium | Medium | Separate event handlers, type guards | INTEGRATOR |

### 5.2 Security Risks

| Risk | Severity | Likelihood | Mitigation | Owner |
|------|----------|------------|------------|-------|
| **IDOR on queue items** | High | Medium | Item ownership verification + user namespace | GUARDIAN |
| **Queue flooding (DoS)** | High | Medium | Rate limiting + max queue length | GUARDIAN |
| **Cross-user data leak** | High | Low | `{user_id}:{thread_id}` namespacing | GUARDIAN |
| **Content injection** | Medium | Low | Input sanitization + max length | GUARDIAN |

### 5.3 Integration Risks

| Risk | Severity | Likelihood | Mitigation | Owner |
|------|----------|------------|------------|-------|
| **Frontend-backend schema drift** | Medium | Medium | Generate TS from OpenAPI | INTEGRATOR |
| **SSE reconnection state loss** | Medium | Medium | `queue:sync` event on reconnect | INTEGRATOR |
| **Existing flow regression** | Medium | Low | Feature flag for gradual rollout | ARCHITECT |

### 5.4 Operational Risks

| Risk | Severity | Likelihood | Mitigation | Owner |
|------|----------|------------|------------|-------|
| **Redis unavailable** | Medium | Low | In-memory fallback (sync mode only) | OPTIMIZER |
| **Stale queues consuming memory** | Low | Medium | TTL (24h) + periodic cleanup | OPTIMIZER |
| **Zombie processing state** | Low | Low | Lock TTL + recovery scan | GUARDIAN |

---

## 6. Final Verdict

### 6.1 Recommendation: **CONDITIONAL GO**

The Elite Council recommends proceeding with implementation, subject to the following conditions:

### 6.2 Mandatory Conditions (Must Have)

1. **Atomic Dequeue Implementation**: The Lua script for atomic pause-check-and-pop MUST be implemented before worker integration. This is non-negotiable for preventing race conditions.

2. **User-Scoped Namespacing**: Queue keys MUST include `user_id` to prevent IDOR vulnerabilities. Pattern: `queue:{user_id}:{thread_id}:*`.

3. **Optimistic Locking**: Edit operations MUST include version checking to handle concurrent modifications gracefully.

4. **Test Coverage**: Unit tests for `QueueService` MUST achieve 90%+ coverage before merging, with explicit tests for:
   - Authorization checks
   - Race conditions (pause during dequeue)
   - Concurrent modifications
   - Edge cases (empty queue, max length)

5. **Rate Limiting**: Queue endpoints MUST have rate limits before production deployment:
   - Enqueue: 60/minute per user
   - Operations: 120/minute aggregate

### 6.3 Recommended Conditions (Should Have)

1. **Connection Pool**: Implement Redis connection pool singleton for performance, but the feature can ship with per-request connections if pool implementation is delayed.

2. **In-Memory Fallback**: Nice to have for resilience, but can be deferred to post-MVP if it delays delivery.

3. **Circuit Breaker**: Should be implemented but can follow shortly after initial release.

### 6.4 Confidence Level

| Aspect | Confidence |
|--------|------------|
| Technical Feasibility | **HIGH** (95%) - Well-established patterns, clear references |
| Timeline (6 days) | **MEDIUM** (75%) - Realistic if no major blockers |
| Security | **HIGH** (90%) - GUARDIAN's comprehensive analysis |
| Performance | **HIGH** (85%) - OPTIMIZER's Redis expertise |
| API Design | **HIGH** (90%) - INTEGRATOR's clear contracts |
| UX Impact | **MEDIUM** (70%) - Frontend design needs user validation |

### 6.5 Council Sign-Off

| Council Member | Vote | Notes |
|----------------|------|-------|
| ARCHITECT | **GO** | Solid design extending proven patterns |
| CRAFTSMAN | **GO** | Clean separation of concerns, testable |
| GUARDIAN | **CONDITIONAL GO** | Pending mandatory security conditions |
| OPTIMIZER | **GO** | Performance acceptable, pool improves it |
| INTEGRATOR | **GO** | API contracts are clear and backward-compatible |

---

## Appendix A: Quick Reference

### API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/threads/{thread_id}/queue` | List queued messages |
| `POST` | `/threads/{thread_id}/queue` | Add message to queue |
| `GET` | `/threads/{thread_id}/queue/{queue_id}` | Get specific message |
| `PATCH` | `/threads/{thread_id}/queue/{queue_id}` | Edit message |
| `DELETE` | `/threads/{thread_id}/queue/{queue_id}` | Remove message |
| `POST` | `/threads/{thread_id}/queue/{queue_id}/pause` | Pause message |
| `POST` | `/threads/{thread_id}/queue/{queue_id}/resume` | Resume message |
| `POST` | `/threads/{thread_id}/queue/reorder` | Bulk reorder |

### State Machine

```
                    +--------+
                    | PENDING|<---------+
                    +--------+          |
                        |               |
                +-------+-------+       |
                |               |       |
                v               v       |
          +----------+    +--------+    |
          |PROCESSING|    | PAUSED |----+
          +----------+    +--------+
                |
        +-------+-------+
        |               |
        v               v
  +-----------+    +--------+
  | COMPLETED |    | FAILED |
  +-----------+    +--------+
```

Valid transitions:
- PENDING -> PROCESSING, PAUSED, CANCELLED
- PROCESSING -> COMPLETED, FAILED, CANCELLED
- PAUSED -> PENDING, CANCELLED
- FAILED -> PENDING (retry)

### Redis Key Quick Reference

```
queue:{user_id}:{thread_id}:messages     # ZSET
queue:{user_id}:{thread_id}:items:{id}   # Hash
queue:{user_id}:{thread_id}:status       # String
queue:{user_id}:{thread_id}:current      # String
queue:{user_id}:{thread_id}:lock         # String (30s TTL)
```

---

*Review completed by the Elite Council on 2026-01-19*
