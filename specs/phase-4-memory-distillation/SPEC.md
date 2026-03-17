---
task: Memory Distillation Loop (Feature #885-P4)
test_command: "cd backend && make test"
---

# Task: Memory Distillation Loop (Phase 4 - Feature #885)

> **IMPORTANT**: Before implementing this feature, READ `/CLAUDE.md` first.

Wire up langmem's `PromptOptimizer` (already installed, unused) to automatically extract conversation trajectories and distill them into improved agent prompts. This creates a self-improving loop: agents get better with usage, without manual prompt tuning.

## Requirements

1. Hook into `_persist_final_state()` to extract `AnnotatedTrajectory` after each conversation
2. Create a TaskIQ background task for non-blocking trajectory extraction
3. Store trajectories in `AsyncPostgresStore` using `(user_id, "trajectories", assistant_id)` namespace
4. Extend `PromptOptimizer` with a `distill()` method that runs optimization against accumulated trajectories
5. Add scheduled distillation job using existing APScheduler infrastructure
6. Store optimized prompts as new revisions via `PromptService.revision()`

## Success Criteria

1. [ ] After conversation completion, a background task extracts trajectory from conversation messages
2. [ ] Trajectory includes implicit quality signals: conversation length, tool success/failure rate, HITL rejections
3. [ ] Trajectories stored in `(user_id, "trajectories", assistant_id)` namespace in `AsyncPostgresStore`
4. [ ] `PromptOptimizer.distill(user_id, assistant_id)` retrieves trajectories and runs optimization
5. [ ] Distillation produces a new prompt revision via `PromptService.revision()`
6. [ ] Scheduled distillation job runs daily per-user per-assistant via APScheduler
7. [ ] Trajectory extraction is non-blocking (runs as TaskIQ background task)
8. [ ] Manual distillation can be triggered via API endpoint
9. [ ] `make test` passes with no regressions
10. [ ] `make format && make lint` passes

## Backend Implementation Details

### Trajectory Extraction Hook (`backend/src/utils/stream.py`)

Hook into `_persist_final_state()` (line 278):

```python
async def _persist_final_state(agent, config, service_context, state):
    # ... existing persist logic ...

    # After persisting state, dispatch trajectory extraction
    await extract_trajectory.kiq(
        thread_id=config["configurable"]["thread_id"],
        user_id=service_context.user_id,
        assistant_id=service_context.assistant_id,
    )
```

### TaskIQ Task (`backend/src/workers/tasks.py`)

```python
@broker.task(task_name="extract_trajectory")
async def extract_trajectory(thread_id: str, user_id: str, assistant_id: str):
    """Extract AnnotatedTrajectory from completed conversation."""
    # 1. Load conversation messages from thread
    # 2. Derive quality signals:
    #    - conversation_length: number of turns
    #    - tool_success_rate: ratio of successful tool calls
    #    - hitl_rejections: count of human-in-the-loop rejections
    # 3. Format as AnnotatedTrajectory (langmem.prompts.types)
    # 4. Store in (user_id, "trajectories", assistant_id) namespace
```

### Prompt Optimizer Extension (`backend/src/services/prompt/optimize.py`)

```python
async def distill(self, user_id: str, assistant_id: str) -> str | None:
    """Distill accumulated trajectories into an improved prompt."""
    # 1. Retrieve recent trajectories from store namespace
    # 2. Load current system_prompt from assistant
    # 3. Run create_prompt_optimizer with trajectories
    # 4. Store result as new revision via PromptService.revision()
    # 5. Return new revision_id or None if no improvement
```

### Scheduled Job (`backend/src/services/schedule.py`)

```python
# Add to scheduler setup:
# Job type: "prompt_distillation"
# Trigger: CronTrigger(hour=3)  # Run daily at 3 AM
# Function: scheduled_prompt_distillation(user_id, assistant_id)
```

### Manual Trigger Endpoint (`backend/src/routes/v0/assistant.py`)

```
POST /assistants/{assistant_id}/distill
- Requires auth
- Triggers immediate distillation for the assistant
- Returns: {revision_id: str | null, status: "completed" | "no_improvement"}
```

## Key Integration Points

| What | Where | How |
|---|---|---|
| `AnnotatedTrajectory` | `langmem.prompts.types` | Format for extracted conversation data |
| `PromptOptimizer.optimize()` | `backend/src/services/prompt/optimize.py:72` | Base optimization logic to extend |
| `PromptService` revisions | `backend/src/services/prompt/__init__.py` | Store optimized prompts |
| `_persist_final_state()` | `backend/src/utils/stream.py:278` | Hook point for extraction dispatch |
| `AsyncPostgresStore` | `backend/src/services/db.py` | Namespace-based trajectory storage |
| APScheduler | `backend/src/services/schedule.py` | Schedule daily distillation |
| TaskIQ broker | `backend/src/workers/tasks.py` | Background extraction task |

## Example Output

```bash
# Trigger manual distillation
curl -X POST http://localhost:8000/api/assistants/abc-123/distill \
  -H "Authorization: Bearer <token>"
# Response: {"revision_id": "rev-456", "status": "completed"}

# Check trajectory count
# (Internal: trajectories in (user_id, "trajectories", "abc-123") namespace)
```

---

## Ralph Instructions

1. Work on the next incomplete criterion (marked [ ])
2. Check off completed criteria (change [ ] to [x])
3. Run tests after changes
4. Commit your changes frequently
5. When ALL criteria are [x], output: `<ralph>COMPLETE</ralph>`
6. If stuck on the same issue 3+ times, output: `<ralph>GUTTER</ralph>`
