# RLM Integration: Recommendation & Architecture

> Final recommendation for bringing Recursive Language Model (RLM) capabilities into the Orchestra platform.
> Depends on: [RLM Architecture Analysis](./rlm-analysis.md) | [Benchmark Results](./rlm-benchmark-results.md)
> Feature: #793 | Branch: `feat/793-rlm-integration` | Date: 2026-02-16

---

## Executive Summary

### Recommendation

**Option D: Tool-Based / Agent-Driven RLM** is the recommended integration approach.

Instead of embedding the `rlms` library or reimplementing its iteration protocol, we expose three new LangGraph tools — `batch_llm_query`, `load_context_to_sandbox`, and `get_sandbox_variable` — that give the agent the building blocks to perform RLM-style decomposition within its natural tool-calling flow.

### Why Option D

| Factor | Decision Rationale |
|--------|-------------------|
| **Streaming** | Full token-level streaming out of the box — uses the existing LangGraph + SSE pipeline with zero new infrastructure. Options A and C have no or partial streaming, which is a production blocker. |
| **No external dependency** | Does not require the `rlms` package (v0.x, single-maintainer, FINAL_VAR bugs confirmed in PoC). Options A and C depend on it. |
| **Leverages existing infra** | Reuses Daytona sandbox, `AutoEvictMiddleware` pattern, LangChain client infrastructure, `asyncio.gather()` parallelism, and ToolTimeline UI. Option B also reuses infra but requires 3-4 weeks vs 1.5-2 weeks. |
| **Cost efficiency** | ~2x overhead vs standard completion (PoC: $0.014 vs $0.007) — significantly less than the rlms library's 7.4x overhead ($0.054) because tool calls avoid the growing iteration context. |
| **Natural migration** | Directly mirrors the existing `.claude/skills/rlm/SKILL.md` pattern (supervisor + parallel workers), moving it from CLI to platform level. |
| **Incremental adoption** | Can ship `batch_llm_query` alone in Phase 1, add context offloading in Phase 2, refine prompts in Phase 3. No all-or-nothing deployment. |

### Why Not the Others

- **Option A (Direct rlms)**: No streaming (76s blocking in PoC), FINAL_VAR extraction bugs, 7.4x cost overhead. Not viable for production.
- **Option B (Native LangGraph)**: Best theoretical UX but 3-4 weeks effort, prompt engineering risk, and no built-in parallelism. Too costly for the initial integration.
- **Option C (Hybrid rlms + Streaming)**: Requires forking an unstable library and maintaining the fork. FINAL_VAR bugs mean we'd be fixing core library issues on top of the integration work.

### Architecture Overview

```
construct_agent()
    ├── init_tools()
    │     ├── existing tools (search, browser, code interpreter, ...)
    │     └── NEW: batch_llm_query, load_context_to_sandbox, get_sandbox_variable
    ├── init_system_prompt() → includes RLM decomposition instructions
    └── create_deep_agent() → standard LangGraph graph (unchanged)

Agent workflow for large inputs:
    1. load_context_to_sandbox → offload to Daytona/StateBackend
    2. execute_in_sandbox → examine, chunk, prepare sub-queries
    3. batch_llm_query → parallel sub-LM calls (asyncio.gather + Semaphore)
    4. Synthesize results in agent response

Streaming: standard LangGraph tool-call SSE → ToolTimeline UI (no changes needed)
```

See [Section 12](#12-full-integration-architecture-option-d-tool-based) for the full architecture design.

### Migration from `.claude/skills/rlm/`

The existing CLI skill remains useful for Claude Code users. The platform implementation serves the web application.

| Skill Step | CLI (Current) | Platform (New) |
|------------|---------------|----------------|
| Assess input | Sonnet reads files | Agent detects large input |
| Decompose | Sonnet writes plan to scratchpad | Code interpreter examines + chunks context |
| Parallel workers | `Task(model="haiku")` × N | `batch_llm_query(model="fast")` |
| Evaluate | Sonnet checks completeness | Agent evaluates, may re-query |
| Synthesize | Sonnet aggregates | Agent synthesizes in response |

See [Section 12.8](#128-migration-path-from-claudeskillsrlm) for the detailed migration mapping.

### Timeline & Effort

| Phase | Scope | Effort |
|-------|-------|--------|
| Phase 1 | `batch_llm_query` tool | 2-3 days |
| Phase 2 | `load_context_to_sandbox` + `get_sandbox_variable` | 1-2 days |
| Phase 3 | System prompt engineering | 2-3 days |
| Phase 4 | Integration testing | 3-4 days |
| Phase 5 (optional) | Enhanced frontend rendering | 2-3 days |
| **Total** | | **1.5-2.5 weeks** |

### Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| `deepagents >= 0.3.8` | Installed | Agent construction |
| `langgraph >= 1.0.7` | Installed | Graph, streaming, checkpointing |
| `langchain-daytona` | Installed | Sandbox backend |
| Feature #694 (SubAgent UI) | Merged | ToolTimeline renders all tool calls |
| `rlms` package | **NOT needed** | Option D avoids this dependency |
| Frontend changes | **NOT needed** (baseline) | Existing ToolTimeline suffices |

### Key Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Agent doesn't decompose effectively | Strong system prompt with examples + iteration guardrails |
| Context window fills from tool results | `AutoEvictMiddleware` already handles this |
| `batch_llm_query` security | Restrict to approved models, rate-limit to 20 prompts/call |
| Cost higher than expected | `fast` model for sub-calls, agent skips RLM for small inputs |

### Next Steps

1. **Create implementation tickets** for Phases 1-4 on the project board
2. **Phase 1** (`batch_llm_query`) can start immediately — no prerequisites
3. **Phase 3** (system prompt) should reference the existing `.claude/skills/rlm/SKILL.md` for decomposition patterns
4. **Phase 5** (frontend enhancements) is optional and can be prioritized after initial user feedback

---

## 1. Context

Orchestra currently processes all agent context within the LLM's context window. For large inputs (100k+ tokens), this hits model limits, degrades quality, and increases cost. The RLM pattern — offloading context to a REPL environment and letting the LM programmatically decompose and query sub-LMs — addresses this directly.

This document evaluates four integration approaches against Orchestra's requirements:

- **Real-time streaming** (SSE with `["messages", chunk_data]` format)
- **SubAgent visibility** (show decomposition steps in the UI)
- **Existing infrastructure** (LangGraph, deepagents, Daytona, middleware stack)
- **Cost efficiency** (root model for orchestration, cheaper model for sub-calls)
- **Maintenance burden** (long-term ownership vs. library dependency)

---

## 2. Option A: Direct `rlms` Library Integration

### Approach

Install the `rlms` package in the backend and expose `rlm.completion()` as a LangGraph tool. The agent calls the tool when it detects a large input; the tool runs the full RLM decomposition loop internally and returns the final result.

```python
# backend/src/tools/rlm_tool.py
from rlm import RLM

@tool
async def rlm_analyze(context: str, query: str) -> str:
    """Process large context using RLM decomposition."""
    rlm = RLM(
        backend="openai",
        backend_kwargs={"model_name": settings.RLM_SUB_MODEL},
        environment="local",  # or "daytona"
        max_depth=1,
        max_iterations=30,
    )
    result = rlm.completion(context, root_prompt=query)
    return result.response
```

### Streaming/UI Visibility

| Aspect | Status |
|--------|--------|
| Token streaming | None — `rlm.completion()` blocks until done |
| Decomposition steps | Hidden — user sees "Calling rlm_analyze tool..." then a final result |
| Sub-call progress | Hidden — batched `llm_query` calls happen internally |
| Cost reporting | Available via `result.usage_summary` but must be surfaced manually |

The frontend would show a loading spinner with "Calling rlm_analyze tool..." for the entire duration (potentially minutes). No intermediate visibility.

### Pros

1. **Fastest to implement** — 1-2 days. Install package, write a tool wrapper, register it.
2. **Preserves RLM's batched parallelism** — `llm_query_batched()` uses `asyncio.gather()` internally.
3. **Battle-tested decomposition prompts** — RLM's system prompt has been refined for REPL-based decomposition.
4. **Built-in cost tracking** — `UsageSummary` provides per-model token counts automatically.
5. **Environment flexibility** — Can use RLM's LocalREPL for dev, DaytonaREPL for production.
6. **Clean separation** — RLM runs in its own context; doesn't pollute Orchestra's agent state.

### Cons

1. **No streaming** (Critical) — Blocks Orchestra's real-time UX requirement. Users see nothing for minutes.
2. **Black box execution** — No visibility into what the RLM is doing. Can't show decomposition plan, chunk progress, or sub-call results.
3. **Dual LLM client configuration** — Must configure API keys for both Orchestra (LangChain) and rlms (own BaseLM clients).
4. **Library dependency risk** — `rlms` is early-stage (v0.x), maintained by one researcher. Breaking changes, abandonment, or API instability are real risks.
5. **No LangGraph integration** — RLM's iteration loop is separate from LangGraph's state machine. Can't use LangGraph checkpointing, middleware, or state management for RLM steps.
6. **Context duplication** — Large context must be passed to the tool as a string argument, which the agent must first have in its context window (defeating the purpose for inputs that exceed the window).

### Effort Estimate

- Implementation: 1-2 days
- Testing: 1 day
- Total: 2-3 days

---

## 3. Option B: Native LangGraph Implementation

### Approach

Reimplement the RLM pattern as a LangGraph subgraph within Orchestra's existing agent pipeline. Each RLM iteration (code generation → REPL execution → result evaluation) becomes a LangGraph node that streams through the existing SSE pipeline.

```python
# backend/src/agents/rlm_graph.py
from langgraph.graph import StateGraph

class RLMState(TypedDict):
    context: str
    query: str
    iterations: list[RLMIteration]
    message_history: list[BaseMessage]
    final_answer: str | None

def build_rlm_subgraph():
    graph = StateGraph(RLMState)
    graph.add_node("plan_decomposition", plan_decomposition_node)
    graph.add_node("execute_code", execute_code_node)
    graph.add_node("evaluate", evaluate_node)
    graph.add_node("synthesize", synthesize_node)

    graph.add_edge("plan_decomposition", "execute_code")
    graph.add_edge("execute_code", "evaluate")
    graph.add_conditional_edges("evaluate", should_continue, {
        "continue": "plan_decomposition",
        "done": "synthesize",
    })
    return graph.compile()
```

The subgraph would be invoked by the main agent as a tool or SubAgent, with each node's output streaming as a separate SSE event.

### Streaming/UI Visibility

| Aspect | Status |
|--------|--------|
| Token streaming | Full — each LangGraph node streams tokens via `subgraphs=True` |
| Decomposition steps | Visible — each iteration is a separate streamed step |
| Sub-call progress | Visible — sub-LM calls can stream as SubAgent messages |
| Cost reporting | Via LangChain callbacks (needs implementation) |

The frontend would show each RLM iteration as a distinct step in the message timeline. The user sees the decomposition plan, code being generated, execution results, and the synthesis — all in real time.

### Pros

1. **Full streaming support** — Every iteration streams through Orchestra's existing SSE pipeline.
2. **Maximum UI visibility** — Decomposition plan, code execution, sub-call results all visible in the chat.
3. **Uses existing infrastructure** — LangGraph state, deepagents SubAgents, Daytona sandbox, middleware stack all apply.
4. **LangGraph checkpointing** — Can resume interrupted RLM operations from the last successful iteration.
5. **No external dependency** — No `rlms` package to maintain. The logic lives in Orchestra's codebase.
6. **Custom decomposition strategies** — Can tailor the decomposition prompt and strategy to Orchestra's specific use cases.
7. **Middleware integration** — `AutoEvictMiddleware`, compaction, PII filtering all apply to RLM steps.

### Cons

1. **Highest implementation effort** — Must reimplement RLM's iteration protocol, REPL injection (`llm_query`, `FINAL`, etc.), code parsing, and error handling.
2. **No batched parallel sub-calls** — Orchestra's SubAgents execute sequentially. LangGraph's `Send()` API could enable parallel nodes but isn't currently used and would require deepagents changes.
3. **Prompt engineering burden** — Must write and maintain decomposition prompts equivalent to RLM's `RLM_SYSTEM_PROMPT`. This is non-trivial; the rlms prompt has been iteratively refined.
4. **REPL state management** — Must implement variable persistence between code blocks (RLM uses `dill` serialization or in-memory dicts).
5. **Risk of divergence** — If the rlms library improves (e.g., adds streaming, deeper recursion), this implementation won't benefit automatically.
6. **Testing complexity** — Need to test decomposition quality, iteration convergence, error recovery — all areas where rlms has existing test coverage.

### Effort Estimate

- Implementation: 2-3 weeks
- Testing: 1 week
- Total: 3-4 weeks

---

## 4. Option C: Hybrid `rlms` + LangGraph Streaming

### Approach

Use the `rlms` library for its core decomposition engine but wrap each iteration step in a LangGraph-compatible streaming layer. This involves:

1. Fork or extend the `rlms` library to accept per-iteration callbacks
2. Run each callback as a LangGraph event emission
3. Use Orchestra's Daytona integration as the RLM environment backend

```python
# backend/src/agents/rlm_hybrid.py
from rlm import RLM

class StreamingRLM(RLM):
    def __init__(self, stream_callback, **kwargs):
        super().__init__(**kwargs)
        self.stream_callback = stream_callback

    def _completion_turn(self, *args, **kwargs):
        result = super()._completion_turn(*args, **kwargs)
        # Emit iteration state as SSE event
        self.stream_callback({
            "type": "rlm_iteration",
            "iteration": self.current_iteration,
            "code": result.code_blocks,
            "output": result.repl_output,
        })
        return result
```

The streaming callback would be wired into Orchestra's SSE pipeline, emitting custom events that the frontend renders as RLM progress indicators.

### Streaming/UI Visibility

| Aspect | Status |
|--------|--------|
| Token streaming | Partial — iteration boundaries stream, but individual LLM tokens don't |
| Decomposition steps | Visible — each iteration callback emits step details |
| Sub-call progress | Partial — batch completion callbacks possible, individual sub-call tokens not |
| Cost reporting | Full — via `result.usage_summary` |

The frontend would show iteration-level progress: "Iteration 1: Examining context structure...", "Iteration 2: Chunking into 5 parts...", etc. Not as granular as full token streaming but significantly better than Option A.

### Pros

1. **Leverages rlms decomposition** — Gets the battle-tested prompts and iteration protocol without reimplementing.
2. **Meaningful streaming** — Iteration-level updates provide good UX even without per-token streaming.
3. **Preserves parallelism** — rlms's `llm_query_batched()` still runs internally.
4. **Cost tracking included** — Built-in `UsageSummary`.
5. **Moderate effort** — Less work than full native implementation.
6. **Daytona reuse** — Can configure rlms to use its built-in DaytonaREPL, which is the same Daytona infra Orchestra already uses.

### Cons

1. **Library forking required** — rlms doesn't expose per-iteration callbacks. Must fork or monkeypatch the library.
2. **Maintenance burden** — Maintaining a fork means merging upstream changes, handling breaking changes in rlms internals.
3. **Custom SSE event type** — Frontend needs a new event handler for `rlm_iteration` events. Not complex but requires coordinated frontend/backend work.
4. **Partial streaming** — Better than Option A but still not full token streaming. Users don't see the LLM "thinking" in real-time.
5. **Dual client configuration** — Still need to configure both LangChain and rlms LLM clients.
6. **Tight coupling to rlms internals** — Subclassing or monkeypatching `_completion_turn()` depends on rlms's internal implementation, which can change without notice.

### Effort Estimate

- Implementation: 1-2 weeks
- Frontend event handling: 2-3 days
- Testing: 3-4 days
- Total: 2-3 weeks

---

## 5. Option D: Tool-Based Exposure (Agent-Driven RLM)

### Approach

Instead of running the full rlms loop, expose the RLM primitives as individual LangGraph tools. The agent itself becomes the orchestrator, using tools to load context into a sandbox, execute code, and query sub-LMs — effectively recreating the RLM loop within the agent's natural tool-calling flow.

```python
# Tools exposed to the agent:
@tool
async def load_context_to_sandbox(context: str, variable_name: str = "context") -> str:
    """Load large context into the sandbox environment as a variable."""

@tool
async def execute_in_sandbox(code: str) -> str:
    """Execute Python code in the sandbox. Has access to loaded context variables."""

@tool
async def batch_llm_query(prompts: list[str], model: str = "fast") -> list[str]:
    """Send multiple prompts to a sub-LM in parallel. Returns list of responses."""
```

The agent's system prompt would include RLM-style instructions explaining how to use these tools for decomposition, similar to how RLM's `RLM_SYSTEM_PROMPT` instructs the LM to use the REPL.

### Streaming/UI Visibility

| Aspect | Status |
|--------|--------|
| Token streaming | Full — standard LangGraph tool-calling streams every token |
| Decomposition steps | Full — each tool call is a visible step in the timeline |
| Sub-call progress | Partial — batch results visible, individual sub-call tokens not |
| Cost reporting | Partial — Orchestra's existing heuristics; precise tracking needs implementation |

The frontend would show each step naturally: "Loading context...", "Executing analysis code...", "Querying 5 sub-models...", "Synthesizing results...". Each tool call appears in the ToolTimeline component.

### Pros

1. **Full streaming by default** — Uses Orchestra's existing tool-call streaming. Zero additional streaming work.
2. **Maximum UI visibility** — Every tool call, code execution, and sub-LM query appears in the chat timeline.
3. **No external dependency** — No rlms package needed.
4. **Leverages existing tools** — `execute_in_sandbox` maps to the existing Python code interpreter + Daytona. `load_context_to_sandbox` extends `AutoEvictMiddleware`'s pattern.
5. **Agent flexibility** — The agent decides when and how to decompose. It can skip decomposition for small inputs and use it for large ones — no separate code path needed.
6. **Natural LangGraph flow** — Each step is a normal tool call with checkpointing, middleware, and error recovery.
7. **Incremental adoption** — Can start with `batch_llm_query` tool alone, add sandbox context loading later.

### Cons

1. **Prompt-dependent quality** — Decomposition quality depends on the agent's system prompt, not a purpose-built RLM prompt. The agent must know when and how to decompose, which adds prompt complexity.
2. **No built-in iteration protocol** — RLM's iterative loop (up to 30 iterations with code execution) must be driven by the agent's own reasoning. The agent might not iterate enough or might iterate too much.
3. **Context window overhead** — Each tool call result goes back into the agent's context. For many iterations, the message history grows quickly, potentially hitting the compaction threshold.
4. **Sequential sub-calls** — Without a dedicated `batch_llm_query` tool, the agent would call sub-LMs one at a time. The batch tool is essential.
5. **New tool development** — `batch_llm_query` and `load_context_to_sandbox` don't exist yet and need to be built, tested, and documented.
6. **Decomposition drift** — Without RLM's structured FINAL/FINAL_VAR protocol, the agent may produce answers at arbitrary points. Need to rely on natural agent behavior.

### Effort Estimate

- `batch_llm_query` tool: 2-3 days
- `load_context_to_sandbox` tool: 1-2 days
- System prompt engineering: 2-3 days
- Testing: 3-4 days
- Total: 1.5-2 weeks

---

## 6. Comparison Matrix

| Criterion | Option A: Direct rlms | Option B: Native LangGraph | Option C: Hybrid rlms + Streaming | Option D: Tool-Based |
|-----------|----------------------|---------------------------|----------------------------------|---------------------|
| **Streaming** | None | Full token-level | Iteration-level | Full token-level |
| **UI Visibility** | Minimal (tool spinner) | Maximum (per-node) | Good (per-iteration) | Maximum (per-tool) |
| **Parallel Sub-Calls** | Yes (built-in) | No (sequential SubAgents) | Yes (built-in) | Yes (batch tool) |
| **Implementation Effort** | 2-3 days | 3-4 weeks | 2-3 weeks | 1.5-2 weeks |
| **Maintenance Burden** | Low (library owned) | High (all custom) | High (fork maintenance) | Medium (3 new tools) |
| **External Dependency** | rlms v0.x | None | rlms v0.x (forked) | None |
| **Uses Existing Infra** | Minimal | Full | Partial | Full |
| **Cost Tracking** | Built-in UsageSummary | Needs implementation | Built-in UsageSummary | Needs implementation |
| **Decomposition Quality** | Proven (rlms prompts) | Risk (new prompts) | Proven (rlms prompts) | Risk (agent-driven) |
| **Checkpointing** | None (rlms-internal) | Full LangGraph | None (rlms-internal) | Full LangGraph |
| **Context Window** | Offloaded to REPL | Offloaded to REPL | Offloaded to REPL | Partially offloaded |
| **Migration from skill** | Easy (same pattern) | Full rewrite | Medium | Moderate |

---

## 7. Streaming/UI Visibility Deep Dive

This section expands on how each option affects the user experience, since streaming is Orchestra's most critical UX requirement.

### Current UI Components

Orchestra's frontend renders agent messages through:
- **ChatMessages** — Main message list with auto-scroll
- **ToolTimeline** — Vertical timeline of tool executions with success/failure dots
- **ToolTimelineItem** — Collapsible cards per tool call showing name, input, and output
- **StreamMessageHandler** — Processes SSE events into displayable messages

### Option A: What Users See

```
User: "Analyze this 200-page contract for risks"
[AI]: "I'll analyze this using RLM decomposition."
[Tool: rlm_analyze] ← Loading spinner for 2-5 minutes
[AI]: "Here are the key risks I found: ..."
```

**Problem**: The 2-5 minute spinner with no intermediate feedback is unacceptable for a real-time chat interface. Users will assume it's broken.

### Option B: What Users See

```
User: "Analyze this 200-page contract for risks"
[AI]: "I'll analyze this contract systematically."
[RLM Node: plan] "Examining context: 450,000 characters across 200 pages..."
[RLM Node: code] "Chunking into 8 sections by chapter headings..."
  [Code output: 8 chunks identified]
[RLM Node: sub-call 1/8] "Analyzing Chapter 1: Definitions..." (streaming)
[RLM Node: sub-call 2/8] "Analyzing Chapter 2: Obligations..." (streaming)
  ... (each sub-call streams its analysis)
[RLM Node: synthesize] "Combining findings across all chapters..."
[AI]: "Here are the key risks I found: ..."
```

**Best UX**: Full visibility at every step. Each node streams naturally through the existing SubAgent message pipeline.

### Option C: What Users See

```
User: "Analyze this 200-page contract for risks"
[AI]: "I'll analyze this using RLM decomposition."
[Tool: rlm_analyze]
  Iteration 1: Examining context structure (450,000 chars)
  Iteration 2: Chunking into 8 sections
  Iteration 3: Querying sub-models on 8 chunks (batched)
  Iteration 4: Aggregating results
  Iteration 5: FINAL answer produced
[AI]: "Here are the key risks I found: ..."
```

**Good UX**: Users see progress updates per iteration. Not as detailed as Option B but clearly shows activity and progress.

### Option D: What Users See

```
User: "Analyze this 200-page contract for risks"
[AI]: "This is a large document. I'll decompose it for thorough analysis."
[Tool: load_context_to_sandbox] ← "Loaded 450,000 chars as 'context'"
[Tool: execute_in_sandbox] ← "Found 8 chapters, splitting..."
[Tool: batch_llm_query] ← "Analyzing 8 sections in parallel..."
  Results: [section 1 summary, section 2 summary, ...]
[Tool: execute_in_sandbox] ← "Identifying cross-section risks..."
[AI]: "Here are the key risks I found: ..."
```

**Good UX**: Each tool call appears in the ToolTimeline. The user sees the agent thinking, loading data, executing code, and querying sub-models — all with streaming.

---

## 8. Risk Assessment

### Option A Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| rlms library abandoned | Medium | High | Fork before depending; library is single-maintainer |
| No streaming causes user frustration | High | High | None — fundamental limitation |
| API key management complexity | Low | Low | Use same provider keys |

### Option B Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Decomposition prompt quality | Medium | High | Start from rlms prompts, iterate |
| Scope creep during implementation | Medium | Medium | Time-box to 4 weeks |
| Sequential sub-calls too slow | Medium | Medium | Implement `Send()` API or batch tool |

### Option C Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| rlms internal API changes break fork | Medium | High | Pin version, review upstream changes |
| Fork maintenance burden | High | Medium | Contribute callbacks upstream |
| Partial streaming insufficient for UX | Low | Medium | Can enhance later |

### Option D Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Agent doesn't decompose well | Medium | High | Strong system prompt + examples |
| Context window fills from tool results | Medium | Medium | AutoEvictMiddleware handles this |
| batch_llm_query introduces security risks | Low | High | Restrict models and rate-limit |
| Agent iterates too many/few times | Medium | Low | Add iteration guardrails in prompt |

---

## 9. Dependency Analysis

### Existing Codebase Dependencies Relevant to Each Option

| Dependency | Version | Relevant To |
|-----------|---------|-------------|
| `deepagents` | 0.3.8 | Options B, D (SubAgent infrastructure) |
| `langgraph` | 1.0.7 | Options B, D (graph, checkpointing) |
| `langchain` | >= 1.2.0 | All options (LLM client) |
| `langchain-daytona` | (installed) | Options A, B, C (sandbox backend) |
| `rlms` | not installed | Options A, C (direct dependency) |

### Option A Dependencies to Add
- `rlms` (pip install)
- Configure rlms LLM client credentials separately

### Option B Dependencies to Add
- None (uses existing stack)
- May need `langgraph` features like `Send()` for parallelism

### Option C Dependencies to Add
- `rlms` (forked version with callback support)
- Custom SSE event type in frontend

### Option D Dependencies to Add
- None (uses existing stack)
- 3 new tools to build and maintain

---

## 10. Migration Path from `.claude/skills/rlm/`

The existing RLM skill in `.claude/skills/rlm/SKILL.md` implements the RLM pattern at the Claude Code CLI level using:
- Sonnet supervisor for decomposition and synthesis
- Parallel Haiku sub-agents via the Task tool
- Scratchpad files for intermediate results

Each integration option has a different migration path from this skill:

| Option | Migration Path |
|--------|---------------|
| **A: Direct rlms** | Replace skill's Task-based decomposition with `rlm.completion()`. Simpler but loses the skill's streaming and visibility. |
| **B: Native LangGraph** | Port the skill's 5-step workflow (Assess → Decompose → Spawn Workers → Evaluate → Synthesize) into LangGraph nodes. Closest conceptual match. |
| **C: Hybrid** | Keep rlms for the core loop, add the skill's assessment step as a pre-filter. Moderate migration. |
| **D: Tool-Based** | Map the skill's workflow to tool calls: `load_context_to_sandbox` ≈ skill's input assessment, `batch_llm_query` ≈ skill's parallel Haiku workers, agent synthesis ≈ skill's Step 5. Natural evolution of the skill pattern. |

Option D most closely mirrors the existing skill's architecture (supervisor + parallel workers) but moves it from the CLI to the platform.

---

## 11. Proof of Concept Results

> Full benchmark report: [docs/rlm-benchmark-results.md](./rlm-benchmark-results.md)
> Prototype script: `backend/scripts/rlm_prototype.py`

### 11.1 Test Setup

The prototype ran `rlm.completion()` against 50k characters (13 Python files) from `backend/src/`, using:
- **Root model**: gpt-4.1-mini (orchestration)
- **Sub model**: gpt-4.1-nano (chunk processing)
- **Environment**: local (in-process REPL)
- **Query**: Codebase analysis covering architecture, security vulnerabilities, and refactoring opportunities

A standard (non-RLM) completion using the same root model was run for comparison.

### 11.2 Benchmark Results

| Metric | Standard | RLM | Ratio |
|--------|----------|-----|-------|
| Latency | 30.4s | 76.5s | 2.52x slower |
| Input tokens | 10,634 | 126,412 | 11.89x more |
| Output tokens | 1,875 | 14,129 | 7.54x more |
| Cost | $0.0073 | $0.0540 | 7.45x more |
| Response quality | Detailed, code-specific | Aggregated, higher-level | Comparable |

### 11.3 Key Findings

1. **RLM is 2.5x slower and 7.4x more expensive for within-context inputs.** The iterative REPL loop (12 iterations) and growing message history amplify both latency and token consumption. For inputs that fit in the model's context window, standard completion is strictly better.

2. **RLM's value proposition is for inputs exceeding the context window.** When standard completion fails entirely, RLM enables processing by offloading context to the REPL. The cost overhead is justified when there is no alternative.

3. **Streaming gap is confirmed critical.** RLM blocked for 76.5s with zero intermediate output. Verbose mode shows rich iteration progress, but this is only accessible via console logging — not as programmatic callbacks. This confirms Gap 1 from Section 9 is a production blocker.

4. **FINAL_VAR response extraction is unreliable.** One test run returned just the variable name `"final_report"` (12 chars) instead of the 6k-char analysis. The library's `find_final_answer()` depends on REPL state that can be inconsistent. This is a reliability blocker for Option A.

5. **Sub-call parallelism works well.** The 20 sub-LM calls used `llm_query_batched()` with `asyncio.gather()`, processing chunks concurrently. This is the primary speed benefit of the RLM approach.

6. **Dual-model cost optimization works but doesn't offset the iteration overhead.** While gpt-4.1-nano is 4x cheaper per token than gpt-4.1-mini, the root model's growing context (from accumulating iteration results) dominates the cost.

### 11.4 Impact on Integration Options

| Option | PoC Verdict |
|--------|-------------|
| **A: Direct rlms** | **Not viable.** Confirmed: no streaming, FINAL_VAR bugs, 7.4x cost overhead. |
| **B: Native LangGraph** | Still viable but high effort. PoC confirms the iteration protocol works. |
| **C: Hybrid rlms** | Weakened. FINAL_VAR bugs mean forking rlms requires fixing core library issues. |
| **D: Tool-Based** | **Strengthened.** Avoids all rlms issues. `batch_llm_query` provides parallelism. Standard tool streaming. Existing skill pattern validates the approach. |

### 11.5 Reproduction

```bash
# Dry run (validate setup, no API calls):
uv run --with "rlms>=0.1.0" backend/scripts/rlm_prototype.py --dry-run

# Full benchmark:
set -a && source ~/.env/orchestra/.env.backend && set +a
uv run --with "rlms>=0.1.0" backend/scripts/rlm_prototype.py --backend openai --verbose

# With Anthropic:
uv run --with "rlms>=0.1.0" backend/scripts/rlm_prototype.py --backend anthropic

# Custom input size:
uv run --with "rlms>=0.1.0" backend/scripts/rlm_prototype.py --max-chars 200000
```

---

## 12. Full Integration Architecture (Option D: Tool-Based)

Based on the analysis (Sections 1-11), **Option D (Tool-Based / Agent-Driven RLM)** is the recommended approach. This section details the production architecture design.

### 12.1 Where RLM Fits in the Agent Construction Pipeline

RLM capabilities integrate into the existing agent pipeline as **three new tools** registered alongside existing tools during `construct_agent()`. No changes to the core `Orchestra` class, `stream_generator()`, or `create_deep_agent()` are required.

```
construct_agent()
    │
    ├── init_tools(assistant, ...)       ← existing tool initialization
    │       ├── search_engine, browser, ...
    │       ├── python_code_interpreter   ← existing Daytona tool
    │       └── NEW: rlm_tools            ← 3 RLM-specific tools
    │             ├── batch_llm_query
    │             ├── load_context_to_sandbox
    │             └── get_sandbox_variable
    │
    ├── init_subagents(...)              ← unchanged
    ├── init_default_middleware(...)      ← unchanged (AutoEvict, compaction, PII still apply)
    └── create_deep_agent(...)           ← unchanged (LangGraph graph compilation)
```

**Integration point**: `backend/src/tools/__init__.py` — Add RLM tools to the tool registry. Tools are conditionally included based on agent configuration (e.g., an `rlm_enabled` flag on the Assistant model, or always-on since the agent decides when to use them).

**System prompt augmentation**: `backend/src/agents/__init__.py` — `init_system_prompt()` appends RLM-specific instructions when RLM tools are available, similar to how tool descriptions are currently injected. The prompt teaches the agent when and how to use decomposition:

```
## Large Input Processing

When the input context exceeds approximately 100,000 characters, use the RLM tools
to decompose and analyze it:

1. Use `load_context_to_sandbox` to offload the large context to the sandbox
2. Use `execute_in_sandbox` (existing code interpreter) to examine, chunk, and
   prepare sub-queries
3. Use `batch_llm_query` to send chunks to sub-models in parallel
4. Synthesize results in your response

For inputs that fit in your context window, process them directly — do NOT use
RLM tools for small inputs.
```

### 12.2 Tool Specifications

#### Tool 1: `batch_llm_query`

```python
# backend/src/tools/rlm_tools.py

@tool
async def batch_llm_query(
    prompts: list[str],
    system_prompt: str = "",
    model: str = "fast",
) -> list[str]:
    """Send multiple prompts to a sub-LM in parallel. Returns list of responses.

    Use this to process multiple chunks concurrently. The 'fast' model is
    cost-optimized for focused extraction tasks. Use 'default' for complex reasoning.

    Args:
        prompts: List of prompts to send (max 20).
        system_prompt: Optional shared system prompt for all sub-calls.
        model: "fast" (gpt-4.1-nano/haiku) or "default" (configured model).
    """
```

**Implementation details**:
- Uses `asyncio.gather()` with `Semaphore(10)` for rate limiting
- Model routing: `"fast"` → cheapest available model (e.g., gpt-4.1-nano, claude-haiku), `"default"` → the agent's own model
- Each sub-call uses `init_chat_model()` from LangChain (same client infrastructure as the rest of Orchestra)
- Results returned as a JSON list, each entry mapped to the corresponding prompt
- Token usage per sub-call accumulated and attached to the ToolMessage metadata
- Max 20 prompts per call (guardrail against runaway decomposition)
- Individual sub-call timeout: 60 seconds

#### Tool 2: `load_context_to_sandbox`

```python
@tool
async def load_context_to_sandbox(
    content: str,
    variable_name: str = "context",
) -> str:
    """Load large text content into the sandbox as a named variable.

    The content is stored in the sandbox environment and can be accessed
    by the code interpreter tool via the variable name. This removes the
    content from the LLM context window.

    Args:
        content: The text content to store (can be very large).
        variable_name: Name to assign in sandbox (default: 'context').
    """
```

**Implementation details**:
- Writes content to the `CompositeBackend` (Daytona or StateBackend) at path `/rlm_context/{variable_name}`
- Returns a confirmation string: `"Loaded {len(content)} characters as '{variable_name}'. Use the code interpreter to access: content = open('/rlm_context/{variable_name}').read()"`
- Extends the pattern already used by `AutoEvictMiddleware` (evict large content to filesystem)
- Multiple variables supported (context_0, context_1, etc.) for multi-document processing

#### Tool 3: `get_sandbox_variable`

```python
@tool
async def get_sandbox_variable(
    variable_name: str,
    start: int = 0,
    length: int = 10000,
) -> str:
    """Read a portion of a sandbox variable without loading it into context.

    Use this to peek at stored content (e.g., check structure, read headers)
    without pulling the entire variable into your context window.

    Args:
        variable_name: Name of the stored variable.
        start: Character offset to start reading from.
        length: Number of characters to read (max 50000).
    """
```

**Implementation details**:
- Reads a slice from `/rlm_context/{variable_name}` in the backend
- Prevents the agent from accidentally pulling the entire large context back into its window
- Useful for the agent to inspect structure before deciding on decomposition strategy

### 12.3 How Recursive Steps Stream to the Frontend

**No new streaming infrastructure needed.** Each RLM tool call streams through the existing SSE pipeline exactly like any other tool:

```
Agent reasoning → SSE: ["messages", [AIMessageChunk, metadata]]
  ↓
Tool call: load_context_to_sandbox → SSE: ["messages", [tool_call_chunk, metadata]]
  ↓
Tool result → SSE: ["messages", [ToolMessage, metadata]]
  ↓
Agent reasoning → SSE: ["messages", [AIMessageChunk, metadata]]
  ↓
Tool call: batch_llm_query → SSE: ["messages", [tool_call_chunk, metadata]]
  ↓
(internally: 8 parallel sub-LM calls via asyncio.gather)
  ↓
Tool result → SSE: ["messages", [ToolMessage, metadata]]
  ↓
Agent synthesizes → SSE: ["messages", [AIMessageChunk, metadata]]
```

**Key advantage over Options A-C**: The streaming is standard LangGraph tool-call streaming. Every token of the agent's reasoning is visible in real-time. Each tool call appears as a distinct step. No custom SSE event types needed.

**Streaming timeline for a typical RLM operation**:

```
t=0s    [AI streaming] "This is a large document. I'll decompose it for analysis."
t=3s    [Tool: load_context_to_sandbox] "Loaded 450,000 chars as 'context'"
t=5s    [Tool: execute_in_sandbox] code="""
           context = open('/rlm_context/context').read()
           # Examine structure
           print(f"Total: {len(context)} chars")
           print(context[:2000])  # Preview first section
        """
        result: "Total: 450000 chars\n# Chapter 1: Definitions..."
t=8s    [AI streaming] "I see 8 chapters. I'll analyze each in parallel."
t=10s   [Tool: execute_in_sandbox] code="""
           # Split into chapters
           import re
           chapters = re.split(r'\n# Chapter \d+', context)
           prompts = [f"Analyze this chapter for legal risks:\n{ch[:50000]}" for ch in chapters]
        """
t=12s   [Tool: batch_llm_query] prompts=[8 items], model="fast"
           → internally: 8 parallel sub-LM calls
t=35s   Tool result: ["Chapter 1 findings...", "Chapter 2 findings...", ...]
t=37s   [AI streaming] "Here are the key risks I found across all chapters: ..."
t=45s   [Complete]
```

**Total time**: ~45s with full visibility at every step (vs. 76s+ as a black box with Option A).

### 12.4 How the UI Shows Decomposition Progress

The frontend renders RLM operations using **existing UI components** with no required changes. Optional enhancements can be added incrementally.

#### Baseline: Existing ToolTimeline (No Frontend Changes)

Each RLM tool call renders as a `ToolTimelineItem` in the existing `ToolTimeline` component:

```
┌─ AI Message ─────────────────────────────────────────────────┐
│ "This is a large document. I'll decompose it for analysis."  │
└──────────────────────────────────────────────────────────────┘

● load_context_to_sandbox                              ✓ Success
  ├─ Input: { content: "[450,000 chars]", variable_name: "context" }
  └─ Output: "Loaded 450,000 characters as 'context'"

● execute_in_sandbox                                   ✓ Success
  ├─ Input: { code: "context = open(...)..." }
  └─ Output: "Total: 450000 chars\n# Chapter 1..."

● execute_in_sandbox                                   ✓ Success
  ├─ Input: { code: "chapters = re.split(...)..." }
  └─ Output: "8 chapters identified"

● batch_llm_query                                      ✓ Success
  ├─ Input: { prompts: [8 items], model: "fast" }
  └─ Output: ["Chapter 1: ...", "Chapter 2: ...", ...]

┌─ AI Message ─────────────────────────────────────────────────┐
│ "Here are the key risks I found across all chapters: ..."    │
└──────────────────────────────────────────────────────────────┘
```

This provides meaningful visibility with zero frontend work. Users see each step, its inputs and outputs, and the agent's reasoning between steps.

#### Enhanced: RLM-Aware Rendering (Optional Frontend Work)

For richer UX, the `ToolTimelineItem` component could detect RLM tool names and render enhanced views:

**`batch_llm_query` enhancement** — Show sub-call progress:
```
● batch_llm_query                                    ✓ 8/8 complete
  ├─ Model: gpt-4.1-nano
  ├─ Sub-calls: ████████░░ 8/10
  ├─ Chunk 1: "Chapter 1: Definitions" → 3 risks found
  ├─ Chunk 2: "Chapter 2: Obligations" → 5 risks found
  ├─ ...
  └─ Total tokens: 45,230 (est. $0.004)
```

**`load_context_to_sandbox` enhancement** — Show context summary:
```
● load_context_to_sandbox                            ✓ Success
  ├─ Size: 450,000 chars (≈112,500 tokens)
  ├─ Variable: context
  └─ Note: Content offloaded to sandbox, not in LLM context
```

**Implementation**: These enhancements would be in `frontend/src/components/timeline/ToolTimelineItem.tsx`, adding conditional rendering based on tool name — similar to how `search_engine` tool calls already have custom rendering via the `SearchEngineTool` component.

#### Dependency: #694 SubAgent UI

Feature #694 (merged 2026-01-24) added SubAgent tool call rendering to the ToolTimeline. This is the foundation for RLM visibility:

- `lc_agent_name` metadata distinguishes root agent from SubAgent messages
- Tool calls from SubAgents render in the same ToolTimeline with agent context
- The `subgraphs=True` flag in `stream_generator()` enables this streaming

**For RLM**: Since Option D uses standard tool calls (not SubAgents) for `batch_llm_query`, the SubAgent UI from #694 is not strictly required. However, if the architecture evolves to use SubAgents for sub-LM calls (e.g., each sub-call as a worker SubAgent), the #694 UI would provide nested rendering automatically.

**Current dependency status**: #694 is merged. RLM tool calls will render correctly in the existing ToolTimeline without additional SubAgent UI work.

### 12.5 Sandbox Environment Configuration

RLM tools use the **same sandbox backend** as the existing code interpreter — resolved by `resolve_sandbox_backend()` in `backend/src/agents/__init__.py`.

#### Resolution Flow

```
resolve_sandbox_backend(sandbox_type, tool_runtime)
    │
    ├── sandbox_type = "daytona" (or "auto")
    │   ├── create_daytona_backend()
    │   │   ├── Daytona(DaytonaConfig(api_key=DAYTONA_API_KEY))
    │   │   └── client.create() → DaytonaSandbox
    │   ├── validate_daytona_execute_capability(backend)
    │   └── CompositeBackend(default=daytona_backend)
    │
    ├── sandbox_type = "state" (fallback)
    │   └── StateBackend(runtime) → in-memory filesystem
    │
    └── Result: CompositeBackend passed to construct_agent()
            │
            ├── Used by: python_code_interpreter (existing)
            ├── Used by: AutoEvictMiddleware (existing)
            └── Used by: load_context_to_sandbox (NEW)
                         get_sandbox_variable (NEW)
```

#### Storage Layout

```
CompositeBackend filesystem:
/
├── large_tool_results/          ← AutoEvictMiddleware (existing)
│   └── {sanitized_tool_id}
├── rlm_context/                 ← NEW: RLM context storage
│   ├── context                  ← default variable
│   ├── context_0                ← multi-context support
│   ├── context_1
│   └── ...
├── memory/                      ← MemoryMiddleware (existing)
│   └── ...
└── user_files/                  ← User uploads (existing)
    └── ...
```

#### Environment-Specific Behavior

| Environment | Code Interpreter | RLM Context Storage | RLM Sub-Calls |
|-------------|-----------------|--------------------|----|
| **Daytona** | Full sandbox isolation, exec() in container | Files in Daytona filesystem, accessible via `open()` | Standard LangChain API calls from host process |
| **StateBackend** | Limited (virtual filesystem, no exec) | In-memory dict, accessible via tool | Standard LangChain API calls from host process |
| **Local dev** | `StateBackend` fallback | In-memory | Same |

**Key design decision**: RLM sub-calls (`batch_llm_query`) execute on the **host process**, not inside the sandbox. This means:
- Sub-calls use Orchestra's existing LangChain client infrastructure (no dual-client configuration)
- Sub-calls benefit from Orchestra's model middleware, retry logic, and API key management
- The sandbox is only used for context storage and code execution (examination, chunking)
- No need to inject `llm_query()` into the sandbox namespace (unlike the rlms library)

### 12.6 Cost Tracking Across Recursive Calls

#### Current State

Orchestra estimates tokens heuristically (`len(content) // 4`) for compaction decisions only. There is no per-request cost reporting.

#### RLM Cost Tracking Design

Cost tracking is implemented in two layers:

**Layer 1: `batch_llm_query` tool-level tracking** (immediate)

```python
async def batch_llm_query(prompts, system_prompt="", model="fast"):
    results = []
    total_usage = {"input_tokens": 0, "output_tokens": 0, "calls": 0}

    async def call_one(prompt):
        llm = init_chat_model(resolve_model(model))
        response = await llm.ainvoke([
            SystemMessage(content=system_prompt) if system_prompt else None,
            HumanMessage(content=prompt),
        ])
        # Accumulate usage from response metadata
        usage = response.usage_metadata or {}
        total_usage["input_tokens"] += usage.get("input_tokens", 0)
        total_usage["output_tokens"] += usage.get("output_tokens", 0)
        total_usage["calls"] += 1
        return response.content

    sem = asyncio.Semaphore(10)
    async def bounded_call(prompt):
        async with sem:
            return await call_one(prompt)

    results = await asyncio.gather(*[bounded_call(p) for p in prompts])

    # Return results + usage metadata
    return {
        "results": results,
        "usage": {
            "model": resolve_model(model),
            "total_input_tokens": total_usage["input_tokens"],
            "total_output_tokens": total_usage["output_tokens"],
            "total_calls": total_usage["calls"],
            "estimated_cost_usd": estimate_cost(
                total_usage["input_tokens"],
                total_usage["output_tokens"],
                resolve_model(model),
            ),
        },
    }
```

The usage metadata is included in the `ToolMessage` response, visible to both the agent and the user (rendered in the ToolTimelineItem).

**Layer 2: Thread-level cost aggregation** (future enhancement)

A `CostTrackingMiddleware` could be added to the middleware stack to aggregate costs across all LLM calls in a thread:

```python
class CostTrackingMiddleware:
    """Track cumulative token usage across all LLM calls in a request."""

    def __call__(self, handler):
        async def wrapper(request):
            response = await handler(request)
            # Extract usage_metadata from response
            # Accumulate in RunnableConfig["configurable"]["cost_tracker"]
            return response
        return wrapper
```

This is not required for the initial RLM integration but provides a path to per-thread cost dashboards.

#### Cost Comparison: Standard vs. RLM

Based on PoC results (Section 11), expected costs for Option D:

| Operation | Tokens | Cost | Notes |
|-----------|--------|------|-------|
| Agent reasoning (root model) | ~5,000 in + ~1,000 out | ~$0.005 | Planning, synthesis |
| `load_context_to_sandbox` | ~100 in + ~50 out | ~$0.0001 | Tool overhead only |
| `execute_in_sandbox` (2-3 calls) | ~500 in + ~200 out | ~$0.001 | Code execution |
| `batch_llm_query` (8 chunks) | ~80,000 in + ~8,000 out | ~$0.008 | Fast model, parallel |
| **Total RLM operation** | ~86,000 in + ~9,300 out | **~$0.014** | |
| **Standard (if input fits)** | ~60,000 in + ~2,000 out | **~$0.007** | Single pass |

Option D's cost overhead (~2x) is significantly less than the rlms library's (7.4x) because:
- No growing iteration context (agent makes direct tool calls, not 12+ REPL iterations)
- Sub-calls are focused prompts, not the full accumulated message history
- The `fast` model for sub-calls is cheaper than the root model

### 12.7 Data Flow Diagram

Complete data flow for an RLM operation through the Orchestra stack:

```
┌─ User ──────────────────────────────────────────────────────────────────────┐
│ "Analyze this 200-page contract for risks"                                  │
│ + attached file: contract.pdf (450,000 chars)                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─ Backend: POST /llm/stream ─────────────────────────────────────────────────┐
│                                                                              │
│  stream_generator()                                                          │
│    ├── prepare_memory_files()                                                │
│    ├── resolve_sandbox_backend() → CompositeBackend (Daytona or State)       │
│    ├── construct_agent()                                                     │
│    │     ├── init_tools() → [...existing tools, batch_llm_query,             │
│    │     │                    load_context_to_sandbox, get_sandbox_variable]  │
│    │     ├── init_system_prompt() → base prompt + RLM instructions           │
│    │     └── create_deep_agent() → LangGraph compiled graph                  │
│    │                                                                         │
│    └── agent.astream(input, subgraphs=True)                                  │
│          │                                                                   │
│          ├── [LangGraph Node: agent]                                         │
│          │     LLM decides: input is large → use RLM tools                   │
│          │     → SSE: ["messages", [AIMessageChunk, "I'll decompose..."]]    │
│          │                                                                   │
│          ├── [LangGraph Node: tools]                                         │
│          │     Tool: load_context_to_sandbox(content, "contract")            │
│          │     → Backend.write("/rlm_context/contract", content)             │
│          │     → SSE: ["messages", [ToolMessage, "Loaded 450K chars"]]       │
│          │                                                                   │
│          ├── [LangGraph Node: agent]                                         │
│          │     LLM: Use code interpreter to examine structure                │
│          │                                                                   │
│          ├── [LangGraph Node: tools]                                         │
│          │     Tool: python_code_interpreter(code)                           │
│          │     → Daytona.execute(code) → "8 chapters found"                  │
│          │     → SSE: ["messages", [ToolMessage, "8 chapters"]]              │
│          │                                                                   │
│          ├── [LangGraph Node: agent]                                         │
│          │     LLM: Prepare 8 prompts, call batch_llm_query                  │
│          │                                                                   │
│          ├── [LangGraph Node: tools]                                         │
│          │     Tool: batch_llm_query(prompts=8, model="fast")                │
│          │     → asyncio.gather(8 × init_chat_model().ainvoke())             │
│          │     → SSE: ["messages", [ToolMessage, {results: [...], usage}]]   │
│          │                                                                   │
│          ├── [LangGraph Node: agent]                                         │
│          │     LLM: Synthesize findings                                      │
│          │     → SSE: ["messages", [AIMessageChunk, "Key risks: ..."]]       │
│          │                                                                   │
│          └── [LangGraph: END]                                                │
│                → SSE: ["messages", [stop signal]]                            │
│                → SSE: [DONE]                                                 │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─ Frontend: SSE Event Handling ──────────────────────────────────────────────┐
│                                                                              │
│  StreamSource.onEvent()                                                      │
│    → useChat.handleMessages()                                                │
│      → StreamMessageHandler.messageUpdate() / toolCall()                     │
│        → ChatMessages component re-renders                                   │
│          → ToolTimeline renders each tool call as a ToolTimelineItem         │
│                                                                              │
│  No new SSE event types. No new frontend components (baseline).              │
│  Optional: enhanced ToolTimelineItem rendering for RLM tool names.           │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 12.8 Migration Path from `.claude/skills/rlm/`

The existing CLI-level skill at `.claude/skills/rlm/SKILL.md` maps cleanly to the platform architecture:

| Skill Step | CLI Implementation | Platform Implementation |
|------------|-------------------|------------------------|
| **Step 1: Assess** | Sonnet reads files, counts lines | Agent reads input, decides to use RLM tools |
| **Step 2: Decompose** | Sonnet writes work plan to scratchpad | Agent uses code interpreter to examine + chunk context |
| **Step 3: Spawn Workers** | `Task(model="haiku")` × N in parallel | `batch_llm_query(prompts=N, model="fast")` |
| **Step 4: Evaluate** | Sonnet checks completeness, may re-decompose | Agent evaluates results, may call batch_llm_query again |
| **Step 5: Synthesize** | Sonnet aggregates worker results | Agent synthesizes in its response |

**Key differences**:
- **Workers**: Skill uses full Task agents (can use tools); platform uses simple prompt→response sub-calls via `batch_llm_query`. If workers need tool access, they should be SubAgents instead.
- **Context handling**: Skill reads files via Glob/Read; platform offloads to sandbox via `load_context_to_sandbox`.
- **Visibility**: Skill output appears in Claude Code terminal; platform streams via SSE to web UI.

The skill remains useful for Claude Code CLI users. The platform implementation serves the web application.

### 12.9 Dependencies and Prerequisites

| Dependency | Status | Required For |
|------------|--------|-------------|
| `deepagents >= 0.3.8` | Installed | Agent construction, SubAgent support |
| `langgraph >= 1.0.7` | Installed | Graph compilation, streaming, checkpointing |
| `langchain-daytona` | Installed | Sandbox backend for context storage |
| Feature #694 (SubAgent UI) | Merged (2026-01-24) | SubAgent message rendering in ToolTimeline |
| `rlms` package | **NOT needed** | Option D avoids this dependency entirely |
| Frontend changes | **NOT needed** (baseline) | Existing ToolTimeline renders all RLM steps |

### 12.10 Implementation Phases

| Phase | Scope | Effort | Deliverable |
|-------|-------|--------|-------------|
| **Phase 1** | `batch_llm_query` tool | 2-3 days | Parallel sub-LM calls with cost tracking |
| **Phase 2** | `load_context_to_sandbox` + `get_sandbox_variable` | 1-2 days | Context offloading to sandbox |
| **Phase 3** | System prompt engineering | 2-3 days | Agent knows when/how to decompose |
| **Phase 4** | Integration testing | 3-4 days | End-to-end tests with large inputs |
| **Phase 5** (optional) | Enhanced frontend rendering | 2-3 days | RLM-aware ToolTimelineItem |
| **Total** | | **1.5-2.5 weeks** | Full RLM capability in Orchestra |

---

*Architecture designed on 2026-02-16 as part of feature #793.*

---

## 13. Conclusion

This document provides the complete analysis for integrating RLM capabilities into Orchestra, covering:

- **Library analysis** ([docs/rlm-analysis.md](./rlm-analysis.md)) — Deep dive into the `rlms` library architecture, REPL environments, and prompt templates
- **Concept mapping** (Section 9 of rlm-analysis.md) — 13 RLM concepts mapped to Orchestra equivalents with gap analysis
- **Four integration options evaluated** (Sections 2-5) — Direct rlms, Native LangGraph, Hybrid, and Tool-Based, with streaming/UI analysis
- **Proof of concept** ([docs/rlm-benchmark-results.md](./rlm-benchmark-results.md)) — Real benchmark showing 2.5x latency / 7.4x cost overhead for rlms, confirming streaming gap
- **Production architecture** (Section 12) — Complete design for Option D including tool specs, streaming, UI, sandbox, cost tracking, and data flow

**The recommendation is Option D (Tool-Based / Agent-Driven RLM)** for the reasons summarized in the Executive Summary. This approach delivers RLM capabilities with full streaming, no external dependencies, ~2x cost overhead (vs rlms's 7.4x), and an implementation timeline of 1.5-2.5 weeks.

The existing `.claude/skills/rlm/SKILL.md` continues to serve Claude Code CLI users. The platform implementation extends the same supervisor-plus-parallel-workers pattern to the web application, where streaming and UI visibility are critical.

*Research and recommendation completed on 2026-02-16 as part of feature #793.*
