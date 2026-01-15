# Ticket

Automate complete ticket-based development workflow from GitHub issue to pull request.

## Variables

ISSUE_URL: $ARGUMENTS.url
SUBAGENTS: $ARGUMENTS.subagents (default: 3)

## Workflow

1. _VALIDATE_ ISSUE_URL format (expected: GitHub issue URL like `https://github.com/owner/repo/issues/123`)

2. _EXTRACT_ issue details using gh CLI:
   - RUN `gh issue view <ISSUE_URL> --json number,title,body,labels` to fetch issue metadata
   - _PARSE_ the issue number from the response
   - _DETERMINE_ branch type from labels or title:
     - IF labels contain "bug" or "fix" or title starts with "Fix": use `bug/` prefix
     - ELSE: use `feat/` prefix
   - _GENERATE_ branch name: `<prefix>/<number>-<slugified-title>`
     - Example: `feat/656-distro-workers-taskiq` or `bug/123-null-pointer-crash`

3. _CREATE_ worktree from development branch:
   - _DETERMINE_ worktree path: `./.worktrees/<prefix>-<number>`
     - Example: `./.worktrees/feat-656` or `./.worktrees/bug-123`
   - RUN `git fetch origin development` to ensure development is up to date
   - RUN `git worktree add ./.worktrees/<prefix>-<number> -b <branch-name> origin/development` to create worktree
   - _REPORT_ worktree created at path with branch name

4. _INITIALIZE_ worktree changelog:
   - RUN `cd ./.worktrees/<prefix>-<number> && bash ../../backend/scripts/changelog.sh` to generate changelog
   - RUN `cd ./.worktrees/<prefix>-<number> && git add Changelog.md` to stage changelog
   - RUN `cd ./.worktrees/<prefix>-<number> && git commit -m "init <branch-name>"` to commit initialization

5. _CREATE_ spec folder for artifacts:
   - _DETERMINE_ spec folder path: `.claude/specs/<prefix>-<number>-<short-name>/`
     - Example: `.claude/specs/feature-656-distributed-workers-taskiq/`
   - RUN `mkdir -p ./.worktrees/<prefix>-<number>/.claude/specs/<prefix>-<number>-<short-name>` to create spec folder
   - _STORE_ spec folder path for later reference

6. _GENERATE_ user stories from issue:
   - _ANALYZE_ issue title, body, and labels to derive user stories
   - _FORMAT_ user stories using standard template:
     ```markdown
     # User Stories

     ## Issue #<number>: <title>

     ### Story 1: <Primary User Story>
     **As a** <user type>,
     **I want** <capability/feature>,
     **So that** <benefit/value>.

     **Acceptance Criteria:**
     - [ ] <Criterion 1>
     - [ ] <Criterion 2>
     - [ ] <Criterion 3>

     ### Story 2: <Secondary User Story> (if applicable)
     ...

     ## Notes
     - <Any edge cases or considerations from the issue>
     ```
   - _DERIVE_ stories by:
     - Identifying the primary user persona (developer, end-user, admin, etc.)
     - Extracting the core capability being requested
     - Inferring the business value or user benefit
     - Converting issue requirements into testable acceptance criteria
   - _WRITE_ user stories to `.claude/specs/<prefix>-<number>-<short-name>/USER_STORIES.md`
   - _REPORT_ "Generated <N> user stories for PR review"

7. _PREPARE_ team query from issue with user stories:
   - _COMPOSE_ query string:
     ```
     GitHub Issue #<number>: <title>

     ## Description
     <body>

     ## User Stories
     <content from USER_STORIES.md>
     ```
   - _ENSURE_ full issue context AND user stories are captured for team analysis
   - User stories provide clear acceptance criteria for agent proposals

8. _INVOKE_ team workflow from worktree:
   - RUN `cd ./.worktrees/<prefix>-<number>` to change to worktree directory
   - _EXECUTE_ `/team query="<composed-query>" subagents=$SUBAGENTS output_dir=".claude/specs/<prefix>-<number>-<short-name>/"` to run multi-agent implementation workflow
   - The team workflow will generate artifacts into `.claude/specs/<prefix>-<number>-<short-name>/`:
     - Phase 0: Context initialization from CLAUDE.md → `INITIAL_REPORT` (in memory)
     - Phase 1: Generate expert proposals → `PROPOSAL_ARCHITECT.md`, `PROPOSAL_CRAFTSMAN.md`, `PROPOSAL_GUARDIAN.md`
     - Phase 2: Council review and synthesis → `REVIEW.md`
     - Phase 3: Task contract generation → `TASKS.md`
     - Phase 4: Implementation execution → Code changes
     - Phase 5: Testing and validation → Updates `TASKS.md` with validation results
   - _MONITOR_ team workflow progress through all phases

9. _VERIFY_ implementation completion:
   - _CHECK_ that `.claude/specs/<prefix>-<number>-<short-name>/TASKS.md` shows all tasks completed
   - _CHECK_ that validation phase passed successfully
   - RUN `cd ./.worktrees/<prefix>-<number> && git status` to confirm all changes committed
   - _IF_ uncommitted changes exist:
     - _REPORT_ "Found uncommitted changes. Committing final changes..."
     - RUN `cd ./.worktrees/<prefix>-<number> && git add .` to stage all changes
     - RUN `cd ./.worktrees/<prefix>-<number> && git commit -m "$(cat <<'EOF'
     Complete implementation for issue #<number>

     Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
     EOF
     )"` to commit with attribution

10. _CREATE_ pull request:
   - RUN `cd ./.worktrees/<prefix>-<number> && git push -u origin <branch-name>` to push branch to remote
   - _GENERATE_ PR body from spec folder artifacts:
     ```markdown
     ## Summary
     Resolves #<issue-number>

     <Brief summary from .claude/specs/<prefix>-<number>-<short-name>/REVIEW.md>

     ## User Stories
     <Include user stories from .claude/specs/<prefix>-<number>-<short-name>/USER_STORIES.md>

     **Reviewer:** Use these acceptance criteria to validate the implementation.

     ## Implementation
     <Key implementation points from .claude/specs/<prefix>-<number>-<short-name>/TASKS.md>

     ## Testing
     <Validation results from .claude/specs/<prefix>-<number>-<short-name>/TASKS.md>

     🤖 Generated with [Claude Code](https://claude.com/claude-code)
     ```
   - RUN `cd ./.worktrees/<prefix>-<number> && gh pr create --base development --title "<Issue title>" --body "$(cat <<'EOF'
     <composed-pr-body>
     EOF
     )"` to create pull request targeting development branch
   - _CAPTURE_ PR URL from command output

11. _REPORT_ workflow completion:
   - Issue processed: #<number> - <title>
   - Worktree location: `./.worktrees/<prefix>-<number>`
   - Spec folder: `.claude/specs/<prefix>-<number>-<short-name>/`
   - Branch name: `<branch-name>`
   - Pull request created: <PR-URL>
   - Team workflow artifacts (in spec folder):
     - `USER_STORIES.md` (Step 6 - Acceptance criteria for PR review)
     - `PROPOSAL_ARCHITECT.md` (Phase 1 - System design perspective)
     - `PROPOSAL_CRAFTSMAN.md` (Phase 1 - Clean code perspective)
     - `PROPOSAL_GUARDIAN.md` (Phase 1 - Testing/security perspective)
     - `REVIEW.md` (Phase 2 - Council synthesis)
     - `TASKS.md` (Phase 3 contract + Phase 5 validation results)

## Error Handling

- **Invalid URL format**: _REPORT_ "Invalid GitHub issue URL. Expected format: https://github.com/owner/repo/issues/NUMBER"
- **Issue not found**: _REPORT_ "Could not fetch issue. Check URL and GitHub authentication with `gh auth status`"
- **Worktree already exists**: _REPORT_ "Worktree already exists at path. Remove with `git worktree remove ./.worktrees/<prefix>-<number>` first"
- **Team workflow failure**: _REPORT_ "Team workflow encountered an error. Check TASKS.md for current status and resume manually"
- **PR creation failure**: _REPORT_ error message and provide manual PR creation command

## Example Invocations

```bash
# Process a feature request (default 3 subagents)
/ticket url="https://github.com/ruska-ai/orchestra/issues/656"

# Process a bug fix with more agents
/ticket url="https://github.com/ruska-ai/orchestra/issues/123" subagents=5
```

## Report

Confirm workflow completion with:
- Issue number and title processed
- Worktree path: `./.worktrees/<prefix>-<number>`
- Spec folder: `.claude/specs/<prefix>-<number>-<short-name>/`
- Branch name: `<prefix>/<number>-<short-name>`
- User stories generated: <N> stories with acceptance criteria
- Team workflow completion status (all 5 phases)
- Pull request URL
- Next steps: Review PR at <URL> using user story acceptance criteria to validate implementation
