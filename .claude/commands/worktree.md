# Worktree

Create a git worktree for a feature branch and initialize the changelog.

## Variables

BRANCH_NAME: $ARGUMENTS

## Workflow

1. _PARSE_ BRANCH_NAME (format: "feat/123-short-desc" or "fix/456-description")
2. _EXTRACT_ the worktree path by converting branch format:
   - Take the prefix (e.g., "feat", "fix") and the issue number
   - Convert "feat/123-short-desc" to "feat-123"
   - Final path: `.worktrees/<prefix>-<number>`
3. _RUN_ `git worktree add .worktrees/<prefix>-<number> -b <BRANCH_NAME>` to create the worktree with the new branch
4. _RUN_ `bash backend/scripts/changelog.sh` to update the changelog
5. _RUN_ `git add Changelog.md` to stage the changelog
6. _RUN_ `git commit -m "init <BRANCH_NAME>"` to commit the staged file

## Example

Input: `feat/123-short-desc`
- Worktree path: `./.worktrees/feat-123`
- Branch created: `feat/123-short-desc`
- Commit message: `init feat/123-short-desc`

## Report

Confirm:
- Worktree path created
- Branch name
- Changelog committed
