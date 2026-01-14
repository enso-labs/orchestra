# Implementation Tasks: Multi-Turn Distributed Workers Fix

## Pre-Implementation

- [ ] Verify development environment setup
  - Files: `backend/`, `.venv/`
  - Acceptance: `uv sync` succeeds, `make dev` starts server

- [ ] Review REVIEW.md council decisions
  - Files: `.claude/specs/feature-656-distributed-workers-taskiq/REVIEW.md`
  - Acceptance: Understand priority order and rationale

---

## Phase 1: Critical Fixes (Enables Multi-Turn)

### Fix 1.1: Add Backend/ToolRuntime to Worker Task

- [ ] Import required modules in `tasks.py`
  - Files: `backend/src/workers/tasks.py`
  - Add: `from deepagents.backends import StoreBackend`, `from langchain.tools import ToolRuntime`, `from src.flows import init_backend`
  - Acceptance: No import errors

- [ ] Create ToolRuntime before construct_agent call (after line 100)
  - Files: `backend/src/workers/tasks.py`
  - Add: `runtime = ToolRuntime(state={"messages": [], "files": files_map}, context=ctx_schema, tool_call_id="tc_worker", store=service_context.store, stream_writer=lambda _: None, config=config)`
  - Acceptance: ToolRuntime created with correct parameters

- [ ] Initialize CompositeBackend with store routes
  - Files: `backend/src/workers/tasks.py`
  - Add: `store_backend = StoreBackend(runtime)`, routes dict, `backend = init_backend(runtime, routes=routes)`
  - Acceptance: Backend initialized with user-specific routes

- [ ] Pass backend to construct_agent
  - Files: `backend/src/workers/tasks.py`
  - Modify: Add `backend=backend` to `construct_agent()` call on line 83-91
  - Acceptance: `construct_agent` receives backend parameter

### Fix 1.2: Remove Redundant config_dict Parameter

- [ ] Remove config_dict from task function signature
  - Files: `backend/src/workers/tasks.py`
  - Change: Remove `config_dict: dict` from line 23
  - Acceptance: Function has 3 parameters: task_dict, user_id, thread_id

- [ ] Remove config_dict from API call to task
  - Files: `backend/src/routes/v0/llm.py`
  - Find: `run_agent_stream.kiq()` call
  - Change: Remove `config_dict=dict(config)` parameter
  - Acceptance: Only task_dict, user_id, thread_id passed to kiq()

### Fix 1.3: Remove Duplicate Message Conversion

- [ ] Delete try/except message conversion block
  - Files: `backend/src/workers/tasks.py`
  - Remove: Lines 94-99 (the try/except block)
  - Rationale: `llm_service.assistant()` on line 81 already handles this
  - Acceptance: No duplicate conversion code

---

## Phase 2: Error Handling Improvements

### Fix 2.1: Resilient Error Handler

- [ ] Wrap error handler in nested try-except
  - Files: `backend/src/workers/tasks.py`
  - Location: Lines 171-175 (exception handler)
  - Change: Add inner try-except around `redis_client.xadd` calls
  - Acceptance: Redis failure doesn't cause secondary crash

```python
# Expected pattern:
except Exception as e:
    logger.exception(f"Task failed for thread {thread_id}: {e}")
    try:
        await redis_client.xadd(stream_key, {"error": str(e), "done": "true"})
        await redis_client.expire(stream_key, 300)
    except Exception as redis_err:
        logger.error(f"Failed to send error to Redis: {redis_err}")
    raise
```

### Fix 2.2: Configurable Stream Timeout

- [ ] Add environment variable for timeout
  - Files: `backend/src/utils/stream.py`
  - Add: `STREAM_TIMEOUT_MS = int(os.getenv("STREAM_TIMEOUT_MS", "60000"))` at top of file
  - Acceptance: Timeout is configurable, defaults to 60 seconds

- [ ] Use configurable timeout in xread
  - Files: `backend/src/utils/stream.py`
  - Location: Line 319
  - Change: `block=30000` to `block=STREAM_TIMEOUT_MS`
  - Acceptance: Stream uses configurable timeout

---

## Phase 3: Multi-Turn Test Suite

### New Test File: test_multi_turn_distributed.py

- [ ] Create test file structure
  - Files: `backend/tests/integration/test_multi_turn_distributed.py`
  - Acceptance: File exists with pytest imports

- [ ] Add test: Sequential messages share context
  - Test: Send message 1, wait for DONE, send message 2, verify context preserved
  - Acceptance: Message 2 response references message 1 content

- [ ] Add test: Rapid consecutive messages
  - Test: Send message 1 and 2 without waiting for DONE on message 1
  - Acceptance: Both complete successfully, checkpoint has both responses

- [ ] Add test: Checkpoint grows with turns
  - Test: Send 3 messages, verify checkpoint_id changes each time
  - Acceptance: Each turn updates checkpoint

- [ ] Add test: Consumer survives timeout
  - Test: Mock slow worker (>30s), verify consumer keeps polling
  - Acceptance: Consumer eventually receives response

- [ ] Add test: Error during turn 2 communicates to client
  - Test: Cause failure on second message, verify error is received
  - Acceptance: Client gets error event, not hung

---

## Phase 4: Checkpoint Validation (Lower Priority)

### Fix 4.1: Validate Checkpoint State

- [ ] Add state validation before update
  - Files: `backend/src/workers/tasks.py`
  - Location: After line 144 (`final_state = await agent.graph.aget_state(config)`)
  - Add: Validation that final_state is not None and has messages
  - Acceptance: Empty state is logged as warning

---

## Verification

- [ ] Run existing test suite
  - Command: `ENVIRONMENT=pytest uv run pytest`
  - Acceptance: All 111+ tests pass

- [ ] Run new multi-turn tests
  - Command: `ENVIRONMENT=pytest uv run pytest tests/integration/test_multi_turn_distributed.py -v`
  - Acceptance: All new tests pass

- [ ] Manual validation with curl
  ```bash
  # Terminal 1: Start API with distributed workers
  DISTRIBUTED_WORKERS=true make dev

  # Terminal 2: Start Worker
  REDIS_URL=redis://localhost:6379/0 uv run taskiq worker src.workers.tasks:broker

  # Terminal 3: Test multi-turn
  # Turn 1
  curl -X POST http://localhost:8000/api/llm/stream \
    -H "Content-Type: application/json" \
    -H "x-api-key: YOUR_API_KEY" \
    -d '{"input": {"messages": [{"role": "user", "content": "Remember that my name is Alice"}]}, "model": "openai:gpt-4.1-mini"}'
  # Note the thread_id returned

  # Stream Turn 1 results
  curl -N http://localhost:8000/api/threads/{thread_id}/stream \
    -H "x-api-key: YOUR_API_KEY"

  # Turn 2 (follow-up)
  curl -X POST http://localhost:8000/api/llm/stream \
    -H "Content-Type: application/json" \
    -H "x-api-key: YOUR_API_KEY" \
    -d '{"input": {"messages": [{"role": "user", "content": "What is my name?"}]}, "metadata": {"thread_id": "{thread_id}"}, "model": "openai:gpt-4.1-mini"}'

  # Stream Turn 2 results - should know Alice
  curl -N http://localhost:8000/api/threads/{thread_id}/stream \
    -H "x-api-key: YOUR_API_KEY"
  ```
  - Acceptance: Turn 2 response correctly references Turn 1 context

- [ ] Format code
  - Command: `make format`
  - Acceptance: No formatting errors

---

## Completion Signature

- Total Tasks: 20
- Priority Order: Fix 1.1 → Fix 1.3 → Fix 2.1 → Fix 1.2 → Fix 2.2 → Phase 3 → Fix 4.1
- Dependencies: Redis server running, PostgreSQL running

---

## Progress Log

### Completed Tasks

- [x] Fix 1.1: Add Backend/ToolRuntime to Worker Task
  - Added imports: `StoreBackend`, `ToolRuntime`, `init_backend`
  - Created ToolRuntime before construct_agent call
  - Initialized CompositeBackend with store routes
  - Passed backend to construct_agent

- [x] Fix 1.2: Remove Redundant config_dict Parameter
  - Removed config_dict from `run_agent_stream` function signature in `tasks.py`
  - Removed config_dict from API call in `llm.py`
  - Updated test assertion in `test_distributed_stream.py`

- [x] Fix 1.3: Remove Duplicate Message Conversion
  - Removed the try/except message conversion block (was redundant with llm_service.assistant())

- [x] Fix 2.1: Resilient Error Handler
  - Wrapped error handler Redis calls in nested try-except
  - Added logging for Redis failures during error handling

- [x] Fix 2.2: Configurable Stream Timeout
  - Added STREAM_TIMEOUT_MS environment variable (default 60000ms)
  - Updated stream_from_redis to use configurable timeout

- [x] Phase 3: Multi-Turn Test Suite
  - Created `tests/integration/test_multi_turn_distributed.py`
  - Tests: sequential context preservation, rapid messages, checkpoint management, error handling, stream consumer behavior

- [x] Fix 4.1: Validate Checkpoint State
  - Added validation that final_state is not None and has messages
  - Logs warning if checkpoint update results in empty state

---

## Validation Results

### Test Suite Results: ALL PASSED

```
120 passed, 2 skipped, 3 warnings in 5.02s
```

### New Multi-Turn Tests: ALL PASSED

```
tests/integration/test_multi_turn_distributed.py - 9 tests passed
tests/integration/test_distributed_stream.py - 11 tests passed
Total: 20 distributed worker tests passing
```

### Code Formatting: COMPLETE

```
11 files reformatted, 146 files left unchanged
```

---

## Summary of Changes

### Files Modified:
1. `backend/src/workers/tasks.py` - Added Backend/ToolRuntime initialization, resilient error handler, checkpoint validation
2. `backend/src/routes/v0/llm.py` - Removed config_dict parameter
3. `backend/src/utils/stream.py` - Added configurable STREAM_TIMEOUT_MS
4. `backend/tests/integration/test_distributed_stream.py` - Updated test assertion
5. `backend/tests/integration/test_multi_turn_distributed.py` - NEW FILE (multi-turn test suite)