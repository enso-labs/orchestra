# Plan: Create `bug-report` Skill & Update `feature-dev` Skill

## Context

The current `feature-dev` skill orchestrates the complete feature development pipeline but doesn't explicitly reference the issue template, include agent-browser verification steps, or mention wiki workspace awareness. Additionally, there is no equivalent skill for bug reproduction and fixing - bugs are handled ad-hoc or via the generic `/ticket` command.

The user wants:
1. **Updated `feature-dev` skill** - Add template-reading, agent-browser verification, screenshots, wiki workspace references, and plan file convention (`.claude/plans/feat-[issue#]/plan-0.md`)
2. **New `bug-report` skill** - A parallel pipeline for bugs that emphasizes reproduction, TDD-first approach, root cause analysis, and agent-browser verification

## Files to Modify/Create

| File | Action | Lines |
|------|--------|-------|
| `.claude/skills/feature-dev/SKILL.md` | **MODIFY** | +~50 lines |
| `.claude/skills/bug-report/SKILL.md` | **CREATE** | ~550 lines |

No other files need changes. Downstream skills (`/prd`, `/ralph`, `/ralph-archive`, `/agent-browser`) remain untouched.

---

## Part 1: Update `feature-dev/SKILL.md`

Surgical additions to the existing 440-line skill:

### 1a. Update frontmatter description
Add `template-driven`, `agent-browser verification` trigger phrases.

### 1b. Add new variables
```
PLAN_TEMPLATE_PATH: `.github/ISSUE_TEMPLATE/feature_request.md`
WORKSPACE_DOCS: `orchestra/wiki`
```

### 1c. Insert "Pre-Phase: Read Issue Template" (before Phase 0)
1. Read `$ORCHESTRA_PROJECT_ROOT/.github/ISSUE_TEMPLATE/feature_request.md`
2. Extract conventions: branch naming, PR title format, worktree path, required sections, validation tools, design principles
3. Store for use in all subsequent phases
4. Note wiki workspace at `$ORCHESTRA_PROJECT_ROOT/wiki`

### 1d. Update Phase 4 (Research & Plan) - Plan File Convention
Plans generated in plan mode should be stored at:
```
.claude/plans/feat-<issue#>/plan-0.md
```
This plan file becomes the input for the PRD generation in Phase 5.

Add wiki workspace consultation:
- Consult documentation at `$ORCHESTRA_PROJECT_ROOT/wiki` for feature context
- Reference wiki content in the plan when relevant

### 1e. Enhance Phase 5 (PRD + Ralph) validation
Add agent-browser verification criteria check:
- Scan all user stories in prd.json
- For UI-changing stories, ensure acceptance criteria include "Verify in browser using agent-browser skill" and "Take screenshot with agent-browser for visual walkthrough"
- Auto-add if missing

### 1f. Insert "Phase 5.5: Agent-Browser Verification Dry Run"
For features with UI changes:
1. Check dev server availability
2. Take "before" screenshots using `agent-browser screenshot`
3. Commit screenshots as planning artifacts

### 1g. Add new warnings
- Always read the issue template first
- ALL changes verified via agent-browser
- ALL user story workflows use plan mode
- Plan files stored at `.claude/plans/feat-<issue#>/plan-0.md`
- Wiki workspace at `orchestra/wiki`

---

## Part 2: Create `bug-report/SKILL.md`

Mirrors feature-dev pipeline structure, adapted for bug reproduction and TDD-first fixing. Invoked via `/bug-report`.

### Key Differences from feature-dev
| Aspect | feature-dev | bug-report |
|--------|-------------|------------|
| Branch prefix | `feat/` | `bug/` |
| Template | `feature_request.md` | `bug_report.md` |
| Input param | `story=` | `bug=` |
| Unique phase | Research & Plan | **Reproduce Bug** + Root Cause Analysis |
| Story ordering | Dependency-based | **TDD-first** (failing test -> fix -> verify) |
| PRD naming | `prd-<name>.md` | `prd-bug-<name>.md` |
| Issue format | User stories | Broken experience stories |
| Tmux session | `feat-<issue#>` | `bug-<issue#>` |
| Plan file | `.claude/plans/feat-<issue#>/plan-0.md` | `.claude/plans/bug-<issue#>/plan-0.md` |

### Phase Breakdown

**Pre-Phase: Read Bug Report Template**
- Read `.github/ISSUE_TEMPLATE/bug_report.md`
- Extract conventions: `bug/` prefix, severity levels, reproduction format, design principles (fix root cause, TDD-first, no regressions)

**Phase 0: Validate Input & Confirm Bug Scope**
- If `url`: fetch issue, parse broken-experience stories, severity, steps to reproduce, root cause hypothesis, affected files
- If `bug`: parse description, derive severity, extract reproduction steps
- User confirms bug scope

**Phase 1: Duplication Check** (skipped if `url`)
- Search open AND closed issues (closed = may already be fixed)
- Check branches and worktrees
- Special handling: if matching closed issue found, report as potential regression

**Phase 2: Create GitHub Issue** (skipped if `url`)
- Issue body follows bug_report.md template (broken experience stories, severity, steps to reproduce, expected/actual, root cause hypothesis)
- Labels: `bug`
- Title prefix: `fix:`

**Phase 3: Archive, Create Branch & Worktree**
- Branch: `bug/<issue#>-<bug-name>`
- Worktree: `.worktrees/bug-<issue#>`
- Draft PR: `FROM bug/<issue#>-<bug-name> TO development`

**Phase 4: Reproduce the Bug** (NEW - key differentiator)
1. Set up reproduction environment (verify Docker, services, dev server)
2. Follow Steps to Reproduce using `agent-browser` for browser interactions
3. Take screenshot of broken state at `tasks/screenshots/bug-<issue#>-before.png`
4. If reproduced: commit screenshot, proceed
5. If NOT reproduced: ask user for more detail, halt if still unreproducible
6. Document reproduction findings (error messages, console output, exact failure point)

**Phase 5: Root Cause Analysis & Plan** (Plan Mode)
1. Trace code path from user action to failure point
2. Consult wiki documentation
3. Check git log for regression-introducing commits
4. Write plan to `.claude/plans/bug-<issue#>/plan-0.md`
5. Present root cause analysis:
   - Root cause, affected files, TDD-first fix strategy, regression risk
6. User approves plan

**Phase 6: Generate PRD -> Convert to Ralph JSON**
- PRD via `/prd` with TDD-first sizing rules:
  - FIRST story: "Write failing regression test"
  - Middle stories: implement fix (1-3 files per story)
  - Second-to-last: "Verify all tests pass, no regressions"
  - LAST story: git status check + commit/push
- Ralph JSON via `/ralph` with `bug/` branchName
- Validate TDD story ordering

**Phase 7: Final Push & Mark PR Ready**
- Same as feature-dev

**Phase 8: Launch Ralph in Tmux**
- Session: `bug-<issue#>`
- `make ralph` from orchestra root

### Error Handling
Same as feature-dev plus:
- "No reproduction steps in issue" -> ask for manual steps
- "Bug not reproducible" -> request more detail or close
- "Closed duplicate found" -> report as potential regression
- "Story ordering violation" -> auto-fix failing test to priority 1
- "Dev server not running" -> report with startup instructions

### Examples
```bash
# From existing GitHub issue
/bug-report url="https://github.com/ruska-ai/orchestra/issues/796"

# From bug description
/bug-report bug="When clicking Save on assistant edit, validation error appears even with model selected."
```

---

## Important Notes

1. **Template path**: User's workflow references `.yml` but actual templates are `.md` format. Using correct `.md` paths.
2. **Plan file convention**: Both skills store plans at `.claude/plans/[feat|bug]-<issue#>/plan-0.md` - these become PRD input.
3. **Branch prefix**: `bug/` (not `fix/`) for the bug-report skill, matching tmux session naming.
4. **PRD naming**: Bug PRDs use `prd-bug-<name>.md` prefix.
5. **Screenshot storage**: Both skills store at `tasks/screenshots/` within the worktree, committed as PR artifacts.
6. **No downstream changes**: `/prd`, `/ralph`, `/ralph-archive`, `/agent-browser` skills remain unchanged - composed as-is.

## Verification

1. **feature-dev updates**: Invoke `/feature-dev story="test story"` and verify:
   - Pre-Phase reads the feature_request.md template
   - Phase 4 writes plan to `.claude/plans/feat-<issue#>/plan-0.md`
   - Phase 5 validates agent-browser criteria in stories
   - New warnings appear in skill output

2. **bug-report creation**: Invoke `/bug-report bug="test bug description"` and verify:
   - Pre-Phase reads bug_report.md template
   - Phase 0 parses bug into broken-experience format
   - Phase 4 attempts reproduction with agent-browser
   - Phase 5 writes plan to `.claude/plans/bug-<issue#>/plan-0.md`
   - Phase 6 generates TDD-first story ordering (failing test = priority 1)
   - branchName uses `bug/` prefix
   - Tmux session named `bug-<issue#>`
