# PROPOSAL_INTEGRATOR.md
## Message Queue System for DeepAgents - API & Interface Design

**Agent:** AGENT_5: INTEGRATOR
**Focus:** APIs, Interfaces, and System Boundaries
**Date:** 2026-01-19

---

## 1. Executive Summary

The Message Queue System requires a new backend-driven queue management API that enables users to queue, pause, edit, and remove pending messages while the agent processes the current task. I recommend a RESTful API design with dedicated queue endpoints under `/api/threads/{thread_id}/queue`, leveraging the existing Redis infrastructure for persistence, and extending the SSE event contract to include queue state updates. This approach maintains backward compatibility while enabling progressive enhancement of the chat experience.

---

## 2. Architectural Analysis

### 2.1 Current API Patterns Assessment

**Existing Route Structure:**
- Routes organized under `backend/src/routes/v0/` with domain-specific routers
- Consistent use of FastAPI `APIRouter` with tags for OpenAPI grouping
- RESTful conventions: `GET` for retrieval, `POST` for creation, `PATCH` for updates, `DELETE` for removal
- Authentication via `Depends(verify_credentials)` or `Depends(get_optional_user)`
- Pydantic models for request/response validation
- Operation IDs follow pattern: `ruska_{action}_{resource}`

**Thread Endpoints Pattern (from `/backend/src/routes/v0/thread.py`):**
```python
# Current nested resource pattern under threads
POST   /threads/search              # Query threads
POST   /threads                     # Create thread
GET    /threads/{thread_id}         # Get thread
PATCH  /threads/{thread_id}         # Update thread
DELETE /threads/{thread_id}         # Delete thread
GET    /threads/{thread_id}/stream  # Stream results (distributed mode)
POST   /threads/{thread_id}/abort   # Abort running task
GET    /threads/{thread_id}/interrupts  # HITL interrupts
POST   /threads/{thread_id}/resume      # Resume from interrupt
```

**Frontend Service Pattern (from `/frontend/src/lib/services/threadService.ts`):**
- Functions exported individually: `searchThreads`, `deleteThread`, `abortThread`
- Uses `apiClient` (axios instance) for HTTP calls
- Returns typed responses aligned with backend Pydantic schemas
- Handles authentication via `getAuthToken()` in headers

### 2.2 New Endpoints Required for Queue Management

The queue is a sub-resource of a thread, representing pending messages awaiting execution. Following the existing nested resource pattern:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/threads/{thread_id}/queue` | List all queued messages |
| `POST` | `/threads/{thread_id}/queue` | Add message to queue |
| `GET` | `/threads/{thread_id}/queue/{queue_id}` | Get specific queued message |
| `PATCH` | `/threads/{thread_id}/queue/{queue_id}` | Edit queued message content or position |
| `DELETE` | `/threads/{thread_id}/queue/{queue_id}` | Remove message from queue |
| `POST` | `/threads/{thread_id}/queue/{queue_id}/pause` | Pause queued message |
| `POST` | `/threads/{thread_id}/queue/{queue_id}/resume` | Resume paused message |
| `POST` | `/threads/{thread_id}/queue/reorder` | Bulk reorder queue |

### 2.3 SSE Event Extensions for Queue State

**Current SSE Event Types (from `/frontend/src/lib/entities/stream.ts`):**
- `metadata` - Thread/assistant/project IDs
- `messages` - Streaming message chunks
- `values` - Final state with messages/files/todos
- `error` - Error information
- `aborted` - Abort acknowledgment
- `done` - Stream completion signal `[DONE]`

**New SSE Event Types for Queue:**
```typescript
// Queue state change events
export type QueueSSEEventType =
  | "queue:added"      // New message added to queue
  | "queue:removed"    // Message removed from queue
  | "queue:paused"     // Message paused
  | "queue:resumed"    // Message resumed
  | "queue:updated"    // Message content edited
  | "queue:reordered"  // Queue order changed
  | "queue:executing"  // Next message started executing
  | "queue:sync";      // Full queue state sync
```

---

## 3. Implementation Strategy

### 3.1 API Endpoint Specifications

#### 3.1.1 List Queue

```
GET /api/threads/{thread_id}/queue
```

**Request:**
- Path: `thread_id` (string, required)
- Query: `status` (optional, filter by: "pending" | "paused" | "all")

**Response (200 OK):**
```json
{
  "thread_id": "abc-123",
  "queue": [
    {
      "id": "q-001",
      "position": 0,
      "status": "pending",
      "content": "Analyze the test results",
      "created_at": "2026-01-19T10:00:00Z",
      "updated_at": "2026-01-19T10:00:00Z"
    },
    {
      "id": "q-002",
      "position": 1,
      "status": "paused",
      "content": "Generate the report",
      "created_at": "2026-01-19T10:01:00Z",
      "updated_at": "2026-01-19T10:02:00Z"
    }
  ],
  "total": 2,
  "executing": null
}
```

#### 3.1.2 Add to Queue

```
POST /api/threads/{thread_id}/queue
```

**Request Body:**
```json
{
  "content": "string | multimodal content array",
  "position": null,  // null = append to end, number = insert at position
  "metadata": {}     // optional additional context
}
```

**Response (201 Created):**
```json
{
  "id": "q-003",
  "thread_id": "abc-123",
  "position": 2,
  "status": "pending",
  "content": "...",
  "created_at": "2026-01-19T10:05:00Z"
}
```

#### 3.1.3 Update Queued Message

```
PATCH /api/threads/{thread_id}/queue/{queue_id}
```

**Request Body:**
```json
{
  "content": "Updated message content",  // optional
  "position": 0                          // optional, move to new position
}
```

**Response (200 OK):**
```json
{
  "id": "q-003",
  "thread_id": "abc-123",
  "position": 0,
  "status": "pending",
  "content": "Updated message content",
  "updated_at": "2026-01-19T10:06:00Z"
}
```

#### 3.1.4 Remove from Queue

```
DELETE /api/threads/{thread_id}/queue/{queue_id}
```

**Response (204 No Content)**

#### 3.1.5 Pause Queued Message

```
POST /api/threads/{thread_id}/queue/{queue_id}/pause
```

**Response (200 OK):**
```json
{
  "id": "q-002",
  "status": "paused",
  "message": "Message paused successfully"
}
```

#### 3.1.6 Resume Paused Message

```
POST /api/threads/{thread_id}/queue/{queue_id}/resume
```

**Response (200 OK):**
```json
{
  "id": "q-002",
  "status": "pending",
  "message": "Message resumed successfully"
}
```

#### 3.1.7 Bulk Reorder Queue

```
POST /api/threads/{thread_id}/queue/reorder
```

**Request Body:**
```json
{
  "order": ["q-003", "q-001", "q-002"]  // Array of queue_ids in desired order
}
```

**Response (200 OK):**
```json
{
  "thread_id": "abc-123",
  "queue": [...]  // Full updated queue
}
```

### 3.2 Backend Pydantic Schemas

Create new file: `backend/src/schemas/entities/queue.py`

```python
"""
Message Queue schemas for pending message management.
"""

from enum import Enum
from typing import Optional, List, Any, Union
from datetime import datetime
from uuid import uuid4
from pydantic import BaseModel, Field


class QueueItemStatus(str, Enum):
    """Status of a queued message."""
    PENDING = "pending"
    PAUSED = "paused"
    EXECUTING = "executing"


class QueueItemContent(BaseModel):
    """Content for a queued message - supports text or multimodal."""
    role: str = Field(default="user")
    content: Union[str, List[dict]] = Field(
        ...,
        description="Message content - string for text, array for multimodal"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {"role": "user", "content": "Analyze the results"},
                {"role": "user", "content": [
                    {"type": "text", "text": "What's in this image?"},
                    {"type": "image_url", "image_url": {"url": "data:image/..."}}
                ]}
            ]
        }
    }


class QueueItem(BaseModel):
    """A single queued message."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    position: int = Field(..., ge=0, description="Position in queue (0 = next to execute)")
    status: QueueItemStatus = Field(default=QueueItemStatus.PENDING)
    content: QueueItemContent
    metadata: Optional[dict] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {
        "json_schema_extra": {
            "example": {
                "id": "q-001",
                "position": 0,
                "status": "pending",
                "content": {"role": "user", "content": "Analyze the test results"},
                "metadata": {},
                "created_at": "2026-01-19T10:00:00Z",
                "updated_at": "2026-01-19T10:00:00Z"
            }
        }
    }


class QueueListResponse(BaseModel):
    """Response for listing queue items."""
    thread_id: str
    queue: List[QueueItem] = Field(default_factory=list)
    total: int = Field(default=0)
    executing: Optional[str] = Field(
        default=None,
        description="ID of currently executing item, if any"
    )


class QueueAddRequest(BaseModel):
    """Request to add a message to the queue."""
    content: Union[str, QueueItemContent] = Field(
        ...,
        description="Message content - string shorthand or full QueueItemContent"
    )
    position: Optional[int] = Field(
        default=None,
        description="Position to insert at. null = append to end"
    )
    metadata: Optional[dict] = Field(default_factory=dict)

    model_config = {
        "json_schema_extra": {
            "example": {
                "content": "Analyze the test results",
                "position": None,
                "metadata": {}
            }
        }
    }


class QueueAddResponse(BaseModel):
    """Response after adding to queue."""
    id: str
    thread_id: str
    position: int
    status: QueueItemStatus
    content: QueueItemContent
    created_at: datetime


class QueueUpdateRequest(BaseModel):
    """Request to update a queued message."""
    content: Optional[Union[str, QueueItemContent]] = Field(
        default=None,
        description="New content for the message"
    )
    position: Optional[int] = Field(
        default=None,
        description="New position in queue"
    )


class QueueStatusResponse(BaseModel):
    """Response for pause/resume operations."""
    id: str
    status: QueueItemStatus
    message: str


class QueueReorderRequest(BaseModel):
    """Request to reorder queue items."""
    order: List[str] = Field(
        ...,
        min_length=1,
        description="Array of queue item IDs in desired order"
    )


class QueueSSEEvent(BaseModel):
    """SSE event for queue state changes."""
    event_type: str = Field(
        ...,
        description="Type of queue event: added, removed, paused, resumed, updated, reordered, executing, sync"
    )
    thread_id: str
    queue_id: Optional[str] = Field(default=None)
    data: Optional[dict] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
```

### 3.3 Frontend TypeScript Entity Definitions

Create new file: `frontend/src/lib/entities/queue.ts`

```typescript
/**
 * Message Queue type definitions for pending message management.
 */

export type QueueItemStatus = "pending" | "paused" | "executing";

export interface QueueItemContent {
  role: string;
  content: string | Array<{ type: string; [key: string]: any }>;
}

export interface QueueItem {
  id: string;
  position: number;
  status: QueueItemStatus;
  content: QueueItemContent;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface QueueListResponse {
  thread_id: string;
  queue: QueueItem[];
  total: number;
  executing: string | null;
}

export interface QueueAddRequest {
  content: string | QueueItemContent;
  position?: number | null;
  metadata?: Record<string, any>;
}

export interface QueueAddResponse {
  id: string;
  thread_id: string;
  position: number;
  status: QueueItemStatus;
  content: QueueItemContent;
  created_at: string;
}

export interface QueueUpdateRequest {
  content?: string | QueueItemContent;
  position?: number;
}

export interface QueueStatusResponse {
  id: string;
  status: QueueItemStatus;
  message: string;
}

export interface QueueReorderRequest {
  order: string[];
}

// SSE Event types for queue updates
export type QueueSSEEventType =
  | "queue:added"
  | "queue:removed"
  | "queue:paused"
  | "queue:resumed"
  | "queue:updated"
  | "queue:reordered"
  | "queue:executing"
  | "queue:sync";

export interface QueueSSEEvent {
  event_type: QueueSSEEventType;
  thread_id: string;
  queue_id?: string;
  data?: Record<string, any>;
  timestamp: string;
}

/**
 * Type guard for queue SSE events
 */
export function isQueueSSEEvent(event: unknown): event is QueueSSEEvent {
  return (
    typeof event === "object" &&
    event !== null &&
    "event_type" in event &&
    typeof (event as QueueSSEEvent).event_type === "string" &&
    (event as QueueSSEEvent).event_type.startsWith("queue:")
  );
}
```

### 3.4 Frontend Service Layer

Create new file: `frontend/src/lib/services/queueService.ts`

```typescript
/**
 * Queue Service - API client functions for message queue management.
 */

import apiClient from "@/lib/utils/apiClient";
import { getAuthToken } from "@/lib/utils/auth";
import type {
  QueueListResponse,
  QueueAddRequest,
  QueueAddResponse,
  QueueUpdateRequest,
  QueueItem,
  QueueStatusResponse,
  QueueReorderRequest,
} from "@/lib/entities/queue";

const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getAuthToken()}`,
});

/**
 * Get all queued messages for a thread.
 */
export const getQueue = async (
  threadId: string,
  status?: "pending" | "paused" | "all"
): Promise<QueueListResponse> => {
  try {
    const params = status ? { status } : {};
    const response = await apiClient.get(`/threads/${threadId}/queue`, {
      params,
      headers: authHeaders(),
    });
    return response.data;
  } catch (error: any) {
    console.error("Error fetching queue:", error);
    throw new Error(error.response?.data?.detail || "Failed to fetch queue");
  }
};

/**
 * Add a message to the queue.
 */
export const addToQueue = async (
  threadId: string,
  request: QueueAddRequest
): Promise<QueueAddResponse> => {
  try {
    const response = await apiClient.post(
      `/threads/${threadId}/queue`,
      request,
      { headers: authHeaders() }
    );
    return response.data;
  } catch (error: any) {
    console.error("Error adding to queue:", error);
    throw new Error(error.response?.data?.detail || "Failed to add to queue");
  }
};

/**
 * Get a specific queued message.
 */
export const getQueueItem = async (
  threadId: string,
  queueId: string
): Promise<QueueItem> => {
  try {
    const response = await apiClient.get(
      `/threads/${threadId}/queue/${queueId}`,
      { headers: authHeaders() }
    );
    return response.data;
  } catch (error: any) {
    console.error("Error fetching queue item:", error);
    throw new Error(error.response?.data?.detail || "Failed to fetch queue item");
  }
};

/**
 * Update a queued message (content or position).
 */
export const updateQueueItem = async (
  threadId: string,
  queueId: string,
  request: QueueUpdateRequest
): Promise<QueueItem> => {
  try {
    const response = await apiClient.patch(
      `/threads/${threadId}/queue/${queueId}`,
      request,
      { headers: authHeaders() }
    );
    return response.data;
  } catch (error: any) {
    console.error("Error updating queue item:", error);
    throw new Error(error.response?.data?.detail || "Failed to update queue item");
  }
};

/**
 * Remove a message from the queue.
 */
export const removeFromQueue = async (
  threadId: string,
  queueId: string
): Promise<void> => {
  try {
    await apiClient.delete(`/threads/${threadId}/queue/${queueId}`, {
      headers: authHeaders(),
    });
  } catch (error: any) {
    console.error("Error removing from queue:", error);
    throw new Error(error.response?.data?.detail || "Failed to remove from queue");
  }
};

/**
 * Pause a queued message.
 */
export const pauseQueueItem = async (
  threadId: string,
  queueId: string
): Promise<QueueStatusResponse> => {
  try {
    const response = await apiClient.post(
      `/threads/${threadId}/queue/${queueId}/pause`,
      {},
      { headers: authHeaders() }
    );
    return response.data;
  } catch (error: any) {
    console.error("Error pausing queue item:", error);
    throw new Error(error.response?.data?.detail || "Failed to pause queue item");
  }
};

/**
 * Resume a paused message.
 */
export const resumeQueueItem = async (
  threadId: string,
  queueId: string
): Promise<QueueStatusResponse> => {
  try {
    const response = await apiClient.post(
      `/threads/${threadId}/queue/${queueId}/resume`,
      {},
      { headers: authHeaders() }
    );
    return response.data;
  } catch (error: any) {
    console.error("Error resuming queue item:", error);
    throw new Error(error.response?.data?.detail || "Failed to resume queue item");
  }
};

/**
 * Reorder queue items.
 */
export const reorderQueue = async (
  threadId: string,
  request: QueueReorderRequest
): Promise<QueueListResponse> => {
  try {
    const response = await apiClient.post(
      `/threads/${threadId}/queue/reorder`,
      request,
      { headers: authHeaders() }
    );
    return response.data;
  } catch (error: any) {
    console.error("Error reordering queue:", error);
    throw new Error(error.response?.data?.detail || "Failed to reorder queue");
  }
};
```

### 3.5 SSE Event Format for Queue Updates

**Extension to existing stream format:**

The backend will emit queue events through the existing SSE stream. These events use a `queue:*` prefix to distinguish from message streaming events.

```typescript
// Add to frontend/src/lib/entities/stream.ts

// Extended SSE event type including queue events
export type ExtendedSSEEventType =
  | SSEEventType          // existing: metadata, messages, values, error, aborted
  | QueueSSEEventType;    // new: queue:added, queue:removed, etc.

export interface QueueAddedEvent {
  type: "queue:added";
  data: {
    thread_id: string;
    item: QueueItem;
  };
}

export interface QueueRemovedEvent {
  type: "queue:removed";
  data: {
    thread_id: string;
    queue_id: string;
  };
}

export interface QueueExecutingEvent {
  type: "queue:executing";
  data: {
    thread_id: string;
    queue_id: string;
    content: QueueItemContent;
  };
}

export interface QueueSyncEvent {
  type: "queue:sync";
  data: {
    thread_id: string;
    queue: QueueItem[];
  };
}

export type QueueStreamEvent =
  | QueueAddedEvent
  | QueueRemovedEvent
  | QueueExecutingEvent
  | QueueSyncEvent;
```

**Backend SSE emission pattern (in stream handler):**

```python
# When [DONE] received, check queue for next item
if done_signal_received:
    next_item = await queue_service.get_next_pending(thread_id)
    if next_item:
        # Emit queue:executing event
        executing_event = ujson.dumps((
            "queue:executing",
            {
                "thread_id": thread_id,
                "queue_id": next_item.id,
                "content": next_item.content.model_dump(),
            }
        ))
        yield f"data: {executing_event}\n\n"

        # Start executing next message
        await execute_queue_item(next_item)
    else:
        # No more items, emit final [DONE]
        yield "data: [DONE]\n\n"
```

---

## 4. Design Decisions

### 4.1 Endpoint Naming Conventions

**Decision:** Use nested resource pattern `/threads/{thread_id}/queue/*`

**Rationale:**
- Consistent with existing thread sub-resources (`/stream`, `/abort`, `/interrupts`, `/resume`)
- Queue is logically owned by a thread
- Enables thread-level authorization checks
- Clear hierarchical relationship in URL structure

### 4.2 Polling vs WebSocket vs SSE for Queue Updates

**Decision:** Extend existing SSE stream with queue events

**Rationale:**
- **SSE is already in use** for message streaming, avoiding additional protocol complexity
- **Single connection** for both message stream and queue updates reduces overhead
- **Backend-driven updates** push state changes to client automatically
- **Fallback support** - client can poll `/queue` endpoint if SSE unavailable
- **Simpler implementation** than adding WebSocket infrastructure

**Alternative considered:** Separate WebSocket for queue management
- Rejected: Adds complexity, requires new connection management, duplicates auth flow

### 4.3 Schema Versioning Considerations

**Decision:** No explicit API versioning for initial release, but design for forward compatibility

**Rationale:**
- Current API uses implicit `/api/` prefix without version number
- New queue endpoints follow established patterns, no breaking changes
- Schema includes `Optional` fields for future extensibility
- SSE events use typed prefixes (`queue:*`) allowing new event types without breaking

**Migration path:**
- If breaking changes needed later, introduce `/api/v1/` prefix
- Old clients continue using `/api/` (v0) until migration
- Deprecation warnings in response headers

---

## 5. Risk Assessment

### 5.1 API Breaking Changes

**Risk Level:** LOW

**Analysis:**
- All new endpoints - no modification to existing routes
- New SSE events use distinct prefix (`queue:*`)
- Existing clients ignore unknown SSE event types
- Frontend can progressively adopt queue features

**Mitigation:**
- Feature flag on backend to disable queue endpoints during rollout
- SSE events only emitted when queue feature is active
- Comprehensive OpenAPI documentation for new endpoints

### 5.2 Frontend-Backend Contract Drift

**Risk Level:** MEDIUM

**Analysis:**
- TypeScript types must stay synchronized with Pydantic schemas
- Manual sync process is error-prone
- SSE event structure changes could break frontend parsing

**Mitigation:**
- Generate TypeScript types from OpenAPI schema (`openapi-typescript`)
- Shared schema validation in CI pipeline
- Type guards for SSE events with graceful degradation
- Integration tests validating request/response contracts

### 5.3 Migration Path for Existing Clients

**Risk Level:** LOW

**Analysis:**
- No changes to existing message submission flow
- Queue is opt-in - clients not using queue continue working
- Existing threads without queue data return empty queue list

**Mitigation:**
- Default behavior unchanged - immediate execution if no queue
- Clear documentation for adopting queue features
- Gradual rollout via feature flag

### 5.4 SSE Stream Complexity

**Risk Level:** MEDIUM

**Analysis:**
- Adding queue events to message stream increases parsing complexity
- Error in queue event handling could affect message display
- Stream reconnection must handle queue state sync

**Mitigation:**
- Separate event handling paths for `queue:*` and message events
- `queue:sync` event on reconnection provides full state
- Defensive parsing with fallback to API polling

---

## 6. Estimated Complexity

### 6.1 Scope Assessment

| Component | Complexity | Effort |
|-----------|------------|--------|
| Backend Pydantic schemas | Small | 2 hours |
| Backend route handlers | Medium | 4 hours |
| Backend Redis queue service | Medium | 4 hours |
| SSE event integration | Medium | 3 hours |
| Frontend TypeScript types | Small | 1 hour |
| Frontend service layer | Small | 2 hours |
| Frontend useChat hook updates | Medium | 3 hours |
| Frontend QueueDisplay component | Medium | 4 hours |
| Integration tests | Medium | 4 hours |
| **Total** | **Medium** | **~27 hours** |

### 6.2 Risk Level

**Overall Risk Level:** MEDIUM

- Technical risk is low (proven patterns, existing infrastructure)
- Integration risk is medium (SSE complexity, multi-client sync)
- User experience risk is low (progressive enhancement)

### 6.3 Suggested Implementation Priority

**Phase 1: Core API (Priority: HIGH)**
1. Backend Pydantic schemas (`queue.py`)
2. Backend Redis queue service
3. Backend route handlers (CRUD operations)
4. Frontend TypeScript types
5. Frontend service layer

**Phase 2: SSE Integration (Priority: HIGH)**
1. Backend SSE event emission on queue changes
2. Backend `[DONE]` handler to check/execute queue
3. Frontend SSE event handling in useChat
4. Queue state sync on reconnection

**Phase 3: UI Components (Priority: MEDIUM)**
1. QueueDisplay component above ChatInput
2. Queue item edit/remove interactions
3. Pause/resume toggle UI
4. Drag-and-drop reordering

**Phase 4: Polish (Priority: LOW)**
1. Optimistic updates for snappy UX
2. Queue persistence across page refresh
3. Keyboard shortcuts for queue management
4. Queue status in page title/favicon

---

## 7. Appendix: Contract Reference

### 7.1 Backend Route Registration

Add to `backend/src/routes/v0/__init__.py`:

```python
from .queue import router as queue

def create_api_router(app: FastAPI, prefix: str = "/api"):
    # ... existing routers ...
    app.include_router(queue, prefix=prefix)
```

### 7.2 Frontend Service Export

Update `frontend/src/lib/services/index.ts`:

```typescript
export * from "./queueService";
```

Update `frontend/src/lib/entities/index.ts`:

```typescript
export * from "./queue";
```

### 7.3 Example curl Commands for Testing

```bash
# List queue
curl -X GET "http://localhost:8000/api/threads/{thread_id}/queue" \
  -H "Authorization: Bearer $TOKEN"

# Add to queue
curl -X POST "http://localhost:8000/api/threads/{thread_id}/queue" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Analyze the results"}'

# Pause item
curl -X POST "http://localhost:8000/api/threads/{thread_id}/queue/{queue_id}/pause" \
  -H "Authorization: Bearer $TOKEN"

# Resume item
curl -X POST "http://localhost:8000/api/threads/{thread_id}/queue/{queue_id}/resume" \
  -H "Authorization: Bearer $TOKEN"

# Update item
curl -X PATCH "http://localhost:8000/api/threads/{thread_id}/queue/{queue_id}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Updated content", "position": 0}'

# Remove item
curl -X DELETE "http://localhost:8000/api/threads/{thread_id}/queue/{queue_id}" \
  -H "Authorization: Bearer $TOKEN"

# Reorder queue
curl -X POST "http://localhost:8000/api/threads/{thread_id}/queue/reorder" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"order": ["q-003", "q-001", "q-002"]}'
```

---

*End of PROPOSAL_INTEGRATOR.md*
