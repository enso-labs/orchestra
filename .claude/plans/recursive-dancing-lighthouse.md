# Plan: Agent Marketplace with Fork/Remix + Self-Improving Memory Loop

## Context

Four parallel expert subagents (Product Strategist, Systems Architect, AI/ML Researcher, UX/Growth Expert) independently analyzed the Orchestra codebase to identify the single most impactful addition. Two converged on workflow DAGs, one proposed a self-improving memory distillation loop, and one proposed an agent marketplace with fork/remix + embeddable widgets.

**The synthesis:** The marketplace/fork proposal wins on leverage — the public agent infrastructure is 80% built but has no viral loop. Fork/remix creates a GitHub-for-agents growth flywheel. The memory distillation loop rides alongside nearly free (langmem is already installed and unused). Workflows are deferred until marketplace demand validates them.

**The problem:** Every public agent is a dead end. Users can chat with it but can't own it, customize it, or embed it on their site. There's no path from "I found a cool agent" to "I'm an Orchestra user." Meanwhile, conversation intelligence dies after each session — langmem is installed but disconnected from the conversation lifecycle.

**The outcome:** A self-reinforcing flywheel where published agents drive user acquisition (via fork/embed), forked agents accumulate usage data, and that data automatically improves agent prompts via background distillation.

---

## Phase 1: Agent Fork/Remix (Highest immediate ROI)

### Backend

**File: `backend/src/services/assistant.py`** — Add `fork()` method:
```python
async def fork(self, public_assistant_id: str, target_user_id: str) -> str:
    # Read from ("public", "assistants") namespace
    # Deep-copy assistant data, strip owner_id/published_at/public
    # Generate new UUID, set forked_from in metadata
    # Write to (target_user_id, "assistants") namespace
    # Increment fork_count on source in public namespace
```

**File: `backend/src/schemas/entities/llm.py`**:
- Add `fork_count: int = 0` to `Assistant` model
- Add `forked_from: Optional[str] = None` to `Assistant.metadata` convention
- Add `fork_count` to `PublicAssistant` projection

**File: `backend/src/routes/v0/assistant.py`** — Add fork endpoint:
```
POST /assistants/public/{assistant_id}/fork  (requires auth)
```
- Validates UUID, calls `AssistantService.fork()`, returns new `assistant_id`

### Frontend

**File: `frontend/src/lib/services/agentService.ts`**:
- Add `fork(assistantId: string): Promise<{assistant_id: string}>`

**File: `frontend/src/pages/agents/public.tsx`**:
- Add "Remix this Agent" button in `AgentSection` (before chat starts)
- If authenticated: call fork endpoint, redirect to `/assistants/{newId}` edit page
- If unauthenticated: redirect to `/login?remix={agentId}`, post-login auto-fork

**File: `frontend/src/pages/Login.tsx` / `Register.tsx`**:
- Read `remix` query param, after successful auth call fork endpoint + redirect

---

## Phase 2: Agent Discovery Experience

### Backend

**File: `backend/src/routes/v0/assistant.py`**:
- Enhance `GET /assistants/public` with `sort_by` param: `fork_count`, `updated_at`, `published_at`

**File: `backend/src/schemas/entities/llm.py`**:
- Add `tags: list[str] = []` to `Assistant` model
- Expose `tags` in `PublicAssistant` projection

### Frontend

**File: `frontend/src/pages/agents/index.tsx`**:
- Add "Discover" tab alongside existing tabs showing public agents
- Agent cards show: name, description, model, fork_count badge, "Remix" button
- Sort dropdown: "Most Remixed", "Newest", "Recently Updated"

---

## Phase 3: Embeddable Agent Widget

### Backend

**File: `backend/src/routes/v0/assistant.py`**:
- Add `GET /assistants/public/{assistant_id}/embed` — returns embed config JSON
- Add `POST /assistants/public/{assistant_id}/embed-token` (auth required, owner only) — returns signed JWT with agent_id + rate_limit + expiry

### Frontend

- New standalone Vite entry point: `frontend/src/embed/index.tsx`
- Minimal chat widget (<50KB bundle): floating button + expandable chat panel
- Loads via `<script src="https://chat.ruska.ai/embed.js" data-agent-id="...">`
- "Powered by Orchestra" footer linking to `/a/{agentId}`
- Communicates with backend via embed token (no user auth needed, rate-limited)

**File: `frontend/src/pages/agents/edit.tsx`**:
- Add "Embed" section for published agents with copy-paste code snippets

---

## Phase 4: Memory Distillation Loop (rides alongside Phase 2-3)

### Post-Conversation Trajectory Extraction

**File: `backend/src/utils/stream.py`** — Hook into `_persist_final_state()` (line 278):
- After persisting state, extract `AnnotatedTrajectory` from conversation messages
- Derive implicit quality signals: conversation length, tool success/failure rate, HITL rejections
- Store trajectory in `(user_id, "trajectories", assistant_id)` namespace via existing `AsyncPostgresStore`

**File: `backend/src/workers/tasks.py`** — Add `extract_trajectory` TaskIQ task:
- Runs async after conversation completion (non-blocking)
- Serializes messages into `AnnotatedTrajectory` format (the format `PromptOptimizer` already expects)

### Periodic Prompt Distillation

**File: `backend/src/services/prompt/optimize.py`** — Extend `PromptOptimizer`:
- Add `distill(user_id, assistant_id)` method:
  - Retrieves recent trajectories from store
  - Invokes existing `create_prompt_optimizer` with trajectories against assistant's current system_prompt
  - Stores optimized prompt as new revision via existing `PromptService.revision()`

**File: `backend/src/services/schedule.py`**:
- Add `scheduled_prompt_distillation` job type (daily, per-user, per-assistant)
- Uses existing APScheduler infrastructure

### Key Integration Points (existing code to reuse)

| What exists | Where | How to use |
|---|---|---|
| `PromptOptimizer.optimize()` | `backend/src/services/prompt/optimize.py:72` | Wire to auto-generated trajectories |
| `AnnotatedTrajectory` format | `langmem.prompts.types` (already imported) | Structure extracted conversation data |
| `PromptService` with revisions | `backend/src/services/prompt/__init__.py` | Store optimized prompts as new revisions |
| `_persist_final_state()` | `backend/src/utils/stream.py:278` | Hook point for trajectory extraction |
| `_update_store()` | `backend/src/controllers/llm.py:49` | Sync invoke hook point |
| APScheduler infra | `backend/src/services/schedule.py` | Schedule distillation jobs |
| TaskIQ broker | `backend/src/workers/tasks.py` | Run extraction as background task |
| `AsyncPostgresStore` namespaces | `backend/src/services/db.py` | Store trajectories without new DB tables |

---

## Phase 5: Workflow Engine (future — deferred until marketplace validates demand)

Not in scope for this implementation. Build only after fork/embed proves users want to chain agents.

---

## Verification Plan

### Phase 1 Testing
1. `make test` — all existing tests pass
2. New unit test: `tests/unit/services/test_assistant_service.py` — test `fork()` method
3. Manual curl validation:
   ```bash
   # Fork a public agent
   curl -X POST http://localhost:8000/api/assistants/public/{id}/fork \
     -H "Authorization: Bearer <token>"
   # Verify forked agent appears in user's assistants
   curl -X POST http://localhost:8000/api/assistants/search \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```
4. Frontend: navigate to `/a/{agentId}`, click "Remix", verify redirect to edit page with cloned config

### Phase 2 Testing
1. Verify `GET /assistants/public?sort_by=fork_count` returns ordered results
2. Frontend: verify "Discover" tab renders public agents with badges

### Phase 3 Testing
1. Generate embed token, load `embed.js` on a test HTML page
2. Verify chat widget renders and streams responses
3. Verify rate limiting works (429 after threshold)

### Phase 4 Testing
1. Complete a conversation, verify trajectory appears in `(user_id, "trajectories", assistant_id)` namespace
2. Trigger distillation manually, verify new prompt revision created
3. Run `make test` — all tests pass
