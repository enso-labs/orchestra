# Synthesis: AGENTS.md System Prompt Injection

## Executive Summary

Three expert analyses have been completed for the AGENTS.md system prompt injection feature. All three experts independently converge on the same core architectural conclusion: **a single injection point in `LLMService.assistant()` at `/home/ryaneggz/ruska-ai/orchestra/backend/src/services/llm.py` is sufficient to cover all production code paths**. The only file requiring modification is `backend/src/services/llm.py`. No schema changes are needed. No changes to controllers, routes, workers, or schedulers are required.

**Overall Assessment:** The expert analyses are thorough, internally consistent, and agree on all major decisions. Two minor discrepancies and one code-level bug were identified during cross-validation (detailed below). The feature is ready for implementation with high confidence.

---

## 1. Agreed-Upon Decisions (Unanimous Across All Experts)

### 1.1 Single Injection Point

All three experts confirm that `LLMService.assistant()` (line 124 of `backend/src/services/llm.py`) is the single correct injection point.

**Verified against source code:** Lines 102, 137, 209, and 103 of the controller, worker, and schedule files respectively all call `service_context.llm_service.assistant(params)` before calling `construct_agent()`. This was confirmed by reading the actual source files during this synthesis.

### 1.2 Only File to Modify

`backend/src/services/llm.py` -- unanimous. No other backend files require changes.

### 1.3 Two Sub-Cases Within `assistant()`

| Sub-Case | File Source | Type Signature | Injection Target |
|----------|------------|---------------|-----------------|
| **Agent mode** (assistant_id provided) | `assistant.files` | `Dict[str, str]` | `assistant.instructions` |
| **Non-agent mode** (no assistant_id) | `params.input.files` | `Dict[str, Any]` | `params.instructions` |

All experts agree on this two-branch structure.

### 1.4 No Schema Changes Required

All experts confirm that existing Pydantic models (`Assistant`, `LLMRequest`, `LLMInput`) already have the necessary fields. The `Assistant.files` field (`Dict[str, str]`) already supports storing AGENTS.md content. The `LLMRequest.instructions` field already carries instructions downstream to `construct_agent()`.

### 1.5 Pydantic Validator Safety

All experts agree that the `Assistant.validate_system_prompt_or_instructions` model validator (`mode="after"`) only fires during model construction (`__init__` / `model_validate`), NOT on direct attribute assignment. Setting `assistant.system_prompt = None` and `assistant.instructions = content` on an already-constructed `Assistant` instance is safe.

**Verified:** This is standard Pydantic V2 behavior for `mode="after"` validators.

### 1.6 No Double Injection Risk

All experts independently traced all four production paths and confirmed that `instructions` flows from `LLMService.assistant()` through to `construct_agent()` exactly once in every path. The Integration Worker expert additionally verified there is no secondary extraction point in `construct_agent()`, `init_system_prompt()`, or `init_config()`.

### 1.7 All Production Paths Covered

| Path | Entry Point | Calls `LLMService.assistant()`? | Verified |
|------|-------------|--------------------------------|----------|
| Invoke | `LLMController.llm_invoke()` at `controllers/llm.py:102` | YES | Confirmed in source |
| Stream (sync) | `LLMController.llm_stream()` at `controllers/llm.py:137` | YES | Confirmed in source |
| Stream (distributed) | `_execute_agent_stream()` at `workers/tasks.py:209` | YES | Confirmed in source |
| Scheduled (in-process) | `scheduled_llm_invoke()` at `services/schedule.py:103` | YES | Confirmed in source |
| Scheduled (distributed) | Delegates to TaskIQ worker | YES (via worker path) | Confirmed in source |

Two additional `init_graph()` calls exist in `thread.py` (lines 456 and 521) for interrupt/resume operations. These are administrative-only (no agent execution, no system prompt) and are correctly excluded by the Integration Worker expert.

### 1.8 AGENTS.md Precedence

All experts agree: when AGENTS.md is present, it overrides the existing `instructions` field. In agent mode, agent-level AGENTS.md takes precedence. In non-agent mode, thread-level AGENTS.md from `params.input.files` takes precedence.

### 1.9 Distributed Worker Serialization Safety

The Backend Flow expert and Integration Worker expert both independently confirmed that `LLMRequest.instructions` has `exclude=True`, meaning it is dropped during `model_dump()` serialization. This is not a problem because the worker calls `LLMService.assistant(params)` after deserialization, which re-resolves the assistant and re-extracts AGENTS.md content inside the worker process. The same pattern applies to scheduled jobs.

---

## 2. Discrepancies and Reconciliation

### 2.1 Helper Function Location

| Expert | Proposed Location |
|--------|------------------|
| Backend Flow Architect | Static method on `LLMService` class (`extract_agents_md()`) |
| File Schema Expert | Separate utility file at `backend/src/utils/files.py` (new file) |
| Integration Worker Expert | No specific recommendation (defers to other experts) |

**Reconciliation:** The Backend Flow Architect's approach is preferred. Placing `extract_agents_md()` as a `@staticmethod` on `LLMService` keeps the change to a single file, reduces import complexity, and aligns with the goal of minimal modification footprint. Creating a new `utils/files.py` adds unnecessary file-level surface area for what is a single focused function. If AGENTS.md extraction is later needed elsewhere, it can be refactored into a utility module at that time.

**Decision:** `@staticmethod` on `LLMService`.

### 2.2 Helper Function Complexity

| Expert | Approach |
|--------|----------|
| Backend Flow Architect | Single function `extract_agents_md(files)` that handles key lookup (exact match `"AGENTS.md"`) and content extraction in one pass |
| File Schema Expert | Two functions: `find_agents_md_key(files)` for key lookup (with case-insensitive fallback and path normalization) + `extract_file_content(value)` for content extraction |

**Reconciliation:** For v1, the Backend Flow Architect's simpler single-function approach is preferred. The exact key match `"AGENTS.md"` is sufficient because:

1. Agent-level files (`assistant.files`) are `Dict[str, str]` where keys are set by the frontend's `toBackendFormat()`, which preserves exact user input.
2. The PRD specifies `"AGENTS.md"` as the key.
3. Case-insensitive and path-normalized lookups add complexity that can be deferred to a future iteration if users report issues.

However, the File Schema expert's insight about the `Dict[str, Any]` type for thread-level files is critical -- the content extraction logic MUST handle the dict-with-content-as-list format that the frontend produces (see Section 3.1 below).

**Decision:** Single function, exact key match, but with the File Schema expert's more thorough content extraction logic for handling `{"content": ["line1", "line2"]}` from the frontend.

### 2.3 Code Bug in EXPERT_FILE_SCHEMA.md

The `extract_file_content()` function on line 226 of the File Schema expert's analysis contains a bug:

```python
# Line 226 -- BUG: references 'content' instead of 'file_value'
if isinstance(content, list):  # <-- should be isinstance(file_value, list)
```

This is a typo where `content` (a variable from the dict-handling block above) is referenced instead of `file_value`. The Backend Flow Architect's version of the function handles this correctly with `isinstance(raw, list)`.

**Decision:** Use the Backend Flow Architect's function structure but incorporate the File Schema expert's more detailed dict handling (especially the `content` as `list[str]` case from the frontend `FileData` interface).

---

## 3. Cross-Cutting Concerns Identified During Synthesis

### 3.1 Frontend FileData Format (Critical -- Missed by Backend Flow Architect)

The File Schema expert identified that when the frontend sends thread-level files, user-created files retain their `FileData` structure:

```typescript
interface FileData {
    content: string[];     // Array of lines, NOT a single string
    created_at: string;
    modified_at: string;
    source?: string;
}
```

This means thread-level files can arrive as `{"AGENTS.md": {"content": ["# Line 1", "Be helpful"], "created_at": "..."}}`. The Backend Flow Architect's `extract_agents_md()` handles `dict` values by checking `raw.get("content", "")` and calling `str()` on it, but if `content` is a `list`, `str()` would produce `"['# Line 1', 'Be helpful']"` instead of joining lines.

**Resolution:** The content extraction must explicitly check if the `content` value within a dict is a list, and join with newlines in that case. The merged function should be:

```python
@staticmethod
def extract_agents_md(files: dict | None) -> str | None:
    """Extract AGENTS.md content from a files dict.

    Handles multiple content formats:
    - str: used as-is
    - dict with "content" key (content as str or list[str])
    - list: joined with newlines
    """
    if not files or "AGENTS.md" not in files:
        return None

    raw = files["AGENTS.md"]

    if isinstance(raw, str):
        content = raw.strip()
    elif isinstance(raw, dict):
        inner = raw.get("content")
        if inner is None:
            return None
        if isinstance(inner, list):
            content = "\n".join(str(line) for line in inner).strip()
        else:
            content = str(inner).strip()
    elif isinstance(raw, list):
        content = "\n".join(str(item) for item in raw).strip()
    else:
        content = str(raw).strip()

    return content if content else None
```

### 3.2 Order of Operations (Clarification)

The Backend Flow Architect initially proposed setting `assistant.instructions = None` then `assistant.system_prompt = None` then reassigning `instructions`. In the later pseudocode (Section 3.4 and Section 7.3), this was simplified to:

```python
if agents_md_content:
    assistant.system_prompt = None
    assistant.instructions = agents_md_content
```

**Clarification:** The simpler version is correct. Since direct attribute assignment does NOT re-trigger the Pydantic validator, the order of setting `system_prompt = None` and `instructions = content` does not matter at the Python level. Setting `system_prompt = None` first is a clean approach because:

1. It ensures `default_system_prompt(assistant)` returns `DEFAULT_SYSTEM_PROMPT` on the next line.
2. The resulting `LLMRequest` (via `to_llm_request()`) carries both `system_prompt=DEFAULT_SYSTEM_PROMPT` and `instructions=<AGENTS.md content>`.
3. `init_system_prompt()` composes them into the final prompt string.

### 3.3 `to_llm_request()` Does Not Forward Files

The File Schema expert correctly noted that `Assistant.to_llm_request()` does NOT forward `assistant.files` into the `LLMRequest`. This is why AGENTS.md extraction MUST happen before `to_llm_request()` is called -- the content must flow through `assistant.instructions`, not through the files map.

This was implicitly assumed by the other experts but is an important constraint to document.

### 3.4 Logging for Observability

The Backend Flow Architect recommended a warning log for very large AGENTS.md content (over 10,000 characters). This is a good practice for production observability. Additionally, an info-level log when AGENTS.md injection occurs would aid debugging:

```python
if agents_md_content:
    logger.info(f"Injecting AGENTS.md content ({len(agents_md_content)} chars) as instructions")
    assistant.system_prompt = None
    assistant.instructions = agents_md_content
```

---

## 4. Open Questions and Risks

### 4.1 Existing `instructions` Field on Assistant (Low Risk)

When an assistant has both an `instructions` field set AND an `AGENTS.md` in its files, the AGENTS.md content overwrites `instructions`. The PRD mandates this (FR-3). However, this is a silent override -- the user may not realize their explicit `instructions` are being ignored.

**Recommendation:** Log a warning when overriding existing instructions:

```python
if agents_md_content:
    if assistant.instructions:
        logger.warning(
            f"AGENTS.md overriding existing instructions for assistant {assistant.id}"
        )
    assistant.system_prompt = None
    assistant.instructions = agents_md_content
```

### 4.2 `default_system_prompt()` Interaction When Assistant Has `system_prompt` Set (Low Risk)

When AGENTS.md is found, the code sets `assistant.system_prompt = None` so that `default_system_prompt()` returns `DEFAULT_SYSTEM_PROMPT`. This means any custom `system_prompt` on the assistant is discarded in favor of the default + AGENTS.md pattern.

This is the intended behavior per the PRD but should be clearly documented. If a user sets both a custom `system_prompt` and includes AGENTS.md, the custom prompt is replaced by the default.

### 4.3 `instructions` and `system_prompt` Both Having `exclude=True` on LLMRequest (No Risk)

Both fields on `LLMRequest` have `exclude=True`, which means they are excluded from `model_dump()`. This affects serialization for distributed workers and scheduled jobs. As confirmed by all experts, the worker and schedule paths call `LLMService.assistant()` after deserialization, so the AGENTS.md extraction happens fresh inside the worker process.

**No action needed** -- this is safe by design.

### 4.4 Race Condition: Concurrent File Updates (Accepted Risk)

If a user updates AGENTS.md while a request is in-flight, the agent may use stale content. This matches the eventual consistency model already used for all other assistant fields.

**No action needed.**

### 4.5 Context Window Consumption (Accepted Risk)

Very large AGENTS.md content could consume significant context window. The PRD explicitly states "No AGENTS.md validation or linting" is a non-goal.

**Recommendation:** Log a warning for content exceeding 10,000 characters but do not block.

---

## 5. Implementation Checklist

This is the ordered list of implementation steps, synthesized from all three expert analyses.

### Step 1: Add `extract_agents_md()` Static Method

**File:** `/home/ryaneggz/ruska-ai/orchestra/backend/src/services/llm.py`

Add a `@staticmethod` method to the `LLMService` class that:
- Takes `files: dict | None` as input
- Checks for exact key `"AGENTS.md"` in the files dict
- Handles content as: plain string, dict with `content` key (where content can be `str` or `list[str]`), or list
- Returns `str | None` (stripped content or None if empty/missing)

### Step 2: Add AGENTS.md Injection in Agent Mode (assistant_id present)

**File:** `/home/ryaneggz/ruska-ai/orchestra/backend/src/services/llm.py`
**Location:** Inside `assistant()`, after the assistant is loaded and before `default_system_prompt()` is called (between current lines 153 and 154)

Logic:
```
1. Call extract_agents_md(assistant.files)
2. If content found:
   a. Log info with content length
   b. If assistant.instructions was already set, log warning about override
   c. Set assistant.system_prompt = None
   d. Set assistant.instructions = content
3. Proceed with existing default_system_prompt() and to_llm_request() calls
```

### Step 3: Add AGENTS.md Injection in Non-Agent Mode (no assistant_id)

**File:** `/home/ryaneggz/ruska-ai/orchestra/backend/src/services/llm.py`
**Location:** Inside `assistant()`, before `default_system_prompt()` is called in the non-agent branch (before current line 170)

Logic:
```
1. Call extract_agents_md(params.input.files)
2. If content found:
   a. Log info with content length
   b. Set params.instructions = content
3. Proceed with existing default_system_prompt() and init_tools() calls
```

### Step 4: Write Unit Tests

**File:** `/home/ryaneggz/ruska-ai/orchestra/backend/tests/unit/services/test_llm_service.py` (new file)

Test cases:
1. Agent mode: assistant with `AGENTS.md` in files -- instructions set, system_prompt becomes default
2. Agent mode: assistant without `AGENTS.md` -- existing instructions/system_prompt unchanged
3. Agent mode: assistant with `AGENTS.md` AND existing instructions -- AGENTS.md wins, warning logged
4. Non-agent mode: `AGENTS.md` in `params.input.files` -- instructions set
5. Non-agent mode: no `AGENTS.md` -- no change
6. Edge case: empty AGENTS.md content (empty string, whitespace-only) -- no injection
7. Edge case: AGENTS.md as dict with content as list of strings -- joined with newlines
8. Edge case: AGENTS.md as dict with content as string -- used directly
9. Edge case: AGENTS.md key present but value is None -- no injection
10. Edge case: files dict is None -- no injection

Use `pytest` with `@pytest.mark.asyncio`. Mock `AssistantService.get()` to return controlled `Assistant` objects. Follow existing test patterns from `test_assistant_service.py` and `test_schedule_dispatch.py`.

### Step 5: Run Existing Tests

Verify all existing tests pass with no behavioral change:

```bash
cd /home/ryaneggz/ruska-ai/orchestra/backend && make test
```

### Step 6: Format Code

```bash
cd /home/ryaneggz/ruska-ai/orchestra/backend && make format
```

---

## 6. Final Pseudocode (Merged from All Experts)

This is the definitive implementation specification, reconciling all three expert outputs:

```python
# In LLMService class (backend/src/services/llm.py):

@staticmethod
def extract_agents_md(files: dict | None) -> str | None:
    """Extract AGENTS.md content from a files dict.

    Handles multiple content formats:
    - str: used as-is (from assistant.files Dict[str, str])
    - dict with "content" key: content extracted
      - content as str: used as-is
      - content as list[str]: joined with newlines (from frontend FileData)
    - list: joined with newlines

    Returns None if AGENTS.md is not present or content is empty.
    """
    if not files or "AGENTS.md" not in files:
        return None

    raw = files["AGENTS.md"]

    if isinstance(raw, str):
        content = raw.strip()
    elif isinstance(raw, dict):
        inner = raw.get("content")
        if inner is None:
            return None
        if isinstance(inner, list):
            content = "\n".join(str(line) for line in inner).strip()
        else:
            content = str(inner).strip()
    elif isinstance(raw, list):
        content = "\n".join(str(item) for item in raw).strip()
    else:
        content = str(raw).strip()

    return content if content else None


async def assistant(self, params: LLMRequest) -> LLMRequest:
    params.metadata.thread_id = params.metadata.thread_id or str(uuid4())
    params.input.to_langchain_messages()

    ## Protection if not defined
    if not params.system_prompt:
        params.system_prompt = DEFAULT_SYSTEM_PROMPT

    ## Auto Assign Assistant if ID is provided
    if params.metadata.assistant_id:
        assistant: Assistant | None = None
        if self.user_id:
            assistant = await self.assistant_service.get(
                params.metadata.assistant_id
            )

        if not assistant:
            assistant = await self.assistant_service.get_public(
                params.metadata.assistant_id
            )
            if assistant:
                logger.info(
                    f"Loading public assistant {params.metadata.assistant_id} "
                    f"for user {self.user_id or 'anonymous'}"
                )

        if assistant:
            # --- AGENTS.md injection (agent mode) ---
            agents_md = self.extract_agents_md(assistant.files)
            if agents_md:
                if assistant.instructions:
                    logger.warning(
                        f"AGENTS.md overriding existing instructions "
                        f"for assistant {assistant.id}"
                    )
                logger.info(
                    f"Injecting AGENTS.md ({len(agents_md)} chars) as instructions"
                )
                assistant.system_prompt = None
                assistant.instructions = agents_md
            # --- end AGENTS.md injection ---

            assistant.system_prompt = self.default_system_prompt(assistant)
            assistant.tools = await self.init_tools(
                assistant.tools, assistant.a2a, assistant.mcp
            )
            return assistant.to_llm_request(
                input=params.input,
                model=params.model,
                metadata=params.metadata,
            )
        else:
            logger.warning(
                f"Assistant {params.metadata.assistant_id} not found "
                f"in user or public namespace"
            )

    # --- AGENTS.md injection (non-agent/thread mode) ---
    agents_md = self.extract_agents_md(params.input.files)
    if agents_md:
        logger.info(
            f"Injecting AGENTS.md ({len(agents_md)} chars) as instructions "
            f"(thread mode)"
        )
        params.instructions = agents_md
    # --- end AGENTS.md injection ---

    ### Collect all tools
    params.system_prompt = self.default_system_prompt(params)
    params.tools = await self.init_tools(params.tools, params.a2a, params.mcp)
    return params
```

---

## 7. Final Prompt Composition (End-to-End)

For clarity, here is how the final system prompt is assembled after AGENTS.md injection:

```
{DEFAULT_SYSTEM_PROMPT}
---
INSTRUCTIONS:
{AGENTS.md content}
---
LOCAL_TIME: {local_time}
CURRENT_UTC: {utc_time}
TIMEZONE: {timezone}
LANGUAGE: {language}
```

This composition is handled by the existing `init_system_prompt()` function in `/home/ryaneggz/ruska-ai/orchestra/backend/src/utils/format.py` (line 81). No changes to this function are needed -- it already appends `INSTRUCTIONS:\n{instructions}` when the `instructions` parameter is truthy.

---

## 8. Files Referenced

| File | Role | Changes Required |
|------|------|-----------------|
| `/home/ryaneggz/ruska-ai/orchestra/backend/src/services/llm.py` | Injection point | YES -- add `extract_agents_md()` and injection logic in `assistant()` |
| `/home/ryaneggz/ruska-ai/orchestra/backend/src/schemas/entities/llm.py` | Schema definitions | NO |
| `/home/ryaneggz/ruska-ai/orchestra/backend/src/utils/format.py` | Prompt composition | NO |
| `/home/ryaneggz/ruska-ai/orchestra/backend/src/controllers/llm.py` | Controller layer | NO |
| `/home/ryaneggz/ruska-ai/orchestra/backend/src/routes/v0/llm.py` | Route layer | NO |
| `/home/ryaneggz/ruska-ai/orchestra/backend/src/utils/stream.py` | Streaming layer | NO |
| `/home/ryaneggz/ruska-ai/orchestra/backend/src/workers/tasks.py` | Worker layer | NO |
| `/home/ryaneggz/ruska-ai/orchestra/backend/src/services/schedule.py` | Schedule layer | NO |
| `/home/ryaneggz/ruska-ai/orchestra/backend/src/agents/__init__.py` | Agent construction | NO |
| `/home/ryaneggz/ruska-ai/orchestra/backend/src/routes/v0/thread.py` | Thread routes (interrupt/resume) | NO (administrative only) |
| `/home/ryaneggz/ruska-ai/orchestra/backend/tests/unit/services/test_llm_service.py` | Unit tests | YES -- new file |

---

## 9. Completeness Matrix

| Requirement | Status | Covered By |
|-------------|--------|------------|
| Single injection point identified | COMPLETE | All 3 experts agree |
| All production code paths verified | COMPLETE | Integration Worker verified 6 paths (4 production + 2 administrative) |
| Agent-mode injection logic specified | COMPLETE | Backend Flow + File Schema |
| Non-agent mode injection logic specified | COMPLETE | Backend Flow + File Schema |
| Pydantic validator safety confirmed | COMPLETE | Backend Flow + File Schema |
| No double injection risk | COMPLETE | Integration Worker verified all 4 paths |
| Content format handling (str, dict, list) | COMPLETE | File Schema (primary), Backend Flow (secondary) |
| Frontend FileData format handled | COMPLETE | File Schema identified dict-with-list-content format |
| Distributed worker serialization safe | COMPLETE | Backend Flow + Integration Worker |
| Scheduled job serialization safe | COMPLETE | Backend Flow + Integration Worker |
| Precedence rules defined | COMPLETE | File Schema (primary) |
| No schema changes needed | COMPLETE | All 3 experts agree |
| Test pattern recommendations | COMPLETE | Integration Worker |
| Edge cases documented | COMPLETE | Backend Flow (primary), File Schema (secondary) |
| Pseudocode for implementation | COMPLETE | Backend Flow (primary), reconciled in this synthesis |

**Result: 15 of 15 requirements fully covered.**

---

## 10. Verdict

**READY FOR IMPLEMENTATION.** All expert analyses are consistent, all production code paths are verified, and a clear implementation plan with merged pseudocode is provided. The single-file change approach (`backend/src/services/llm.py`) minimizes risk and maximizes testability. The only file to create is the new test file.
