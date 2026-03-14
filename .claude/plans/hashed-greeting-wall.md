# Plan: Move links below ChatInput in chat-section

## Context
In `chat-section.tsx`, the badge links (Discord, Social, Docs) currently sit **between** the subtext paragraph and the ChatInput. The user wants them moved **below** the ChatInput to match the layout pattern used in `home-section.tsx`.

Note: `ChatSection` is not currently imported anywhere — it may be legacy or used dynamically. The change is purely a reorder of JSX elements.

## File to modify
- `frontend/src/components/sections/chat-section.tsx`

## Change
Move the links div (lines 32-42) from above the ChatInput wrapper (lines 43-45) to below it. Optionally add a small top margin (`mt-2` or `mt-3`) for spacing, matching `home-section.tsx` which uses `mt-3`.

### Before (order):
1. Subtext paragraph
2. Links div (badges)
3. ChatInput

### After (order):
1. Subtext paragraph
2. ChatInput
3. Links div (badges, with `mt-2` added)

## Verification
- `npm run lint` passes
- Visual check: links appear below the input
