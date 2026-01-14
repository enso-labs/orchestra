# Final Report: Multi-Turn Distributed Workers (TaskIQ)

**Feature**: Distributed Workers for LLM Streaming
**Status**: Implementation Complete, Tests Passing
**Date**: 2026-01-12

---

## Executive Summary

The distributed workers feature enables asynchronous LLM processing via TaskIQ workers. When `DISTRIBUTED_WORKERS=true`, the API enqueues tasks to Redis-backed workers instead of processing synchronously. This enables horizontal scaling and prevents long-running LLM requests from blocking the API.

**Key Achievement**: Multi-turn conversations now work correctly in distributed mode. Context is preserved across turns via LangGraph checkpoints.

---

## API Contract for Frontend

### 1. POST `/api/llm/stream` - Send Message

**Request:**
```json
{
  "input": {
    "messages": [
      {"role": "user", "content": "Your message here"}
    ]
  },
  "model": "openai:gpt-4.1-mini",
  "metadata": {
    "thread_id": "optional-existing-thread-id"
  }
}
```

**Response (Distributed Mode):**
```json
{
  "thread_id": "uuid-string",
  "distributed": true
}
```
- Status: `202 Accepted`
- `thread_id`: Use this to poll for results
- `distributed: true`: Confirms async processing mode

**Response (Sync Mode - when DISTRIBUTED_WORKERS=false):**
- Status: `200 OK`
- Content-Type: `text/event-stream`
- Direct SSE stream (existing behavior)

### 2. GET `/api/threads/{thread_id}/stream` - Poll for Results

**Request:**
```
GET /api/threads/{thread_id}/stream
```

**Response:**
- Status: `200 OK`
- Content-Type: `text/event-stream`
- SSE stream with chunked responses

---

## SSE Stream Format

The stream returns Server-Sent Events (SSE) with the following event types:

### Metadata Event (First)
```
data: ["metadata",{"thread_id":"uuid","assistant_id":null,"project_id":null}]
```

### Message Chunks (Streaming)
```
data: ["messages",[{"content":"Hello","type":"AIMessageChunk",...},{"thread_id":"uuid",...}]]
```

### Final Values (Complete State)
```
data: ["values",{"messages":[
  {"content":"User message","type":"human","role":"user",...},
  {"content":"AI response","type":"ai",...}
]}]
```

### Completion Signal
```
data: [DONE]
```

### Error Event
```
data: {"error": "Error message here"}
data: [DONE]
```

---

## Multi-Turn Conversation Flow

### Turn 1: New Conversation
```
POST /api/llm/stream
Body: {"input": {"messages": [{"role": "user", "content": "My name is Alice"}]}, "model": "..."}

Response: {"thread_id": "abc-123", "distributed": true}

GET /api/threads/abc-123/stream
-> Streams AI response, ends with [DONE]
```

### Turn 2+: Continue Conversation
```
POST /api/llm/stream
Body: {
  "input": {"messages": [{"role": "user", "content": "What is my name?"}]},
  "metadata": {"thread_id": "abc-123"},  // IMPORTANT: Include thread_id
  "model": "..."
}

Response: {"thread_id": "abc-123", "distributed": true}

GET /api/threads/abc-123/stream
-> AI correctly recalls "Alice" from Turn 1
```

**Key Point**: Always include `metadata.thread_id` for follow-up messages to maintain conversation context.

---

## Frontend Implementation Guide

### Recommended Flow

```typescript
// 1. Send message
const response = await fetch('/api/llm/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    input: { messages: [{ role: 'user', content: userMessage }] },
    model: 'openai:gpt-4.1-mini',
    metadata: threadId ? { thread_id: threadId } : undefined
  })
});

const { thread_id, distributed } = await response.json();

// 2. If distributed mode, poll for results
if (distributed) {
  const eventSource = new EventSource(`/api/threads/${thread_id}/stream`);

  eventSource.onmessage = (event) => {
    if (event.data === '[DONE]') {
      eventSource.close();
      return;
    }

    const parsed = JSON.parse(event.data);
    const [eventType, payload] = parsed;

    if (eventType === 'messages') {
      // Streaming chunk - update UI incrementally
      const [message, metadata] = payload;
      appendToUI(message.content);
    }

    if (eventType === 'values') {
      // Final state - full message history
      const messages = payload.messages;
      // Update conversation state
    }
  };

  eventSource.onerror = (error) => {
    console.error('Stream error:', error);
    eventSource.close();
  };
}

// 3. Store thread_id for subsequent messages
setThreadId(thread_id);
```

### Handling Stream Events

| Event Type | Purpose | Action |
|------------|---------|--------|
| `metadata` | Thread info | Store thread_id if needed |
| `messages` | Streaming chunks | Append to UI in real-time |
| `values` | Complete state | Update full conversation history |
| `[DONE]` | Stream complete | Close EventSource |
| `error` | Error occurred | Display error, close stream |

### Keep-Alive Handling

The stream may send keep-alive comments during long operations:
```
: keep-alive
```
These are SSE comments (start with `:`) and should be ignored by EventSource.

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DISTRIBUTED_WORKERS` | `false` | Enable distributed mode |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection for TaskIQ |
| `STREAM_TIMEOUT_MS` | `60000` | Stream polling timeout (ms) |

### Starting the System

```bash
# Terminal 1: API Server
cd backend && source .venv/bin/activate
DISTRIBUTED_WORKERS=true make dev

# Terminal 2: TaskIQ Worker
set -a && source $HOME/.env/orchestra/.env.backend && set +a && REDIS_URL=redis://localhost:6379/0 uv run taskiq worker src.workers.tasks:broker
```

---

## Validation Results

### Automated Tests
- **120 tests passing** (full test suite)
- **20 distributed worker tests** (integration)
- **9 multi-turn specific tests** (new)

### Manual Validation
| Test Case | Result |
|-----------|--------|
| Turn 1 POST returns thread_id | PASS |
| Turn 1 stream completes with [DONE] | PASS |
| Turn 2 uses same thread_id | PASS |
| Turn 2 recalls Turn 1 context | PASS |
| Error handling propagates to client | PASS |

### Context Preservation Proof
```
Turn 1 User: "My favorite color is blue. Remember this."
Turn 1 AI:   "I acknowledge that your favorite color is blue..."

Turn 2 User: "What is my favorite color?"
Turn 2 AI:   "Your favorite color is blue, as you stated earlier in this conversation."
```

---

## Implementation Changes

### Files Modified

1. **`backend/src/workers/tasks.py`**
   - Added Backend/ToolRuntime initialization (enables multi-turn)
   - Removed redundant `config_dict` parameter
   - Added resilient error handler (nested try-except)
   - Added checkpoint state validation

2. **`backend/src/routes/v0/llm.py`**
   - Removed `config_dict` from task enqueue call

3. **`backend/src/utils/stream.py`**
   - Added configurable `STREAM_TIMEOUT_MS` (default 60s)

4. **`backend/tests/integration/test_multi_turn_distributed.py`** (NEW)
   - Comprehensive multi-turn test suite

5. **`backend/scripts/test-distributed-workers.sh`** (NEW)
   - Manual curl-based test script

---

## Known Limitations

1. **Stream Replay**: When polling `/api/threads/{thread_id}/stream` after Turn 2, the stream contains ALL messages from the beginning (Turn 1 + Turn 2). The consumer exits at the first `[DONE]` marker. Frontend should use the final `values` event for complete state.

2. **Stream TTL**: Redis streams expire after 5 minutes. Poll promptly after sending a message.

3. **No Real-Time Updates**: The stream endpoint is pull-based. For true real-time, consider WebSocket upgrade in future.

---

## Test Script

A test script is available at `backend/scripts/test-distributed-workers.sh`:

```bash
# Run with optional API key
./scripts/test-distributed-workers.sh [API_KEY]

# Or set custom API URL
API_URL=http://localhost:8001 ./scripts/test-distributed-workers.sh
```

---

## Conclusion

The distributed workers feature is fully implemented and tested. Multi-turn conversations work correctly with context preserved via LangGraph checkpoints. The frontend team can integrate using the API contract documented above.

**Next Steps for Frontend**:
1. Detect `distributed: true` in POST response
2. Implement EventSource polling for `/api/threads/{thread_id}/stream`
3. Handle SSE event types (metadata, messages, values, [DONE], error)
4. Store and reuse `thread_id` for conversation continuity
