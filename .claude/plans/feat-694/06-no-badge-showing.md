# Code Review & QA Plan: `feat/694-show-subagent-tool-calls`

## Context

The branch implements subagent attribution (US-001 through US-014). The user reports that "via python-programmer" text WAS visible on tool results (see screenshot `/tmp/qa-13-expanded-tool.png`) during a live session but **no longer shows after page reload** — an apparent regression.

### Root Cause Analysis

**During streaming**, the flow works correctly:
1. LangGraph sets `lc_agent_name` on messages from subagent nodes
2. Backend `_to_dict()` (`backend/src/utils/stream.py:34-43`) promotes `lc_agent_name` → `agent_name`
3. Frontend receives tool result messages with `agent_name`
4. `ToolTimelineItem.tsx:150-154` renders "via {agent_name}"

**After page reload**, `agent_name` is lost on tool messages:
1. LangGraph checkpoint serialization drops `lc_agent_name` from ToolMessage objects
2. `from_message_to_dict()` in `checkpoint.py:88` has nothing to promote
3. The US-013 backfill (`thread.py:57-69`) builds `agent_name_map` from thread snapshot — but the snapshot EXCLUDES tool messages (`include_tool_calls=False` at `thread_repo.py:71`)
4. Tool result messages arrive at frontend without `agent_name`
5. "via {agent_name}" doesn't render

**Additionally**: The backfill only helps AI messages for threads created AFTER feature deployment. Pre-deployment thread snapshots lack `agent_name` entirely.

---

## Step 1: Browser QA — Validate Current Behavior

Use `agent-browser` skill to confirm the regression and document current state.

### 1a. Open a subagent thread
- Navigate to http://localhost:5173
- Click "Execute 3 parallel @python-programmer..." thread
- Screenshot the thread view

### 1b. Check SubagentBadge on AI messages (US-005, US-006)
- DOM query: `document.querySelectorAll('[data-testid="subagent-badge"]')`
- Expected: Badges visible on subagent AI messages (if agent_name persists for AI messages via backfill)

### 1c. Check "via {agent_name}" on tool results (US-007)
- Expand a tool result from a subagent
- DOM query: `Array.from(document.querySelectorAll('span')).filter(el => el.textContent.startsWith('via '))`
- Expected: **FAIL** — "via" text likely missing after reload (this is the regression)

### 1d. Check parent messages unaffected (US-005 AC3, US-006 AC3)
- Count badges vs total assistant messages
- Confirm badges appear only on subagent messages

### 1e. Check tooltip (US-014)
- DOM query: `document.querySelector('[data-testid="subagent-badge"] .truncate')?.title`

---

## Step 2: Fix — Propagate `agent_name` from AI Messages to Tool Results

**Approach: Frontend propagation in `formatMessages()`**

In `frontend/src/lib/utils/format.ts`, add a second pass in `formatMessages()` that propagates `agent_name` from AI messages to their corresponding tool results (matched by `tool_call_id`).

### Why frontend (not backend):
- Works for both checkpoint-loaded and streaming scenarios
- Works for pre-deployment threads (AI messages may get backfilled from snapshot)
- Follows existing pattern: `formatMessages` already propagates `agent_name` from AI → tool_input messages
- No backend changes needed

### Implementation:

**File: `frontend/src/lib/utils/format.ts`**

After the existing `flatMap`, add a propagation step:

```typescript
export function formatMessages(messages: any[]) {
  if (!messages || !Array.isArray(messages)) {
    return [];
  }

  const formatted = messages.flatMap((message: any) => {
    // ... existing logic unchanged ...
  });

  // Propagate agent_name from AI messages to their tool result messages
  const toolCallAgentMap = new Map<string, string>();
  for (const msg of formatted) {
    if (
      ["assistant", "ai", "tool_input"].includes(msg.role ?? msg.type) &&
      msg.agent_name
    ) {
      // AI messages with tool_calls: map each tool_call_id → agent_name
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          if (tc.id) toolCallAgentMap.set(tc.id, msg.agent_name);
        }
      }
      // tool_input messages: map their tool_call_id → agent_name
      if (msg.tool_call_id) {
        toolCallAgentMap.set(msg.tool_call_id, msg.agent_name);
      }
    }
  }
  for (const msg of formatted) {
    if (msg.role === "tool" && !msg.agent_name && msg.tool_call_id) {
      const agentName = toolCallAgentMap.get(msg.tool_call_id);
      if (agentName) msg.agent_name = agentName;
    }
  }

  return formatted;
}
```

### Key details:
- Build `toolCallAgentMap` from AI messages' `tool_calls[].id` and tool_input messages' `tool_call_id`
- Apply to tool result messages that lack `agent_name` (matched by `tool_call_id`)
- Only sets `agent_name` when missing (additive, no overwrites)
- Works for both streaming and reload scenarios

---

## Step 3: Update Tests

**File: `frontend/src/lib/utils/format.test.ts`**

Add test case: "propagates agent_name from AI message to tool result message"

```typescript
it("propagates agent_name from AI message tool_calls to tool result messages", () => {
  const messages = [
    {
      id: "ai-1",
      type: "ai",
      content: "",
      agent_name: "python-programmer",
      tool_calls: [{ id: "call_123", name: "execute", args: { code: "print(1)" } }],
    },
    {
      id: "tool-1",
      type: "tool",
      content: "1",
      tool_call_id: "call_123",
      name: "execute",
      status: "success",
    },
  ];
  const result = formatMessages(messages);
  const toolMsg = result.find((m: any) => m.role === "tool");
  expect(toolMsg.agent_name).toBe("python-programmer");
});
```

---

## Step 4: Run Automated Checks

```bash
cd frontend && npm run test      # Verify new + existing tests pass
cd frontend && npm run lint      # ESLint
cd frontend && npm run build     # tsc + vite build
cd backend && make lint          # ruff check
cd backend && make format        # ruff format --check
```

---

## Step 5: Browser Re-QA

Repeat Step 1 with agent-browser to confirm the fix:
- Tool results now show "via {agent_name}" after page reload
- SubagentBadge still visible on AI messages
- Parent messages still unaffected
- Take screenshots for evidence

---

## Step 6: Write QA Report & Commit

1. Write results to `.claude/plans/feat-694/05-qa-results.md`
2. Commit changes with descriptive message

---

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/lib/utils/format.ts` | Add agent_name propagation from AI → tool results in `formatMessages()` |
| `frontend/src/lib/utils/format.test.ts` | Add test for agent_name propagation to tool results |
| `.claude/plans/feat-694/05-qa-results.md` | QA results report (new file) |

## Acceptance Criteria Matrix

| AC | Story | What to Verify | Expected After Fix |
|----|-------|----------------|-------------------|
| US-005 AC2 | SubagentBadge | Bot icon + agent name | PASS |
| US-005 AC3 | SubagentBadge | Badge absent on parent | PASS |
| US-006 AC1 | ChatMessages | Badge above subagent messages | PASS |
| US-006 AC2 | ChatMessages | Left border | PASS |
| US-006 AC3 | ChatMessages | Parent unchanged | PASS |
| US-007 AC1 | ToolTimeline | "via {agent_name}" in header | PASS (after fix) |
| US-007 AC2 | ToolTimeline | No "via" on parent tools | PASS |
| US-013 | Persistence | agent_name survives reload | PASS (after fix) |
| US-014 | Tooltip | title on truncated badge | PASS |
