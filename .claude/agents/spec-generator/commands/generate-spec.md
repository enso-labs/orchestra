# Command: /generate-spec

## Purpose
Generate a complete specification document from current codebase context.

## Usage
```
/generate-spec [options]
```

## Options
- `--branch <name>`: Analyze specific branch (default: current branch)
- `--base <name>`: Compare against specific base (default: development)
- `--type <type>`: Spec type: feature|bugfix|refactor (default: auto-detect)
- `--focus <area>`: Focus on specific area (backend, frontend, etc.)
- `--outcome <description>`: Explicit description of desired outcome

## Skill Mapping
This command orchestrates the following skills in sequence:

1. `context-extraction` - Gather context via context-explorer
2. `change-detection` - Analyze what has changed
3. `signal-noise-filtering` - Filter relevant information
4. `gap-analysis` - Identify what's missing
5. `assumption-invalidation` - Challenge assumptions
6. `end-state-regression` - Map path to completion
7. `spec-synthesis` - Generate final specification

## Execution Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    /generate-spec                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Invoke context-explorer skill                           │
│     - Extract intent from git history, diffs, commits       │
│     - Understand what developer is trying to accomplish     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Run change-detection                                    │
│     - Categorize all changes by domain and type             │
│     - Assess magnitude and risk                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Apply signal-noise-filtering                            │
│     - Focus on what matters for the outcome                 │
│     - Filter out irrelevant changes                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Perform gap-analysis                                    │
│     - Identify missing requirements                         │
│     - Find unclear areas                                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Run assumption-invalidation                             │
│     - Challenge detected assumptions                        │
│     - Validate or flag for verification                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  6. Execute end-state-regression                            │
│     - Work backward from outcome                            │
│     - Build dependency tree and critical path               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  7. Synthesize specification                                │
│     - Combine all analysis into structured spec             │
│     - Write to .claude/specs/{SPEC_ID}.md                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  OUTPUT: Spec file path and summary                         │
└─────────────────────────────────────────────────────────────┘
```

## Output
- Creates: `.claude/specs/SPEC-{TYPE}-{DATE}-{HASH}.md`
- Returns: Spec ID, file path, and brief summary

## Examples

```bash
# Generate spec from current branch context
/generate-spec

# Generate spec for a specific feature branch
/generate-spec --branch feat/user-auth

# Generate spec with explicit outcome
/generate-spec --outcome "Users can export their data in CSV format"

# Generate spec focused on backend changes
/generate-spec --focus backend --type feature
```

## Error Handling
- No changes detected: Prompts for manual outcome description
- Context-explorer fails: Falls back to direct git analysis
- Write fails: Reports error with diagnostic information
