# Implementation Tasks: ticket.md Ralph Loop Integration

## Core Implementation

- [ ] Task 1: Rewrite ticket.md Steps 8-11 to replace /team Phases 4-5 with Ralph loop
    - Files: `.claude/commands/ralph/ticket.md`
    - Changes:
      - Step 8: Constrain to Phases 0-3 only (council analysis, no implementation)
      - Step 9: NEW - Generate PRD from council outputs using prd skill
      - Step 10: NEW - Convert PRD to .ralph/prd.json using ralph skill, override branchName
      - Step 11: NEW - Launch `bash .ralph/ralph.sh` as subagent
      - Step 12: MODIFIED - Report workflow status (remove PR creation)
    - Acceptance: ticket.md contains steps 1-12 with Ralph loop integration

- [ ] Task 2: Update error handling section to cover new failure modes
    - Files: `.claude/commands/ralph/ticket.md`
    - Changes: Add error cases for PRD generation failure, prd.json conversion failure, Ralph loop failure/partial completion
    - Acceptance: Error handling section covers all new steps

- [ ] Task 3: Update report section and example invocations
    - Files: `.claude/commands/ralph/ticket.md`
    - Changes: Report reflects Ralph loop output instead of direct implementation. Examples unchanged.
    - Acceptance: Report section lists Ralph-specific artifacts

## Verification

- [ ] Task 4: Review final ticket.md for completeness and consistency
    - Acceptance: All step numbers are sequential, all variable references are consistent, error handling covers all steps
