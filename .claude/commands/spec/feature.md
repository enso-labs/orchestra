# Feature Spec Template Generator

Generate a feature spec template file for a new issue. The output should be saved to:
`$PROJECT_ROOT/.claude/specs/feat-[ISSUE_NUMBER]-[SHORTDESC]/SPEC.md`

---

## Input

-   **ISSUE_NUMBER**: The numeric identifier for the feature (required)
-   **SHORTDESC**: A short description of the feature (kebab-case, required)

Example:
Input: `123-user-dashboard`
Template file path: `.claude/specs/feat-123-user-dashboard/SPEC.md`

---

## Template Layout

When invoked, generate a markdown file containing the following template structure:

```markdown
---
task: [SHORTDESC] (Feature #[ISSUE_NUMBER])
test_command: "[REPLACE: command to verify feature works]"
---

# Task: [SHORTDESC] (Feature #[ISSUE_NUMBER])

> **⚠️ IMPORTANT**: Before implementing this feature, READ `/CLAUDE.md` first.

_A concise summary of the feature and its purpose._

## Requirements

1. [Requirement 1]
2. [Requirement 2]
3. [Requirement 3]

## Success Criteria

1. [ ] [Testable criterion 1]
2. [ ] [Testable criterion 2]
3. [ ] [Testable criterion 3]
4. [ ] [Testable criterion 4]
5. [ ] [Testable criterion 5]
6. [ ] [Testable criterion 6]

## Example Output

\`\`\`
[Expected output or behavior demonstration]
\`\`\`

---

## Ralph Instructions

1. Work on the next incomplete criterion (marked [ ])
2. Check off completed criteria (change [ ] to [x])
3. Run tests after changes
4. Commit your changes frequently
5. When ALL criteria are [x], output: `<ralph>COMPLETE</ralph>`
6. If stuck on the same issue 3+ times, output: `<ralph>GUTTER</ralph>`
```

---

## Workflow

1. _PARSE_ input into `ISSUE_NUMBER` and `SHORTDESC`
2. _GENERATE_ a new markdown file at `.claude/specs/feat-[ISSUE_NUMBER]-[SHORTDESC]/SPEC.md` containing the template above (substitute in the values)
3. _CONFIRM_ file creation and path

---

## Definition of Done

Before the feature spec is considered complete and ready for implementation, verify:

### Required Fields

-   [ ] **Summary** clearly articulates what the feature does and why it matters
-   [ ] **Requirements** has at least 3 specific implementation requirements
-   [ ] **Success Criteria** has 3+ testable, unambiguous criteria (numbered checkbox format)
-   [ ] **test_command** in frontmatter specifies a valid verification command

### Quality Checks

-   [ ] Success criteria are verifiable (can be tested yes/no)
-   [ ] Feature scope is achievable in a single PR or sprint
-   [ ] No ambiguous language ("should work", "might need", "probably")
-   [ ] Example output demonstrates expected behavior

### Optional but Recommended

-   [ ] **Example Output** shows concrete expected behavior
-   [ ] Success criteria are numbered for easy reference

---

## Report

Confirm:

-   Template file created at correct path: `.claude/specs/feat-[ISSUE_NUMBER]-[SHORTDESC]/SPEC.md`
-   ISSUE_NUMBER and SHORTDESC substituted into YAML frontmatter and title
-   Ralph Instructions section included for autonomous execution
