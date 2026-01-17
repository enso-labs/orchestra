# PRD: Human-in-the-Loop API Routes

## Introduction

Implement API endpoints to enable human-in-the-loop (HITL) workflows in Orchestra's deepagent system. This feature allows humans to approve, edit, or reject security-sensitive tool calls (API requests, file writes, external operations) before execution. The system pauses agent execution at designated interrupt points, surfaces pending decisions via API, and resumes execution based on human decisions.

## Goals

- Enable human oversight for security-sensitive agent operations
- Provide clear API endpoints to query pending interrupts and submit decisions
- Support multiple decision types: accept, edit, respond, reject
- Integrate with LangGraph's checkpoint and interrupt system
- Maintain synchronous resume behavior (execute immediately on decision)

## User Stories

### US-001: Create HITL Pydantic Schemas
**Description:** As a developer, I need well-defined schemas for HITL data structures so the API has type-safe request/response handling.

**Acceptance Criteria:**
- [ ] `DecisionType` enum with values: ACCEPT, EDIT, RESPONSE, REJECT
- [ ] `HumanDecision` model validates decision_type and conditionally required fields:
  - `edited_args` required when decision_type is EDIT
  - `response_content` required when decision_type is RESPONSE
- [ ] `InterruptInfo` model captures: tool_name, tool_args, description, config (allowed_actions)
- [ ] `InterruptListResponse` model with: thread_id, has_interrupts, interrupts list
- [ ] `ResumeRequest` model accepts list of decisions (though only one interrupt pending at a time)
- [ ] `ResumeResponse` model returns: success, thread_id, message, checkpoint_id
- [ ] All schemas exported from `backend/src/schemas/entities/__init__.py`
- [ ] Typecheck passes

### US-002: Implement Interrupt Detection in CheckpointService
**Description:** As a developer, I need a service method to detect and retrieve interrupt data from a thread's checkpoint state.

**Acceptance Criteria:**
- [ ] `CheckpointService.get_interrupts(thread_id)` method implemented
- [ ] Returns interrupt data extracted from LangGraph StateSnapshot
- [ ] Returns empty list when no graph/checkpoint exists (graceful handling)
- [ ] Extracts tool_name, tool_args, description from interrupt metadata
- [ ] Typecheck passes

### US-003: Implement Resume with Decision in CheckpointService
**Description:** As a developer, I need a service method to resume execution with a human decision using LangGraph's Command system.

**Acceptance Criteria:**
- [ ] `CheckpointService.resume_with_decision(thread_id, decisions)` method implemented
- [ ] Uses `Command(resume=...)` pattern from LangGraph
- [ ] Executes resumed action synchronously and returns result
- [ ] Raises `ValueError` when no interrupt is pending
- [ ] Handles missing graph gracefully with appropriate error
- [ ] Typecheck passes

### US-004: Create GET Interrupts Endpoint
**Description:** As an API consumer, I want to query pending interrupts for a thread so I can display approval UI or automate decisions.

**Acceptance Criteria:**
- [ ] `GET /threads/{thread_id}/interrupts` endpoint in thread.py
- [ ] Returns `InterruptListResponse` with interrupt details
- [ ] Requires authentication via `verify_credentials`
- [ ] Returns 404 when thread not found
- [ ] Returns `has_interrupts: false` with empty list when no pending interrupt
- [ ] Tagged with "HITL" in OpenAPI docs
- [ ] Typecheck passes

### US-005: Create POST Resume Endpoint
**Description:** As an API consumer, I want to submit a decision to resume a paused thread so the agent can continue execution.

**Acceptance Criteria:**
- [ ] `POST /threads/{thread_id}/resume` endpoint in thread.py
- [ ] Accepts `ResumeRequest` body with decisions list
- [ ] Returns `ResumeResponse` with success status and checkpoint_id
- [ ] Requires authentication via `verify_credentials`
- [ ] Validates decision_type against interrupt's allowed_actions config
- [ ] Returns 400 when decision_type not in allowed_actions
- [ ] Returns 409 when no interrupt pending
- [ ] Returns 404 when thread not found
- [ ] Tagged with "HITL" in OpenAPI docs
- [ ] Typecheck passes

### US-006: Unit Tests for HITL Schemas
**Description:** As a developer, I need comprehensive schema tests to ensure validation logic works correctly.

**Acceptance Criteria:**
- [ ] Test file: `backend/tests/unit/schemas/test_hitl_schemas.py`
- [ ] Tests all DecisionType enum values
- [ ] Tests HumanDecision validation for each decision type
- [ ] Tests HumanDecision rejects invalid combinations (e.g., EDIT without edited_args)
- [ ] Tests InterruptInfo, InterruptListResponse, ResumeRequest, ResumeResponse serialization
- [ ] All tests pass with `make test`

### US-007: Unit Tests for CheckpointService HITL Methods
**Description:** As a developer, I need service tests to verify correct interrupt detection and resume behavior.

**Acceptance Criteria:**
- [ ] Test file: `backend/tests/unit/services/test_checkpoint_hitl.py`
- [ ] Mock graph state and checkpoint data
- [ ] Test get_interrupts returns correct data when interrupt exists
- [ ] Test get_interrupts returns empty when no interrupt
- [ ] Test resume_with_decision with ACCEPT decision
- [ ] Test resume_with_decision with EDIT decision modifies args
- [ ] Test resume_with_decision raises error when no interrupt pending
- [ ] All tests pass with `make test`

### US-008: Unit Tests for HITL Route Endpoints
**Description:** As a developer, I need route tests to verify HTTP status codes and response formats.

**Acceptance Criteria:**
- [ ] Test file: `backend/tests/unit/routes/test_thread_hitl.py`
- [ ] Test GET /interrupts returns 200 with interrupt data
- [ ] Test GET /interrupts returns 200 with has_interrupts=false when none pending
- [ ] Test GET /interrupts returns 401 without auth
- [ ] Test GET /interrupts returns 404 for unknown thread
- [ ] Test POST /resume returns 200 on successful resume
- [ ] Test POST /resume returns 400 for invalid decision_type
- [ ] Test POST /resume returns 401 without auth
- [ ] Test POST /resume returns 409 when no interrupt pending
- [ ] All tests pass with `make test`

## Functional Requirements

- **FR-1:** System must define `DecisionType` enum with ACCEPT, EDIT, RESPONSE, REJECT values
- **FR-2:** `HumanDecision` must validate that `edited_args` is provided when decision_type is EDIT
- **FR-3:** `HumanDecision` must validate that `response_content` is provided when decision_type is RESPONSE
- **FR-4:** `GET /threads/{thread_id}/interrupts` must return interrupt metadata including tool_name, tool_args, description
- **FR-5:** `GET /threads/{thread_id}/interrupts` must return `has_interrupts: true/false` boolean for easy checking
- **FR-6:** `POST /threads/{thread_id}/resume` must validate decision_type against the interrupt's allowed_actions
- **FR-7:** `POST /threads/{thread_id}/resume` must execute the resumed action synchronously before returning
- **FR-8:** Both endpoints must require valid authentication via `verify_credentials` dependency
- **FR-9:** Resume endpoint must return 409 Conflict when no interrupt is pending on the thread
- **FR-10:** Service methods must handle missing graph/checkpoint gracefully without crashing

## Non-Goals

- Frontend UI for interrupt approval (out of scope)
- WebSocket push notifications for new interrupts
- Multiple simultaneous pending interrupts per thread
- Async/background resume processing
- Integration or E2E tests (unit tests only)
- Automatic timeout/expiry of pending interrupts

## Technical Considerations

- **LangGraph Integration:** Uses `StateSnapshot` to detect interrupts and `Command(resume=...)` to continue execution
- **Existing Patterns:** Follow existing route patterns in `thread.py` for consistency
- **Authentication:** Use existing `verify_credentials` dependency injection
- **OpenAPI Tags:** Add "HITL" tag for endpoint grouping in docs
- **Error Handling:** Use FastAPI's `HTTPException` with appropriate status codes

### Files to Create/Modify

| File | Action |
|------|--------|
| `backend/src/schemas/entities/hitl.py` | CREATE |
| `backend/src/schemas/entities/__init__.py` | MODIFY (add exports) |
| `backend/src/services/checkpoint.py` | MODIFY (add methods) |
| `backend/src/routes/v0/thread.py` | MODIFY (add endpoints) |
| `backend/tests/unit/schemas/test_hitl_schemas.py` | CREATE |
| `backend/tests/unit/services/test_checkpoint_hitl.py` | CREATE |
| `backend/tests/unit/routes/test_thread_hitl.py` | CREATE |

## Success Metrics

- All 8 user stories completed with passing acceptance criteria
- `make test` passes with all new unit tests
- `make format` shows no style violations
- Endpoints visible in OpenAPI docs at `/docs` under HITL tag
- Manual curl validation confirms expected request/response behavior

## Open Questions

- Should there be a timeout after which pending interrupts auto-reject?
- Should interrupt history be persisted for audit purposes?
- What happens if the client disconnects during synchronous resume execution?
