# Agent Marketplace Specs

Implementation specs for the Agent Marketplace with Fork/Remix + Self-Improving Memory Loop.

**Source plan**: `.claude/plans/recursive-dancing-lighthouse.md`
**Branch**: `feat/885-agent-marketplace-plans`

## Phase Order (by ROI)

| Phase | Spec | Summary |
|-------|------|---------|
| 1 | [phase-1-fork-remix/](phase-1-fork-remix/) | Agent fork/remix — highest immediate ROI |
| 2 | [phase-2-discovery/](phase-2-discovery/) | Agent discovery experience (sort, tags, browse) |
| 3 | [phase-3-embed-widget/](phase-3-embed-widget/) | Embeddable agent chat widget |
| 4 | [phase-4-memory-distillation/](phase-4-memory-distillation/) | Self-improving memory loop via langmem |

Phase 5 (Workflow Engine) is deferred until marketplace demand validates it.

## Key Integration Points

| Existing Component | Location | Reused In |
|---|---|---|
| `AssistantService.publish()` | `backend/src/services/assistant.py:77` | Phase 1 (fork builds on publish) |
| `PublicAssistant` projection | `backend/src/schemas/entities/llm.py:155` | Phase 1-2 (add fork_count, tags) |
| Public endpoints | `backend/src/routes/v0/assistant.py:111` | Phase 1-2 (add fork, sort, filter) |
| `AgentService` frontend | `frontend/src/lib/services/agentService.ts` | Phase 1-3 (add fork, embed methods) |
| `PromptOptimizer` | `backend/src/services/prompt/optimize.py:68` | Phase 4 (auto-distillation) |
| `_persist_final_state()` | `backend/src/utils/stream.py:278` | Phase 4 (trajectory extraction hook) |
| APScheduler infra | `backend/src/services/schedule.py` | Phase 4 (scheduled distillation) |
| TaskIQ broker | `backend/src/workers/tasks.py` | Phase 4 (background extraction) |
