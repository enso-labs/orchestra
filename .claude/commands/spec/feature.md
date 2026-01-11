# Feature Spec Template Generator

Generate a feature spec template file for a new issue. The output should be saved to:  
`$PROJECT_ROOT/.claude/specs/feature-[ISSUE_NUMBER]-[SHORTDESC]/SPEC.md`

---

## Input

-   **ISSUE_NUMBER**: The numeric identifier for the feature (required)
-   **SHORTDESC**: A short description of the feature (kebab-case, required)

Example:  
Input: `123-user-dashboard`  
Template file path: `.claude/specs/feature-123-user-dashboard/SPEC.md`

---

## Template Layout

When invoked, generate a markdown file containing the following template structure:

```markdown
# Feature: [SHORTDESC] ([ISSUE_NUMBER])

> **⚠️ IMPORTANT**: Before implementing this feature, READ `/CLAUDE.md` first.

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

---

## Completion

Output `<promise>DONE</promise>` when all tests green. --max-iterations 50 --completion-promise "DONE"
```

---

## Workflow

1. _PARSE_ input into `ISSUE_NUMBER` and `SHORTDESC`
2. _GENERATE_ a new markdown file at `.claude/specs/feature-[ISSUE_NUMBER]-[SHORTDESC]/SPEC.md` containing the template above (substitute in the values)
3. _CONFIRM_ file creation and path

---

## Definition of Done

Before the feature spec is considered complete and ready for implementation, verify:

### Required Fields

-   [ ] **Summary** clearly articulates what the feature does and why it matters
-   [ ] **User Stories** has at least one complete user story (As a [user], I want [goal], so that [benefit])
-   [ ] **Acceptance Criteria** has 3+ testable, unambiguous criteria (checkbox format)
-   [ ] **Technical Requirements** lists key constraints, APIs, or architectural decisions

### Scope Definition

-   [ ] **Out of Scope** explicitly states what is NOT part of this feature
-   [ ] **Dependencies** lists any blocking issues, external services, or prerequisite work

### Quality Checks

-   [ ] Acceptance criteria are verifiable (can be tested yes/no)
-   [ ] Feature scope is achievable in a single PR or sprint
-   [ ] No ambiguous language ("should work", "might need", "probably")
-   [ ] Success metrics are measurable

### Optional but Recommended

-   [ ] **Implementation Notes** sketches the high-level approach
-   [ ] **Additional Context** includes mockups, references, or discussion links
-   [ ] **Success Metrics** defines how success will be measured post-launch

---

## Report

Confirm:

-   Template file created at correct path
-   ISSUE_NUMBER and SHORTDESC substituted into title
