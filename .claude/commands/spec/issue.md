# Spec Issue Creator

Create a GitHub issue from a spec file, using the `feature_request.md` template structure.

## Variables

SPEC_PATH: $ARGUMENTS.spec
TITLE_OVERRIDE: $ARGUMENTS.title
LABELS: $ARGUMENTS.labels
CROSS_REPO_REFS: $ARGUMENTS.refs

## Workflow

1. _VALIDATE_ spec file exists at SPEC_PATH
   - _IF_ SPEC_PATH is empty: _REPORT_ "spec required. Usage: /spec:issue spec='.claude/specs/spec-a-minimal-backend.md'"
   - _IF_ file does not exist: _REPORT_ "Spec file not found at SPEC_PATH"

2. _READ_ `.github/ISSUE_TEMPLATE/feature_request.md` for section structure

3. _READ_ spec file at SPEC_PATH and extract:
   - **Title**: from first `# ` heading or filename
   - **Summary**: from approach summary or first paragraph
   - **Files to modify**: list of files mentioned in the spec (→ Key Integration Points)
   - **Frontend sections**: any frontend file changes (→ UI Integration Points)
   - **Design decisions**: architectural choices, env vars, patterns
   - **Acceptance criteria**: from success criteria, testing plan, or risk mitigations

4. _SYNTHESIZE_ 2-3 user stories from the spec's purpose:
   - Identify the primary user role (developer, end user, admin)
   - Extract the capability being added
   - Derive the benefit from the spec's rationale

5. _COMPOSE_ full issue body populating ALL template sections:
   - **Metadata**: derive branch name from spec slug
   - **User Stories**: from step 4
   - **Summary**: from spec summary + link to spec file
   - **Key Integration Points**: from backend files in spec
   - **UI Integration Points**: from frontend files in spec
   - **Storage**: from spec if applicable, otherwise "No storage changes"
   - **Architectural Decisions**: from spec design decisions
   - **Acceptance Criteria**: from spec success criteria + standard items

6. _PRESENT_ composed issue body to user for review before creation
   - Show title, labels, and full body
   - Ask for confirmation or edits

7. _IF_ user confirms:
   - _DETERMINE_ labels: use LABELS if provided, otherwise default to "enhancement"
   - _DETERMINE_ title: use TITLE_OVERRIDE if provided, otherwise "feat: <extracted title>"
   - _RUN_ `gh issue create --title "<title>" --label "<labels>" --body "<body>"`

8. _REPORT_ created issue URL

## Error Handling

- **Spec file not found**: _REPORT_ path and suggest checking `.claude/specs/` directory
- **gh CLI not authenticated**: _REPORT_ "Run `gh auth login` first"
- **Issue creation fails**: _REPORT_ error and show the composed body so user can create manually

## Example Invocations

```bash
# Create issue from a spec file
/spec:issue spec=".claude/specs/spec-a-minimal-backend.md"

# With custom title and labels
/spec:issue spec=".claude/specs/spec-a-minimal-backend.md" title="feat: OpenShell sandbox backend" labels="enhancement,backend"

# With cross-repo references
/spec:issue spec=".claude/specs/spec-a-minimal-backend.md" refs="ruska-ai/sandboxes#12"
```
