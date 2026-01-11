# Command: /refine-spec

## Purpose
Iteratively improve an existing specification with new information, closing gaps and increasing fidelity of the end-state model.

## Usage
```
/refine-spec <spec-id-or-path> [options]
```

## Options
- `--input <source>`: Source of new information (branch, commit, file, prompt)
- `--focus <area>`: Focus refinement on specific section
- `--interactive`: Prompt for clarifications during refinement

## Skill Mapping
This command orchestrates all skills in refinement mode:

1. `context-extraction` - Gather new context
2. `change-detection` - Detect new changes
3. `gap-analysis` - Re-assess gaps with new info
4. `assumption-invalidation` - Re-test assumptions
5. `end-state-regression` - Refine dependency tree
6. `signal-noise-filtering` - Filter new information
7. `spec-synthesis` - Update specification

## Execution Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    /refine-spec                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Load existing specification                             │
│     - Parse current spec state                              │
│     - Identify areas needing refinement                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Gather new context                                      │
│     - From specified input source                           │
│     - From recent codebase changes                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Merge new information                                   │
│     - Filter relevant signals                               │
│     - Update gap analysis                                   │
│     - Re-validate assumptions                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Refine end-state model                                  │
│     - Update dependency tree                                │
│     - Adjust critical path                                  │
│     - Improve acceptance criteria                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Update specification                                    │
│     - Increment version                                     │
│     - Add refinement changelog                              │
│     - Write updated spec                                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  OUTPUT: Updated spec with diff summary                     │
└─────────────────────────────────────────────────────────────┘
```

## Output Format

```
Spec Refinement: SPEC-FEATURE-20250110-a1b2c3
══════════════════════════════════════════════════════════════

Version: 1 → 2

Changes Made:
  + Added requirement: Password strength validation
  + Added acceptance criterion: Passwords must be 12+ chars
  ~ Updated gap GAP-003: Now resolved with migration script
  ~ Updated assumption ASM-002: Now validated via testing
  - Removed: Outdated OAuth1 references

Gaps Status:
  Before: 4 critical, 3 important
  After:  2 critical, 2 important

End-State Fidelity:
  Before: 65%
  After:  78%

Remaining Unknowns:
  - Email verification flow details
  - Rate limiting thresholds

Updated spec written to: .claude/specs/SPEC-FEATURE-20250110-a1b2c3.md
══════════════════════════════════════════════════════════════
```

## Examples

```bash
# Refine spec with latest branch changes
/refine-spec SPEC-FEATURE-20250110-a1b2c3 --input branch:feat/user-auth

# Refine spec with specific commit information
/refine-spec SPEC-FEATURE-20250110-a1b2c3 --input commit:abc1234

# Interactive refinement (prompts for clarifications)
/refine-spec SPEC-FEATURE-20250110-a1b2c3 --interactive

# Focus refinement on specific section
/refine-spec SPEC-FEATURE-20250110-a1b2c3 --focus "acceptance criteria"
```

## Iterative Refinement Model

Each refinement cycle should:
1. Increase end-state fidelity percentage
2. Reduce number of critical gaps
3. Convert unverified assumptions to validated or invalidated
4. Add more specific acceptance criteria
5. Clarify ambiguous requirements

Target: 90%+ fidelity before implementation begins
