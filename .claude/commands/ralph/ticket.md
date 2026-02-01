# Ticket

Automate complete ticket-based development workflow from GitHub issue to Ralph autonomous implementation.

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

8. _INVOKE_ team council analysis (Phases 0-3 ONLY — no implementation):
   - RUN `cd ./.worktrees/<prefix>-<number>` to change to worktree directory
   - _EXECUTE_ `/team query="<composed-query>" subagents=$SUBAGENTS output_dir=".claude/specs/<prefix>-<number>-<short-name>/"` to run multi-agent council workflow
   - **IMPORTANT:** Execute ONLY Phases 0-3 of the team workflow. Do NOT proceed to Phase 4 (implementation) or Phase 5 (validation). Stop after generating the task contract.
   - The team workflow will generate council artifacts into `.claude/specs/<prefix>-<number>-<short-name>/`:
     - Phase 0: Context initialization from CLAUDE.md → `INITIAL_REPORT` (in memory)
     - Phase 1: Generate expert proposals → `PROPOSAL_*.md` (one per agent persona)
     - Phase 2: Council review and synthesis → `REVIEW.md`
     - Phase 3: Task contract generation → `TASKS.md`
   - _VERIFY_ that `REVIEW.md` and `TASKS.md` exist in the spec folder before proceeding
   - _IF_ missing artifacts: _REPORT_ error and halt

9. _GENERATE_ PRD from council outputs:
   - _READ_ the council artifacts from `.claude/specs/<prefix>-<number>-<short-name>/`:
     - `REVIEW.md` — Council's unified implementation plan
     - `TASKS.md` — Atomic task breakdown with acceptance criteria
     - `USER_STORIES.md` — User acceptance criteria from Step 6
   - _COMPOSE_ PRD generation query:
     ```
     Archive previous prd.json & progress.txt THEN load the prd skill and create a PRD for:

     Feature: <issue-title> (Issue #<number>)
     Branch: <branch-name>

     Use the following council analysis as your source material:

     ## Council Implementation Plan
     <Insert content from REVIEW.md — specifically the Unified Implementation Plan and Risk sections>

     ## Task Breakdown
     <Insert content from TASKS.md — the atomic task list>

     ## User Stories & Acceptance Criteria
     <Insert content from USER_STORIES.md>

     IMPORTANT sizing rules for Ralph compatibility:
     - Each user story must be completable in ONE iteration (one context window)
     - One story should touch 1-3 files max
     - Backend and frontend changes are SEPARATE stories
     - Schema/migration changes are SEPARATE from logic that uses them
     - If a task spans >3 files, SPLIT into multiple stories
     - Stories touching 2+ files: Add "Use parallel-edits skill for coordinated changes" to acceptance criteria
     - Dependency order: Schema → Backend → Frontend → Integration
     - Add "Typecheck passes" to every story
     - Add "Verify in browser using agent-browser skill" to UI stories
     ```
   - _EXECUTE_ query from worktree directory
   - _VERIFY_ PRD was created at `tasks/prd-<feature-slug>.md`
   - _REPORT_ "Generated PRD at tasks/prd-<feature-slug>.md"

10. _CONVERT_ PRD to Ralph prd.json format:
    - _COMPOSE_ conversion query:
      ```
      Load the ralph skill and convert tasks/prd-<feature-slug>.md to .ralph/prd.json

      CRITICAL: Set branchName to "<branch-name>" (must match the worktree branch exactly, e.g., "feat/707-ticket-md-ralph-loop"). Do NOT use the "ralph/" prefix.
      ```
    - _EXECUTE_ query from worktree directory
    - _VERIFY_ `.ralph/prd.json` exists and contains valid JSON
    - _VALIDATE_ branchName matches `<branch-name>`:
      - RUN `jq -r '.branchName' .ralph/prd.json` and compare to `<branch-name>`
      - _IF_ mismatch: manually fix branchName in prd.json before proceeding
    - _REPORT_ "Ralph configuration ready with <N> user stories"

11. _LAUNCH_ Ralph autonomous implementation loop:
    - _REPORT_ "Starting Ralph autonomous loop for <N> user stories..."
    - RUN `cd ./.worktrees/<prefix>-<number> && bash ../../.ralph/ralph.sh 200` to execute Ralph
    - Ralph has access to `.ralph/skills/parallel-edits/SKILL.md` for efficient multi-file changes
    - Ralph will:
      - Read `.ralph/prd.json` for user stories (resolved via SCRIPT_DIR at repo root)
      - Pick highest priority story with `passes: false`
      - Implement the story, run quality checks (typecheck, lint, test)
      - Commit with message: `feat: [Story ID] - [Story Title]`
      - Update `prd.json` to mark `passes: true`
      - Append progress to `.ralph/progress.txt`
      - Repeat until all stories pass or max iterations reached
      - Exit with `<promise>COMPLETE</promise>` when all stories done
    - _MONITOR_ output for completion signal
    - _CAPTURE_ Ralph exit status:
      - Exit 0: All stories completed
      - Exit 1: Max iterations reached (partial completion)

12. _PUSH_ changes to remote branch:
    - _REGARDLESS_ of Ralph exit status (COMPLETE or PARTIAL), push all committed work to remote
    - RUN `cd ./.worktrees/<prefix>-<number> && git push -u origin <branch-name>` to push branch to remote
    - _IF_ push fails: _REPORT_ error and provide manual push command
    - _REPORT_ "Pushed <branch-name> to origin"

13. _REPORT_ workflow completion:
    - Issue processed: #<number> - <title>
    - Worktree location: `./.worktrees/<prefix>-<number>`
    - Spec folder: `.claude/specs/<prefix>-<number>-<short-name>/`
    - Branch name: `<branch-name>`
    - Council artifacts (in spec folder):
      - `USER_STORIES.md` (Step 6 — Acceptance criteria)
      - `PROPOSAL_*.md` (Phase 1 — Agent proposals)
      - `REVIEW.md` (Phase 2 — Council synthesis)
      - `TASKS.md` (Phase 3 — Task contract)
    - PRD: `tasks/prd-<feature-slug>.md`
    - Ralph config: `.ralph/prd.json`
    - Ralph progress: `.ralph/progress.txt`
    - Ralph status: <COMPLETE | PARTIAL>
    - _IF_ COMPLETE:
      - Next steps: Create PR: `cd ./.worktrees/<prefix>-<number> && gh pr create --base development --title "<issue-title>"`
    - _IF_ PARTIAL:
      - Stories completed: <N> of <M>
      - Next steps: Review `.ralph/progress.txt`, fix blockers, resume with `cd ./.worktrees/<prefix>-<number> && bash ../../.ralph/ralph.sh`

## Error Handling

- **Invalid URL format**: _REPORT_ "Invalid GitHub issue URL. Expected format: https://github.com/owner/repo/issues/NUMBER"
- **Issue not found**: _REPORT_ "Could not fetch issue. Check URL and GitHub authentication with `gh auth status`"
- **Worktree already exists**: _REPORT_ "Worktree already exists at path. Remove with `git worktree remove ./.worktrees/<prefix>-<number>` first"
- **Council workflow incomplete**: _REPORT_ "Council artifacts missing (REVIEW.md or TASKS.md not found). Check spec folder and re-run /team manually."
- **PRD generation failure**: _REPORT_ "Failed to generate PRD. Check council artifacts and retry Step 9 manually."
- **prd.json conversion failure**: _REPORT_ "Failed to convert PRD to prd.json. Check tasks/prd-<feature-slug>.md and retry: Load the ralph skill and convert the PRD to .ralph/prd.json"
- **branchName mismatch**: _REPORT_ "prd.json branchName does not match worktree branch. Update .ralph/prd.json branchName to match <branch-name>."
- **Ralph loop failure**: _REPORT_ "Ralph encountered an error. Check .ralph/progress.txt for status. Resume with `bash ../../.ralph/ralph.sh`"
- **Ralph partial completion**: _REPORT_ "Ralph completed <N> of <M> stories. Resume with `bash ../../.ralph/ralph.sh` or complete remaining stories manually."
- **Push failure**: _REPORT_ "Failed to push branch. Try manually: `cd ./.worktrees/<prefix>-<number> && git push -u origin <branch-name>`"

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
- Council analysis: Phases 0-3 completed (proposals, review, tasks)
- PRD generated: `tasks/prd-<feature-slug>.md`
- Ralph config: `.ralph/prd.json` with <N> user stories
- Ralph execution status: COMPLETE or PARTIAL (<N> of <M> stories)
- Branch pushed to remote
- Next steps: Create PR (if COMPLETE), or resume Ralph (if PARTIAL)
