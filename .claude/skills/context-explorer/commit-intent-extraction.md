# Skill: Commit Intent Extraction

## Purpose
Extract developer intent, goals, and context from commit messages and metadata.

## Inputs
- [ ] Commit hash or range
- [ ] Repository path
- [ ] Commit message format conventions

## Outputs
- [ ] Primary goal/intent
- [ ] Secondary objectives
- [ ] Stakeholders mentioned
- [ ] Related issues/tickets
- [ ] Scope signals (what's in/out)
- [ ] Risk signals (concerns, TODOs)

## Execution Checklist

1. [ ] Get commit details
   ```bash
   git log --format=fuller <range>
   git log --format="%H%n%an%n%ae%n%ad%n%s%n%b" <range>
   ```

2. [ ] Parse commit message structure
   - Subject line → Primary intent
   - Body paragraphs → Detailed reasoning
   - Trailers (Co-Authored-By, Fixes, etc.) → Collaborators/links
   - Conventional commit prefix (feat/fix/refactor) → Change category

3. [ ] Extract intent signals
   - **Goal keywords**: "add", "implement", "enable", "support"
   - **Scope keywords**: "only", "exclude", "without", "except"
   - **Constraint keywords**: "must", "cannot", "requires", "needs"
   - **Risk keywords**: "TODO", "FIXME", "hack", "workaround", "temporary"

4. [ ] Parse conventional commit format (if present)
   ```
   <type>(<scope>): <subject>

   <body>

   <footer>
   ```
   - Type: feat, fix, docs, refactor, test, chore
   - Scope: Component/module affected
   - Breaking changes: "BREAKING CHANGE:" in footer

5. [ ] Extract linked issues
   - GitHub: "Fixes #123", "Closes #456", "Relates to #789"
   - Jira: "PROJECT-123", "[PROJECT-456]"
   - Custom: Organization-specific patterns

6. [ ] Identify stakeholders
   - Author/committer names
   - Co-authored-by trailers
   - Mentioned users (@username)
   - Signed-off-by trailers

7. [ ] Output structured intent
   ```
   Primary Intent:
   - Add JWT-based authentication to API

   Secondary Objectives:
   - Support refresh token flow
   - Add middleware for protected routes

   Stakeholders:
   - Author: Jane Developer
   - Co-Author: John Reviewer

   Related Issues:
   - Closes #456: User authentication feature
   - Relates to #789: Security audit

   Scope Signals:
   - IN: JWT tokens, refresh tokens
   - OUT: OAuth providers (future work)

   Risk Signals:
   - TODO: Add rate limiting for token endpoint
   - FIXME: Token expiry not configurable yet
   ```

## Failure Signals

- **Empty commit message** → Use commit hash only, scan diff instead
- **"WIP" or "temp" commits** → Lower confidence, scan later commits
- **Merge commit** → Skip, analyze branch commits instead
- **Auto-generated message** → Low signal, focus on file changes

## Quality Gates

- [ ] Primary intent extracted (even if vague)
- [ ] Commit type classified (feat/fix/refactor/etc)
- [ ] Related issues/tickets extracted (if present)
- [ ] Risk signals identified (TODO/FIXME/etc)
- [ ] Confidence level assigned (High/Medium/Low)

## Intent Signal Patterns

### Goal Patterns (Primary Intent)
- "Add [feature]"
- "Implement [functionality]"
- "Enable [capability]"
- "Support [use case]"
- "Create [component]"
- "Build [system]"

### Scope Patterns (In/Out Boundaries)
- "Only [constraint]"
- "Without [exclusion]"
- "Except [edge case]"
- "For now [temporal scope]"
- "Initially [phase 1 scope]"

### Constraint Patterns
- "Must [hard requirement]"
- "Cannot [limitation]"
- "Requires [dependency]"
- "Needs [prerequisite]"

### Risk Patterns
- "TODO: [future work]"
- "FIXME: [known issue]"
- "HACK: [technical debt]"
- "Workaround for [problem]"
- "Temporary [solution]"

### Breaking Change Patterns
- "BREAKING CHANGE:"
- "Breaking:" in subject
- Major version bump in commit
- Migration required

## Conventional Commit Types

| Type | Intent Category | Example |
|------|----------------|---------|
| `feat` | New feature | Adding new capability |
| `fix` | Bug fix | Correcting behavior |
| `docs` | Documentation | README, comments |
| `refactor` | Code structure | No behavior change |
| `test` | Test coverage | Adding/fixing tests |
| `chore` | Maintenance | Dependencies, config |
| `perf` | Performance | Optimization |
| `style` | Formatting | Whitespace, lint |
| `ci` | CI/CD | Build, deploy |
| `build` | Build system | Webpack, npm scripts |

## Confidence Scoring

| Pattern | Confidence | Rationale |
|---------|-----------|-----------|
| Conventional commit with scope and body | **High** | Clear structure |
| Issue reference with description | **High** | Linked to spec |
| Descriptive subject + detailed body | **Medium** | Good context |
| Short subject only | **Medium** | Limited detail |
| "WIP", "temp", "test" in subject | **Low** | Incomplete work |
| Auto-generated (merge, revert) | **Low** | No human intent |
