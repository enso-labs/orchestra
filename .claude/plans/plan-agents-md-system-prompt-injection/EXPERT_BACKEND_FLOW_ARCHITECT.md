# Backend Flow Architecture: AGENTS.md System Prompt Injection

## 1. Complete Data Flow: Request Entry to `create_deep_agent`

This section traces how data moves from the HTTP request through every layer until it reaches the LLM agent, with exact file paths and line numbers.

### 1.1 Entry Points

There are **four distinct code paths** that ultimately call `construct_agent`:

| Path | Entry File | Description |
|------|-----------|-------------|
| **Invoke** | `backend/src/routes/v0/llm.py:54` `llm_invoke()` | Synchronous invocation |
| **Stream (sync)** | `backend/src/routes/v0/llm.py:77` `llm_stream()` | Direct SSE streaming |
| **Stream (distributed)** | `backend/src/workers/tasks.py:26` `run_agent_stream()` | Worker-dispatched streaming |
| **Scheduled** | `backend/src/services/schedule.py:51` `scheduled_llm_invoke()` | APScheduler-triggered invocation |

### 1.2 Flow Diagram (Invoke Path)

```
HTTP POST /api/llm/invoke
  |
  v
llm_router (routes/v0/llm.py:54)
  - Parses LLMRequest from Body
  - Calls init_config(params, user_id) -> RunnableConfig
  - Creates LLMController(user_id, store, config)
  |
  v
LLMController.llm_invoke (controllers/llm.py:97)
  - Calls init_config(params, user_id) again [line 101] -- NOTE: redundant
  - Calls self.service_context.llm_service.assistant(params) [line 102]
    |
    v
  LLMService.assistant (services/llm.py:124)
    - Sets default thread_id if missing
    - Calls params.input.to_langchain_messages()
    - If no system_prompt, sets DEFAULT_SYSTEM_PROMPT [line 131-132]
    - If assistant_id provided:
        - Loads Assistant from store
        - Sets assistant.system_prompt via default_system_prompt()
        - Initializes tools
        - Returns assistant.to_llm_request(input, model, metadata) [line 159]
    - If no assistant_id:
        - Sets params.system_prompt via default_system_prompt()
        - Initializes tools
        - Returns params (LLMRequest) [line 172]
    |
    v
  Back in LLMController.llm_invoke:
  - Resolves user settings (model, api_key)
  - Calls construct_agent(
      instructions=params.instructions,       <-- FROM LLMRequest
      system_prompt=params.system_prompt,      <-- FROM LLMRequest
      model, tools, subagents, checkpointer, backend,
      service_context, api_key
    ) [line 109]
    |
    v
  construct_agent (agents/__init__.py:206)
    - If subagents, calls init_subagents()
    - Creates Orchestra(
        system_prompt=init_system_prompt(system_prompt, config, instructions),
        ...
      ) [line 223-237]
      |
      v
    init_system_prompt (utils/format.py:81)
      - Starts with system_prompt as base
      - If instructions: appends "---\nINSTRUCTIONS:\n{instructions}"
      - Appends "---" + metadata (LOCAL_TIME, CURRENT_UTC, TIMEZONE, LANGUAGE)
      - Returns final prompt string
      |
      v
    Orchestra.__init__ calls init_graph() [agents/__init__.py:266]
      |
      v
    init_graph (agents/__init__.py:59)
      - Creates LLM via init_chat_model(model, api_key)
      - Calls create_deep_agent(
          model=llm,
          system_prompt=system_prompt,  <-- The fully composed prompt
          tools, subagents, checkpointer, context_schema,
          middleware, store, cache, backend, debug
        ) [line 81]
```

### 1.3 Flow Diagram (Stream Path)

```
HTTP POST /api/llm/stream
  |
  v
llm_router (routes/v0/llm.py:77)
  - If DISTRIBUTED_WORKERS: enqueue run_agent_stream task -> return 202
  - Otherwise: creates LLMController, calls llm_stream(params)
  |
  v
LLMController.llm_stream (controllers/llm.py:136)
  - Calls self.service_context.llm_service.assistant(params) [line 137]
    (same assistant() method as invoke path)
  - Returns stream_generator(
      input=assistant.input,
      model=assistant.model,
      system_prompt=assistant.system_prompt,
      tools=assistant.tools,
      subagents=assistant.subagents,
      config=...,
      service_context=...,
      instructions=assistant.instructions,  <-- Passed through
      api_key=...
    ) [line 142]
  |
  v
stream_generator (utils/stream.py:183)
  - Resolves files_map from config["metadata"]["files"] or input.files
  - Calls construct_agent(
      instructions=instructions,
      system_prompt=system_prompt,
      ...
    ) [line 216]
  (Same construct_agent -> init_system_prompt -> init_graph -> create_deep_agent chain)
```

### 1.4 Flow Diagram (Distributed Worker Path)

```
TaskIQ Worker: run_agent_stream (workers/tasks.py:26)
  |
  v
_execute_agent_stream (workers/tasks.py:181)
  - Calls service_context.llm_service.assistant(params) [line 209]
    (same assistant() method)
  - Calls construct_agent(
      instructions=params.instructions,
      system_prompt=params.system_prompt,
      ...
    ) [line 228]
  (Same chain to create_deep_agent)
```

### 1.5 Flow Diagram (Scheduled Path)

```
APScheduler: scheduled_llm_invoke (services/schedule.py:51)
  |
  v
  - Reconstructs LLMRequest from dict
  - If DISTRIBUTED_WORKERS: dispatches to TaskIQ worker [line 69]
  - Otherwise:
    - Calls service_context.llm_service.assistant(params) [line 103]
    - Calls construct_agent(instructions=..., system_prompt=..., ...) [line 104]
  (Same chain)
```

### 1.6 Key Data Transformation Summary

```
LLMRequest.instructions (str | None)
  |
  v (via LLMService.assistant())
LLMRequest.instructions  -- unchanged if no assistant, or from Assistant.instructions via to_llm_request()
  |
  v (via construct_agent())
init_system_prompt(system_prompt, config, instructions)
  |
  v
Final composed string: "{system_prompt}\n---\nINSTRUCTIONS:\n{instructions}\n---\n{metadata}"
  |
  v (via Orchestra -> init_graph)
create_deep_agent(system_prompt=<composed string>)
```

---

## 2. Exact Injection Point

### 2.1 Primary Injection Point: `LLMService.assistant()`

**File:** `backend/src/services/llm.py`, method `assistant()` (line 124)

This is the **single canonical injection point** because:

1. **All four code paths** call `LLMService.assistant()` before calling `construct_agent()`:
   - Invoke path: `controllers/llm.py:102`
   - Stream path: `controllers/llm.py:137`
   - Distributed worker path: `workers/tasks.py:209`
   - Scheduled path: `services/schedule.py:103`

2. It is the method that already resolves assistant configuration, loads tools, and returns the final `LLMRequest` that all downstream code consumes.

3. Making the change here requires **zero changes** in `LLMController`, `stream_generator`, `_execute_agent_stream`, or `scheduled_llm_invoke`.

### 2.2 Where Exactly in `assistant()` to Insert Logic

There are **two sub-cases** inside `assistant()`:

#### Case A: Assistant Mode (assistant_id is provided, lines 135-163)

When an `Assistant` object is loaded from the store, its `files` dict is available as `assistant.files`.

**Injection location:** After the assistant is loaded and validated (after line 154 `assistant.system_prompt = self.default_system_prompt(assistant)`) but **before** `assistant.to_llm_request()` is called (line 159).

```python
# Current code (lines 154-163):
if assistant:
    assistant.system_prompt = self.default_system_prompt(assistant)
    assistant.tools = await self.init_tools(
        assistant.tools, assistant.a2a, assistant.mcp
    )
    return assistant.to_llm_request(
        input=params.input,
        model=params.model,
        metadata=params.metadata,
    )
```

**The AGENTS.md extraction should happen here:**

```python
if assistant:
    # --- AGENTS.md injection ---
    agents_md_content = self.extract_agents_md(assistant.files)
    if agents_md_content:
        assistant.instructions = None  # Clear first to avoid validator conflict
        assistant.system_prompt = None  # Let default_system_prompt apply later
        assistant.instructions = agents_md_content
    # --- end AGENTS.md injection ---

    assistant.system_prompt = self.default_system_prompt(assistant)
    ...
```

**IMPORTANT:** The order matters. We must set `instructions = None` first, then `system_prompt = None`, then assign the new `instructions`. This is because of the validator constraint (see Section 3).

#### Case B: Non-Agent Mode (no assistant_id, lines 169-172)

When no assistant is loaded, files come from `params.input.files`.

**Injection location:** Before the final `return params` on line 172.

```python
# Current code (lines 169-172):
### Collect all tools
params.system_prompt = self.default_system_prompt(params)
params.tools = await self.init_tools(params.tools, params.a2a, params.mcp)
return params
```

**The AGENTS.md extraction should happen here:**

```python
### AGENTS.md injection for non-agent mode
agents_md_content = self.extract_agents_md(params.input.files)
if agents_md_content:
    params.instructions = agents_md_content

### Collect all tools
params.system_prompt = self.default_system_prompt(params)
params.tools = await self.init_tools(params.tools, params.a2a, params.mcp)
return params
```

**Note:** `LLMRequest` does NOT have the `validate_system_prompt_or_instructions` validator that `Assistant` has. `LLMRequest.instructions` defaults to `""` (empty string, line 205 of `schemas/entities/llm.py`), and `LLMRequest.system_prompt` defaults to `DEFAULT_SYSTEM_PROMPT`. They can coexist because LLMRequest has no mutual exclusion validator.

### 2.3 Helper Method: `extract_agents_md()`

A new method on `LLMService` to encapsulate the extraction logic:

```python
@staticmethod
def extract_agents_md(files: dict | None) -> str | None:
    """Extract AGENTS.md content from a files dict.

    Handles multiple content formats:
    - str: used as-is
    - dict with "content" key: content value extracted
    - list: joined with newlines

    Returns None if AGENTS.md is not present or content is empty.
    """
    if not files or "AGENTS.md" not in files:
        return None

    raw = files["AGENTS.md"]

    if isinstance(raw, str):
        content = raw.strip()
    elif isinstance(raw, dict):
        content = str(raw.get("content", "")).strip()
    elif isinstance(raw, list):
        content = "\n".join(str(item) for item in raw).strip()
    else:
        content = str(raw).strip()

    return content if content else None
```

---

## 3. Assistant Model Validator Constraint

### 3.1 The Validator

**File:** `backend/src/schemas/entities/llm.py`, lines 103-108

```python
class Assistant(BaseModel):
    system_prompt: Optional[str] = Field(default=None, ...)
    instructions: Optional[str] = Field(default=None, ...)

    @model_validator(mode="after")
    def validate_system_prompt_or_instructions(self):
        if self.system_prompt and self.instructions:
            raise ValueError(
                "Only one of system_prompt or instructions may be set, not both."
            )
        return self
```

### 3.2 When the Validator Fires

The `mode="after"` validator fires **after** the model is fully constructed. It fires on:
- `Assistant(**data)` construction
- `Assistant.model_validate(data)` calls
- But **NOT** on direct attribute assignment (`assistant.instructions = "foo"`)

This is critical: since `_format_assistant()` in `AssistantService` constructs the `Assistant` via `Assistant(**item.dict()["value"])`, the validator fires during load. But once we have the `Assistant` object, we can freely reassign attributes without the validator re-firing.

### 3.3 How to Handle It

**Direct attribute assignment on the loaded `Assistant` object bypasses the model validator.** This is standard Pydantic V2 behavior for `mode="after"` validators -- they only fire during model construction, not on subsequent attribute mutations.

Therefore, the safe approach is:

```python
# The assistant is already constructed (validator already passed).
# Direct attribute assignment does NOT re-trigger the validator.
if agents_md_content:
    assistant.system_prompt = None
    assistant.instructions = agents_md_content
```

This works because:
1. The `Assistant` was already constructed by `_format_assistant()` with its original values (which passed validation).
2. After construction, setting attributes directly mutates the object without re-running `model_validator(mode="after")`.
3. By the time `to_llm_request()` is called, `system_prompt` is `None` and `instructions` has the AGENTS.md content.

**However**, there is a subtle issue: `assistant.system_prompt` might have already been set to `DEFAULT_SYSTEM_PROMPT` by `self.default_system_prompt(assistant)` on the line above. Looking at the current code flow:

```python
if assistant:
    assistant.system_prompt = self.default_system_prompt(assistant)  # line 155
    # ^ This sets system_prompt = DEFAULT_SYSTEM_PROMPT if it was None
```

If AGENTS.md extraction happens **before** `default_system_prompt()`, we set `system_prompt = None` and `instructions = content`. Then `default_system_prompt()` sees `system_prompt` is None and sets it to `DEFAULT_SYSTEM_PROMPT`. Now both fields are set, but since there is no validator re-check, this is fine at the Python level.

**But wait:** `to_llm_request()` passes BOTH `system_prompt` and `instructions` into the `LLMRequest`:

```python
def to_llm_request(self, input, model, metadata) -> LLMRequest:
    return LLMRequest(
        system_prompt=self.system_prompt,   # DEFAULT_SYSTEM_PROMPT
        instructions=self.instructions,      # AGENTS.md content
        ...
    )
```

`LLMRequest` has **no** mutual exclusion validator, so this works perfectly. The `LLMRequest` can hold both `system_prompt` (as the base prompt) and `instructions` (as AGENTS.md content), and they get composed together by `init_system_prompt()` in `construct_agent()`.

### 3.4 Recommended Order of Operations

```python
if assistant:
    # 1. Extract AGENTS.md before any prompt assignment
    agents_md_content = self.extract_agents_md(assistant.files)
    if agents_md_content:
        assistant.system_prompt = None       # Clear so default_system_prompt returns DEFAULT
        assistant.instructions = agents_md_content

    # 2. Apply default system prompt (fills in DEFAULT_SYSTEM_PROMPT if None)
    assistant.system_prompt = self.default_system_prompt(assistant)

    # 3. Initialize tools
    assistant.tools = await self.init_tools(...)

    # 4. Convert to LLMRequest (both system_prompt and instructions travel through)
    return assistant.to_llm_request(...)
```

---

## 4. Two Code Paths Analysis: Is One Injection Point Sufficient?

### 4.1 Invoke Path

```
llm_invoke -> LLMService.assistant(params) -> construct_agent(instructions=params.instructions, ...)
```

### 4.2 Stream Path

```
llm_stream -> LLMService.assistant(params) -> stream_generator(instructions=assistant.instructions, ...)
                                                  -> construct_agent(instructions=instructions, ...)
```

### 4.3 Distributed Worker Path

```
_execute_agent_stream -> LLMService.assistant(params) -> construct_agent(instructions=params.instructions, ...)
```

### 4.4 Scheduled Path

```
scheduled_llm_invoke -> LLMService.assistant(params) -> construct_agent(instructions=params.instructions, ...)
```

### 4.5 Conclusion: YES, One Injection Point Is Sufficient

**All four paths converge on `LLMService.assistant()`** before diverging to their respective `construct_agent()` calls. Since `assistant()` returns the fully-resolved `LLMRequest` (or `LLMRequest` constructed from `Assistant.to_llm_request()`), the `instructions` field is already set by the time each path reads it.

No changes are needed in:
- `LLMController.llm_invoke()` -- already reads `params.instructions` from the return of `assistant()`
- `LLMController.llm_stream()` -- already reads `assistant.instructions` from the return of `assistant()`
- `stream_generator()` -- already receives `instructions` as a parameter
- `_execute_agent_stream()` -- already reads `params.instructions` from the return of `assistant()`
- `scheduled_llm_invoke()` -- already reads `params.instructions` from the return of `assistant()`
- `construct_agent()` -- already composes `init_system_prompt(system_prompt, config, instructions)`
- `init_system_prompt()` -- already handles the `instructions` parameter

---

## 5. Thread-Level Files (Non-Agent Mode)

### 5.1 Where Files Come From

In non-agent mode (no `assistant_id`), files arrive in the request body as `params.input.files`:

**Schema:** `LLMInput.files` in `backend/src/schemas/entities/llm.py:56`
```python
class LLMInput(BaseModel):
    messages: List[ChatMessage]
    files: Optional[Dict[str, Any]] = Field(default_factory=dict)
```

### 5.2 Where to Check

In `LLMService.assistant()`, when the code reaches the non-assistant branch (lines 169-172), `params.input.files` is available:

```python
# This branch executes when no assistant_id is provided
params.system_prompt = self.default_system_prompt(params)
params.tools = await self.init_tools(params.tools, params.a2a, params.mcp)
return params
```

The extraction should happen **before** `default_system_prompt()`:

```python
# Extract AGENTS.md from thread-level files
agents_md_content = self.extract_agents_md(params.input.files)
if agents_md_content:
    params.instructions = agents_md_content

params.system_prompt = self.default_system_prompt(params)
params.tools = await self.init_tools(params.tools, params.a2a, params.mcp)
return params
```

### 5.3 File Format Handling

Thread-level files can have various formats because the `files` field is `Dict[str, Any]`:

| Format | Example | Handling |
|--------|---------|----------|
| String | `{"AGENTS.md": "# Instructions\n..."}` | Use directly |
| Dict with content | `{"AGENTS.md": {"content": "# Instructions\n..."}}` | Extract `.content` |
| List | `{"AGENTS.md": ["line1", "line2"]}` | Join with `\n` |

The `extract_agents_md()` static method handles all three formats.

### 5.4 `LLMRequest` vs `Assistant` Validator Difference

**Critical distinction:** `LLMRequest` does NOT have the mutual exclusion validator. It has:
- `system_prompt: Optional[str] = Field(default=DEFAULT_SYSTEM_PROMPT, exclude=True)` (line 204)
- `instructions: Optional[str] = Field(default="", exclude=True)` (line 205)

Both can coexist on `LLMRequest`. This means for thread-level injection, we simply set `params.instructions` and the existing `params.system_prompt` remains. `init_system_prompt()` will compose them together.

---

## 6. Risks and Edge Cases

### 6.1 Empty AGENTS.md Content

**Risk:** An `AGENTS.md` key exists in files but its content is `""`, `None`, or whitespace-only.

**Mitigation:** The `extract_agents_md()` method calls `.strip()` on the content and returns `None` if the result is falsy. The caller only overrides `instructions` when the return value is truthy.

### 6.2 Missing AGENTS.md Key

**Risk:** No `AGENTS.md` key in the files dict.

**Mitigation:** `extract_agents_md()` checks `"AGENTS.md" not in files` and returns `None`. No override happens. Existing `instructions`/`system_prompt` fields are used unchanged (backwards compatibility).

### 6.3 Very Large AGENTS.md Content

**Risk:** A user creates an AGENTS.md with tens of thousands of tokens, consuming most or all of the model's context window.

**Mitigation considerations:**
- Currently, there is no size limit on `instructions` or `system_prompt` anywhere in the codebase.
- The PRD explicitly states "No AGENTS.md validation or linting" as a non-goal.
- **Recommendation:** Add a warning log if content exceeds a threshold (e.g., 10,000 characters), but do not block. This matches the existing behavior for `instructions`.

### 6.4 AGENTS.md Overriding Explicitly Set Instructions

**Risk:** An assistant has BOTH an `instructions` field set AND an `AGENTS.md` in its files. The PRD says AGENTS.md takes precedence.

**Mitigation:** The extraction logic checks for AGENTS.md first and overrides `instructions` if found. The PRD acceptance criteria (FR-3) explicitly states: "AGENTS.md takes precedence over existing instructions/system_prompt fields when present."

### 6.5 Case Sensitivity of the Key

**Risk:** Users might create `agents.md`, `Agents.md`, or `AGENTS.MD`.

**Mitigation:** The PRD specifies `"AGENTS.md"` as the key. Recommend a case-insensitive lookup to be robust:

```python
def extract_agents_md(files: dict | None) -> str | None:
    if not files:
        return None
    # Case-insensitive key lookup
    for key in files:
        if key.lower() == "agents.md":
            raw = files[key]
            # ... extraction logic
```

However, the PRD only specifies `"AGENTS.md"`, so strict matching is the safer choice for v1.

### 6.6 Distributed Worker Serialization

**Risk:** In the distributed worker path, `params` is serialized via `params.model_dump()` and then reconstructed as `LLMRequest(**task_dict)`. The `instructions` field has `exclude=True`, which means it is **excluded from serialization**.

**Analysis of `LLMRequest` fields (lines 204-205):**
```python
system_prompt: Optional[str] = Field(default=DEFAULT_SYSTEM_PROMPT, exclude=True)
instructions: Optional[str] = Field(default="", exclude=True)
```

Both `system_prompt` and `instructions` have `exclude=True`. This means `params.model_dump()` does NOT include them. When the worker reconstructs `LLMRequest(**task_dict)`, these fields get their **default values**.

**But this is not a problem because:**
1. In the distributed path, `llm_stream()` in the route handler calls `run_agent_stream.kiq(task_dict=params.model_dump(), ...)` -- at this point, `LLMService.assistant()` has NOT been called yet.
2. The worker's `_execute_agent_stream()` calls `service_context.llm_service.assistant(params)` which re-resolves the assistant, re-loads files, and re-extracts AGENTS.md.
3. So the AGENTS.md extraction happens inside the worker, not before serialization.

**Verification:** Looking at `routes/v0/llm.py:107`:
```python
await run_agent_stream.kiq(
    task_dict=params.model_dump(),  # Serializes BEFORE assistant() is called
    ...
)
```

And `workers/tasks.py:209`:
```python
params = await service_context.llm_service.assistant(params)  # Re-resolves
```

This confirms the design is safe: the worker always re-resolves via `assistant()`.

### 6.7 Scheduled Job Serialization

**Same pattern:** `ScheduleService.create_job()` stores `job.task.model_dump()` (line 218 in schedule.py). The `scheduled_llm_invoke()` function reconstructs `LLMRequest(**task_dict)` and then calls `service_context.llm_service.assistant(params)`. Same safe pattern as distributed workers.

### 6.8 `default_system_prompt()` Interaction

**Current behavior of `default_system_prompt()` (services/llm.py:119):**

```python
def default_system_prompt(self, item: LLMRequest | Assistant) -> str:
    if not item.system_prompt:
        return DEFAULT_SYSTEM_PROMPT
    return item.system_prompt
```

When we set `assistant.system_prompt = None` (for AGENTS.md injection), `default_system_prompt()` returns `DEFAULT_SYSTEM_PROMPT`. This is the desired behavior per the PRD: "The final system prompt is: DEFAULT_SYSTEM_PROMPT + --- + INSTRUCTIONS:\n{AGENTS.md content} + --- + metadata."

### 6.9 `to_llm_request()` Preserves Both Fields

**`Assistant.to_llm_request()` (schemas/entities/llm.py:143):**

```python
def to_llm_request(self, input, model, metadata) -> LLMRequest:
    return LLMRequest(
        system_prompt=self.system_prompt,    # DEFAULT_SYSTEM_PROMPT (after default_system_prompt())
        instructions=self.instructions,       # AGENTS.md content
        ...
    )
```

Both values travel through to the `LLMRequest`, which then passes them to `construct_agent()`.

### 6.10 Race Condition: Concurrent File Updates

**Risk:** If a user updates AGENTS.md in the file panel while a request is being processed, the agent might pick up stale or partially-written content.

**Mitigation:** This is inherent to the eventual consistency model. The `assistant.files` dict is read at request time from the store. Any updates made after the read will take effect on the next request. This matches how all other assistant fields work.

---

## 7. Summary of Required Changes

### 7.1 Files to Modify

| File | Change |
|------|--------|
| `backend/src/services/llm.py` | Add `extract_agents_md()` static method; Add AGENTS.md extraction logic in both branches of `assistant()` |

### 7.2 Files That Require NO Changes

| File | Reason |
|------|--------|
| `backend/src/routes/v0/llm.py` | Does not process instructions; just passes LLMRequest |
| `backend/src/controllers/llm.py` | Reads `instructions` from the return of `assistant()`; already passes it through |
| `backend/src/utils/stream.py` | Receives `instructions` as parameter; already passes it to `construct_agent()` |
| `backend/src/agents/__init__.py` | `construct_agent()` and `init_system_prompt()` already handle `instructions` |
| `backend/src/utils/format.py` | `init_system_prompt()` already composes the final prompt with instructions |
| `backend/src/schemas/entities/llm.py` | No schema changes needed; `Assistant.files` already supports `Dict[str, str]` |
| `backend/src/workers/tasks.py` | Calls `assistant()` which handles extraction; no changes needed |
| `backend/src/services/schedule.py` | Calls `assistant()` which handles extraction; no changes needed |

### 7.3 Pseudocode for the Full Change

```python
# In LLMService (services/llm.py):

@staticmethod
def extract_agents_md(files: dict | None) -> str | None:
    """Extract AGENTS.md content from a files dict."""
    if not files or "AGENTS.md" not in files:
        return None

    raw = files["AGENTS.md"]

    if isinstance(raw, str):
        content = raw.strip()
    elif isinstance(raw, dict):
        content = str(raw.get("content", "")).strip()
    elif isinstance(raw, list):
        content = "\n".join(str(item) for item in raw).strip()
    else:
        content = str(raw).strip()

    return content if content else None


async def assistant(self, params: LLMRequest) -> LLMRequest:
    params.metadata.thread_id = params.metadata.thread_id or str(uuid4())
    params.input.to_langchain_messages()

    if not params.system_prompt:
        params.system_prompt = DEFAULT_SYSTEM_PROMPT

    if params.metadata.assistant_id:
        assistant = ... # (existing assistant loading logic)

        if assistant:
            # --- AGENTS.md injection (agent mode) ---
            agents_md = self.extract_agents_md(assistant.files)
            if agents_md:
                assistant.system_prompt = None
                assistant.instructions = agents_md
            # ---

            assistant.system_prompt = self.default_system_prompt(assistant)
            assistant.tools = await self.init_tools(...)
            return assistant.to_llm_request(...)

    # --- AGENTS.md injection (non-agent/thread mode) ---
    agents_md = self.extract_agents_md(params.input.files)
    if agents_md:
        params.instructions = agents_md
    # ---

    params.system_prompt = self.default_system_prompt(params)
    params.tools = await self.init_tools(...)
    return params
```

---

## 8. Verification Checklist

- [ ] AGENTS.md in `assistant.files` -> extracted as `instructions`, `system_prompt` set to `None` (default applies)
- [ ] AGENTS.md in `params.input.files` (non-agent mode) -> extracted as `instructions`
- [ ] No AGENTS.md in files -> existing `instructions`/`system_prompt` used unchanged
- [ ] Empty AGENTS.md content -> ignored, no empty instructions injected
- [ ] AGENTS.md as string -> used as-is
- [ ] AGENTS.md as dict with "content" key -> content extracted
- [ ] AGENTS.md as list -> joined with newlines
- [ ] All four code paths (invoke, stream, distributed, scheduled) converge on `assistant()`
- [ ] `Assistant` model validator not triggered by direct attribute assignment
- [ ] `LLMRequest` has no mutual exclusion validator (both fields can coexist)
- [ ] Distributed worker: AGENTS.md extracted inside worker (after deserialization), not before serialization
- [ ] Scheduled job: same safe pattern as distributed worker
- [ ] Final prompt composition: `DEFAULT_SYSTEM_PROMPT + "---" + "INSTRUCTIONS:\n{AGENTS.md}" + "---" + metadata`
- [ ] All existing tests pass with no behavioral change for agents without AGENTS.md
