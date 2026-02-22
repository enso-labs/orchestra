# Plan: Update PRD and prd.json for Blank Tool Inputs Bug

## Context

Screenshot `03-editor-default-tool.png` reveals that after US-001 (Monaco Editor replacement), tool inputs on the `/chat` page (new chat, streaming path) render as **blank dark rectangles**. The Monaco editors mount but show no content. Tool names, call IDs, and tool results are all visible -- only the editor content area is empty. The `/thread/:id` page works correctly because it loads finalized messages from checkpoints.

This means US-002 ("Verify streaming and complete tool display") was only partially verified (thread page only, not new chat page). A new user story is needed to track the fix.

## Changes

### 1. Update `tasks/prd-monaco-tool-display.md`

**Add US-006** after US-005:
- Title: "Fix blank tool inputs on new chat page during streaming"
- Acceptance criteria covering: content visible on `/chat`, progressive streaming updates, no regression on `/thread/:id`, consistent state management, proper memo behavior
- Investigation areas listing the four key files and specific line ranges

**Update "Open Questions"** section from "None" to questions about:
- Loading/skeleton state for empty streaming input
- `in_mem_messages` vs state sync (`setMessages` vs `setMessagesState`)
- Whether Monaco is appropriate for rapidly-updating streaming content

### 2. Update `.ralph/prd.json`

**US-002**: Set `passes: false`, update `notes` with partial failure explanation referencing screenshot evidence and root cause (streaming data flow, `in_mem_messages` divergence)

**Add US-003**: New user story with:
- 8 acceptance criteria mirroring the PRD US-006
- `priority: 3`, `passes: false`
- Notes listing key files: `useChat.ts`, `message.ts`, `Default.tsx`, `ChatMessages.tsx`

## Files Modified

| File | Action |
|------|--------|
| `tasks/prd-monaco-tool-display.md` | Add US-006, update Open Questions |
| `.ralph/prd.json` | Mark US-002 failing, add US-003 |

## Verification

- Confirm prd.json is valid JSON after edits
- Confirm PRD markdown renders correctly
- No code changes in this step -- just documentation updates
