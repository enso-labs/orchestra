# Expert Analysis: Example Notebook Audit & Update Plan

**Author:** AGENT (EXAMPLE_NOTEBOOK_ARCHITECT)
**Issue:** #734
**Date:** 2026-02-04

---

## 1. Current Notebook Audit

### 1.1 `deep_agent_backend.ipynb` (3 cells)

**Purpose:** Demonstrates `StateBackend` usage with pre-populated files and filesystem tool invocation.

**What it does well:**
- Shows `StateBackend` creation from a `ToolRuntime`
- Demonstrates `create_file_data()` for pre-populating virtual files
- Shows streaming with `stream_mode=["values"]`
- Clean env-loading pattern (`~/.env/orchestra/.env.backend`)

**Issues found:**

| Issue | Severity | Details |
|-------|----------|---------|
| Manual `ToolRuntime` construction | HIGH | Cell 2 manually creates a `ToolRuntime` with `state`, `context`, `tool_call_id`, `store`, `stream_writer`, `config` -- this is internal API that users should not need to touch. The `backend` param on `create_deep_agent` accepts a `BackendFactory` or `BackendProtocol`, not a raw runtime. |
| Missing `checkpointer` | MEDIUM | No checkpointer is configured, yet `config={"configurable": {"thread_id": "openai"}}` is passed. A `MemorySaver` or equivalent should be shown for state persistence. |
| No `name` parameter | LOW | Agent is not named, making it harder to identify in logs/traces. |
| No `system_prompt` | LOW | No system prompt is set; agent relies on defaults. |
| Imports `ToolRuntime` from `langchain.tools` | HIGH | This import (`from langchain.tools import ToolRuntime`) is an internal detail. Examples should show the user-facing API only. |
| Does not demonstrate `StoreBackend` or `FilesystemBackend` | MEDIUM | Title says "backend" but only shows `StateBackend`. |
| No markdown cells | HIGH | Zero explanatory text -- just raw code cells with no context for readers. |
| Commented-out import | LOW | `# from deepagents.middleware.filesystem import FilesystemMiddleware` is left as dead code. |

**Verdict:** Needs significant rewrite. The core pattern of pre-populating files is valuable but the implementation uses internal APIs.

---

### 1.2 `stream_subagent_updates.ipynb` (3 cells)

**Purpose:** Demonstrates SubAgent creation and streaming of subagent tool calls/updates.

**What it does well:**
- Shows `SubAgent` construction with `name`, `description`, `model`, `tools`, `system_prompt`
- Demonstrates multi-stream-mode streaming (`stream_mode=["messages", "updates"]`)
- Shows `subgraphs=True` for cross-subagraph visibility
- Includes helper functions for rendering message chunks and completed messages
- Shows agent name tracking via `metadata.get("lc_agent_name")`

**Issues found:**

| Issue | Severity | Details |
|-------|----------|---------|
| No `name` param on root agent | LOW | Root agent created without `name="orchestrator"` or similar. |
| No `response_format` | LOW | Does not demonstrate structured output. |
| Installs many unused providers | LOW | Installs `langchain-anthropic`, `langchain-google-genai`, `langchain-groq`, `langchain-xai` but only uses `openai`. |
| Commented-out `xai:grok-4` | LOW | Dead code: `# model="xai:grok-4"`. |
| No markdown cells | HIGH | No explanatory text. Reader has no idea what the notebook demonstrates without reading all code. |
| Does not show SubAgent with `middleware` | MEDIUM | The API supports per-subagent middleware but this is not demonstrated. |
| Missing `interrupt_on` | MEDIUM | No HITL example despite this being a key feature of the subagent workflow. |
| `InMemorySaver` used without explanation | LOW | The checkpointer is imported and used but not explained. |

**Verdict:** Solid subagent example. Needs markdown documentation cells and should expand to show more SubAgent features (middleware, model override patterns).

---

### 1.3 `RLM.ipynb` (8 cells: cells 0-7)

**Purpose:** Implements a Recursive Language Model pattern for long-context document analysis across three progressively more sophisticated versions.

**What it does well:**
- **V1 (cell 2):** Shows `langchain.agents.create_agent` (not `create_deep_agent`) with custom tools (`peek`, `find_regex`, `context_info`, `subcall`)
- **V2 (cell 3):** Refactors into a reusable `RLMAgent` class with factory methods (`from_url`, `from_file`, `from_text`), uses `create_deep_agent` for both root and sub agents
- **V3 (cell 5):** Full custom LangGraph implementation with `StateGraph`, explicit state management, conditional edges, `ToolNode`
- **V4 (cell 7):** Pure LangGraph implementation without `create_deep_agent`, demonstrating manual REPL-style execution with `exec()`

**Issues found:**

| Issue | Severity | Details |
|-------|----------|---------|
| V1 uses `create_agent` not `create_deep_agent` | HIGH | `from langchain.agents import create_agent` -- this is the basic agent, not the deep agent. Inconsistent with the notebook's stated purpose. |
| V2 uses `create_deep_agent` without `system_prompt` param | MEDIUM | System message is passed via `messages` list instead of using the `system_prompt` parameter. |
| V2 uses `create_deep_agent` without `name` | LOW | Agents not named. |
| V3/V4 do NOT use `create_deep_agent` at all | HIGH | These are raw LangGraph implementations. While educational, they don't demonstrate the `deepagents` API. |
| V4 uses `exec()` | HIGH | Dangerous pattern (`exec(last_message, {}, local_env)`). Contains warning comment but still risky for an example notebook. |
| V4 reads from `paper.txt` | MEDIUM | Hardcoded file path `paper.txt` that won't exist for users. |
| No `skills` or `memory` usage | MEDIUM | None of the versions use the `skills` or `memory` parameters. |
| No `backend` usage | MEDIUM | None of the versions use any backend (StateBackend, StoreBackend, FilesystemBackend). |
| No markdown cells | HIGH | Eight code cells with no explanatory markdown. Massive notebook with no navigation. |
| Extremely long cells | HIGH | Cell 3 (V2) and Cell 5 (V3) are each 300+ lines of code in a single cell. |
| Outputs embedded in notebook | MEDIUM | Large output blocks from previous runs bloat the notebook file. |

**Verdict:** This is more of a research playground than an example notebook. V2 is the most relevant to `create_deep_agent()` but needs significant cleanup. V3/V4 are custom LangGraph implementations that belong in a separate "advanced patterns" notebook.

---

## 2. Feature Coverage Matrix

| Feature | API Parameter | `deep_agent_backend` | `stream_subagent_updates` | `RLM` (V2) | Coverage |
|---------|--------------|---------------------|--------------------------|-------------|----------|
| Model configuration | `model` | `init_chat_model(model="openai:gpt-4.1-mini")` | `"openai:gpt-4.1-mini"` (string) | `ChatOpenAI(model=...)` (object) | PARTIAL -- shows object and string, but not `"provider:model"` string format consistently |
| System prompt | `system_prompt` | Not used | `"You are a helpful assistant."` | Not used (passed via messages) | PARTIAL -- only one notebook uses it |
| Tools | `tools` | Not used directly | `[get_weather]` | `[peek, find_regex, ...]` | GOOD |
| Skills | `skills` | Not used | Not used | Not used | **MISSING** |
| Memory (AGENTS.md) | `memory` | Not used | Not used | Not used | **MISSING** |
| Backend (State) | `backend` (StateBackend) | Yes | Not used | Not used | PARTIAL |
| Backend (Store) | `backend` (StoreBackend) | Not used | Not used | Not used | **MISSING** |
| Backend (Filesystem) | `backend` (FilesystemBackend) | Not used | Not used | Not used | **MISSING** |
| Interrupts (HITL) | `interrupt_on` | Not used | Not used | Not used | **MISSING** |
| SubAgents | `subagents` | Not used | Yes | Not used | PARTIAL |
| SubAgent middleware | SubAgent `middleware` | Not used | Not used | Not used | **MISSING** |
| SubAgent model override | SubAgent `model` | Not used | Yes | Not used | PARTIAL |
| Response format | `response_format` | Not used | Not used | Not used | **MISSING** |
| Name | `name` | Not used | Not used | Not used | **MISSING** |
| Middleware | `middleware` | Not used | Not used | Not used | **MISSING** |
| Checkpointer | `checkpointer` | Not used | `InMemorySaver()` | Not used | PARTIAL |
| Store | `store` | Not used | Not used | Not used | **MISSING** |
| Cache | `cache` | Not used | Not used | Not used | **MISSING** |
| Context schema | `context_schema` | Not used | Not used | Not used | **MISSING** |
| Debug mode | `debug` | Not used | Not used | Not used | **MISSING** |
| Streaming patterns | N/A | `stream_mode=["values"]` | `stream_mode=["messages", "updates"]` | `stream_mode="values"` | GOOD |

**Summary:** 7 of 18 features have zero coverage. Only 3 features have reasonable coverage (tools, model, streaming).

---

## 3. Proposed New/Updated Notebooks

### 3.1 Updated: `deep_agent_backend.ipynb` -- "Backend Options & File Management"

**Purpose:** Demonstrate all three backend types and how they manage files.

**Key cells outline:**

| Cell # | Type | Content |
|--------|------|---------|
| 1 | markdown | Title, purpose, prerequisites |
| 2 | code | Install dependencies |
| 3 | code | Load environment variables |
| 4 | markdown | "Section 1: StateBackend (in-memory files)" |
| 5 | code | Create agent with `StateBackend`, pre-populate files, invoke, show file listing |
| 6 | markdown | "Section 2: StoreBackend (persistent store)" |
| 7 | code | Create agent with `StoreBackend` + `InMemoryStore`, demonstrate file persistence across invocations |
| 8 | markdown | "Section 3: FilesystemBackend (disk-based)" |
| 9 | code | Create agent with `FilesystemBackend`, show real disk writes, demonstrate `interrupt_on` for write approval |
| 10 | markdown | "Section 4: CompositeBackend (route-based)" |
| 11 | code | Show `CompositeBackend` with route-based backend selection (as used in Orchestra production code) |
| 12 | markdown | Summary and next steps |

---

### 3.2 Updated: `stream_subagent_updates.ipynb` -- "SubAgents & Streaming"

**Purpose:** Demonstrate SubAgent configuration, delegation, and streaming patterns.

**Key cells outline:**

| Cell # | Type | Content |
|--------|------|---------|
| 1 | markdown | Title, purpose, prerequisites |
| 2 | code | Install dependencies (only `deepagents langchain-openai python-dotenv`) |
| 3 | code | Load environment variables |
| 4 | markdown | "Section 1: Basic SubAgent" |
| 5 | code | Create a SubAgent with `name`, `description`, `model`, `tools`, `system_prompt`; invoke via root agent |
| 6 | markdown | "Section 2: SubAgent with Model Override" |
| 7 | code | Show SubAgent using a different model than root (e.g., root=`gpt-4.1`, subagent=`gpt-4.1-mini`) |
| 8 | markdown | "Section 3: SubAgent with Middleware" |
| 9 | code | Demonstrate per-subagent middleware |
| 10 | markdown | "Section 4: Streaming Patterns" |
| 11 | code | Stream with `["messages", "updates"]` and `subgraphs=True`, with rendering helpers |
| 12 | markdown | Summary |

---

### 3.3 Updated: `RLM.ipynb` -- "RLM Pattern with DeepAgents"

**Purpose:** Demonstrate the Recursive Language Model pattern using `create_deep_agent()` exclusively.

**Recommendation:** Strip V1 (uses `create_agent`), V3, and V4 (raw LangGraph). Keep only V2 (which uses `create_deep_agent`) and clean it up significantly.

**Key cells outline:**

| Cell # | Type | Content |
|--------|------|---------|
| 1 | markdown | Title: "Recursive Language Model (RLM) Pattern", explanation of the RLM concept, link to the original blog post |
| 2 | code | Install dependencies |
| 3 | code | Load env |
| 4 | markdown | "Step 1: Fetch document context" |
| 5 | code | URL fetcher function, load blog post |
| 6 | markdown | "Step 2: Define analysis tools" |
| 7 | code | Define `peek`, `find_regex`, `context_info` tools |
| 8 | markdown | "Step 3: Create RLM agents" |
| 9 | code | Create sub-agent and root agent using `create_deep_agent()` with `name`, `system_prompt`, `tools` |
| 10 | markdown | "Step 4: Run analysis" |
| 11 | code | Invoke with a sample query, stream results |
| 12 | markdown | "Step 5: Reusable RLMAgent class" (optional advanced section) |
| 13 | code | Clean version of the `RLMAgent` class using `create_deep_agent()` |

---

### 3.4 NEW: `skills_and_memory.ipynb` -- "Skills & Memory (AGENTS.md)"

**Purpose:** Demonstrate `skills` and `memory` parameters -- two features with zero coverage.

**Key cells outline:**

| Cell # | Type | Content |
|--------|------|---------|
| 1 | markdown | Title, explanation of skills vs memory, when to use each |
| 2 | code | Install + env setup |
| 3 | markdown | "Section 1: Memory with AGENTS.md" |
| 4 | code | Create an `AGENTS.md` file on disk, then `create_deep_agent(memory=["./AGENTS.md"])`, invoke and show the agent references the memory content |
| 5 | markdown | "Section 2: Skills for Progressive Disclosure" |
| 6 | code | Create a skills directory with skill files, then `create_deep_agent(skills=["./skills/"])`, show skill loading on demand |
| 7 | markdown | "Section 3: Combined Skills + Memory" |
| 8 | code | Agent with both `memory` and `skills` configured |
| 9 | markdown | Summary: how Orchestra uses these in production |

---

### 3.5 NEW: `structured_output.ipynb` -- "Response Format & Structured Output"

**Purpose:** Demonstrate `response_format` parameter for typed agent responses.

**Key cells outline:**

| Cell # | Type | Content |
|--------|------|---------|
| 1 | markdown | Title, explanation of structured output use cases |
| 2 | code | Install + env setup |
| 3 | markdown | "Section 1: Basic Structured Output" |
| 4 | code | Define a Pydantic model, pass as `response_format`, invoke agent, parse typed response |
| 5 | markdown | "Section 2: Structured Output with Tools" |
| 6 | code | Agent with tools AND response_format -- show that tools execute first, then structured output is returned |
| 7 | markdown | Summary |

---

### 3.6 NEW: `human_in_the_loop.ipynb` -- "Interrupts & Human-in-the-Loop"

**Purpose:** Demonstrate `interrupt_on` parameter for file operation approval workflows.

**Key cells outline:**

| Cell # | Type | Content |
|--------|------|---------|
| 1 | markdown | Title, explanation of HITL pattern and when to use interrupts |
| 2 | code | Install + env setup |
| 3 | markdown | "Section 1: Basic Interrupt on File Write" |
| 4 | code | Create agent with `interrupt_on={"write_file": True}`, `FilesystemBackend`, and `MemorySaver` checkpointer; invoke and show the interrupt |
| 5 | markdown | "Section 2: Approving or Rejecting" |
| 6 | code | Resume execution after approval; show rejection path |
| 7 | markdown | "Section 3: Selective Interrupts" |
| 8 | code | `interrupt_on={"write_file": True, "read_file": False}` -- show selective approval |
| 9 | markdown | Summary |

---

## 4. Update Recommendations (Prioritized)

### Priority 1 -- Critical (Missing features, broken patterns)

1. **Add markdown documentation cells to ALL notebooks.** Every notebook currently has zero markdown cells. This is the single most impactful improvement for developer education. Each notebook needs a title cell, section headers, and brief explanations between code cells.

2. **Create `skills_and_memory.ipynb`.** The `skills` and `memory` parameters are distinctive features of `create_deep_agent()` with zero coverage. These are also the features most directly referenced in the issue (#734 -- update based on deepagents customization docs).

3. **Create `human_in_the_loop.ipynb`.** The `interrupt_on` parameter is a key differentiator for `create_deep_agent()` vs `create_agent()`. Zero coverage.

4. **Rewrite `deep_agent_backend.ipynb` to remove internal API usage.** The current notebook imports `ToolRuntime`, `InMemoryStore`, and manually constructs internal objects. This teaches users patterns they should not follow.

### Priority 2 -- Important (Incomplete coverage)

5. **Create `structured_output.ipynb`.** The `response_format` parameter has zero coverage and is increasingly important for production agent workflows.

6. **Clean up `RLM.ipynb`.** Remove V1 (wrong API), V3, V4 (raw LangGraph, not deepagents). Keep V2 only. Add markdown cells. Split monolithic 300+ line cells into focused sections.

7. **Update `stream_subagent_updates.ipynb`.** Add `name` param to root agent, remove unused package installs, add SubAgent middleware example.

### Priority 3 -- Nice-to-have (Polish)

8. **Add `name` param to all agent examples.** Simple one-line addition that improves traceability.

9. **Show `debug=True` in at least one notebook.** Useful for development, zero current coverage.

10. **Clear stale outputs from all notebooks.** `RLM.ipynb` in particular has massive embedded outputs that bloat the file.

11. **Standardize `pip install` lines.** Remove unused packages (e.g., `langchain-anthropic`, `langchain-groq`, `langchain-xai` from `stream_subagent_updates.ipynb`).

---

## 5. Notebook Template Pattern

All example notebooks should follow this standardized structure:

```
Cell 1 [markdown]:  # Title & Overview
                    Brief description of what this notebook demonstrates.
                    List of features covered.
                    Prerequisites.

Cell 2 [code]:      # Install Dependencies
                    !uv pip install -q deepagents langchain-openai python-dotenv

Cell 3 [code]:      # Load Environment
                    from pathlib import Path
                    from dotenv import load_dotenv
                    env_path = Path.home() / ".env" / "orchestra" / ".env.backend"
                    load_dotenv(env_path)

Cell 4 [markdown]:  # Section 1: [Feature Name]
                    Explanation of the feature, when to use it, key concepts.

Cell 5 [code]:      # Feature demonstration code
                    from deepagents import create_deep_agent
                    agent = create_deep_agent(
                        model="openai:gpt-4.1-mini",
                        name="example-agent",
                        system_prompt="...",
                        ...feature-specific params...
                    )

Cell 6 [code]:      # Invocation / streaming
                    result = agent.invoke(...)

Cell N-1 [markdown]: # Summary
                     What was demonstrated, links to further reading.

Cell N [markdown]:   # Next Steps
                     Links to other example notebooks for related features.
```

### Naming conventions:
- File names: `snake_case.ipynb` (e.g., `skills_and_memory.ipynb`)
- Markdown titles: Use `#` for notebook title, `##` for sections
- Code comments: Use `# ---` separators between logical blocks within a cell
- Agent names: Use descriptive kebab-case (e.g., `name="weather-orchestrator"`)

### Import ordering:
```python
# Standard library
import os
from pathlib import Path

# Third-party
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage
from langgraph.checkpoint.memory import InMemorySaver

# DeepAgents
from deepagents import create_deep_agent, SubAgent
from deepagents.backends.state import StateBackend
```

### Principles:
1. **One concept per section.** Each markdown + code cell pair teaches one thing.
2. **No internal APIs.** Only import from `deepagents` public API and `langchain`/`langgraph` stable APIs.
3. **Runnable end-to-end.** Every notebook should run top-to-bottom without modification (given env setup).
4. **Minimal dependencies.** Only install what the notebook actually uses.
5. **Clear outputs.** Notebooks should be committed with outputs cleared (or with minimal representative outputs).
6. **Cross-references.** Each notebook's summary section should link to related notebooks.

---

## 6. Proposed Final Notebook Set (Minimal Complete Coverage)

| # | Notebook | Features Covered | Status |
|---|----------|-----------------|--------|
| 1 | `deep_agent_backend.ipynb` | `backend` (State, Store, Filesystem, Composite), `interrupt_on`, `checkpointer`, `store` | REWRITE |
| 2 | `stream_subagent_updates.ipynb` | `subagents`, `SubAgent.middleware`, `SubAgent.model`, streaming patterns, `name` | UPDATE |
| 3 | `RLM.ipynb` | `tools`, `model`, `system_prompt`, `name`, custom tool patterns | MAJOR UPDATE |
| 4 | `skills_and_memory.ipynb` | `skills`, `memory`, `name` | **NEW** |
| 5 | `structured_output.ipynb` | `response_format`, `name` | **NEW** |
| 6 | `human_in_the_loop.ipynb` | `interrupt_on`, `backend` (FilesystemBackend), `checkpointer` | **NEW** |

This set of 6 notebooks covers all 18 features from the API signature with no gaps.

**Note on `human_in_the_loop.ipynb` vs merging into `deep_agent_backend.ipynb`:** The interrupt/HITL workflow is complex enough to warrant its own notebook. However, if notebook count is a concern, the HITL content could be folded into the backend notebook as a final section. The tradeoff is notebook length vs. discoverability.
