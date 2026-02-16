# RLM Integration: Options Evaluation

> Evaluation of integration approaches for bringing Recursive Language Model (RLM) capabilities into the Orchestra platform.
> Depends on: [RLM Architecture Analysis](./rlm-analysis.md)

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

*Evaluation performed on 2026-02-16 as part of feature #793.*
