# Plan: Consolidate #810 Task Files

## Context

Two overlapping files exist for the same feature (#810 docs drift):
- `tasks/plan-810-docs-drift-wiki.md` — lightweight strategy doc
- `tasks/prd-docs-drift-wiki.md` — full PRD with user stories + acceptance criteria

This creates confusion about the source of truth. The project convention is clear: **PRDs are the standard** (27 PRD files vs 1 plan file in `tasks/`). The plan file is an anomaly. The PRD already contains everything from the plan plus structured acceptance criteria, and it feeds directly into `.ralph/prd.json` which Ralph uses to execute work.

## Approach

**Delete the plan file. Keep the PRD as the sole source of truth.**

### Steps

1. Delete `tasks/plan-810-docs-drift-wiki.md`
2. No changes needed to the PRD — it already covers all content from the plan

### Why not merge?

The PRD already contains every item from the plan:
- Plan's "Update Assistants Page" = PRD's US-001
- Plan's "Review & Expand Memories Page" = PRD's US-002
- Plan's "Create Schedules/Crons Page" = PRD's US-003
- Plan's "Create Projects Page" = PRD's US-004
- Plan's "Create Chat Page Documentation" = PRD's US-005
- Plan's "Update Sidebar" = PRD's US-006

There is zero unique content in the plan file that isn't already in the PRD.

## Files Changed

- `tasks/plan-810-docs-drift-wiki.md` — **delete**

## Verification

- Confirm `tasks/prd-docs-drift-wiki.md` still exists and is complete
- Confirm `.ralph/prd.json` is unaffected (it references user stories, not the plan file)
