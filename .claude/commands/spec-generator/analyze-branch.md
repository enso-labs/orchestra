# Command: /analyze-branch

## Purpose
Perform deep analysis of a feature branch to understand development intent without generating a full spec.

## Usage
```
/analyze-branch <branch-name> [options]
```

## Options
- `--base <name>`: Compare against specific base (default: development)
- `--verbose`: Include full commit messages and diffs
- `--output <format>`: Output format: summary|detailed|json (default: summary)

## Skill Mapping
This command uses a subset of skills:

1. `context-extraction` - Primary analysis via context-explorer
2. `change-detection` - Categorize changes
3. `signal-noise-filtering` - Focus on relevant changes

## Execution Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    /analyze-branch                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Checkout/analyze target branch                          │
│     - Gather commit history                                 │
│     - Identify divergence point from base                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Invoke context-explorer                                 │
│     - Extract intent from changes                           │
│     - Identify what developer was trying to accomplish      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Run change-detection                                    │
│     - List all changed files                                │
│     - Categorize by domain and type                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Apply signal-noise-filtering                            │
│     - Highlight key changes                                 │
│     - Note potential concerns                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  OUTPUT: Branch analysis report                             │
└─────────────────────────────────────────────────────────────┘
```

## Output Format (Summary)

```
Branch Analysis: feat/user-auth
══════════════════════════════════════════════════════════════

Intent: Implement user authentication with OAuth2 support

Commits: 12 (spanning 5 days)
Files Changed: 23
Domains Affected: backend (15), frontend (8)

Key Changes:
  ✓ Added OAuth2 provider integration
  ✓ Created login/logout endpoints
  ✓ Implemented session management
  ✓ Added auth middleware
  ○ Frontend login form (in progress)

Signals:
  ! New dependency: python-jose
  ! Database migration required
  ? Test coverage unclear

Recommendation: Ready for spec generation
══════════════════════════════════════════════════════════════
```

## Examples

```bash
# Analyze a feature branch
/analyze-branch feat/user-auth

# Detailed analysis with full diffs
/analyze-branch feat/api-v2 --verbose

# JSON output for tooling
/analyze-branch feat/metrics --output json
```

## Use Cases
- Quick understanding of a PR or branch before review
- Pre-spec analysis to determine if ready for specification
- Team communication about branch status
