# User Stories

## Issue #677: BUG: AttributeError: 'NoneType' object has no attribute 'items'

### Story 1: Graceful Handling of Null Files State
**As a** developer using Orchestra agents,
**I want** the agent stream to handle null/None values in the files state gracefully,
**So that** my agent conversations don't crash when nodes return None for the files channel.

**Acceptance Criteria:**
- [ ] Agent streaming does not crash when a node returns `None` for the `files` state
- [ ] The `_file_data_reducer` receives valid dict values (empty `{}` instead of `None`)
- [ ] Existing file tracking functionality continues to work correctly
- [ ] No regression in file upload/download features

### Story 2: Robust State Reducer Error Prevention
**As a** platform operator,
**I want** state reducers to be protected against invalid input types,
**So that** the system remains stable even when internal components pass unexpected values.

**Acceptance Criteria:**
- [ ] State reducers validate input before processing
- [ ] `None` values are coerced to empty dictionaries where appropriate
- [ ] Error logs provide clear context when invalid state is encountered
- [ ] The fix is applied at the appropriate layer (Orchestra wrapper or middleware)

### Story 3: Consistent Files State Initialization
**As a** developer,
**I want** the files state to be consistently initialized across all graph nodes,
**So that** I don't encounter AttributeError when files are not explicitly set.

**Acceptance Criteria:**
- [ ] Files state is initialized to empty dict `{}` if not provided
- [ ] Nodes that don't modify files don't break the state chain
- [ ] Config initialization properly sets default files value
- [ ] All worker tasks handle missing/null files gracefully

## Technical Context

The error occurs in `deepagents/middleware/filesystem.py` at line 84:
```python
return {k: v for k, v in right.items() if v is not None}
```

Where `right` is `None` instead of a dict. This is called from LangGraph's `BinaryOperatorAggregate.update()` which uses the reducer function to combine state values.

**Root Cause Analysis:**
1. A node in the graph returns `None` for the `files` channel
2. LangGraph calls the reducer with `(current_value, None)`
3. The reducer assumes both inputs are dicts and calls `.items()` on `None`

**Potential Fix Locations:**
1. `backend/src/flows/__init__.py` - Ensure config initializes files properly
2. `backend/src/utils/middleware.py` - AutoEvictMiddleware could validate files
3. Custom wrapper around deepagents reducer (if exposed)
4. Upstream fix in deepagents package

## Notes
- The error is triggered during `agent.astream()` execution
- Affects the `files` channel in LangGraph state management
- The `configurable.files` is set in `init_config()` at line 186
- Need to trace which node is returning `None` for files
