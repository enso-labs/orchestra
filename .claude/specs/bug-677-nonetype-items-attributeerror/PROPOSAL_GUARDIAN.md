# PROPOSAL: GUARDIAN
## GitHub Issue #677: BUG - AttributeError: 'NoneType' object has no attribute 'items'

---

## 1. EXECUTIVE SUMMARY

The bug occurs when a LangGraph node returns `None` for the `files` state channel, and the `_file_data_reducer` in the `deepagents` package attempts to call `.items()` on this `None` value. The recommended fix is a two-layer defensive approach: (1) implement a wrapper reducer in Orchestra that normalizes `None` to `{}` before delegating to the upstream reducer, and (2) ensure all state initialization points consistently provide empty dicts rather than `None`. This approach maintains compatibility with the `deepagents` package while providing robust error prevention at the Orchestra layer.

---

## 2. ARCHITECTURAL ANALYSIS

### 2.1 Current Error Flow

The error manifests in the following call stack:

```
deepagents/middleware/filesystem.py:84
    return {k: v for k, v in right.items() if v is not None}
                              ^^^^^
    AttributeError: 'NoneType' object has no attribute 'items'
```

This is triggered during LangGraph's `BinaryOperatorAggregate.update()` which calls the reducer function with:
- `left`: current accumulated state value (a dict)
- `right`: new value from the node (potentially `None`)

### 2.2 Root Cause Analysis

The root cause is a **contract violation** between LangGraph nodes and state reducers:

1. **Expected Contract**: Nodes should return `dict` or `None` for the `files` channel
2. **Reducer Assumption**: The `_file_data_reducer` assumes both `left` and `right` are dicts
3. **Violation Point**: Nodes returning `None` breaks the reducer's assumption

### 2.3 All Potential None Entry Points

After thorough codebase analysis, `None` can enter the `files` state through:

| Entry Point | Location | Current Handling |
|-------------|----------|------------------|
| `LLMInput.files` | `backend/src/schemas/entities/llm.py:56` | `Optional[Dict]`, defaults to `None` |
| `init_config()` | `backend/src/flows/__init__.py:186` | Uses `params.input.files or {}` |
| `ToolRuntime` state init | `backend/src/workers/tasks.py:91` | Uses `files_map` from config |
| `ToolRuntime` state init | `backend/src/utils/stream.py:199` | Uses `files_map` from config |
| `ToolRuntime` state init | `backend/src/controllers/llm.py:33` | Uses `request.input.file_system` |
| `stream_generator()` | `backend/src/utils/stream.py:190` | Complex fallback chain |
| `AutoEvictMiddleware` | `backend/src/utils/middleware.py:214,250` | Returns `files_update` |
| LangGraph node returns | Any graph node | Can return `None` for `files` |
| Graph checkpoint restore | LangGraph internal | May restore `None` values |

### 2.4 Error Handling Assessment

**Current State:**
- The codebase has **inconsistent** null handling for the `files` channel
- Some locations use `or {}` pattern, others do not
- No defensive wrapper around the upstream reducer
- No validation at state channel boundaries

**Key Finding**: The `init_config()` function at `backend/src/flows/__init__.py:186` correctly uses:
```python
"files": params.input.files or {},
```

However, this pattern is not consistently applied everywhere, and it cannot protect against `None` being returned from graph nodes during execution.

---

## 3. IMPLEMENTATION STRATEGY

### 3.1 Primary Fix: Safe Reducer Wrapper

Create a defensive wrapper that intercepts `None` values before they reach the upstream `deepagents` reducer.

**Location**: `backend/src/utils/state_reducers.py` (new file)

```python
"""State reducer wrappers for defensive null handling.

This module provides safe wrapper functions around upstream reducers
from the deepagents package to handle edge cases where nodes return
None instead of expected dict types.
"""

from typing import Any, Callable, Dict, Optional


def safe_file_reducer(
    upstream_reducer: Callable[[Dict, Dict], Dict]
) -> Callable[[Dict, Dict], Dict]:
    """
    Wrap a file data reducer to safely handle None values.

    LangGraph reducers receive (left, right) where:
    - left: current accumulated state
    - right: new value from node

    This wrapper normalizes None to {} before calling upstream.

    Args:
        upstream_reducer: The original reducer from deepagents

    Returns:
        A wrapped reducer that handles None safely
    """
    def safe_reducer(left: Optional[Dict], right: Optional[Dict]) -> Dict:
        # Normalize None to empty dict
        normalized_left = left if left is not None else {}
        normalized_right = right if right is not None else {}

        return upstream_reducer(normalized_left, normalized_right)

    return safe_reducer


def create_safe_files_channel() -> Dict[str, Any]:
    """
    Create a safely-typed files channel annotation for LangGraph.

    Returns:
        Channel configuration with safe reducer
    """
    from deepagents.middleware.filesystem import _file_data_reducer

    return {
        "reducer": safe_file_reducer(_file_data_reducer),
        "default": lambda: {},
    }
```

### 3.2 Secondary Fix: Consistent Initialization

Ensure all state initialization points use defensive defaults.

**File**: `backend/src/controllers/llm.py`
**Line 33** - Change:
```python
state={"messages": [], "files": request.input.file_system},
```
To:
```python
state={"messages": [], "files": request.input.file_system or {}},
```

**File**: `backend/src/utils/stream.py`
**Line 190** - The existing code is:
```python
files_map = config["metadata"].get("files", {}) or input.file_system or {}
```
This is already defensive, but verify it's used correctly.

### 3.3 Tertiary Fix: AutoEvictMiddleware Enhancement

**File**: `backend/src/utils/middleware.py`

In `_intercept_large_tool_result()`, ensure `files_update` is never `None` when building the Command:

**Lines 211-220** - The current code:
```python
return (
    Command(
        update={
            "files": files_update,
            "messages": [processed_message],
        }
    )
    if files_update is not None
    else processed_message
)
```

This is already defensive (only includes `files` if `files_update` is not None), but the pattern should be consistently applied.

**Lines 246-252** - Change:
```python
return Command(
    update={
        **update,
        "messages": processed_messages,
        "files": accumulated_file_updates,
    }
)
```
To:
```python
return Command(
    update={
        **update,
        "messages": processed_messages,
        "files": accumulated_file_updates or {},
    }
)
```

### 3.4 Integration with Graph Builder

**File**: `backend/src/flows/__init__.py`

When the `create_deep_agent` is called, if it allows custom channel configuration, provide the safe reducer. If not, the upstream `deepagents` package may need a patch or the Orchestra layer must guarantee no `None` values reach the reducer.

**Current architecture limitation**: If `deepagents.create_deep_agent()` internally defines the files channel with `_file_data_reducer`, Orchestra cannot override it without modifying the upstream package.

**Recommended workaround**: Until `deepagents` is patched, ensure all paths that write to the `files` channel are wrapped with null checks.

---

## 4. DESIGN DECISIONS

### 4.1 Why Wrapper Pattern Over Direct Fix

| Approach | Pros | Cons |
|----------|------|------|
| Patch deepagents | Fixes root cause | Requires upstream PR, deployment lag |
| Wrapper in Orchestra | Immediate fix, no external dependency | Slight overhead, may miss some paths |
| Pydantic validation | Type safety at boundaries | Cannot catch mid-graph None returns |

**Decision**: Use **wrapper pattern** as primary, with defensive initialization as secondary layer. This provides immediate protection while maintaining clean separation from upstream.

### 4.2 Why Not Strict Type Validation

Strict type validation (e.g., Pydantic model for state) could catch this at runtime, but:
- Would require significant refactoring of LangGraph state schema
- May conflict with deepagents internal state handling
- Adds overhead to every state transition

**Decision**: Use defensive programming (null coalescing) rather than strict validation for this specific bug.

### 4.3 Security Considerations

**No security vulnerabilities introduced by this fix:**

1. **No data exposure**: The fix only handles empty states, no data leakage
2. **No injection risk**: Dict initialization is hardcoded, no user input
3. **No privilege escalation**: State handling doesn't affect auth
4. **Fail-safe behavior**: Empty dict is safer than crashing

**Potential security concern addressed:**
- Agent crashes during streaming could leave connections in bad state
- This fix prevents crashes, improving stability and reducing DoS surface

### 4.4 Robustness Considerations

The fix implements **defense in depth**:

1. **Layer 1**: Safe reducer wrapper normalizes inputs
2. **Layer 2**: Initialization points use `or {}` pattern
3. **Layer 3**: Middleware returns validated dicts
4. **Layer 4**: (Future) Upstream deepagents patch

---

## 5. RISK ASSESSMENT

### 5.1 Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Wrapper misses edge case | Medium | Medium | Comprehensive test coverage |
| Performance regression | Low | Low | Wrapper is O(1) operation |
| Deepagents version break | Low | Medium | Pin version, monitor releases |
| Incomplete initialization fix | Medium | Low | Code review, grep verification |
| Upstream fix conflicts | Low | Low | Monitor deepagents changelog |

### 5.2 Edge Cases to Handle

| Edge Case | Expected Behavior | Test Required |
|-----------|-------------------|---------------|
| `right=None` | Return `left` unchanged (or `{}` if both None) | Yes |
| `left=None` | Return `right` unchanged (or `{}` if both None) | Yes |
| Both `None` | Return `{}` | Yes |
| Empty dict `{}` | Normal merge, return `{}` | Yes |
| Dict with `None` values | Filter out None values (per original reducer) | Yes |
| Nested None in dict | Pass through to upstream, let it handle | Yes |
| Large dict | Normal merge, no special handling | No |
| Invalid type (string, list) | Let upstream raise TypeError | No |

### 5.3 Regression Risks

**Existing functionality that could break:**

1. **File tracking in streams** - Must verify files still accumulate correctly
2. **AutoEvict middleware** - Must verify large results still evict
3. **Thread state persistence** - Must verify files persist to DB
4. **Checkpoint restore** - Must verify restored state works

**Mitigation**: Comprehensive test suite covering all paths.

---

## 6. TESTING STRATEGY

### 6.1 Unit Tests Required

**New test file**: `backend/tests/unit/utils/test_state_reducers.py`

```python
"""Unit tests for state reducer wrappers."""

import pytest
from src.utils.state_reducers import safe_file_reducer


class TestSafeFileReducer:
    """Tests for the safe_file_reducer wrapper."""

    def test_both_none_returns_empty_dict(self):
        """When both left and right are None, return empty dict."""
        mock_reducer = lambda l, r: {**l, **r}
        safe = safe_file_reducer(mock_reducer)

        result = safe(None, None)

        assert result == {}

    def test_right_none_returns_left(self):
        """When right is None, return left unchanged."""
        mock_reducer = lambda l, r: {**l, **r}
        safe = safe_file_reducer(mock_reducer)

        result = safe({"a": 1}, None)

        assert result == {"a": 1}

    def test_left_none_returns_right(self):
        """When left is None, return right unchanged."""
        mock_reducer = lambda l, r: {**l, **r}
        safe = safe_file_reducer(mock_reducer)

        result = safe(None, {"b": 2})

        assert result == {"b": 2}

    def test_both_dicts_merge_normally(self):
        """When both are dicts, merge normally via upstream."""
        mock_reducer = lambda l, r: {**l, **r}
        safe = safe_file_reducer(mock_reducer)

        result = safe({"a": 1}, {"b": 2})

        assert result == {"a": 1, "b": 2}

    def test_empty_dicts_return_empty(self):
        """Empty dicts merge to empty dict."""
        mock_reducer = lambda l, r: {**l, **r}
        safe = safe_file_reducer(mock_reducer)

        result = safe({}, {})

        assert result == {}
```

### 6.2 Integration Tests Required

**Add to**: `backend/tests/integration/test_agent_stream.py`

```python
@pytest.mark.asyncio
async def test_values_mode_with_none_files_does_not_crash():
    """Agent stream handles None files gracefully."""
    from src.utils.stream import handle_multi_mode

    # Simulate a values chunk with None files
    chunk = (
        "values",
        {
            "messages": [],
            "files": None,  # This was causing the crash
            "todos": [],
        },
    )

    # Should not raise AttributeError
    result = handle_multi_mode(chunk)

    assert result is not None
    assert result[0] == "values"


@pytest.mark.asyncio
async def test_files_accumulation_with_intermittent_none():
    """Files accumulate correctly when some chunks have None."""
    files_map = {}

    chunks = [
        ("values", {"messages": [], "files": {"/a.txt": {"content": ["a"]}}}),
        ("values", {"messages": [], "files": None}),  # Intermittent None
        ("values", {"messages": [], "files": {"/b.txt": {"content": ["b"]}}}),
    ]

    for chunk in chunks:
        chunk_data = chunk[1]
        chunk_files = chunk_data.get("files")
        if chunk_files:  # Current pattern - None is falsy
            files_map = {**files_map, **chunk_files}

    assert "/a.txt" in files_map
    assert "/b.txt" in files_map
```

### 6.3 Test Commands

```bash
# Run all backend tests
make test

# Run specific test file
uv run pytest backend/tests/unit/utils/test_state_reducers.py -v

# Run integration tests
uv run pytest backend/tests/integration/test_agent_stream.py -v

# Run with coverage
uv run pytest --cov=src --cov-report=html

# Format code after changes
make format
```

### 6.4 Manual Testing Scenarios

1. **Basic Chat Stream**: Send message, verify no crash, files empty
2. **File Creation via Tool**: Use tool that creates files, verify persistence
3. **Large Result Eviction**: Trigger large tool result, verify eviction works
4. **Checkpoint Restore**: Start new session with checkpoint, verify files load
5. **Long Conversation**: 50+ messages, verify files state remains valid

---

## 7. ESTIMATED COMPLEXITY

### 7.1 Scope: **SMALL**

| Task | Files | Effort |
|------|-------|--------|
| Create state_reducers.py | 1 new | 30 min |
| Update llm.py initialization | 1 change | 5 min |
| Update middleware.py | 1 change | 10 min |
| Create unit tests | 1 new | 30 min |
| Add integration tests | 1 change | 20 min |
| Code review & testing | - | 30 min |

**Total estimated effort**: ~2 hours

### 7.2 Risk Level: **LOW**

- Defensive code addition only
- No breaking changes to API
- No database migrations
- All changes are additive
- Easy rollback (remove wrapper)

### 7.3 Suggested Implementation Order

1. **First**: Create `state_reducers.py` with safe wrapper (core fix)
2. **Second**: Add unit tests to verify wrapper behavior
3. **Third**: Update initialization points with `or {}` pattern
4. **Fourth**: Add integration tests
5. **Fifth**: Run full test suite, verify no regressions
6. **Sixth**: Code review and merge

---

## 8. IMPLEMENTATION CHECKLIST

### Pre-Implementation

- [ ] Verify deepagents version (0.3.1) in pyproject.toml
- [ ] Check if deepagents exposes channel configuration
- [ ] Review all files state access patterns
- [ ] Set up test environment

### Implementation

- [ ] Create `backend/src/utils/state_reducers.py`
- [ ] Implement `safe_file_reducer()` wrapper
- [ ] Update `backend/src/controllers/llm.py:33`
- [ ] Update `backend/src/utils/middleware.py:250`
- [ ] Create `backend/tests/unit/utils/test_state_reducers.py`
- [ ] Add integration test cases

### Post-Implementation

- [ ] Run `make test` - all tests pass
- [ ] Run `make format` - code formatted
- [ ] Manual test: basic chat works
- [ ] Manual test: files accumulate correctly
- [ ] Manual test: large result eviction works
- [ ] Document changes in PR description

### Verification

- [ ] Error no longer occurs with test case that triggered it
- [ ] No performance regression observed
- [ ] All existing tests pass
- [ ] New tests provide coverage for edge cases

---

## 9. ALTERNATIVE APPROACHES CONSIDERED

### 9.1 Upstream Fix in deepagents

**Approach**: Submit PR to deepagents to fix `_file_data_reducer`

```python
# Proposed upstream fix
def _file_data_reducer(left, right):
    if right is None:
        return left if left is not None else {}
    if left is None:
        left = {}
    return {k: v for k, v in right.items() if v is not None}
```

**Status**: Recommended as follow-up action, but not blocking this fix

### 9.2 LangGraph State Schema Validation

**Approach**: Define typed state schema with Pydantic validation

**Rejected**: Too invasive, requires deep changes to graph construction

### 9.3 Exception Handling at Stream Level

**Approach**: Wrap `agent.astream()` in try/except for AttributeError

**Rejected**: Masks the bug rather than fixing it, data loss risk

---

## 10. MONITORING AND OBSERVABILITY

### 10.1 Logging Recommendations

Add debug logging when None normalization occurs:

```python
def safe_reducer(left, right):
    if right is None:
        logger.debug("Normalized None files state to empty dict")
    normalized_right = right if right is not None else {}
    # ...
```

### 10.2 Alerting Considerations

If None normalization happens frequently, it may indicate:
- Bug in a tool/node returning None
- Misconfigured graph state

Consider adding metrics counter for monitoring.

---

## 11. SUCCESS CRITERIA

### Functional Requirements Met

- [ ] `AttributeError: 'NoneType' object has no attribute 'items'` no longer occurs
- [ ] Agent streaming works end-to-end
- [ ] Files state accumulates correctly
- [ ] Checkpoint restore works with files

### Quality Requirements Met

- [ ] All tests pass
- [ ] Code follows project style (make format)
- [ ] No TypeScript errors in frontend
- [ ] Documentation updated

### Security Requirements Met

- [ ] No new vulnerabilities introduced
- [ ] PII middleware still active
- [ ] No data exposure risk
- [ ] Fail-safe behavior maintained

---

## 12. REFERENCES

### Files Analyzed

- `/backend/src/flows/__init__.py` - Graph builder, init_config
- `/backend/src/utils/middleware.py` - AutoEvictMiddleware
- `/backend/src/utils/stream.py` - stream_generator, handle_multi_mode
- `/backend/src/workers/tasks.py` - run_agent_stream task
- `/backend/src/controllers/llm.py` - LLMController
- `/backend/src/schemas/entities/llm.py` - LLMInput, files field
- `/backend/tests/integration/test_agent_stream.py` - Existing tests
- `/backend/tests/unit/workers/test_tasks.py` - Task tests
- `/backend/tests/conftest.py` - Test fixtures

### External Dependencies

- `deepagents==0.3.1` - Contains `_file_data_reducer`
- `langgraph` - State management, BinaryOperatorAggregate
- `langchain` - Message types, agent infrastructure

### Issue Context

- GitHub Issue #677: BUG: AttributeError: 'NoneType' object has no attribute 'items'
- Error location: `deepagents/middleware/filesystem.py:84`
- Trigger: Node returns `None` for files channel during astream
