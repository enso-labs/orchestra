# Council Review: Human-in-the-Loop API Implementation

**Feature:** Configure human-in-the-loop in deepagents with initial phase focus on API routes
**Date:** 2026-01-17
**Council:** Elite Architects (ARCHITECT, CRAFTSMAN, GUARDIAN)

---

## 1. Proposal Comparison Matrix

| Aspect | ARCHITECT | CRAFTSMAN | GUARDIAN | Council Verdict |
|--------|-----------|-----------|----------|-----------------|
| **Endpoints** | GET `/threads/{id}/interrupts`, POST `/threads/{id}/resume` | GET `/threads/{id}/interrupt`, POST `/threads/{id}/resume` | GET `/threads/{id}/state`, POST `/threads/{id}/resume` | **GET `/threads/{id}/interrupts`** (plural, clearer) + POST `/threads/{id}/resume` |
| **Schema Location** | `schemas/entities/llm.py` | New `schemas/entities/interrupt.py` | New `schemas/entities/hitl.py` | **New `schemas/entities/hitl.py`** (separation of concerns) |
| **Decision Types** | accept, edit, response | accept, edit, response | accept, edit, response, reject | **accept, edit, response** (reject can be response with rejection text) |
| **Resume Response** | JSON `ResumeResponse` | SSE stream | JSON `ResumeResponse` | **JSON `ResumeResponse`** initially (simpler, validate first) |
| **Service Layer** | `CheckpointService.get_interrupts()` | Stream helper in `utils/stream.py` | `CheckpointService.has_pending_interrupt()`, `get_interrupt_details()`, `resume_with_decision()` | **CheckpointService methods** (cohesive) |
| **Test Focus** | Schema validation + mock graph | Schema + decision formatting | Comprehensive security + error cases | **Combine all** with focus on GUARDIAN's security tests |

---

## 2. Consensus Points

All proposals agree on:

1. **Leverage existing infrastructure** - Use existing `interrupt()`, `AsyncPostgresSaver`, `CheckpointService`
2. **Two new endpoints** - One for checking interrupt state, one for resuming
3. **Pydantic schemas** for request/response validation
4. **Thread-centric routing** - Endpoints under `/threads/{thread_id}/` (not new router)
5. **Unit tests first** - Validate schemas and service methods before curl testing
6. **Decision types** - At minimum: accept, edit, response
7. **No changes to existing `/llm/invoke` or `/llm/stream`** - Backward compatible

---

## 3. Divergence Analysis

### 3.1 Schema File Location

| Proposal | Location | Rationale |
|----------|----------|-----------|
| ARCHITECT | `schemas/entities/llm.py` | Co-locate with LLM-related types |
| CRAFTSMAN | `schemas/entities/interrupt.py` | Clean separation |
| GUARDIAN | `schemas/entities/hitl.py` | Domain-specific naming |

**Council Decision:** Use **`schemas/entities/hitl.py`**
- Follows GUARDIAN's security-first naming
- Clean separation from existing `llm.py` which is already large
- "hitl" is a well-understood abbreviation in the AI/LLM space

### 3.2 Endpoint Naming

| Proposal | GET endpoint |
|----------|--------------|
| ARCHITECT | `/threads/{id}/interrupts` |
| CRAFTSMAN | `/threads/{id}/interrupt` |
| GUARDIAN | `/threads/{id}/state` |

**Council Decision:** Use **`/threads/{id}/interrupts`** (ARCHITECT)
- Plural form aligns with REST conventions for collections
- "state" is too generic (threads have many state aspects)
- Returns list of interrupts (even if typically one), so plural is accurate

### 3.3 Resume Response Type

| Proposal | Response |
|----------|----------|
| ARCHITECT | JSON only |
| CRAFTSMAN | SSE streaming |
| GUARDIAN | JSON only |

**Council Decision:** **JSON only** for initial implementation
- Simpler validation with curl
- SSE can be added later as enhancement
- Matches the simplicity-first requirement from the task description

### 3.4 Reject Decision Type

| Proposal | Includes reject? |
|----------|------------------|
| ARCHITECT | No |
| CRAFTSMAN | No |
| GUARDIAN | Yes |

**Council Decision:** **Include reject** as explicit type
- GUARDIAN's security perspective is valuable here
- Clearer intent than response-with-rejection-text
- Better audit trail and analytics potential

---

## 4. Unified Implementation Plan

### 4.1 Recommended Architecture

```
backend/
  src/
    schemas/
      entities/
        hitl.py           # NEW: HumanDecision, InterruptInfo, InterruptListResponse, ResumeRequest, ResumeResponse
        __init__.py       # MODIFY: Export new schemas
    routes/
      v0/
        thread.py         # MODIFY: Add GET /interrupts and POST /resume endpoints
    services/
      checkpoint.py       # MODIFY: Add get_interrupts(), resume_with_decision()
  tests/
    unit/
      schemas/
        test_hitl_schemas.py  # NEW: Schema validation tests
      services/
        test_checkpoint_hitl.py  # NEW: Service method tests
      routes/
        test_thread_hitl.py   # NEW: Endpoint behavior tests
```

### 4.2 Implementation Sequence

1. **Schemas first** (`hitl.py`) - Foundation for everything
2. **Service methods** (`checkpoint.py`) - Core business logic
3. **Routes** (`thread.py`) - API endpoints
4. **Unit tests** - Validate each layer
5. **curl validation** - End-to-end workflow

### 4.3 Critical Path Items

1. Pydantic schemas with strict validation (GUARDIAN's security focus)
2. `CheckpointService.get_interrupts()` method
3. `CheckpointService.resume_with_decision()` method
4. GET `/threads/{thread_id}/interrupts` endpoint
5. POST `/threads/{thread_id}/resume` endpoint
6. Unit tests for all new code
7. curl validation script

### 4.4 Non-Negotiable Requirements

1. **Authentication required** on all endpoints (`verify_credentials`)
2. **Thread ownership verification** before operations
3. **Decision type validation** via Pydantic enum
4. **Input size limits** (10KB response content, 50KB edited_args)
5. **Unit tests** must pass before curl validation
6. **No changes** to existing `/llm/invoke` or `/llm/stream`

---

## 5. Risk Consolidation

### Combined Risk Matrix

| Risk | Source | Severity | Mitigation |
|------|--------|----------|------------|
| Graph state mismatch | ARCHITECT | High | Validate decision count matches interrupt count |
| Concurrent resume | CRAFTSMAN | Medium | LangGraph checkpoint versioning handles this |
| Memory exhaustion | GUARDIAN | High | 50KB limit on edited_args, 10KB on response |
| Stale interrupt | ARCHITECT | Low | Fresh state fetch on each request |
| Unauthorized access | GUARDIAN | High | Thread ownership verification |
| Invalid checkpoint | ALL | Medium | Return 404 with clear message |

### Edge Cases (Consolidated)

1. **No interrupts pending** - Return `has_interrupts: false`, not 404
2. **Thread doesn't exist** - Return 404
3. **Wrong decision count** - Return 400 with clear error
4. **Decision type not allowed** - Return 400 with specific error
5. **Expired/deleted checkpoint** - Return 404 or appropriate error
6. **Concurrent resume attempts** - LangGraph handles via checkpoint locking

---

## 6. Final Verdict

### Decision: **GO**

**Rationale:**
- All three proposals confirm the existing infrastructure supports this feature
- The implementation is small (~400 lines) and low risk
- Clear consensus on architecture with minor divergences resolved
- Security considerations adequately addressed (GUARDIAN)
- Testing strategy is comprehensive

### Confidence Level: **High**

**Why:**
- Existing `interrupt()`, `add_human_in_the_loop()`, and `CheckpointService` provide solid foundation
- `human_assistance` tool already demonstrates the pattern works
- Unit tests before integration ensures early problem detection
- curl commands provide quick manual validation

### Conditions for Success

1. All unit tests pass (`make test`)
2. curl workflow demonstrates complete interrupt-resume cycle
3. No regressions in existing thread/checkpoint functionality
4. Code formatted (`make format`)

---

## 7. Unified Schema Specification

Based on council synthesis, the final schemas should be:

```python
# backend/src/schemas/entities/hitl.py

from enum import Enum
from typing import Optional, Any, Dict, List
from pydantic import BaseModel, Field, field_validator, model_validator

class DecisionType(str, Enum):
    """Valid human decision types."""
    ACCEPT = "accept"
    EDIT = "edit"
    RESPONSE = "response"
    REJECT = "reject"

class HumanDecision(BaseModel):
    """Human decision on an interrupted tool call."""
    decision_type: DecisionType
    edited_args: Optional[Dict[str, Any]] = None  # Required for EDIT
    response_content: Optional[str] = Field(None, max_length=10000)  # Required for RESPONSE
    rejection_reason: Optional[str] = Field(None, max_length=500)  # Optional for REJECT

    @model_validator(mode="after")
    def validate_requirements(self):
        if self.decision_type == DecisionType.EDIT and not self.edited_args:
            raise ValueError("edited_args required for edit decision")
        if self.decision_type == DecisionType.RESPONSE and not self.response_content:
            raise ValueError("response_content required for response decision")
        return self

class InterruptInfo(BaseModel):
    """Details about a pending interrupt."""
    interrupt_id: str
    tool_name: str
    tool_args: Dict[str, Any] = Field(default_factory=dict)
    description: str = ""
    config: Dict[str, bool] = Field(default_factory=lambda: {
        "allow_accept": True, "allow_edit": True, "allow_respond": True
    })

class InterruptListResponse(BaseModel):
    """Response for GET /threads/{id}/interrupts."""
    thread_id: str
    has_interrupts: bool = False
    interrupts: List[InterruptInfo] = Field(default_factory=list)
    checkpoint_id: Optional[str] = None

class ResumeRequest(BaseModel):
    """Request body for POST /threads/{id}/resume."""
    decisions: List[HumanDecision]  # One per pending interrupt

class ResumeResponse(BaseModel):
    """Response for POST /threads/{id}/resume."""
    success: bool
    thread_id: str
    message: str
    checkpoint_id: Optional[str] = None
```

---

## 8. Recommended Implementation Timeline

| Phase | Deliverable | Verification |
|-------|-------------|--------------|
| 1 | `hitl.py` schemas | Unit tests pass |
| 2 | `CheckpointService` methods | Unit tests pass |
| 3 | GET `/interrupts` endpoint | Unit tests + curl |
| 4 | POST `/resume` endpoint | Unit tests + curl |
| 5 | Full workflow curl validation | Complete script runs successfully |

---

## 9. Council Signatures

- **ARCHITECT**: System design verified, integration points validated
- **CRAFTSMAN**: Clean code patterns confirmed, SOLID principles maintained
- **GUARDIAN**: Security requirements met, edge cases documented, tests comprehensive

**Review Status:** APPROVED FOR IMPLEMENTATION
