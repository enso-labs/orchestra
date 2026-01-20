# Message Queue System for DeepAgents - Optimizer Proposal

**Agent**: AGENT_4: OPTIMIZER
**Expertise**: Performance, Efficiency, Resource Management, Redis Optimization
**Date**: 2026-01-19

---

## 1. Executive Summary

I recommend implementing a Redis Sorted Set-based message queue with per-user/per-thread namespacing, leveraging the existing `redis.asyncio` patterns established in `broker.py`, `stream.py`, and `abort.py`. The system should use a single Redis connection pool shared across the application to minimize connection overhead, with TTL-based automatic cleanup and an in-memory fallback using Python's `asyncio.Queue` for resilience.

---

## 2. Architectural Analysis

### 2.1 Current Performance Characteristics

**Redis Usage Patterns Observed:**

| Component | Redis Feature | Connection Pattern | TTL Strategy |
|-----------|--------------|-------------------|--------------|
| `broker.py` | Redis Streams (TaskIQ) | Broker-managed pool | 300s result TTL |
| `stream.py` | Redis Streams + XREAD | Per-request `redis.from_url()` | 300s stream TTL |
| `abort.py` | Redis Keys (GET/SET) | Per-request `redis.from_url()` | 300s signal TTL |

**Performance Bottlenecks Identified:**

1. **Connection Proliferation**: Each call to `redis.from_url()` creates a new connection. In `stream.py:stream_from_redis()` and `abort.py`, this creates significant connection churn, especially under concurrent load.

2. **No Connection Pooling**: Unlike the PostgreSQL patterns (`DB_POOL_MIN_SIZE`, `DB_POOL_MAX_SIZE`), Redis connections are not pooled. This creates latency spikes during connection establishment (~1-5ms per connection).

3. **Stream Cleanup Reliance**: The 300-second TTL on streams means stale data can persist, and the `xdelete` pattern before writing (line 67 of `tasks.py`) adds a round-trip per task start.

### 2.2 Redis Data Structure Recommendations

For the message queue, I recommend **Redis Sorted Sets** over Lists:

| Feature | Redis List (LPUSH/RPOP) | Redis Sorted Set (ZADD/ZRANGE) |
|---------|------------------------|-------------------------------|
| FIFO Ordering | Native | Via timestamp scores |
| Priority Support | Requires multiple lists | Built-in via scores |
| Pause/Edit/Remove | O(n) LREM | O(log n) ZREM by member |
| Position Inspection | O(n) LINDEX | O(log n) ZRANK |
| Batch Operations | Limited | ZRANGEBYSCORE, ZPOPMIN |

**Recommendation**: Sorted Set with `score = timestamp` for natural FIFO ordering, with pause states stored as negative scores (blocked items sort to beginning but are skipped during dequeue).

### 2.3 Connection Efficiency Analysis

**Current Pattern (Per-Request)**:
```python
# stream.py:298 - Creates new connection per stream
redis_client = redis.from_url(REDIS_URL)
# ... use ...
await redis_client.aclose()
```

**Recommended Pattern (Connection Pool)**:
```python
# Shared connection pool singleton
from redis.asyncio import ConnectionPool, Redis

_pool: ConnectionPool | None = None

async def get_redis_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool.from_url(
            REDIS_URL,
            max_connections=20,  # Match DB_POOL_MAX_SIZE
            decode_responses=False,
        )
    return _pool

async def get_redis() -> Redis:
    pool = await get_redis_pool()
    return Redis(connection_pool=pool)
```

**Connection Pool Sizing Recommendation**:
- `max_connections`: 20 (aligned with `DB_POOL_MAX_SIZE`)
- `min_connections`: 5 (for warm pool under low load)
- `socket_timeout`: 5.0 seconds
- `socket_connect_timeout`: 2.0 seconds

---

## 3. Implementation Strategy

### 3.1 Optimal Redis Data Structures

**Queue Storage Schema**:

```
# Per-user queue (Sorted Set)
Key: queue:messages:{user_id}
Score: timestamp (float, Unix epoch with microseconds)
Member: JSON-serialized QueuedMessage

# Queue item state (Hash)
Key: queue:state:{user_id}:{message_id}
Fields:
  - status: "pending" | "processing" | "paused"
  - created_at: ISO timestamp
  - thread_id: string
  - priority: int (default 0)
  - payload: JSON blob
  - pause_reason: string (optional)

# Processing lock (String with TTL)
Key: queue:lock:{user_id}
Value: worker_id
TTL: 30 seconds (prevents zombie locks)
```

**Why This Structure**:

1. **Sorted Set for Queue**: O(log n) insert/remove, natural ordering by timestamp
2. **Hash for State**: Allows atomic field updates (pause without full re-serialize)
3. **Lock Key**: Prevents race conditions when multiple workers try to dequeue

### 3.2 TTL and Cleanup Strategies

| Key Pattern | TTL | Cleanup Strategy |
|-------------|-----|------------------|
| `queue:messages:{user_id}` | None | Explicit ZREM after processing |
| `queue:state:{user_id}:{msg_id}` | 3600s (1 hour) | Auto-expire + periodic sweep |
| `queue:lock:{user_id}` | 30s | Auto-expire + heartbeat extension |

**Cleanup Implementation**:

```python
# Periodic cleanup task (every 5 minutes)
async def cleanup_stale_queue_items():
    """Remove queue items older than 1 hour that are still pending."""
    cutoff = time.time() - 3600
    async for key in redis.scan_iter("queue:messages:*"):
        # Remove items with score < cutoff
        await redis.zremrangebyscore(key, 0, cutoff)
```

### 3.3 Polling vs Pub/Sub for Queue Processing

| Approach | Latency | Resource Usage | Complexity | Recommendation |
|----------|---------|----------------|------------|----------------|
| **BLPOP/BZPOPMIN** | ~0ms (blocking) | Low (single conn) | Low | **Preferred** |
| Pub/Sub | ~0ms | Medium (dedicated conn) | Medium | Not for queues |
| Polling (ZRANGE) | 100-500ms intervals | Higher (periodic) | Low | Fallback only |

**Recommendation**: Use `BZPOPMIN` (blocking pop from sorted set) for the worker consumer. This provides:
- Zero-latency message delivery when available
- Connection held open (reuses pool connection)
- Automatic retry on timeout

```python
async def dequeue_next(user_id: str, timeout: float = 5.0) -> QueuedMessage | None:
    """Blocking dequeue with timeout."""
    key = f"queue:messages:{user_id}"
    result = await redis.bzpopmin(key, timeout=timeout)
    if result:
        _, member, score = result
        return QueuedMessage.model_validate_json(member)
    return None
```

### 3.4 Batch Processing Considerations

For high-throughput scenarios, batch operations reduce round-trips:

```python
async def enqueue_batch(user_id: str, messages: list[QueuedMessage]) -> int:
    """Enqueue multiple messages atomically."""
    key = f"queue:messages:{user_id}"
    # Use pipeline for atomic batch insert
    async with redis.pipeline(transaction=True) as pipe:
        for msg in messages:
            score = msg.created_at.timestamp()
            pipe.zadd(key, {msg.model_dump_json(): score})
        results = await pipe.execute()
    return sum(results)
```

**Batch Dequeue Pattern** (for catching up):

```python
async def dequeue_batch(user_id: str, count: int = 10) -> list[QueuedMessage]:
    """Non-blocking batch dequeue."""
    key = f"queue:messages:{user_id}"
    # ZPOPMIN with count is atomic
    results = await redis.zpopmin(key, count=count)
    return [QueuedMessage.model_validate_json(m) for m, _ in results]
```

---

## 4. Design Decisions

### 4.1 Redis List vs Sorted Set for Queue Ordering

**Decision**: Use Sorted Set (ZSET)

**Rationale**:

| Criterion | List | Sorted Set | Winner |
|-----------|------|------------|--------|
| FIFO ordering | Native | Score-based | Tie |
| Remove by ID | O(n) LREM | O(log n) ZREM | **ZSET** |
| Edit in place | Not possible | Update score/member | **ZSET** |
| Pause (reorder) | Complex | Score manipulation | **ZSET** |
| Memory overhead | Lower | ~24 bytes/item more | List |
| Position lookup | O(n) | O(log n) ZRANK | **ZSET** |

The 24 bytes/item overhead is acceptable given our expected queue depth (typically <100 items per user).

### 4.2 In-Memory Fallback Implementation

**Design**: Use `asyncio.Queue` with `asyncio.PriorityQueue` semantics via wrapper class.

```python
from asyncio import PriorityQueue
from dataclasses import dataclass, field
from typing import Any

@dataclass(order=True)
class PrioritizedItem:
    priority: float  # Lower = higher priority (timestamp)
    item: Any = field(compare=False)

class InMemoryMessageQueue:
    """Fallback queue when Redis is unavailable."""

    def __init__(self, maxsize: int = 1000):
        self._queue: PriorityQueue[PrioritizedItem] = PriorityQueue(maxsize)
        self._items: dict[str, QueuedMessage] = {}  # For edit/remove by ID
        self._paused: set[str] = set()

    async def enqueue(self, message: QueuedMessage) -> None:
        item = PrioritizedItem(
            priority=message.created_at.timestamp(),
            item=message
        )
        await self._queue.put(item)
        self._items[message.id] = message

    async def dequeue(self) -> QueuedMessage | None:
        while not self._queue.empty():
            item = await self._queue.get()
            if item.item.id in self._paused:
                continue  # Skip paused items
            del self._items[item.item.id]
            return item.item
        return None

    def pause(self, message_id: str) -> bool:
        if message_id in self._items:
            self._paused.add(message_id)
            return True
        return False

    def remove(self, message_id: str) -> bool:
        if message_id in self._items:
            del self._items[message_id]
            self._paused.discard(message_id)
            return True
        return False
```

**Limitations of In-Memory Fallback**:
- Not persistent across restarts
- Not shared across multiple API instances
- Limited by process memory

**Failover Strategy**:
```python
class HybridMessageQueue:
    """Redis-primary with in-memory fallback."""

    def __init__(self, redis: Redis, fallback: InMemoryMessageQueue):
        self._redis = redis
        self._fallback = fallback
        self._use_fallback = False

    async def enqueue(self, message: QueuedMessage) -> None:
        try:
            await self._redis_enqueue(message)
            self._use_fallback = False
        except RedisError:
            logger.warning("Redis unavailable, using in-memory fallback")
            self._use_fallback = True
            await self._fallback.enqueue(message)
```

### 4.3 Connection Pool Sizing Recommendations

Based on the observed patterns and expected concurrency:

| Parameter | Recommended Value | Rationale |
|-----------|------------------|-----------|
| `max_connections` | 20 | Match `DB_POOL_MAX_SIZE` for consistency |
| `min_connections` | 5 | Warm pool, avoid cold starts |
| `socket_timeout` | 5.0s | Long enough for BZPOPMIN, short enough to detect failures |
| `socket_connect_timeout` | 2.0s | Fast failure for connection issues |
| `health_check_interval` | 30s | Detect stale connections |
| `retry_on_timeout` | True | Handle transient timeouts |

**Environment Variables to Add**:
```python
# New constants in backend/src/constants/__init__.py
REDIS_POOL_MAX_CONNECTIONS = int(os.getenv("REDIS_POOL_MAX_CONNECTIONS", "20"))
REDIS_POOL_MIN_CONNECTIONS = int(os.getenv("REDIS_POOL_MIN_CONNECTIONS", "5"))
REDIS_SOCKET_TIMEOUT = float(os.getenv("REDIS_SOCKET_TIMEOUT", "5.0"))
REDIS_CONNECT_TIMEOUT = float(os.getenv("REDIS_CONNECT_TIMEOUT", "2.0"))
```

---

## 5. Risk Assessment

### 5.1 Performance Bottlenecks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Connection pool exhaustion | Medium | High (blocking) | Monitor pool usage, increase `max_connections` |
| Redis memory pressure | Low | Medium | TTLs + cleanup task + `maxmemory-policy` |
| Hot key contention | Low | Medium | Per-user namespacing distributes load |
| BZPOPMIN starvation | Low | Low | Timeout fallback + health checks |

**Monitoring Recommendations**:
```python
# Add to WorkerState.get_metrics()
redis_metrics = {
    "pool_size": pool.size,
    "pool_available": pool.available,
    "queue_depth": await redis.zcard(f"queue:messages:{user_id}"),
    "processing_items": await redis.hlen("queue:state:*"),
}
```

### 5.2 Memory Pressure Scenarios

**Scenario 1: Rapid Message Accumulation**
- Cause: Slow agent processing, user queuing many messages
- Detection: `ZCARD queue:messages:{user_id} > 100`
- Mitigation: Backpressure (reject new items when queue full)

**Scenario 2: Paused Items Accumulating**
- Cause: Many paused messages never resumed
- Detection: Periodic scan for paused items > 1 hour old
- Mitigation: Auto-expire paused items after configurable duration

**Redis Memory Configuration**:
```redis
# Recommended redis.conf settings
maxmemory 256mb
maxmemory-policy volatile-lru  # Evict keys with TTL first
```

### 5.3 Redis Failure Handling

**Failure Modes and Responses**:

| Failure Mode | Detection | Response |
|--------------|-----------|----------|
| Connection timeout | `TimeoutError` | Retry with exponential backoff |
| Redis down | `ConnectionError` | Switch to in-memory fallback |
| Memory full | `OOM` error | Reject new enqueues, alert |
| Network partition | Partial failures | Circuit breaker pattern |

**Circuit Breaker Implementation**:
```python
class RedisCircuitBreaker:
    def __init__(self, failure_threshold: int = 5, reset_timeout: float = 30.0):
        self.failures = 0
        self.last_failure_time = 0.0
        self.state = "closed"  # closed, open, half-open

    async def call(self, operation: Callable) -> Any:
        if self.state == "open":
            if time.time() - self.last_failure_time > self.reset_timeout:
                self.state = "half-open"
            else:
                raise CircuitOpenError("Redis circuit breaker open")

        try:
            result = await operation()
            if self.state == "half-open":
                self.state = "closed"
                self.failures = 0
            return result
        except RedisError:
            self.failures += 1
            self.last_failure_time = time.time()
            if self.failures >= self.failure_threshold:
                self.state = "open"
            raise
```

---

## 6. Estimated Complexity

### 6.1 Scope Assessment

**Scope**: **Medium**

| Component | Effort | Dependencies |
|-----------|--------|--------------|
| Redis connection pool singleton | 2 hours | None |
| Queue data model (Pydantic) | 1 hour | None |
| Redis queue operations | 4 hours | Pool |
| In-memory fallback | 2 hours | Data model |
| Queue manager service | 4 hours | All above |
| API endpoints (pause/edit/remove) | 3 hours | Queue service |
| Frontend integration | 4 hours | Backend APIs |
| [DONE] signal integration | 2 hours | tasks.py modification |
| Tests | 4 hours | All components |

**Total Estimated Effort**: ~26 hours (3-4 days for single developer)

### 6.2 Risk Level

**Risk Level**: **Medium**

Rationale:
- Builds on existing patterns (abort signals, stream handling)
- Redis already in use and proven stable
- No database schema changes required
- In-memory fallback provides resilience

Higher risk factors:
- Modifying `tasks.py` execution flow (triggers next from queue)
- Concurrency edge cases in pause/edit while processing
- Frontend state management for queue UI

### 6.3 Suggested Priority Order

1. **Phase 1: Foundation** (Priority: Critical)
   - Redis connection pool singleton
   - Queue data models
   - Basic enqueue/dequeue operations

2. **Phase 2: Queue Processing** (Priority: High)
   - `[DONE]` signal integration in `tasks.py`
   - Sequential execution from queue
   - Basic pause/remove operations

3. **Phase 3: Resilience** (Priority: Medium)
   - In-memory fallback
   - Circuit breaker pattern
   - Cleanup tasks

4. **Phase 4: Frontend** (Priority: Medium)
   - Queue status display
   - Pause/edit/remove UI controls
   - Real-time queue updates

---

## 7. API Design Recommendations

### 7.1 Queue Endpoints

```
POST   /api/queue/messages              # Enqueue message
GET    /api/queue/messages              # List queued messages
GET    /api/queue/messages/{id}         # Get queue item
PATCH  /api/queue/messages/{id}         # Edit queued message
DELETE /api/queue/messages/{id}         # Remove from queue
POST   /api/queue/messages/{id}/pause   # Pause item
POST   /api/queue/messages/{id}/resume  # Resume item
GET    /api/queue/status                # Queue health/metrics
```

### 7.2 WebSocket Events (Optional Enhancement)

For real-time queue updates:
```typescript
// Frontend subscription
ws.on("queue:item:added", (item) => addToUI(item))
ws.on("queue:item:completed", (id) => removeFromUI(id))
ws.on("queue:item:paused", (id) => markPaused(id))
```

---

## 8. Performance Projections

### 8.1 Latency Improvements

| Operation | Current (No Pool) | With Pool | Improvement |
|-----------|------------------|-----------|-------------|
| Enqueue | ~8ms | ~2ms | 4x faster |
| Dequeue (blocking) | ~8ms + poll | ~2ms | 4x faster |
| Abort signal check | ~5ms | ~1ms | 5x faster |
| Stream read | ~6ms | ~2ms | 3x faster |

### 8.2 Throughput Capacity

With recommended pool size of 20 connections:
- Concurrent queue operations: ~500/s per instance
- Message processing: Bounded by agent execution time, not queue
- Redis memory for 10K queued items: ~5MB (negligible)

---

## 9. Summary

This proposal recommends a **Redis Sorted Set-based queue** with:

1. **Connection pooling** to eliminate per-request connection overhead
2. **Per-user namespacing** for isolation and scalability
3. **BZPOPMIN blocking dequeue** for zero-latency message delivery
4. **In-memory fallback** using asyncio.PriorityQueue for resilience
5. **TTL-based cleanup** with periodic sweep for stale items
6. **Circuit breaker** pattern for graceful Redis failure handling

The implementation builds naturally on existing patterns in `abort.py` and `stream.py`, requiring **medium scope** effort (~26 hours) with **medium risk** level.

---

*Prepared by AGENT_4: OPTIMIZER*
