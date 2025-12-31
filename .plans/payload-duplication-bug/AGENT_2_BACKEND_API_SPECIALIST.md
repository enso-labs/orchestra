# AGENT 2: Backend API & Streaming Specialist

## Agent Identity
**Role**: Backend API Architecture & Server-Sent Events Expert
**Specialization**: FastAPI streaming, LangGraph state management, thread persistence, and API contracts
**Focus Area**: Server-side data flow and API response structure

## Problem Analysis

### Issue Summary
Payloads are being duplicated in the frontend UI when queries are submitted in the same session (**Image 1**), but display correctly after page refresh and thread reload (**Image 2**). This suggests a potential mismatch between:

1. **Live streaming responses** (session queries)
2. **Persisted checkpoint data** (thread reload)

### Root Cause Hypothesis
The backend may be:

1. **Accumulating state across streaming events**: Each SSE message stream includes cumulative tool call data rather than incremental updates
2. **Sending redundant payload data**: Tool inputs/outputs being echoed multiple times in message responses
3. **Checkpoint serialization differences**: Live stream format differs from stored checkpoint format
4. **LangGraph state mutation**: Agent state accumulating inputs across invocations within a thread

### Evidence from Project Structure

Based on the Orchestra backend architecture:

**Key Backend Components**:
- **[backend/src/routes/](backend/src/routes/)** - API endpoints including streaming
- **[backend/src/controllers/](backend/src/controllers/)** - Business logic layer
- **[backend/src/services/](backend/src/services/)** - Service layer orchestration
- **[backend/src/repos/](backend/src/repos/)** - Data access layer
- **[backend/src/schemas/contexts/__init__.py](backend/src/schemas/contexts/__init__.py)** - Context data models
- **[backend/src/contexts/service.py](backend/src/contexts/service.py)** - Context service logic
- **[backend/migrations/](backend/migrations/)** - Database schema
- **Dependencies**: LangGraph 1.0.5, langgraph-checkpoint-postgres 3.0.2, deepagents 0.3.1

### Critical Questions for Investigation

1. **How is the streaming endpoint structured?**
   - Does it accumulate messages in a session-scoped variable?
   - Is each SSE event delta-based or snapshot-based?

2. **How does LangGraph state management work?**
   - Are tool calls appended to existing state or isolated per invocation?
   - Is there a `State` class that accumulates across multiple agent calls?

3. **What's the checkpoint vs live stream difference?**
   - Are checkpoints normalized while live streams are raw?
   - Is there a serialization/deserialization step that fixes duplication?

4. **How are tool calls represented in responses?**
   - Are `input` objects embedded in every message?
   - Is there a separate stream mode for tools vs messages?

## Technical Investigation Required

### 1. API Endpoint Analysis

**Objective**: Understand the streaming endpoint implementation

**Files to Investigate**:
```
backend/src/routes/          # Find the streaming route
backend/src/controllers/     # Find the controller handling chat/stream
backend/src/services/        # Find the service orchestrating LangGraph
```

**Tasks**:
- [ ] Locate the streaming endpoint (likely `/threads/stream` or `/chat/stream`)
- [ ] Identify the stream mode being used (`messages`, `values`, `updates`, etc.)
- [ ] Check if the endpoint maintains session state between SSE events
- [ ] Verify if tool call payloads are being duplicated in response construction
- [ ] Compare streaming response format with checkpoint response format

**Expected Code Pattern**:
```python
@router.post("/threads/stream")
async def stream_thread(request: ThreadRequest):
    async def event_generator():
        async for chunk in graph.astream(...):
            # Does this accumulate or send deltas?
            yield {"event": "message", "data": chunk}
```

### 2. LangGraph State Investigation

**Objective**: Understand state accumulation in the agent graph

**Key Questions**:
- Is there a `State` TypedDict or Pydantic model?
- Does the state include a `messages` list that accumulates?
- Are tool calls stored in state between invocations?
- Is state being mutated vs recreated on each invocation?

**Tasks**:
- [ ] Review LangGraph graph definition (likely in `backend/src/flows/` or `backend/src/agents/`)
- [ ] Identify the state schema used by the agent
- [ ] Check if `input` objects are part of the state model
- [ ] Verify state reducer functions for message/tool handling
- [ ] Examine checkpoint configuration for state persistence

**Expected Pattern**:
```python
class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    # Are tool inputs stored here?
    # Is this accumulating across calls?
```

### 3. Checkpoint Serialization Analysis

**Objective**: Compare checkpoint storage vs live streaming data

**Files to Investigate**:
```
backend/src/contexts/service.py          # Context/thread service
backend/migrations/                      # Database schema for checkpoints
```

**Tasks**:
- [ ] Find checkpoint save logic (likely using `langgraph-checkpoint-postgres`)
- [ ] Compare checkpoint data structure with streaming response structure
- [ ] Check if checkpoints normalize or clean message data
- [ ] Verify if reloading a checkpoint filters out redundant data
- [ ] Identify any post-processing done on checkpoint retrieval

**Expected Database Schema**:
```sql
-- From langgraph-checkpoint-postgres
CREATE TABLE checkpoints (
    thread_id UUID,
    checkpoint_id UUID,
    checkpoint JSONB,  -- How is this structured?
    metadata JSONB,    -- Does this include cleaned data?
    ...
);
```

### 4. Tool Call Payload Tracking

**Objective**: Identify where `input` objects are attached to messages

**Tasks**:
- [ ] Search codebase for where `"input"` field is added to messages
- [ ] Check if tool messages include redundant input data
- [ ] Verify if `deepagents` library adds input to responses
- [ ] Identify any custom message transformation logic
- [ ] Review `formatMessages` utility if exists on backend

**Search Commands**:
```bash
# Find where "input" is added to message objects
grep -r "input.*=" backend/src/
grep -r '"input"' backend/src/
```

### 5. SSE Event Structure Analysis

**Objective**: Document the exact structure of SSE events sent to frontend

**Tasks**:
- [ ] Capture raw SSE event payloads during testing
- [ ] Analyze `["messages", [message, metadata]]` structure
- [ ] Check `["values", data]` structure for tool inputs
- [ ] Verify if events are cumulative or incremental
- [ ] Identify any duplicate data in consecutive events

**Event Format** (from frontend code):
```typescript
// Received SSE events
["messages", [response, metadata]]  // Message stream
["values", {files, todos, ...}]     // Values stream
```

## Proposed Solution Strategy

### Phase 1: Add Backend Logging

**Instrument the streaming endpoint**:
```python
@router.post("/threads/stream")
async def stream_thread(request: ThreadRequest):
    logger.debug(f"[STREAM] Initial state: {state}")

    async def event_generator():
        async for chunk in graph.astream(...):
            logger.debug(f"[STREAM] Chunk type: {type(chunk)}, content: {chunk}")
            # Log message structure
            if "messages" in chunk:
                for msg in chunk["messages"]:
                    logger.debug(f"[STREAM] Message: {msg.keys()}")
            yield chunk
```

### Phase 2: State Management Review

**Verify LangGraph state is not accumulating inappropriately**:

```python
# If state is accumulating tool inputs incorrectly:
class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    # Remove or scope tool-specific state
    # current_tool_input: dict  # ← Remove if this persists across calls

# Ensure state reducer cleans up
def reduce_state(left: AgentState, right: AgentState) -> AgentState:
    # Merge messages but don't duplicate inputs
    return {"messages": deduplicate_messages(left["messages"] + right["messages"])}
```

### Phase 3: Response Normalization

**Option A: Filter duplicates in streaming layer**
```python
def filter_duplicate_inputs(messages: list) -> list:
    """Remove redundant input objects from messages."""
    seen_inputs = set()
    cleaned = []
    for msg in messages:
        if "input" in msg:
            input_hash = hash(json.dumps(msg["input"], sort_keys=True))
            if input_hash in seen_inputs:
                msg = {k: v for k, v in msg.items() if k != "input"}
            else:
                seen_inputs.add(input_hash)
        cleaned.append(msg)
    return cleaned
```

**Option B: Send delta updates instead of snapshots**
```python
# Track what's been sent
sent_message_ids = set()

async def event_generator():
    async for chunk in graph.astream(...):
        # Only send new messages
        new_messages = [msg for msg in chunk.get("messages", [])
                       if msg["id"] not in sent_message_ids]

        for msg in new_messages:
            sent_message_ids.add(msg["id"])

        if new_messages:
            yield {"event": "messages", "data": new_messages}
```

**Option C: Separate tool stream from message stream**
```python
# Use different stream modes for different data
graph.astream(
    input={"messages": messages},
    stream_mode=["messages", "values"],  # Separate tool data from messages
)

# Frontend handles separately
if (streamMode === "values") {
    // Handle tool inputs separately
} else if (streamMode === "messages") {
    // Handle message content only
}
```

### Phase 4: Checkpoint Consistency

**Ensure checkpoint data matches streaming data**:

```python
# When saving checkpoint
def save_checkpoint(state: AgentState, thread_id: str):
    # Clean state before saving
    cleaned_state = {
        "messages": filter_duplicate_inputs(state["messages"]),
        "metadata": state.get("metadata", {}),
    }
    checkpoint_saver.put(thread_id, cleaned_state)

# When loading checkpoint
def load_checkpoint(thread_id: str):
    state = checkpoint_saver.get(thread_id)
    # State should already be clean
    return state
```

### Phase 5: API Contract Documentation

**Define clear message schema**:

```python
# backend/src/schemas/messages.py
from pydantic import BaseModel
from typing import Literal, Optional

class ToolCallMessage(BaseModel):
    id: str
    type: Literal["tool"]
    name: str
    input: dict  # Only present on tool messages
    output: Optional[dict] = None

class UserMessage(BaseModel):
    id: str
    type: Literal["user", "human"]
    content: str
    model: str
    # NO input field for user messages

class AIMessage(BaseModel):
    id: str
    type: Literal["ai", "assistant"]
    content: str
    model: Optional[str] = None
    # NO input field for AI messages
```

## Implementation Checklist

- [ ] Locate and document the streaming endpoint implementation
- [ ] Review LangGraph state schema and reducer functions
- [ ] Identify where `input` fields are added to messages
- [ ] Add logging to track message structure through SSE pipeline
- [ ] Compare live stream vs checkpoint data structures
- [ ] Implement message deduplication if needed
- [ ] Ensure state cleanup between invocations
- [ ] Add API response validation
- [ ] Document expected message schemas
- [ ] Add backend tests for streaming behavior
- [ ] Test thread reload consistency
- [ ] Verify checkpoint save/load doesn't introduce issues

## Success Criteria

✅ **No Duplicate Payloads**: Live streaming sends each payload exactly once
✅ **Stream Consistency**: Live stream matches checkpoint format
✅ **State Isolation**: Each query doesn't inherit previous query's tool inputs
✅ **Clean Checkpoints**: Saved checkpoints don't contain redundant data
✅ **API Contract Clarity**: Message schemas are well-defined and enforced

## Dependencies & Coordination

**Requires coordination with**:
- **Agent 1 (Frontend Specialist)**: Verify frontend is processing SSE events correctly
- **Agent 3 (Serialization Specialist)**: Ensure message formatting isn't duplicating data

**Provides to other agents**:
- API endpoint documentation
- SSE event structure specification
- Checkpoint data format documentation
- Message schema contracts

## Files to Create/Modify

**Investigation Phase**:
- Document findings in `backend/docs/streaming-architecture.md`
- Add debug logging configuration

**Implementation Phase**:
- `backend/src/routes/threads.py` - Streaming endpoint fixes
- `backend/src/services/thread_service.py` - State management corrections
- `backend/src/schemas/messages.py` - Message schema definitions
- `backend/tests/integration/test_streaming.py` - Integration tests

## Testing Strategy

### Unit Tests
```python
# backend/tests/unit/test_message_deduplication.py
def test_filter_duplicate_inputs():
    messages = [
        {"id": "1", "content": "hello", "input": {"query": "test"}},
        {"id": "2", "content": "world", "input": {"query": "test"}},  # duplicate
    ]
    result = filter_duplicate_inputs(messages)
    assert len([m for m in result if "input" in m]) == 1
```

### Integration Tests
```python
# backend/tests/integration/test_streaming.py
@pytest.mark.asyncio
async def test_streaming_no_duplicate_payloads():
    """Verify streaming doesn't send duplicate tool inputs."""
    messages_received = []

    async for event in stream_thread(request):
        messages_received.append(event)

    # Verify no duplicate inputs
    inputs = [msg.get("input") for msg in messages_received if "input" in msg]
    assert len(inputs) == len(set(str(i) for i in inputs))
```

## Risk Assessment

**High Risk Areas**:
- Changing LangGraph state schema could break existing agents
- SSE streaming changes could impact real-time chat experience
- Checkpoint format changes could cause backward compatibility issues

**Mitigation Strategy**:
- Use feature flags for gradual rollout
- Maintain backward compatibility with version checks
- Add comprehensive logging before making changes
- Test with production-like data volumes

## Notes & Observations

- LangGraph's `add_messages` reducer might be accumulating tool call data unintentionally
- The `deepagents` library (0.3.1) might have specific message formatting behavior
- PostgreSQL checkpoint storage with JSONB allows for flexible schema but needs validation
- SSE streaming requires careful state management to avoid memory leaks in long sessions
