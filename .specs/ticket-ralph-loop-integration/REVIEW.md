# Council Review: ticket.md Ralph Loop Integration

## Feature Under Review

Modify `.claude/commands/ralph/ticket.md` to initiate the Ralph autonomous loop after AI council produces REVIEW.md, TASKS.md, and USER_STORIES.md, instead of executing direct implementation (Phases 4-5).

## Proposal Comparison Matrix

| Aspect | WORKFLOW_ORCHESTRATOR | HANDOFF_ARCHITECT | DEVEX_GUARDIAN | Council Verdict |
|--------|----------------------|-------------------|----------------|-----------------|
| Architecture | Let /team run fully, ignore P4-5 | Manual phases or modify /team | Manual phases or modify /team | Rewrite ticket.md instructions for P0-3 only |
| branchName | Use worktree branch, pass to ralph skill | Use worktree branch, validate | Use worktree branch, auto-fix mismatch | Use worktree branch, validate before launch |
| Ralph path | Symlink .ralph into worktree | Keep at repo root | Run from worktree with ../../ path | Keep at repo root (ralph.sh uses SCRIPT_DIR) |
| PR creation | Keep, adapt to Ralph commits | Keep as Step 13 | Remove, report only | Remove PR creation, Ralph + user handles it |
| Error handling | Basic exit code check | Medium detail | Comprehensive | Comprehensive per DEVEX_GUARDIAN |

## Consensus Points

1. **Steps 1-7 unchanged** — issue extraction, worktree, user stories all stay
2. **Step 8 becomes council-only** — Phases 0-3, no implementation
3. **New bridging steps** — PRD generation, prd.json conversion, ralph.sh launch
4. **branchName = worktree branch** — no `ralph/` prefix needed
5. **Ralph handles implementation** — iterative commits, quality checks per story
6. **PR creation deferred** — not part of this automated flow (Ralph doesn't create PRs)

## Divergence Resolution

### Q1: How to limit /team to Phases 0-3?

**Decision:** Rewrite ticket.md Step 8 instructions to explicitly say "execute Phases 0-3 only." The `/team` command is a markdown instruction file — the executing agent reads and follows it. We instruct it to stop after Phase 3. No code changes to team.md needed.

### Q2: Where does prd.json live?

**Decision:** At repo root `.ralph/prd.json`. ralph.sh uses `SCRIPT_DIR` to resolve paths, so prd.json is always at `.ralph/prd.json` regardless of working directory. The worktree is just where git operations happen. No symlinks needed.

### Q3: Should ticket.md create the PR?

**Decision:** Remove PR creation from ticket.md. Ralph commits iteratively but doesn't push or create PRs. After Ralph completes, the user reviews and creates the PR manually (or runs a separate command). This keeps ticket.md focused on the automation pipeline.

### Q4: Story sizing from council output?

**Decision:** The PRD generation step must include explicit sizing instructions. Council TASKS.md may produce tasks that are too large for one Ralph iteration. The PRD command must instruct splitting large tasks.

## Unified Implementation Plan

### Modified ticket.md Structure

```
Steps 1-7: [UNCHANGED] Issue → worktree → user stories → team query
Step 8:    [MODIFIED] Invoke /team Phases 0-3 only → REVIEW.md, TASKS.md, PROPOSAL_*.md
Step 9:    [NEW] Generate PRD from council outputs → tasks/prd-<feature>.md
Step 10:   [NEW] Convert PRD to .ralph/prd.json (branchName = worktree branch)
Step 11:   [NEW] Launch ralph.sh as subagent
Step 12:   [MODIFIED] Report completion status (no PR creation)
```

### Critical Requirements

1. Step 9 query must include: "Archive previous prd.json & progress.txt THEN load the prd skill and create a PRD for [feature]"
2. Step 10 query must include: "Load the ralph skill and convert tasks/prd-[feature].md to .ralph/prd.json"
3. Step 10 must override branchName to match worktree branch
4. Step 11 runs `bash .ralph/ralph.sh` from worktree directory
5. Error handling at each step with clear recovery instructions

## Risk Consolidation

| Risk | Severity | Mitigation |
|------|----------|------------|
| ralph.sh path resolution | LOW | Uses SCRIPT_DIR, works correctly from any cwd |
| branchName mismatch | MEDIUM | Validate after prd.json generation |
| Story sizing | MEDIUM | Explicit sizing rules in PRD generation prompt |
| Ralph incomplete | MEDIUM | Report partial completion, provide resume command |
| Council output incomplete | LOW | Verify artifacts exist before proceeding |

## Final Verdict

**GO** — No modifications needed to existing systems (/team, ralph.sh, skills). Only ticket.md needs rewriting. Low risk, clear rollback path (revert ticket.md).

**Confidence Level:** High
