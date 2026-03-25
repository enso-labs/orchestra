# Plan: Sprint Contracts — Negotiated Acceptance Criteria Between Agents

## Context

Anthropic's harness uses sprint contracts where the generator and evaluator negotiate what "done" looks like before code is written. Sprint 3 of their retro game maker had 27 testable criteria for the level editor alone, and the evaluator graded against those specific criteria. This bridges the gap between high-level product specs and testable implementation.

Orchestra's subagent system supports delegation but has no contract negotiation protocol. Subagents execute instructions without pre-agreeing on acceptance criteria.

## Requirements

- `SprintContract` schema with features, test criteria, and status
- Generator proposes contract before each work chunk
- Evaluator reviews and can counter-propose
- Negotiation loop with configurable max rounds
- Agreed contracts persisted and used for grading
- Frontend displays contracts with status

## Implementation Steps

### Step 1: Schema

```python
# sprint_contract.py
class TestCriterion(BaseModel):
    description: str              # What to test
    verification_method: str      # How to verify (manual, Playwright, API call, etc.)

class SprintContract(BaseModel):
    sprint_number: int
    title: str
    features: list[str]           # What will be built
    test_criteria: list[TestCriterion]
    status: Literal["proposed", "negotiating", "agreed", "in_progress", "completed", "failed"]
    generator_notes: Optional[str] = None
    evaluator_notes: Optional[str] = None
    negotiation_rounds: int = 0
```

### Step 2: Contract negotiation flow

Add to orchestration in `backend/src/controllers/llm.py`:

1. When using Full Harness template, generator proposes contract before each feature chunk
2. Contract is passed to evaluator for review
3. Evaluator can: approve, request changes (with specific feedback), or reject scope
4. If changes requested, generator revises (max 3 rounds)
5. Once agreed, contract is persisted to `/contracts/sprint-{N}.md`
6. Generator builds against the contract
7. Evaluator grades against the contract's specific `test_criteria`

### Step 3: Contract-aware evaluation

Modify evaluator orchestration to:

- Load the agreed sprint contract for the current sprint
- Grade each `TestCriterion` individually (pass/fail + notes)
- Include contract compliance in overall evaluation score
- Report: "17/27 criteria passed" style results

### Step 4: File-based communication

Contracts stored as structured markdown in StateBackend:

```
/contracts/sprint-1.md
/contracts/sprint-2.md
/contracts/sprint-1-evaluation.md
```

Both generator and evaluator read/write these files as their communication channel.

### Step 5: Frontend

- Contract panel showing current sprint's agreed criteria
- Checklist view: each criterion with pass/fail indicator after evaluation
- Negotiation history (collapsed by default)
- Sprint progress indicator across the full thread

### Step 6: Tests

- Unit test: contract schema validation, status transitions
- Unit test: negotiation terminates after max rounds
- Integration test: generator proposes, evaluator counter-proposes, agreement reached
- Integration test: evaluator grades against specific contract criteria

## File Changes

- `backend/src/schemas/entities/sprint_contract.py` — new
- `backend/src/controllers/llm.py` — contract negotiation flow
- `frontend/src/components/panels/ContractPanel.tsx` — new
- `frontend/src/components/lists/CriteriaChecklist.tsx` — new

## Dependencies

- Requires evaluator agent (plan: `evaluator-agent.md`)
- Best used with planner agent (plan: `planner-agent.md`) to generate the high-level spec that contracts break down

## GitHub Issue

**Title:** `feat: Sprint contracts — agents negotiate scope and pass/fail criteria before execution`
**Labels:** `enhancement`, `agents`, `harness-design`
**Milestone:** v0.10.0 — Harness Design v2
