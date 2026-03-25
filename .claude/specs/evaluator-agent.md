# Plan: Evaluator Agent — GAN-Inspired Generator/Evaluator Feedback Loop

## Context

Anthropic's [harness design research](https://www.anthropic.com/engineering/harness-design-long-running-apps) (March 2026) demonstrates that separating generation from evaluation is the single highest-leverage harness design choice. Agents are reliably bad at self-evaluation — they confidently praise their own mediocre work. A standalone evaluator tuned for skepticism is far more tractable to calibrate than making a generator critical of its own output.

Orchestra currently has zero evaluator infrastructure. The deep agent judges its own work, which is the exact failure mode the research identifies.

## Requirements

- First-class `EvaluatorConfig` on the Assistant schema
- Grading criteria with named dimensions, weights, and pass/fail thresholds
- Generate → evaluate → (if fail) critique feedback → regenerate loop
- Evaluator runs in a separate context window from the generator
- Evaluator system prompt defaults to skeptical posture
- Playwright MCP integration so evaluators can interact with live UIs before scoring
- Configurable max iteration count to prevent infinite loops

## Implementation Steps

### Step 1: Schema definitions

Add to `backend/src/schemas/entities/`:

```python
# evaluation.py
class EvaluationCriterion(BaseModel):
    name: str                    # e.g. "design_quality", "functionality"
    description: str             # What good/bad looks like
    weight: float = 1.0          # Relative importance
    threshold: float = 0.6       # Minimum passing score (0-1)

class EvaluatorConfig(BaseModel):
    assistant_id: str            # The evaluator assistant
    criteria: list[EvaluationCriterion]
    max_iterations: int = 3
    fail_action: Literal["retry", "flag", "stop"] = "retry"

class EvaluationResult(BaseModel):
    scores: dict[str, float]     # criterion_name -> score
    passed: bool
    critique: str                # Detailed feedback for generator
    iteration: int
```

### Step 2: Extend Assistant schema

In `backend/src/schemas/entities/llm.py`, add optional `evaluator: EvaluatorConfig` field to the `Assistant` model.

### Step 3: Orchestration loop in LLMController

Modify `backend/src/controllers/llm.py`:

1. After generator produces output, check if assistant has evaluator configured
2. If yes, invoke evaluator assistant with generator output + criteria
3. Parse `EvaluationResult` from evaluator response
4. If any criterion below threshold and iteration < max: feed critique back to generator as a new user message, loop
5. If passed or max iterations reached: finalize and stream to user
6. Persist all evaluation results as metadata on the thread

### Step 4: Default evaluator system prompt

Create `backend/src/static/prompts/md/evaluator.md` with:

- Instructions to be skeptical and look for problems
- Structured output format matching `EvaluationResult`
- Guidance on scoring calibration (what 1/5 vs 5/5 looks like)
- Instruction to test interactively via Playwright when available

### Step 5: Frontend display

- Show evaluator scores and critique in thread message view
- Visual pass/fail indicator per criterion
- Iteration count badge on messages that were re-generated after evaluator feedback

### Step 6: Alembic migration

Migration for any new database columns needed to persist evaluator config on assistants and evaluation results on threads.

### Step 7: Tests

- Unit test: `EvaluationCriterion` validation, threshold logic
- Unit test: evaluator loop terminates at max iterations
- Integration test: evaluator rejects output below threshold, generator retries and improves
- Integration test: evaluator with Playwright MCP configured navigates a page

### Step 8: Example assistant

Create `examples/agents/evaluator_example.ipynb` demonstrating:

- Setting up a generator + evaluator pair
- Defining design quality criteria
- Running the feedback loop
- Inspecting evaluation results

## File Changes

- `backend/src/schemas/entities/evaluation.py` — new
- `backend/src/schemas/entities/llm.py` — add evaluator field
- `backend/src/controllers/llm.py` — orchestration loop
- `backend/src/static/prompts/md/evaluator.md` — new
- `backend/migrations/versions/xxx_add_evaluator.py` — new
- `frontend/src/components/chat/EvaluationBadge.tsx` — new
- `examples/agents/evaluator_example.ipynb` — new
- Tests in `backend/tests/unit/agents/` and `backend/tests/integration/`

## Risks

- Evaluator leniency: LLMs are naturally generous. Mitigation: strong skepticism prompting + few-shot calibration examples in the default prompt.
- Cost multiplication: each evaluation iteration doubles token spend. Mitigation: configurable max iterations, budget cap integration (see cost tracking plan).
- Evaluator/generator model mismatch: if evaluator uses a weaker model than generator, scores may be unreliable. Mitigation: recommend same-tier or higher model for evaluator in documentation.

## GitHub Issue

**Title:** `feat: Evaluator Agent — GAN-inspired generator/evaluator feedback loop`
**Labels:** `enhancement`, `agents`, `high-impact`, `harness-design`
**Milestone:** v0.9.0 — Harness Design
