# Plan: Evaluator Agent — GAN-Inspired Generator/Evaluator Feedback Loop

## Overview

Implement a first-class evaluator subsystem for Orchestra that separates generation from evaluation, inspired by Anthropic's harness design research. The core insight: agents are reliably bad at self-evaluation, so a dedicated evaluator running in a separate context window with a skeptical posture produces dramatically better quality control than self-assessment.

This feature adds `EvaluatorConfig` to the Assistant schema, structured grading criteria with named dimensions/weights/thresholds, and a generate-evaluate-critique-regenerate orchestration loop in `LLMController`. The evaluator can optionally use Playwright MCP to interact with live UIs before scoring.

## User Stories

1. **As an agent builder**, I want to attach an evaluator to my assistant so that every generated response is independently graded before being shown to users — ensuring consistent output quality without manual review.

2. **As a platform operator**, I want to define weighted scoring criteria (e.g., accuracy: 0.4, completeness: 0.3, clarity: 0.3) with per-criterion pass/fail thresholds so that quality gates are objective and auditable.

3. **As a developer using Orchestra for code generation**, I want the evaluator to automatically retry generation when output fails quality checks, feeding the evaluator's critique back into the generator — reducing the need for manual iteration.

4. **As a user viewing chat threads**, I want to see evaluation scores, pass/fail indicators, and iteration badges on messages so I understand the quality assurance that was applied and how many rounds of refinement occurred.

5. **As a team lead**, I want configurable max iteration counts and fail actions (retry/flag/stop) so I can balance quality against cost and latency for different use cases.

## Implementation Phases

### Phase 1: Schema & Data Layer
**Goal:** Define the data structures and persist evaluator config on assistants.

**Tasks:**
- Create `backend/src/schemas/entities/evaluation.py` with `EvaluationCriterion`, `EvaluatorConfig`, and `EvaluationResult` Pydantic models
- Extend `Assistant` schema in `backend/src/schemas/entities/llm.py` with optional `evaluator: EvaluatorConfig | None` field
- Create Alembic migration to add `evaluator_config` JSONB column to the assistants table
- Add `evaluation_results` JSONB column to the threads/messages table for persisting scores

**Acceptance Criteria:**
- [ ] `EvaluationCriterion` validates name, description, weight (>0), threshold (0-1)
- [ ] `EvaluatorConfig` validates assistant_id reference, criteria list non-empty, max_iterations >= 1
- [ ] `EvaluationResult` captures per-criterion scores, overall pass/fail, critique text, iteration number
- [ ] Migration runs cleanly up and down
- [ ] Existing assistants unaffected (field is optional/nullable)

### Phase 2: Orchestration Loop
**Goal:** Implement the generate-evaluate-critique-regenerate loop in LLMController.

**Tasks:**
- Modify `backend/src/controllers/llm.py` to check for evaluator config after generation
- Invoke evaluator assistant in a separate context window with generator output + criteria
- Parse structured `EvaluationResult` from evaluator response
- If any criterion below threshold and iteration < max: feed critique back to generator, loop
- If passed or max iterations reached: finalize and stream to user
- Persist all evaluation results as metadata on the thread message

**Acceptance Criteria:**
- [ ] Generator output is evaluated against all configured criteria
- [ ] Evaluator runs in isolated context (no access to generator's conversation history)
- [ ] Failed evaluations trigger re-generation with critique injected as feedback
- [ ] Loop terminates when all criteria pass OR max iterations reached
- [ ] Evaluation metadata persisted on final message
- [ ] Streaming works correctly during evaluation iterations

### Phase 3: Default Evaluator Prompt
**Goal:** Ship a battle-tested default system prompt for the evaluator role.

**Tasks:**
- Create `backend/src/static/prompts/md/evaluator.md` with skeptical-posture instructions
- Include structured output format matching `EvaluationResult` schema
- Add scoring calibration guidance (what 1/5 vs 5/5 looks like per common criteria)
- Include instructions for Playwright MCP usage when available
- Wire as default system prompt when evaluator assistant has no custom prompt

**Acceptance Criteria:**
- [ ] Default prompt produces valid `EvaluationResult` JSON consistently
- [ ] Skeptical posture reduces evaluator leniency vs. naive prompting
- [ ] Prompt includes few-shot calibration examples
- [ ] Playwright integration instructions are conditional (only when MCP configured)

### Phase 4: Frontend Display
**Goal:** Surface evaluation results in the chat thread UI.

**Tasks:**
- Create `frontend/src/components/chat/EvaluationBadge.tsx` component
- Display per-criterion scores with pass/fail color coding (green/red)
- Show iteration count badge on messages that went through multiple rounds
- Add expandable critique section for detailed evaluator feedback
- Handle edge cases: evaluation in progress, max iterations reached without pass

**Acceptance Criteria:**
- [ ] Scores display with clear pass (green) / fail (red) indicators
- [ ] Iteration badge shows number of generate/evaluate rounds
- [ ] Critique text is expandable/collapsible
- [ ] Component handles missing/partial evaluation data gracefully
- [ ] No visual regression on messages without evaluation

### Phase 5: Testing & Documentation
**Goal:** Comprehensive test coverage and usage examples.

**Tasks:**
- Unit tests: `EvaluationCriterion` validation, threshold logic, weight normalization
- Unit tests: evaluator loop terminates at max iterations, handles evaluator errors
- Integration tests: end-to-end evaluator rejects below-threshold output, generator retries
- Integration tests: evaluator with Playwright MCP navigates a page before scoring
- Create `examples/agents/evaluator_example.ipynb` demonstrating generator + evaluator setup

**Acceptance Criteria:**
- [ ] Unit tests cover all schema validation edge cases
- [ ] Integration test proves the feedback loop improves output across iterations
- [ ] Loop termination tested for both pass and max-iteration scenarios
- [ ] Example notebook is executable and well-documented

## Dependencies

- **Existing Assistant schema and LLMController** — Phase 1-2 modify these directly
- **Playwright MCP** — Optional dependency for UI testing evaluators; the feature works without it
- **Streaming infrastructure** — Phase 2 must integrate with existing SSE/streaming pipeline
- **Thread metadata storage** — Phase 1 needs JSONB column support (already used elsewhere in the codebase)

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Evaluator leniency (LLMs are naturally generous graders) | Low quality gates | Strong skepticism prompting + few-shot calibration examples in default prompt |
| Cost multiplication (each iteration doubles token spend) | Unexpected bills | Configurable max iterations, default of 3, `fail_action: "flag"` option to skip retry |
| Evaluator/generator model mismatch | Unreliable scores | Document recommendation to use same-tier or higher model for evaluator |
| Streaming complexity during evaluation loops | Broken UX | Buffer intermediate iterations; only stream final accepted output to user |
| Infinite loop edge case | Stuck threads | Hard max_iterations cap, timeout fallback, `fail_action: "stop"` option |

## Testing Strategy

- **Unit tests** (`backend/tests/unit/`): Schema validation, threshold math, loop control logic (mock LLM calls)
- **Integration tests** (`backend/tests/integration/`): Full orchestration loop with real LLM calls against test assistants
- **Frontend tests** (`frontend/src/tests/`): EvaluationBadge rendering with various data states (pass/fail/partial/missing)
- **Manual testing**: Create a generator + evaluator pair in the UI, run a conversation, verify scores display correctly
