# Feature Spec Template Generator

Generate a feature spec template file for a new issue. The output should be saved to:  
`$PROJECT_ROOT/.claude/specs/feature-[ISSUE_NUMBER]-[SHORTDESC].md`

---

## Input

-   **ISSUE_NUMBER**: The numeric identifier for the feature (required)
-   **SHORTDESC**: A short description of the feature (kebab-case, required)

Example:  
Input: `123-user-dashboard`  
Template file path: `.claude/specs/feature-123-user-dashboard.md`

---

## Template Layout

When invoked, generate a markdown file containing the following template structure:

```markdown
# Feature: [SHORTDESC] ([ISSUE_NUMBER])

## Summary

_A concise summary of the feature and its purpose._

## User Stories

-   As a [user type], I want [goal] so that [benefit].

## Acceptance Criteria

-   [ ]
-   [ ]
-   [ ]

## Technical Requirements

_Key technical considerations, constraints, or dependencies._

## Implementation Notes

_High-level approach or architecture decisions._

## Dependencies

-   _List any blocking issues, APIs, or services._

## Out of Scope

_What is explicitly NOT part of this feature._

## Success Metrics

_How will we measure success?_

## Additional Context

_Mockups, references, or related discussion._
```

---

## Workflow

1. _PARSE_ input into `ISSUE_NUMBER` and `SHORTDESC`
2. _GENERATE_ a new markdown file at `.claude/specs/feature-[ISSUE_NUMBER]-[SHORTDESC].md` containing the template above (substitute in the values)
3. _CONFIRM_ file creation and path

---

## Report

Confirm:

-   Template file created at correct path
-   ISSUE_NUMBER and SHORTDESC substituted into title
