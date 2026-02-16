# Fix: Propagate agent_name to Tool Result Messages

Date: 2026-02-16
Branch: `feat/694-show-subagent-tool-calls`

## Problem

After page reload, tool result messages lose `agent_name` because:
1. LangGraph checkpoint serialization drops `lc_agent_name` from ToolMessage objects
2. The US-013 backfill builds `agent_name_map` from thread snapshot, which excludes tool messages
3. Tool result messages arrive at frontend without `agent_name`
4. "via {agent_name}" text doesn't render in ToolTimelineItem

## Solution

Added a second pass in `formatMessages()` (`frontend/src/lib/utils/format.ts`) that propagates `agent_name` from AI messages to their corresponding tool result messages, matched by `tool_call_id`.

### How it works:
1. After the existing `flatMap`, build a `toolCallAgentMap` (`Map<tool_call_id, agent_name>`) from:
   - AI/assistant messages with `tool_calls` array (each `tool_call.id` maps to the message's `agent_name`)
   - `tool_input` messages (their `tool_call_id` maps to their `agent_name`)
2. For each tool result message that lacks `agent_name`, look up its `tool_call_id` in the map
3. Only sets `agent_name` when missing (additive, no overwrites)

### Why frontend (not backend):
- Works for both checkpoint-loaded and streaming scenarios
- Works for pre-deployment threads (AI messages may get backfilled from snapshot)
- Follows existing pattern: `formatMessages` already propagates `agent_name` from AI -> tool_input messages
- No backend changes needed

## Files Modified

| File | Change |
|------|--------|
| `frontend/src/lib/utils/format.ts` | Added agent_name propagation from AI -> tool results after flatMap |
| `frontend/src/lib/utils/format.test.ts` | Added 4 test cases for propagation behavior |

## Test Results

| Check | Result |
|-------|--------|
| Frontend tests | PASS - 256 tests passed (4 new), 3 skipped |
| Frontend lint | PASS - Clean |
| Frontend build | PASS - tsc + vite build successful |

## New Test Cases

1. **"should propagate agent_name from AI message tool_calls to tool result messages"** - Core fix validation
2. **"should not overwrite existing agent_name on tool result messages"** - Ensures additive-only behavior
3. **"should not propagate agent_name to tool results from parent (no agent_name) messages"** - Parent tools unaffected
4. **"should propagate agent_name to multiple tool results from the same AI message"** - Multi-tool-call scenario

## Acceptance Criteria Impact

| AC | Story | Status |
|----|-------|--------|
| US-007 AC1 | "via {agent_name}" in tool header | FIXED - now shows after reload |
| US-007 AC2 | No "via" on parent tools | PASS - unchanged |
| US-013 | agent_name survives reload | FIXED - propagated from AI messages |
