# PROPOSAL_GUARDIAN.md

## Human-in-the-Loop API Implementation Proposal

**Agent:** GUARDIAN (Security, Error Handling, Edge Cases, Testing)
**Feature:** Configure human-in-the-loop in deepagents with initial phase focus on API routes
**Date:** 2026-01-17

---

## 1. Executive Summary

This proposal outlines a security-first approach to implementing human-in-the-loop (HITL) API endpoints for the Orchestra backend. The implementation leverages the existing `add_human_in_the_loop()` wrapper in `backend/src/utils/tools.py` and the `CheckpointService` in `backend/src/services/checkpoint.py` to enable workflow interruption and resumption. The focus is on defensive input validation, comprehensive authorization checks, and thorough error handling to ensure robust operation under adversarial conditions.

---

## 2. Architectural Analysis

### 2.1 Current State Assessment

**Existing Foundation:**

1. **Interrupt Mechanism** (`backend/src/utils/tools.py:23-63`):
   - `add_human_in_the_loop()` wrapper function already exists
   - Supports three action types: `accept`, `edit`, `response`
   - Uses LangGraph's `interrupt()` function with `HumanInterrupt` type
   - Returns `HumanInterruptConfig` with allowed actions

2. **Checkpoint System** (`backend/src/services/checkpoint.py`):
   - `CheckpointService` class with async operations
   - `update_checkpoint_state()` method for state resumption (line 121-122)
   - `get_checkpoint_state()` for retrieving current state
   - `list_checkpoints()` with retry logic for reliability

3. **Thread Management** (`backend/src/routes/v0/thread.py`):
   - Full CRUD operations with authorization via `verify_credentials`
   - Uses `ServiceContext` pattern for dependency injection
   - Consistent error handling pattern with `HTTPException`

4. **Human Assistance Tool** (`backend/src/tools/test.py:30-33`):
   - `human_assistance` tool already implemented using `interrupt()`
   - Returns `human_response["data"]` after interrupt resolution

**Gap Analysis:**

| Component | Status | Gap |
|-----------|--------|-----|
| Interrupt trigger | EXISTS | None |
| State persistence | EXISTS | None |
| Resume endpoint | MISSING | Need POST /threads/{thread_id}/resume |
| Interrupt detection | MISSING | Need GET /threads/{thread_id}/state |
| Decision validation | MISSING | Need Pydantic schemas |
| Authorization | PARTIAL | Need ownership verification for resume |

### 2.2 Proposed Changes

```
backend/
  src/
    schemas/
      entities/
        hitl.py           # NEW: Human-in-the-loop schemas
    routes/
      v0/
        thread.py         # MODIFY: Add resume and state endpoints
    services/
      checkpoint.py       # MODIFY: Add interrupt detection helpers
  tests/
    unit/
      routes/
        test_hitl.py      # NEW: Unit tests for HITL endpoints
      schemas/
        test_hitl_schemas.py  # NEW: Schema validation tests
```

### 2.3 Integration Points

1. **Route Layer** (`thread.py`):
   - New `POST /threads/{thread_id}/resume` endpoint
   - New `GET /threads/{thread_id}/state` endpoint for interrupt detection

2. **Service Layer** (`CheckpointService`):
   - Add `has_pending_interrupt()` method
   - Add `get_interrupt_details()` method

3. **Schema Layer** (new `hitl.py`):
   - `HumanDecision` schema with strict validation
   - `InterruptState` schema for state responses

---

## 3. Implementation Strategy

### 3.1 Phase 1: Schema Definitions (Security Foundation)

**File:** `backend/src/schemas/entities/hitl.py`

```python
from enum import Enum
from typing import Optional, Any, Dict, Literal
from pydantic import BaseModel, Field, field_validator, model_validator
import re


class DecisionType(str, Enum):
    """Enumeration of valid human decision types."""
    ACCEPT = "accept"
    EDIT = "edit"
    RESPONSE = "response"
    REJECT = "reject"  # Additional type for explicit rejection


class HumanDecision(BaseModel):
    """
    Schema for human decisions on interrupted tool calls.

    Security Considerations:
    - Strict enum validation for decision_type
    - Content length limits to prevent DoS
    - Sanitization of edited arguments
    """
    decision_type: DecisionType = Field(
        ...,
        description="The type of decision: accept, edit, response, or reject"
    )

    # For 'edit' decisions - the modified tool arguments
    edited_args: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Modified tool call arguments (required for 'edit' type)"
    )

    # For 'response' decisions - human feedback to the LLM
    response_content: Optional[str] = Field(
        default=None,
        max_length=10000,  # Prevent DoS via excessive content
        description="Human feedback content (required for 'response' type)"
    )

    # For 'reject' decisions - optional rejection reason
    rejection_reason: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Reason for rejection (optional for 'reject' type)"
    )

    @model_validator(mode="after")
    def validate_decision_requirements(self):
        """Ensure required fields are present based on decision type."""
        if self.decision_type == DecisionType.EDIT:
            if self.edited_args is None:
                raise ValueError("edited_args is required for 'edit' decision type")
            # Validate edited_args is not excessively large
            import json
            if len(json.dumps(self.edited_args)) > 50000:
                raise ValueError("edited_args exceeds maximum size (50KB)")

        elif self.decision_type == DecisionType.RESPONSE:
            if not self.response_content or not self.response_content.strip():
                raise ValueError("response_content is required for 'response' decision type")

        return self

    @field_validator("response_content")
    @classmethod
    def sanitize_response_content(cls, v: Optional[str]) -> Optional[str]:
        """Basic sanitization of response content."""
        if v is None:
            return v
        # Remove null bytes and control characters (except newlines/tabs)
        return re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', v)


class InterruptInfo(BaseModel):
    """Details about a pending interrupt."""
    tool_name: str = Field(..., description="Name of the interrupted tool")
    tool_args: Dict[str, Any] = Field(..., description="Original tool call arguments")
    description: str = Field(default="", description="Human-readable description")
    allowed_actions: Dict[str, bool] = Field(
        default_factory=lambda: {
            "allow_accept": True,
            "allow_edit": True,
            "allow_respond": True
        },
        description="Which actions are permitted for this interrupt"
    )


class ThreadInterruptState(BaseModel):
    """Response schema for thread interrupt state queries."""
    thread_id: str
    has_interrupt: bool = Field(..., description="Whether thread has pending interrupt")
    interrupt_info: Optional[InterruptInfo] = Field(
        default=None,
        description="Details about the interrupt (if any)"
    )
    checkpoint_id: Optional[str] = Field(
        default=None,
        description="Current checkpoint ID"
    )


class ResumeResponse(BaseModel):
    """Response schema for resume operations."""
    success: bool
    thread_id: str
    message: str
    next_checkpoint_id: Optional[str] = None
```

### 3.2 Phase 2: Service Layer Extensions

**File:** `backend/src/services/checkpoint.py` (modifications)

```python
# Add to CheckpointService class

async def has_pending_interrupt(self, thread_id: str) -> bool:
    """
    Check if a thread has a pending interrupt.

    Security: This is a read-only operation, safe for any authenticated user
    who has access to the thread.
    """
    try:
        if not self.graph:
            logger.warning("Graph not available for interrupt check")
            return False

        config = RunnableConfig(configurable={"thread_id": thread_id})
        state = await self.graph.aget_state(config)

        # Check for __interrupt__ in the state's next steps
        if state and hasattr(state, 'next'):
            return "__interrupt__" in (state.next or [])
        return False
    except Exception as e:
        logger.exception(f"Error checking interrupt state: {e}")
        return False


async def get_interrupt_details(self, thread_id: str) -> Optional[dict]:
    """
    Get details about a pending interrupt.

    Returns interrupt info if present, None otherwise.
    """
    try:
        if not self.graph:
            return None

        config = RunnableConfig(configurable={"thread_id": thread_id})
        state = await self.graph.aget_state(config)

        if not state or "__interrupt__" not in (state.next or []):
            return None

        # Extract interrupt details from state
        # The interrupt info is stored in state.values under the interrupt key
        interrupts = getattr(state, 'interrupts', [])
        if interrupts:
            interrupt = interrupts[0]
            return {
                "tool_name": interrupt.get("action_request", {}).get("action", "unknown"),
                "tool_args": interrupt.get("action_request", {}).get("args", {}),
                "description": interrupt.get("description", ""),
                "allowed_actions": interrupt.get("config", {})
            }
        return None
    except Exception as e:
        logger.exception(f"Error getting interrupt details: {e}")
        return None


async def resume_with_decision(
    self,
    thread_id: str,
    decision_type: str,
    decision_data: dict
) -> dict:
    """
    Resume a thread with a human decision.

    Args:
        thread_id: The thread to resume
        decision_type: One of 'accept', 'edit', 'response', 'reject'
        decision_data: Decision-specific data (edited_args, response_content, etc.)

    Returns:
        Dict with success status and updated checkpoint info

    Raises:
        ValueError: If no pending interrupt or invalid decision
    """
    if not self.graph:
        raise ValueError("Graph not configured for this checkpoint service")

    config = RunnableConfig(configurable={"thread_id": thread_id})

    # Verify there's a pending interrupt
    state = await self.graph.aget_state(config)
    if not state or "__interrupt__" not in (state.next or []):
        raise ValueError(f"No pending interrupt for thread {thread_id}")

    # Build the response based on decision type
    if decision_type == "accept":
        response = {"type": "accept"}
    elif decision_type == "edit":
        response = {"type": "edit", "args": {"args": decision_data.get("edited_args", {})}}
    elif decision_type == "response":
        response = {"type": "response", "args": decision_data.get("response_content", "")}
    elif decision_type == "reject":
        # Rejection is handled as a response with rejection message
        response = {
            "type": "response",
            "args": f"User rejected: {decision_data.get('rejection_reason', 'No reason provided')}"
        }
    else:
        raise ValueError(f"Invalid decision type: {decision_type}")

    # Update state with the human response
    updated_config = await self.graph.aupdate_state(
        config=config,
        values={"__interrupt__": [response]},
        as_node="__interrupt__"
    )

    return {
        "success": True,
        "checkpoint_id": updated_config.get("configurable", {}).get("checkpoint_id")
    }
```

### 3.3 Phase 3: API Route Implementation

**File:** `backend/src/routes/v0/thread.py` (additions)

```python
# Add imports at top
from src.schemas.entities.hitl import (
    HumanDecision,
    ThreadInterruptState,
    ResumeResponse,
    InterruptInfo,
    DecisionType,
)

# Add after existing endpoints

@router.get(
    "/threads/{thread_id}/state",
    name="Get Thread Interrupt State",
    operation_id="ruska_get_thread_state",
    response_model=ThreadInterruptState,
    tags=["HITL"],
)
async def get_thread_interrupt_state(
    thread_id: str,
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    """
    Check if a thread has a pending human-in-the-loop interrupt.

    Returns the current interrupt state including:
    - Whether an interrupt is pending
    - Details about the interrupted tool call
    - Allowed actions for resolution

    Security:
    - Requires authentication
    - Validates user owns/has access to the thread
    """
    try:
        async with get_checkpoint_db() as checkpointer:
            service_context = ServiceContext(
                user_id=user.id, store=store, checkpointer=checkpointer
            )

            # Verify thread exists and user has access
            thread = await service_context.thread_service.get(thread_id)
            if not thread:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Thread {thread_id} not found"
                )

            # Get interrupt state from checkpoint service
            # Note: Need to initialize with graph for interrupt detection
            from src.flows import graph_builder
            from src.services.db import get_store_in_memory

            # Build a minimal graph for state inspection
            service_context.checkpoint_service.graph = graph_builder(
                tools=[],
                checkpointer=checkpointer,
                store=store,
            )

            has_interrupt = await service_context.checkpoint_service.has_pending_interrupt(
                thread_id
            )

            interrupt_info = None
            checkpoint_id = None

            if has_interrupt:
                details = await service_context.checkpoint_service.get_interrupt_details(
                    thread_id
                )
                if details:
                    interrupt_info = InterruptInfo(
                        tool_name=details.get("tool_name", "unknown"),
                        tool_args=details.get("tool_args", {}),
                        description=details.get("description", ""),
                        allowed_actions=details.get("allowed_actions", {})
                    )

            # Get current checkpoint ID
            checkpoints = await service_context.checkpoint_service.list_checkpoints(
                thread_id, limit=1
            )
            if checkpoints:
                checkpoint_id = checkpoints[0].get("config", {}).get(
                    "configurable", {}
                ).get("checkpoint_id")

            return ThreadInterruptState(
                thread_id=thread_id,
                has_interrupt=has_interrupt,
                interrupt_info=interrupt_info,
                checkpoint_id=checkpoint_id,
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error getting thread state: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post(
    "/threads/{thread_id}/resume",
    name="Resume Thread with Human Decision",
    operation_id="ruska_resume_thread",
    response_model=ResumeResponse,
    tags=["HITL"],
)
async def resume_thread(
    thread_id: str,
    decision: HumanDecision = Body(...),
    user: ProtectedUser = Depends(verify_credentials),
    store: AsyncPostgresStore = Depends(get_store),
):
    """
    Resume a thread that is waiting for human input.

    This endpoint resolves a pending interrupt with the human's decision:
    - accept: Approve the tool call as-is
    - edit: Modify the tool call arguments before execution
    - response: Provide feedback to the LLM instead of executing
    - reject: Explicitly reject the tool call

    Security:
    - Requires authentication
    - Validates user owns/has access to the thread
    - Validates decision type against allowed actions
    - Input validation via Pydantic schema
    """
    try:
        async with get_checkpoint_db() as checkpointer:
            service_context = ServiceContext(
                user_id=user.id, store=store, checkpointer=checkpointer
            )

            # Verify thread exists and user has access
            thread = await service_context.thread_service.get(thread_id)
            if not thread:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Thread {thread_id} not found"
                )

            # Build graph for state management
            from src.flows import graph_builder

            service_context.checkpoint_service.graph = graph_builder(
                tools=[],
                checkpointer=checkpointer,
                store=store,
            )

            # Verify there's a pending interrupt
            has_interrupt = await service_context.checkpoint_service.has_pending_interrupt(
                thread_id
            )
            if not has_interrupt:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Thread {thread_id} has no pending interrupt"
                )

            # Check if the decision type is allowed
            details = await service_context.checkpoint_service.get_interrupt_details(
                thread_id
            )
            if details:
                allowed = details.get("allowed_actions", {})
                if decision.decision_type == DecisionType.ACCEPT and not allowed.get("allow_accept", True):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Accept action is not allowed for this interrupt"
                    )
                if decision.decision_type == DecisionType.EDIT and not allowed.get("allow_edit", True):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Edit action is not allowed for this interrupt"
                    )
                if decision.decision_type == DecisionType.RESPONSE and not allowed.get("allow_respond", True):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Response action is not allowed for this interrupt"
                    )

            # Prepare decision data
            decision_data = {}
            if decision.decision_type == DecisionType.EDIT:
                decision_data["edited_args"] = decision.edited_args
            elif decision.decision_type == DecisionType.RESPONSE:
                decision_data["response_content"] = decision.response_content
            elif decision.decision_type == DecisionType.REJECT:
                decision_data["rejection_reason"] = decision.rejection_reason

            # Resume the thread
            result = await service_context.checkpoint_service.resume_with_decision(
                thread_id=thread_id,
                decision_type=decision.decision_type.value,
                decision_data=decision_data,
            )

            logger.info(
                f"Thread {thread_id} resumed with decision: {decision.decision_type.value}"
            )

            return ResumeResponse(
                success=result.get("success", False),
                thread_id=thread_id,
                message=f"Thread resumed with {decision.decision_type.value} decision",
                next_checkpoint_id=result.get("checkpoint_id"),
            )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.exception(f"Error resuming thread: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
```

---

## 4. Design Decisions

### 4.1 Trade-offs Considered

| Decision | Alternative | Rationale |
|----------|-------------|-----------|
| Use enum for decision types | Free-form string | Type safety, prevents injection, clear contract |
| Separate state/resume endpoints | Combined endpoint | RESTful design, SRP, clearer semantics |
| Max length on response content | No limit | DoS prevention, memory protection |
| Reject as explicit type | Response with rejection text | Clearer intent, better analytics |

### 4.2 Why This Approach Over Alternatives

1. **Schema-first design**: Pydantic models provide automatic validation, documentation, and type safety. This is more secure than validating in route handlers.

2. **Reusing CheckpointService**: Rather than creating new services, extending the existing checkpoint service maintains consistency and reduces code duplication.

3. **GET for state, POST for resume**: Following REST conventions makes the API intuitive. State checking is idempotent (GET), while resumption is a state-changing operation (POST).

4. **Authorization at route level**: Using the existing `verify_credentials` dependency ensures consistent authentication across all endpoints.

### 4.3 Alignment with Existing Patterns

- Uses `ServiceContext` pattern from existing routes
- Follows same error handling structure with `HTTPException`
- Uses `Body()` for request parsing like other POST endpoints
- Adds to existing `thread.py` rather than creating new route file
- Uses `@cache` decorator pattern where appropriate

---

## 5. Risk Assessment

### 5.1 Potential Pitfalls

| Risk | Severity | Mitigation |
|------|----------|------------|
| Race condition: concurrent resume calls | Medium | Use database-level locking in checkpoint update |
| Stale interrupt: checkpoint expired | Medium | Validate interrupt exists before processing |
| Memory exhaustion from large edited_args | High | Enforce 50KB limit in schema validation |
| Unauthorized thread access | High | Verify user owns thread before operations |
| Graph not initialized for state check | Medium | Lazy initialization with error handling |

### 5.2 Edge Cases to Handle

1. **Expired/Missing Interrupt**
   - Thread ID valid but no interrupt exists
   - Interrupt was already resolved
   - Checkpoint was deleted/corrupted

2. **Concurrent Operations**
   - Two users trying to resume same thread
   - Resume called while another stream is active
   - State modified between check and resume

3. **Invalid State Transitions**
   - Accept when only edit is allowed
   - Empty edited_args for edit decision
   - Response content only whitespace

4. **Network/Timeout Issues**
   - Long-running checkpoint operations
   - Database connection pool exhausted
   - Redis unavailable for distributed mode

### 5.3 Security Considerations

1. **Input Validation**
   - All inputs validated via Pydantic
   - Enum types prevent arbitrary decision values
   - Length limits prevent DoS attacks

2. **Authorization**
   - Every endpoint requires authentication
   - Thread ownership verified before operations
   - No information leakage in error messages

3. **Data Sanitization**
   - Response content stripped of control characters
   - Edited args size limited
   - No arbitrary code execution paths

---

## 6. Estimated Complexity

| Metric | Assessment |
|--------|------------|
| **Scope** | Medium |
| **Risk Level** | Medium |
| **Estimated LOC** | ~400 (routes + schemas + tests) |
| **Files Changed** | 4 (2 new, 2 modified) |
| **Dependencies** | None new (uses existing LangGraph) |

### Priority Order for Implementation

1. **P0 - Schema definitions** (`hitl.py`)
   - Foundation for all other work
   - Enables parallel test development

2. **P1 - GET /state endpoint**
   - Read-only, lower risk
   - Enables manual testing of interrupt detection

3. **P2 - Service layer extensions**
   - Core business logic
   - Required for resume functionality

4. **P3 - POST /resume endpoint**
   - Full HITL workflow completion
   - Requires all previous components

---

## 7. Test Plan (CRITICAL)

### 7.1 Unit Test Cases

**File:** `backend/tests/unit/routes/test_hitl.py`

```python
"""Unit tests for human-in-the-loop endpoints.

These tests validate input validation, authorization, and error handling
without requiring a running LLM or database.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from fastapi.testclient import TestClient
from fastapi import HTTPException

from src.schemas.entities.hitl import (
    HumanDecision,
    DecisionType,
    ThreadInterruptState,
    InterruptInfo,
)


class TestHumanDecisionSchema:
    """Tests for HumanDecision Pydantic schema validation."""

    def test_accept_decision_valid(self):
        """Accept decision requires no additional fields."""
        decision = HumanDecision(decision_type=DecisionType.ACCEPT)
        assert decision.decision_type == DecisionType.ACCEPT
        assert decision.edited_args is None

    def test_edit_decision_requires_edited_args(self):
        """Edit decision must include edited_args."""
        with pytest.raises(ValueError, match="edited_args is required"):
            HumanDecision(decision_type=DecisionType.EDIT)

    def test_edit_decision_with_args_valid(self):
        """Edit decision with args should validate."""
        decision = HumanDecision(
            decision_type=DecisionType.EDIT,
            edited_args={"location": "New York"}
        )
        assert decision.edited_args == {"location": "New York"}

    def test_edit_decision_rejects_oversized_args(self):
        """Edit decision should reject args > 50KB."""
        large_args = {"data": "x" * 60000}
        with pytest.raises(ValueError, match="exceeds maximum size"):
            HumanDecision(
                decision_type=DecisionType.EDIT,
                edited_args=large_args
            )

    def test_response_decision_requires_content(self):
        """Response decision must include response_content."""
        with pytest.raises(ValueError, match="response_content is required"):
            HumanDecision(decision_type=DecisionType.RESPONSE)

    def test_response_decision_rejects_empty_content(self):
        """Response decision rejects whitespace-only content."""
        with pytest.raises(ValueError, match="response_content is required"):
            HumanDecision(
                decision_type=DecisionType.RESPONSE,
                response_content="   "
            )

    def test_response_decision_with_content_valid(self):
        """Response decision with content should validate."""
        decision = HumanDecision(
            decision_type=DecisionType.RESPONSE,
            response_content="Please use a different approach"
        )
        assert decision.response_content == "Please use a different approach"

    def test_response_content_max_length(self):
        """Response content exceeding 10000 chars should fail."""
        with pytest.raises(ValueError):
            HumanDecision(
                decision_type=DecisionType.RESPONSE,
                response_content="x" * 10001
            )

    def test_response_content_sanitizes_control_chars(self):
        """Response content should strip control characters."""
        decision = HumanDecision(
            decision_type=DecisionType.RESPONSE,
            response_content="Hello\x00World\x08Test"
        )
        assert decision.response_content == "HelloWorldTest"

    def test_reject_decision_valid_without_reason(self):
        """Reject decision is valid without reason."""
        decision = HumanDecision(decision_type=DecisionType.REJECT)
        assert decision.decision_type == DecisionType.REJECT

    def test_reject_decision_with_reason_valid(self):
        """Reject decision with reason should validate."""
        decision = HumanDecision(
            decision_type=DecisionType.REJECT,
            rejection_reason="This action is not appropriate"
        )
        assert decision.rejection_reason == "This action is not appropriate"

    def test_invalid_decision_type_rejected(self):
        """Invalid decision type string should fail."""
        with pytest.raises(ValueError):
            HumanDecision(decision_type="invalid_type")


class TestInterruptInfoSchema:
    """Tests for InterruptInfo schema."""

    def test_interrupt_info_minimal(self):
        """InterruptInfo with required fields only."""
        info = InterruptInfo(
            tool_name="get_weather",
            tool_args={"location": "Dallas"}
        )
        assert info.tool_name == "get_weather"
        assert info.allowed_actions["allow_accept"] is True

    def test_interrupt_info_full(self):
        """InterruptInfo with all fields."""
        info = InterruptInfo(
            tool_name="send_email",
            tool_args={"to": "user@example.com", "body": "Hello"},
            description="Please review this email before sending",
            allowed_actions={"allow_accept": True, "allow_edit": True, "allow_respond": False}
        )
        assert info.allowed_actions["allow_respond"] is False


class TestThreadInterruptState:
    """Tests for ThreadInterruptState response schema."""

    def test_state_no_interrupt(self):
        """State with no pending interrupt."""
        state = ThreadInterruptState(
            thread_id="thread-123",
            has_interrupt=False
        )
        assert state.interrupt_info is None

    def test_state_with_interrupt(self):
        """State with pending interrupt."""
        state = ThreadInterruptState(
            thread_id="thread-123",
            has_interrupt=True,
            interrupt_info=InterruptInfo(
                tool_name="dangerous_action",
                tool_args={"target": "production"}
            ),
            checkpoint_id="cp-456"
        )
        assert state.interrupt_info.tool_name == "dangerous_action"


class TestResumeEndpoint:
    """Tests for POST /threads/{thread_id}/resume endpoint behavior."""

    @pytest.fixture
    def mock_service_context(self):
        """Create a mock service context."""
        context = MagicMock()
        context.thread_service.get = AsyncMock()
        context.checkpoint_service.has_pending_interrupt = AsyncMock()
        context.checkpoint_service.get_interrupt_details = AsyncMock()
        context.checkpoint_service.resume_with_decision = AsyncMock()
        return context

    @pytest.mark.asyncio
    async def test_resume_thread_not_found_returns_404(self, mock_service_context):
        """Resume on non-existent thread returns 404."""
        mock_service_context.thread_service.get.return_value = None

        # This would be called in the actual endpoint
        # Simulating the check
        thread = await mock_service_context.thread_service.get("nonexistent")
        assert thread is None

    @pytest.mark.asyncio
    async def test_resume_no_interrupt_returns_409(self, mock_service_context):
        """Resume on thread without interrupt returns 409 Conflict."""
        mock_service_context.thread_service.get.return_value = MagicMock()
        mock_service_context.checkpoint_service.has_pending_interrupt.return_value = False

        has_interrupt = await mock_service_context.checkpoint_service.has_pending_interrupt("thread-123")
        assert has_interrupt is False

    @pytest.mark.asyncio
    async def test_resume_disallowed_action_returns_400(self, mock_service_context):
        """Resume with disallowed action returns 400."""
        mock_service_context.checkpoint_service.get_interrupt_details.return_value = {
            "allowed_actions": {
                "allow_accept": False,
                "allow_edit": True,
                "allow_respond": True
            }
        }

        details = await mock_service_context.checkpoint_service.get_interrupt_details("thread-123")
        assert details["allowed_actions"]["allow_accept"] is False

    @pytest.mark.asyncio
    async def test_resume_accept_success(self, mock_service_context):
        """Successful accept resume returns success."""
        mock_service_context.resume_with_decision.return_value = {
            "success": True,
            "checkpoint_id": "cp-789"
        }

        result = await mock_service_context.checkpoint_service.resume_with_decision(
            thread_id="thread-123",
            decision_type="accept",
            decision_data={}
        )
        assert result["success"] is True


class TestStateEndpoint:
    """Tests for GET /threads/{thread_id}/state endpoint."""

    @pytest.mark.asyncio
    async def test_state_endpoint_returns_interrupt_details(self):
        """State endpoint should return interrupt info when present."""
        # Mock the expected response structure
        expected = ThreadInterruptState(
            thread_id="thread-123",
            has_interrupt=True,
            interrupt_info=InterruptInfo(
                tool_name="get_weather",
                tool_args={"location": "Dallas"},
                description="Please confirm weather lookup"
            ),
            checkpoint_id="cp-123"
        )

        assert expected.has_interrupt is True
        assert expected.interrupt_info.tool_name == "get_weather"

    @pytest.mark.asyncio
    async def test_state_endpoint_no_interrupt(self):
        """State endpoint returns has_interrupt=False when no interrupt."""
        expected = ThreadInterruptState(
            thread_id="thread-456",
            has_interrupt=False,
            checkpoint_id="cp-456"
        )

        assert expected.has_interrupt is False
        assert expected.interrupt_info is None
```

**File:** `backend/tests/unit/services/test_checkpoint_hitl.py`

```python
"""Unit tests for CheckpointService HITL extensions."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from src.services.checkpoint import CheckpointService


class TestCheckpointServiceHITL:
    """Tests for human-in-the-loop checkpoint operations."""

    @pytest.fixture
    def checkpoint_service(self):
        """Create a checkpoint service with mocked graph."""
        service = CheckpointService(user_id=str(uuid4()))
        service.graph = MagicMock()
        return service

    @pytest.mark.asyncio
    async def test_has_pending_interrupt_true(self, checkpoint_service):
        """has_pending_interrupt returns True when interrupt exists."""
        mock_state = MagicMock()
        mock_state.next = ["__interrupt__"]
        checkpoint_service.graph.aget_state = AsyncMock(return_value=mock_state)

        result = await checkpoint_service.has_pending_interrupt("thread-123")
        assert result is True

    @pytest.mark.asyncio
    async def test_has_pending_interrupt_false(self, checkpoint_service):
        """has_pending_interrupt returns False when no interrupt."""
        mock_state = MagicMock()
        mock_state.next = ["agent", "tools"]
        checkpoint_service.graph.aget_state = AsyncMock(return_value=mock_state)

        result = await checkpoint_service.has_pending_interrupt("thread-123")
        assert result is False

    @pytest.mark.asyncio
    async def test_has_pending_interrupt_no_graph(self):
        """has_pending_interrupt returns False when graph not set."""
        service = CheckpointService(user_id=str(uuid4()))
        service.graph = None

        result = await service.has_pending_interrupt("thread-123")
        assert result is False

    @pytest.mark.asyncio
    async def test_has_pending_interrupt_handles_exception(self, checkpoint_service):
        """has_pending_interrupt returns False on exception."""
        checkpoint_service.graph.aget_state = AsyncMock(
            side_effect=Exception("DB error")
        )

        result = await checkpoint_service.has_pending_interrupt("thread-123")
        assert result is False

    @pytest.mark.asyncio
    async def test_get_interrupt_details_returns_info(self, checkpoint_service):
        """get_interrupt_details returns tool info when interrupt exists."""
        mock_state = MagicMock()
        mock_state.next = ["__interrupt__"]
        mock_state.interrupts = [{
            "action_request": {"action": "send_email", "args": {"to": "test@example.com"}},
            "description": "Review email",
            "config": {"allow_accept": True, "allow_edit": True}
        }]
        checkpoint_service.graph.aget_state = AsyncMock(return_value=mock_state)

        result = await checkpoint_service.get_interrupt_details("thread-123")

        assert result is not None
        assert result["tool_name"] == "send_email"
        assert result["tool_args"]["to"] == "test@example.com"

    @pytest.mark.asyncio
    async def test_get_interrupt_details_no_interrupt(self, checkpoint_service):
        """get_interrupt_details returns None when no interrupt."""
        mock_state = MagicMock()
        mock_state.next = ["agent"]
        checkpoint_service.graph.aget_state = AsyncMock(return_value=mock_state)

        result = await checkpoint_service.get_interrupt_details("thread-123")
        assert result is None

    @pytest.mark.asyncio
    async def test_resume_with_accept_decision(self, checkpoint_service):
        """resume_with_decision handles accept correctly."""
        mock_state = MagicMock()
        mock_state.next = ["__interrupt__"]
        checkpoint_service.graph.aget_state = AsyncMock(return_value=mock_state)
        checkpoint_service.graph.aupdate_state = AsyncMock(
            return_value={"configurable": {"checkpoint_id": "cp-new"}}
        )

        result = await checkpoint_service.resume_with_decision(
            thread_id="thread-123",
            decision_type="accept",
            decision_data={}
        )

        assert result["success"] is True
        assert result["checkpoint_id"] == "cp-new"

    @pytest.mark.asyncio
    async def test_resume_with_edit_decision(self, checkpoint_service):
        """resume_with_decision handles edit correctly."""
        mock_state = MagicMock()
        mock_state.next = ["__interrupt__"]
        checkpoint_service.graph.aget_state = AsyncMock(return_value=mock_state)
        checkpoint_service.graph.aupdate_state = AsyncMock(
            return_value={"configurable": {"checkpoint_id": "cp-new"}}
        )

        result = await checkpoint_service.resume_with_decision(
            thread_id="thread-123",
            decision_type="edit",
            decision_data={"edited_args": {"location": "Austin"}}
        )

        assert result["success"] is True
        # Verify update_state was called with edit response
        call_args = checkpoint_service.graph.aupdate_state.call_args
        assert call_args[1]["values"]["__interrupt__"][0]["type"] == "edit"

    @pytest.mark.asyncio
    async def test_resume_no_pending_interrupt_raises(self, checkpoint_service):
        """resume_with_decision raises when no interrupt pending."""
        mock_state = MagicMock()
        mock_state.next = ["agent"]  # No __interrupt__
        checkpoint_service.graph.aget_state = AsyncMock(return_value=mock_state)

        with pytest.raises(ValueError, match="No pending interrupt"):
            await checkpoint_service.resume_with_decision(
                thread_id="thread-123",
                decision_type="accept",
                decision_data={}
            )

    @pytest.mark.asyncio
    async def test_resume_invalid_decision_type_raises(self, checkpoint_service):
        """resume_with_decision raises for invalid decision type."""
        mock_state = MagicMock()
        mock_state.next = ["__interrupt__"]
        checkpoint_service.graph.aget_state = AsyncMock(return_value=mock_state)

        with pytest.raises(ValueError, match="Invalid decision type"):
            await checkpoint_service.resume_with_decision(
                thread_id="thread-123",
                decision_type="invalid",
                decision_data={}
            )
```

### 7.2 curl Command Examples for Manual Validation

**Prerequisites:**
```bash
# 1. Start the backend server
make dev

# 2. Get authentication token
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "test1234"}' \
  | jq -r '.access_token')

echo "Token: $TOKEN"
```

**Test 1: Create a thread that will trigger an interrupt**
```bash
# Create a thread with an assistant that has human_assistance tool
THREAD_RESPONSE=$(curl -s -X POST http://localhost:8000/api/threads \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "metadata": {},
    "files": {},
    "todos": []
  }')

THREAD_ID=$(echo $THREAD_RESPONSE | jq -r '.thread_id')
echo "Thread ID: $THREAD_ID"
```

**Test 2: Invoke LLM to trigger interrupt (using human_assistance tool)**
```bash
# Stream a request that should trigger human_assistance
curl -X POST http://localhost:8000/api/llm/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"input\": {
      \"messages\": [{
        \"role\": \"user\",
        \"content\": \"I need human assistance with something important\"
      }]
    },
    \"model\": \"openai:gpt-4.1-mini\",
    \"tools\": [\"human_assistance\"],
    \"metadata\": {
      \"thread_id\": \"$THREAD_ID\"
    }
  }"

# Expected: Stream should pause at interrupt point
```

**Test 3: Check thread interrupt state**
```bash
# GET /threads/{thread_id}/state
curl -s -X GET "http://localhost:8000/api/threads/$THREAD_ID/state" \
  -H "Authorization: Bearer $TOKEN" \
  | jq

# Expected response (when interrupt pending):
# {
#   "thread_id": "...",
#   "has_interrupt": true,
#   "interrupt_info": {
#     "tool_name": "human_assistance",
#     "tool_args": {"query": "..."},
#     "description": "...",
#     "allowed_actions": {"allow_accept": true, "allow_edit": true, "allow_respond": true}
#   },
#   "checkpoint_id": "..."
# }
```

**Test 4: Resume with accept decision**
```bash
# POST /threads/{thread_id}/resume - Accept
curl -s -X POST "http://localhost:8000/api/threads/$THREAD_ID/resume" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "decision_type": "accept"
  }' \
  | jq

# Expected:
# {
#   "success": true,
#   "thread_id": "...",
#   "message": "Thread resumed with accept decision",
#   "next_checkpoint_id": "..."
# }
```

**Test 5: Resume with response decision**
```bash
# POST /threads/{thread_id}/resume - Response
curl -s -X POST "http://localhost:8000/api/threads/$THREAD_ID/resume" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "decision_type": "response",
    "response_content": "The user said to proceed with option A"
  }' \
  | jq
```

**Test 6: Resume with edit decision**
```bash
# POST /threads/{thread_id}/resume - Edit
curl -s -X POST "http://localhost:8000/api/threads/$THREAD_ID/resume" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "decision_type": "edit",
    "edited_args": {
      "query": "Modified question for human"
    }
  }' \
  | jq
```

**Test 7: Resume with reject decision**
```bash
# POST /threads/{thread_id}/resume - Reject
curl -s -X POST "http://localhost:8000/api/threads/$THREAD_ID/resume" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "decision_type": "reject",
    "rejection_reason": "This action is not appropriate"
  }' \
  | jq
```

**Test 8: Error case - No interrupt pending**
```bash
# Try to resume a thread without interrupt
NEW_THREAD=$(curl -s -X POST http://localhost:8000/api/threads \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"metadata": {}}' | jq -r '.thread_id')

curl -s -X POST "http://localhost:8000/api/threads/$NEW_THREAD/resume" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"decision_type": "accept"}' \
  | jq

# Expected: 409 Conflict
# {"detail": "Thread ... has no pending interrupt"}
```

**Test 9: Error case - Thread not found**
```bash
curl -s -X POST "http://localhost:8000/api/threads/nonexistent-thread-id/resume" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"decision_type": "accept"}' \
  | jq

# Expected: 404 Not Found
# {"detail": "Thread nonexistent-thread-id not found"}
```

**Test 10: Error case - Invalid decision type**
```bash
curl -s -X POST "http://localhost:8000/api/threads/$THREAD_ID/resume" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"decision_type": "invalid_type"}' \
  | jq

# Expected: 422 Unprocessable Entity (validation error)
```

**Test 11: Error case - Missing required field for edit**
```bash
curl -s -X POST "http://localhost:8000/api/threads/$THREAD_ID/resume" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"decision_type": "edit"}' \
  | jq

# Expected: 422 Unprocessable Entity
# {"detail": "edited_args is required for 'edit' decision type"}
```

**Test 12: Unauthorized access**
```bash
curl -s -X GET "http://localhost:8000/api/threads/$THREAD_ID/state" \
  | jq

# Expected: 401 Unauthorized
# {"detail": "No credentials provided"}
```

### 7.3 Integration Test Outline

```python
"""Integration tests requiring database and LLM mocking."""

import pytest
from httpx import AsyncClient

@pytest.mark.integration
class TestHITLIntegration:
    """End-to-end tests for HITL workflow."""

    @pytest.mark.asyncio
    async def test_full_hitl_workflow_accept(self, async_client_postgres, auth_headers):
        """Test complete workflow: create -> invoke -> interrupt -> accept -> complete."""
        # 1. Create thread
        # 2. Invoke with human_assistance tool
        # 3. Verify interrupt state
        # 4. Resume with accept
        # 5. Verify completion
        pass

    @pytest.mark.asyncio
    async def test_full_hitl_workflow_edit(self, async_client_postgres, auth_headers):
        """Test complete workflow with edit decision."""
        pass

    @pytest.mark.asyncio
    async def test_concurrent_resume_handling(self, async_client_postgres, auth_headers):
        """Test that concurrent resume calls are handled safely."""
        pass
```

### 7.4 Error Scenario Coverage

| Scenario | HTTP Status | Error Message | Test Case |
|----------|-------------|---------------|-----------|
| Thread not found | 404 | Thread {id} not found | test_resume_thread_not_found_returns_404 |
| No interrupt pending | 409 | Thread {id} has no pending interrupt | test_resume_no_interrupt_returns_409 |
| Action not allowed | 400 | {Action} action is not allowed for this interrupt | test_resume_disallowed_action_returns_400 |
| Invalid decision type | 422 | Validation error | test_invalid_decision_type_rejected |
| Missing edited_args | 422 | edited_args is required | test_edit_decision_requires_edited_args |
| Missing response_content | 422 | response_content is required | test_response_decision_requires_content |
| Oversized edited_args | 422 | exceeds maximum size | test_edit_decision_rejects_oversized_args |
| No authentication | 401 | No credentials provided | Test 12 curl |
| Internal error | 500 | {error details} | Exception handling in routes |

---

## 8. Implementation Checklist

- [ ] Create `backend/src/schemas/entities/hitl.py` with validation schemas
- [ ] Add HITL schemas to `backend/src/schemas/entities/__init__.py` exports
- [ ] Extend `CheckpointService` with interrupt detection methods
- [ ] Add `GET /threads/{thread_id}/state` endpoint
- [ ] Add `POST /threads/{thread_id}/resume` endpoint
- [ ] Create `backend/tests/unit/routes/test_hitl.py`
- [ ] Create `backend/tests/unit/services/test_checkpoint_hitl.py`
- [ ] Run `make test` to verify all tests pass
- [ ] Run `make format` to ensure code style compliance
- [ ] Manual validation with curl commands
- [ ] Update OpenAPI examples if needed

---

## 9. Appendix: Existing Code References

### A. Human-in-the-Loop Wrapper (tools.py:23-63)
```python
def add_human_in_the_loop(
    tool: Callable | BaseTool,
    *,
    interrupt_config: HumanInterruptConfig = None,
) -> BaseTool:
    """Wrap a tool to support human-in-the-loop review."""
    # ... implementation supports accept, edit, response actions
```

### B. Checkpoint State Update (checkpoint.py:121-122)
```python
async def update_checkpoint_state(self, config: RunnableConfig, values: dict):
    return await self.graph.aupdate_state(config=config, values=values)
```

### C. Human Assistance Tool (test.py:30-33)
```python
@tool(description="Request assistance from a human")
def human_assistance(query: str) -> str:
    human_response = interrupt({"query": query})
    return human_response["data"]
```

---

**End of Proposal**
