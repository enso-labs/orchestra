# Fix: Tool Inputs Not Displaying on /chat Page (Bug #815)

## Context

The screenshot at `.images/bug-815/04-no-show-input.png` shows tool inputs rendering as blank entries on the `/chat` page - tool name badges are visible but the Monaco editor shows no JSON content. The PRD objective (US-001/003) was to display tool arguments in a read-only Monaco editor with syntax highlighting. The current code fails to accumulate streaming tool_call argument chunks, leaving the tool_input entry permanently empty.

## Root Cause

**`StreamMessageHandler.toolCall()` in `message.ts` skips all argument chunks after the first.**

LangChain's `AIMessageChunk` serialization only sends `chunk.id` (the tool_call_id) on the **first** `tool_call_chunk`. All subsequent chunks have `id: null`. The current code does:

```typescript
const tcId = chunk.id;
if (!tcId) continue;  // SKIPS every chunk after the first!
```

Proof from `backend/src/constants/mock.py` (real SSE data):
- Chunk 1: `{"name": "get_weather", "args": "", "id": "call_37nos...", "index": 0}` -- id present, args empty
- Chunk 2: `{"name": null, "args": "{\"", "id": null, "index": 0}` -- id null, args has data
- Chunk 3-6: Same pattern - id null, args accumulate `city`, `":"`, `Dallas`, `"}`

Result: tool_input entry created with `input: ""` -> `DefaultTool` returns null (line 64) -> blank display.

The `chunk.index` field (0-based position of the tool call within the AI turn) IS present on every chunk and uniquely identifies which tool call the chunk belongs to.

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/lib/utils/message.ts` | Fix `toolCall()` to resolve chunk ID via index-based mapping |
| `frontend/src/lib/utils/message.test.ts` (new) | Unit tests for streaming chunk correlation |

## User Stories

### US-FIX-001: Fix tool_call_chunk correlation to accumulate args across all chunks
**Priority: P0 (Critical)**

**Reproduction Steps:**
1. Navigate to `/chat`, select an agent with tools
2. Submit a query that triggers a tool call (e.g., "What's the weather in Dallas?")
3. Observe: tool name badge appears (green) but no JSON content renders below it

**Code Change in `message.ts` `toolCall()` method (lines 36-99):**

Replace the simple `chunk.id` lookup with an index-based resolution strategy:
1. When `chunk.id` IS present (first chunk): store `index -> id` mapping in `toolCallMapRef`
2. When `chunk.id` is null (subsequent chunks): resolve id from `index` via the stored mapping
3. Use the resolved id for all existing downstream logic (state lookup, entry creation)

Key implementation detail: store index mappings in the existing `toolCallMapRef` using a namespaced key like `_idx_${response.id}_${chunk.index}` to avoid collisions with actual tool_call_ids (which follow `call_xxxx` pattern). The `response.id` scoping handles multi-turn conversations where different AI turns may reuse the same index.

**Acceptance Criteria:**
- [ ] Tool input JSON accumulates across all SSE chunks (not just the first)
- [ ] Monaco editor displays the complete, pretty-printed JSON arguments
- [ ] Progressive streaming: partial JSON shows incrementally as chunks arrive
- [ ] Multi-tool calls (different `index` values) each accumulate independently
- [ ] No regression on `/thread/:id` page (checkpoint-loaded data still works)
- [ ] Typecheck passes (`npx tsc --noEmit` from frontend/)
- [ ] Lint passes (`npm run lint` from frontend/)

### US-FIX-002: Add unit tests for StreamMessageHandler.toolCall()
**Priority: P1 (Important)**

**New file: `frontend/src/lib/utils/message.test.ts`**

Test cases:
1. **Single tool call, multi-chunk**: First chunk has id + empty args, subsequent chunks have null id + arg fragments. Assert final `history` entry has complete parsed JSON in `input`.
2. **Multi-tool call**: Two tool calls with `index: 0` and `index: 1`, interleaved chunks. Assert two separate tool_input entries with correct accumulated args each.
3. **Single chunk with complete args**: One chunk has both id and full args string. Assert entry created correctly.

**Acceptance Criteria:**
- [ ] All 3 test cases pass via `npm run test`
- [ ] Tests use the real SSE chunk structure from `backend/src/constants/mock.py`

### US-FIX-003: Verify fix end-to-end in browser
**Priority: P2 (Verification)**

**Steps:**
1. Start dev server (`npm run dev` from frontend/)
2. Navigate to `/chat`, trigger a tool call
3. Verify Monaco editor shows JSON during streaming and after completion
4. Navigate to `/thread/:id` for an existing thread with tool calls
5. Verify tool inputs display correctly (no regression)
6. Toggle theme (Day/Night) - verify editor theme switches

**Acceptance Criteria:**
- [ ] No blank tool input rectangles on `/chat` page
- [ ] No blank tool input rectangles on `/thread/:id` page
- [ ] Monaco editors render with syntax highlighting
- [ ] Theme toggle works on tool input editors

## Verification

```bash
# 1. Type check
cd frontend && npx tsc --noEmit

# 2. Lint
cd frontend && npm run lint

# 3. Unit tests
cd frontend && npm run test

# 4. Manual browser test on /chat with a tool-calling agent
```
