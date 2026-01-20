# PROPOSAL_GUARDIAN.md
# Message Queue System for DeepAgents

**Author**: AGENT_3 (GUARDIAN)
**Expertise Lens**: Security, Error Handling, Edge Cases, Testing
**Date**: 2026-01-19

---

## 1. Executive Summary

The message queue system introduces a backend-driven queue allowing users to submit multiple messages without waiting for completion. This proposal focuses on security controls ensuring per-item authorization, comprehensive error handling with graceful recovery, and a robust testing strategy. The design leverages existing patterns from `AbortService` for Redis-based state management and `ResilientAsyncPostgresSaver` for retry logic, minimizing new attack surfaces while ensuring data integrity through transactional queue operations.

---

## 2. Architectural Analysis

### 2.1 Security Concerns with Queue Management

**2.1.1 Authorization Model**

The queue system must enforce authorization at multiple levels:

1. **Queue-Level Authorization**: Each queue is scoped to a `(user_id, thread_id)` tuple
   - Users can only access their own queues
   - Thread ownership verified via existing `ThreadService.get()` pattern
   - Queue keys follow pattern: `queue:{user_id}:{thread_id}`

2. **Item-Level Authorization**: Each queue item must carry verification metadata
   - Store `submitted_by` user_id with each item
   - Verify item ownership before edit/remove operations
   - Prevent cross-user queue manipulation via IDOR attacks

3. **Operation-Level Authorization**: Different operations require different checks
   - `add`: User must own thread or thread must be new (first message)
   - `edit/remove/pause`: User must own both thread and specific queue item
   - `resume`: Only paused items by same user can be resumed

**Existing Pattern Reference** (from `abort.py`):
```python
# The abort service already implements thread ownership verification
async def _verify_thread_ownership_if_exists(self, thread_id: str) -> None:
    thread = await self.thread_service.get(thread_id)
    if thread and thread.metadata:
        thread_user_id = thread.metadata.get("user_id")
        if thread_user_id and str(thread_user_id) != str(self.user_id):
            raise PermissionError(f"Not authorized")
```

**2.1.2 Input Validation Requirements**

All queue operations must validate:

| Field | Validation | Attack Prevention |
|-------|------------|-------------------|
| `thread_id` | UUID format, max 36 chars | SQL injection, path traversal |
| `message_content` | Max 100KB, sanitize control chars | DoS, injection |
| `position` | Integer, within queue bounds | Index manipulation |
| `item_id` | UUID format, ownership verified | IDOR attacks |

**2.1.3 Rate Limiting Strategy**

Extend existing `slowapi` limiter:
```python
# Current: "200/day" default
# Queue-specific limits:
QUEUE_ADD_LIMIT = "60/minute"      # Prevent queue flooding
QUEUE_EDIT_LIMIT = "30/minute"     # Prevent edit storms
QUEUE_OPERATIONS_LIMIT = "120/minute"  # Aggregate operations
```

**2.1.4 Data Sanitization**

Following the pattern from `errors.py`:
```python
# Sanitize sensitive data from queue items before logging
SANITIZE_PATTERNS = [
    r"password=[^\s&]+",
    r"api[_-]?key=[^\s&]+",
    r"bearer\s+[A-Za-z0-9\-._~+/]+=*",
]
```

### 2.2 Error Scenarios to Handle

**2.2.1 Redis Connection Failures**

| Scenario | Detection | Recovery Strategy |
|----------|-----------|-------------------|
| Redis unavailable at startup | Connection timeout | Return 503, retry with backoff |
| Connection dropped mid-operation | `ConnectionResetError` | Reconnect, retry operation |
| Redis memory exhausted | `OOM` error | Implement eviction, alert |
| Stream corruption | Invalid data format | Log, skip item, continue |

**2.2.2 Queue State Corruption**

| Scenario | Prevention | Recovery |
|----------|------------|----------|
| Partial write (item added, metadata not updated) | Use Redis transactions (`MULTI/EXEC`) | Reconciliation job |
| Orphaned items (thread deleted, queue remains) | TTL-based cleanup | Garbage collection task |
| Duplicate processing | Idempotency keys per item | Skip already-processed |
| Stale pause state | Heartbeat/TTL on pause | Auto-expire paused items |

**2.2.3 Message Processing Failures**

| Scenario | Handling | User Impact |
|----------|----------|-------------|
| LLM API timeout | Retry 3x with backoff | Queue proceeds, item marked failed |
| LLM rate limit | Exponential backoff, circuit breaker | Temporary queue pause |
| Invalid message format | Validation error, skip item | Notify user, move to next |
| Agent crash mid-stream | Checkpoint recovery | Resume from last checkpoint |

### 2.3 Race Condition Analysis

**2.3.1 Concurrent Queue Modifications**

```
Timeline 1: User edits item at position 2
Timeline 2: Previous item completes, shifts queue

Result: Edit applied to wrong item
```

**Mitigation**: Use item UUIDs instead of positional references:
```python
@dataclass
class QueueItem:
    id: str = field(default_factory=lambda: str(uuid4()))  # Stable identifier
    thread_id: str
    user_id: str
    content: dict
    status: QueueItemStatus
    position: int  # For display ordering only, not operations
```

**2.3.2 [DONE] Signal Race**

```
Timeline 1: Worker sends [DONE] for message A
Timeline 2: User pauses queue
Timeline 3: Queue processor receives [DONE], starts message B

Result: Paused queue still processes one more message
```

**Mitigation**: Check pause state atomically with queue pop:
```python
async def pop_next_if_not_paused(queue_key: str, lock_key: str) -> Optional[QueueItem]:
    # Atomic check-and-pop using Lua script
    script = """
    local paused = redis.call('GET', KEYS[2])
    if paused == '1' then return nil end
    return redis.call('LPOP', KEYS[1])
    """
    return await redis_client.eval(script, keys=[queue_key, lock_key])
```

**2.3.3 Multiple Tab/Client Race**

```
User has 2 tabs open, both try to edit same queue
```

**Mitigation**: Optimistic concurrency with version numbers:
```python
class QueueItem:
    version: int = 1  # Increment on each modification

async def update_item(item_id: str, changes: dict, expected_version: int):
    # Only update if version matches
    result = await redis_client.eval(
        VERSION_CHECK_UPDATE_SCRIPT,
        keys=[item_key],
        args=[expected_version, json.dumps(changes)]
    )
    if result == 0:
        raise ConcurrentModificationError("Item was modified by another client")
```

**2.3.4 Worker Claiming Race**

Multiple workers competing for the same queue item.

**Mitigation**: Distributed lock with worker ID:
```python
async def claim_next_item(queue_key: str, worker_id: str, lock_ttl: int = 300):
    lock_key = f"{queue_key}:lock"
    # Atomic claim with SET NX
    claimed = await redis_client.set(lock_key, worker_id, nx=True, ex=lock_ttl)
    if not claimed:
        return None  # Another worker has the lock
    return await redis_client.lpop(queue_key)
```

---

## 3. Implementation Strategy

### 3.1 Security Controls

**3.1.1 QueueService Authorization Layer**

```python
class QueueService:
    """Message queue management with per-operation authorization."""

    def __init__(self, user_id: str, store: BaseStore):
        self.user_id = user_id
        self.store = store
        self.thread_service = ThreadService(user_id=user_id, store=store)

    async def _verify_queue_access(self, thread_id: str) -> None:
        """Verify user has access to queue for thread."""
        # Pattern from AbortService
        thread = await self.thread_service.get(thread_id)
        if thread and thread.metadata:
            owner = thread.metadata.get("user_id")
            if owner and str(owner) != str(self.user_id):
                logger.warning(
                    "queue_unauthorized_access",
                    extra={
                        "event": "queue_unauthorized_access",
                        "thread_id": thread_id,
                        "requesting_user": self.user_id,
                        "thread_owner": owner,
                    }
                )
                raise PermissionError(f"Not authorized to access queue for thread {thread_id}")

    async def _verify_item_ownership(self, item: QueueItem) -> None:
        """Verify user owns the specific queue item."""
        if item.user_id != self.user_id:
            raise PermissionError(f"Not authorized to modify queue item {item.id}")
```

**3.1.2 Input Validation Schema**

```python
from pydantic import BaseModel, Field, validator
import re

class QueueItemCreate(BaseModel):
    """Validated queue item creation request."""
    content: str = Field(..., max_length=102400)  # 100KB limit

    @validator('content')
    def sanitize_content(cls, v):
        # Remove control characters except newlines/tabs
        v = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', v)
        return v

class QueueItemUpdate(BaseModel):
    """Validated queue item update request."""
    item_id: str = Field(..., pattern=r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    content: Optional[str] = Field(None, max_length=102400)
    version: int = Field(..., ge=1)  # For optimistic locking
```

**3.1.3 Audit Logging**

Every queue operation logged for security audit:
```python
async def add_to_queue(self, thread_id: str, content: str) -> QueueItem:
    await self._verify_queue_access(thread_id)
    item = await self._create_queue_item(thread_id, content)

    logger.info(
        "queue_item_added",
        extra={
            "event": "queue_item_added",
            "thread_id": thread_id,
            "item_id": item.id,
            "user_id": self.user_id,
            "content_length": len(content),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    )
    return item
```

### 3.2 Error Handling Strategy

**3.2.1 Exception Hierarchy**

Following the pattern from `errors.py`:

```python
class QueueError(Exception):
    """Base exception for queue operations."""
    def __init__(self, message: str, original_error: Optional[Exception] = None):
        self.message = self._sanitize_message(message)
        self.original_error = original_error
        super().__init__(self.message)

    @staticmethod
    def _sanitize_message(message: str) -> str:
        """Remove sensitive data from error messages."""
        # Reuse pattern from CheckpointError
        patterns = [
            r"redis://[^\s]+",
            r"password=[^\s&]+",
        ]
        sanitized = message
        for pattern in patterns:
            sanitized = re.sub(pattern, "[REDACTED]", sanitized, flags=re.IGNORECASE)
        return sanitized

class RetryableQueueError(QueueError):
    """Error that may succeed on retry (connection issues)."""
    pass

class PermanentQueueError(QueueError):
    """Error that will not succeed on retry (validation, auth)."""
    pass

class QueueCorruptionError(QueueError):
    """Queue state is corrupted, needs recovery."""
    pass

class ConcurrentModificationError(QueueError):
    """Item was modified by another client."""
    pass
```

**3.2.2 Retry Logic**

Reuse existing `retry_db_operation` decorator:

```python
from src.utils.retry import retry_db_operation
from src.services.errors import is_retryable_error

@retry_db_operation(
    tries=3,
    delay=1.0,
    backoff=2.0,
    max_delay=10.0,
    jitter=0.1,
    classify_error=lambda e: isinstance(e, RetryableQueueError)
)
async def _redis_operation(self, operation: Callable) -> Any:
    """Execute Redis operation with retry logic."""
    try:
        return await operation()
    except redis.ConnectionError as e:
        raise RetryableQueueError("Redis connection failed", e)
    except redis.ResponseError as e:
        if "OOM" in str(e):
            raise RetryableQueueError("Redis memory exhausted", e)
        raise PermanentQueueError("Redis operation failed", e)
```

**3.2.3 Circuit Breaker for LLM Calls**

```python
class CircuitBreaker:
    """Circuit breaker for external service calls."""

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        half_open_requests: int = 3
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_requests = half_open_requests
        self.failures = 0
        self.last_failure_time: Optional[float] = None
        self.state = "closed"  # closed, open, half_open

    async def call(self, operation: Callable) -> Any:
        if self.state == "open":
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = "half_open"
            else:
                raise CircuitOpenError("Circuit breaker is open")

        try:
            result = await operation()
            if self.state == "half_open":
                self.state = "closed"
                self.failures = 0
            return result
        except Exception as e:
            self.failures += 1
            self.last_failure_time = time.time()
            if self.failures >= self.failure_threshold:
                self.state = "open"
                logger.warning("circuit_breaker_opened", extra={"failures": self.failures})
            raise
```

**3.2.4 Graceful Degradation**

```python
async def process_queue_item(self, item: QueueItem) -> ProcessingResult:
    """Process item with graceful degradation on failures."""
    try:
        return await self._execute_agent(item)
    except RetryableQueueError as e:
        # Mark item for retry, don't fail entire queue
        item.retry_count += 1
        if item.retry_count >= MAX_ITEM_RETRIES:
            item.status = QueueItemStatus.FAILED
            logger.error("queue_item_max_retries", extra={"item_id": item.id})
        else:
            item.status = QueueItemStatus.RETRY_PENDING
            await self._schedule_retry(item, delay=2 ** item.retry_count)
        return ProcessingResult(success=False, retry=item.retry_count < MAX_ITEM_RETRIES)
    except PermanentQueueError as e:
        # Skip this item, continue with next
        item.status = QueueItemStatus.FAILED
        item.error_message = str(e)
        return ProcessingResult(success=False, retry=False, skip=True)
```

### 3.3 Validation Requirements

**3.3.1 Request Validation**

```python
# Route-level validation (in routes/v0/queue.py)
from fastapi import Body, HTTPException, status
from pydantic import ValidationError

@router.post("/threads/{thread_id}/queue")
async def add_to_queue(
    thread_id: str,
    item: QueueItemCreate = Body(...),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    # Thread ID format validation
    if not UUID_PATTERN.match(thread_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid thread_id format"
        )

    queue_service = QueueService(user_id=user.id, store=store)
    try:
        result = await queue_service.add(thread_id, item)
        return result
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except QueueError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
```

**3.3.2 State Machine Validation**

```python
class QueueItemStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

# Valid state transitions
VALID_TRANSITIONS = {
    QueueItemStatus.PENDING: [QueueItemStatus.PROCESSING, QueueItemStatus.PAUSED, QueueItemStatus.CANCELLED],
    QueueItemStatus.PROCESSING: [QueueItemStatus.COMPLETED, QueueItemStatus.FAILED, QueueItemStatus.CANCELLED],
    QueueItemStatus.PAUSED: [QueueItemStatus.PENDING, QueueItemStatus.CANCELLED],
    QueueItemStatus.COMPLETED: [],  # Terminal state
    QueueItemStatus.FAILED: [QueueItemStatus.PENDING],  # Allow retry
    QueueItemStatus.CANCELLED: [],  # Terminal state
}

def validate_transition(current: QueueItemStatus, target: QueueItemStatus) -> bool:
    return target in VALID_TRANSITIONS.get(current, [])
```

### 3.4 Test Plan

**3.4.1 Unit Tests**

```python
# tests/unit/services/test_queue_service.py

class TestQueueServiceAuthorization:
    """Authorization tests for QueueService."""

    async def test_add_to_queue_verifies_thread_access(self):
        """Adding to queue verifies user owns thread."""
        store = InMemoryStore()
        other_user_id = str(uuid4())
        user_id = str(uuid4())
        thread_id = str(uuid4())

        # Thread owned by other user
        mock_thread = MagicMock()
        mock_thread.metadata = {"user_id": other_user_id}

        service = QueueService(user_id=user_id, store=store)
        service.thread_service.get = AsyncMock(return_value=mock_thread)

        with pytest.raises(PermissionError, match="Not authorized"):
            await service.add(thread_id, "test message")

    async def test_edit_item_verifies_item_ownership(self):
        """Editing item verifies user owns the item."""
        store = InMemoryStore()
        user_id = str(uuid4())
        other_user_id = str(uuid4())
        item_id = str(uuid4())

        # Item owned by other user
        mock_item = QueueItem(
            id=item_id,
            user_id=other_user_id,
            content="test",
            status=QueueItemStatus.PENDING
        )

        service = QueueService(user_id=user_id, store=store)
        service._get_item = AsyncMock(return_value=mock_item)

        with pytest.raises(PermissionError, match="Not authorized to modify"):
            await service.edit(item_id, "new content", version=1)


class TestQueueServiceErrorHandling:
    """Error handling tests for QueueService."""

    async def test_redis_connection_error_is_retryable(self, fake_redis):
        """Redis connection errors trigger retry logic."""
        service = QueueService(user_id=str(uuid4()), store=InMemoryStore())

        fake_redis.lpush = AsyncMock(side_effect=redis.ConnectionError("Connection refused"))

        with patch("src.services.queue.redis.from_url", return_value=fake_redis):
            with pytest.raises(RetryableQueueError):
                await service.add("thread_id", "content")

    async def test_concurrent_modification_detected(self, fake_redis):
        """Concurrent modification raises specific error."""
        service = QueueService(user_id=str(uuid4()), store=InMemoryStore())

        # Simulate version mismatch
        mock_item = QueueItem(id="item1", version=2)  # Version was updated
        service._get_item = AsyncMock(return_value=mock_item)

        with pytest.raises(ConcurrentModificationError):
            await service.edit("item1", "new content", version=1)  # Stale version


class TestQueueServiceRaceConditions:
    """Race condition prevention tests."""

    async def test_atomic_pause_check_before_processing(self, fake_redis):
        """Queue processing atomically checks pause state."""
        queue_key = "queue:user1:thread1"
        pause_key = f"{queue_key}:paused"

        # Set pause flag
        await fake_redis.set(pause_key, "1")

        service = QueueService(user_id="user1", store=InMemoryStore())

        with patch("src.services.queue.redis.from_url", return_value=fake_redis):
            result = await service._pop_next_if_not_paused(queue_key)

        assert result is None  # Should not return item when paused

    async def test_item_id_used_not_position(self):
        """Operations use item ID, not positional index."""
        service = QueueService(user_id=str(uuid4()), store=InMemoryStore())

        # Add items
        item1 = await service.add("thread1", "message 1")
        item2 = await service.add("thread1", "message 2")

        # Edit by ID, not position
        await service.edit(item2.id, "updated message 2", version=1)

        # Verify correct item updated regardless of position changes
        updated = await service.get_item(item2.id)
        assert updated.content == "updated message 2"


class TestQueueItemValidation:
    """Input validation tests."""

    def test_content_max_length_enforced(self):
        """Content exceeding 100KB is rejected."""
        with pytest.raises(ValidationError):
            QueueItemCreate(content="x" * 102401)  # 100KB + 1 byte

    def test_control_characters_sanitized(self):
        """Control characters removed from content."""
        item = QueueItemCreate(content="hello\x00world\x1ftest")
        assert item.content == "helloworldtest"

    def test_item_id_format_validated(self):
        """Item ID must be valid UUID."""
        with pytest.raises(ValidationError):
            QueueItemUpdate(item_id="not-a-uuid", version=1)

    def test_version_must_be_positive(self):
        """Version number must be >= 1."""
        with pytest.raises(ValidationError):
            QueueItemUpdate(item_id=str(uuid4()), version=0)
```

**3.4.2 Integration Tests**

```python
# tests/integration/test_queue_routes.py

@pytest.mark.asyncio
class TestQueueRoutesIntegration:
    """Integration tests for queue API routes."""

    async def test_queue_lifecycle_flow(self, async_client, auth_headers):
        """Test complete queue lifecycle: add -> pause -> edit -> resume -> complete."""
        # Create thread first
        thread_resp = await async_client.post(
            "/api/threads",
            json={"metadata": {}},
            headers=auth_headers
        )
        thread_id = thread_resp.json()["thread_id"]

        # Add items to queue
        add_resp = await async_client.post(
            f"/api/threads/{thread_id}/queue",
            json={"content": "First message"},
            headers=auth_headers
        )
        assert add_resp.status_code == 201
        item1_id = add_resp.json()["id"]

        # Pause queue
        pause_resp = await async_client.post(
            f"/api/threads/{thread_id}/queue/pause",
            headers=auth_headers
        )
        assert pause_resp.status_code == 200

        # Edit item while paused
        edit_resp = await async_client.patch(
            f"/api/threads/{thread_id}/queue/{item1_id}",
            json={"content": "Edited message", "version": 1},
            headers=auth_headers
        )
        assert edit_resp.status_code == 200

        # Resume queue
        resume_resp = await async_client.post(
            f"/api/threads/{thread_id}/queue/resume",
            headers=auth_headers
        )
        assert resume_resp.status_code == 200

    async def test_unauthorized_user_cannot_access_queue(self, async_client, auth_headers):
        """User cannot access another user's queue."""
        # Create thread as user A (auth_headers)
        thread_resp = await async_client.post(
            "/api/threads",
            json={"metadata": {}},
            headers=auth_headers
        )
        thread_id = thread_resp.json()["thread_id"]

        # Try to access as user B (different auth)
        other_auth = await get_other_user_auth(async_client)

        resp = await async_client.get(
            f"/api/threads/{thread_id}/queue",
            headers=other_auth
        )
        assert resp.status_code == 403

    async def test_done_signal_triggers_next_item(self, async_client, auth_headers, fake_redis):
        """[DONE] signal from worker triggers next queue item."""
        thread_id = await create_test_thread(async_client, auth_headers)

        # Add two items
        await async_client.post(f"/api/threads/{thread_id}/queue", json={"content": "msg1"}, headers=auth_headers)
        await async_client.post(f"/api/threads/{thread_id}/queue", json={"content": "msg2"}, headers=auth_headers)

        # Simulate first item completion
        stream_key = f"agent:stream:{thread_id}"
        await fake_redis.xadd(stream_key, {"done": "true"})

        # Verify second item is now processing
        status_resp = await async_client.get(f"/api/threads/{thread_id}/queue", headers=auth_headers)
        items = status_resp.json()["items"]
        assert items[0]["status"] == "completed"
        assert items[1]["status"] == "processing"
```

**3.4.3 Edge Case Tests**

```python
# tests/unit/services/test_queue_edge_cases.py

class TestQueueEdgeCases:
    """Edge case tests for queue system."""

    async def test_empty_queue_returns_gracefully(self):
        """Popping from empty queue returns None, doesn't error."""
        service = QueueService(user_id=str(uuid4()), store=InMemoryStore())
        result = await service._pop_next("queue:user:thread")
        assert result is None

    async def test_rapid_add_remove_maintains_consistency(self, fake_redis):
        """Rapid add/remove operations maintain queue consistency."""
        service = QueueService(user_id=str(uuid4()), store=InMemoryStore())

        # Rapid operations
        async def add_and_remove():
            item = await service.add("thread1", "content")
            await service.remove(item.id)

        # Run many concurrent operations
        await asyncio.gather(*[add_and_remove() for _ in range(100)])

        # Queue should be empty and consistent
        queue_status = await service.get_queue_status("thread1")
        assert queue_status.length == 0

    async def test_pause_during_processing_waits_for_completion(self):
        """Pausing during processing waits for current item to complete."""
        service = QueueService(user_id=str(uuid4()), store=InMemoryStore())

        item = await service.add("thread1", "content")
        await service._start_processing(item)

        # Pause while processing
        await service.pause("thread1")

        # Item should still be processing
        current = await service.get_item(item.id)
        assert current.status == QueueItemStatus.PROCESSING

        # But next item should not start
        await service.add("thread1", "content2")
        item2 = await service._pop_next_if_not_paused("queue:user:thread1")
        assert item2 is None

    async def test_edit_completed_item_rejected(self):
        """Cannot edit items that are already completed."""
        service = QueueService(user_id=str(uuid4()), store=InMemoryStore())

        item = await service.add("thread1", "content")
        item.status = QueueItemStatus.COMPLETED
        await service._save_item(item)

        with pytest.raises(PermanentQueueError, match="Cannot edit completed item"):
            await service.edit(item.id, "new content", version=1)

    async def test_stale_pause_auto_expires(self, fake_redis):
        """Pause state expires after TTL to prevent stuck queues."""
        service = QueueService(user_id=str(uuid4()), store=InMemoryStore())

        await service.pause("thread1")

        # Fast-forward time past TTL
        with freeze_time(datetime.now() + timedelta(hours=2)):
            item = await service.add("thread1", "content")
            result = await service._pop_next_if_not_paused("queue:user:thread1")

            # Should be able to pop because pause expired
            assert result is not None

    async def test_max_queue_length_enforced(self):
        """Queue has maximum length to prevent unbounded growth."""
        service = QueueService(user_id=str(uuid4()), store=InMemoryStore())

        # Add max items
        for i in range(MAX_QUEUE_LENGTH):
            await service.add("thread1", f"content{i}")

        # Adding one more should fail
        with pytest.raises(PermanentQueueError, match="Queue is full"):
            await service.add("thread1", "overflow")
```

---

## 4. Design Decisions

### 4.1 Security vs Usability Trade-offs

| Decision | Security Benefit | Usability Impact | Recommendation |
|----------|------------------|------------------|----------------|
| **Per-item auth check** | Prevents IDOR attacks | Slight latency increase | Required |
| **Optimistic locking** | Prevents data loss from races | Users see conflict errors | Required |
| **Rate limiting** | Prevents DoS/abuse | Heavy users may hit limits | Required with generous limits |
| **Content sanitization** | Prevents injection attacks | May alter user input | Required for control chars only |
| **Audit logging** | Forensics capability | Storage/performance cost | Required for mutations |
| **Max queue length** | Prevents memory exhaustion | Users must wait | Configurable (default: 50) |

### 4.2 Failure Recovery Approaches

**4.2.1 Redis Failure Recovery**

```
Scenario: Redis becomes unavailable during operation

Recovery Strategy:
1. Detect: Connection error or timeout
2. Retry: 3 attempts with exponential backoff
3. Fallback: Return 503 Service Unavailable
4. Recovery: Redis reconnection handled by connection pool
5. Cleanup: Stale locks expire via TTL
```

**4.2.2 Worker Crash Recovery**

```
Scenario: Worker crashes while processing queue item

Recovery Strategy:
1. Detect: Lock TTL expires without renewal
2. Identify: Item remains in PROCESSING state past timeout
3. Recover: Background job scans for stale PROCESSING items
4. Action: Reset to PENDING for reprocessing OR mark FAILED
5. Notify: Log event, optionally notify user
```

**4.2.3 Partial State Recovery**

```
Scenario: Metadata update fails after queue item added

Recovery Strategy:
1. Detect: Reconciliation job compares queue content vs metadata
2. Identify: Orphaned items (in list but not metadata)
3. Action: Rebuild metadata from queue content
4. Validation: Re-count queue length, verify item order
```

### 4.3 Consistency Guarantees

| Guarantee | Level | Implementation |
|-----------|-------|----------------|
| Item ordering | Strong | Redis list maintains insertion order |
| State transitions | Strong | Lua scripts for atomic transitions |
| Cross-item operations | Eventual | Transactions for multi-item updates |
| View consistency | Read-your-writes | Version-aware client caching |

---

## 5. Risk Assessment

### 5.1 Security Vulnerabilities to Prevent

| Vulnerability | Risk Level | Mitigation |
|---------------|------------|------------|
| **IDOR on queue items** | High | Item ownership verified on every operation |
| **Queue flooding DoS** | High | Rate limiting + max queue length |
| **Message injection** | Medium | Content sanitization + validation |
| **Cross-user data leak** | High | Strict namespace isolation (`queue:{user_id}:{thread_id}`) |
| **Replay attacks** | Low | Idempotency keys + version numbers |
| **Timing attacks** | Low | Constant-time comparison for auth checks |

### 5.2 Data Integrity Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Queue corruption** | Low | High | Redis transactions, reconciliation jobs |
| **Lost messages** | Low | High | Persistence via Redis RDB/AOF |
| **Duplicate processing** | Medium | Medium | Idempotency keys per item |
| **Out-of-order execution** | Low | Medium | Sequential processing with locks |
| **Orphaned items** | Low | Low | TTL-based cleanup |

### 5.3 Failure Mode Analysis

| Failure Mode | Detection | Impact | Recovery |
|--------------|-----------|--------|----------|
| Redis unavailable | Connection timeout | Queue operations fail | Retry with backoff, 503 response |
| Worker pool exhausted | Task queue depth | Slow processing | Scale workers, prioritize queue |
| Memory pressure | Redis OOM | New items rejected | Evict old completed items |
| Network partition | Timeout/reconnect | Partial state | Reconciliation on reconnect |
| Clock skew | TTL inconsistency | Premature/late expiry | Use server timestamps |

---

## 6. Estimated Complexity

### 6.1 Scope Assessment

| Component | Complexity | Rationale |
|-----------|------------|-----------|
| QueueService | Medium | Similar to AbortService, well-established patterns |
| Redis integration | Low | Existing broker.py provides foundation |
| Authorization | Low | Reuse existing verify_credentials pattern |
| Error handling | Medium | New exception hierarchy, retry logic |
| Testing | Medium | Comprehensive coverage required |
| Frontend integration | Low | Simple UI above ChatInput |

**Overall Scope**: **Medium**

### 6.2 Risk Level Assessment

| Risk Category | Level | Justification |
|---------------|-------|---------------|
| Technical risk | Medium | New Redis data structures, race conditions |
| Security risk | Medium | New attack surface requires careful auth |
| Integration risk | Low | Well-defined interfaces, existing patterns |
| Performance risk | Low | Redis is proven for queue workloads |

**Overall Risk Level**: **Medium**

### 6.3 Implementation Priority Order

1. **Phase 1: Core Security** (Required first)
   - QueueService with authorization layer
   - Input validation schemas
   - Audit logging

2. **Phase 2: Error Handling** (Required for reliability)
   - Exception hierarchy
   - Retry logic with backoff
   - Graceful degradation

3. **Phase 3: State Management** (Core functionality)
   - Redis queue operations
   - [DONE] signal integration
   - Pause/resume logic

4. **Phase 4: Concurrency** (Required for correctness)
   - Optimistic locking
   - Atomic operations (Lua scripts)
   - Distributed locks

5. **Phase 5: Testing** (Continuous but finalize here)
   - Unit tests for all services
   - Integration tests for routes
   - Edge case coverage

6. **Phase 6: Frontend** (After backend complete)
   - Queue display component
   - Edit/remove/pause controls
   - Optimistic UI updates

---

## 7. Appendix

### 7.1 Redis Key Schema

```
queue:{user_id}:{thread_id}           # List of item IDs
queue:{user_id}:{thread_id}:items     # Hash of item_id -> item JSON
queue:{user_id}:{thread_id}:paused    # Pause flag (1/0)
queue:{user_id}:{thread_id}:lock      # Processing lock (worker_id)
queue:{user_id}:{thread_id}:meta      # Queue metadata (count, version)
```

### 7.2 API Endpoints Proposed

| Method | Path | Description |
|--------|------|-------------|
| POST | `/threads/{thread_id}/queue` | Add item to queue |
| GET | `/threads/{thread_id}/queue` | List queue items |
| PATCH | `/threads/{thread_id}/queue/{item_id}` | Edit queue item |
| DELETE | `/threads/{thread_id}/queue/{item_id}` | Remove queue item |
| POST | `/threads/{thread_id}/queue/pause` | Pause queue |
| POST | `/threads/{thread_id}/queue/resume` | Resume queue |

### 7.3 Test Coverage Targets

| Category | Target | Rationale |
|----------|--------|-----------|
| Unit tests | 90%+ | Critical service layer |
| Integration tests | 80%+ | API contract verification |
| Edge case tests | 100% of identified | Prevent regression |
| Security tests | 100% of auth paths | Mandatory for new endpoints |

---

**End of PROPOSAL_GUARDIAN.md**
