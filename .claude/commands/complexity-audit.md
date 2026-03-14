# Complexity Audit

Orchestrate the full four-phase complexity audit pipeline (measure, identify patterns, benchmark,
draft PR) for a target path or glob pattern in the Orchestra codebase.

## Variables

TARGET: $ARGUMENTS.target (required — path or glob, e.g., `backend/src/services/`,
`frontend/src/components/`, or `all`)

ISSUE_URL: $ARGUMENTS.url (optional — existing GitHub issue URL; skips issue creation when provided)

## Workflow

Load and execute the `complexity-audit` skill with the provided variables.

1. _LOAD_ the `complexity-audit` skill from `.claude/skills/complexity-audit/SKILL.md`
2. _PASS_ TARGET and ISSUE_URL to the skill as-is
3. _FOLLOW_ the skill's full orchestration pipeline:
   - Pre-Phase: Read issue template, resolve project root, determine language(s)
   - Phase 0: Create or reuse GitHub issue, create branch and worktree, create draft PR
   - Phase 1–4: Delegate execution to the `complexity-auditor` agent
   - Final Phase: Update PR description with benchmark results, mark PR ready for review
4. _REPORT_ completion summary with PR URL and artifact locations

## Error Handling

- **TARGET not provided**: _REPORT_ "You must provide a `target` argument. Example: `/complexity-audit target=backend/src/services/`"
- All other errors handled by the `complexity-audit` skill

## Example Invocations

```bash
# Audit a specific backend directory (creates new issue)
/complexity-audit target=backend/src/services/

# Audit frontend components (creates new issue)
/complexity-audit target=frontend/src/components/

# Audit from an existing GitHub issue
/complexity-audit target=backend/src/services/ url=https://github.com/ruska-ai/orchestra/issues/890

# Audit the entire codebase
/complexity-audit target=all
```

## Report

After completion, confirm:
- Issue number created or reused
- Branch: `refactor/<issue#>-complexity-audit`
- Worktree: `.worktrees/refactor-<issue#>`
- Audit artifacts: `.audit/complexity_ranking.md`, `.audit/pattern_recommendations.yaml`, `.audit/benchmarks/`
- PR URL (ready for review)
