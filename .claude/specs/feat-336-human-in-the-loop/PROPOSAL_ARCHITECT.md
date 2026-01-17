# Architectural Proposal: Human-in-the-Loop API Routes for DeepAgents

**Issue:** GitHub Issue #336
**Title:** FEAT: Configure human-in-the-loop in deepagents with initial phase focus on API routes
**Author:** AGENT_1: ARCHITECT
**Date:** 2026-01-17

---

## 1. Executive Summary

This proposal recommends implementing a minimal API extension that enables the Human-in-the-Loop (HITL) workflow in the simplest possible manner. The approach leverages the **existing LangGraph interrupt infrastructure** already present in the codebase (via `langgraph.types.interrupt()` and `AsyncPostgresSaver` checkpointer), adding only two new endpoints: one to **get pending interrupts** for a thread and one to **resume execution** with human decisions. The implementation follows existing route patterns and validates the workflow first with unit tests, then with curl commands.

---

## 2. Architectural Analysis

### 2.1 Current State Assessment

**Existing HITL Infrastructure (Already Implemented):**

| Component | Location | Status |
|-----------|----------|--------|
| `interrupt()` function | `langgraph.types` | Ready to use |
| `add_human_in_the_loop()` wrapper | `backend/src/utils/tools.py` | Implemented, supports accept/edit/respond |
| `human_assistance` tool | `backend/src/tools/test.py` | Working example using `interrupt()` |
| `AsyncPostgresSaver` checkpointer | `backend/src/services/db.py` | Active in all LLM routes |
| `CheckpointService` | `backend/src/services/checkpoint.py` | Has `aget_state()`, `list_checkpoints()` |
| `ThreadService` | `backend/src/services/thread.py` | Full CRUD with thread_id |
| `ServiceContext` | `backend/src/contexts/service.py` | Aggregates all services |

**What LangGraph Provides:**
When a tool wrapped with `add_human_in_the_loop()` is invoked, or when `interrupt()` is called directly:

1. The graph execution **pauses** at that node
2. A **checkpoint** is saved with the interrupted state
3. `graph.aget_state(config)` returns a `StateSnapshot` with:
   - `values`: Current state values (messages, files, etc.)
   - `next`: The node(s) that will execute next
   - `tasks`: Pending tasks with interrupt information
   - `config`: Thread/checkpoint identifiers

**What's Missing (Gaps to Fill):**

1. **No endpoint to get pending interrupts** - Clients cannot discover when execution is paused
2. **No endpoint to resume with decisions** - No way to send `Command(resume=...)`
3. **No SSE event for interrupt detection** - Stream doesn't signal when paused

### 2.2 LangGraph HITL Pattern

Per LangGraph documentation, the interrupt/resume flow works as follows:

```
                                        +-------------------+
                                        |  Client Request   |
                                        |  (POST /llm/*)    |
                                        +-------------------+
                                                |
                                                v
                                        +-------------------+
                                        |  Graph Execution  |
                                        +-------------------+
                                                |
                                    Tool calls interrupt()
                                                |
                                                v
                                        +-------------------+
                                        |  Graph Pauses     |
                                        |  Checkpoint Saved |
                                        +-------------------+
                                                |
                                                v
                                        +-------------------+
                                        |  Client Polls     |
                                        |  GET /interrupts  |
                                        +-------------------+
                                                |
                                    Interrupt data returned
                                                |
                                                v
                                        +-------------------+
                                        |  Human Decision   |
                                        |  (approve/edit/   |
                                        |   reject/respond) |
                                        +-------------------+
                                                |
                                                v
                                        +-------------------+
                                        |  POST /resume     |
                                        |  with decisions   |
                                        +-------------------+
                                                |
                                                v
                                        +-------------------+
                                        |  Graph Resumes    |
                                        |  Tool receives    |
                                        |  response         |
                                        +-------------------+
```

### 2.3 Key LangGraph Types

From `langgraph.types`:

```python
from langgraph.types import Command, interrupt, StateSnapshot

# When a tool calls interrupt(), it returns an Interrupt object:
# The graph pauses and the state is checkpointed

# To resume, use Command with resume payload:
result = await graph.ainvoke(
    Command(resume={"decisions": [decision]}),
    config=config
)

# Where decision follows HumanInterruptResponse structure:
decision = {
    "type": "accept",  # or "edit" or "response"
    "args": {...}      # optional, used for "edit" and "response"
}
```

### 2.4 Integration Points

| Component | Integration Type | Changes Required |
|-----------|------------------|------------------|
| `backend/src/routes/v0/thread.py` | **Primary** | Add 2 new endpoints |
| `backend/src/schemas/entities/llm.py` | **Secondary** | Add request/response schemas |
| `backend/src/services/checkpoint.py` | **Minor** | Add `get_interrupts()` method |
| `backend/tests/unit/routes/` | **New** | Add HITL route tests |

---

## 3. Implementation Strategy

### 3.1 Step-by-Step Implementation Plan

#### Phase 1: Schema Definitions (Low Risk)

**Step 1.1:** Add interrupt-related schemas to `backend/src/schemas/entities/llm.py`

```python
# backend/src/schemas/entities/llm.py - Add after existing schemas

from typing import Literal
from pydantic import BaseModel, Field

class InterruptInfo(BaseModel):
    """Information about a pending interrupt in a thread."""
    interrupt_id: str = Field(..., description="Unique identifier for this interrupt")
    tool_name: str = Field(..., description="Name of the tool that triggered the interrupt")
    tool_args: dict = Field(default_factory=dict, description="Arguments passed to the tool")
    description: str = Field(default="", description="Human-readable description of the request")
    config: dict = Field(default_factory=dict, description="Allowed actions (accept, edit, respond)")
    created_at: Optional[str] = Field(default=None, description="When the interrupt was created")


class InterruptListResponse(BaseModel):
    """Response containing pending interrupts for a thread."""
    thread_id: str
    has_interrupts: bool = Field(default=False)
    interrupts: List[InterruptInfo] = Field(default_factory=list)
    checkpoint_id: Optional[str] = None


class InterruptDecision(BaseModel):
    """A single decision for an interrupt."""
    type: Literal["accept", "edit", "response"] = Field(
        ...,
        description="Type of response: 'accept' approves, 'edit' modifies args, 'response' provides feedback"
    )
    args: Optional[dict] = Field(
        default=None,
        description="For 'edit': new tool args. For 'response': user feedback dict with 'data' key."
    )


class ResumeRequest(BaseModel):
    """Request to resume a paused thread with human decisions."""
    decisions: List[InterruptDecision] = Field(
        ...,
        description="List of decisions for pending interrupts (order must match interrupt order)"
    )


class ResumeResponse(BaseModel):
    """Response after resuming thread execution."""
    thread_id: str
    checkpoint_id: str
    resumed: bool = True
    message: str = "Thread execution resumed successfully"
```

#### Phase 2: Service Layer Enhancement (Low Risk)

**Step 2.1:** Add interrupt retrieval to `CheckpointService`

```python
# backend/src/services/checkpoint.py - Add new method

async def get_interrupts(self, thread_id: str) -> dict:
    """
    Get pending interrupts for a thread from the current state.

    Returns:
        dict with:
            - has_interrupts: bool
            - interrupts: list of interrupt info dicts
            - checkpoint_id: current checkpoint id
            - next: nodes that will execute next
    """
    config = RunnableConfig(configurable={"thread_id": thread_id})

    try:
        state: StateSnapshot = await self.graph.aget_state(config)

        interrupts = []
        # StateSnapshot.tasks contains PregelTask objects with interrupt info
        for task in state.tasks:
            if hasattr(task, 'interrupts') and task.interrupts:
                for interrupt_item in task.interrupts:
                    # HumanInterrupt structure from langgraph.prebuilt.interrupt
                    interrupts.append({
                        "interrupt_id": str(task.id),
                        "tool_name": interrupt_item.get("action_request", {}).get("action", "unknown"),
                        "tool_args": interrupt_item.get("action_request", {}).get("args", {}),
                        "description": interrupt_item.get("description", ""),
                        "config": interrupt_item.get("config", {}),
                    })

        return {
            "has_interrupts": len(interrupts) > 0,
            "interrupts": interrupts,
            "checkpoint_id": state.config.get("configurable", {}).get("checkpoint_id"),
            "next": list(state.next) if state.next else [],
        }
    except Exception as e:
        logger.warning(f"Error getting interrupts for thread {thread_id}: {e}")
        return {
            "has_interrupts": False,
            "interrupts": [],
            "checkpoint_id": None,
            "next": [],
        }
```

#### Phase 3: Route Implementation (Medium Complexity)

**Step 3.1:** Add new endpoints to `backend/src/routes/v0/thread.py`

```python
# backend/src/routes/v0/thread.py - Add imports
from langgraph.types import Command
from src.schemas.entities.llm import (
    InterruptListResponse,
    InterruptInfo,
    ResumeRequest,
    ResumeResponse,
)

# Add new endpoints after existing thread routes

@router.get(
    "/threads/{thread_id}/interrupts",
    name="Get Thread Interrupts",
    operation_id="ruska_get_thread_interrupts",
    tags=["Human-in-the-Loop"],
    response_model=InterruptListResponse,
)
async def get_thread_interrupts(
    thread_id: str,
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    """
    Get pending interrupts for a thread.

    When a tool with human-in-the-loop enabled is invoked, the graph execution
    pauses and creates an interrupt. This endpoint returns any pending interrupts
    that require human decision.

    Args:
        thread_id: The thread ID to check for interrupts

    Returns:
        InterruptListResponse with pending interrupts if any exist
    """
    try:
        async with get_checkpoint_db() as checkpointer:
            service_context = ServiceContext(
                user_id=user.id, store=store, checkpointer=checkpointer
            )

            # Build graph to access state (needed for aget_state)
            # Use minimal graph configuration
            from src.flows import graph_builder
            from src.schemas.contexts import ContextSchema

            graph = graph_builder(
                tools=[],
                subagents=[],
                system_prompt="",
                checkpointer=checkpointer,
                store=store,
                context_schema=ContextSchema,
                middleware=[],
            )

            service_context.checkpoint_service.graph = graph
            interrupt_data = await service_context.checkpoint_service.get_interrupts(thread_id)

            return InterruptListResponse(
                thread_id=thread_id,
                has_interrupts=interrupt_data["has_interrupts"],
                interrupts=[InterruptInfo(**i) for i in interrupt_data["interrupts"]],
                checkpoint_id=interrupt_data.get("checkpoint_id"),
            )
    except Exception as e:
        logger.exception(f"Error getting interrupts for thread {thread_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post(
    "/threads/{thread_id}/resume",
    name="Resume Thread Execution",
    operation_id="ruska_resume_thread",
    tags=["Human-in-the-Loop"],
    response_model=ResumeResponse,
)
async def resume_thread(
    thread_id: str,
    request: ResumeRequest = Body(...),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    """
    Resume a paused thread with human decisions.

    After reviewing pending interrupts via GET /threads/{thread_id}/interrupts,
    use this endpoint to provide decisions and resume graph execution.

    Args:
        thread_id: The thread ID to resume
        request: ResumeRequest with list of decisions

    Returns:
        ResumeResponse with new checkpoint information

    Raises:
        HTTPException 400: If no interrupts pending
        HTTPException 400: If decision count doesn't match interrupt count
    """
    try:
        async with get_checkpoint_db() as checkpointer:
            service_context = ServiceContext(
                user_id=user.id, store=store, checkpointer=checkpointer
            )

            # Build graph for resume operation
            from src.flows import graph_builder, init_config
            from src.schemas.contexts import ContextSchema
            from src.schemas.entities import LLMRequest, LLMInput

            graph = graph_builder(
                tools=[],  # Tools will be loaded from checkpoint state
                subagents=[],
                system_prompt="",
                checkpointer=checkpointer,
                store=store,
                context_schema=ContextSchema,
                middleware=[],
            )

            # Check for pending interrupts first
            service_context.checkpoint_service.graph = graph
            interrupt_data = await service_context.checkpoint_service.get_interrupts(thread_id)

            if not interrupt_data["has_interrupts"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No pending interrupts for this thread"
                )

            if len(request.decisions) != len(interrupt_data["interrupts"]):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Expected {len(interrupt_data['interrupts'])} decisions, got {len(request.decisions)}"
                )

            # Build config for resume
            config = RunnableConfig(
                configurable={
                    "thread_id": thread_id,
                    "user_id": user.id,
                }
            )

            # Format decisions for LangGraph Command
            formatted_decisions = []
            for decision in request.decisions:
                formatted_decision = {"type": decision.type}
                if decision.args:
                    formatted_decision["args"] = decision.args
                formatted_decisions.append(formatted_decision)

            # Resume graph execution with Command
            result = await graph.ainvoke(
                Command(resume=formatted_decisions),
                config=config,
            )

            # Get updated state
            new_state = await graph.aget_state(config)
            new_checkpoint_id = new_state.config.get("configurable", {}).get("checkpoint_id", "")

            return ResumeResponse(
                thread_id=thread_id,
                checkpoint_id=new_checkpoint_id,
                resumed=True,
                message="Thread execution resumed successfully"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error resuming thread {thread_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
```

#### Phase 4: Unit Tests (Required)

**Step 4.1:** Create test file `backend/tests/unit/routes/test_thread_hitl.py`

```python
# backend/tests/unit/routes/test_thread_hitl.py

"""Unit tests for Human-in-the-Loop thread routes."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from src.schemas.entities.llm import (
    InterruptListResponse,
    InterruptInfo,
    InterruptDecision,
    ResumeRequest,
    ResumeResponse,
)


class TestInterruptSchemas:
    """Test schema validation for HITL types."""

    def test_interrupt_info_schema(self):
        """Test InterruptInfo schema accepts valid data."""
        info = InterruptInfo(
            interrupt_id="task-123",
            tool_name="human_assistance",
            tool_args={"query": "Should I proceed?"},
            description="Please review the action",
            config={"allow_accept": True, "allow_edit": True, "allow_respond": True}
        )
        assert info.tool_name == "human_assistance"
        assert info.config["allow_accept"] is True

    def test_interrupt_list_response_empty(self):
        """Test InterruptListResponse with no interrupts."""
        response = InterruptListResponse(
            thread_id="thread-abc",
            has_interrupts=False,
            interrupts=[],
        )
        assert response.has_interrupts is False
        assert len(response.interrupts) == 0

    def test_interrupt_list_response_with_interrupts(self):
        """Test InterruptListResponse with pending interrupts."""
        response = InterruptListResponse(
            thread_id="thread-abc",
            has_interrupts=True,
            interrupts=[
                InterruptInfo(
                    interrupt_id="task-1",
                    tool_name="search_web",
                    tool_args={"query": "latest news"},
                )
            ],
            checkpoint_id="cp-xyz",
        )
        assert response.has_interrupts is True
        assert len(response.interrupts) == 1
        assert response.checkpoint_id == "cp-xyz"

    def test_interrupt_decision_accept(self):
        """Test InterruptDecision with 'accept' type."""
        decision = InterruptDecision(type="accept")
        assert decision.type == "accept"
        assert decision.args is None

    def test_interrupt_decision_edit(self):
        """Test InterruptDecision with 'edit' type and modified args."""
        decision = InterruptDecision(
            type="edit",
            args={"args": {"query": "modified query"}}
        )
        assert decision.type == "edit"
        assert decision.args["args"]["query"] == "modified query"

    def test_interrupt_decision_response(self):
        """Test InterruptDecision with 'response' type and feedback."""
        decision = InterruptDecision(
            type="response",
            args={"data": "User provided this feedback instead"}
        )
        assert decision.type == "response"
        assert "data" in decision.args

    def test_resume_request_schema(self):
        """Test ResumeRequest with multiple decisions."""
        request = ResumeRequest(
            decisions=[
                InterruptDecision(type="accept"),
                InterruptDecision(type="edit", args={"args": {"x": 1}}),
            ]
        )
        assert len(request.decisions) == 2

    def test_resume_response_schema(self):
        """Test ResumeResponse schema."""
        response = ResumeResponse(
            thread_id="thread-123",
            checkpoint_id="cp-456",
            resumed=True,
            message="Execution resumed"
        )
        assert response.resumed is True


class TestCheckpointServiceGetInterrupts:
    """Tests for CheckpointService.get_interrupts method."""

    @pytest.mark.asyncio
    async def test_get_interrupts_no_pending(self):
        """When no interrupts pending, returns empty list."""
        from src.services.checkpoint import CheckpointService

        mock_graph = AsyncMock()
        mock_state = MagicMock()
        mock_state.tasks = []
        mock_state.next = []
        mock_state.config = {"configurable": {"checkpoint_id": "cp-123"}}
        mock_graph.aget_state.return_value = mock_state

        service = CheckpointService()
        service.graph = mock_graph

        result = await service.get_interrupts("thread-abc")

        assert result["has_interrupts"] is False
        assert len(result["interrupts"]) == 0
        assert result["checkpoint_id"] == "cp-123"

    @pytest.mark.asyncio
    async def test_get_interrupts_with_pending(self):
        """When interrupts pending, returns interrupt info."""
        from src.services.checkpoint import CheckpointService

        mock_task = MagicMock()
        mock_task.id = "task-456"
        mock_task.interrupts = [
            {
                "action_request": {"action": "human_assistance", "args": {"query": "help"}},
                "description": "Please review",
                "config": {"allow_accept": True},
            }
        ]

        mock_graph = AsyncMock()
        mock_state = MagicMock()
        mock_state.tasks = [mock_task]
        mock_state.next = ["agent"]
        mock_state.config = {"configurable": {"checkpoint_id": "cp-789"}}
        mock_graph.aget_state.return_value = mock_state

        service = CheckpointService()
        service.graph = mock_graph

        result = await service.get_interrupts("thread-xyz")

        assert result["has_interrupts"] is True
        assert len(result["interrupts"]) == 1
        assert result["interrupts"][0]["tool_name"] == "human_assistance"
        assert result["interrupts"][0]["tool_args"]["query"] == "help"


class TestHITLEndpointsIntegration:
    """Integration-style tests for HITL endpoints (mocked dependencies)."""

    @pytest.mark.asyncio
    async def test_get_interrupts_endpoint_no_interrupts(self):
        """GET /threads/{id}/interrupts returns empty when no interrupts."""
        # This would use TestClient with mocked dependencies
        # Placeholder for actual integration test
        pass

    @pytest.mark.asyncio
    async def test_resume_endpoint_success(self):
        """POST /threads/{id}/resume successfully resumes execution."""
        # This would use TestClient with mocked graph
        # Placeholder for actual integration test
        pass

    @pytest.mark.asyncio
    async def test_resume_endpoint_no_interrupts_error(self):
        """POST /threads/{id}/resume returns 400 when no interrupts pending."""
        # Placeholder for actual integration test
        pass

    @pytest.mark.asyncio
    async def test_resume_endpoint_wrong_decision_count(self):
        """POST /threads/{id}/resume returns 400 when decision count mismatch."""
        # Placeholder for actual integration test
        pass
```

#### Phase 5: Manual Validation with curl (Required)

**Step 5.1:** Create validation script with curl commands

```bash
# HITL Workflow Validation Script
# Run these commands after starting the server with: make dev

# Variables - set these before running
export BASE_URL="http://localhost:8000/api"
export AUTH_TOKEN="your-jwt-token-here"

# Step 1: Login to get token (if needed)
curl -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "test1234"}'

# Step 2: Create a thread
curl -X POST "${BASE_URL}/threads" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "id": null,
    "metadata": {"assistant_id": null}
  }'
# Expected: {"thread_id": "...", "checkpoint_id": "..."}

# Step 3: Invoke LLM with human_assistance tool to trigger interrupt
# (Assumes human_assistance tool is available and triggers interrupt)
export THREAD_ID="<thread_id_from_step_2>"
curl -X POST "${BASE_URL}/llm/invoke" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "input": {
      "messages": [{"role": "user", "content": "I need human assistance with this task"}]
    },
    "tools": ["human_assistance"],
    "metadata": {"thread_id": "'"${THREAD_ID}"'"}
  }'
# Expected: Response may be partial or indicate interruption

# Step 4: Check for pending interrupts
curl -X GET "${BASE_URL}/threads/${THREAD_ID}/interrupts" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"
# Expected:
# {
#   "thread_id": "...",
#   "has_interrupts": true,
#   "interrupts": [
#     {
#       "interrupt_id": "task-...",
#       "tool_name": "human_assistance",
#       "tool_args": {"query": "..."},
#       "description": "Please review the action",
#       "config": {"allow_accept": true, "allow_edit": true, "allow_respond": true}
#     }
#   ],
#   "checkpoint_id": "..."
# }

# Step 5a: Resume with 'accept' decision
curl -X POST "${BASE_URL}/threads/${THREAD_ID}/resume" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "decisions": [{"type": "accept"}]
  }'
# Expected: {"thread_id": "...", "checkpoint_id": "...", "resumed": true, "message": "..."}

# Step 5b: Alternative - Resume with 'response' decision (user feedback)
curl -X POST "${BASE_URL}/threads/${THREAD_ID}/resume" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "decisions": [{"type": "response", "args": {"data": "User says: proceed with caution"}}]
  }'

# Step 5c: Alternative - Resume with 'edit' decision (modified args)
curl -X POST "${BASE_URL}/threads/${THREAD_ID}/resume" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "decisions": [{"type": "edit", "args": {"args": {"query": "modified query"}}}]
  }'

# Step 6: Verify thread no longer has interrupts
curl -X GET "${BASE_URL}/threads/${THREAD_ID}/interrupts" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"
# Expected: {"thread_id": "...", "has_interrupts": false, "interrupts": [], ...}

# Error Cases:

# Error Case 1: Resume without interrupts
curl -X POST "${BASE_URL}/threads/${THREAD_ID}/resume" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{"decisions": [{"type": "accept"}]}'
# Expected: 400 Bad Request - "No pending interrupts for this thread"

# Error Case 2: Wrong number of decisions
curl -X POST "${BASE_URL}/threads/${THREAD_ID}/resume" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{"decisions": [{"type": "accept"}, {"type": "accept"}]}'
# Expected: 400 Bad Request - "Expected 1 decisions, got 2"

# Error Case 3: Invalid thread_id
curl -X GET "${BASE_URL}/threads/nonexistent-thread/interrupts" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"
# Expected: {"thread_id": "...", "has_interrupts": false, "interrupts": []}
```

### 3.2 File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `backend/src/schemas/entities/llm.py` | **Modify** | Add InterruptInfo, InterruptListResponse, InterruptDecision, ResumeRequest, ResumeResponse schemas |
| `backend/src/services/checkpoint.py` | **Modify** | Add `get_interrupts()` method |
| `backend/src/routes/v0/thread.py` | **Modify** | Add GET `/threads/{id}/interrupts` and POST `/threads/{id}/resume` endpoints |
| `backend/tests/unit/routes/test_thread_hitl.py` | **Create** | Unit tests for HITL schemas and service methods |

### 3.3 Key Code Patterns to Follow

1. **Route Pattern:** Follow existing `thread.py` pattern with `async with get_checkpoint_db() as checkpointer`
2. **Service Context:** Use `ServiceContext` for dependency injection
3. **Response Models:** Use Pydantic models for request/response validation
4. **Error Handling:** Use `HTTPException` with appropriate status codes
5. **Logging:** Use `logger.exception()` for errors, `logger.info()` for success
6. **Graph Access:** Build minimal graph to access state via `aget_state()`

---

## 4. Design Decisions

### 4.1 Trade-offs Considered

| Decision | Alternative | Rationale |
|----------|-------------|-----------|
| **Separate `/interrupts` and `/resume` endpoints** | Single endpoint that handles both | Cleaner REST semantics; GET for read, POST for action |
| **Decisions as ordered list** | Map decisions by interrupt_id | Simpler API; interrupts are returned in deterministic order |
| **Minimal graph for state access** | Full graph reconstruction | Performance; only need checkpointer to read state |
| **Polling for interrupts** | WebSocket/SSE push | Simpler implementation; can add push later |
| **Thread-scoped interrupts** | Global interrupt queue | Follows existing thread-based architecture |

### 4.2 Why This Approach Over Alternatives

**Alternative 1: Modify `/llm/invoke` to return interrupts inline**
- **Rejected because:** Would require client changes to handle partial responses and introduce complexity in the invoke flow. Separate endpoints maintain clean separation of concerns.

**Alternative 2: Use Server-Sent Events to push interrupt notifications**
- **Deferred:** Good future enhancement but adds complexity. Polling is sufficient for MVP and allows clients to control refresh rate.

**Alternative 3: Store interrupts in separate database table**
- **Rejected because:** LangGraph already persists interrupt state in checkpoints. Duplicating data would require synchronization logic.

**Alternative 4: Generic `/commands` endpoint for all graph commands**
- **Rejected because:** Over-engineering for current use case. HITL is the primary use case for `Command(resume=...)`.

### 4.3 Alignment with Existing Codebase Patterns

- **Route Registration:** Adds to existing `thread.py` router (same tags, auth)
- **Service Pattern:** Uses `ServiceContext` and `CheckpointService` as per existing code
- **Schema Location:** Schemas in `schemas/entities/llm.py` alongside related types
- **Error Handling:** Uses `HTTPException` with status codes as per existing routes
- **Async Pattern:** All endpoints are async, using `async with` for checkpointer
- **OpenAPI Tags:** Uses new "Human-in-the-Loop" tag for discoverability

---

## 5. Risk Assessment

### 5.1 Potential Pitfalls

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Graph state corruption on resume** | Low | High | Validate decision count matches interrupt count |
| **Stale interrupt data** | Medium | Low | Fetch fresh state on each `/interrupts` call |
| **Concurrent resume attempts** | Low | Medium | LangGraph handles via checkpoint versioning |
| **Graph reconstruction overhead** | Medium | Low | Use minimal graph config for state access |
| **Interrupt format changes in LangGraph** | Low | Medium | Abstract interrupt parsing in service layer |

### 5.2 Edge Cases to Handle

1. **No interrupts pending:** Return `has_interrupts: false` with empty list (not 404)
2. **Thread doesn't exist:** Return empty interrupts (graceful degradation)
3. **Resume with wrong decision count:** Return 400 with clear error message
4. **Multiple simultaneous interrupts:** Support list of decisions matching interrupt order
5. **Invalid decision type:** Pydantic validation rejects; return 422
6. **Interrupt expires/times out:** Not applicable; interrupts persist in checkpoint until resumed

### 5.3 Testing Considerations

**Unit Tests (Required):**
- Schema validation for all new Pydantic models
- `CheckpointService.get_interrupts()` with mocked graph state
- Empty interrupts case
- Interrupts with various HumanInterrupt configurations

**Integration Tests (Recommended):**
- Full workflow: invoke -> check interrupts -> resume -> verify completion
- Error cases: resume without interrupts, wrong decision count

**Manual Testing (Required):**
- curl workflow against running server
- Test with `human_assistance` tool from `src/tools/test.py`

---

## 6. Estimated Complexity

### 6.1 Scope Assessment

| Metric | Value | Justification |
|--------|-------|---------------|
| **Scope** | **Small** | 4 files modified, ~200 lines of new code |
| **Risk Level** | **Low** | Leverages existing LangGraph infrastructure |
| **Effort** | 3-5 hours | Implementation + unit tests + manual validation |

### 6.2 Suggested Priority Order

1. **Add schemas to `llm.py`** (15 min)
2. **Add `get_interrupts()` to CheckpointService** (30 min)
3. **Add GET `/interrupts` endpoint** (30 min)
4. **Add POST `/resume` endpoint** (45 min)
5. **Write unit tests** (1 hour)
6. **Manual curl validation** (30 min)
7. **Code review and merge** (30 min)

### 6.3 Dependencies for Implementation

- `langgraph.types.Command` (already installed via langgraph)
- `langgraph.types.StateSnapshot` (already installed)
- Existing `AsyncPostgresSaver` checkpointer
- Existing `human_assistance` tool for testing

---

## 7. Appendix

### 7.1 LangGraph StateSnapshot Structure

```python
# From langgraph.types.StateSnapshot
class StateSnapshot(NamedTuple):
    values: dict[str, Any]           # Current state values (messages, files, etc.)
    next: tuple[str, ...]            # Nodes that will execute next
    config: RunnableConfig           # Config with thread_id, checkpoint_id
    metadata: Optional[dict]         # Checkpoint metadata
    created_at: Optional[str]        # Timestamp
    parent_config: Optional[RunnableConfig]
    tasks: tuple[PregelTask, ...]    # Pending tasks with interrupt info
```

### 7.2 HumanInterrupt Structure

```python
# From langgraph.prebuilt.interrupt
class HumanInterrupt(TypedDict):
    action_request: dict  # {"action": str, "args": dict}
    config: HumanInterruptConfig  # {"allow_accept": bool, "allow_edit": bool, "allow_respond": bool}
    description: str  # Human-readable description

class HumanInterruptResponse(TypedDict):
    type: Literal["accept", "edit", "response"]
    args: Optional[dict]  # For "edit": new args. For "response": {"data": str}
```

### 7.3 Existing Tool Example

The codebase already has a working `human_assistance` tool that uses `interrupt()`:

```python
# backend/src/tools/test.py
@tool(description="Request assistance from a human")
def human_assistance(query: str) -> str:
    human_response = interrupt({"query": query})
    return human_response["data"]
```

This tool can be used to validate the HITL workflow.

### 7.4 API Documentation

After implementation, the OpenAPI docs at `/docs` will show:

**GET /threads/{thread_id}/interrupts**
- Tags: Human-in-the-Loop
- Summary: Get pending interrupts for a thread
- Response: InterruptListResponse

**POST /threads/{thread_id}/resume**
- Tags: Human-in-the-Loop
- Summary: Resume thread with human decisions
- Request Body: ResumeRequest
- Response: ResumeResponse

---

**Proposal Status:** Ready for Review
**Recommended Reviewer:** Backend Lead / Tech Lead
**Implementation Ready:** Yes (all dependencies already in codebase)
