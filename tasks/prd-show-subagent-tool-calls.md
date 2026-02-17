# PRD: Render Subagent Tool Calls in the UI

## Introduction

When a parent agent delegates to subagents, the backend streams their messages with `lc_agent_name` metadata. The frontend currently ignores this — all messages appear from one agent. This feature adds visual distinction for subagent messages showing which subagent produced each tool call and response.

## Goals

- Show subagent name attribution on tool calls and AI responses
- Preserve `agent_name` through the full pipeline (backend → stream → frontend → render)
- Subtle visual distinction (badges, not heavy nesting)

## User Stories

### US-001: Preserve lc_agent_name in backend serialization
**Description:** As a developer, I need the backend to include agent_name in serialized stream output so the frontend can display it.

**Acceptance Criteria:**
- [ ] `handle_multi_mode()` in `backend/src/utils/stream.py` extracts `lc_agent_name` and includes it as `agent_name` in the serialized dict
- [ ] `from_message_to_dict()` in `backend/src/utils/messages.py` preserves `agent_name` for checkpoint reload
- [ ] Verify with a stream log that subagent messages include `agent_name` field
- [ ] Typecheck passes

### US-002: Extract agent_name in frontend stream handler
**Description:** As a developer, I need the frontend to extract agent_name from streamed chunks.

**Acceptance Criteria:**
- [ ] `handleMessages()` in `frontend/src/hooks/useChat.ts` extracts `agent_name` from response payload
- [ ] `agent_name` attached to response object before passing to StreamMessageHandler
- [ ] Typecheck passes

### US-003: Propagate agent_name through StreamMessageHandler
**Description:** As a developer, I need agent_name to survive message processing and appear in the history array.

**Acceptance Criteria:**
- [ ] `StreamMessageHandler` in `frontend/src/lib/utils/message.ts` preserves `agent_name` in `messageCreate()`, `messageUpdate()`, and `toolCall()`
- [ ] History entries have `agent_name` field when present
- [ ] Typecheck passes

### US-004: Preserve agent_name in formatMessages
**Description:** As a developer, I need agent_name to survive the formatMessages normalization for checkpoint-loaded threads.

**Acceptance Criteria:**
- [ ] `formatMessages()` in `frontend/src/lib/utils/format.ts` preserves `agent_name` through all message type branches
- [ ] Checkpoint-loaded threads with subagent messages retain `agent_name`
- [ ] Typecheck passes

### US-005: Create SubagentBadge component
**Description:** As a user, I want a visual badge showing the subagent name on messages.

**Acceptance Criteria:**
- [ ] New component `SubagentBadge` created (e.g., `frontend/src/components/badges/SubagentBadge.tsx`)
- [ ] Shows bot icon + agent name in muted style
- [ ] Only renders when `agent_name` is present and non-null
- [ ] Typecheck passes

### US-006: Render subagent attribution in ChatMessages
**Description:** As a user, I want to see which subagent produced each message in the chat.

**Acceptance Criteria:**
- [ ] `ChatMessages.tsx` renders SubagentBadge above assistant/AI messages with `agent_name`
- [ ] Subagent messages have subtle visual distinction (left border or slight indent)
- [ ] Parent agent messages (no `agent_name`) render normally unchanged
- [ ] Typecheck passes

### US-007: Render subagent attribution in ToolTimeline
**Description:** As a user, I want to see which subagent made each tool call.

**Acceptance Criteria:**
- [ ] `ToolTimelineItem.tsx` shows "via {agent_name}" in the tool call header
- [ ] Only shows when `agent_name` is present
- [ ] Consistent styling with SubagentBadge
- [ ] Typecheck passes
- [ ] Verify in browser using agent-browser skill

### US-008: Add tests for agent_name propagation
**Description:** As a developer, I need tests to verify agent_name flows through the pipeline.

**Acceptance Criteria:**
- [ ] Test in `format.test.ts` that `formatMessages` preserves `agent_name`
- [ ] All existing tests continue to pass
- [ ] npm test passes in frontend directory

### US-009: Verify workspace is clean and push final changes
**Description:** As a developer, I want to ensure all changes are committed and pushed.

**Acceptance Criteria:**
- [ ] Run git status to check for uncommitted changes
- [ ] If remaining changes exist, commit and push to branch
- [ ] All commits visible in GitHub PR
