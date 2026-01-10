# Skill: Documentation Delta Scan

## Purpose
Scan documentation changes for specification signals and intent markers.

## Inputs
- [ ] Diff of documentation files
- [ ] Specific doc files to analyze
- [ ] Repository context

## Outputs
- [ ] Requirements extracted from docs
- [ ] Acceptance criteria from docs
- [ ] Scope boundaries identified
- [ ] User personas mentioned
- [ ] Success metrics defined
- [ ] Risk statements found

## Execution Checklist

1. [ ] Identify documentation files in diff
   ```bash
   git diff --name-only <range> | grep -E '\.(md|txt|rst|adoc)$'
   git diff --name-only <range> | grep -iE '(readme|proposal|spec|design|adr|rfc)'
   ```

2. [ ] Prioritize by document type
   - **P0**: PROPOSAL, SPEC, DESIGN, ADR, RFC
   - **P1**: README, CHANGELOG, API docs
   - **P2**: Comments, TODO files, notes

3. [ ] Read each P0/P1 document
   ```bash
   git diff <range> -- path/to/doc.md
   ```

4. [ ] Extract specification signals
   - **Goal statements**: "The goal is...", "This enables...", "We want to..."
   - **User personas**: "As a [role]", "Users need...", "[Stakeholder] wants..."
   - **Acceptance criteria**: "Success is when...", "Must be able to...", "Should support..."
   - **Scope boundaries**: "In scope:", "Out of scope:", "Not included:", "Future work:"
   - **Constraints**: "Must use...", "Cannot exceed...", "Limited to..."
   - **Risks**: "Risk:", "Concern:", "Unknown:", "Assumption:"

5. [ ] Parse structured sections
   - Markdown headers → Section purposes
   - Bullet lists → Requirements, criteria
   - Tables → Acceptance criteria, test cases
   - Code blocks → Examples, contracts

6. [ ] Extract acceptance criteria
   - Look for "Given/When/Then" patterns
   - Numbered test scenarios
   - Checklist items
   - Success conditions

7. [ ] Identify user personas/stakeholders
   - "As a [user type]" statements
   - Role mentions (admin, developer, end-user)
   - Stakeholder names/teams

8. [ ] Extract metrics and KPIs
   - Performance targets: "< 100ms", "99.9% uptime"
   - Scale requirements: "1000 req/sec", "10M users"
   - Business metrics: "Increase by 20%"

9. [ ] Flag unknowns and assumptions
   - "TBD", "TODO", "FIXME"
   - "Assuming...", "If possible..."
   - Question marks in headers
   - Empty sections

10. [ ] Output structured findings
    ```
    Document: PROPOSAL_AUTH.md

    Goal/Outcome:
    - Add JWT-based authentication to API
    - Enable secure access to protected endpoints
    - Support token refresh flow

    User Personas:
    - API consumer (mobile app, web app)
    - System administrator (token management)

    Scope - IN:
    - JWT token generation and validation
    - Refresh token mechanism
    - Middleware for protected routes

    Scope - OUT:
    - OAuth provider integration (future)
    - Multi-factor authentication (v2)

    Acceptance Criteria:
    - [ ] User can authenticate with username/password
    - [ ] System returns JWT access token and refresh token
    - [ ] Protected routes reject requests without valid token
    - [ ] Tokens expire after configured duration
    - [ ] Refresh endpoint issues new access token

    Performance Expectations:
    - Token validation < 10ms
    - Auth endpoint < 200ms

    Risks/Unknowns:
    - Token storage strategy not decided (Redis vs Postgres)
    - Rate limiting approach TBD
    - Token rotation policy undefined

    Confidence: HIGH (explicit proposal document)
    ```

## Failure Signals

- **No documentation changes** → Rely on commit messages, code analysis
- **Only README formatting changes** → Low signal, check other sources
- **Deleted documentation** → Scope reduction or consolidation signal
- **Conflicting statements** → Flag as CONFLICTING in completeness model

## Quality Gates

- [ ] All P0/P1 documentation files analyzed
- [ ] At least one specification signal extracted (if docs exist)
- [ ] Scope boundaries identified (in/out)
- [ ] Acceptance criteria extracted (if present)
- [ ] Unknowns/assumptions flagged
- [ ] Confidence level assigned per finding

## Document Type Signal Values

| Document Type | Signal Value | What to Extract |
|---------------|-------------|-----------------|
| `PROPOSAL*.md` | **Very High** | All 14 completeness slots |
| `SPEC*.md` | **Very High** | Requirements, acceptance criteria |
| `DESIGN*.md` | **High** | Architecture, interfaces, constraints |
| `ADR*.md` | **High** | Decisions, constraints, trade-offs |
| `RFC*.md` | **High** | Requirements, open questions |
| `README.md` | **Medium** | Usage, scope, prerequisites |
| `CHANGELOG.md` | **Medium** | Feature scope, breaking changes |
| `API.md` | **Medium** | Interfaces, contracts, schemas |
| `TODO.md` | **Low** | Future scope, deferred work |
| `NOTES.md` | **Low** | Context, assumptions |

## Specification Signal Patterns

### Goal/Outcome Signals
- "The goal is to..."
- "This feature enables..."
- "We want to..."
- "The purpose is..."
- "Objective:"

### User Persona Signals
- "As a [role], I want..."
- "Users need to..."
- "[Stakeholder] requires..."
- "Target audience:"

### Scope Signals
- "## In Scope"
- "## Out of Scope"
- "## Not Included"
- "## Future Work"
- "## Phase 1/2/3"

### Constraint Signals
- "Must use..."
- "Cannot exceed..."
- "Limited to..."
- "Required:"
- "Constraints:"

### Acceptance Criteria Signals
- "## Acceptance Criteria"
- "## Success Criteria"
- "## Test Scenarios"
- "Given/When/Then"
- "- [ ] Must be able to..."

### Risk Signals
- "## Risks"
- "## Assumptions"
- "## Open Questions"
- "## Unknowns"
- "TBD:", "TODO:", "FIXME:"

### Performance Signals
- "< [number][unit]" (e.g., "< 100ms")
- "[number]% uptime"
- "[number] requests/sec"
- "## Performance Requirements"

## Parsing Strategies

### Markdown Checklist
```markdown
- [ ] Item one
- [ ] Item two
- [x] Item three (completed)
```
→ Extract unchecked items as acceptance criteria

### Given/When/Then
```markdown
Given a user is authenticated
When they request a protected resource
Then the system validates their token
And returns the resource if valid
```
→ Extract as behavioral test case

### Table-Based Criteria
```markdown
| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Valid token | JWT | 200 OK + resource |
| Invalid token | Bad JWT | 401 Unauthorized |
```
→ Extract as acceptance criteria table

### Scope Tables
```markdown
| In Scope | Out of Scope |
|----------|--------------|
| JWT auth | OAuth |
| Refresh tokens | MFA |
```
→ Extract scope boundaries
