# Implementation Tasks: Human-in-the-Loop API Routes

**Feature:** GitHub Issue #336 - Configure human-in-the-loop in deepagents
**Branch:** `feat/336-human-in-the-loop`
**Date:** 2026-01-17

---

## Pre-Implementation

- [ ] Verify development environment setup
  - Files: N/A
  - Acceptance: `make dev` starts server successfully

- [ ] Create feature branch from `development`
  - Command: `git checkout -b feat/336-human-in-the-loop development`
  - Acceptance: On new branch

- [ ] Review REVIEW.md council decisions
  - Files: `.claude/specs/feat-336-human-in-the-loop/REVIEW.md`
  - Acceptance: Understand unified schema design

---

## Core Implementation

### Phase 1: Schema Definitions

- [ ] Create `backend/src/schemas/entities/hitl.py` with HITL schemas
  - Files: `backend/src/schemas/entities/hitl.py`
  - Contents:
    - `DecisionType` enum (ACCEPT, EDIT, RESPONSE, REJECT)
    - `HumanDecision` model with validation
    - `InterruptInfo` model
    - `InterruptListResponse` model
    - `ResumeRequest` model
    - `ResumeResponse` model
  - Acceptance: File exists with all schemas, imports work

- [ ] Export schemas from `backend/src/schemas/entities/__init__.py`
  - Files: `backend/src/schemas/entities/__init__.py`
  - Contents: Add imports for all HITL schemas
  - Acceptance: `from src.schemas.entities import HumanDecision` works

### Phase 2: Service Layer

- [ ] Add `get_interrupts()` method to `CheckpointService`
  - Files: `backend/src/services/checkpoint.py`
  - Contents:
    ```python
    async def get_interrupts(self, thread_id: str) -> dict:
        # Returns {has_interrupts, interrupts[], checkpoint_id, next[]}
    ```
  - Acceptance: Method returns correct structure with mocked graph

- [ ] Add `resume_with_decision()` method to `CheckpointService`
  - Files: `backend/src/services/checkpoint.py`
  - Contents:
    ```python
    async def resume_with_decision(self, thread_id: str, decisions: list) -> dict:
        # Uses Command(resume=...) to resume graph
    ```
  - Acceptance: Method invokes graph.ainvoke with Command

### Phase 3: API Routes

- [ ] Add GET `/threads/{thread_id}/interrupts` endpoint
  - Files: `backend/src/routes/v0/thread.py`
  - Contents:
    - Import HITL schemas
    - Add endpoint with `verify_credentials` dependency
    - Build graph, call `get_interrupts()`, return `InterruptListResponse`
  - Acceptance: Endpoint appears in OpenAPI docs at `/docs`

- [ ] Add POST `/threads/{thread_id}/resume` endpoint
  - Files: `backend/src/routes/v0/thread.py`
  - Contents:
    - Accept `ResumeRequest` body
    - Verify thread exists
    - Check for pending interrupts
    - Validate decision types against allowed actions
    - Call `resume_with_decision()`
    - Return `ResumeResponse`
  - Acceptance: Endpoint appears in OpenAPI docs at `/docs`

---

## Testing

### Phase 4: Unit Tests - Schemas

- [ ] Create schema unit tests file
  - Files: `backend/tests/unit/schemas/test_hitl_schemas.py`
  - Acceptance: File exists and is importable

- [ ] Test `HumanDecision` accept type validation
  - Acceptance: Accept decision validates without additional fields

- [ ] Test `HumanDecision` edit type requires edited_args
  - Acceptance: Edit without args raises ValidationError

- [ ] Test `HumanDecision` edit type rejects oversized args
  - Acceptance: Args > 50KB raises ValidationError

- [ ] Test `HumanDecision` response type requires content
  - Acceptance: Response without content raises ValidationError

- [ ] Test `HumanDecision` response type max length
  - Acceptance: Content > 10000 chars raises ValidationError

- [ ] Test `HumanDecision` reject type validation
  - Acceptance: Reject validates with optional reason

- [ ] Test `InterruptListResponse` with and without interrupts
  - Acceptance: Both empty and populated lists serialize correctly

- [ ] Test `ResumeRequest` with multiple decisions
  - Acceptance: List of decisions validates correctly

### Phase 5: Unit Tests - Services

- [ ] Create service unit tests file
  - Files: `backend/tests/unit/services/test_checkpoint_hitl.py`
  - Acceptance: File exists and is importable

- [ ] Test `get_interrupts()` returns empty when no interrupts
  - Acceptance: Returns `{has_interrupts: False, interrupts: []}`

- [ ] Test `get_interrupts()` returns info when interrupts pending
  - Acceptance: Returns interrupt details with tool_name, tool_args

- [ ] Test `get_interrupts()` handles missing graph gracefully
  - Acceptance: Returns empty response, no exception

- [ ] Test `resume_with_decision()` with accept
  - Acceptance: Calls graph.ainvoke with `Command(resume=[{type: accept}])`

- [ ] Test `resume_with_decision()` with edit
  - Acceptance: Passes edited_args correctly

- [ ] Test `resume_with_decision()` raises when no interrupt
  - Acceptance: Raises ValueError with clear message

### Phase 6: Unit Tests - Routes

- [ ] Create route unit tests file
  - Files: `backend/tests/unit/routes/test_thread_hitl.py`
  - Acceptance: File exists and is importable

- [ ] Test GET `/interrupts` returns 200 with no interrupts
  - Acceptance: Returns `{has_interrupts: False}`

- [ ] Test GET `/interrupts` returns 200 with interrupt info
  - Acceptance: Returns interrupt details

- [ ] Test POST `/resume` returns 400 when no interrupt pending
  - Acceptance: Returns error message about no pending interrupt

- [ ] Test POST `/resume` returns 404 for non-existent thread
  - Acceptance: Returns 404 with clear message

- [ ] Test POST `/resume` validates decision against allowed actions
  - Acceptance: Returns 400 if action not allowed

- [ ] Run all unit tests
  - Command: `make test`
  - Acceptance: All tests pass

---

## Manual Validation

### Phase 7: curl Validation

- [ ] Start dev server
  - Command: `make dev`
  - Acceptance: Server running on port 8000

- [ ] Get authentication token
  ```bash
  TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "admin@example.com", "password": "test1234"}' \
    | jq -r '.access_token')
  ```
  - Acceptance: Token retrieved successfully

- [ ] Create a new thread
  ```bash
  THREAD_RESPONSE=$(curl -s -X POST http://localhost:8000/api/threads \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"metadata": {}}')
  THREAD_ID=$(echo $THREAD_RESPONSE | jq -r '.thread_id')
  ```
  - Acceptance: Thread ID returned

- [ ] Invoke LLM with human_assistance tool to trigger interrupt
  ```bash
  curl -X POST http://localhost:8000/api/llm/stream \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"input\": {\"messages\": [{\"role\": \"user\", \"content\": \"I need human assistance\"}]},
      \"tools\": [\"human_assistance\"],
      \"metadata\": {\"thread_id\": \"$THREAD_ID\"}
    }"
  ```
  - Acceptance: Stream pauses at interrupt point

- [ ] Check for pending interrupts
  ```bash
  curl -s -X GET "http://localhost:8000/api/threads/$THREAD_ID/interrupts" \
    -H "Authorization: Bearer $TOKEN" | jq
  ```
  - Acceptance: Returns `{has_interrupts: true, interrupts: [...]}`

- [ ] Resume with accept decision
  ```bash
  curl -s -X POST "http://localhost:8000/api/threads/$THREAD_ID/resume" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"decisions": [{"decision_type": "accept"}]}' | jq
  ```
  - Acceptance: Returns `{success: true, ...}`

- [ ] Verify interrupts cleared after resume
  ```bash
  curl -s -X GET "http://localhost:8000/api/threads/$THREAD_ID/interrupts" \
    -H "Authorization: Bearer $TOKEN" | jq
  ```
  - Acceptance: Returns `{has_interrupts: false, interrupts: []}`

- [ ] Test error case: resume without interrupt
  ```bash
  NEW_THREAD=$(curl -s -X POST http://localhost:8000/api/threads \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"metadata": {}}' | jq -r '.thread_id')
  curl -s -X POST "http://localhost:8000/api/threads/$NEW_THREAD/resume" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"decisions": [{"decision_type": "accept"}]}' | jq
  ```
  - Acceptance: Returns 400/409 with error message

- [ ] Test error case: unauthorized access
  ```bash
  curl -s -X GET "http://localhost:8000/api/threads/$THREAD_ID/interrupts" | jq
  ```
  - Acceptance: Returns 401 Unauthorized

---

## Documentation & Cleanup

- [ ] Run code formatter
  - Command: `make format`
  - Acceptance: No formatting changes needed

- [ ] Verify OpenAPI documentation updated
  - URL: `http://localhost:8000/docs`
  - Acceptance: New endpoints appear with correct schemas

---

## Verification

- [ ] All unit tests passing
  - Command: `make test`
  - Acceptance: All tests pass, no failures

- [ ] curl workflow completes successfully
  - Acceptance: All curl commands return expected responses

- [ ] Self-review against REVIEW.md
  - Acceptance: Implementation matches council decisions

- [ ] Ready for PR
  - Acceptance: All tasks checked, code formatted

---

## Completion Signature

- **Total Tasks:** 42
- **Dependencies:** None (uses existing LangGraph infrastructure)
- **Files to Create:** 4
  - `backend/src/schemas/entities/hitl.py`
  - `backend/tests/unit/schemas/test_hitl_schemas.py`
  - `backend/tests/unit/services/test_checkpoint_hitl.py`
  - `backend/tests/unit/routes/test_thread_hitl.py`
- **Files to Modify:** 3
  - `backend/src/schemas/entities/__init__.py`
  - `backend/src/services/checkpoint.py`
  - `backend/src/routes/v0/thread.py`

---

## Progress Log

_To be filled as tasks are completed_

