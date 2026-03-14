---
name: complexity-audit
description: |
  Orchestrates the full four-phase complexity audit pipeline for any target path or glob pattern in the
  Orchestra codebase. Use this skill when a user requests a complexity audit, tech-debt audit, refactor
  assessment, or complexity analysis. Triggers on: complexity audit, run audit, tech debt audit, audit
  backend, audit frontend, audit services, audit components, measure complexity, complexity report,
  refactor audit, code quality audit.

  Accepts a target path (e.g., `backend/src/services/`, `frontend/src/components/`, or `all`) and an
  optional existing GitHub issue URL. Handles all setup — issue creation, branch, worktree, .audit/
  directory — then delegates execution to the complexity-auditor agent, and finishes with PR reporting.
---

# Complexity Audit

Runs a four-phase complexity audit (measure, identify patterns, benchmark, draft PR) on a specified
target path. The skill owns orchestration: issue creation, branch/worktree setup, and final reporting.
The `complexity-auditor` agent owns execution.

---

## Variables

TARGET: $ARGUMENTS.target (required — path or glob pattern, e.g., `backend/src/services/`,
`frontend/src/components/`, or `all`)

ISSUE_URL: $ARGUMENTS.url (optional — existing GitHub issue URL to skip issue creation)

ORCHESTRA_PROJECT_ROOT: The orchestra git repository root where `.claude/`, `.worktrees/`, and
`Makefile` live. Resolve via `git rev-parse --show-toplevel`. All paths anchor to this variable.

---

## Pre-Phase: Read Issue Template

**MANDATORY first step.** Read the issue template before any other work.

1. _READ_ `.github/ISSUE_TEMPLATE/complexity_audit.md` for conventions:
   - Branch naming pattern (`refactor/[issue#]-complexity-audit`)
   - PR title format (`FROM refactor/[issue#]-complexity-audit TO development`)
   - Worktree path pattern (`$ORCHESTRA_PROJECT_ROOT/.worktrees/refactor-[issue#]`)
   - `.audit/` directory deliverables (complexity_ranking.md, pattern_recommendations.yaml, benchmarks/)
   - Non-negotiable audit rules (measure-first, atomic commits, benchmark gates)
2. _RESOLVE_ `ORCHESTRA_PROJECT_ROOT`:
   - RUN `git rev-parse --show-toplevel`
3. _DETERMINE_ language(s) from TARGET path:
   - `backend/` or `*.py` patterns → Python (`radon`)
   - `frontend/` or `*.ts`/`*.tsx` patterns → TypeScript (`escomplex`, `jscpd`)
   - `all` → both Python and TypeScript
4. _STORE_ conventions, root path, and language(s) for use in all subsequent phases

---

## Phase 0: Issue & Branch Setup

### If ISSUE_URL is provided:

1. _VALIDATE_ URL format (expected: `https://github.com/<owner>/<repo>/issues/<number>`)
2. _FETCH_ issue details:
   - RUN `gh issue view <ISSUE_URL> --json number,title,body,labels`
3. _EXTRACT_ issue number from response
4. _REPORT_ "Using existing issue #<number> — skipping issue creation"
5. Proceed to **Branch & Worktree Setup** below

### If no ISSUE_URL is provided:

1. _COMPOSE_ issue body using TARGET scope:
   ```markdown
   ## Scope

   - **Target**: <TARGET>
   - **Language(s)**: <determined from TARGET>
   - **Reason for audit**: Complexity audit requested via /complexity-audit skill

   ## Four Mandatory Phases

   Follows the complexity audit protocol defined in `.github/ISSUE_TEMPLATE/complexity_audit.md`.

   ## Acceptance Criteria

   - [ ] Phase 1 ranking complete (`.audit/complexity_ranking.md`)
   - [ ] Phase 2 recommendations (`.audit/pattern_recommendations.yaml`) with estimated deltas
   - [ ] Phase 3 benchmark suite with baseline/current snapshots and PASS/FAIL report
   - [ ] Phase 4 draft PR created with full benchmark data in body
   - [ ] Test count >= baseline; pass rate = 100%
   ```
2. _CREATE_ the issue:
   - RUN:
     ```bash
     gh issue create \
       --title "audit: <TARGET>" \
       --body "<composed body>" \
       --label "tech-debt,complexity-audit"
     ```
3. _CAPTURE_ issue number from output
4. _REPORT_ "Created issue #<number>: audit: <TARGET>"

### Branch & Worktree Setup (always runs):

1. _DETERMINE_ naming:
   - Branch: `refactor/<issue#>-complexity-audit`
   - Worktree path: `$ORCHESTRA_PROJECT_ROOT/.worktrees/refactor-<issue#>`
2. _FETCH_ latest development:
   - RUN `git fetch origin development`
3. _CREATE_ worktree:
   - RUN `git worktree add $ORCHESTRA_PROJECT_ROOT/.worktrees/refactor-<issue#> -b refactor/<issue#>-complexity-audit origin/development`
4. _CREATE_ `.audit/` directory structure:
   - RUN `mkdir -p $ORCHESTRA_PROJECT_ROOT/.worktrees/refactor-<issue#>/.audit/benchmarks`
5. _INITIALIZE_ worktree with changelog:
   - RUN `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/refactor-<issue#> && bash $ORCHESTRA_PROJECT_ROOT/backend/scripts/changelog.sh`
   - RUN `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/refactor-<issue#> && git add Changelog.md .audit/ && git commit -s -m "init refactor/<issue#>-complexity-audit"`
   - RUN `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/refactor-<issue#> && git push -u origin refactor/<issue#>-complexity-audit`
6. _ADD_ implementation comment to issue:
   - RUN:
     ```bash
     gh issue comment <issue#> --body "$(cat <<'EOF'
     ## Audit Started

     **Branch**: `refactor/<issue#>-complexity-audit`
     **Worktree**: `$ORCHESTRA_PROJECT_ROOT/.worktrees/refactor-<issue#>`
     **PR title**: `FROM refactor/<issue#>-complexity-audit TO development`
     **Target**: `<TARGET>`
     EOF
     )"
     ```
7. _CREATE_ draft PR:
   - RUN:
     ```bash
     cd $ORCHESTRA_PROJECT_ROOT/.worktrees/refactor-<issue#> && gh pr create \
       --draft \
       --base development \
       --title "FROM refactor/<issue#>-complexity-audit TO development" \
       --body "$(cat <<'EOF'
     ## Summary
     Resolves #<issue#>

     **Target**: `<TARGET>`
     **Language(s)**: <language(s)>

     ## Status
     Audit in progress — this PR will be updated with benchmark results when the complexity-auditor agent completes.

     Generated by `/complexity-audit` skill.
     EOF
     )"
     ```
   - _CAPTURE_ the PR URL from output
8. _REPORT_ "Worktree created at $ORCHESTRA_PROJECT_ROOT/.worktrees/refactor-<issue#>. Draft PR opened: <PR URL>"

---

## Phase 1–4: Delegate to complexity-auditor Agent

Hand off execution to the `complexity-auditor` agent. The agent runs all four audit phases inside the
worktree.

1. _INVOKE_ the complexity-auditor agent with:
   ```
   Run a complexity audit on <TARGET> in the worktree at
   $ORCHESTRA_PROJECT_ROOT/.worktrees/refactor-<issue#> on branch
   refactor/<issue#>-complexity-audit.

   Issue: #<issue#>
   Language(s): <language(s)>
   Worktree: $ORCHESTRA_PROJECT_ROOT/.worktrees/refactor-<issue#>

   Follow the four-phase audit protocol from .github/ISSUE_TEMPLATE/complexity_audit.md:
   - Phase 1: Measure (produce .audit/complexity_ranking.md)
   - Phase 2: Identify patterns (produce .audit/pattern_recommendations.yaml)
   - Phase 3: Benchmark (produce .audit/benchmarks/ snapshots)
   - Phase 4: Apply refactors with atomic commits

   Commit and push after each phase. All work inside the worktree only.
   ```
2. _WAIT_ for the agent to complete all four phases
3. _VERIFY_ artifacts exist in the worktree:
   - RUN `ls $ORCHESTRA_PROJECT_ROOT/.worktrees/refactor-<issue#>/.audit/`
   - Expected: `complexity_ranking.md`, `pattern_recommendations.yaml`, `benchmarks/`

---

## Final Phase: Report & PR Finalization

1. _READ_ audit artifacts to compose the reviewer report:
   - RUN `cat $ORCHESTRA_PROJECT_ROOT/.worktrees/refactor-<issue#>/.audit/complexity_ranking.md`
   - RUN `cat $ORCHESTRA_PROJECT_ROOT/.worktrees/refactor-<issue#>/.audit/pattern_recommendations.yaml`
   - RUN `ls $ORCHESTRA_PROJECT_ROOT/.worktrees/refactor-<issue#>/.audit/benchmarks/`
2. _UPDATE_ PR description with audit results:
   - _COMPOSE_ reviewer-friendly PR body:
     ```markdown
     ## Summary
     Resolves #<issue#>

     **Target**: `<TARGET>`
     **Language(s)**: <language(s)>

     ## Complexity Ranking (Top 10)
     <excerpt from .audit/complexity_ranking.md — top 10 highest-scoring files>

     ## Pattern Recommendations
     <excerpt from .audit/pattern_recommendations.yaml — recommended patterns with estimated impact>

     ## Benchmark Results
     <benchmark gate results: CC delta, duplication delta, test pass rate>

     ## Phases Completed
     - [x] Phase 1: Measure (`.audit/complexity_ranking.md`)
     - [x] Phase 2: Identify patterns (`.audit/pattern_recommendations.yaml`)
     - [x] Phase 3: Benchmark (`.audit/benchmarks/`)
     - [x] Phase 4: Refactors applied with atomic commits

     Generated by `/complexity-audit` skill.
     ```
   - RUN `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/refactor-<issue#> && gh pr edit --body "<reviewer report>"`
3. _MARK_ PR ready for review:
   - RUN `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/refactor-<issue#> && gh pr ready`
4. _REPORT_ completion summary (see Completion Report section below)

---

## Completion Report

```
## Complexity Audit Complete

**Issue**: #<issue#> — audit: <TARGET>
**Branch**: refactor/<issue#>-complexity-audit
**Worktree**: $ORCHESTRA_PROJECT_ROOT/.worktrees/refactor-<issue#>
**PR**: <PR URL> (draft -> ready for review)
**Target**: <TARGET>
**Language(s)**: <language(s)>

### Audit Artifacts
- .audit/complexity_ranking.md — ranked complexity table
- .audit/pattern_recommendations.yaml — pattern recommendations
- .audit/benchmarks/ — baseline and post-refactor snapshots

### Next Steps
- Review PR at <PR URL>
- Check benchmark gate results in PR description
- Merge when all acceptance criteria are satisfied
```

---

## Error Handling

- **TARGET not provided**: _REPORT_ "You must provide a `target` argument. Example: `/complexity-audit target=backend/src/services/`"
- **Invalid ISSUE_URL format**: _REPORT_ "Invalid GitHub issue URL. Expected: https://github.com/owner/repo/issues/NUMBER"
- **Issue not found**: _REPORT_ "Could not fetch issue. Check URL and GitHub auth: `gh auth status`"
- **Worktree already exists**: _REPORT_ "Worktree already exists at $ORCHESTRA_PROJECT_ROOT/.worktrees/refactor-<issue#>. Remove with `git worktree remove $ORCHESTRA_PROJECT_ROOT/.worktrees/refactor-<issue#>` first."
- **Agent did not produce artifacts**: _REPORT_ "complexity-auditor agent did not produce expected artifacts in .audit/. Check agent output and retry."
- **Benchmark gate failure**: _REPORT_ the failing gate metric. The agent should have halted on regression — do not mark PR ready if tests fail.
- **Push failure**: _REPORT_ "Failed to push. Try: `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/refactor-<issue#> && git push -u origin refactor/<issue#>-complexity-audit`"
- **PR creation failure**: _REPORT_ error and provide manual gh pr create command

---

## Warnings

- **Always read the issue template first** (Pre-Phase) — conventions drive all downstream phases
- **Never skip `.audit/` directory creation** — the agent writes deliverables there
- **Commit messages must be signed** (`-s` flag) per repository guidelines
- **The skill does NOT implement refactors** — the complexity-auditor agent handles all code changes
- **Benchmark gates are non-negotiable** — do not mark the PR ready if any gate fails (CC delta >5%, duplication >2%, test failures)
- **All work happens inside the worktree** — never commit to the main working tree

---

## Examples

### Example 1: Audit backend services (no existing issue)

User: "Run a complexity audit on backend/src/services/"
Assistant: I'll orchestrate a complexity audit on `backend/src/services/`.
- Reads `.github/ISSUE_TEMPLATE/complexity_audit.md` for conventions
- Creates issue: `audit: backend/src/services/` with labels `tech-debt,complexity-audit`
- Creates branch `refactor/885-complexity-audit` and worktree `.worktrees/refactor-885`
- Creates draft PR, then delegates to complexity-auditor agent
- Reports: "Audit complete. PR #886 ready for review: <URL>"

### Example 2: Audit frontend components from existing issue

User: "Run a complexity audit on frontend/src/components/ — use issue https://github.com/ruska-ai/orchestra/issues/890"
Assistant: I'll use existing issue #890 and skip issue creation.
- Reads issue #890 for context
- Creates branch `refactor/890-complexity-audit` and worktree `.worktrees/refactor-890`
- Delegates to complexity-auditor agent for all four phases
- Updates PR description with benchmark results, marks ready for review

### Example 3: Full codebase audit

User: "Audit all — I want a complexity report for the entire codebase"
Assistant: I'll audit both backend (Python) and frontend (TypeScript) targets.
- Creates issue: `audit: all`
- Sets language(s) to Python + TypeScript
- Delegates to complexity-auditor agent with both language toolchains active
- Produces unified `.audit/complexity_ranking.md` across all files
