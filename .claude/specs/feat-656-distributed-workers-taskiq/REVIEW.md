# Council Review: Multi-Turn Messaging in Distributed Workers

## Feature Under Review
Validate that multiple turn-by-turn messages work correctly in the TaskIQ distributed worker system. Initial messages work but follow-up messages appear to have issues.

---

## Executive Summary

Three elite architect agents analyzed the distributed workers implementation from complementary perspectives (Distributed Systems, LangGraph Patterns, and Testing/Error Handling). **All agents converged on critical findings that explain why multi-turn messaging fails.**

### Key Consensus: Root Cause Identified

**Multi-turn messaging fails because:**
1. **Missing Backend Initialization** - Workers don't pass `backend` to `construct_agent()`, breaking tool/store operations
2. **No ToolRuntime in Workers** - Store context is lost between turns
3. **Race Conditions** - Concurrent tasks on same thread_id corrupt checkpoint state
4. **Silent Error Handling** - Failures don't propagate to clients
5. **State Persistence Gaps** - Consumer loses position on reconnect, checkpoint not validated

---

## Proposal Comparison Matrix

| Aspect | Agent 1 (Architect) | Agent 2 (Craftsman) | Agent 3 (Guardian) | Council Verdict |
|--------|---------------------|---------------------|--------------------|--------------------|
| **Root Cause** | Missing checkpoint_id in config | Missing Backend/Runtime | Race conditions + Silent failures | **All correct - multiple issues compound** |
| **Severity** | Critical | Critical | Critical | **CRITICAL - Blocks feature** |
| **Primary Fix** | Include checkpoint_id in serialization | Add Backend to worker | Add multi-turn tests | **Fix Backend first, then tests** |
| **Risk Level** | High (data loss) | High (feature parity break) | High (silent failures) | **HIGH - Production impact** |
| **Completeness** | Detailed flow analysis | Code quality focus | Test coverage focus | **Complementary analyses** |

---

## Consensus Points

All agents agree on these fundamental issues:

### 1. Backend/ToolRuntime Missing in Workers (CRITICAL)

**Sync path (`stream_generator`):**
```python
runtime = ToolRuntime(state={"messages": [], "files": files_map}, ...)
backend = init_backend(runtime, routes=routes)
agent = await construct_agent(..., backend=backend)
```

**Worker path (`run_agent_stream`):**
```python
agent = await construct_agent(...)  # NO BACKEND PASSED
```

**Impact:** Tool operations and store updates fail silently in worker mode.

### 2. State Not Persisted Across Turns

- Consumer `last_id="0"` resets on each connection
- No checkpoint validation before/after updates
- Race condition when concurrent tasks update same thread

### 3. Error Handling Hides Failures

- `handle_multi_mode` returns `None` for invalid chunks without logging context
- Worker exception handler can fail to write to Redis if Redis is down
- No client notification for many failure modes

### 4. Test Coverage Completely Missing for Multi-Turn

- Zero tests for sequential multi-turn conversations
- Zero tests for concurrent task execution
- Zero tests for checkpoint state consistency

---

## Divergence Analysis

### Divergence 1: Where to Start Fixing

| Agent | Recommendation | Rationale |
|-------|----------------|-----------|
| Architect | Fix checkpoint serialization | Restore LangGraph state continuity |
| Craftsman | Add Backend initialization | Restore feature parity with sync path |
| Guardian | Add tests first (TDD) | Verify fixes work before implementing |

**Council Decision:** Start with **Backend initialization** (Agent 2's recommendation) because:
1. It's the most immediate feature parity break
2. It doesn't require schema changes
3. Tests can be added alongside the fix

### Divergence 2: Checkpoint ID Handling

| Agent | Finding | Recommendation |
|-------|---------|----------------|
| Architect | Config dict loses checkpoint_id | Add checkpoint_id to serialization |
| Craftsman | init_config called twice (redundant) | Remove config_dict parameter, always use init_config |

**Council Decision:** **Agent 2's approach is simpler.** The `config_dict` parameter is currently unused in the worker (it calls `init_config` fresh). Remove the redundant parameter rather than fixing serialization.

However, we need to verify that LangGraph's checkpointer properly loads state from thread_id alone. If it does, no checkpoint_id serialization is needed.

### Divergence 3: Timeout Configuration

| Agent | Finding |
|-------|---------|
| Agent 1 | 30s timeout may cause stale reads |
| Agent 3 | 30s timeout too short for complex agents |

**Council Decision:** Increase timeout to 60 seconds and make configurable via environment variable.

---

## Unified Implementation Plan

### Phase 1: Critical Fixes (Blocks Multi-Turn)

#### Fix 1.1: Add Backend/ToolRuntime to Worker

**File:** `backend/src/workers/tasks.py`

**Changes:**
1. Create `ToolRuntime` before constructing agent
2. Initialize `CompositeBackend` with store routes
3. Pass `backend` to `construct_agent()`

```python
# Add after line 90, before construct_agent call:
from src.flows import init_backend

ctx_schema = ContextSchema(model=params.model or "", user_id=user_id)
runtime = ToolRuntime(
    state={"messages": [], "files": files_map},
    context=ctx_schema,
    tool_call_id="tc_worker",
    store=service_context.store,
    stream_writer=lambda _: None,
    config=config,
)
store_backend = StoreBackend(runtime)
routes = {
    f"/users/{user_id}/memories/": store_backend,
    f"/users/{user_id}/config/": store_backend,
}
backend = init_backend(runtime, routes=routes)

agent = await construct_agent(
    # existing params...
    backend=backend,  # ADD THIS
)
```

#### Fix 1.2: Remove Redundant config_dict Parameter

**File:** `backend/src/routes/v0/llm.py`

**Changes:**
1. Remove `config_dict` from `run_agent_stream.kiq()` call
2. Worker already calls `init_config()` internally

```python
# Change line 108-115 from:
await run_agent_stream.kiq(
    task_dict=params.model_dump(),
    user_id=str(user_id) if user_id else "",
    thread_id=thread_id,
    config_dict=dict(config),  # REMOVE
)

# To:
await run_agent_stream.kiq(
    task_dict=params.model_dump(),
    user_id=str(user_id) if user_id else "",
    thread_id=thread_id,
)
```

**File:** `backend/src/workers/tasks.py`

**Changes:**
1. Remove `config_dict` parameter from function signature

```python
# Change from:
async def run_agent_stream(
    task_dict: dict,
    user_id: str,
    thread_id: str,
    config_dict: dict,  # REMOVE
) -> dict:

# To:
async def run_agent_stream(
    task_dict: dict,
    user_id: str,
    thread_id: str,
) -> dict:
```

#### Fix 1.3: Remove Duplicate Message Conversion

**File:** `backend/src/workers/tasks.py`

**Changes:**
Delete lines 94-99 (the try/except block converting messages). This is already done by `llm_service.assistant()`.

### Phase 2: Error Handling Improvements

#### Fix 2.1: Resilient Error Handler

**File:** `backend/src/workers/tasks.py`

```python
except Exception as e:
    logger.exception(f"Task failed for thread {thread_id}: {e}")
    try:
        await redis_client.xadd(stream_key, {"error": str(e), "done": "true"})
        await redis_client.expire(stream_key, 300)
    except Exception as redis_err:
        logger.error(f"Failed to send error to Redis for thread {thread_id}: {redis_err}")
    raise
```

#### Fix 2.2: Configurable Timeout

**File:** `backend/src/utils/stream.py`

```python
import os

STREAM_TIMEOUT_MS = int(os.getenv("STREAM_TIMEOUT_MS", "60000"))  # 60 seconds default

# In stream_from_redis():
messages = await redis_client.xread(
    {stream_key: last_id},
    block=STREAM_TIMEOUT_MS,  # Use configurable timeout
)
```

### Phase 3: Multi-Turn Test Suite

#### New Test File: `backend/tests/integration/test_multi_turn_distributed.py`

**Scenarios to cover:**
1. Sequential messages share context
2. Rapid consecutive messages (concurrent tasks)
3. Checkpoint grows with each turn
4. Consumer survives timeout
5. Error during turn 2 is communicated to client
6. Worker crash mid-stream is handled

### Phase 4: Checkpoint Validation (Lower Priority)

#### Fix 4.1: Validate Checkpoint State

**File:** `backend/src/workers/tasks.py`

```python
# After getting final_state (around line 145):
if not final_state or not final_state.values.get("messages"):
    logger.warning(f"Checkpoint update resulted in empty state for thread {thread_id}")
    # Continue anyway but log for monitoring
```

---

## Risk Consolidation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Backend fix breaks existing functionality | Medium | High | Add integration tests before deploying |
| Removing config_dict breaks API contract | Low | High | It's internal API, no external callers |
| Timeout increase causes resource pressure | Low | Medium | Make configurable, monitor memory |
| Race conditions remain after fixes | Medium | High | Add checkpoint locking in Phase 4 |

---

## Final Verdict

### **GO** with conditions

**Confidence Level:** High

**Conditions:**
1. Add Backend initialization fix FIRST (unblocks multi-turn)
2. Add multi-turn integration tests BEFORE production deployment
3. Monitor checkpoint consistency in staging environment
4. Consider checkpoint locking mechanism for Phase 2

**Estimated Scope:** Medium (4-8 hours of focused work)

**Priority Order:**
1. Fix 1.1 (Backend) - Highest priority, enables feature
2. Fix 1.3 (Remove duplicate conversion) - Quick win, reduces bugs
3. Fix 2.1 (Error handler) - Prevents silent failures
4. Fix 1.2 (Remove config_dict) - Cleanup, reduces confusion
5. Fix 2.2 (Configurable timeout) - Improves reliability
6. Phase 3 tests - Validates all fixes work
7. Fix 4.1 (Checkpoint validation) - Defensive programming

---

## Next Steps

1. Generate `TASKS.md` with atomic checklist items
2. Implement fixes in priority order
3. Run existing tests to ensure no regression
4. Add multi-turn integration tests
5. Manual validation with curl commands
6. Deploy to staging for extended testing
