---
name: feature-dev
description: "Full-stack feature development from user stories. Orchestrates the complete pipeline: duplication check, GitHub issue creation, branch/worktree setup, PRD generation, Ralph JSON conversion, commit/push, and Ralph execution. Use when you have user stories ready to implement. Triggers on: feature dev, implement story, build feature from story, story to feature."
---

# Feature Dev

Converts one or more user stories into a fully implemented feature by orchestrating the complete development pipeline: issue creation, branch setup, PRD generation, Ralph conversion, and autonomous execution.

---

## Variables

STORY: $ARGUMENTS.story

---

## Input Formats

The `story` argument accepts a single user story or multiple stories:

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

---

## Phase 0: Validate Input & Confirm Feature Scope

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
4. _WAIT_ for user confirmation before proceeding

---

## Phase 1: Duplication Check

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
   - Worktree path: `./.worktrees/feat-<issue#>`
2. _FETCH_ latest development:
   - RUN `git fetch origin development`
3. _CREATE_ worktree:
   - RUN `git worktree add ./.worktrees/feat-<issue#> -b feat/<issue#>-<feature-name> origin/development`
4. _INITIALIZE_ worktree:
   - RUN `cd ./.worktrees/feat-<issue#> && bash ../../backend/scripts/changelog.sh`
   - RUN `cd ./.worktrees/feat-<issue#> && git add Changelog.md && git commit -s -m "init feat/<issue#>-<feature-name>"`
5. _REPORT_ "Worktree created at ./.worktrees/feat-<issue#> on branch feat/<issue#>-<feature-name>"

---

## Phase 4: Generate PRD

Delegate to the `/prd` skill to create the PRD from the user stories.

1. _CHANGE_ to worktree directory:
   - RUN `cd ./.worktrees/feat-<issue#>`
2. _INVOKE_ the prd skill with the composed stories:
   ```
   Load the prd skill and create a PRD for:

   Feature: <feature-name> (Issue #<issue#>)

   ## User Stories
   <all stories from STORY variable>

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
3. _VERIFY_ PRD was created at `tasks/prd-<feature-name>.md`
4. _REPORT_ "Generated PRD at tasks/prd-<feature-name>.md"

---

## Phase 5: Convert to Ralph JSON

Delegate to the `/ralph` skill to convert the PRD to `prd.json`.

1. _INVOKE_ `/ralph-archive` first to archive any existing prd.json from a different feature
2. _INVOKE_ the ralph skill:
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
6. _REPORT_ "Ralph configuration ready with <N> user stories"

---

## Phase 6: Commit Artifacts & Push & Create PR

1. _STAGE_ and commit all artifacts from the worktree:
   - RUN `cd ./.worktrees/feat-<issue#> && git add tasks/ .ralph/prd.json .ralph/progress.txt`
   - RUN `cd ./.worktrees/feat-<issue#> && git commit -s -m "feat: add PRD and Ralph config for #<issue#>"`
2. _PUSH_ to remote:
   - RUN `cd ./.worktrees/feat-<issue#> && git push -u origin feat/<issue#>-<feature-name>`
3. _REPORT_ "Artifacts committed and pushed to feat/<issue#>-<feature-name>"

---

## Phase 7: Launch Ralph in Tmux

1. _START_ Ralph in a tmux session:
   - RUN `tmux new-session -d -s feat-<issue#> -c ./.worktrees/feat-<issue#> "make -C ../../ ralph"`
2. _REPORT_ "Ralph launched in tmux session feat-<issue#>"
3. _PROVIDE_ monitoring commands:
   ```
   # Attach to Ralph session
   tmux attach -t feat-<issue#>

   # Check progress
   cat ./.worktrees/feat-<issue#>/.ralph/progress.txt
   ```

---

## Completion Report

```
## Feature Dev Complete

**Issue**: #<issue#> - feat: <feature-name>
**Branch**: feat/<issue#>-<feature-name>
**Worktree**: ./.worktrees/feat-<issue#>
**PRD**: tasks/prd-<feature-name>.md
**Ralph config**: .ralph/prd.json (<N> user stories)
**Tmux session**: feat-<issue#>

### Stories
- US-001: <title>
- US-002: <title>
...

### Next Steps
- Monitor: `tmux attach -t feat-<issue#>`
- Progress: `cat ./.worktrees/feat-<issue#>/.ralph/progress.txt`
- When complete: `cd ./.worktrees/feat-<issue#> && gh pr create --base development --title "FROM feat/<issue#>-<feature-name> TO development"`
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

- **Invalid story format**: _REPORT_ "Could not parse user stories. Expected format: As a [role], I want [capability] so that [benefit]."
- **Duplicate issue found**: _REPORT_ duplicates and ask user how to proceed
- **Worktree already exists**: _REPORT_ "Worktree already exists at ./.worktrees/feat-<issue#>. Remove with `git worktree remove ./.worktrees/feat-<issue#>` first."
- **PRD generation failure**: _REPORT_ "Failed to generate PRD. Retry with `/prd` manually."
- **prd.json conversion failure**: _REPORT_ "Failed to convert PRD. Retry with `/ralph` manually."
- **branchName mismatch**: Auto-fix the branchName in prd.json to match `feat/<issue#>-<feature-name>`
- **Push failure**: _REPORT_ "Failed to push. Try: `cd ./.worktrees/feat-<issue#> && git push -u origin feat/<issue#>-<feature-name>`"
- **Tmux failure**: _REPORT_ "Failed to launch tmux. Run manually: `cd ./.worktrees/feat-<issue#> && make -C ../../ ralph`"

---

## Examples

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
