# Spec PR Creator

Commit a spec file (and optional plan file) and open a draft PR linking to a GitHub issue.

## Variables

SPEC_PATH: $ARGUMENTS.spec
ISSUE_NUMBER: $ARGUMENTS.issue
PLAN_PATH: $ARGUMENTS.plan
SLUG: $ARGUMENTS.slug
CROSS_REPO_REFS: $ARGUMENTS.refs

## Workflow

1. _VALIDATE_ inputs:
   - _IF_ SPEC_PATH is empty: _REPORT_ "spec required. Usage: /spec:pr spec='.claude/specs/spec-a.md' issue=892"
   - _IF_ ISSUE_NUMBER is empty: _REPORT_ "issue required. Usage: /spec:pr spec='.claude/specs/spec-a.md' issue=892"
   - _IF_ spec file does not exist at SPEC_PATH: _REPORT_ "Spec file not found at SPEC_PATH"
   - _IF_ PLAN_PATH is provided and file does not exist: _REPORT_ "Plan file not found at PLAN_PATH"

2. _CHECK_ working tree status:
   - _RUN_ `git status --porcelain`
   - _IF_ there are uncommitted changes: _WARN_ user about dirty working tree and ask to proceed or abort

3. _DETERMINE_ branch slug:
   - _IF_ SLUG is provided: use SLUG
   - _ELSE_: derive from spec filename (e.g., `spec-a-minimal-backend.md` → `openshell-sandbox`)

4. _CREATE_ branch from origin/development:
   - _RUN_ `git fetch origin development`
   - _RUN_ `git checkout -b spec/ISSUE_NUMBER-SLUG origin/development`

5. _STAGE_ files:
   - _RUN_ `git add SPEC_PATH`
   - _IF_ PLAN_PATH is provided: _RUN_ `git add PLAN_PATH`

6. _DETERMINE_ spec title from first `# ` heading in spec file

7. _COMMIT_ with signed commit:
   - _RUN_ `git commit -s -m "spec: add <title> (#ISSUE_NUMBER)"`

8. _PUSH_ branch:
   - _RUN_ `git push -u origin spec/ISSUE_NUMBER-SLUG`

9. _COMPOSE_ PR body:
   - Summary: "Adds spec for <title>"
   - Link to issue: "Closes #ISSUE_NUMBER" or "Related to #ISSUE_NUMBER"
   - List files included in the PR
   - _IF_ CROSS_REPO_REFS provided: include cross-repo reference section

10. _CREATE_ draft PR:
    - _RUN_ `gh pr create --draft --base development --title "spec: add <title> (#ISSUE_NUMBER)" --body "<body>"`

11. _REPORT_:
    - PR URL
    - Branch name: `spec/ISSUE_NUMBER-SLUG`
    - Issue link: `#ISSUE_NUMBER`

## Error Handling

- **Branch already exists**: _REPORT_ and ask user if they want to checkout the existing branch
- **Push fails**: _REPORT_ error and suggest checking remote access
- **PR creation fails**: _REPORT_ error and provide the `gh pr create` command for manual retry

## Example Invocations

```bash
# Basic spec PR
/spec:pr spec=".claude/specs/spec-a-minimal-backend.md" issue=892

# With plan file and custom slug
/spec:pr spec=".claude/specs/spec-a-minimal-backend.md" issue=892 plan=".claude/plans/openshell.md" slug="openshell-sandbox"

# With cross-repo references
/spec:pr spec=".claude/specs/spec-a-minimal-backend.md" issue=892 refs="ruska-ai/sandboxes#12"
```
