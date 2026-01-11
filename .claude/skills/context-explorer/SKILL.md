---
name: context-explorer
description: |
  Systematically explore codebases using search and LSP to understand code structure,
  intent, and behavior. READ_ONLY mode - no file modifications.
---

# Context Explorer

Explore codebases using search and LSP to understand code structure and create complete specifications.

**MODE: READ_ONLY** - Cannot modify files.

## Instructions

### Prerequisites

- Access to codebase files
- Search tools (Grep, Glob)
- LSP navigation
- Understanding of 14-slot completeness model

### Workflow

1. **Scope**: Define focus area and search terms
2. **Discover**: Find relevant files using Glob and Grep
3. **Extract**: Analyze tests, types, and docs
4. **Verify**: Cross-reference evidence
5. **Regress**: Check completeness against 14-slot model
6. **Plan**: Generate probes for gaps
7. **Emit**: Produce specification with evidence

### Core Skills

This skill orchestrates these sub-skills:

1. **codebase-search**: Find files and patterns
2. **type-analysis**: Analyze type definitions
3. **test-analysis**: Extract behavior from tests
4. **end-state-spec**: Synthesize specification
5. **acceptance-criteria**: Extract testable criteria
6. **risk-gaps**: Identify risks and gaps
7. **missing-details-regression**: Check completeness
8. **evidence-plan**: Generate probe plan

## Examples

### Example 1: Understand a Feature

```
User: "How does authentication work?"

Agent:
1. Glob: **/auth/**/*.py
2. Grep: "authenticate|login|token"
3. Read test files for expected behavior
4. Read type definitions for contracts
5. Check completeness: 10/14 slots filled
6. Generate probes for gaps

Output: Specification with evidence
```

### Example 2: Find Implementation

```
User: "Where is the user service implemented?"

Agent:
1. Grep: "class.*UserService"
2. LSP: Go to definition
3. LSP: Find references
4. Read related tests
5. Document interfaces

Output: Implementation map with dependencies
```

## 14-Slot Completeness Model

| # | Slot | Evidence Sources |
|---|------|------------------|
| 1 | Goal/Outcome | Docs, README, tests |
| 2 | User Persona | Docs, API design |
| 3 | Scope | File structure, exports |
| 4 | Constraints | Config, dependencies |
| 5 | Interfaces | API definitions, imports |
| 6 | Data Shape | Types, schemas |
| 7 | Business Logic | Tests, service code |
| 8 | Performance | Tests, docs |
| 9 | Reliability | Error handling |
| 10 | Security | Auth code, validation |
| 11 | Observability | Logging, metrics |
| 12 | Acceptance Criteria | Test files |
| 13 | Rollout Plan | Scripts, docs |
| 14 | Risks | TODOs, FIXMEs |

**Status Values**: FILLED | EMPTY | VAGUE | CONFLICTING

## Guidelines

- **READ_ONLY**: Never modify files
- Start with tests and types (highest signal)
- Use LSP for navigation
- Check completeness against 14-slot model
- Generate specific probes, not vague questions
- Track confidence levels
- Flag conflicts explicitly

## Evidence Priority

| Source | Priority | Value |
|--------|----------|-------|
| Tests | P0 | Very High |
| Types/Schemas | P0 | Very High |
| API definitions | P1 | High |
| Documentation | P1 | High |
| Implementation | P2 | Medium |
| Comments | P3 | Low |

## Probe Types

| Probe | Tool | Example |
|-------|------|---------|
| Find files | Glob | `**/*.service.ts` |
| Find patterns | Grep | `"class.*Controller"` |
| Go to definition | LSP | Navigate to symbol |
| Find references | LSP | Find all usages |
| Read file | Read | `path/to/file.ts` |
