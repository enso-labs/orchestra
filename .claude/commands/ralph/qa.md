---
name: ralph:qa
description: "Run the post-Ralph integration QA gate after autonomous story execution. Invokes ralph-auditor (PRD completeness, spec drift) then integration-qa (cross-boundary bugs) and reports go/no-go for PR creation."
---

# Ralph QA

Run the post-Ralph integration QA gate after autonomous story execution completes.

## Variables

WORKTREE: $ARGUMENTS.worktree
FEATURE: $ARGUMENTS.feature

## Workflow

1. _VALIDATE_ inputs:
   - _IF_ WORKTREE is empty: _REPORT_ "worktree required. Usage: /ralph:qa worktree=.worktrees/feat-885 feature=agent-marketplace"
   - _IF_ FEATURE is empty: _DETERMINE_ feature name from the `project` field in `WORKTREE/.ralph/prd.json`

2. _READ_ Ralph execution state from WORKTREE:
   - RUN `cat WORKTREE/.ralph/prd.json | jq '{total: (.userStories | length), passed: [.userStories[] | select(.passes == true)] | length, failed: [.userStories[] | select(.passes == false)] | length}'` to summarize story status
   - _IF_ any stories have `passes: false`: _REPORT_ "Ralph has N incomplete stories. Run Ralph to completion before QA. Remaining: [list IDs]" and halt

3. _INVOKE_ ralph-auditor agent (Phase 1 — PRD and spec audit):
   - Use the `ralph-auditor` agent
   - Pass worktree path: WORKTREE
   - The agent will:
     - Validate prd.json structure and required fields
     - Detect dependency ordering violations (frontend before backend, etc.)
     - Compare spec files in `WORKTREE/.claude/specs/*/SPEC.md` against implementation
     - Identify integration coverage gaps across stories
     - Extract learnings from `WORKTREE/.ralph/progress.txt`
   - _CAPTURE_ audit report output

4. _DETERMINE_ integration QA scope from prd.json acceptance criteria:
   - _IF_ any story mentions "embed", "StaticFiles", "outDir", "vite.embed", or "cross-origin": mark as FULL_INTEGRATION scope
   - _IF_ any story adds API endpoints alongside frontend service calls: mark as FULL_INTEGRATION scope
   - _ELSE_: mark as STANDARD scope (API prefix + build alignment only)

5. _INVOKE_ integration-qa agent (Phase 2 — cross-boundary checks):
   - Use the `integration-qa` agent
   - Pass: worktree path WORKTREE, feature name FEATURE, scope from step 4
   - The agent will run (in priority order):
     - Build ↔ Serve alignment (every Vite outDir has a matching backend StaticFiles mount)
     - API prefix consistency (frontend calls match backend registration)
     - SPA catch-all guard (os.path.isfile() check present)
     - _IF_ FULL_INTEGRATION scope:
       - Cross-origin correctness (embed widget derives apiBase from script.src)
       - Content-type verification (.js files return application/javascript)
       - Live endpoint smoke tests for new public endpoints
   - _CAPTURE_ integration QA output

6. _EVALUATE_ combined results:
   - _IF_ ralph-auditor found dependency violations OR spec drift: mark Phase 1 as FAIL
   - _IF_ integration-qa found any [BOUNDARY] issues: mark Phase 2 as FAIL
   - _IF_ both pass: mark overall as GO
   - _IF_ either fails: mark overall as NO-GO

7. _IF_ overall is NO-GO:
   - _SUMMARIZE_ all issues found across both phases
   - _RECOMMEND_ whether each issue requires a new Ralph story or a direct fix
   - _REPORT_ "QA gate FAILED. Resolve issues before creating PR."

8. _IF_ overall is GO:
   - _REPORT_ "QA gate PASSED. Safe to create PR."
   - _SUGGEST_ next step: `cd WORKTREE && gh pr create --base development --title "<feature-name>"`

## Error Handling

- **WORKTREE path does not exist**: _REPORT_ "Worktree not found at WORKTREE. Check path with `git worktree list`."
- **prd.json missing**: _REPORT_ "No .ralph/prd.json found in WORKTREE. Ensure Ralph was initialized before QA."
- **ralph-auditor failure**: _REPORT_ "ralph-auditor agent failed. Check prd.json is valid JSON. Resume with manual audit."
- **integration-qa failure**: _REPORT_ "integration-qa agent failed. Run manually: use the integration-qa agent with worktree WORKTREE."

## Example Invocations

```bash
# QA after Ralph completes a feature in a worktree
/ralph:qa worktree=.worktrees/feat-885 feature=agent-marketplace

# QA with auto-detected feature name from prd.json
/ralph:qa worktree=.worktrees/feat-656
```

## Report

Summarize QA gate results:
- Ralph story completion: N/N passed
- Phase 1 (ralph-auditor): PASS or FAIL with issue list
- Phase 2 (integration-qa): PASS or FAIL with [BOUNDARY] issue list
- Overall verdict: GO or NO-GO
- Next step: PR creation command (if GO) or issue list to fix (if NO-GO)
