# Plan: Sprint Contracts — Negotiated Acceptance Criteria Between Agents

## Overview

Implement a contract negotiation protocol between generator and evaluator agents. Before each sprint (work chunk), the generator proposes a `SprintContract` containing features to build and testable criteria. The evaluator reviews and can counter-propose. Once agreed, the contract is persisted and used as the grading rubric. This mirrors Anthropic's harness pattern where Sprint 3 of their retro game maker had 27 testable criteria for the level editor alone.

Currently, Orchestra's subagent system supports delegation but has no pre-execution agreement on acceptance criteria. Sprint contracts bridge the gap between high-level product specs and testable implementation.

## User Stories

1. **As a generator agent**, I want to propose a sprint contract with specific features and test criteria before starting work, so that expectations are clear and measurable.

2. **As an evaluator agent**, I want to review proposed contracts and counter-propose changes to criteria or scope, so that I can ensure the contract is realistic and testable.

3. **As a user watching an agent thread**, I want to see the negotiated contract and per-criterion pass/fail results in the frontend, so I understand what the agents agreed to and how they performed.

4. **As an orchestration developer**, I want contracts persisted as structured markdown in the StateBackend, so both agents can read/write them as a communication channel.

5. **As a system operator**, I want the negotiation loop bounded by a configurable max-rounds limit, so agents cannot endlessly negotiate and block progress.

## Implementation Phases

### Phase 1: Schema and Data Model

**Goal:** Define the `SprintContract` and `TestCriterion` Pydantic schemas.

**Files:**
- `backend/src/schemas/entities/sprint_contract.py` (new)

**Acceptance Criteria:**
- [ ] `TestCriterion` model with `description: str` and `verification_method: str`
- [ ] `SprintContract` model with `sprint_number`, `title`, `features`, `test_criteria`, `status` (Literal enum), `generator_notes`, `evaluator_notes`, `negotiation_rounds`
- [ ] Status supports: `proposed`, `negotiating`, `agreed`, `in_progress`, `completed`, `failed`
- [ ] Schema exports registered in `backend/src/schemas/entities/__init__.py`
- [ ] Unit tests for schema validation and status transitions

### Phase 2: Contract Negotiation Flow

**Goal:** Add contract negotiation orchestration to the LLM controller for the Full Harness template.

**Files:**
- `backend/src/controllers/llm.py` (modify)

**Acceptance Criteria:**
- [ ] Generator proposes contract before each feature chunk when using Full Harness template
- [ ] Contract is passed to evaluator for review
- [ ] Evaluator can approve, request changes (with specific feedback), or reject scope
- [ ] If changes requested, generator revises (max N rounds, configurable, default 3)
- [ ] Once agreed, contract status transitions to `agreed` and is persisted
- [ ] Negotiation terminates gracefully if max rounds exceeded (falls back to last proposal)

### Phase 3: File-Based Communication via StateBackend

**Goal:** Persist contracts as structured markdown files so both agents can read/write them.

**Files:**
- `backend/src/controllers/llm.py` (modify)
- Potentially a utility module for contract serialization

**Acceptance Criteria:**
- [ ] Contracts stored at `/contracts/sprint-{N}.md` in StateBackend
- [ ] Evaluation results stored at `/contracts/sprint-{N}-evaluation.md`
- [ ] Both generator and evaluator can load/save contracts via StateBackend
- [ ] Markdown format is human-readable and machine-parseable

### Phase 4: Contract-Aware Evaluation

**Goal:** Modify evaluator orchestration to grade against agreed contract criteria individually.

**Files:**
- `backend/src/controllers/llm.py` (modify)

**Acceptance Criteria:**
- [ ] Evaluator loads the agreed sprint contract for the current sprint
- [ ] Each `TestCriterion` is graded individually (pass/fail + notes)
- [ ] Contract compliance is included in overall evaluation score
- [ ] Results reported in "17/27 criteria passed" style
- [ ] Evaluation results persisted back to StateBackend

### Phase 5: Frontend — Contract Panel and Criteria Checklist

**Goal:** Display contracts, negotiation history, and per-criterion results in the chat UI.

**Files:**
- `frontend/src/components/panels/ContractPanel.tsx` (new)
- `frontend/src/components/lists/CriteriaChecklist.tsx` (new)

**Acceptance Criteria:**
- [ ] Contract panel shows current sprint's agreed criteria
- [ ] Checklist view displays each criterion with pass/fail indicator after evaluation
- [ ] Negotiation history visible (collapsed by default)
- [ ] Sprint progress indicator across the full thread
- [ ] Responsive layout consistent with existing Orchestra UI patterns

### Phase 6: Tests

**Goal:** Comprehensive unit and integration test coverage.

**Files:**
- `backend/tests/unit/test_sprint_contract.py` (new)
- `backend/tests/integration/test_sprint_contract_flow.py` (new)

**Acceptance Criteria:**
- [ ] Unit test: contract schema validation, field constraints
- [ ] Unit test: status transitions are valid (e.g., cannot go from `proposed` to `completed`)
- [ ] Unit test: negotiation terminates after max rounds
- [ ] Integration test: generator proposes, evaluator counter-proposes, agreement reached
- [ ] Integration test: evaluator grades against specific contract criteria
- [ ] All tests pass in CI

## Dependencies and Risks

### Dependencies
- **Evaluator Agent** (`evaluator-agent.md` spec): Sprint contracts require an evaluator agent to review proposals and grade results. This is a hard dependency for Phases 2-4.
- **Planner Agent** (`planner-agent.md` spec): Best used with a planner agent that generates high-level specs which contracts break down into sprints. This is a soft dependency (contracts can work without it).
- **StateBackend**: File-based communication requires a working StateBackend implementation. This already exists in Orchestra.
- **Full Harness Template**: Contract negotiation integrates into the Full Harness orchestration template.

### Risks
- **Negotiation loops**: Agents could produce low-quality counter-proposals that waste rounds without convergence. Mitigated by max-rounds limit and fallback to last proposal.
- **Schema evolution**: Contract schema may need to evolve as we learn what criteria agents produce. Keep schema flexible with optional fields.
- **LLM reliability**: Agents may not reliably produce well-structured contracts. May need structured output enforcement or retry logic.
- **Evaluator dependency**: If the evaluator-agent spec is not yet implemented, Phases 2-4 cannot be fully realized. Phase 1 (schema) and Phase 5 (frontend) can proceed independently.

## Testing Strategy

- **Unit tests** validate schema construction, serialization, and status transition rules in isolation.
- **Integration tests** use mocked LLM responses to simulate the full negotiation flow: proposal, counter-proposal, agreement, and grading.
- **Frontend tests** (Vitest + Testing Library) verify the ContractPanel and CriteriaChecklist render correctly for various contract states.
- Run via `make test` (backend) and `npm run test` (frontend).
