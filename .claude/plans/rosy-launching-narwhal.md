# Plan: Move Links Above ChatInput in AgentSection

## Context
On the `/chat` page (initial landing view), the links row (Docs, Blog, Social, Slack) currently renders **below** the ChatInput. The user wants them moved **between the subtext and the ChatInput** — i.e., above the input area.

## File to Modify

### `frontend/src/components/sections/agent-section.tsx`

Current order (lines 22-90):
1. `<p>` subtext (line 23)
2. `<div>` ChatInput wrapper (lines 24-26)
3. `<div>` links row (lines 29-90)

Target order:
1. `<p>` subtext (line 23)
2. `<div>` links row — moved here, update comment and change `mt-3` → `mb-3`
3. `<div>` ChatInput wrapper

**Changes:**
- Cut the links `<div>` block (lines 28-90) and paste it between line 23 (`<p>` subtext) and line 24 (`<div>` ChatInput wrapper)
- Change `mt-3` to `mb-3` on the links container so spacing flows downward toward the input
- Update the comment to reflect new position

No other files need changes.

## Verification
1. `npx tsc --noEmit` from `frontend/` — no type errors
2. `npm run test` — no test regressions
3. Navigate to `/chat` — links row (Docs, Blog, Social, Slack) appears between subtext and ChatInput
