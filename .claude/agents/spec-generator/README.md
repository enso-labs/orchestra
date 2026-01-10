# Spec Generator Agent

An AI agent that generates comprehensive specifications for features and fixes by leveraging the `context-explorer` to analyze codebase context.

## Quick Start

```bash
# Generate a spec from current branch context
/generate-spec

# Analyze a branch before spec generation
/analyze-branch feat/my-feature

# Validate an existing spec
/validate-spec SPEC-FEATURE-20250110-a1b2c3

# Refine a spec with new information
/refine-spec SPEC-FEATURE-20250110-a1b2c3
```

## Directory Structure

```
spec-generator/
├── spec-generator.md          # Agent definition
├── README.md                   # This file
├── skills/
│   ├── context-extraction.md      # Extract context via context-explorer
│   ├── change-detection.md        # Detect and categorize changes
│   ├── gap-analysis.md            # Find missing requirements
│   ├── assumption-invalidation.md # Challenge assumptions
│   ├── end-state-regression.md    # Work backward from outcome
│   ├── signal-noise-filtering.md  # Filter relevant information
│   └── spec-synthesis.md          # Generate final spec
└── commands/
    ├── generate-spec.md       # Main spec generation command
    ├── analyze-branch.md      # Branch analysis command
    ├── validate-spec.md       # Spec validation command
    └── refine-spec.md         # Iterative refinement command
```

## Output Location

All generated specifications are written to:
```
.claude/specs/SPEC-{TYPE}-{DATE}-{HASH}.md
```

## Workflow

1. **Analyze** - Use `/analyze-branch` to understand what's being worked on
2. **Generate** - Use `/generate-spec` to create initial specification
3. **Validate** - Use `/validate-spec` to check progress
4. **Refine** - Use `/refine-spec` to iteratively improve

## Integration with Context Explorer

This agent depends on the `context-explorer` skill to extract intent from:
- Git history and diffs
- Commit messages
- Documentation changes
- Code patterns

The context-explorer provides the evidence base that this agent uses to construct specifications.

## Use Cases

- **Feature Development**: Generate specs before implementing new features
- **Bug Fixes**: Document the problem and expected fix before coding
- **Refactoring**: Specify the target architecture before restructuring
- **Code Review**: Generate specs from PRs to understand intent
- **Onboarding**: Understand what a branch is trying to accomplish
