# PROPOSAL_CRAFTSMAN: Human-in-the-Loop API Routes for DeepAgents

**Author:** AGENT_2 CRAFTSMAN
**Date:** 2026-01-17
**Feature:** Configure human-in-the-loop in deepagents with initial phase focus ONLY on the API routes

---

## 1. Executive Summary

This proposal defines a minimal, focused API surface for enabling human-in-the-loop (HITL) workflows in the Orchestra backend. The approach leverages the existing `interrupt()` mechanism from LangGraph and the established checkpoint infrastructure, adding only **two new endpoints** and **one new schema** to support the complete interrupt-resume cycle. The design prioritizes simplicity, aligns with SOLID principles, and ensures backward compatibility with existing `/llm/invoke` and `/llm/stream` flows.

---

## 2. Architectural Analysis

### 2.1 Current State Assessment

The codebase already has substantial HITL infrastructure in place:

| Component | Location | Status |
|-----------|----------|--------|
| `interrupt()` function | `langgraph.types` | Available (used in `src/tools/test.py`) |
| `HumanInterrupt` schema | `langgraph.prebuilt.interrupt` | Available |
| `add_human_in_the_loop()` wrapper | `src/utils/tools.py` | Implemented (lines 23-63) |
| `AsyncPostgresSaver` checkpointer | `src/services/db.py` | Configured |
| `CheckpointService` | `src/services/checkpoint.py` | Full CRUD operations |
| `ThreadService` | `src/services/thread.py` | Thread management |
| `stream_generator` | `src/utils/stream.py` | SSE streaming with values mode |

**Key Observation:** The `human_assistance` tool in `src/tools/test.py` (lines 30-33) demonstrates the interrupt pattern:

```python
@tool(description="Request assistance from a human")
def human_assistance(query: str) -> str:
    human_response = interrupt({"query": query})
    return human_response["data"]
```

**What's Missing:**

1. **No endpoint to resume interrupted executions** - When a graph hits an interrupt, there's no API route to provide the human decision and resume.
2. **No interrupt detection in responses** - The stream/invoke responses include `"interrupts": []` in task payloads (visible in `mock.py`), but there's no explicit handling or documentation.
3. **No schema for interrupt decisions** - Need Pydantic models for accept/edit/respond actions.

### 2.2 Proposed Changes

Add a focused set of components following the Single Responsibility Principle:

```
New Files:
  backend/src/schemas/entities/interrupt.py    # Interrupt decision schemas
  backend/tests/unit/routes/test_interrupt.py  # Unit tests for HITL endpoints

Modified Files:
  backend/src/routes/v0/thread.py              # Add resume endpoint
  backend/src/schemas/entities/__init__.py     # Export new schemas
```

### 2.3 Integration Points and Dependencies

```
                                    +-------------------+
                                    |   Frontend/CLI    |
                                    +--------+----------+
                                             |
                     1. POST /llm/stream     |  3. POST /threads/{id}/resume
                        (initial request)    |     (human decision)
                                             v
+------------------+             +-----------+-----------+
| CheckpointService| <---------> |      LLM Routes       |
| (state persist)  |             |  /llm/invoke, /stream |
+--------+---------+             +-----------+-----------+
         |                                   |
         |   2. Graph pauses at interrupt()  |
         |      Returns {interrupts: [...]}  |
         |                                   v
         |                       +-----------+-----------+
         +---------------------> |    Thread Routes      |
                                 |  /threads/{id}/resume |
                                 +-----------+-----------+
                                             |
                      4. graph.aupdate_state(config, values)
                         Resumes execution from checkpoint
                                             |
                                             v
                                 +-----------+-----------+
                                 |   Stream continues    |
                                 |   (SSE or JSON)       |
                                 +-----------------------+
```

---

## 3. Implementation Strategy

### 3.1 Step-by-Step Implementation Plan

#### Phase 1: Schema Definition (Complexity: Small)

**File: `backend/src/schemas/entities/interrupt.py`**

```python
"""Human-in-the-loop interrupt schemas for agent workflows."""
from typing import Literal, Optional, Any, Dict, List
from pydantic import BaseModel, Field


class InterruptAction(BaseModel):
    """Base schema for interrupt action requests."""
    action: str = Field(..., description="The tool/action name that was interrupted")
    args: Dict[str, Any] = Field(default_factory=dict, description="Tool arguments")


class InterruptRequest(BaseModel):
    """Schema representing an interrupt request from the agent."""
    action_request: InterruptAction = Field(..., description="The action pending review")
    config: Dict[str, bool] = Field(
        default_factory=lambda: {
            "allow_accept": True,
            "allow_edit": True,
            "allow_respond": True,
        },
        description="Allowed response types",
    )
    description: Optional[str] = Field(
        default="Please review the tool call",
        description="Human-readable description of what needs review",
    )


class InterruptDecision(BaseModel):
    """Schema for human decision on an interrupt.

    Three decision types supported:
    - accept: Approve the action as-is
    - edit: Modify the action arguments before execution
    - response: Provide feedback/alternative response to the agent
    """
    type: Literal["accept", "edit", "response"] = Field(
        ...,
        description="Decision type: accept (approve), edit (modify args), or response (feedback)",
    )
    args: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Modified arguments (required for 'edit' type)",
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {"type": "accept"},
                {"type": "edit", "args": {"args": {"city": "Austin"}}},
                {"type": "response", "args": "Please use the search tool instead"},
            ]
        }
    }


class ResumeRequest(BaseModel):
    """Request body for resuming an interrupted thread execution."""
    decision: InterruptDecision = Field(
        ...,
        description="Human decision on how to handle the interrupt",
    )
    checkpoint_id: Optional[str] = Field(
        default=None,
        description="Specific checkpoint to resume from (uses latest if not provided)",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "decision": {"type": "accept"},
                "checkpoint_id": None,
            }
        }
    }


class InterruptState(BaseModel):
    """Response schema showing current interrupt state of a thread."""
    has_interrupt: bool = Field(..., description="Whether thread has pending interrupt")
    interrupts: List[InterruptRequest] = Field(
        default_factory=list,
        description="List of pending interrupts requiring human input",
    )
    thread_id: str = Field(..., description="The thread identifier")
    checkpoint_id: Optional[str] = Field(
        default=None,
        description="Current checkpoint ID",
    )
```

#### Phase 2: Resume Endpoint (Complexity: Medium)

**File: `backend/src/routes/v0/thread.py`** (additions)

```python
# Add imports at top of file
from src.schemas.entities.interrupt import ResumeRequest, InterruptState
from fastapi.responses import StreamingResponse
from src.utils.stream import resume_stream_generator  # New helper

# Add new endpoint after existing thread routes

@router.post(
    "/threads/{thread_id}/resume",
    name="Resume Interrupted Thread",
    operation_id="ruska_resume_thread",
    tags=["Thread", "HITL"],
    response_model=None,  # Returns SSE stream or JSON
)
async def resume_thread(
    thread_id: str,
    request: ResumeRequest = Body(...),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    """
    Resume an interrupted agent execution with a human decision.

    When an agent graph hits an interrupt() call, execution pauses and the
    client receives an interrupt notification. Use this endpoint to provide
    the human decision and resume execution.

    Decision types:
    - accept: Approve the pending action as-is
    - edit: Modify the action arguments before execution
    - response: Provide feedback/alternative response to the agent

    Returns:
        StreamingResponse with SSE events containing resumed agent output.
    """
    try:
        async with get_checkpoint_db() as checkpointer:
            service_context = ServiceContext(
                user_id=user.id, store=store, checkpointer=checkpointer
            )

            # Get current checkpoint state to find the interrupt
            checkpoint = await service_context.checkpoint_service.get_checkpoint(
                thread_id=thread_id,
                checkpoint_id=request.checkpoint_id,
            )

            if not checkpoint:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"No checkpoint found for thread {thread_id}",
                )

            # Build the resume config
            config = RunnableConfig(
                configurable={
                    "thread_id": thread_id,
                    "checkpoint_id": checkpoint["id"],
                    "user_id": user.id,
                }
            )

            # Format decision for LangGraph Command
            decision_value = _format_decision(request.decision)

            return StreamingResponse(
                resume_stream_generator(
                    config=config,
                    decision=decision_value,
                    service_context=service_context,
                ),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error resuming thread {thread_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get(
    "/threads/{thread_id}/interrupt",
    name="Get Thread Interrupt State",
    operation_id="ruska_get_interrupt_state",
    tags=["Thread", "HITL"],
    response_model=InterruptState,
)
async def get_interrupt_state(
    thread_id: str,
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    """
    Check if a thread has pending interrupts requiring human input.

    Use this endpoint to poll for interrupt state or to retrieve
    details about what action the agent is requesting approval for.
    """
    try:
        async with get_checkpoint_db() as checkpointer:
            service_context = ServiceContext(
                user_id=user.id, store=store, checkpointer=checkpointer
            )

            # Get the graph state which includes interrupts
            config = RunnableConfig(configurable={"thread_id": thread_id})

            # We need a compiled graph to get state - use a minimal one
            from src.flows import graph_builder
            graph = graph_builder(tools=[], checkpointer=checkpointer, store=store)

            state = await graph.aget_state(config)

            return InterruptState(
                has_interrupt=len(state.next) > 0 and "__interrupt__" in str(state.next),
                interrupts=state.values.get("__interrupt__", []),
                thread_id=thread_id,
                checkpoint_id=state.config.get("configurable", {}).get("checkpoint_id"),
            )

    except Exception as e:
        logger.exception(f"Error getting interrupt state for {thread_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


def _format_decision(decision: InterruptDecision) -> dict:
    """Format InterruptDecision for LangGraph Command structure."""
    if decision.type == "accept":
        return {"type": "accept"}
    elif decision.type == "edit":
        return {"type": "edit", "args": decision.args}
    elif decision.type == "response":
        return {"type": "response", "args": decision.args}
    else:
        raise ValueError(f"Unknown decision type: {decision.type}")
```

#### Phase 3: Resume Stream Helper (Complexity: Medium)

**File: `backend/src/utils/stream.py`** (additions)

```python
# Add at the end of the file

async def resume_stream_generator(
    config: RunnableConfig,
    decision: dict,
    service_context: ServiceContext,
):
    """
    Resume an interrupted graph execution and stream results.

    This generator:
    1. Updates the graph state with the human decision
    2. Resumes execution from the interrupt point
    3. Yields SSE events as the graph continues
    """
    async with get_checkpoint_db() as checkpointer:
        try:
            from src.flows import graph_builder
            from langgraph.types import Command

            # Build minimal graph with checkpointer
            graph = graph_builder(
                tools=[],  # Tools come from checkpoint state
                checkpointer=checkpointer,
                store=service_context.store,
            )

            # Use Command to resume with the decision
            resume_command = Command(resume=decision)

            # Send metadata event
            metadata_event = ujson.dumps(
                (
                    "metadata",
                    {
                        "thread_id": config["configurable"].get("thread_id"),
                        "resumed": True,
                    },
                )
            )
            yield f"data: {metadata_event}\n\n"

            # Stream the resumed execution
            async for chunk in graph.astream(
                resume_command,
                config=config,
                stream_mode=["messages", "values"],
            ):
                stream_chunk = handle_multi_mode(chunk)
                if stream_chunk:
                    data = ujson.dumps(stream_chunk)
                    logger.debug(f"resume data: {str(data)}")
                    yield f"data: {data}\n\n"

        except Exception as e:
            logger.exception(f"Error in resume_stream_generator: {e}")
            error_msg = ujson.dumps(("error", str(e)))
            yield f"data: {error_msg}\n\n"
```

#### Phase 4: Unit Tests (Complexity: Small)

**File: `backend/tests/unit/routes/test_interrupt.py`**

```python
"""Unit tests for human-in-the-loop interrupt endpoints."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


class TestInterruptSchemas:
    """Test interrupt schema validation."""

    def test_interrupt_decision_accept(self):
        from src.schemas.entities.interrupt import InterruptDecision

        decision = InterruptDecision(type="accept")
        assert decision.type == "accept"
        assert decision.args is None

    def test_interrupt_decision_edit(self):
        from src.schemas.entities.interrupt import InterruptDecision

        decision = InterruptDecision(
            type="edit",
            args={"args": {"city": "Austin"}}
        )
        assert decision.type == "edit"
        assert decision.args == {"args": {"city": "Austin"}}

    def test_interrupt_decision_response(self):
        from src.schemas.entities.interrupt import InterruptDecision

        decision = InterruptDecision(
            type="response",
            args="Please try a different approach"
        )
        assert decision.type == "response"
        assert decision.args == "Please try a different approach"

    def test_interrupt_decision_invalid_type(self):
        from src.schemas.entities.interrupt import InterruptDecision
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            InterruptDecision(type="invalid")

    def test_resume_request_minimal(self):
        from src.schemas.entities.interrupt import ResumeRequest, InterruptDecision

        request = ResumeRequest(
            decision=InterruptDecision(type="accept")
        )
        assert request.decision.type == "accept"
        assert request.checkpoint_id is None

    def test_resume_request_with_checkpoint(self):
        from src.schemas.entities.interrupt import ResumeRequest, InterruptDecision

        request = ResumeRequest(
            decision=InterruptDecision(type="accept"),
            checkpoint_id="cp-123"
        )
        assert request.checkpoint_id == "cp-123"

    def test_interrupt_state_no_interrupt(self):
        from src.schemas.entities.interrupt import InterruptState

        state = InterruptState(
            has_interrupt=False,
            interrupts=[],
            thread_id="thread-123",
        )
        assert state.has_interrupt is False
        assert len(state.interrupts) == 0


class TestFormatDecision:
    """Test decision formatting helper."""

    def test_format_accept_decision(self):
        from src.routes.v0.thread import _format_decision
        from src.schemas.entities.interrupt import InterruptDecision

        decision = InterruptDecision(type="accept")
        formatted = _format_decision(decision)
        assert formatted == {"type": "accept"}

    def test_format_edit_decision(self):
        from src.routes.v0.thread import _format_decision
        from src.schemas.entities.interrupt import InterruptDecision

        decision = InterruptDecision(type="edit", args={"city": "Dallas"})
        formatted = _format_decision(decision)
        assert formatted == {"type": "edit", "args": {"city": "Dallas"}}

    def test_format_response_decision(self):
        from src.routes.v0.thread import _format_decision
        from src.schemas.entities.interrupt import InterruptDecision

        decision = InterruptDecision(type="response", args="Use search instead")
        formatted = _format_decision(decision)
        assert formatted == {"type": "response", "args": "Use search instead"}
```

### 3.2 File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `backend/src/schemas/entities/interrupt.py` | **NEW** | Interrupt decision schemas |
| `backend/src/schemas/entities/__init__.py` | Modify | Export new interrupt schemas |
| `backend/src/routes/v0/thread.py` | Modify | Add resume and interrupt-state endpoints |
| `backend/src/utils/stream.py` | Modify | Add `resume_stream_generator` |
| `backend/tests/unit/routes/__init__.py` | **NEW** | Test package init |
| `backend/tests/unit/routes/test_interrupt.py` | **NEW** | Unit tests for HITL |

---

## 4. Design Decisions

### 4.1 Trade-offs Considered

| Decision | Alternatives | Rationale |
|----------|-------------|-----------|
| Add resume to `/threads/` routes | Create new `/hitl/` router | Threads are the natural resource - interrupts are part of thread lifecycle |
| Use SSE streaming for resume | Return JSON only | Consistency with existing `/llm/stream`; allows long-running resumes |
| Single decision per resume | Batch decisions | Simpler mental model; aligns with LangGraph's single-interrupt pattern |
| `InterruptDecision` as union type | Separate endpoints per action | Cleaner API surface; single endpoint handles all decision types |

### 4.2 Why This Approach Over Alternatives

**Alternative 1: Modify existing `/llm/stream` to accept resume commands**
- Rejected: Violates Single Responsibility Principle. The stream endpoint initiates flows; resume is a different lifecycle phase.

**Alternative 2: Create dedicated `/hitl/` route prefix**
- Rejected: Fragments the API unnecessarily. Interrupts are tied to threads, so `/threads/{id}/resume` is more RESTful.

**Alternative 3: Use WebSocket instead of SSE for resume**
- Rejected: Adds infrastructure complexity. SSE already works well for existing streams.

### 4.3 Alignment with Existing Codebase Patterns

1. **Route Structure**: Follows existing pattern in `thread.py` with `router.post/get` decorators
2. **Dependencies**: Uses `verify_credentials`, `get_store`, `get_checkpoint_db()` context manager
3. **Error Handling**: HTTPException pattern with logging
4. **Schemas**: Pydantic models with `Field` descriptions and `model_config` examples
5. **Streaming**: Reuses `handle_multi_mode` and SSE format from `stream.py`

---

## 5. Risk Assessment

### 5.1 Potential Pitfalls

| Risk | Mitigation |
|------|------------|
| Graph state mismatch after resume | Validate checkpoint exists before resume; return clear 404 |
| Concurrent resume attempts | Checkpoint ID ensures idempotency; LangGraph handles serialization |
| Decision format incompatibility with `add_human_in_the_loop` | Match exact schema used in `src/utils/tools.py` lines 48-58 |
| Long-running resumes timeout | SSE keep-alive; document timeout behavior |

### 5.2 Edge Cases to Handle

1. **Thread without interrupts**: Return 400 with message "No pending interrupt for this thread"
2. **Invalid checkpoint_id**: Return 404 with clear error
3. **Decision type not allowed by interrupt config**: Validate against `allow_accept`, `allow_edit`, `allow_respond`
4. **Concurrent `/llm/stream` and `/resume` on same thread**: LangGraph checkpoint locking handles this

### 5.3 Testing Considerations

**Unit Tests (Phase 4 above):**
- Schema validation for all decision types
- Decision formatting helper
- Error cases (invalid type, missing fields)

**Integration Tests (Future Phase):**
- Full interrupt-resume cycle with `human_assistance` tool
- Checkpoint persistence across resume
- SSE stream content validation

**Curl Command Validation:**
```bash
# 1. Create thread with HITL tool
curl -X POST http://localhost:8000/api/llm/stream \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "input": {"messages": [{"role": "user", "content": "I need human help with X"}]},
    "tools": ["human_assistance"]
  }'

# 2. Check interrupt state
curl http://localhost:8000/api/threads/$THREAD_ID/interrupt \
  -H "Authorization: Bearer $TOKEN"

# 3. Resume with accept decision
curl -X POST http://localhost:8000/api/threads/$THREAD_ID/resume \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"decision": {"type": "accept"}}'

# 4. Resume with edit decision
curl -X POST http://localhost:8000/api/threads/$THREAD_ID/resume \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"decision": {"type": "edit", "args": {"args": {"city": "Austin"}}}}'

# 5. Resume with response
curl -X POST http://localhost:8000/api/threads/$THREAD_ID/resume \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"decision": {"type": "response", "args": "Please use the search tool instead"}}'
```

---

## 6. Estimated Complexity

| Metric | Assessment |
|--------|------------|
| **Scope** | Small-Medium |
| **Risk Level** | Low |
| **Lines of Code** | ~250 new, ~20 modified |
| **Test Coverage** | ~15 unit tests |
| **Estimated Effort** | 2-4 hours |

### Priority Order for Implementation

1. **Schema definition** (`interrupt.py`) - Foundation for everything else
2. **Unit tests for schemas** - Validate design before routes
3. **Resume endpoint** - Core functionality
4. **Interrupt state endpoint** - Polling/debugging support
5. **Resume stream helper** - Streaming infrastructure
6. **Integration testing with curl** - End-to-end validation

---

## 7. API Reference Summary

### New Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/threads/{thread_id}/resume` | Resume interrupted execution with human decision |
| `GET` | `/api/threads/{thread_id}/interrupt` | Get current interrupt state |

### New Schemas

| Schema | Purpose |
|--------|---------|
| `InterruptDecision` | Human decision (accept/edit/response) |
| `ResumeRequest` | Request body for resume endpoint |
| `InterruptState` | Response showing pending interrupts |
| `InterruptRequest` | Details of an interrupt from the agent |
| `InterruptAction` | Tool/action that triggered interrupt |

---

## 8. Conclusion

This proposal provides a minimal, focused implementation that:

1. **Leverages existing infrastructure** - Checkpoints, streaming, and tool wrappers already exist
2. **Follows SOLID principles** - Single-purpose endpoints, clear schema separation
3. **Maintains backward compatibility** - No changes to existing `/llm/stream` or `/llm/invoke`
4. **Enables validation** - Unit tests first, then curl commands for E2E testing
5. **Provides clear upgrade path** - Future phases can add WebSocket support, batch decisions, or UI components

The implementation can be completed incrementally, with each phase producing testable artifacts.
