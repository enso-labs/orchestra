# Consolidated Plan: User-Configurable `stream_mode` Parameter

## Expert Review Sources
- **Backend API Expert**: Schema, validation, controller threading
- **Streaming Infrastructure Expert**: Stream processing pipeline, chunk handlers
- **Frontend Integration Expert**: SSE parsing, event handling, type definitions
- **Distributed Systems Expert**: Worker pipeline, Redis propagation, backward compat

---

## Problem Statement

`stream_mode` is hard-coded as `["messages", "values"]` in three locations:
1. `backend/src/utils/stream.py:294` (sync streaming)
2. `backend/src/workers/tasks.py:422` (distributed primary loop)
3. `backend/src/workers/tasks.py:514` (distributed Daytona fallback)

Users cannot control which LangGraph stream modes they receive. LangGraph supports:
`"messages"`, `"values"`, `"updates"`, `"tasks"`, `"debug"`, `"custom"`, `"checkpoints"`

Individual handlers already exist for all modes in `stream.py` but are unused.

---

## Consensus Decisions (All 4 Experts Agree)

1. **Add `stream_mode: Optional[List[str]]` to `LLMRequest`** with `None` default
2. **Validate at API boundary** — reject invalid modes with 422
3. **Always include `"values"` internally** — filter from output if user didn't request it (data integrity for files/todos)
4. **`stream_from_redis()` needs NO changes** — it's mode-agnostic, just relays bytes
5. **Backward compatible** — `None` resolves to `["messages", "values"]`, existing clients unaffected
6. **Refactor `handle_multi_mode()`** to dispatch all mode types, not just messages+values

---

## Implementation Plan

### Phase 1: Backend Schema & Constants

**Step 1** — Define constant for default stream modes

File: `backend/src/schemas/entities/llm.py` (top of file)

```python
VALID_STREAM_MODES: set[str] = {"messages", "values", "updates", "tasks", "debug", "custom", "checkpoints"}
DEFAULT_STREAM_MODES: list[str] = ["messages", "values"]
```

**Step 2** — Add `stream_mode` field to `LLMRequest`

File: `backend/src/schemas/entities/llm.py`

```python
stream_mode: Optional[List[str]] = Field(
    default=None,
    description=(
        "LangGraph stream mode(s) for /llm/stream. Ignored by /llm/invoke. "
        "Valid: messages, values, updates, tasks, debug. "
        "Defaults to ['messages', 'values']. "
        "'messages' is required for the web frontend to render streaming tokens."
    ),
    examples=[["messages", "values"], ["messages", "values", "updates"]],
)
```

Add validator:

```python
@field_validator("stream_mode", mode="before")
@classmethod
def validate_stream_mode(cls, v):
    if v is None:
        return None
    if isinstance(v, str):
        v = [v]  # coerce single string to list
    if not isinstance(v, list):
        raise ValueError("stream_mode must be a list of strings")
    if len(v) == 0:
        return None  # empty list → default
    invalid = set(v) - VALID_STREAM_MODES
    if invalid:
        raise ValueError(f"Invalid stream mode(s): {invalid}. Valid: {VALID_STREAM_MODES}")
    # Deduplicate preserving order
    seen = set()
    return [m for m in v if not (m in seen or seen.add(m))]
```

Add resolved property:

```python
@property
def resolved_stream_mode(self) -> list[str]:
    return self.stream_mode if self.stream_mode else DEFAULT_STREAM_MODES
```

**Step 3** — Preserve `stream_mode` through `LLMService.assistant()`

File: `backend/src/services/llm.py`

After `assistant_request = assistant.to_llm_request(...)`, add:
```python
assistant_request.stream_mode = params.stream_mode
```

---

### Phase 2: Stream Processing Pipeline

**Step 4** — Update `stream_generator()` signature

File: `backend/src/utils/stream.py`

Add parameter: `stream_mode: list[str] | None = None`

Replace hard-coded mode (line 294):
```python
effective_modes = stream_mode if stream_mode else DEFAULT_STREAM_MODES
# Always include "values" internally for files/todos extraction
internal_modes = list(set(effective_modes) | {"values"})
user_requested_modes = set(effective_modes)

astream_kwargs = {
    "stream_mode": internal_modes,
    "config": config,
    "context": ctx,
}
```

In the chunk yield loop, gate on user-requested modes:
```python
if stream_type in user_requested_modes:
    yield f"data: {data}\n\n"
```

**Step 5** — Refactor `handle_multi_mode()` to dispatch all modes

File: `backend/src/utils/stream.py`

Extract messages logic to `_handle_messages_chunk()`. Add branches for updates, tasks, debug, custom:

```python
def handle_multi_mode(chunk: tuple) -> tuple | None:
    try:
        mode = chunk[0]
        payload = chunk[1]

        if mode == "values":
            payload["messages"] = from_message_to_dict(payload.get("messages", []))
            return (mode, payload)
        if mode == "messages":
            return _handle_messages_chunk(chunk)
        if mode == "updates":
            return (mode, handle_updates_mode(payload))
        if mode == "tasks":
            return (mode, handle_tasks_mode(payload))
        if mode == "debug":
            result = handle_debug_mode(payload)
            return (mode, result) if result else None
        if mode == "custom":
            return (mode, payload)

        logger.warning(f"Unrecognized stream mode: {mode}")
    except Exception as e:
        logger.error(f"Error in handle_multi_mode: {e}")
    return None
```

**Step 6** — Fix `handle_updates_mode()` bug

The existing function has a potential `UnboundLocalError` — `messages` referenced before assignment if neither `agent` nor `tools` key exists. Rewrite:

```python
def handle_updates_mode(payload: dict) -> dict:
    result = {}
    for node_name, node_data in payload.items():
        if isinstance(node_data, dict) and "messages" in node_data:
            result[node_name] = {**node_data, "messages": [_to_dict(m) for m in node_data["messages"]]}
        else:
            result[node_name] = node_data
    return result
```

---

### Phase 3: Controller & Route Threading

**Step 7** — Update `LLMController.llm_stream()` to forward `stream_mode`

File: `backend/src/controllers/llm.py`

```python
return stream_generator(
    ...,
    stream_mode=params.resolved_stream_mode,  # NEW
)
```

**Step 8** — Update distributed route to pass `stream_mode` to TaskIQ

File: `backend/src/routes/v0/llm.py`

```python
await run_agent_stream.kiq(
    task_dict=params.model_dump(),
    user_id=str(user_id) if user_id else "",
    thread_id=thread_id,
    run_id=run_id,
    stream_mode=params.stream_mode,  # NEW
)
```

---

### Phase 4: Distributed Worker Pipeline

**Step 9** — Update TaskIQ task signature

File: `backend/src/workers/tasks.py`

Add `stream_mode: list[str] | None = None` to `run_agent_stream()` signature (default `None` for backward compat with in-flight tasks).

Resolve and pass to `_execute_agent_stream()`.

**Step 10** — Update `_execute_agent_stream()` to use dynamic mode

Replace both hard-coded `["messages", "values"]` (lines 422, 514):

```python
internal_modes = list(set(stream_mode) | {"values"})
user_requested_modes = set(stream_mode)

async for chunk in agent.astream(input, stream_mode=internal_modes, ...):
    stream_chunk = handle_multi_mode(chunk)
    if stream_chunk:
        stream_type = stream_chunk[0]
        # Always extract files/todos
        if stream_type == "values" and chunk_data.get("files"):
            files_map = {**files_map, **chunk_data["files"]}
        # Only write to Redis if user requested
        if stream_type in user_requested_modes:
            await redis_client.xadd(stream_key, {"data": data})
```

---

### Phase 5: Frontend (Minimal — Backward Compatible)

**Step 11** — Add TypeScript types for new SSE events

File: `frontend/src/lib/entities/stream.ts`

Add `UpdatesEvent`, `DebugEvent`, `TasksEvent` interfaces and update `SSEEvent` union.

**Step 12** — Update SSE parsers

File: `frontend/src/lib/utils/fetchStreamReader.ts`

Add `case "updates"/"debug"/"tasks"` to both `parseEvent()` methods.

**Step 13** — Update `useChat.ts` event handling

Add handlers for new modes in `convertEventToLegacy()` and `handleMessages()`.
- `updates` → extract messages, render in chat
- `debug` → console.debug, store in ref for future dev panel
- `tasks` → console.log, store in ref

**Step 14** — Add `stream_mode` to request payload (optional)

File: `frontend/src/lib/services/threadService.ts`

Add `stream_mode?: string[]` to `StreamThreadPayload`. When omitted, backend uses default.

---

### Phase 6: Testing

**Step 15** — Backend unit tests

- `test_llm_request_stream_mode_validation` — invalid modes rejected
- `test_llm_request_stream_mode_defaults` — None → DEFAULT_STREAM_MODES
- `test_llm_request_stream_mode_coercion` — string → list, empty → None, dedup
- `test_handle_multi_mode_updates` — updates chunks dispatched correctly
- `test_handle_updates_mode_bug_fix` — no UnboundLocalError
- `test_stream_mode_round_trip` — survives model_dump/reconstruct

**Step 16** — OpenAPI examples

File: `backend/src/constants/examples/__init__.py`

Add example with `stream_mode: ["messages", "values", "updates"]`.

---

## Implementation Order

| Priority | Phase | Files | Risk |
|----------|-------|-------|------|
| 1 | Schema + Constants | `llm.py` (schema) | Low |
| 2 | Stream Processing | `stream.py` | Medium — refactor handle_multi_mode |
| 3 | Controller Threading | `llm.py` (controller), `llm.py` (route) | Low |
| 4 | Distributed Worker | `tasks.py` | Medium — in-flight task compat |
| 5 | Frontend Types+Parsing | `stream.ts`, `fetchStreamReader.ts` | Low |
| 6 | Frontend Handling | `useChat.ts`, `threadService.ts` | Low |
| 7 | Tests | New test files | Low |
| 8 | Smoke Tests | `scripts/smoke-stream-mode.sh` → `logs/` | Low |

---

### Phase 7: Smoke Testing (Manual API Validation)

**Goal:** Validate the `stream_mode` parameter end-to-end against a running API instance, saving all request/response output to `./logs/smoke-stream-mode-<timestamp>/` for inspection.

**Step 17** — Create smoke test script

File: `backend/scripts/smoke-stream-mode.sh`

The script runs against a live API (`API_URL` env var, default `http://localhost:8000`) and writes each test's raw output to the logs directory. Each test produces two files: `<test>_request.json` (the curl payload) and `<test>_response.txt` (raw response body including SSE lines).

**Test cases:**

| # | Test Name | Payload `stream_mode` | Expected Behavior | Output File Prefix |
|---|-----------|----------------------|--------------------|--------------------|
| 1 | `default_omitted` | *(field omitted)* | SSE events for `messages` and `values` only | `01_default_omitted` |
| 2 | `default_explicit` | `["messages", "values"]` | Identical output to test 1 | `02_default_explicit` |
| 3 | `messages_only` | `["messages"]` | Only `messages` event types in SSE stream | `03_messages_only` |
| 4 | `all_three` | `["messages", "values", "updates"]` | SSE events for all three modes | `04_all_three` |
| 5 | `updates_only` | `["updates"]` | Only `updates` event types (no `messages` tokens) | `05_updates_only` |
| 6 | `single_string` | `"messages"` (string, not array) | Coerced to `["messages"]`, valid SSE stream | `06_single_string` |
| 7 | `invalid_mode` | `["messages", "bogus"]` | HTTP 422 with validation error listing valid modes | `07_invalid_mode` |
| 8 | `empty_list` | `[]` | Falls back to default `["messages", "values"]` | `08_empty_list` |

**Script structure:**

```bash
#!/bin/bash
# Smoke tests for stream_mode parameter
# Usage: ./scripts/smoke-stream-mode.sh [API_KEY]
#
# Prerequisites: API running (make dev)
# Outputs: ./logs/smoke-stream-mode-<timestamp>/

set -euo pipefail

API_URL="${API_URL:-http://localhost:8000}"
API_KEY="${1:-}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_DIR="./logs/smoke-stream-mode-${TIMESTAMP}"
MODEL="${MODEL:-openai:gpt-4.1-mini}"
PROMPT="Say exactly: hello world"
PASS=0; FAIL=0; TOTAL=0

mkdir -p "$LOG_DIR"

# Helper: POST /llm/stream, save request + response, validate
smoke_test() {
    local name="$1"
    local payload="$2"
    local expect_status="${3:-200}"  # 200 for SSE, 422 for validation error
    local grep_pattern="${4:-}"      # pattern to assert in response

    TOTAL=$((TOTAL + 1))
    echo "$payload" > "$LOG_DIR/${name}_request.json"

    HTTP_CODE=$(curl -s -o "$LOG_DIR/${name}_response.txt" -w "%{http_code}" \
        -X POST "$API_URL/api/llm/stream" \
        -H "Content-Type: application/json" \
        ${API_KEY:+-H "x-api-key: $API_KEY"} \
        -N --max-time 30 \
        -d "$payload")

    echo "[$name] HTTP $HTTP_CODE (expected $expect_status)"

    if [ "$HTTP_CODE" != "$expect_status" ]; then
        echo "  FAIL: unexpected status code"
        FAIL=$((FAIL + 1))
        return
    fi

    if [ -n "$grep_pattern" ]; then
        if grep -q "$grep_pattern" "$LOG_DIR/${name}_response.txt"; then
            echo "  PASS: found expected pattern"
            PASS=$((PASS + 1))
        else
            echo "  FAIL: pattern '$grep_pattern' not found in response"
            FAIL=$((FAIL + 1))
        fi
    else
        PASS=$((PASS + 1))
    fi
}

echo "=============================================="
echo "stream_mode Smoke Tests"
echo "=============================================="
echo "API: $API_URL | Model: $MODEL"
echo "Logs: $LOG_DIR"
echo ""

# --- Tests ---

# 1. Default (omitted)
smoke_test "01_default_omitted" \
  "{\"input\":{\"messages\":[{\"role\":\"user\",\"content\":\"$PROMPT\"}]},\"model\":\"$MODEL\"}" \
  200 "messages"

# 2. Default (explicit)
smoke_test "02_default_explicit" \
  "{\"input\":{\"messages\":[{\"role\":\"user\",\"content\":\"$PROMPT\"}]},\"model\":\"$MODEL\",\"stream_mode\":[\"messages\",\"values\"]}" \
  200 "messages"

# 3. Messages only
smoke_test "03_messages_only" \
  "{\"input\":{\"messages\":[{\"role\":\"user\",\"content\":\"$PROMPT\"}]},\"model\":\"$MODEL\",\"stream_mode\":[\"messages\"]}" \
  200 "messages"

# 4. All three modes
smoke_test "04_all_three" \
  "{\"input\":{\"messages\":[{\"role\":\"user\",\"content\":\"$PROMPT\"}]},\"model\":\"$MODEL\",\"stream_mode\":[\"messages\",\"values\",\"updates\"]}" \
  200 "messages"

# 5. Updates only
smoke_test "05_updates_only" \
  "{\"input\":{\"messages\":[{\"role\":\"user\",\"content\":\"$PROMPT\"}]},\"model\":\"$MODEL\",\"stream_mode\":[\"updates\"]}" \
  200 "updates"

# 6. Single string coercion
smoke_test "06_single_string" \
  "{\"input\":{\"messages\":[{\"role\":\"user\",\"content\":\"$PROMPT\"}]},\"model\":\"$MODEL\",\"stream_mode\":\"messages\"}" \
  200 "messages"

# 7. Invalid mode → 422
smoke_test "07_invalid_mode" \
  "{\"input\":{\"messages\":[{\"role\":\"user\",\"content\":\"$PROMPT\"}]},\"model\":\"$MODEL\",\"stream_mode\":[\"messages\",\"bogus\"]}" \
  422 "Invalid stream mode"

# 8. Empty list → default
smoke_test "08_empty_list" \
  "{\"input\":{\"messages\":[{\"role\":\"user\",\"content\":\"$PROMPT\"}]},\"model\":\"$MODEL\",\"stream_mode\":[]}" \
  200 "messages"

# --- Summary ---
echo ""
echo "=============================================="
echo "Results: $PASS passed, $FAIL failed, $TOTAL total"
echo "Logs saved to: $LOG_DIR"
echo "=============================================="

[ $FAIL -eq 0 ] && exit 0 || exit 1
```

**Step 18** — Add `logs/` to `.gitignore`

Ensure `logs/` is gitignored so smoke test output is never committed:

```
# Smoke test output
logs/
```

**Step 19** — Run and inspect

```bash
# Sync mode (default)
cd backend && ./scripts/smoke-stream-mode.sh

# With API key
cd backend && ./scripts/smoke-stream-mode.sh "otk_your_key_here"

# Distributed mode (requires worker running)
cd backend && API_URL=http://localhost:8000 ./scripts/smoke-stream-mode.sh

# Inspect outputs
ls -la ./logs/smoke-stream-mode-*/
cat ./logs/smoke-stream-mode-*/01_default_omitted_response.txt
```

---

## Key Architectural Decisions

1. **`None` default, not `["messages", "values"]`**: Distinguishes "user didn't specify" from "user explicitly chose". Avoids redundant serialization in task_dict.
2. **Always include "values" internally**: Prevents data integrity issues (files/todos). Filter from output if user didn't request it.
3. **Separate TaskIQ argument**: Pass `stream_mode` as explicit kwarg to `run_agent_stream.kiq()` rather than relying on it being in `task_dict`.
4. **Frontend is additive**: New event types are handled gracefully — unrecognized types already return null. Changes are purely additive.
5. **No forced "messages" requirement**: API consumers (CLI, programmatic) may want only "updates" or "values". Frontend requirement for "messages" is documented, not enforced.
