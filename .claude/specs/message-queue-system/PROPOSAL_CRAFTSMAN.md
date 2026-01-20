# Message Queue System for DeepAgents
## Implementation Proposal - CRAFTSMAN Analysis

**Date:** 2026-01-19
**Agent:** CRAFTSMAN - Clean Code, Maintainability, SOLID Principles Expert
**Feature:** Message Queue System for DeepAgents

---

## 1. Executive Summary

The Message Queue System should be implemented as a Redis-backed service layer following the existing `AbortService` pattern, providing clean abstractions for queue management with Pydantic models for state validation. The implementation leverages the existing TaskIQ/Redis infrastructure while maintaining clear separation of concerns between queue state management, message lifecycle, and stream coordination. A phased TDD approach ensures minimal disruption to the current architecture while enabling progressive enhancement of the chat experience.

---

## 2. Architectural Analysis

### 2.1 Current State Assessment

**Strengths Identified:**

1. **Service Layer Pattern**: The codebase demonstrates excellent adherence to a service layer architecture (e.g., `AbortService`, `ThreadService`, `AssistantService`). Each service has:
   - Clear single responsibility
   - Constructor injection for dependencies
   - Separation between instance methods and static methods
   - Well-documented docstrings explaining design decisions

2. **Schema Design**: Pydantic models in `backend/src/schemas/entities/` follow consistent patterns:
   - Use of enums for constrained values (`DecisionType`, `SearchType`)
   - Field validators for data integrity
   - Model validators for cross-field validation
   - JSON schema extras for OpenAPI documentation

3. **Redis Integration**: The `AbortService` provides an excellent template:
   - Redis key prefixes with TTL management
   - Fire-and-forget signaling pattern
   - Ownership verification before state mutations
   - Static methods for worker-side operations

4. **Test Patterns**: Test suite demonstrates:
   - `pytest.mark.asyncio` for async tests
   - `FakeRedis` fixture for Redis mocking
   - Mocking via `unittest.mock.patch` and `AsyncMock`
   - Clear test class organization by feature area

**Areas for Improvement:**

1. **Stream Coordination**: Current `stream_from_redis` reads from a single stream per thread. Queue management will need to coordinate multiple pending messages.

2. **Frontend State Management**: The `useChat` hook manages state in-memory (`in_mem_messages`). Queue state should be backend-driven to persist across page refreshes.

3. **No Queue Concept**: Currently, each `handleSubmit` initiates a new stream immediately. There's no mechanism to queue requests when a stream is already active.

### 2.2 Proposed Architecture Overview

```
+------------------+     +------------------+     +------------------+
|    Frontend      |     |    Backend       |     |     Redis        |
|                  |     |                  |     |                  |
|  ChatInput       |---->|  QueueRoutes     |---->| queue:{thread}   |
|  QueuedMessages  |<----|  QueueService    |<----| (sorted set)     |
|  useMessageQueue |     |  QueueSchemas    |     |                  |
+------------------+     +------------------+     +------------------+
                              |
                              v
                         +------------------+
                         |  TaskIQ Worker   |
                         |                  |
                         |  Queue Consumer  |
                         |  (enhanced task) |
                         +------------------+
```

### 2.3 Alignment with Existing Conventions

| Aspect | Existing Pattern | Proposed Alignment |
|--------|------------------|-------------------|
| Service Layer | `src/services/abort.py` | `src/services/queue.py` |
| Schemas | `src/schemas/entities/hitl.py` | `src/schemas/entities/queue.py` |
| Routes | `src/routes/v0/thread.py` | `src/routes/v0/queue.py` |
| Tests | `tests/unit/services/test_abort_service.py` | `tests/unit/services/test_queue_service.py` |
| Redis Keys | `abort:signal:{thread_id}` | `queue:{thread_id}` |

---

## 3. Implementation Strategy

### 3.1 Clean Abstractions for Queue Management

**Design Principle: Interface Segregation**

Define clear interfaces for queue operations:

```python
# backend/src/services/queue.py

from abc import ABC, abstractmethod
from typing import Protocol, Optional, List

class QueueStorageProtocol(Protocol):
    """Protocol for queue storage operations - enables Redis/InMemory swap."""

    async def push(self, thread_id: str, item: "QueuedMessage") -> str: ...
    async def pop(self, thread_id: str) -> Optional["QueuedMessage"]: ...
    async def peek(self, thread_id: str) -> Optional["QueuedMessage"]: ...
    async def list(self, thread_id: str) -> List["QueuedMessage"]: ...
    async def remove(self, thread_id: str, message_id: str) -> bool: ...
    async def update(self, thread_id: str, message_id: str, data: dict) -> bool: ...
    async def set_status(self, thread_id: str, status: "QueueStatus") -> None: ...
    async def get_status(self, thread_id: str) -> "QueueStatus": ...
```

**Design Principle: Single Responsibility**

Separate concerns into distinct classes:

```python
class QueueService:
    """Orchestrates queue operations with ownership verification."""
    # High-level business logic, authorization

class RedisQueueStorage:
    """Low-level Redis operations for queue persistence."""
    # Redis sorted sets, atomic operations

class QueueProcessor:
    """Static methods for worker-side queue consumption."""
    # Used by TaskIQ workers, no user context needed
```

### 3.2 Pydantic Models for Queue State

**File: `backend/src/schemas/entities/queue.py`**

```python
"""
Message Queue schemas for DeepAgents queue management.

These schemas support the queue workflow where messages can be queued,
paused, edited, or removed while waiting for execution.
"""

from enum import Enum
from datetime import datetime
from typing import Optional, Dict, Any, List
from uuid import uuid4
from pydantic import BaseModel, Field, field_validator, model_validator


class QueueStatus(str, Enum):
    """Status of the queue itself."""
    IDLE = "idle"           # No messages, no active processing
    PROCESSING = "processing"  # Currently executing a message
    PAUSED = "paused"        # Queue is paused (blocked from execution)


class MessageStatus(str, Enum):
    """Status of an individual queued message."""
    PENDING = "pending"      # Waiting in queue
    PROCESSING = "processing"  # Currently being executed
    PAUSED = "paused"        # Message is paused (skipped during processing)
    COMPLETED = "completed"  # Execution finished
    FAILED = "failed"        # Execution failed
    CANCELLED = "cancelled"  # User removed before execution


class QueuedMessage(BaseModel):
    """
    A message waiting in the queue for execution.

    Messages are identified by unique ID and ordered by position.
    Content can be edited while in pending/paused state.
    """
    id: str = Field(default_factory=lambda: str(uuid4()))
    content: str = Field(..., description="The message content to send")
    status: MessageStatus = Field(default=MessageStatus.PENDING)
    position: int = Field(..., description="Queue position (lower = earlier)")

    # Timestamps for audit trail
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    # Original request metadata (for reconstruction)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = {
        "json_schema_extra": {
            "example": {
                "id": "msg-123",
                "content": "What is the weather today?",
                "status": "pending",
                "position": 0,
                "created_at": "2026-01-19T12:00:00Z",
                "metadata": {"assistant_id": "asst-456"}
            }
        }
    }


class QueueState(BaseModel):
    """
    Complete state of a thread's message queue.

    Includes both queue-level status and all queued messages.
    This is the authoritative state that frontend syncs with.
    """
    thread_id: str = Field(..., description="Associated thread ID")
    status: QueueStatus = Field(default=QueueStatus.IDLE)
    messages: List[QueuedMessage] = Field(default_factory=list)

    # Processing metadata
    current_message_id: Optional[str] = Field(
        default=None,
        description="ID of message currently being processed"
    )

    @field_validator("messages")
    @classmethod
    def validate_positions_unique(cls, v: List[QueuedMessage]) -> List[QueuedMessage]:
        """Ensure all positions are unique."""
        positions = [m.position for m in v]
        if len(positions) != len(set(positions)):
            raise ValueError("Message positions must be unique")
        return v

    def get_next_position(self) -> int:
        """Get the next available position for a new message."""
        if not self.messages:
            return 0
        return max(m.position for m in self.messages) + 1

    def get_next_pending(self) -> Optional[QueuedMessage]:
        """Get the next pending message in queue order."""
        pending = [m for m in self.messages if m.status == MessageStatus.PENDING]
        if not pending:
            return None
        return min(pending, key=lambda m: m.position)


class QueueAddRequest(BaseModel):
    """Request to add a message to the queue."""
    content: str = Field(..., min_length=1, description="Message content")
    metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = {
        "json_schema_extra": {
            "example": {
                "content": "Summarize the document",
                "metadata": {"assistant_id": "asst-456"}
            }
        }
    }


class QueueUpdateRequest(BaseModel):
    """Request to update a queued message."""
    content: Optional[str] = Field(None, min_length=1)
    status: Optional[MessageStatus] = None

    @model_validator(mode="after")
    def validate_at_least_one_field(self) -> "QueueUpdateRequest":
        """Ensure at least one field is provided for update."""
        if self.content is None and self.status is None:
            raise ValueError("At least one of content or status must be provided")
        return self

    model_config = {
        "json_schema_extra": {
            "examples": [
                {"content": "Updated message content"},
                {"status": "paused"},
                {"content": "New content", "status": "pending"}
            ]
        }
    }


class QueueResponse(BaseModel):
    """Standard response for queue operations."""
    success: bool
    message: str
    queue_state: Optional[QueueState] = None
```

### 3.3 Service Layer Design with Clear Responsibilities

**File: `backend/src/services/queue.py`**

```python
"""
Message Queue service for DeepAgents queue management.

This service provides a clean interface for managing message queues
via Redis. It follows the Single Responsibility Principle by handling
only queue state management.

Design Pattern: Similar to AbortService
- Redis sorted sets for ordered queue storage
- JSON serialization for message data
- Ownership verification before mutations
- Static methods for worker-side operations

Key Patterns:
- Redis sorted set: queue:{thread_id}:messages (score = position)
- Redis string: queue:{thread_id}:status (queue status)
- Redis string: queue:{thread_id}:current (current message ID)
"""

import json
import redis.asyncio as redis
from datetime import datetime, timezone
from typing import Optional, List
from langgraph.store.base import BaseStore

from src.workers.broker import REDIS_URL
from src.services.thread import ThreadService
from src.schemas.entities.queue import (
    QueueStatus,
    MessageStatus,
    QueuedMessage,
    QueueState,
)
from src.utils.logger import logger

# Redis key prefixes
QUEUE_PREFIX = "queue:"
QUEUE_TTL = 86400  # 24 hours


class QueueService:
    """Manages message queue operations with ownership verification.

    This service handles queue management for DeepAgents, allowing
    messages to be queued, paused, edited, or removed while waiting
    for execution.

    Design principles:
    - Backend-driven state (frontend syncs from backend)
    - Redis persistence for cross-cycle durability
    - Ownership verification before mutations
    - Atomic operations via Redis transactions
    """

    def __init__(self, user_id: str, store: BaseStore):
        """Initialize QueueService with user context.

        Args:
            user_id: The authenticated user's ID
            store: The LangGraph store for thread access
        """
        self.user_id = user_id
        self.store = store
        self.thread_service = ThreadService(user_id=user_id, store=store)

    async def get_queue_state(self, thread_id: str) -> QueueState:
        """Get the complete queue state for a thread.

        Args:
            thread_id: The thread ID to get queue state for

        Returns:
            QueueState with status and all messages
        """
        redis_client = redis.from_url(REDIS_URL)
        try:
            status_key = f"{QUEUE_PREFIX}{thread_id}:status"
            messages_key = f"{QUEUE_PREFIX}{thread_id}:messages"
            current_key = f"{QUEUE_PREFIX}{thread_id}:current"

            # Get queue status
            status_raw = await redis_client.get(status_key)
            status = QueueStatus(status_raw.decode()) if status_raw else QueueStatus.IDLE

            # Get current processing message
            current_raw = await redis_client.get(current_key)
            current_message_id = current_raw.decode() if current_raw else None

            # Get all messages from sorted set
            messages_raw = await redis_client.zrange(messages_key, 0, -1, withscores=True)
            messages = []
            for msg_json, score in messages_raw:
                msg_dict = json.loads(msg_json)
                msg_dict["position"] = int(score)
                messages.append(QueuedMessage(**msg_dict))

            return QueueState(
                thread_id=thread_id,
                status=status,
                messages=sorted(messages, key=lambda m: m.position),
                current_message_id=current_message_id,
            )
        finally:
            await redis_client.aclose()

    async def add_message(
        self,
        thread_id: str,
        content: str,
        metadata: dict = None,
    ) -> QueuedMessage:
        """Add a message to the queue.

        Args:
            thread_id: The thread ID to add message to
            content: The message content
            metadata: Optional metadata (assistant_id, etc.)

        Returns:
            The created QueuedMessage

        Raises:
            PermissionError: If user doesn't own the thread
        """
        # Verify ownership if thread exists
        await self._verify_thread_ownership_if_exists(thread_id)

        redis_client = redis.from_url(REDIS_URL)
        try:
            messages_key = f"{QUEUE_PREFIX}{thread_id}:messages"

            # Get next position atomically
            current_max = await redis_client.zrange(messages_key, -1, -1, withscores=True)
            position = int(current_max[0][1] + 1) if current_max else 0

            # Create message
            message = QueuedMessage(
                content=content,
                position=position,
                metadata=metadata or {},
            )

            # Add to sorted set
            await redis_client.zadd(
                messages_key,
                {json.dumps(message.model_dump(mode="json")): position}
            )
            await redis_client.expire(messages_key, QUEUE_TTL)

            logger.info(
                "queue_message_added",
                extra={
                    "event": "queue_message_added",
                    "thread_id": thread_id,
                    "message_id": message.id,
                    "position": position,
                    "user_id": self.user_id,
                },
            )

            return message
        finally:
            await redis_client.aclose()

    async def update_message(
        self,
        thread_id: str,
        message_id: str,
        content: Optional[str] = None,
        status: Optional[MessageStatus] = None,
    ) -> Optional[QueuedMessage]:
        """Update a queued message.

        Only pending or paused messages can be edited.

        Args:
            thread_id: The thread ID
            message_id: The message ID to update
            content: New content (optional)
            status: New status (optional)

        Returns:
            Updated QueuedMessage or None if not found

        Raises:
            ValueError: If message is not editable
        """
        await self._verify_thread_ownership_if_exists(thread_id)

        redis_client = redis.from_url(REDIS_URL)
        try:
            messages_key = f"{QUEUE_PREFIX}{thread_id}:messages"

            # Find and update message
            messages_raw = await redis_client.zrange(messages_key, 0, -1, withscores=True)
            for msg_json, score in messages_raw:
                msg_dict = json.loads(msg_json)
                if msg_dict["id"] == message_id:
                    # Validate editable status
                    current_status = MessageStatus(msg_dict["status"])
                    if current_status not in (MessageStatus.PENDING, MessageStatus.PAUSED):
                        raise ValueError(
                            f"Cannot edit message with status {current_status.value}"
                        )

                    # Update fields
                    if content is not None:
                        msg_dict["content"] = content
                    if status is not None:
                        msg_dict["status"] = status.value
                    msg_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

                    # Remove old, add updated (atomic via pipeline)
                    async with redis_client.pipeline() as pipe:
                        await pipe.zrem(messages_key, msg_json)
                        await pipe.zadd(
                            messages_key,
                            {json.dumps(msg_dict): score}
                        )
                        await pipe.execute()

                    msg_dict["position"] = int(score)
                    return QueuedMessage(**msg_dict)

            return None
        finally:
            await redis_client.aclose()

    async def remove_message(self, thread_id: str, message_id: str) -> bool:
        """Remove a message from the queue.

        Only pending or paused messages can be removed.

        Args:
            thread_id: The thread ID
            message_id: The message ID to remove

        Returns:
            True if removed, False if not found
        """
        await self._verify_thread_ownership_if_exists(thread_id)

        redis_client = redis.from_url(REDIS_URL)
        try:
            messages_key = f"{QUEUE_PREFIX}{thread_id}:messages"

            messages_raw = await redis_client.zrange(messages_key, 0, -1)
            for msg_json in messages_raw:
                msg_dict = json.loads(msg_json)
                if msg_dict["id"] == message_id:
                    current_status = MessageStatus(msg_dict["status"])
                    if current_status not in (MessageStatus.PENDING, MessageStatus.PAUSED):
                        raise ValueError(
                            f"Cannot remove message with status {current_status.value}"
                        )

                    await redis_client.zrem(messages_key, msg_json)

                    logger.info(
                        "queue_message_removed",
                        extra={
                            "event": "queue_message_removed",
                            "thread_id": thread_id,
                            "message_id": message_id,
                            "user_id": self.user_id,
                        },
                    )
                    return True

            return False
        finally:
            await redis_client.aclose()

    async def pause_queue(self, thread_id: str) -> QueueState:
        """Pause the queue (block execution of pending messages).

        Args:
            thread_id: The thread ID

        Returns:
            Updated QueueState
        """
        await self._verify_thread_ownership_if_exists(thread_id)
        await self._set_queue_status(thread_id, QueueStatus.PAUSED)
        return await self.get_queue_state(thread_id)

    async def resume_queue(self, thread_id: str) -> QueueState:
        """Resume the queue (allow execution of pending messages).

        Args:
            thread_id: The thread ID

        Returns:
            Updated QueueState
        """
        await self._verify_thread_ownership_if_exists(thread_id)
        await self._set_queue_status(thread_id, QueueStatus.IDLE)
        return await self.get_queue_state(thread_id)

    async def _set_queue_status(self, thread_id: str, status: QueueStatus) -> None:
        """Set queue status in Redis."""
        redis_client = redis.from_url(REDIS_URL)
        try:
            status_key = f"{QUEUE_PREFIX}{thread_id}:status"
            await redis_client.set(status_key, status.value, ex=QUEUE_TTL)
        finally:
            await redis_client.aclose()

    async def _verify_thread_ownership_if_exists(self, thread_id: str) -> None:
        """Verify thread ownership if the thread exists.

        Mirrors AbortService pattern - allows operations on new threads.
        """
        thread = await self.thread_service.get(thread_id)

        if not thread:
            logger.info(
                "queue_thread_not_in_store",
                extra={
                    "event": "queue_thread_not_in_store",
                    "thread_id": thread_id,
                    "user_id": self.user_id,
                },
            )
            return

        if thread.metadata:
            thread_user_id = thread.metadata.get("user_id")
            if thread_user_id and str(thread_user_id) != str(self.user_id):
                raise PermissionError(f"Not authorized to manage queue for thread {thread_id}")

    # Static methods for worker-side operations (no user context)

    @staticmethod
    async def pop_next_message(thread_id: str) -> Optional[QueuedMessage]:
        """Pop the next pending message for processing.

        Used by workers to get the next message to execute.
        Sets queue status to PROCESSING if a message is found.

        Args:
            thread_id: The thread ID

        Returns:
            Next pending QueuedMessage or None
        """
        redis_client = redis.from_url(REDIS_URL)
        try:
            status_key = f"{QUEUE_PREFIX}{thread_id}:status"
            messages_key = f"{QUEUE_PREFIX}{thread_id}:messages"
            current_key = f"{QUEUE_PREFIX}{thread_id}:current"

            # Check if queue is paused
            status_raw = await redis_client.get(status_key)
            if status_raw and QueueStatus(status_raw.decode()) == QueueStatus.PAUSED:
                return None

            # Find first pending message
            messages_raw = await redis_client.zrange(messages_key, 0, -1, withscores=True)
            for msg_json, score in messages_raw:
                msg_dict = json.loads(msg_json)
                if msg_dict["status"] == MessageStatus.PENDING.value:
                    # Update to processing
                    msg_dict["status"] = MessageStatus.PROCESSING.value
                    msg_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

                    async with redis_client.pipeline() as pipe:
                        await pipe.zrem(messages_key, msg_json)
                        await pipe.zadd(messages_key, {json.dumps(msg_dict): score})
                        await pipe.set(status_key, QueueStatus.PROCESSING.value, ex=QUEUE_TTL)
                        await pipe.set(current_key, msg_dict["id"], ex=QUEUE_TTL)
                        await pipe.execute()

                    msg_dict["position"] = int(score)
                    return QueuedMessage(**msg_dict)

            return None
        except Exception as e:
            logger.warning(
                "queue_pop_failed",
                extra={
                    "event": "queue_pop_failed",
                    "thread_id": thread_id,
                    "error": str(e),
                },
            )
            return None
        finally:
            await redis_client.aclose()

    @staticmethod
    async def complete_message(
        thread_id: str,
        message_id: str,
        success: bool = True,
    ) -> None:
        """Mark a message as completed or failed.

        Used by workers after execution finishes.
        Resets queue status to IDLE if no more pending messages.

        Args:
            thread_id: The thread ID
            message_id: The completed message ID
            success: Whether execution succeeded
        """
        redis_client = redis.from_url(REDIS_URL)
        try:
            messages_key = f"{QUEUE_PREFIX}{thread_id}:messages"
            status_key = f"{QUEUE_PREFIX}{thread_id}:status"
            current_key = f"{QUEUE_PREFIX}{thread_id}:current"

            new_status = MessageStatus.COMPLETED if success else MessageStatus.FAILED

            # Update message status
            messages_raw = await redis_client.zrange(messages_key, 0, -1, withscores=True)
            has_more_pending = False

            for msg_json, score in messages_raw:
                msg_dict = json.loads(msg_json)
                if msg_dict["id"] == message_id:
                    msg_dict["status"] = new_status.value
                    msg_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

                    await redis_client.zrem(messages_key, msg_json)
                    await redis_client.zadd(messages_key, {json.dumps(msg_dict): score})
                elif msg_dict["status"] == MessageStatus.PENDING.value:
                    has_more_pending = True

            # Clear current and update queue status
            await redis_client.delete(current_key)
            if not has_more_pending:
                await redis_client.set(status_key, QueueStatus.IDLE.value, ex=QUEUE_TTL)

            logger.info(
                "queue_message_completed",
                extra={
                    "event": "queue_message_completed",
                    "thread_id": thread_id,
                    "message_id": message_id,
                    "success": success,
                },
            )
        except Exception as e:
            logger.warning(
                "queue_complete_failed",
                extra={
                    "event": "queue_complete_failed",
                    "thread_id": thread_id,
                    "message_id": message_id,
                    "error": str(e),
                },
            )
        finally:
            await redis_client.aclose()

    @staticmethod
    async def has_pending_messages(thread_id: str) -> bool:
        """Check if queue has pending messages.

        Used by workers to determine if they should process next.

        Args:
            thread_id: The thread ID

        Returns:
            True if there are pending messages
        """
        redis_client = redis.from_url(REDIS_URL)
        try:
            messages_key = f"{QUEUE_PREFIX}{thread_id}:messages"

            messages_raw = await redis_client.zrange(messages_key, 0, -1)
            for msg_json in messages_raw:
                msg_dict = json.loads(msg_json)
                if msg_dict["status"] == MessageStatus.PENDING.value:
                    return True
            return False
        except Exception:
            return False
        finally:
            await redis_client.aclose()
```

### 3.4 Key Code Patterns to Follow

**Pattern 1: Dependency Injection via Constructor**
```python
# Following ThreadService pattern
class QueueService:
    def __init__(
        self,
        user_id: str,
        store: BaseStore,
        thread_service: ThreadService = None,  # Allow injection for testing
    ):
        self.user_id = user_id
        self.store = store
        self.thread_service = thread_service or ThreadService(user_id=user_id, store=store)
```

**Pattern 2: Integration with ServiceContext**
```python
# backend/src/contexts/service.py (addition)
class ServiceContext:
    def __init__(self, ...):
        # ... existing services ...
        self.queue_service = QueueService(user_id=self.user_id, store=store)
```

**Pattern 3: Route Handler Following Thread Routes Style**
```python
# backend/src/routes/v0/queue.py
@router.get(
    "/threads/{thread_id}/queue",
    name="Get Queue State",
    operation_id="ruska_get_queue_state",
    tags=["Queue"],
)
async def get_queue_state(
    thread_id: str,
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    queue_service = QueueService(user_id=user.id, store=store)
    return await queue_service.get_queue_state(thread_id)
```

**Pattern 4: Worker Task Enhancement**
```python
# Enhance _execute_agent_stream in tasks.py
async def _execute_agent_stream(...):
    # ... existing execution logic ...

    # After completion, check for next queued message
    await QueueService.complete_message(thread_id, current_message_id, success=True)

    # Trigger next message if available
    if await QueueService.has_pending_messages(thread_id):
        next_msg = await QueueService.pop_next_message(thread_id)
        if next_msg:
            # Re-queue task for next message
            await run_agent_stream.kiq(
                task_dict={...reconstruct from next_msg...},
                user_id=user_id,
                thread_id=thread_id,
            )
```

---

## 4. Design Decisions

### 4.1 Trade-offs for Maintainability vs Complexity

| Decision | Trade-off | Rationale |
|----------|-----------|-----------|
| Redis Sorted Sets | Higher complexity than simple list | Enables efficient position-based ordering and atomic updates |
| Separate Status Keys | More Redis keys | Clear separation of concerns, easier debugging |
| Static Worker Methods | Less testable (harder to mock) | Mirrors AbortService pattern, avoids user context in workers |
| InMemory Fallback | Must maintain two code paths | Enables testing without Redis, matches existing conftest pattern |

### 4.2 Interface Design for Queue Operations

**REST API Design:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/threads/{thread_id}/queue` | Get queue state |
| POST | `/threads/{thread_id}/queue` | Add message to queue |
| PATCH | `/threads/{thread_id}/queue/{message_id}` | Update message |
| DELETE | `/threads/{thread_id}/queue/{message_id}` | Remove message |
| POST | `/threads/{thread_id}/queue/pause` | Pause queue |
| POST | `/threads/{thread_id}/queue/resume` | Resume queue |

**WebSocket Consideration:**
The frontend currently uses SSE for streaming. Queue state updates could be:
1. Polled via GET endpoint (simpler, aligns with current patterns)
2. Pushed via SSE metadata events (more efficient, requires stream enhancement)

Recommendation: Start with polling, add SSE push as enhancement.

### 4.3 Error Handling Patterns

Following `AbortService` error handling style:

```python
async def add_message(...) -> QueuedMessage:
    try:
        # ... implementation ...
    except PermissionError:
        # Re-raise for route handler to convert to 403
        raise
    except ValueError as e:
        # Re-raise for route handler to convert to 400
        raise
    except Exception as e:
        logger.exception(
            "queue_add_failed",
            extra={
                "event": "queue_add_failed",
                "thread_id": thread_id,
                "error": str(e),
            },
        )
        raise
```

---

## 5. Risk Assessment

### 5.1 Code Complexity Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Redis transaction complexity | Medium | Use pipelines for atomicity, comprehensive tests |
| Position collision on concurrent adds | Low | Redis ZADD handles scores atomically |
| Memory leak from abandoned queues | Medium | TTL on all keys (24h default) |
| Race condition: message edit during processing | Medium | Status check before edit, clear error message |

### 5.2 Maintainability Concerns

1. **Service Layer Sprawl**: Adding QueueService increases number of services. Mitigated by following established patterns exactly.

2. **Schema Evolution**: QueuedMessage schema may need changes. Use versioned migrations if stored in DB later.

3. **Test Coverage**: Static methods are harder to test. Provide FakeRedis fixtures matching existing patterns.

### 5.3 Technical Debt Considerations

1. **No DB Persistence**: Queue state in Redis only. For long-term durability, consider PostgreSQL table.

2. **Frontend Polling**: Initial implementation uses polling. SSE push would be more efficient.

3. **No Rate Limiting**: Queue adds are not rate-limited. Consider adding limiter middleware.

---

## 6. Estimated Complexity

### 6.1 Scope Assessment

**Scope: Medium**

| Component | Effort | Notes |
|-----------|--------|-------|
| Schema definitions | 2 hours | Straightforward Pydantic models |
| QueueService | 8 hours | Core logic with Redis operations |
| Route handlers | 4 hours | Following existing patterns |
| Worker integration | 4 hours | Enhance existing task flow |
| Unit tests | 6 hours | Comprehensive coverage with mocks |
| Integration tests | 4 hours | E2E queue flow testing |
| Frontend useMessageQueue hook | 4 hours | State management and API calls |
| QueuedMessages UI component | 4 hours | Display above ChatInput |
| **Total Backend** | **28 hours** | |
| **Total Frontend** | **8 hours** | |
| **Total** | **36 hours** | ~4.5 dev days |

### 6.2 Risk Level

**Risk Level: Medium**

- Redis operations are well-established in codebase
- Pattern follows proven AbortService design
- Concurrency concerns exist but are mitigable
- Frontend changes are additive, not disruptive

### 6.3 Suggested Priority Order

1. **Phase 1: Core Infrastructure** (Week 1)
   - [ ] Schema definitions (`queue.py`)
   - [ ] QueueService with tests
   - [ ] Route handlers with tests

2. **Phase 2: Worker Integration** (Week 1-2)
   - [ ] Enhance `run_agent_stream` task
   - [ ] [DONE] signal triggers queue check
   - [ ] Integration tests for queue flow

3. **Phase 3: Frontend Implementation** (Week 2)
   - [ ] `useMessageQueue` hook
   - [ ] QueuedMessages component
   - [ ] ChatInput integration

4. **Phase 4: Polish & Enhancements** (Week 3)
   - [ ] SSE push for queue updates
   - [ ] Queue position reordering
   - [ ] Bulk operations (clear queue)

---

## 7. Appendix: File Locations

| File | Purpose |
|------|---------|
| `backend/src/schemas/entities/queue.py` | Pydantic models |
| `backend/src/services/queue.py` | Service layer |
| `backend/src/routes/v0/queue.py` | REST endpoints |
| `backend/src/workers/tasks.py` | Enhanced task (modify) |
| `backend/src/contexts/service.py` | ServiceContext integration (modify) |
| `backend/tests/unit/services/test_queue_service.py` | Unit tests |
| `backend/tests/unit/schemas/test_queue_schemas.py` | Schema tests |
| `backend/tests/integration/test_queue_routes.py` | Integration tests |
| `frontend/src/hooks/useMessageQueue.ts` | Queue state hook |
| `frontend/src/components/inputs/QueuedMessages.tsx` | Queue display |
| `frontend/src/components/inputs/ChatInput.tsx` | Integration (modify) |

---

## 8. Conclusion

The Message Queue System can be implemented cleanly by following the established patterns in the Orchestra codebase, particularly the `AbortService` for Redis coordination and the `ThreadService` for service layer design. The TDD approach ensures each component is testable and the phased rollout minimizes risk to existing functionality.

Key success factors:
1. Strict adherence to existing code conventions
2. Comprehensive test coverage from the start
3. Backend-driven state management
4. Progressive enhancement of frontend

The estimated 4.5 days of development effort is reasonable given the clear patterns to follow and the well-structured existing codebase.
