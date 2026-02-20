---
name: bug-report
description: "Template-driven bug reproduction and TDD-first fixing pipeline. Orchestrates: bug template reading, duplication check (regression-aware), GitHub issue creation, branch/worktree setup, bug reproduction with agent-browser, root cause analysis, PRD generation with TDD-first story ordering, Ralph JSON conversion, commit/push, and Ralph execution. Use when you have a bug to reproduce and fix. Triggers on: bug report, fix bug, reproduce bug, bug to fix, report bug, tdd fix."
---

# Bug Report

Converts a bug description or existing GitHub issue into a fully diagnosed and fixed feature by orchestrating the complete pipeline: template reading, reproduction, root cause analysis, TDD-first PRD generation, Ralph conversion, and autonomous execution.

---

## Variables

BUG: $ARGUMENTS.bug (optional if `url` is provided)
URL: $ARGUMENTS.url (optional if `bug` is provided)
ORCHESTRA_PROJECT_ROOT: The **orchestra project root** &mdash; the git repository root where `.claude/`, `.worktrees/`, and `Makefile` live. Resolve via `git rev-parse --show-toplevel`. All paths in this skill are anchored to this variable. Always `cd $ORCHESTRA_PROJECT_ROOT` before running commands to ensure worktrees are created in the correct location.
BUG_TEMPLATE_PATH: `.github/ISSUE_TEMPLATE/bug_report.md`
WORKSPACE_DOCS: `orchestra/wiki`

**Exactly one of `bug` or `url` must be provided.**

---

## Input Formats

### Option A: Pass a bug description directly via `bug`

```
bug="When clicking Save on assistant edit, validation error appears even with model selected."
```

The skill will parse the description, derive severity, and extract reproduction steps.

### Option B: Pass a GitHub issue URL via `url`

```
url="https://github.com/ruska-ai/orchestra/issues/796"
```

When `url` is provided the skill extracts all context from the existing issue:
- RUN `gh issue view <URL> --json number,title,body,labels`
- _PARSE_ broken-experience stories from the issue body (look for "User Stories" section or "As a... I expect... but instead..." patterns)
- _EXTRACT_ severity, steps to reproduce, root cause hypothesis, affected files
- _EXTRACT_ issue number and title for branch naming
- **Skips Phase 1 (duplication check)** &mdash; the issue already exists
- **Skips Phase 2 (issue creation)** &mdash; the issue already exists
- Proceeds directly to Phase 3 with the extracted data

---

## Commit Strategy: Early & Often

**Commit after every phase that produces artifacts.** Each phase&apos;s output should be committed and pushed immediately so that:

- Work is never lost if a later phase fails
- The PR on GitHub shows incremental progress
- Reviewers can follow the pipeline&apos;s history via commit log

The pattern at the end of each artifact-producing phase:
```bash
cd $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#>
git add <phase artifacts>
git commit -s -m "<phase commit message>"
git push
```

---

## Pre-Phase: Read Bug Report Template

**MANDATORY first step.** Read the bug report template to extract conventions before any other work.

1. _READ_ the bug report template at `$ORCHESTRA_PROJECT_ROOT/.github/ISSUE_TEMPLATE/bug_report.md`
2. _EXTRACT_ conventions from the template:
   - Branch naming pattern (e.g., `bug/[issue#]-[shortdesc]`)
   - PR title format (e.g., `FROM bug/[issue#]-[shortdesc] TO development`)
   - Worktree path pattern (e.g., `$WORKSPACE/.worktrees/bug-[issue#]`)
   - Required issue sections (User Stories as broken experiences, Summary, Severity, Steps to Reproduce, etc.)
   - Validation tools (`agent-browser` for E2E)
   - Design principles (fix root cause not symptom, TDD-first, no regressions, least amount of changes)
3. _STORE_ these conventions for use in all subsequent phases
4. _NOTE_ wiki workspace at `$ORCHESTRA_PROJECT_ROOT/wiki` for bug context and documentation

---

## Phase 0: Validate Input & Confirm Bug Scope

### If `url` was provided:

1. _VALIDATE_ URL format (expected: `https://github.com/<owner>/<repo>/issues/<number>`)
2. _FETCH_ issue details:
   - RUN `gh issue view <URL> --json number,title,body,labels`
3. _PARSE_ broken-experience stories from the issue body (look for "User Stories" section or "As a... I expect... but instead..." patterns)
   - The issue **must** contain at least one broken-experience story. If none are found, _HALT_ and report the error.
4. _EXTRACT_ additional context:
   - Severity level (Critical / High / Medium / Low)
   - Steps to Reproduce
   - Expected vs. Actual Behavior
   - Root Cause Hypothesis
   - Affected Files
5. _SET_ issue number and bug name from the issue metadata (slugify title to kebab-case, strip `fix:` prefix)
6. _PRESENT_ extracted data to the user for confirmation:
   ```
   ## Bug Scope (from Issue #<number>)

   **Issue**: #<number> - <title>
   **Bug name**: <bug-name>
   **Severity**: <severity>
   **Stories** (<N> total):
   - BS-001: <broken-experience story 1>
   - BS-002: <broken-experience story 2>
   ...
   **Steps to Reproduce**:
   1. <step 1>
   2. <step 2>
   ...
   **Root Cause Hypothesis**: <hypothesis or "Unknown">

   Does this look correct? (y/n)
   ```
7. _WAIT_ for user confirmation, then **skip to Phase 3**

### If `bug` was provided:

1. _PARSE_ the BUG variable into a structured bug description
2. _DERIVE_ severity from the description (default to Medium if unclear)
3. _EXTRACT_ reproduction steps from the description (or note that manual steps are needed)
4. _EXTRACT_ a short bug name from the description (kebab-case, e.g., `save-validation-error`)
5. _COMPOSE_ broken-experience stories from the description:
   - Format: "As a **[role]**, I expect **[expected behavior]** when **[action]**, but instead **[actual behavior]**."
6. _PRESENT_ parsed data to the user for confirmation:
   ```
   ## Bug Scope

   **Bug name**: <bug-name>
   **Severity**: <severity>
   **Stories** (<N> total):
   - BS-001: <broken-experience story 1>
   ...
   **Steps to Reproduce**:
   1. <step 1> (derived from description)
   ...

   Does this look correct? (y/n)
   ```
7. _WAIT_ for user confirmation, then proceed to Phase 1

---

## Phase 1: Duplication Check

> **Skipped when `url` is provided** &mdash; the issue already exists on GitHub.

Check for existing work that overlaps with this bug:

1. _SEARCH_ GitHub issues for duplicates:
   - RUN `gh issue list --search "<bug keywords>" --state open --json number,title,url`
   - RUN `gh issue list --search "<bug keywords>" --state closed --json number,title,url`
2. _CHECK_ existing branches:
   - RUN `git branch -a | grep -i "<bug keywords>"` (case-insensitive search)
3. _CHECK_ existing worktrees:
   - RUN `git worktree list`
4. _IF_ matching **closed** issue found:
   - _REPORT_ as potential **regression** &mdash; "This may be a regression of #<closed-issue>. The bug was previously fixed but appears to have returned."
   - _ASK_ user whether to proceed with a new issue (referencing the regression), reopen the closed issue, or abort
5. _IF_ matching **open** issue found:
   - _REPORT_ findings to user with issue numbers, branch names, and worktree paths
   - _ASK_ user whether to proceed, merge with existing, or abort
   - _WAIT_ for user decision
6. _IF_ no duplicates: proceed to Phase 2

---

## Phase 2: Create GitHub Issue

> **Skipped when `url` is provided** &mdash; the issue already exists on GitHub.

1. _COMPOSE_ issue body following the bug_report.md template:
   ```markdown
   ## Metadata

   ```yml
   pull_request_title: "FROM bug/<issue#>-<bug-name> TO development"
   branch: "bug/<issue#>-<bug-name>"
   worktree_path: "$WORKSPACE/.worktrees/bug-<issue#>"
   ```

   ## User Stories

   - As a **[role]**, I expect **[expected behavior]** when **[action]**, but instead **[actual behavior]**.
   - ...

   ## Summary

   <Brief technical description of the bug>

   ### Severity

   - [x] **<severity>** &mdash; <severity description>

   ## Steps to Reproduce

   1. <step 1>
   2. <step 2>
   ...

   ### Expected Behavior

   <What should happen>

   ### Actual Behavior

   <What actually happens>

   ## Root Cause Hypothesis

   <Best guess or "To be investigated">

   ## Acceptance Criteria

   - [ ] Bug is no longer reproducible following the steps above
   - [ ] A regression test is added that covers this specific bug
   - [ ] All previous & new tests pass, validated using `agent-browser` CLI
   - [ ] Fix follows existing repo/service/route patterns
   ```
2. _CREATE_ the issue:
   - RUN `gh issue create --title "fix: <bug-name>" --body "<body>" --label "bug"`
3. _CAPTURE_ the issue number from output
4. _REPORT_ "Created issue #<number>: fix: <bug-name>"

---

## Phase 3: Create Branch & Worktree

1. _DETERMINE_ naming:
   - Branch: `bug/<issue#>-<bug-name>`
   - Worktree path: `$ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#>`
3. _FETCH_ latest development:
   - RUN `git fetch origin development`
4. _CREATE_ worktree:
   - RUN `git worktree add $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#> -b bug/<issue#>-<bug-name> origin/development`
5. _INITIALIZE_ worktree:
   - RUN `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#> && bash $ORCHESTRA_PROJECT_ROOT/backend/scripts/changelog.sh`
   - RUN `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#> && git add Changelog.md && git commit -s -m "init bug/<issue#>-<bug-name>"`
   - RUN `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#> && git push -u origin bug/<issue#>-<bug-name>`
6. _UPDATE_ the GitHub issue with implementation metadata:
   - RUN:
     ```bash
     gh issue comment <issue#> --body "$(cat <<'EOF'
     ## Investigation Started

     **Branch**: `bug/<issue#>-<bug-name>`
     **Worktree**: `$ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#>`
     **PR title**: `FROM bug/<issue#>-<bug-name> TO development`
     EOF
     )"
     ```
7. _CREATE_ draft PR so all subsequent pushes are visible:
   - RUN:
     ```bash
     cd $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#> && gh pr create \
       --draft \
       --base development \
       --title "FROM bug/<issue#>-<bug-name> TO development" \
       --body "$(cat <<'EOF'
     ## Summary
     Resolves #<issue#>

     ## Status
     Pipeline in progress &mdash; this PR will be marked ready for review when Ralph completes.

     Generated by `/bug-report` skill.
     EOF
     )"
     ```
   - _CAPTURE_ the PR URL from output
8. _REPORT_ "Previous run archived. Worktree created at $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#> on branch bug/<issue#>-<bug-name>. Draft PR opened."

---

## Phase 4: Reproduce the Bug

**Key differentiator from feature-dev.** Before any fix is attempted, the bug must be reliably reproduced.

1. _CHANGE_ to worktree directory:
   - RUN `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#>`
2. _SET UP_ reproduction environment:
   - Verify Docker services are running (Postgres, Redis) if needed
   - Verify dev server is accessible (backend and/or frontend)
   - Install dependencies if needed
3. _FOLLOW_ Steps to Reproduce:
   - For browser-based bugs: use `agent-browser` to navigate and interact
   - For API bugs: use `curl` or equivalent to trigger the endpoint
   - For backend bugs: run the reproduction commands or test
4. _CAPTURE_ evidence of the broken state:
   - For UI bugs: take screenshot at `tasks/screenshots/bug-<issue#>-before.png` using `agent-browser screenshot`
   - For API bugs: capture error response, status code, stack trace
   - For backend bugs: capture error output, logs
5. _EVALUATE_ reproduction result:
   - **If reproduced**: _COMMIT_ evidence and proceed to Phase 5
     - RUN `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#> && git add tasks/screenshots/ && git commit -s -m "evidence: bug #<issue#> reproduction" && git push`
   - **If NOT reproduced**: _ASK_ user for more detail
     - _REPORT_ "Could not reproduce the bug with the provided steps. Please provide additional context."
     - _WAIT_ for user response
     - _IF_ still unreproducible after additional info: _HALT_ and recommend closing the issue with "Cannot reproduce"
6. _DOCUMENT_ reproduction findings:
   - Error messages and stack traces
   - Console output (browser or server)
   - Exact failure point in the code path
   - Environment details (browser, OS, versions)

---

## Phase 5: Root Cause Analysis & Plan (Plan Mode)

**MANDATORY before PRD generation.** Enter plan mode to analyze the root cause and design a TDD-first fix strategy.

1. _CHANGE_ to worktree directory:
   - RUN `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#>`
2. _ENTER_ plan mode and analyze:
   - Trace the code path from user action to failure point
   - Consult documentation at `$ORCHESTRA_PROJECT_ROOT/wiki` for context
   - Check git log for regression-introducing commits:
     - RUN `git log --oneline --all --grep="<relevant keywords>"` to find related changes
     - RUN `git log --oneline -20` to check recent commits for potential regression sources
   - Identify the root cause (not just the symptom)
   - Determine which files need changes
   - Design the TDD-first fix strategy: failing test first, then minimal fix
3. _WRITE_ plan to `.claude/plans/bug-<issue#>/plan-0.md`:
   - _CREATE_ directory: `mkdir -p $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#>/.claude/plans/bug-<issue#>`
   - _STORE_ the plan at `.claude/plans/bug-<issue#>/plan-0.md` &mdash; this file becomes the input for PRD generation in Phase 6
4. _PRESENT_ root cause analysis and plan to the user:
   ```
   ## Root Cause Analysis for #<issue#>: <bug-name>

   ### Root Cause
   <description of what is actually broken and why>

   ### Affected Files
   - <file 1>: <what needs to change>
   - <file 2>: <what needs to change>
   ...

   ### TDD-First Fix Strategy
   1. Write failing regression test that reproduces the exact bug
   2. <fix step 1>
   3. <fix step 2>
   ...
   4. Verify all tests pass (existing + new)

   ### Regression Risk
   - <what could break if the fix is wrong>
   - <related features to verify>

   ### Regression Source (if applicable)
   - Commit: <hash> &mdash; <message>
   - Introduced in: <PR or date>

   Plan stored at: `.claude/plans/bug-<issue#>/plan-0.md`
   ```
5. _WAIT_ for user approval before proceeding to Phase 6
6. _EXIT_ plan mode

---

## Phase 6: Generate PRD &rarr; Convert to Ralph JSON

This phase produces two artifacts in sequence: the PRD markdown file (via `/prd`), then the Ralph JSON config (via `/ralph`). The output of `/prd` is the direct input to `/ralph`.

### Step 1: Generate PRD

1. _INVOKE_ the `/prd` skill with the approved plan and broken-experience stories:
   ```
   Load the prd skill and create a PRD for:

   Bug Fix: <bug-name> (Issue #<issue#>)

   ## Root Cause Analysis
   <analysis from Phase 5>

   ## Broken-Experience Stories
   <all stories from BUG variable or extracted from issue>

   IMPORTANT TDD-first sizing rules for Ralph compatibility:
   - FIRST story: "Write failing regression test" &mdash; must reproduce the exact bug in a test
   - Middle stories: implement the fix (1-3 files per story max)
   - Second-to-last story: "Verify all tests pass, no regressions" &mdash; run full test suite
   - LAST story: git status check + commit/push
   - Each user story must be completable in ONE iteration (one context window)
   - One story should touch 1-3 files max
   - Backend and frontend changes are SEPARATE stories
   - Add "Typecheck passes" to every story
   - Add "Verify in browser using agent-browser skill" to UI-related stories
   - Add "Take screenshot with agent-browser for visual walkthrough" to UI-related stories
   ```
2. _VERIFY_ PRD was created at `tasks/prd-bug-<bug-name>.md`
3. _VALIDATE_ TDD-first story ordering:
   - _ENSURE_ first story is "Write failing regression test"
   - _ENSURE_ second-to-last story is "Verify all tests pass"
   - _ENSURE_ last story includes git status check
   - _AUTO-FIX_ ordering if violations found (move failing test to priority 1)
4. _VALIDATE_ agent-browser verification criteria:
   - _SCAN_ all user stories in the PRD
   - For UI-related stories, _ENSURE_ acceptance criteria include:
     - "Verify in browser using agent-browser skill"
     - "Take screenshot with agent-browser for visual walkthrough"
   - _AUTO-ADD_ these criteria if missing from any UI-facing story
5. _COMMIT_ PRD artifact:
   - RUN `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#> && git add tasks/prd-bug-<bug-name>.md`
   - RUN `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#> && git commit -s -m "docs: add PRD for bug #<issue#>"`
   - RUN `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#> && git push`

### Step 2: Convert PRD to Ralph JSON

Feed `tasks/prd-bug-<bug-name>.md` from Step 1 directly into the `/ralph` skill.

1. _INVOKE_ the `/ralph` skill with the PRD file as input (archiving already handled in Phase 3):
   ```
   Load the ralph skill and convert tasks/prd-bug-<bug-name>.md to .ralph/prd.json

   CRITICAL: Set branchName to "bug/<issue#>-<bug-name>" (must match the worktree branch exactly). Do NOT use the "ralph/" prefix.
   ```
2. _VERIFY_ `.ralph/prd.json` exists and contains valid JSON
3. _VALIDATE_ branchName matches `bug/<issue#>-<bug-name>`:
   - RUN `jq -r '.branchName' .ralph/prd.json`
   - _IF_ mismatch: manually fix branchName in prd.json
4. _VALIDATE_ TDD-first story ordering in prd.json:
   - _READ_ the user stories in prd.json
   - _ENSURE_ first story (priority 1) is "Write failing regression test"
   - _ENSURE_ second-to-last story is "Verify all tests pass, no regressions"
   - _ENSURE_ last story includes: "Verify if there are any remaining changes by running git status. If remaining changes exist, commit and push to branch."
   - _IF_ ordering violation: auto-fix by moving failing test story to priority 1
5. _COMMIT_ Ralph artifacts:
   - RUN `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#> && git add .ralph/prd.json .ralph/progress.txt`
   - RUN `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#> && git commit -s -m "chore: add Ralph config for bug #<issue#>"`
   - RUN `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#> && git push`
6. _REPORT_ "PRD generated and Ralph config committed with <N> user stories (TDD-first ordering verified)"

---

## Phase 7: Archive, Final Push & Mark PR Ready

All artifacts have been committed and pushed incrementally in previous phases. This phase archives Ralph artifacts, catches any stragglers, generates a reviewer report, and marks the draft PR as ready for review.

1. _ARCHIVE_ Ralph artifacts into `archive/bug-<issue#>/`:
   - RUN `mkdir -p $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#>/.ralph/archive/bug-<issue#>`
   - RUN `cp $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#>/.ralph/prd.json $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#>/.ralph/archive/bug-<issue#>/prd.json`
   - RUN `cp $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#>/.ralph/progress.txt $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#>/.ralph/archive/bug-<issue#>/progress.txt`
   - RUN `rm $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#>/.ralph/prd.json $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#>/.ralph/progress.txt`
2. _COMMIT_ archive:
   - RUN `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#> && git add .ralph/archive/bug-<issue#>/ && git add -A && git commit -s -m "chore: archive Ralph artifacts for bug #<issue#>"`
3. _PUSH_ final changes:
   - RUN `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#> && git push`
4. _GENERATE_ reviewer report on PR description:
   - _READ_ `.ralph/archive/bug-<issue#>/progress.txt` and `tasks/prd-bug-<bug-name>.md` to summarize what was fixed
   - _COMPOSE_ a reviewer-friendly PR body:
     ```markdown
     ## Summary
     Resolves #<issue#>

     ## Root Cause
     - <brief root cause description>

     ## What Changed
     - <bullet summary of fix steps and key changes>

     ## Stories Completed
     - [x] US-001: Write failing regression test
     - [x] US-002: <fix title>
     ...
     - [x] US-00N: Verify all tests pass, no regressions

     ## Testing
     - <regression test added>
     - <how to verify the fix>
     - <any agent-browser screenshots or evidence>

     ## Notes
     - <any caveats, follow-ups, or reviewer callouts>

     Generated by `/bug-report` skill.
     ```
   - _UPDATE_ PR description:
     - RUN `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#> && gh pr edit --body "<reviewer report>"`
5. _MARK_ PR ready for review:
   - RUN `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#> && gh pr ready`
6. _REPORT_ "Ralph artifacts archived. Reviewer report generated. PR marked ready for review."

---

## Phase 8: Launch Ralph in Tmux

1. _START_ Ralph in a tmux session:
   - RUN `tmux new-session -d -s bug-<issue#> -c $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#> "make -C $ORCHESTRA_PROJECT_ROOT ralph"`
2. _REPORT_ "Ralph launched in tmux session bug-<issue#>"
3. _PROVIDE_ monitoring commands:
   ```
   # Attach to Ralph session
   tmux attach -t bug-<issue#>

   # Check progress
   cat $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#>/.ralph/progress.txt
   ```

---

## Completion Report

```
## Bug Report Complete

**Issue**: #<issue#> - fix: <bug-name>
**Severity**: <severity>
**Branch**: bug/<issue#>-<bug-name>
**Worktree**: $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#>
**PR**: <PR URL> (draft &rarr; ready for review)
**PRD**: tasks/prd-bug-<bug-name>.md
**Ralph config**: .ralph/prd.json (<N> user stories, TDD-first)
**Tmux session**: bug-<issue#>

### Root Cause
<brief root cause description>

### Stories (TDD-First Order)
- US-001: Write failing regression test
- US-002: <fix step 1>
- ...
- US-00N-1: Verify all tests pass, no regressions
- US-00N: Git status check + commit/push

### Next Steps
- Monitor: `tmux attach -t bug-<issue#>`
- Progress: `cat $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#>/.ralph/progress.txt`
```

---

## Warnings

- **Always read the bug report template first** (Pre-Phase) &mdash; conventions drive all downstream phases
- **Always check for duplicates** before creating issues or branches (Phase 1)
- **Closed duplicates may indicate regression** &mdash; report as potential regression, not just duplicate
- **Never skip user confirmation** in Phase 0 &mdash; the user must agree on the bug scope
- **Bug MUST be reproduced** before any fix is attempted (Phase 4)
- **TDD-first story ordering is mandatory** &mdash; failing regression test is always priority 1
- **ALL changes verified via agent-browser** &mdash; UI stories must include agent-browser verification criteria
- **ALL bug fix workflows use plan mode** &mdash; plan before generating PRDs
- **Plan files stored at `.claude/plans/bug-<issue#>/plan-0.md`** &mdash; these become PRD input
- **Wiki workspace at `orchestra/wiki`** &mdash; consult for bug context and documentation
- **branchName in prd.json must use `bug/` prefix**, NOT `ralph/` &mdash; it must match the worktree branch exactly
- **Final story must include git status check** to catch uncommitted artifacts
- **Do NOT implement** &mdash; Ralph handles implementation. This skill only sets up the pipeline.
- **Commit messages must be signed** (`-s` flag) per repository guidelines

---

## Error Handling

- **Neither `bug` nor `url` provided**: _REPORT_ "You must provide either `bug` or `url`. See examples below."
- **Invalid URL format**: _REPORT_ "Invalid GitHub issue URL. Expected format: https://github.com/owner/repo/issues/NUMBER"
- **Issue not found**: _REPORT_ "Could not fetch issue. Check URL and GitHub authentication with `gh auth status`"
- **No stories found in issue body**: _REPORT_ "Could not parse broken-experience stories from issue body. Add stories manually via `bug` argument."
- **No reproduction steps in issue**: _ASK_ user for manual reproduction steps before proceeding
- **Bug not reproducible**: _REQUEST_ more detail from user. If still unreproducible, recommend closing the issue with "Cannot reproduce"
- **Closed duplicate found**: _REPORT_ as potential regression &mdash; "This may be a regression of #<closed-issue>."
- **Story ordering violation**: _AUTO-FIX_ by moving failing regression test story to priority 1
- **Dev server not running**: _REPORT_ with startup instructions &mdash; "Dev server not accessible. Start with: `make -C $ORCHESTRA_PROJECT_ROOT dev`"
- **Duplicate issue found**: _REPORT_ duplicates and ask user how to proceed
- **Worktree already exists**: _REPORT_ "Worktree already exists at $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#>. Remove with `git worktree remove $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#>` first."
- **PRD generation failure**: _REPORT_ "Failed to generate PRD. Retry with `/prd` manually."
- **prd.json conversion failure**: _REPORT_ "Failed to convert PRD. Retry with `/ralph` manually."
- **branchName mismatch**: Auto-fix the branchName in prd.json to match `bug/<issue#>-<bug-name>`
- **Push failure**: _REPORT_ "Failed to push. Try: `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#> && git push -u origin bug/<issue#>-<bug-name>`"
- **Tmux failure**: _REPORT_ "Failed to launch tmux. Run manually: `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/bug-<issue#> && make -C $ORCHESTRA_PROJECT_ROOT ralph`"

---

## Examples

### From GitHub Issue URL

```bash
/bug-report url="https://github.com/ruska-ai/orchestra/issues/796"
```

Extracts broken-experience stories from issue #796, skips duplication check and issue creation, then:
- Reproduces the bug with agent-browser
- Root cause analysis in plan mode
- Branch: `bug/796-<slugified-title>`
- Worktree: `$ORCHESTRA_PROJECT_ROOT/.worktrees/bug-796`
- PRD with TDD-first story ordering, Ralph config, and tmux launch

### From Bug Description

```bash
/bug-report bug="When clicking Save on assistant edit, validation error appears even with model selected."
```

Creates:
- Issue: `fix: save-validation-error`
- Branch: `bug/803-save-validation-error`
- Worktree: `./.worktrees/bug-803`
- Reproduction attempt with agent-browser
- Root cause analysis
- PRD with TDD-first stories (failing test = priority 1)
- Ralph launched in tmux session `bug-803`
