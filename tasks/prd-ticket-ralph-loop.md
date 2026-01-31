# PRD: ticket.md Ralph Loop Integration

## Introduction

Modify `.claude/commands/ralph/ticket.md` so that after the AI council produces its planning artifacts (REVIEW.md, TASKS.md, USER_STORIES.md via Phases 0-3 of `/team`), the workflow generates a PRD, converts it to `.ralph/prd.json`, and launches the Ralph autonomous loop for iterative implementation — replacing the current direct implementation approach (Phases 4-5).

## Goals

- Replace direct implementation (team Phases 4-5) with Ralph autonomous loop
- Bridge council outputs to Ralph's prd.json format
- Ensure branchName in prd.json matches the worktree branch (no `ralph/` prefix)
- Provide clear error handling and reporting for the new workflow steps
- Maintain all existing Steps 1-7 (issue extraction, worktree, user stories)

## User Stories

### US-001: Rewrite Step 8 to constrain /team to Phases 0-3 only
**Description:** As a developer running `/ticket`, I want the team workflow to stop after council analysis so that implementation is handled by Ralph instead.

**Acceptance Criteria:**
- [ ] Step 8 in ticket.md explicitly instructs to execute only Phases 0-3 of /team
- [ ] Step 8 includes verification that REVIEW.md and TASKS.md exist before proceeding
- [ ] Phase 4 (implementation) and Phase 5 (validation) are NOT referenced as expected outputs
- [ ] Typecheck passes

### US-002: Add Step 9 — Generate PRD from council outputs
**Description:** As a developer running `/ticket`, I want a PRD generated from the council's REVIEW.md, TASKS.md, and USER_STORIES.md so that Ralph has a structured input.

**Acceptance Criteria:**
- [ ] Step 9 reads council artifacts from the spec folder
- [ ] Step 9 composes a PRD generation query that includes council context and Ralph sizing rules
- [ ] Step 9 saves PRD to `tasks/prd-<feature-slug>.md`
- [ ] Step 9 verifies the PRD file was created
- [ ] Typecheck passes

### US-003: Add Step 10 — Convert PRD to .ralph/prd.json
**Description:** As a developer running `/ticket`, I want the PRD converted to Ralph's JSON format with the correct branch name so Ralph can execute.

**Acceptance Criteria:**
- [ ] Step 10 invokes the ralph skill to convert the PRD to `.ralph/prd.json`
- [ ] Step 10 explicitly instructs setting branchName to the worktree branch (not `ralph/` prefix)
- [ ] Step 10 validates that prd.json branchName matches the worktree branch
- [ ] Step 10 handles mismatch by fixing branchName before proceeding
- [ ] Typecheck passes

### US-004: Add Step 11 — Launch Ralph autonomous loop
**Description:** As a developer running `/ticket`, I want Ralph launched automatically so implementation proceeds without manual intervention.

**Acceptance Criteria:**
- [ ] Step 11 runs `bash ../../.ralph/ralph.sh` from the worktree directory
- [ ] Step 11 monitors for Ralph's completion signal (`<promise>COMPLETE</promise>`)
- [ ] Step 11 captures exit status (0 = complete, 1 = partial)
- [ ] Step 11 reports Ralph execution status
- [ ] Typecheck passes

### US-005: Update Step 12 — Report workflow completion with Ralph status
**Description:** As a developer running `/ticket`, I want a clear report showing council artifacts, Ralph status, and next steps.

**Acceptance Criteria:**
- [ ] Step 12 lists all council artifacts (USER_STORIES.md, PROPOSAL_*.md, REVIEW.md, TASKS.md)
- [ ] Step 12 lists Ralph artifacts (prd.json, progress.txt)
- [ ] Step 12 reports COMPLETE or PARTIAL status with story counts
- [ ] Step 12 provides next steps (push + PR if complete, resume if partial)
- [ ] Old PR creation steps are removed (user handles PR manually)
- [ ] Typecheck passes

### US-006: Update error handling section for new failure modes
**Description:** As a developer running `/ticket`, I want clear error messages and recovery steps when any new step fails.

**Acceptance Criteria:**
- [ ] Error handling covers: council incomplete, PRD generation failure, prd.json conversion failure, branchName mismatch, Ralph loop failure, Ralph partial completion
- [ ] Each error case provides a specific recovery command or instruction
- [ ] Typecheck passes

## Functional Requirements

- FR-1: ticket.md Steps 1-7 remain unchanged
- FR-2: Step 8 must explicitly stop after Phase 3 (no implementation or validation phases)
- FR-3: Step 9 must archive previous prd.json/progress.txt before generating new PRD
- FR-4: Step 9 must include Ralph story sizing rules (1-3 files per story, split by layer)
- FR-5: Step 10 must set prd.json branchName to match the worktree branch exactly
- FR-6: Step 11 must run ralph.sh from the worktree directory using `../../.ralph/ralph.sh` path
- FR-7: Step 12 must NOT include automatic PR creation (deferred to user)
- FR-8: Error handling must cover all 6 new failure modes with recovery instructions

## Non-Goals

- No modifications to `/team` command (team.md unchanged)
- No modifications to `ralph.sh` or `prompt.md`
- No modifications to the prd or ralph skills
- No automatic PR creation after Ralph completes
- No concurrent Ralph execution support (one ticket at a time)

## Technical Considerations

- ralph.sh resolves paths relative to SCRIPT_DIR (`.ralph/` at repo root), so prd.json always lives at `.ralph/prd.json` regardless of working directory
- The worktree branch (e.g., `feat/707-ticket-md-ralph-loop`) does NOT use `ralph/` prefix, but ralph.sh's archival logic handles this gracefully
- Ralph auto-archives previous runs when branchName changes (ralph.sh lines 14-37)
- Only one Ralph run can execute at a time (shared `.ralph/prd.json` state)

## Success Metrics

- `/ticket` command successfully bridges from council analysis to Ralph loop without manual intervention
- Ralph executes at least one user story autonomously from council-derived prd.json
- Error states produce actionable recovery instructions
- Workflow completion report accurately reflects Ralph's execution status

## Open Questions

- Should max iterations for ralph.sh be configurable via ticket.md arguments?
- Should ticket.md support a `--no-ralph` flag to fall back to direct implementation?
