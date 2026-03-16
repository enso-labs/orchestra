# Agent Workflows: Visual DAG-based Workflow Builder

## Context

Orchestra today is a powerful AI agent platform — chat, assistants, tools, MCP, A2A, RAG, scheduling, memories, distributed workers, multi-model support. But every interaction is either a **single conversation** or a **scheduled single-agent invocation**. There's no way to compose agents into multi-step, branching, human-supervised automation pipelines.

This is the single highest-leverage addition because it:
- **Upgrades Orchestra from "AI chat app" to "AI automation platform"** — the step-function differentiator
- **Compounds every existing feature** — agents, tools, MCP, A2A, scheduling, HITL, memories all become workflow nodes
- **LangGraph is already the execution engine** — the backend literally runs on graph-based agent execution
- **React Flow is already installed** (`@xyflow/react` in `package.json`) but unused
- **Ships the HITL story** (Issue #812) as a natural byproduct — HITL gates are just a node type
- **Ships observability** as a natural byproduct — the workflow canvas IS the monitoring dashboard
- **Enterprise buyers expect this** — it's the #1 differentiator vs. ChatGPT/Claude/other chat-first tools

---

## Architecture

### Data Model

Store workflow definitions and runs in the existing **LangGraph AsyncPostgresStore** (same as assistants, threads, memories). Zero Alembic migrations needed.

Namespaces:
- `(user_id, "workflows")` → workflow definitions
- `(user_id, "workflow_runs")` → execution records

**Core schemas** (`backend/src/schemas/entities/workflow.py`):

| Entity | Key Fields |
|--------|-----------|
| `WorkflowNodeType` | enum: `agent`, `tool`, `conditional`, `hitl_gate`, `transform`, `trigger` |
| `WorkflowNode` | `id`, `type`, `label`, `config` (polymorphic), `position` (x,y for canvas) |
| `WorkflowEdge` | `id`, `source`, `target`, `source_handle` (for conditional branches) |
| `WorkflowDefinition` | `id`, `name`, `description`, `nodes[]`, `edges[]`, `variables` |
| `WorkflowRun` | `id`, `workflow_id`, `status`, `trigger_type`, `node_runs{}`, timestamps |
| `WorkflowNodeRun` | `node_id`, `status`, `input_data`, `output_data`, `error`, `thread_id` |

### API Routes

New router: `backend/src/routes/v0/workflow.py`

```
GET    /api/workflows                          — List workflows
POST   /api/workflows                          — Create workflow
GET    /api/workflows/{id}                     — Get definition
PUT    /api/workflows/{id}                     — Update definition
DELETE /api/workflows/{id}                     — Delete workflow
POST   /api/workflows/{id}/run                 — Execute (manual trigger)
GET    /api/workflows/{id}/runs                — List runs
GET    /api/workflows/{id}/runs/{run_id}       — Get run status + node states
GET    /api/workflows/{id}/runs/{run_id}/stream — SSE stream of run progress
POST   /api/workflows/{id}/runs/{run_id}/resume — Resume paused HITL gate
POST   /api/workflows/{id}/runs/{run_id}/cancel — Cancel running workflow
POST   /api/workflows/{id}/validate            — Validate DAG (no cycles, refs valid)
```

### Execution Engine

**Key decision**: Do NOT compile user DAGs into a single LangGraph `StateGraph`. Instead, build a Python-level DAG executor that calls existing LangGraph agents for agent-type nodes. Reasons:
1. LangGraph's `StateGraph` requires typed state schemas at construction time — dynamic compilation from arbitrary user DAGs is over-engineered for MVP
2. The existing infra already handles the hard parts (checkpointing, streaming, HITL) per-agent
3. A Python DAG executor can still leverage LangGraph checkpointing per agent node

`backend/src/services/workflow_engine.py`:
- Topological sort → execute nodes in order
- Agent nodes → call `construct_agent()` + `LLMController.llm_invoke()` (reuse existing path)
- Transform nodes → Jinja2 template rendering on previous node output
- Conditional nodes → evaluate expression, select branch
- HITL gates → persist state, set status to `paused`, wait for resume
- Progress events → publish to Redis stream `workflow_run:{run_id}`

### Frontend

**Pages:**
- `/workflows` — index (card grid, following assistants page pattern)
- `/workflows/create` — editor (new workflow)
- `/workflows/:workflowId` — editor (existing workflow)

**Canvas** (React Flow):
- Left sidebar: node palette (drag-and-drop)
- Center: visual canvas with nodes and edges
- Right panel: node config form (appears on node selection)
- Top toolbar: save, validate, run, schedule
- Bottom panel: run history + live execution log

**Custom node components** (`frontend/src/components/workflow/nodes/`):
- `AgentNode` — assistant name, model badge, avatar
- `ToolNode` — tool name, args preview
- `ConditionalNode` — diamond shape, true/false handles
- `HITLGateNode` — pause icon, approval status
- `TransformNode` — template preview
- `TriggerNode` — trigger type icon

---

## Reuse Map

| Existing Code | File | Reuse For |
|--------------|------|-----------|
| LangGraph store CRUD pattern | `backend/src/services/assistant.py` | WorkflowRepo |
| Agent construction | `backend/src/agents/__init__.py` (`construct_agent`, `init_config`) | Agent node execution |
| LLM invocation | `backend/src/controllers/llm.py` | Agent node delegation |
| TaskIQ distributed task | `backend/src/workers/tasks.py` (`run_agent_stream`) | `run_workflow` task |
| Redis streaming | `backend/src/utils/stream.py` | Run progress events |
| SSE from Redis | `backend/src/routes/v0/thread.py` (`/stream`) | Run progress SSE endpoint |
| HITL schemas | `backend/src/schemas/entities/hitl.py` | HITL gate node |
| ServiceContext | `backend/src/contexts/service.py` | Per-node execution context |
| Schedule system | `backend/src/services/schedule.py` | Cron-triggered workflows |
| Auth middleware | `backend/src/utils/auth.py` | Workflow route auth |
| React Flow | `@xyflow/react` (already in package.json) | Canvas |
| Frontend service pattern | `frontend/src/lib/services/scheduleService.ts` | `workflowService.ts` |
| Frontend hook pattern | `frontend/src/hooks/useSchedules.ts` | `useWorkflow.ts` |
| Route registration | `backend/src/routes/v0/__init__.py` | Add workflow router |
| Frontend routes | `frontend/src/routes/AppRoutes.tsx` | Add workflow pages |
| Sidebar nav | `frontend/src/components/drawers/AppSidebar.tsx` | Add Workflows section |

---

## Phased Implementation

### Phase 1: MVP (Weeks 1–2)

**Backend (Week 1):**
1. `schemas/entities/workflow.py` — all Pydantic models
2. `repos/workflow_repo.py` — LangGraph store CRUD
3. `services/workflow.py` — CRUD + DAG validation (cycle detection, ref validation)
4. `routes/v0/workflow.py` — full CRUD + `/run` + `/runs` endpoints
5. `services/workflow_engine.py` — synchronous DAG executor with Agent + Transform nodes
6. Register routes in `routes/v0/__init__.py`

**Frontend (Week 2):**
1. `lib/entities/workflow.ts` — TypeScript interfaces
2. `lib/services/workflowService.ts` — API client
3. Workflow canvas page with React Flow (drag-drop nodes, connect edges)
4. Node config panel (agent node = assistant selector dropdown)
5. Save/load/run buttons
6. Routes + sidebar nav item

**MVP delivers**: Users visually compose Agent + Transform chains, save them, run manually. Output flows node-to-node.

### Phase 2: Full Node Types + Live Execution (Weeks 3–4)
- HITL Gate nodes (pause/resume)
- Conditional nodes (branching)
- Tool nodes (direct tool invocation)
- Redis streaming for run progress
- SSE endpoint for live updates
- Frontend: live execution animation (nodes light up), HITL approval dialog, run history panel
- Distributed execution via TaskIQ
- Cron schedule integration

### Phase 3: Polish + Advanced (Weeks 5–6)
- Webhook triggers
- Parallel execution branches (fan-out/fan-in)
- Retry policies per node
- Workflow templates/cloning
- Cost tracking (token counts per agent node)
- Workflow sharing
- Mobile-responsive viewer

---

## Verification

### Unit Tests
- `backend/tests/unit/services/test_workflow_service.py` — DAG validation, topological sort, CRUD
- `backend/tests/unit/services/test_workflow_engine.py` — node execution (mock LLM calls), conditional branching, HITL pause/resume, error handling

### Integration Tests
- `backend/tests/integration/test_workflow_routes.py` — full API round-trip (create workflow → run → poll status → verify outputs)

### End-to-End Manual Test
1. Create an assistant via UI
2. Go to `/workflows/create`
3. Drag a Trigger (manual) → Agent Node (select the assistant) → Transform Node (extract a key)
4. Save, click Run
5. Verify: each node executes in sequence, transform output reflects agent's response
6. Check `/workflows` index shows the workflow with latest run status

### Frontend Tests
- `frontend/src/tests/WorkflowEditor.test.tsx` — node creation, edge connection, save/load, run trigger
