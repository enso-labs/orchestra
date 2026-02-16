# Revision Plan: `feat/694-show-subagent-tool-calls`

## Context

Code review of the subagent attribution feature found 3 issues that must be fixed before merge:

1. **2 failing tests** — `formatMessages()` doesn't propagate `agent_name` to generated `tool_input` messages, and one test has a wrong expected role
2. **Same bug in streaming handler** — `StreamMessageHandler.toolCall()` also doesn't propagate `agent_name` to tool_input entries
3. **Checkpoint persistence gap** — `agent_name` is lost on thread reload because LangGraph's checkpoint serialization doesn't preserve `lc_agent_name`. User chose to fix persistence (not just document).

Full review report: `.claude/plans/feat-694/03-code-review-report.md`

---

## Change 1: Propagate `agent_name` to tool_input in `formatMessages()`

**File:** `frontend/src/lib/utils/format.ts` (lines 147-155)

The tool_input construction creates a fresh object without `agent_name` from the parent AI message. Add conditional spread:

```typescript
// Line 147-155, inside .map((tool_call) => { ... })
return {
    id: `${message.id}-tc-${tool_call.id}`,
    type: "tool_input",
    role: "tool_input",
    tool_call_id: tool_call.id,
    name: tool_call.name,
    input: args,
    parent_message_id: message.id,
    ...(message.agent_name !== undefined && { agent_name: message.agent_name }),
};
```

---

## Change 2: Propagate `agent_name` to tool_input in streaming handler

**File:** `frontend/src/lib/utils/message.ts` (lines 81-89)

Same pattern — `toolCall()` builds tool_input entries without `agent_name` from the response. Add conditional spread:

```typescript
// Line 81-89, inside toolCall() method
const entry = {
    id: entryId,
    type: "tool_input",
    role: "tool_input",
    tool_call_id: tcId,
    name: state.name,
    input: parsedInput,
    parent_message_id: response.id,
    ...(response.agent_name !== undefined && { agent_name: response.agent_name }),
};
```

---

## Change 3: Fix test expectations

**File:** `frontend/src/lib/utils/format.test.ts`

**Test 1** (line 412): Wrong expected role. AI messages with `tool_calls` produce `tool_input` messages, not `AIMessageChunk`.

```typescript
// Line 412: change
expect(result[0].role).toBe("AIMessageChunk");
// to
expect(result[0].role).toBe("tool_input");
```

**Test 2** (line 498-504): Will pass automatically after Change 1 is applied. No test changes needed — the test expectations are correct, the code was wrong.

---

## Change 4: Persist `agent_name` through thread reload

**Root cause:** LangGraph's checkpoint serialization drops `lc_agent_name` from `BaseMessage` objects. When `list_checkpoints()` reads from the checkpoint and calls `from_message_to_dict()`, there's no `lc_agent_name` left to promote.

**Fix location:** `backend/src/routes/v0/thread.py` (lines 49-57)

The route already loads both the checkpoint AND the thread snapshot:
```python
checkpoints = await service_context.checkpoint_service.list_checkpoints(thread_id=...)
thread: Thread = await service_context.thread_service.get(thread_id)
# Already merges files and todos from snapshot → checkpoint metadata
checkpoints[0]["metadata"]["files"] = thread.files
checkpoints[0]["metadata"]["todos"] = thread.todos
```

The thread snapshot's messages (stored via `thread_repo.update()` → `from_message_to_dict()`) already have `agent_name` correctly promoted. We backfill `agent_name` from snapshot messages into checkpoint messages by matching on message `id`:

```python
if thread and len(checkpoints) > 0:
    checkpoints[0]["metadata"]["files"] = thread.files
    checkpoints[0]["metadata"]["todos"] = thread.todos

    # Backfill agent_name from thread snapshot into checkpoint messages
    if thread.messages:
        agent_name_map = {
            msg.get("id"): msg.get("agent_name")
            for msg in thread.messages
            if msg.get("agent_name")
        }
        if agent_name_map:
            for msg in checkpoints[0].get("values", {}).get("messages", []):
                if msg.get("id") in agent_name_map and "agent_name" not in msg:
                    msg["agent_name"] = agent_name_map[msg["id"]]
```

**Why this works:**
- Thread snapshot is saved in `stream.py`'s `finally` block with raw `BaseMessage` objects
- `thread_repo.update()` calls `from_message_to_dict()` which promotes `lc_agent_name → agent_name`
- Snapshot messages have `agent_name`, checkpoint messages don't — we bridge the gap at the route level
- This is additive (only sets `agent_name` when missing) and won't affect threads without subagents

**Limitation:** Thread snapshot stores last N messages (`THREAD_SNAPSHOT_MESSAGE_COUNT`). Very long threads may lose attribution on older messages. This is acceptable for the initial implementation.

---

## Change 5 (nice-to-have): Add `title` to SubagentBadge

**File:** `frontend/src/components/badges/SubagentBadge.tsx` (line 19)

```tsx
// Line 19: change
<span className="truncate max-w-[120px]">{name}</span>
// to
<span className="truncate max-w-[120px]" title={name}>{name}</span>
```

---

## Files Modified

| File | Change |
|------|--------|
| `frontend/src/lib/utils/format.ts` | Propagate `agent_name` to tool_input (Change 1) |
| `frontend/src/lib/utils/message.ts` | Propagate `agent_name` to tool_input (Change 2) |
| `frontend/src/lib/utils/format.test.ts` | Fix expected role (Change 3) |
| `backend/src/routes/v0/thread.py` | Backfill `agent_name` from snapshot (Change 4) |
| `frontend/src/components/badges/SubagentBadge.tsx` | Add title attr (Change 5) |

---

## Verification

1. **Tests pass:** `cd frontend && npm run test` — the 2 failing tests should now pass
2. **Build passes:** `cd frontend && npm run build` — no type errors
3. **Backend lint:** `cd backend && make lint && make format`
4. **Browser validation:** Use `agent-browser` to:
   - Open an existing subagent thread
   - Verify SubagentBadge (Bot icon + name) appears on subagent messages after reload
   - Verify "via {agent_name}" shows in expanded tool timeline items
   - Verify parent-agent messages have no badge
5. **Commit** with sign-off per repo conventions
