# PRD: Separate Tool Inputs and Attach ToolCallId

## Introduction

When the LLM streams an `AIMessageChunk` with multiple `tool_calls`, the frontend merges all tool call args into a single `input` array on one message. This makes it impossible to distinguish individual tool invocations in the UI. This feature separates each tool call into its own discrete UI element, showing its `tool_call_id`, `name`, and `args` independently.

## Goals

- Display each tool input as its own UI element with visible `tool_call_id`, `name`, and `args`
- Enable future per-tool-call display decisions (streaming indicators, collapsible panels)
- Maintain checkpoint compatibility — saved threads render correctly without migration

## User Stories

### US-001: Capture stream logs for tool call chunk structure
**Description:** As a dev, I need to capture and analyze how `tool_call_chunks` arrive during streaming so I can validate assumptions about chunk isolation.

**Acceptance Criteria:**
- [ ] Enable `console.log(payload)` in `handleMessages()` at `frontend/src/hooks/useChat.ts:~457`
- [ ] Trigger a stream that invokes at least 2 tool calls
- [ ] Document: whether each chunk has a unique `id`, the shape of `tool_call_chunks[0]` (id, name, args), and arrival ordering
- [ ] Save findings as comments in the plan or code

### US-002: Split tool_calls into individual tool_input messages in formatMessages
**Description:** As a user, I want each tool input shown as its own card so I can see what each tool was called with independently.

**Acceptance Criteria:**
- [ ] `formatMessages()` in `frontend/src/lib/utils/format.ts` uses `.flatMap()` instead of `.map()`
- [ ] Each `tool_call` in an `AIMessageChunk` produces a separate message with `type: "tool_input"`, `role: "tool_input"`, `tool_call_id`, `name`, and `input` (parsed args)
- [ ] Single tool call case produces exactly 1 `tool_input` message
- [ ] Multiple tool calls case produces N `tool_input` messages
- [ ] Invalid/empty args are filtered out
- [ ] `parent_message_id` links back to original AI message id
- [ ] Typecheck passes

### US-003: Update StreamMessageHandler for per-tool-call tracking
**Description:** As a dev, I need the stream handler to track each tool call independently so that multiple concurrent tool calls don't clobber each other during streaming.

**Acceptance Criteria:**
- [ ] `StreamMessageHandler` in `frontend/src/lib/utils/message.ts` uses a `Map<string, {name, args}>` keyed by tool_call_id instead of single `toolCallChunkRef`/`toolNameRef` refs
- [ ] Each `tool_call_chunk` creates/updates its own entry in `history` with a unique id (`${response.id}-tc-${tcId}`)
- [ ] Args are incrementally accumulated per tool_call_id and parsed when valid JSON
- [ ] Loading message in `useChat.ts` still shows the current tool name
- [ ] Typecheck passes

### US-004: Render tool_input messages in ChatMessages
**Description:** As a user, I want to see each tool input as a distinct card in the chat showing the tool name and tool_call_id.

**Acceptance Criteria:**
- [ ] `ChatMessages.tsx` renders `tool_input` type/role messages with `DefaultTool` component
- [ ] `tool_call_id` is displayed as monospace text below each tool input card
- [ ] Old `AIMessageChunk` rendering block is removed or updated
- [ ] Tool response messages (`type: "tool"`) continue rendering via `ToolTimeline` with their `tool_call_id`
- [ ] Visual consistency between tool input and tool response `tool_call_id` display
- [ ] Typecheck passes

### US-005: Add tests for split tool_input behavior
**Description:** As a dev, I need tests to verify the tool_call splitting logic so regressions are caught.

**Acceptance Criteria:**
- [ ] Tests in `frontend/src/lib/utils/format.test.ts` cover:
  - Single tool_call → 1 `tool_input` message
  - Multiple tool_calls → N `tool_input` messages
  - Invalid/empty args → filtered out
  - `tool_call_id` correctly propagated
  - `parent_message_id` links to original message
- [ ] All existing tests continue to pass
- [ ] `npm test` passes in frontend directory

### US-006: End-to-end validation
**Description:** As a user, I want the full flow to work — streaming, checkpoint reload, and display — with separated tool inputs.

**Acceptance Criteria:**
- [ ] Stream a conversation with tool calls: each tool input appears as its own card during streaming
- [ ] Reload the thread from checkpoint: tool inputs render identically to streamed version
- [ ] Single tool call conversations still work correctly
- [ ] No regressions in existing chat functionality
- [ ] Validated using `agent-browser` CLI with screenshots
