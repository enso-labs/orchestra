# Bug Spec Template Generator

Generate a bug spec template file for a new issue. The output should be saved to:  
`$PROJECT_ROOT/.claude/specs/bug-[ISSUE_NUMBER]-[SHORTDESC].md`

---

## Input

-   **ISSUE_NUMBER**: The numeric identifier for the bug (required)
-   **SHORTDESC**: A short description of the bug (kebab-case, required)

Example:  
Input: `456-menu-invisible`  
Template file path: `.claude/specs/bug-456-menu-invisible.md`

---

## Template Layout

When invoked, generate a markdown file containing the following template structure:

```markdown
# Bug Report: [SHORTDESC] ([ISSUE_NUMBER])

> **⚠️ IMPORTANT**: Before implementing this bug fix, READ `/CLAUDE.md` first.

## Summary

_A concise summary of the bug and impact._

## Steps to Reproduce

1.
2.
3.

## Expected Behavior

_What should happen?_

## Actual Behavior

_What is happening instead?_

## Screenshots / Logs

_If applicable._

## Environment

-   OS:
-   Browser / Version (if relevant):

## Additional Context

_Anything else?_

---

## Completion

Output `<promise>DONE</promise>` when all tests green. --max-iterations 50 --completion-promise "DONE"
```

---

## Workflow

1. _PARSE_ input into `ISSUE_NUMBER` and `SHORTDESC`
2. _GENERATE_ a new markdown file at `.claude/specs/bug-[ISSUE_NUMBER]-[SHORTDESC].md` containing the template above (substitute in the values)
3. _CONFIRM_ file creation and path

---

## Definition of Done

Before the bug spec is considered complete and ready for implementation, verify:

### Required Fields

-   [ ] **Summary** contains a clear, concise description of the bug and its impact
-   [ ] **Steps to Reproduce** has numbered, actionable steps (minimum 2)
-   [ ] **Expected Behavior** clearly states what should happen
-   [ ] **Actual Behavior** clearly states what is happening instead

### Optional but Recommended

-   [ ] **Screenshots / Logs** attached if the bug is visual or produces error output
-   [ ] **Environment** details filled in (OS, browser, version)
-   [ ] **Additional Context** includes any relevant links, related issues, or prior attempts

### Quality Checks

-   [ ] Steps to reproduce are reproducible by someone unfamiliar with the codebase
-   [ ] Bug is isolated to a specific behavior (not multiple issues bundled)
-   [ ] Impact/severity is implicitly clear from the summary

---

## Report

Confirm:

-   Template file created at correct path
-   ISSUE_NUMBER and SHORTDESC substituted into title
