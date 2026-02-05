# Expert Analysis: Integration & Worker Path for AGENTS.md System Prompt Injection

## 1. All Code Paths to `construct_agent` / `init_graph`

There are **six** code paths that lead to `construct_agent()` or `init_graph()`. Four use `construct_agent()` (which internally creates an `Orchestra`, which calls `init_graph()`), and two call `init_graph()` directly.

### Paths through `construct_agent()`

| # | Entry Point | File | Calls `LLMService.assistant()`? | Notes |
|---|-------------|------|---------------------------------|-------|
| 1 | `LLMController.llm_invoke()` | `backend/src/controllers/llm.py:97-130` | YES (line 102) | Sync invoke path. Calls `self.service_context.llm_service.assistant(params)` then `construct_agent()` at line 109. |
| 2 | `LLMController.llm_stream()` | `backend/src/controllers/llm.py:136-152` | YES (line 137) | Sync streaming path. Calls `self.service_context.llm_service.assistant(params)`, then delegates to `stream_generator()` which calls `construct_agent()` at line 216 of `stream.py`. |
| 3 | `_execute_agent_stream()` (distributed worker) | `backend/src/workers/tasks.py:181-343` | YES (line 209) | Distributed worker path. Calls `service_context.llm_service.assistant(params)` then `construct_agent()` at line 228. |
| 4 | `scheduled_llm_invoke()` (in-process mode) | `backend/src/services/schedule.py:51-158` | YES (line 103) | Schedule path (when `DISTRIBUTED_WORKERS=false`). Calls `service_context.llm_service.assistant(params)` then `construct_agent()` at line 104. |

### Paths through `init_graph()` directly (no `construct_agent`)

| # | Entry Point | File | Calls `LLMService.assistant()`? | Notes |
|---|-------------|------|---------------------------------|-------|
| 5 | Thread interrupt endpoint | `backend/src/routes/v0/thread.py:456` | NO | Creates a minimal graph with empty tools, no system prompt, no instructions. Used only to query checkpoint interrupt state. |
| 6 | Thread resume endpoint | `backend/src/routes/v0/thread.py:521` | NO | Same as #5 -- minimal graph for checkpoint state interaction. |

### Summary

**All four production agent-construction paths (1-4) go through `LLMService.assistant()` before calling `construct_agent()`.** Paths 5-6 are structural/administrative (querying checkpoint state) and do not involve agent execution or system prompt construction, so they are irrelevant to AGENTS.md injection.

---

## 2. Distributed Worker Path Analysis

### Flow

```
llm_stream route (llm.py:100-118)
  --> run_agent_stream.kiq(task_dict, user_id, thread_id)     [enqueue to TaskIQ]
      --> run_agent_stream(task_dict, user_id, thread_id)       [worker picks up]
          --> params = LLMRequest(**task_dict)                    [reconstruct]
          --> config = init_config(params, user_id)               [build config]
          --> _execute_agent_stream(params, config, ...)          [execute]
              --> params = await service_context.llm_service.assistant(params)   [LINE 209]
              --> agent = await construct_agent(instructions=params.instructions, ...)
```

### Key finding: YES, the worker path calls `LLMService.assistant(params)` at line 209 of `tasks.py`.

The `_execute_agent_stream` helper (line 181-343 of `tasks.py`) explicitly calls:
```python
params = await service_context.llm_service.assistant(params)
```

This means: **If AGENTS.md injection is done inside `LLMService.assistant()`, the distributed worker path is automatically covered.** No additional changes are needed in `tasks.py` or `_execute_agent_stream`.

### Data flow in worker path

1. The route serializes `params.model_dump()` as `task_dict` (line 108 of `llm.py`)
2. The worker deserializes via `LLMRequest(**task_dict)` (line 90 of `tasks.py`)
3. `init_config()` is called, which copies `params.input.files` into `config["configurable"]["files"]` (line 183 of `__init__.py`)
4. `service_context.llm_service.assistant(params)` processes the params (line 209)
5. `construct_agent()` receives `params.instructions` (line 229)

The `files` data survives serialization/deserialization because `LLMInput.files` is a `Dict[str, Any]` field on the Pydantic model, which serializes cleanly via `model_dump()` and deserializes via `LLMRequest(**task_dict)`.

---

## 3. Schedule Service Path Analysis

### Flow when `DISTRIBUTED_WORKERS=true`

```
scheduled_llm_invoke(task_dict, user_id, title)
  --> run_agent_stream.kiq(task_dict, user_id, thread_id)
      --> [same worker path as above, covered by LLMService.assistant()]
```

When `DISTRIBUTED_WORKERS=true`, the schedule service delegates to the TaskIQ worker, which calls `LLMService.assistant()`. **Covered automatically.**

### Flow when `DISTRIBUTED_WORKERS=false` (in-process)

```
scheduled_llm_invoke(task_dict, user_id, title)   [schedule.py:51]
  --> params = LLMRequest(**task_dict)              [line 85]
  --> config = init_config(params, user_id)         [line 91]
  --> service_context.llm_service.assistant(params) [line 103]
  --> construct_agent(instructions=params.instructions, ...)  [line 104]
```

**Also covered.** The in-process schedule path at line 103 explicitly calls `service_context.llm_service.assistant(params)` before `construct_agent()`.

### Conclusion

**The schedule service does NOT need any additional AGENTS.md injection logic.** Both its distributed and in-process modes flow through `LLMService.assistant()`.

---

## 4. Config vs Metadata Files: Canonical Source at Each Stage

The `files` map appears in multiple locations during the request lifecycle. Here is the definitive mapping:

### Stage 1: API Request Arrival

- **Location:** `params.input.files` (from `LLMInput.files`)
- **Type:** `Optional[Dict[str, Any]]`, defaults to `{}` via validator
- **Source:** Client sends files in request body under `input.files`

### Stage 2: `init_config()` (in `backend/src/agents/__init__.py:159-188`)

```python
RunnableConfig(
    configurable={
        "files": params.input.files or {},   # <-- copied here
    },
    metadata=metadata,                        # <-- metadata dict from params.metadata.model_dump()
)
```

- `config["configurable"]["files"]` = copy of `params.input.files`
- `config["metadata"]` = flattened dict from `params.metadata` (does NOT contain files unless metadata has extra fields)

### Stage 3: Worker task (`tasks.py`)

```python
files_map = config["configurable"].get("files", {})   # line 98
```

The worker extracts `files_map` from `config["configurable"]["files"]`.

### Stage 4: `stream_generator()` (sync path, `stream.py`)

```python
files_map = config["metadata"].get("files", {}) or input.files or {}   # line 194
```

The sync streaming path first checks `config["metadata"]["files"]`, then falls back to `input.files`.

### Stage 5: Schedule service (in-process, `schedule.py`)

```python
files_map = config["metadata"].get("files", {})   # line 92
```

Schedule in-process path checks `config["metadata"]["files"]`.

### Canonical Source for AGENTS.md Injection

**The canonical source for AGENTS.md injection should be `params.input.files`** because:

1. This is the original, untransformed source from the API request
2. `LLMService.assistant()` receives the full `params: LLMRequest` object, which contains `params.input.files`
3. For the assistant (agent) path, the assistant's files are on the `Assistant` model as `assistant.files`, which gets mapped via `to_llm_request()` -- however, these are the assistant-level files, not the thread-level files
4. Both `config["configurable"]["files"]` and `config["metadata"]["files"]` are derived from `params.input.files` at different stages

### Two injection sources per the PRD

Per the PRD (FR-1, FR-5), there are two distinct file sources for AGENTS.md:

| Source | Where it lives | When it applies |
|--------|---------------|-----------------|
| **Agent files** | `assistant.files["AGENTS.md"]` | When an assistant is loaded (assistant_id is set) |
| **Thread files** | `params.input.files["AGENTS.md"]` | Default mode (no agent), files from the file panel |

Both checks happen inside `LLMService.assistant()`:
- Agent files: Check happens after loading the assistant from the store
- Thread files: Check happens on the raw `params` when no assistant is loaded

---

## 5. Existing Test Patterns

### Test Framework and Structure

- **Framework:** pytest with `pytest-asyncio` for async tests
- **Test location:** `backend/tests/unit/` for unit tests, `backend/tests/integration/` for integration tests
- **Fixtures:** Defined in `backend/tests/conftest.py`
- **Mocking:** `unittest.mock` (`AsyncMock`, `patch`, `MagicMock`)
- **External API mocking:** `respx` library for HTTP endpoint mocking (autouse fixture `mock_external_services`)

### Key Fixtures Available

| Fixture | Description |
|---------|-------------|
| `test_store` | `TestInMemoryStore` (wraps `InMemoryStore` with `.fields` attribute) |
| `fake_redis` | `fakeredis.aioredis.FakeRedis` for Redis stream tests |
| `sample_llm_request_dict` | Sample serialized LLMRequest dict |
| `sample_config_dict` | Sample RunnableConfig dict |
| `async_client` | FastAPI test client with store/db overrides |

### Relevant Test File Patterns

**`test_llm_controller.py`** (unit, pure schema tests):
- Tests LLMRequest schema fields directly
- No mocking of services; imports `LLMRequest` and validates field behavior
- Pattern: `class TestLLMRequestFileGeneration` with individual test methods

**`test_schedule_dispatch.py`** (unit, mocked integration):
- Uses `@patch` decorators to mock `DISTRIBUTED_WORKERS`, `run_agent_stream`
- Tests dispatch logic without full environment
- Pattern: Fixture provides `task_dict_*`, tests verify mock calls

**`test_schedule_service.py`** (unit, mocked integration):
- Similar pattern to dispatch tests
- Uses `_patch_distributed()` and `_patch_taskiq()` helpers

**`test_assistant_service.py`** (unit, async):
- Uses `unittest.IsolatedAsyncioTestCase`
- Sets up `InMemoryStore` and `AssistantService` in `asyncSetUp`
- Tests CRUD operations directly against the service

**`test_tasks.py`** (unit):
- Tests task registration and Redis stream operations
- Uses `fake_redis` fixture for stream verification

### Recommended Test Pattern for AGENTS.md

Based on the codebase patterns, the tests for `LLMService.assistant()` AGENTS.md injection should:

1. Use `pytest` with `@pytest.mark.asyncio`
2. Create `LLMService` with `InMemoryStore` and mock dependencies
3. Mock `AssistantService.get()` to return controlled `Assistant` objects
4. Test four scenarios:
   - Agent with `AGENTS.md` in `assistant.files` -> instructions set
   - Agent without `AGENTS.md` -> existing instructions/system_prompt unchanged
   - Thread-level `AGENTS.md` in `params.input.files` (no agent) -> instructions set
   - Thread-level without `AGENTS.md` -> no change
5. Test edge cases: empty AGENTS.md content, dict format `{"content": "..."}`, list format

File should be: `backend/tests/unit/services/test_llm_service.py`

---

## 6. Risk: Double Injection

### Can instructions be injected twice?

The injection chain is:

```
LLMService.assistant()          <-- proposed AGENTS.md extraction point
  sets params.instructions = <AGENTS.md content>

construct_agent()               <-- receives instructions=params.instructions
  calls init_system_prompt(system_prompt, config, instructions)

init_system_prompt()            <-- appends "INSTRUCTIONS:\n{instructions}" to prompt
```

### Analysis of each path

#### Path 1: `LLMController.llm_invoke()` (controllers/llm.py)
```python
params = await self.service_context.llm_service.assistant(params)   # line 102
# ... then:
agent = await construct_agent(
    instructions=params.instructions,  # line 110
    ...
)
```
- `LLMService.assistant()` sets `params.instructions`
- `construct_agent()` receives `params.instructions`
- **No double injection risk.** Single extraction point.

#### Path 2: `LLMController.llm_stream()` (controllers/llm.py)
```python
assistant = await self.service_context.llm_service.assistant(params)  # line 137
return stream_generator(
    instructions=assistant.instructions,  # line 150
    ...
)
```
Then in `stream_generator()` (stream.py):
```python
agent = await construct_agent(
    instructions=instructions,  # line 217
    ...
)
```
- `LLMService.assistant()` sets `assistant.instructions`
- `stream_generator` receives `instructions=assistant.instructions`
- `construct_agent` receives the same `instructions`
- **No double injection risk.** Single extraction, passed through.

#### Path 3: `_execute_agent_stream()` (workers/tasks.py)
```python
params = await service_context.llm_service.assistant(params)  # line 209
agent = await construct_agent(
    instructions=params.instructions,  # line 229
    ...
)
```
- **No double injection risk.** Same pattern as Path 1.

#### Path 4: `scheduled_llm_invoke()` in-process (schedule.py)
```python
params = await service_context.llm_service.assistant(params)  # line 103
agent = await construct_agent(
    instructions=params.instructions,  # line 105
    ...
)
```
- **No double injection risk.** Same pattern.

### Where double injection COULD happen (to avoid)

If injection is added in BOTH:
1. `LLMService.assistant()` (proposed location)
2. AND somewhere else like `construct_agent()`, `init_system_prompt()`, or `init_config()`

Then instructions would be appended twice. **The PRD correctly identifies `LLMService.assistant()` as the single injection point** (FR-11, Technical Considerations section).

### Guard against double injection

The implementation should:
1. Only extract AGENTS.md in `LLMService.assistant()` -- nowhere else
2. When AGENTS.md is found, set `instructions` and set `system_prompt = None` (so the default is used)
3. This is safe because `init_system_prompt()` only appends instructions if they are truthy (line 86 of `format.py`: `if instructions:`)

### Edge case: Assistant with both `instructions` and AGENTS.md

The `Assistant` model has a validator (`validate_system_prompt_or_instructions`) that prevents BOTH `system_prompt` and `instructions` from being set simultaneously. However, if AGENTS.md extraction happens AFTER the assistant is loaded from the store and the assistant already has `instructions` set, the extraction would overwrite `instructions` with the AGENTS.md content. Per the PRD (FR-3): "AGENTS.md takes precedence over existing `instructions`/`system_prompt` fields when present." This is the correct behavior.

---

## Summary of Findings

| Question | Answer |
|----------|--------|
| Is the worker path covered? | **YES.** `_execute_agent_stream` calls `LLMService.assistant()` at line 209. |
| Is the schedule path covered? | **YES.** Both distributed (delegates to worker) and in-process (line 103) call `LLMService.assistant()`. |
| Where should injection happen? | **`LLMService.assistant()` only.** This is the single convergence point for all four production paths. |
| Is there a double-injection risk? | **NO**, as long as injection only happens in `LLMService.assistant()`. All paths pass `params.instructions` to `construct_agent()` exactly once. |
| Do thread routes need changes? | **NO.** The `init_graph()` calls in thread routes (interrupt/resume) are administrative only, no agent execution. |
| What files need changes? | **Only `backend/src/services/llm.py`** for the backend injection logic. |
| Are there existing test patterns? | **YES.** Follow the `test_schedule_dispatch.py` mock-based pattern or `test_assistant_service.py` `IsolatedAsyncioTestCase` pattern. New file: `backend/tests/unit/services/test_llm_service.py`. |

---

## Architectural Diagram

```
                     API Request (POST /api/llm/stream or /api/llm/invoke)
                                      |
                                      v
                              init_config(params)
                                      |
                    +----------------------------------+
                    |                                  |
            DISTRIBUTED_WORKERS=true          DISTRIBUTED_WORKERS=false
                    |                                  |
                    v                                  v
        run_agent_stream.kiq()              LLMController.llm_invoke()
        (enqueue to TaskIQ)                 LLMController.llm_stream()
                    |                                  |
                    v                                  v
         _execute_agent_stream()            LLMService.assistant(params)  <-- AGENTS.md injection
                    |                                  |
                    v                                  v
        LLMService.assistant(params)        construct_agent(instructions=...)
          <-- AGENTS.md injection                      |
                    |                                  v
                    v                           init_system_prompt()
        construct_agent(instructions=...)              |
                    |                                  v
                    v                           "INSTRUCTIONS:\n{content}"
            init_system_prompt()                appended to system prompt
                    |
                    v
            "INSTRUCTIONS:\n{content}"
             appended to system prompt


         +------ Schedule Path ------+
         |                           |
    DISTRIBUTED=true           DISTRIBUTED=false
         |                           |
    (delegates to                scheduled_llm_invoke()
     TaskIQ worker)                  |
         |                           v
         +--- same as above    LLMService.assistant()  <-- covered
                                     |
                                     v
                              construct_agent()
```
