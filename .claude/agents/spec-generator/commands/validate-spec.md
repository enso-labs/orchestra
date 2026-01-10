# Command: /validate-spec

## Purpose
Re-validate an existing specification against the current state of the codebase to identify drift, completed items, and new gaps.

## Usage
```
/validate-spec <spec-id-or-path> [options]
```

## Options
- `--update`: Update the spec file with validation results
- `--strict`: Fail if any critical gaps remain
- `--report`: Generate standalone validation report

## Skill Mapping
This command uses:

1. `context-extraction` - Gather current context
2. `change-detection` - Detect changes since spec creation
3. `gap-analysis` - Re-assess gaps
4. `assumption-invalidation` - Re-validate assumptions

## Execution Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    /validate-spec                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Load existing specification                             │
│     - Parse spec file                                       │
│     - Extract requirements and acceptance criteria          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Gather current context                                  │
│     - Run context-extraction on current state               │
│     - Identify changes since spec creation                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Compare spec vs. current state                          │
│     - Which requirements are now met?                       │
│     - Which gaps have been closed?                          │
│     - What new gaps have emerged?                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Re-validate assumptions                                 │
│     - Check if unverified assumptions are now validated     │
│     - Check if validated assumptions still hold             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  OUTPUT: Validation report                                  │
└─────────────────────────────────────────────────────────────┘
```

## Output Format

```
Spec Validation: SPEC-FEATURE-20250110-a1b2c3
══════════════════════════════════════════════════════════════

Status: PARTIALLY_COMPLETE

Requirements Progress:
  [✓] User can initiate OAuth login         (implemented)
  [✓] Session tokens stored securely        (implemented)
  [○] Frontend login form complete          (in progress)
  [ ] Password reset flow                   (not started)

Acceptance Criteria:
  [✓] 3/5 criteria met

Gaps:
  Closed: GAP-001, GAP-002
  Remaining: GAP-003 (critical)
  New: GAP-004 (important)

Assumptions:
  Validated: ASM-001, ASM-003
  Still Unverified: ASM-002
  Invalidated: ASM-004 (requires attention!)

Drift Detected:
  - New endpoint added not in spec: /api/v1/refresh
  - Schema change not documented in spec

Recommendation: Update spec to reflect current state
══════════════════════════════════════════════════════════════
```

## Examples

```bash
# Validate a spec by ID
/validate-spec SPEC-FEATURE-20250110-a1b2c3

# Validate and update the spec file
/validate-spec SPEC-FEATURE-20250110-a1b2c3 --update

# Validate with strict mode (for CI/CD)
/validate-spec .claude/specs/auth-feature.md --strict
```

## Use Cases
- Pre-merge validation that implementation matches spec
- Periodic spec health checks
- CI/CD integration for spec-driven development
