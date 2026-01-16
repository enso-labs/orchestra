# Human-In-The-Loop (HITL) Implementation Proposal for Orchestra

## Agent 1: THE ARCHITECT - System Design Perspective

---

## 1. Executive Summary

This proposal recommends a **configuration-driven HITL architecture** that leverages Orchestra's existing `langgraph.types.interrupt()` mechanism, PostgreSQL checkpointing, and SSE streaming infrastructure. The approach integrates HITL at the **agent configuration level** (via `interrupt_on` parameter in the Assistant schema), enabling per-agent, per-tool interrupt policies without requiring code changes to existing flows. The frontend receives interrupt events through the existing SSE stream and presents a modal UI for user decisions (approve, edit, reject), with resumption handled via a new `/threads/{thread_id}/resume` endpoint that uses LangGraph's `Command(resume=...)` pattern.

---

## 2. Architectural Analysis

### 2.1 Current State Assessment

**Existing HITL Infrastructure (Strong Foundation)**

| Component | Location | Current State |
|-----------|----------|---------------|
| `add_human_in_the_loop()` | `backend/src/utils/tools.py` | Wraps tools with `interrupt()`, supports accept/edit/respond |
| `NodeInterrupt` | `backend/src/flows/authorize/utils/nodes.py` | Flow-level interrupts for OAuth authorization |
| `interrupt()` in xml_agent | `backend/src/flows/xml_agent.py` | Human assistance tool pattern |
| `HumanInterruptConfig` | LangGraph prebuilt | Standardized config |
| Checkpoint Service | `backend/src/services/checkpoint.py` | Full PostgreSQL persistence with state history |
| SSE Streaming | `backend/src/utils/stream.py` | Multi-mode streaming (messages, values, tasks) |

**Key Findings:**
1. The `add_human_in_the_loop()` utility exists but is **never called** in production flows
2. Checkpointing infrastructure fully supports state persistence and resumption
3. SSE streaming handles multiple event types but lacks an `interrupt` event type
4. The Assistant schema has no HITL configuration fields
5. Frontend has no interrupt handling UI components

### 2.2 Proposed Architecture

```
+----------------+     +------------------+     +-------------------+
|   Frontend     |     |   Backend API    |     |   LangGraph       |
|   (React)      |     |   (FastAPI)      |     |   (deepagents)    |
+----------------+     +------------------+     +-------------------+
        |                      |                        |
        | 1. Submit Chat       |                        |
        |--------------------->|                        |
        |                      | 2. Stream with         |
        |                      |    interrupt_on config |
        |                      |----------------------->|
        |                      |                        |
        |                      | 3. Tool execution      |
        |                      |    triggers interrupt  |
        |                      |<-----------------------|
        |                      |                        |
        | 4. SSE: interrupt    |                        |
        |    event with        |                        |
        |    pending action    |                        |
        |<---------------------|                        |
        |                      |                        |
        | 5. User decision     |                        |
        |    (approve/edit/    |                        |
        |     reject)          |                        |
        |--------------------->|                        |
        |                      | 6. Resume with         |
        |                      |    Command(resume=...) |
        |                      |----------------------->|
        |                      |                        |
        | 7. Continue stream   |                        |
        |<---------------------|<-----------------------|
```

### 2.3 Integration Points

1. **Agent Configuration** (`Assistant` schema): New `interrupt_on` field
2. **Agent Construction** (`construct_agent()`): Apply HITL wrappers based on config
3. **Streaming** (`stream_generator()`): Detect and emit interrupt events
4. **Resumption API** (new endpoint): Handle user decisions
5. **Frontend Context** (`ChatContext`): Interrupt state management
6. **Frontend UI**: Interrupt approval modal component

---

## 3. Implementation Strategy

### Phase 1: Backend Schema & Configuration
- Extend `Assistant` schema with `InterruptConfig`
- Add `InterruptResponse` schema for user decisions

### Phase 2: Backend Agent Construction
- Modify tool initialization to wrap tools with HITL when configured
- Pass interrupt config through agent construction

### Phase 3: Interrupt Event Streaming
- Add interrupt detection to stream generator
- Emit `interrupt` SSE event type

### Phase 4: Resume API Endpoint
- Create `POST /threads/{thread_id}/resume` endpoint
- Implement `Command(resume=...)` pattern

### Phase 5-7: Frontend Integration
- Add interrupt state to chat hook
- Create approval modal component
- Update agent configuration form

---

## 4. Key Design Decisions

| Decision | Chosen Approach | Rationale |
|----------|-----------------|-----------|
| Interrupt Location | Tool-level wrapping | Granular control per tool |
| Configuration Storage | Assistant schema | Single source of truth |
| Resumption | SSE stream continuation | Consistent UX |
| Frontend State | Chat context hook | Follows existing patterns |

---

## 5. Risk Assessment

| Risk | Mitigation |
|------|------------|
| Checkpoint deserialization after schema change | Version checkpoint format |
| Long-running interrupts timing out | Add interrupt expiration with cleanup |
| Browser refresh losing interrupt context | Persist interrupt state in checkpoint metadata |
| Race conditions in resume endpoint | Use checkpoint locking; idempotent resume |

---

## 6. Complexity Assessment

**Overall Scope: Medium**
**Overall Risk: Medium**

### Priority Order
1. Schema & Configuration (Foundation)
2. Agent Construction (Core backend)
3. Interrupt Streaming (Backend-Frontend bridge)
4. Resume API (Complete backend)
5. Frontend State (Enable UI development)
6. Frontend UI (User-facing feature)
7. Agent Form (Configuration UX)
