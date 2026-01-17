# Architectural Proposal: Resolving "Graph is required to handle interrupt decisions" Error

**Issue:** #336
**Author:** Architect Agent
**Date:** 2026-01-16
**Status:** Draft

---

## Executive Summary

The Human-In-The-Loop (HITL) feature fails when users attempt to approve/reject tool calls because the `resume_thread` endpoint creates an `InterruptService` without the required LangGraph `CompiledStateGraph` instance. This document analyzes the system architecture and proposes solutions to reconstruct the agent graph for interrupt handling.

---

## 1. System Analysis

### 1.1 Current HITL Data Flow

```
                                    INITIAL REQUEST FLOW
+--------+       +------------+       +----------------+       +-------------+
| Client | ----> | /llm/stream| ----> | stream_generator| ----> | construct_  |
|        |       |            |       |                |       | agent()     |
+--------+       +------------+       +----------------+       +-------------+
                                             |                       |
                                             v                       v
                                      +--------------+       +---------------+
                                      | Agent runs   |       | CompiledState |
                                      | tool_call    |       | Graph created |
                                      +--------------+       +---------------+
                                             |
                                             v (HITL tool detected)
                                      +--------------+
                                      | SSE: interrupt|
                                      | event emitted |
                                      +--------------+
                                             |
                                             v
                                      +--------+
                                      | Client |
                                      | shows  |
                                      | dialog |
                                      +--------+

                                    RESUME FLOW (BROKEN)
+--------+       +------------------+       +------------------+
| Client | ----> | /threads/{id}/   | ----> | InterruptService |
| clicks |       | resume           |       | (NO GRAPH!)      |
| Approve|       +------------------+       +------------------+
+--------+              |                          |
                        |                          v
                        |                   +--------------+
                        |                   | ValueError:  |
                        |                   | Graph is     |
                        |                   | required...  |
                        |                   +--------------+
```

### 1.2 Where It Breaks

**File:** `/home/ryaneggz/ruska-ai/orchestra/backend/src/routes/v0/thread.py`
**Endpoint:** `POST /threads/{thread_id}/resume` (lines 387-441)

```python
# CURRENT BROKEN CODE
async def resume_thread(...):
    async with get_checkpoint_db() as checkpointer:
        service_context = ServiceContext(
            user_id=user.id, store=store, checkpointer=checkpointer
        )

        # BUG: InterruptService created without graph!
        interrupt_service = InterruptService(user_id=user.id)

        # FAILS: handle_decision requires self.graph
        await interrupt_service.handle_decision(request)
```

**File:** `/home/ryaneggz/ruska-ai/orchestra/backend/src/services/interrupt.py`
**Method:** `handle_decision()` (lines 322-404)

```python
async def handle_decision(self, request: InterruptRequest, ...):
    if not self.graph:
        raise ValueError("Graph is required to handle interrupt decisions")
    # ... uses self.graph.aupdate_state() to resume
```

### 1.3 Why the Graph is Required

The `InterruptService.handle_decision()` method needs the graph to:

1. **Update LangGraph State**: Call `graph.aupdate_state()` to inject the human decision
2. **Resume Execution**: The graph uses checkpoints to continue from the interrupt point
3. **Maintain Consistency**: The same graph structure that created the interrupt must handle the resume

### 1.4 Reference Implementation: TaskIQ Worker

The distributed worker in `/home/ryaneggz/ruska-ai/orchestra/backend/src/workers/tasks.py` correctly reconstructs the graph:

```python
@broker.task(task_name="run_agent_stream")
async def run_agent_stream(task_dict: dict, user_id: str, thread_id: str):
    # 1. Reconstruct LLMRequest from serialized dict
    params = LLMRequest(**task_dict)

    # 2. Initialize config
    config = init_config(params, user_id)

    # 3. Create database connections
    async with (
        get_store_db() as store,
        get_checkpoint_db() as checkpointer,
    ):
        # 4. Build service context
        service_context = ServiceContext(...)

        # 5. Load assistant configuration
        params = await service_context.llm_service.assistant(params)

        # 6. Initialize runtime and backend
        runtime = ToolRuntime(...)
        backend = init_backend(runtime, routes=routes)

        # 7. Construct the agent graph
        agent = await construct_agent(
            instructions=params.instructions,
            system_prompt=params.system_prompt,
            tools=params.tools,
            model=params.model,
            subagents=params.subagents,
            checkpointer=checkpointer,
            service_context=service_context,
            backend=backend,
        )
```

---

## 2. Architectural Options

### 2.1 Option A: Reconstruct Graph in Resume Endpoint

**Approach:** Follow the same pattern as the TaskIQ worker - reconstruct the full agent graph from stored configuration when handling the resume.

**Architecture:**

```
+------------------+       +------------------+       +------------------+
| /threads/{id}/   | ----> | Load Assistant   | ----> | construct_agent()|
| resume           |       | Config from DB   |       |                  |
+------------------+       +------------------+       +------------------+
        |                         |                          |
        v                         v                          v
+------------------+       +------------------+       +------------------+
| Get thread_id    |       | AssistantService |       | CompiledState-   |
| from request     |       | .get()           |       | Graph            |
+------------------+       +------------------+       +------------------+
                                                             |
                                                             v
                                                     +------------------+
                                                     | InterruptService |
                                                     | .handle_decision |
                                                     +------------------+
                                                             |
                                                             v
                                                     +------------------+
                                                     | graph.aupdate_   |
                                                     | state()          |
                                                     +------------------+
```

**Pros:**
- Follows existing patterns in the codebase
- Self-contained solution in one endpoint
- No new infrastructure required

**Cons:**
- Duplicates graph construction logic
- Must retrieve assistant_id from thread metadata
- Graph construction is expensive (latency on each resume)

### 2.2 Option B: Delegate to TaskIQ Worker

**Approach:** When resume is called, enqueue a TaskIQ task that handles both graph reconstruction and state update, then streams results back via Redis.

**Architecture:**

```
+------------------+       +------------------+       +------------------+
| /threads/{id}/   | ----> | Create ResumeTask| ----> | TaskIQ Worker    |
| resume           |       | with decision    |       |                  |
+------------------+       +------------------+       +------------------+
        |                                                    |
        v                                                    v
+------------------+                                 +------------------+
| Return 202       |                                 | Reconstruct      |
| Accepted         |                                 | Agent Graph      |
+------------------+                                 +------------------+
        |                                                    |
        v                                                    v
+------------------+                                 +------------------+
| Client polls     |                                 | Handle interrupt |
| /threads/{id}/   | <-- Redis Stream <-------------|  decision        |
| stream           |                                 +------------------+
+------------------+                                         |
                                                             v
                                                     +------------------+
                                                     | Continue agent   |
                                                     | execution        |
                                                     +------------------+
```

**Pros:**
- Consistent with distributed architecture
- Reuses existing worker infrastructure
- Naturally handles long-running resume operations
- Single source of truth for graph construction

**Cons:**
- Requires new TaskIQ task definition
- More complex client handling (polling)
- May be overkill for simple approve/reject

### 2.3 Option C: Hybrid - Lightweight State Update + Streaming Resume

**Approach:** Split the operation into two phases:
1. **Phase 1 (Sync):** Validate request, update interrupt state in checkpoint
2. **Phase 2 (Async):** Delegate to worker or streaming endpoint for continued execution

**Architecture:**

```
                        PHASE 1: STATE UPDATE
+------------------+       +------------------+       +------------------+
| /threads/{id}/   | ----> | Validate request | ----> | Update checkpoint|
| resume           |       | & permissions    |       | state directly   |
+------------------+       +------------------+       +------------------+
        |                                                    |
        v                                                    v
+------------------+                                 +------------------+
| Return 200 with  |                                 | Inject decision  |
| stream_url       |                                 | into checkpoint  |
+------------------+                                 +------------------+

                        PHASE 2: CONTINUE EXECUTION
+------------------+       +------------------+       +------------------+
| Client calls     | ----> | Worker picks up  | ----> | Stream results   |
| /threads/{id}/   |       | from checkpoint  |       | via Redis        |
| stream           |       +------------------+       +------------------+
+------------------+
```

**Pros:**
- Fast initial response
- Decouples state update from execution
- Allows simpler validation without full graph

**Cons:**
- Most complex implementation
- Requires changes to checkpoint update mechanism
- May have edge cases with state consistency

---

## 3. Recommended Architecture: Option A with Optimization

After analyzing the codebase and requirements, I recommend **Option A with caching optimization**.

### 3.1 Rationale

1. **Follows Existing Patterns**: The codebase already has this pattern in `stream_generator()`, `llm_invoke()`, and TaskIQ worker
2. **Self-Contained**: No new infrastructure or task types needed
3. **Synchronous Response**: User gets immediate feedback on their decision
4. **Checkpoint Integration**: LangGraph's checkpointing handles state persistence

### 3.2 Solution Architecture

```
+------------------+       +------------------+       +------------------+
|     Frontend     |       |  resume_thread   |       |  ThreadService   |
|  (Approve btn)   | ----> |    endpoint      | ----> |  .get_metadata() |
+------------------+       +------------------+       +------------------+
                                  |                          |
                                  |                          v
                                  |                  +------------------+
                                  |                  | Extract:         |
                                  |                  | - assistant_id   |
                                  |                  | - model          |
                                  |                  | - tools config   |
                                  |                  +------------------+
                                  |                          |
                                  v                          v
                           +------------------+       +------------------+
                           | AssistantService | <---- | If assistant_id  |
                           | .get()           |       | present          |
                           +------------------+       +------------------+
                                  |
                                  v
                           +------------------+
                           | LLMService       |
                           | .assistant()     |
                           | (init tools)     |
                           +------------------+
                                  |
                                  v
                           +------------------+
                           | construct_agent()|
                           | (with           |
                           |  checkpointer)  |
                           +------------------+
                                  |
                                  v
                           +------------------+
                           | InterruptService |
                           | (graph=agent.   |
                           |  graph)         |
                           +------------------+
                                  |
                                  v
                           +------------------+
                           | handle_decision()|
                           | graph.aupdate_  |
                           | state()         |
                           +------------------+
                                  |
                                  v
                           +------------------+       +------------------+
                           | Option: Return  | ----> | Client polls     |
                           | stream_url for  |       | /threads/{id}/   |
                           | continued exec  |       | stream           |
                           +------------------+       +------------------+
```

### 3.3 Dependency Chain

The following components must be reconstructed in order:

```
1. Checkpointer (AsyncPostgresSaver)
   |
   v
2. Store (AsyncPostgresStore)
   |
   v
3. ServiceContext (user_id, store, checkpointer)
   |
   v
4. Thread Metadata (from store)
   |   - assistant_id
   |   - project_id
   |   - model (may need inference)
   |
   v
5. Assistant Configuration (from AssistantService)
   |   - system_prompt
   |   - tools list
   |   - hitl config
   |   - mcp servers
   |   - a2a agents
   |
   v
6. LLMService.assistant() (tool initialization)
   |   - Default tools
   |   - MCP tools
   |   - A2A tools
   |   - Custom tools from store
   |   - HITL wrapping
   |
   v
7. ToolRuntime + Backend
   |
   v
8. construct_agent() -> Orchestra -> CompiledStateGraph
   |
   v
9. InterruptService(graph=agent.graph)
   |
   v
10. handle_decision() -> graph.aupdate_state()
```

---

## 4. Detailed Data Flow

### 4.1 Resume Request Processing

```
INPUT: InterruptRequest
  - interrupt_id: "int_abc123"
  - action: "approve"
  - edited_args: null
  - reason: null
  - nonce: "xyz789"

STEP 1: Load Thread Configuration
  Thread metadata from store:
  {
    "thread_id": "thread_456",
    "assistant_id": "asst_789",  // KEY: needed to reconstruct
    "project_id": "proj_001",
    "checkpoint_id": "cp_latest",
    "model": "openai:gpt-4"
  }

STEP 2: Load Assistant Configuration
  Assistant from AssistantService:
  {
    "id": "asst_789",
    "system_prompt": "You are...",
    "tools": ["file_reader", "web_search"],
    "hitl": {
      "enabled": true,
      "tools_requiring_approval": ["web_search"]
    }
  }

STEP 3: Initialize Tools
  LLMService.assistant() returns:
  - Wrapped tools with HITL
  - MCP tools if configured
  - A2A tools if configured

STEP 4: Construct Graph
  Orchestra instance with:
  - model: "openai:gpt-4"
  - tools: [file_reader, web_search_hitl_wrapped]
  - checkpointer: AsyncPostgresSaver
  - store: AsyncPostgresStore

STEP 5: Handle Decision
  InterruptService.handle_decision():
  - Validates interrupt exists
  - Checks expiration
  - Verifies ownership
  - Builds RunnableConfig with thread_id + checkpoint_id
  - Calls graph.aupdate_state(config, values, as_node="__interrupt__")

STEP 6: Resume Execution (Optional)
  If continued execution needed:
  - Return stream_url for polling
  - Or inline streaming response
```

### 4.2 Graph State Update

```python
# What happens inside graph.aupdate_state()

config = RunnableConfig(
    configurable={
        "thread_id": "thread_456",
        "checkpoint_id": "cp_at_interrupt",
    }
)

# For APPROVE action:
values = {"type": "accept"}

# For EDIT action:
values = {"type": "edit", "args": {"args": edited_args}}

# For REJECT action:
values = {"type": "response", "args": "User rejected: reason"}

# Update state at the __interrupt__ node
result = await graph.aupdate_state(
    config,
    values=values,
    as_node="__interrupt__",
)
```

---

## 5. Implementation Requirements

### 5.1 New Dependencies in resume_thread

The endpoint needs access to:

| Dependency | Source | Purpose |
|------------|--------|---------|
| `checkpointer` | `get_checkpoint_db()` | Load/save graph state |
| `store` | `get_store()` | Load thread/assistant data |
| `ServiceContext` | Constructor | Coordinate services |
| `ThreadService` | Via ServiceContext | Get thread metadata |
| `AssistantService` | Via ServiceContext | Load assistant config |
| `LLMService` | Via ServiceContext | Initialize tools |
| `construct_agent` | `src.flows` | Build the graph |
| `init_config` | `src.flows` | Create RunnableConfig |
| `init_backend` | `src.flows` | Create backend routes |
| `ToolRuntime` | `langchain.tools` | Tool execution context |

### 5.2 Required Data from Thread Store

```python
# Minimum data needed from thread metadata
thread_metadata = await thread_service.get(thread_id)
required_fields = {
    "assistant_id": str,     # To load assistant config
    "project_id": str,       # For config
    "model": str,            # If not in assistant
    "checkpoint_id": str,    # Latest checkpoint
}
```

### 5.3 Edge Cases to Handle

1. **No assistant_id**: Fall back to default agent configuration
2. **Assistant deleted**: Return 404 with clear error
3. **Interrupt expired**: Already handled by InterruptService
4. **Checkpoint missing**: Graph reconstruction may fail
5. **Tool not found**: Tool initialization may fail
6. **MCP server unavailable**: Timeout/retry logic needed

---

## 6. Risk Analysis

### 6.1 Performance Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Graph construction latency | Medium | Consider caching compiled graphs |
| Multiple DB calls | Medium | Batch queries where possible |
| Tool initialization timeout | Low | Set reasonable timeouts |

### 6.2 Consistency Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Checkpoint state drift | High | Use checkpoint_id from interrupt |
| Tool schema mismatch | Medium | Validate edited_args against schema |
| Race condition on resume | Medium | Use nonce for idempotency |

### 6.3 Security Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Unauthorized resume | High | Already handled by ownership check |
| Replay attacks | Medium | Nonce validation implemented |
| Injection via edited_args | Medium | Tool schema validation |

---

## 7. Alternative Considerations

### 7.1 Graph Caching Layer

For production optimization, consider a graph caching layer:

```python
class GraphCache:
    """Cache compiled graphs by assistant configuration hash."""

    _cache: Dict[str, CompiledStateGraph] = {}

    @classmethod
    def get_or_create(cls, assistant: Assistant, checkpointer) -> CompiledStateGraph:
        cache_key = cls._compute_key(assistant)
        if cache_key not in cls._cache:
            cls._cache[cache_key] = construct_agent(...)
        return cls._cache[cache_key]
```

### 7.2 Persistent Interrupt Store

Current implementation uses in-memory storage (`_pending_interrupts`). For production:

```python
# Move to Redis or database
class RedisInterruptStore:
    async def store(self, interrupt: Interrupt):
        await redis.set(f"interrupt:{interrupt.id}", interrupt.json())

    async def get(self, interrupt_id: str) -> Optional[Interrupt]:
        data = await redis.get(f"interrupt:{interrupt_id}")
        return Interrupt.parse_raw(data) if data else None
```

---

## 8. Success Criteria

The fix is successful when:

1. [ ] User can click "Approve" and see the tool execute
2. [ ] User can click "Edit" and modify tool arguments
3. [ ] User can click "Reject" and see rejection message
4. [ ] Expired interrupts return proper error
5. [ ] Unauthorized users cannot resume others' threads
6. [ ] Graph state is correctly updated in checkpoints
7. [ ] Continued execution streams results correctly

---

## 9. Implementation Checklist

- [ ] Create helper function `reconstruct_agent_for_resume()`
- [ ] Update `resume_thread` endpoint to use helper
- [ ] Add thread metadata retrieval for assistant_id
- [ ] Handle case when assistant_id is None
- [ ] Add error handling for assistant not found
- [ ] Add error handling for tool initialization failure
- [ ] Write unit tests for graph reconstruction
- [ ] Write integration tests for full resume flow
- [ ] Update API documentation
- [ ] Performance test graph construction time

---

## 10. Files to Modify

| File | Changes |
|------|---------|
| `src/routes/v0/thread.py` | Major: Add graph reconstruction to `resume_thread` |
| `src/services/interrupt.py` | Minor: May need additional validation helpers |
| `src/flows/__init__.py` | Minor: May need to expose helper for resume |
| `src/services/thread.py` | Minor: Ensure metadata retrieval works |

---

## Appendix A: Code Skeleton

```python
# In src/routes/v0/thread.py

async def resume_thread(
    thread_id: str,
    request: InterruptRequest = Body(...),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    async with get_checkpoint_db() as checkpointer:
        service_context = ServiceContext(
            user_id=user.id, store=store, checkpointer=checkpointer
        )

        # 1. Load thread metadata to get assistant_id
        thread = await service_context.thread_service.get(thread_id)
        if not thread:
            raise HTTPException(404, "Thread not found")

        assistant_id = thread.value.get("assistant_id") if thread.value else None

        # 2. Build LLMRequest from stored configuration
        params = LLMRequest(
            metadata=LLMMetadata(
                thread_id=thread_id,
                assistant_id=assistant_id,
                # ... other fields from thread
            ),
            input=LLMInput(messages=[]),  # Not needed for resume
        )

        # 3. Initialize tools and assistant config
        params = await service_context.llm_service.assistant(params)
        config = init_config(params, user_id=user.id)

        # 4. Construct the agent graph
        agent = await construct_agent(
            instructions=params.instructions,
            system_prompt=params.system_prompt,
            tools=params.tools,
            model=params.model,
            subagents=params.subagents,
            checkpointer=checkpointer,
            service_context=service_context,
            backend=init_backend(...),
        )

        # 5. Handle the interrupt decision with the graph
        interrupt_service = InterruptService(
            user_id=user.id,
            graph=agent.graph,  # NOW WE HAVE THE GRAPH!
        )

        await interrupt_service.handle_decision(request)

        return InterruptResponse(
            status="resumed",
            interrupt_id=request.interrupt_id,
            thread_id=thread_id,
            message=f"Thread resumed with action: {request.action.value}",
        )
```

---

*End of Architectural Proposal*
