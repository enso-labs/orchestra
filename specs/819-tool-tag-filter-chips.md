# Spec: #819 — Tool Tag Filter Chips for Platform Tools Panel

## Current State

The tag filter chips feature is **already implemented** in the codebase:
- `PlatformToolsPanel.tsx` — has tag chip bar, batch enable/disable buttons, combined filtering with search
- `useToolSelection.ts` — has `selectMultiple` and `deselectMultiple` methods
- `index.tsx` — props are wired through
- `types.ts` — `Tool` interface has `tags: string[]`

## What's Missing

1. **Tests** — No test file exists at `__tests__/PlatformToolsPanel.test.tsx`
2. **Verification** — Need to verify all acceptance criteria from the issue are met in the current implementation

## Acceptance Criteria Check

### US-005: Tag filter chips
- [x] "All" chip shown by default and active on initial render (`activeTag === null`)
- [x] One chip per unique tag derived from `tags[]` 
- [x] Each chip displays tag name and count
- [x] Clicking a tag chip filters the grid
- [x] Clicking "All" clears filter
- [x] Only one tag active at a time (radio-style)
- [x] Tag filtering works with text search
- [x] Zero-count tags are visually dimmed
- [x] Chip bar is horizontally scrollable (`overflow-x-auto`)
- [ ] Typecheck passes — needs verification
- [ ] Lint passes — needs verification

### US-006: Batch enable/disable
- [x] Enable All / Disable All buttons appear when tag active
- [x] Enable All selects all filtered tools
- [x] Disable All deselects all filtered tools
- [x] Buttons hidden when "All" active
- [x] Actions apply instantly
- [x] Toast confirms action
- [x] Persistence via debounced `patchDefaults`
- [ ] Tests needed

## Work Items

1. Create `PlatformToolsPanel.test.tsx` with tests for:
   - Tag chip rendering
   - Tag filtering
   - Combined search + tag filtering
   - Batch enable/disable
   - Dimmed tags when count is zero
2. Run typecheck and lint
3. Verify in browser using agent-browser skill
