# Fix: Propagate agent_name to Tool Result Messages

Date: 2026-02-16
Branch: `feat/694-show-subagent-tool-calls`

## Problem

After page reload, tool result messages lose `agent_name` because:
1. LangGraph checkpoint serialization drops `lc_agent_name` from ALL message types
2. The US-013 backfill builds `agent_name_map` from thread snapshot, but the snapshot also lacks `agent_name`
3. Neither checkpoint messages nor thread snapshot messages have `agent_name` after reload
4. "via {agent_name}" text doesn't render in ToolTimelineItem

### Root Cause (deeper than initial plan)

The initial plan assumed `agent_name` survived on AI messages but was lost only on tool results. **Live browser QA revealed that `agent_name` is lost on ALL messages after reload** — including AI messages and tool_input messages. The backend backfill (US-013) finds nothing to restore because:
- `lc_agent_name` is transient in LangGraph — dropped during checkpoint serialization
- The thread snapshot is populated from checkpoint state (already lacking `lc_agent_name`)
- No `agent_name` in snapshot → nothing to backfill → all messages arrive at frontend without it

### Key Discovery

While `lc_agent_name` is lost, the `subagent_type` field in tool call arguments **survives checkpoint serialization** because it's part of the tool call args (stored as data, not metadata):
```json
{"tool_calls": [{"id": "call_abc", "name": "task", "args": {"subagent_type": "python-programmer", "description": "..."}}]}
```

## Solution

Added `extractSubagentType()` helper and enhanced the propagation pass in `formatMessages()`:

1. `extractSubagentType(args)` — extracts `subagent_type` from tool call args (handles both object and JSON string formats)
2. Propagation builds `toolCallAgentMap` from:
   - `msg.agent_name` (from streaming, when available) — highest priority
   - `tool_calls[].args.subagent_type` (from checkpoint, always available for `task` tool calls) — fallback
   - `tool_input.input.subagent_type` (parsed args on tool_input messages) — fallback
3. Applies `agent_name` to ALL messages that lack it (tool_input AND tool results) via `tool_call_id` matching

### Why frontend (not backend):
- Works for both checkpoint-loaded and streaming scenarios
- `subagent_type` is always available in tool call args (survives any serialization)
- No backend changes needed
- Self-healing: works for any thread regardless of when it was created

## Files Modified

| File | Change |
|------|--------|
| `frontend/src/lib/utils/format.ts` | Added `extractSubagentType()` helper + enhanced propagation pass |
| `frontend/src/lib/utils/format.test.ts` | Added 6 test cases for propagation behavior |

## Test Results

| Check | Result |
|-------|--------|
| Frontend tests | PASS - 258 tests passed (6 new), 3 skipped |
| Frontend lint | PASS - Clean |
| Frontend build | PASS - tsc + vite build successful |

## Browser QA Evidence

### Before fix (after reload):
- All messages had `agent_name: undefined`
- Tool timeline items showed: `task  No data available...` (no "via" text)

### After fix (after reload):
- Tool results correctly show: `task  via python-programmer  No data available...`
- 5 "via python-programmer" spans confirmed in DOM across both old and new thread queries
- Non-subagent tools (write_file, write_todos) correctly show no "via" text
- Screenshots: `/tmp/qa-live-16-after-fix.png`

## New Test Cases

1. **"should propagate agent_name from AI message tool_calls to tool result messages"** - Core propagation via agent_name
2. **"should not overwrite existing agent_name on tool result messages"** - Additive-only behavior
3. **"should not propagate agent_name to tool results from parent (no agent_name) messages"** - Parent tools unaffected
4. **"should propagate agent_name to multiple tool results from the same AI message"** - Multi-tool-call scenario
5. **"should extract agent_name from tool_calls args.subagent_type when agent_name is missing"** - Checkpoint reload scenario
6. **"should extract agent_name from JSON string args.subagent_type"** - JSON string args handling

## Acceptance Criteria Impact

| AC | Story | Status |
|----|-------|--------|
| US-007 AC1 | "via {agent_name}" in tool header | FIXED - now shows after reload via subagent_type extraction |
| US-007 AC2 | No "via" on parent tools | PASS - only task tools with subagent_type show attribution |
| US-013 | agent_name survives reload | FIXED - extracted from tool_calls args which survive serialization |
