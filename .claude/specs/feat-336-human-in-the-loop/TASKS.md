# Implementation Tasks: Human-In-The-Loop (HITL) Feature

## Issue Reference
- **Main Issue**: [#336](https://github.com/ruska-ai/orchestra/issues/336) - Add Human in the Loop
- **First Use Case**: [#635](https://github.com/ruska-ai/orchestra/issues/635) - Initial HITL implementation

---

## Pre-Implementation

- [ ] Verify development environment setup
  - Files: N/A
  - Acceptance: `uv sync` succeeds, `npm install` succeeds in frontend

- [ ] Review REVIEW.md council decisions
  - Files: `.claude/specs/feat-336-human-in-the-loop/REVIEW.md`
  - Acceptance: Understand unified architecture and non-negotiable requirements

---

## Phase 1: Backend Foundation (Critical Priority)

### 1.1 Create Interrupt Schemas

- [ ] Create interrupt configuration and response schemas
  - Files: `backend/src/schemas/entities/interrupt.py` (NEW)
  - Acceptance: Pydantic models compile, pass type checking
  - Details:
    - `InterruptTrigger` enum: `TOOL_CALL`, `SUBAGENT_HANDOFF`, `HIGH_STAKES_ACTION`
    - `DecisionType` enum: `APPROVE`, `EDIT`, `REJECT`, `RESPOND`
    - `InterruptConfig` model with `triggers`, `tool_names`, `allow_*` flags, `timeout_seconds`
    - `InterruptRequest` model with `interrupt_id`, `action`, `edited_args`, `reason`
    - `InterruptResponse` model with interrupt metadata
    - `Interrupt` entity with full state tracking

### 1.2 Extend Assistant Schema

- [ ] Add HITL configuration to Assistant model
  - Files: `backend/src/schemas/entities/llm.py`
  - Acceptance: `hitl` field is optional, backward compatible, existing tests pass
  - Details:
    - Add `HITLConfig` model with `enabled`, `tools_requiring_approval`, `timeout_seconds`, `default_action`
    - Add `hitl: Optional[HITLConfig] = None` to `Assistant` schema

### 1.3 Create InterruptService

- [ ] Implement interrupt service with strategy handlers
  - Files: `backend/src/services/interrupt.py` (NEW)
  - Acceptance: Service initializes, handlers are registered
  - Details:
    - `InterruptHandler` abstract base class
    - `ApproveHandler`, `EditHandler`, `RejectHandler` implementations
    - `InterruptService` with `handle_decision()`, `validate_nonce()`, `validate_ownership()`
    - Nonce generation and validation logic
    - Thread ownership verification

### 1.4 Fix Argument Validation Vulnerability (CRITICAL)

- [ ] Add schema validation for edited args in `add_human_in_the_loop()`
  - Files: `backend/src/utils/tools.py`
  - Acceptance: Edited args are validated against `tool.args_schema`, invalid args rejected
  - Details:
    ```python
    # SECURE VERSION
    elif response["type"] == "edit":
        edited_args = response["args"]["args"]
        if tool.args_schema:
            try:
                validated_args = tool.args_schema(**edited_args).model_dump()
            except ValidationError as e:
                raise InterruptValidationError(f"Failed validation: {e.errors()}")
        tool_response = tool.invoke(validated_args, config)
    ```

---

## Phase 2: Streaming Integration (Critical Priority)

### 2.1 Add Interrupt Event Type

- [ ] Define interrupt SSE event structure
  - Files: `backend/src/schemas/entities/stream.py` (if exists) or `backend/src/utils/stream.py`
  - Acceptance: `InterruptEvent` type is defined
  - Details:
    - Event type: `"interrupt"`
    - Data: `interrupt_id`, `tool_name`, `tool_args`, `tool_description`, `reason`, `timeout_at`, `checkpoint_id`

### 2.2 Modify Stream Generator for Interrupt Detection

- [ ] Detect interrupts in `stream_generator()` and emit SSE events
  - Files: `backend/src/utils/stream.py`
  - Acceptance: When interrupt is detected, `interrupt` event is emitted
  - Details:
    - Check for `__interrupt__` in stream chunks
    - Emit `interrupt` SSE event with full metadata
    - Implement checkpoint-release pattern (OPTIMIZER requirement)

### 2.3 Implement Checkpoint-Release Pattern

- [ ] Release DB connection when interrupt is detected
  - Files: `backend/src/utils/stream.py`
  - Acceptance: DB connection is released during interrupt wait, new connection acquired on resume
  - Details:
    - Checkpoint state to Postgres before releasing
    - Store interrupt metadata in Redis (hot state, 15-min TTL)
    - Release DB connection before emitting SSE event

---

## Phase 3: Resume API (High Priority)

### 3.1 Create Resume Endpoint

- [ ] Implement `POST /threads/{thread_id}/resume` endpoint
  - Files: `backend/src/routes/v0/thread.py`
  - Acceptance: Endpoint accepts `InterruptDecision`, returns streaming response
  - Details:
    - Validate nonce (replay protection)
    - Validate thread ownership
    - Re-validate edited args against tool schema (GUARDIAN requirement)
    - Resume graph execution with decision
    - Return streaming response

### 3.2 Create Interrupts List Endpoint

- [ ] Implement `GET /threads/{thread_id}/interrupts` endpoint
  - Files: `backend/src/routes/v0/thread.py`
  - Acceptance: Returns list of pending interrupts for thread
  - Details:
    - Query Redis for hot interrupt state
    - Fallback to checkpoint metadata
    - Support reconnection scenarios

### 3.3 Add Redis Hot State Keys

- [ ] Implement Redis interrupt state management
  - Files: `backend/src/services/interrupt.py`
  - Acceptance: Interrupts stored in Redis with TTL
  - Details:
    - Key pattern: `interrupt:meta:{thread_id}`
    - TTL: 15 minutes
    - Store: `type`, `tool_name`, `args`, `created_at`, `expires_at`, `nonce`

---

## Phase 4: Frontend State Management (High Priority)

### 4.1 Create Interrupt TypeScript Interfaces

- [ ] Define interrupt types for frontend
  - Files: `frontend/src/lib/entities/interrupt.ts` (NEW)
  - Acceptance: Types compile, match backend schemas
  - Details:
    - `InterruptData` interface
    - `InterruptDecision` interface
    - `InterruptEvent` SSE event type

### 4.2 Create useInterrupt Hook

- [ ] Implement interrupt state management hook
  - Files: `frontend/src/hooks/useInterrupt.ts` (NEW)
  - Acceptance: Hook manages interrupt state, provides resolve function
  - Details:
    - `pendingInterrupt` state
    - `interruptHistory` state
    - `resolveInterrupt(decision)` function
    - Countdown timer logic

### 4.3 Extend ChatContext

- [ ] Add interrupt state to ChatContext
  - Files: `frontend/src/context/ChatContext.tsx`
  - Acceptance: Interrupt state accessible throughout app
  - Details:
    - Integrate `useInterrupt` hook
    - Expose `pendingInterrupt`, `resolveInterrupt` in context

### 4.4 Handle Interrupt Events in Stream Processor

- [ ] Process `interrupt` SSE events
  - Files: `frontend/src/hooks/useChat.ts` or `frontend/src/lib/entities/stream.ts`
  - Acceptance: Interrupt events trigger state updates
  - Details:
    - Detect `type: "interrupt"` in SSE stream
    - Call `setPendingInterrupt` with interrupt data
    - Update loading message

---

## Phase 5: Frontend UI (Medium Priority)

### 5.1 Create InterruptApprovalDialog Component

- [ ] Build approval modal component
  - Files: `frontend/src/components/modals/InterruptApprovalDialog.tsx` (NEW)
  - Acceptance: Dialog displays tool info, countdown, action buttons
  - Details:
    - Props: `interrupt`, `onApprove`, `onReject`, `onEdit`, `isOpen`, `onClose`
    - Display tool name, args (JSON or form view)
    - Countdown timer to timeout
    - Approve/Edit/Reject buttons

### 5.2 Implement Args Editor

- [ ] Add JSON/form editor for argument modification
  - Files: `frontend/src/components/modals/InterruptApprovalDialog.tsx`
  - Acceptance: Users can edit tool args before approval
  - Details:
    - JSON editor mode (Monaco or similar)
    - Optional form mode for simple args
    - Validation feedback

### 5.3 Create Interrupt Service

- [ ] Implement API client for resume endpoint
  - Files: `frontend/src/lib/services/interruptService.ts` (NEW)
  - Acceptance: Service can call resume endpoint
  - Details:
    - `resolveInterrupt(threadId, decision)` function
    - Error handling
    - Response streaming support

### 5.4 Integrate Dialog into Chat

- [ ] Wire InterruptApprovalDialog into chat interface
  - Files: `frontend/src/components/lists/ChatMessages.tsx` or equivalent
  - Acceptance: Dialog appears when interrupt is pending
  - Details:
    - Conditionally render dialog based on `pendingInterrupt`
    - Handle reconnection with `/interrupts` polling

---

## Phase 6: Agent Configuration UI (Medium Priority)

### 6.1 Add HITL Settings to Agent Forms

- [ ] Extend agent create/edit forms with HITL config
  - Files: `frontend/src/components/forms/agents/*.tsx`
  - Acceptance: Users can configure HITL per agent
  - Details:
    - Toggle for HITL enabled
    - Multi-select for tools requiring approval
    - Timeout configuration
    - Default action selection

---

## Testing

### Backend Unit Tests

- [ ] Test interrupt schemas
  - Files: `backend/tests/unit/schemas/test_interrupt.py` (NEW)
  - Acceptance: Schema validation tests pass

- [ ] Test InterruptService
  - Files: `backend/tests/unit/services/test_interrupt.py` (NEW)
  - Acceptance: Handler strategies tested, nonce validation tested

- [ ] Test argument validation fix
  - Files: `backend/tests/unit/utils/test_tools.py`
  - Acceptance: Invalid edited args are rejected

### Backend Integration Tests

- [ ] Test full HITL flow
  - Files: `backend/tests/integration/test_hitl_flow.py` (NEW)
  - Acceptance: Complete approve/edit/reject cycles work
  - Details:
    - `test_full_approval_flow()`
    - `test_edit_flow_with_validation()`
    - `test_reject_flow()`
    - `test_timeout_handling()`

### Frontend Tests

- [ ] Test useInterrupt hook
  - Files: `frontend/src/tests/hooks/useInterrupt.test.ts` (NEW)
  - Acceptance: Hook state management works correctly

- [ ] Test InterruptApprovalDialog
  - Files: `frontend/src/tests/components/InterruptApprovalDialog.test.tsx` (NEW)
  - Acceptance: Dialog renders, buttons trigger callbacks

---

## Documentation

- [ ] Add inline comments for complex interrupt logic
  - Files: All modified files
  - Acceptance: Complex logic has explanatory comments

- [ ] Update API documentation if auto-generated
  - Files: API docs
  - Acceptance: New endpoints documented

---

## Verification

- [ ] All backend tests passing
  - Command: `make test`
  - Acceptance: 0 failures

- [ ] All frontend tests passing
  - Command: `cd frontend && npm run test`
  - Acceptance: 0 failures

- [ ] Linting/formatting clean
  - Command: `make format`
  - Acceptance: No errors

- [ ] Self-review against REVIEW.md
  - Acceptance: All non-negotiable requirements met:
    - [ ] Re-validate edited args against tool.args_schema
    - [ ] Thread ownership verification
    - [ ] TTL-based expiration
    - [ ] Nonce-based replay protection
    - [ ] Release DB connection during wait
    - [ ] Redis hot state
    - [ ] SSE interrupt event
    - [ ] Frontend countdown timer

- [ ] Ready for PR
  - Acceptance: All checkboxes above complete

---

## Completion Signature

- **Total Tasks**: 32
- **Dependencies**:
  - `deepagents` package
  - `langgraph` for checkpointing
  - Redis for hot state (if not already configured)
- **Related Issues**: #336, #635

---

## Progress Log

_Tasks will be logged here as they are completed._

---

## Validation Results

_To be filled after implementation._
