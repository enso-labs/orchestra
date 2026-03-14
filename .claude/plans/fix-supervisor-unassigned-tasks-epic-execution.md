# Fix: Supervisor Executes Unassigned Tasks in Epic Execution

## Context

When `start_epic_execution` is called, tasks without an assignee are silently skipped. If all tasks are unassigned, the tool returns an error: *"No assigned todo tasks found. Use assign_task to assign tasks to subagents first."*

The desired behavior: unassigned `todo` tasks should be executed by the supervisor/coordinator agent directly, rather than requiring pre-assignment.

**Example:** `Execute epic=fa273f98-0f37-4380-b04d-fc832d25e523` — if tasks have no assignee, the coordinator should process them itself.

## Root Cause

`backend/src/tools/epic.py:334` filters only assigned tasks:
```python
assigned_tasks = [t for t in tasks if t.assignee and t.status == "todo"]
```

Unassigned tasks are excluded entirely from execution.

## User Stories

### US-001: Supervisor Executes Unassigned Tasks

**Description:** As a user, when I execute an epic, unassigned `todo` tasks should be handled by the supervisor agent directly instead of being skipped.

**Current Behavior:**
```
# All tasks unassigned → error
{"error": "No assigned todo tasks found. Use assign_task to assign tasks to subagents first."}

# Mix of assigned/unassigned → unassigned silently skipped
{"dispatched": 2, "total_tasks": 5}  # 3 unassigned tasks ignored
```

**Expected Behavior:**
```
# All tasks unassigned → supervisor handles them all
{"dispatched": 0, "supervisor_tasks": 5, "total_tasks": 5}

# Mix → assigned dispatched to subagents, unassigned handled by supervisor
{"dispatched": 2, "supervisor_tasks": 3, "total_tasks": 5}
```

**Acceptance Criteria:**
- Unassigned `todo` tasks are collected separately from assigned tasks
- The coordinator agent receives `update_task` as a direct tool (in `tools=[update_task]`)
- Unassigned tasks are included in the coordinator's dispatch message as "handle directly"
- The coordinator's system prompt instructs it to: (1) delegate assigned tasks to subagents via `task()`, (2) execute unassigned tasks directly using `update_task`
- If there are ONLY unassigned tasks (no subagents needed), the coordinator still runs with `tools=[update_task]` and `subagents=[]`
- Response summary includes `supervisor_tasks` count alongside `dispatched`
- Max 3 tasks per subagent validation still applies (supervisor has no limit)
- All executed tasks are set to `in_progress` before dispatch (both assigned and unassigned)
- Typecheck passes (`ruff check`)

### US-002: Fix `args_schema` Serialization (500 on `/api/tools`)

**Description:** As a user, I need `/api/tools` to return 200 instead of crashing with `TypeError: Object of type ModelMetaclass is not JSON serializable`.

**Reproduction:**
```bash
curl -H "X-API-Key: <token>" http://localhost:8000/api/tools
# Returns 500
```

**Root Cause:** In `backend/src/services/tool.py:44`, when `model_json_schema()` fails, the fallback sets `args_schema` back to the raw Pydantic model class (unserializable) instead of `None`.

**Fix:** Change line 44 from `tool_dict.get("args_schema", None)` to `None`.

**Acceptance Criteria:**
- `GET /api/tools` returns 200 with all tools including epic tools
- `args_schema` is either a valid JSON schema dict or `null` — never a raw class
- No regression on existing tools

### US-003: Tag Epic Tools in `attach_tool_details()`

**Description:** As a frontend developer, I need epic tools to have `tags: ["epic"]` for UI categorization.

**Fix:** Add epic tools check in `backend/src/utils/tools.py` alongside existing tag blocks.

**Acceptance Criteria:**
- All 11 epic tools have `tags: ["epic"]` in the `/api/tools` response
- Existing tool tags unchanged

## Files to Modify

| File | Change |
|------|--------|
| `backend/src/tools/epic.py` | Update `start_epic_execution` to handle unassigned tasks via supervisor |
| `backend/src/services/tool.py:44` | Fix `args_schema` fallback to `None` |
| `backend/src/utils/tools.py` | Add `EPIC_TOOLS` import and tag block |

## Implementation Details (US-001)

In `start_epic_execution` (`backend/src/tools/epic.py:303-421`):

1. **Split tasks into two groups** (replace line 334):
   ```python
   todo_tasks = [t for t in tasks if t.status == "todo"]
   assigned_tasks = [t for t in todo_tasks if t.assignee]
   unassigned_tasks = [t for t in todo_tasks if not t.assignee]

   if not todo_tasks:
       return {"error": "No todo tasks found for this epic."}
   ```

2. **Set all todo tasks to `in_progress`** (both assigned and unassigned)

3. **Give coordinator `update_task` as a direct tool**:
   ```python
   coordinator = create_deep_agent(
       model=init_chat_model(model=DEFAULT_CHAT_MODEL),
       tools=[update_task],  # ← supervisor can execute tasks directly
       subagents=subagents,  # ← may be empty if no assigned tasks
       ...
   )
   ```

4. **Update dispatch message** to include unassigned tasks:
   ```python
   if unassigned_tasks:
       task_names = ", ".join(t.title for t in unassigned_tasks)
       dispatch_msg += f"\n\nHandle these tasks directly (no subagent): {task_names}"
       dispatch_msg += "\nFor each, call update_task with the task_id and status='done'."
   ```

5. **Update system prompt** to instruct both delegation and direct execution.

6. **Update response** to include `supervisor_tasks` count.

## Verification

```bash
# 1. Fix US-002/US-003 first, verify /api/tools returns 200
curl -s -w "\n%{http_code}" -H "X-API-Key: <token>" http://localhost:8000/api/tools | tail -1
# Expected: 200

# 2. Verify epic tools tagged
curl -s -H "X-API-Key: <token>" http://localhost:8000/api/tools | \
  python3 -c "import json,sys; [print(t['name'],t.get('tags')) for t in json.load(sys.stdin)['tools'] if t.get('tags')==['epic']]"

# 3. Ruff check
cd backend && ruff check src/tools/epic.py src/services/tool.py src/utils/tools.py

# 4. Test epic execution with unassigned tasks via chat or curl
# Create epic → create tasks (no assignee) → execute epic → verify tasks go to in_progress/done
```
