---
name: feature-dev
description: "Full-stack feature development from user stories. Orchestrates the complete pipeline: duplication check, GitHub issue creation, branch/worktree setup, PRD generation, Ralph JSON conversion, commit/push, and Ralph execution. Use when you have user stories ready to implement. Triggers on: feature dev, implement story, build feature from story, story to feature."
---

# Feature Dev

Converts one or more user stories into a fully implemented feature by orchestrating the complete development pipeline: issue creation, branch setup, PRD generation, Ralph conversion, and autonomous execution.

---

## Variables

STORY: $ARGUMENTS.story (optional if `url` is provided)
URL: $ARGUMENTS.url (optional if `story` is provided)
ORCHESTRA_PROJECT_ROOT: The **orchestra project root** &mdash; the git repository root where `.claude/`, `.worktrees/`, and `Makefile` live. Resolve via `git rev-parse --show-toplevel`. All paths in this skill are anchored to this variable. Always `cd $ORCHESTRA_PROJECT_ROOT` before running commands to ensure worktrees are created in the correct location.

**Exactly one of `story` or `url` must be provided.**

---

## Input Formats

### Option A: Pass user stories directly via `story`

**Single story:**
```
story="As a user, I want to export chat history as PDF so that I can share conversations offline."
```

**Multiple stories (newline-separated or numbered):**
```
story="1. As a developer, I want tool inputs collapsed by default so that chat is less noisy.
2. As a user, I want to expand tool inputs on click so that I can inspect them.
3. As a user, I want a toggle to show/hide all tool inputs at once."
```

All input stories are grouped into a **single feature** &mdash; one GitHub issue, one PRD, one Ralph run.

### Option B: Pass a GitHub issue URL via `url`

```
url="https://github.com/ruska-ai/orchestra/issues/810"
```

When `url` is provided the skill extracts all context from the existing issue:
- RUN `gh issue view <URL> --json number,title,body,labels`
- _PARSE_ user stories from the issue body (look for "User Stories" section or "As a..." patterns)
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
cd $ORCHESTRA_PROJECT_ROOT/.worktrees/feat-<issue#>
git add <phase artifacts>
git commit -s -m "<phase commit message>"
git push
```

---

## Phase 0: Validate Input & Confirm Feature Scope

### If `url` was provided:

1. _VALIDATE_ URL format (expected: `https://github.com/<owner>/<repo>/issues/<number>`)
2. _FETCH_ issue details:
   - RUN `gh issue view <URL> --json number,title,body,labels`
3. _PARSE_ user stories from the issue body (look for "User Stories" section or "As a..." patterns)
   - The issue **must** contain at least one user story. If none are found, _HALT_ and report the error.
4. _SET_ issue number and feature name from the issue metadata (slugify title to kebab-case)
5. _PRESENT_ extracted data to the user for confirmation:
   ```
   ## Feature Scope (from Issue #<number>)

   **Issue**: #<number> - <title>
   **Feature name**: <feature-name>
   **Stories** (<N> total):
   - US-001: <story 1>
   - US-002: <story 2>
   ...

   Does this look correct? (y/n)
   ```
6. _WAIT_ for user confirmation, then **skip to Phase 3**

### If `story` was provided:

1. _PARSE_ the STORY variable into individual user stories
2. _EXTRACT_ a short feature name from the stories (kebab-case, e.g., `export-chat-pdf`)
3. _PRESENT_ parsed stories and feature name to the user for confirmation:
   ```
   ## Feature Scope

   **Feature name**: <feature-name>
   **Stories** (<N> total):
   - US-001: <story 1>
   - US-002: <story 2>
   ...

   Does this look correct? (y/n)
   ```
4. _WAIT_ for user confirmation, then proceed to Phase 1

---

## Phase 1: Duplication Check

> **Skipped when `url` is provided** &mdash; the issue already exists on GitHub.

Check for existing work that overlaps with this feature:

1. _SEARCH_ GitHub issues for duplicates:
   - RUN `gh issue list --search "<feature keywords>" --state open --json number,title,url`
   - RUN `gh issue list --search "<feature keywords>" --state closed --json number,title,url`
2. _CHECK_ existing branches:
   - RUN `git branch -a | grep -i "<feature keywords>"` (case-insensitive search)
3. _CHECK_ existing worktrees:
   - RUN `git worktree list`
4. _IF_ duplicates found:
   - _REPORT_ findings to user with issue numbers, branch names, and worktree paths
   - _ASK_ user whether to proceed, merge with existing, or abort
   - _WAIT_ for user decision
5. _IF_ no duplicates: proceed to Phase 2

---

## Phase 2: Create GitHub Issue

> **Skipped when `url` is provided** &mdash; the issue already exists on GitHub.

1. _COMPOSE_ issue body using the stories:
   ```markdown
   ## User Stories

   - As a **[role]**, I want **[capability]** so that **[benefit]**.
   - ...

   ## Summary

   <Brief description synthesized from the stories>

   ## Acceptance Criteria

   - [ ] All user stories implemented and verified
   - [ ] Typecheck passes
   - [ ] Tests pass (if applicable)
   ```
2. _CREATE_ the issue:
   - RUN `gh issue create --title "feat: <feature-name>" --body "<body>" --label "enhancement"`
3. _CAPTURE_ the issue number from output
4. _REPORT_ "Created issue #<number>: feat: <feature-name>"

---

## Phase 3: Create Branch & Worktree

1. _DETERMINE_ naming:
   - Branch: `feat/<issue#>-<feature-name>`
   - Worktree path: `$ORCHESTRA_PROJECT_ROOT/.worktrees/feat-<issue#>`
2. _FETCH_ latest development:
   - RUN `git fetch origin development`
3. _CREATE_ worktree:
   - RUN `git worktree add $ORCHESTRA_PROJECT_ROOT/.worktrees/feat-<issue#> -b feat/<issue#>-<feature-name> origin/development`
4. _INITIALIZE_ worktree:
   - RUN `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/feat-<issue#> && bash $ORCHESTRA_PROJECT_ROOT/backend/scripts/changelog.sh`
   - RUN `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/feat-<issue#> && git add Changelog.md && git commit -s -m "init feat/<issue#>-<feature-name>"`
   - RUN `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/feat-<issue#> && git push -u origin feat/<issue#>-<feature-name>`
5. _UPDATE_ the GitHub issue with implementation metadata:
   - RUN:
     ```bash
     gh issue comment <issue#> --body "$(cat <<'EOF'
     ## Implementation Started

     **Branch**: `feat/<issue#>-<feature-name>`
     **Worktree**: `$ORCHESTRA_PROJECT_ROOT/.worktrees/feat-<issue#>`
     **PR title**: `FROM feat/<issue#>-<feature-name> TO development`
     EOF
     )"
     ```
6. _REPORT_ "Worktree created at $ORCHESTRA_PROJECT_ROOT/.worktrees/feat-<issue#> on branch feat/<issue#>-<feature-name>"

---

## Phase 4: Research & Plan (Plan Mode)

**MANDATORY before PRD generation.** Enter plan mode to research the codebase and triage the best implementation approach. This prevents the PRD from being generated blindly.

1. _CHANGE_ to worktree directory:
   - RUN `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/feat-<issue#>`
2. _ENTER_ plan mode and research:
   - Explore the codebase to understand existing patterns, files, and architecture relevant to the user stories
   - Identify which files will need changes
   - Determine dependency order (schema, backend, frontend, integration)
   - Flag any risks, blockers, or open questions
   - Decide whether stories need to be split, merged, or reordered
3. _PRESENT_ the plan to the user for approval:
   ```
   ## Implementation Plan for #<issue#>: <feature-name>

   ### Affected Areas
   - <file/module 1>: <what changes>
   - <file/module 2>: <what changes>
   ...

   ### Proposed Story Breakdown
   1. <story 1> (schema/backend/frontend)
   2. <story 2>
   ...

   ### Risks & Open Questions
   - <any blockers or decisions needed>

   ### Approach
   <brief summary of implementation strategy>
   ```
4. _WAIT_ for user approval before proceeding to Phase 5
5. _EXIT_ plan mode

---

## Phase 5: Generate PRD &rarr; Convert to Ralph JSON

This phase produces two artifacts in sequence: the PRD markdown file (via `/prd`), then the Ralph JSON config (via `/ralph`). The output of `/prd` is the direct input to `/ralph`.

### Step 1: Generate PRD

1. _INVOKE_ the `/prd` skill with the approved plan and stories:
   ```
   Load the prd skill and create a PRD for:

   Feature: <feature-name> (Issue #<issue#>)

   ## Approved Implementation Plan
   <plan from Phase 4>

   ## User Stories
   <all stories from STORY variable or extracted from issue>

   IMPORTANT sizing rules for Ralph compatibility:
   - Each user story must be completable in ONE iteration (one context window)
   - One story should touch 1-3 files max
   - Backend and frontend changes are SEPARATE stories
   - Schema/migration changes are SEPARATE from logic that uses them
   - If a task spans >3 files, SPLIT into multiple stories
   - Dependency order: Schema -> Backend -> Frontend -> Integration
   - Add "Typecheck passes" to every story
   - Add "Verify in browser using agent-browser skill" to UI stories
   ```
2. _VERIFY_ PRD was created at `tasks/prd-<feature-name>.md`
3. _COMMIT_ PRD artifact:
   - RUN `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/feat-<issue#> && git add tasks/prd-<feature-name>.md`
   - RUN `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/feat-<issue#> && git commit -s -m "docs: add PRD for #<issue#>"`
   - RUN `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/feat-<issue#> && git push`

### Step 2: Convert PRD to Ralph JSON

Feed `tasks/prd-<feature-name>.md` from Step 1 directly into the `/ralph` skill.

1. _INVOKE_ `/ralph-archive` first to archive any existing prd.json from a different feature
2. _INVOKE_ the `/ralph` skill with the PRD file as input:
   ```
   Load the ralph skill and convert tasks/prd-<feature-name>.md to .ralph/prd.json

   CRITICAL: Set branchName to "feat/<issue#>-<feature-name>" (must match the worktree branch exactly). Do NOT use the "ralph/" prefix.
   ```
3. _VERIFY_ `.ralph/prd.json` exists and contains valid JSON
4. _VALIDATE_ branchName matches `feat/<issue#>-<feature-name>`:
   - RUN `jq -r '.branchName' .ralph/prd.json`
   - _IF_ mismatch: manually fix branchName in prd.json
5. _VALIDATE_ final story includes git status check:
   - _READ_ the last user story in prd.json
   - _ENSURE_ its acceptance criteria include: "Verify if there are any remaining changes by running git status. If remaining changes exist, commit and push to branch."
   - _IF_ missing: add this criterion to the last story
6. _COMMIT_ Ralph artifacts:
   - RUN `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/feat-<issue#> && git add .ralph/prd.json .ralph/progress.txt`
   - RUN `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/feat-<issue#> && git commit -s -m "chore: add Ralph config for #<issue#>"`
   - RUN `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/feat-<issue#> && git push`
7. _REPORT_ "PRD generated and Ralph config committed with <N> user stories"

---

## Phase 6: Verify Remote & Create PR

All artifacts have been committed and pushed incrementally in previous phases. This phase ensures everything is synced.

1. _VERIFY_ remote is up to date:
   - RUN `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/feat-<issue#> && git status`
   - _IF_ uncommitted changes remain: stage, commit, and push them
2. _ENSURE_ branch is tracking remote:
   - RUN `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/feat-<issue#> && git push -u origin feat/<issue#>-<feature-name>`
3. _REPORT_ "All artifacts pushed to feat/<issue#>-<feature-name>"

---

## Phase 7: Launch Ralph in Tmux

1. _START_ Ralph in a tmux session:
   - RUN `tmux new-session -d -s feat-<issue#> -c $ORCHESTRA_PROJECT_ROOT/.worktrees/feat-<issue#> "make -C $ORCHESTRA_PROJECT_ROOT ralph"`
2. _REPORT_ "Ralph launched in tmux session feat-<issue#>"
3. _PROVIDE_ monitoring commands:
   ```
   # Attach to Ralph session
   tmux attach -t feat-<issue#>

   # Check progress
   cat $ORCHESTRA_PROJECT_ROOT/.worktrees/feat-<issue#>/.ralph/progress.txt
   ```

---

## Completion Report

```
## Feature Dev Complete

**Issue**: #<issue#> - feat: <feature-name>
**Branch**: feat/<issue#>-<feature-name>
**Worktree**: $ORCHESTRA_PROJECT_ROOT/.worktrees/feat-<issue#>
**PRD**: tasks/prd-<feature-name>.md
**Ralph config**: .ralph/prd.json (<N> user stories)
**Tmux session**: feat-<issue#>

### Stories
- US-001: <title>
- US-002: <title>
...

### Next Steps
- Monitor: `tmux attach -t feat-<issue#>`
- Progress: `cat $ORCHESTRA_PROJECT_ROOT/.worktrees/feat-<issue#>/.ralph/progress.txt`
- When complete: `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/feat-<issue#> && gh pr create --base development --title "FROM feat/<issue#>-<feature-name> TO development"`
```

---

## Warnings

- **Always check for duplicates** before creating issues or branches (Phase 1)
- **Never skip user confirmation** in Phase 0 &mdash; the user must agree on the feature scope
- **branchName in prd.json must use `feat/` prefix**, NOT `ralph/` &mdash; it must match the worktree branch exactly
- **Final story must include git status check** to catch uncommitted artifacts
- **Do NOT implement** &mdash; Ralph handles implementation. This skill only sets up the pipeline.
- **Commit messages must be signed** (`-s` flag) per repository guidelines

---

## Error Handling

- **Neither `story` nor `url` provided**: _REPORT_ "You must provide either `story` or `url`. See examples below."
- **Invalid URL format**: _REPORT_ "Invalid GitHub issue URL. Expected format: https://github.com/owner/repo/issues/NUMBER"
- **Issue not found**: _REPORT_ "Could not fetch issue. Check URL and GitHub authentication with `gh auth status`"
- **No stories found in issue body**: _REPORT_ "Could not parse user stories from issue body. Add stories manually via `story` argument."
- **Invalid story format**: _REPORT_ "Could not parse user stories. Expected format: As a [role], I want [capability] so that [benefit]."
- **Duplicate issue found**: _REPORT_ duplicates and ask user how to proceed
- **Worktree already exists**: _REPORT_ "Worktree already exists at $ORCHESTRA_PROJECT_ROOT/.worktrees/feat-<issue#>. Remove with `git worktree remove $ORCHESTRA_PROJECT_ROOT/.worktrees/feat-<issue#>` first."
- **PRD generation failure**: _REPORT_ "Failed to generate PRD. Retry with `/prd` manually."
- **prd.json conversion failure**: _REPORT_ "Failed to convert PRD. Retry with `/ralph` manually."
- **branchName mismatch**: Auto-fix the branchName in prd.json to match `feat/<issue#>-<feature-name>`
- **Push failure**: _REPORT_ "Failed to push. Try: `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/feat-<issue#> && git push -u origin feat/<issue#>-<feature-name>`"
- **Tmux failure**: _REPORT_ "Failed to launch tmux. Run manually: `cd $ORCHESTRA_PROJECT_ROOT/.worktrees/feat-<issue#> && make -C $ORCHESTRA_PROJECT_ROOT ralph`"

---

## Examples

### From GitHub Issue URL

```bash
/feature-dev url="https://github.com/ruska-ai/orchestra/issues/810"
```

Extracts stories from issue #810, skips duplication check and issue creation, then:
- Branch: `feat/810-<slugified-title>`
- Worktree: `$ORCHESTRA_PROJECT_ROOT/.worktrees/feat-810`
- PRD, Ralph config, and tmux launch as normal

### Single Story

```bash
/feature-dev story="As a user, I want to export chat history as PDF so that I can share conversations offline."
```

Creates:
- Issue: `feat: export-chat-pdf`
- Branch: `feat/801-export-chat-pdf`
- Worktree: `./.worktrees/feat-801`
- PRD with stories sized for single Ralph iterations
- Ralph launched in tmux session `feat-801`

### Multiple Stories

```bash
/feature-dev story="1. As a developer, I want tool inputs collapsed by default so that chat is less noisy.
2. As a user, I want to expand tool inputs on click so that I can inspect them.
3. As a user, I want a toggle to show/hide all tool inputs at once."
```

Creates:
- Issue: `feat: collapsible-tool-inputs`
- Branch: `feat/802-collapsible-tool-inputs`
- Worktree: `./.worktrees/feat-802`
- PRD with 3+ stories (may be further split for Ralph compatibility)
- Ralph launched in tmux session `feat-802`
