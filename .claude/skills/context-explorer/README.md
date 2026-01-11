# Context Explorer Skills

Modular skills for exploring codebases using search and LSP to understand code structure, intent, and behavior.

**MODE: READ_ONLY** - No file modifications allowed.

## Overview

The Context Explorer systematically analyzes code by searching for patterns, navigating with LSP, and synthesizing findings into a complete specification.

**Core Philosophy**: Extract understanding from available evidence (tests, types, docs, code) using search and LSP navigation.

## Skill Index

| Skill | Purpose | Inputs | Outputs | Cost |
|-------|---------|--------|---------|------|
| **[codebase-search.md](./codebase-search.md)** | Find files and patterns | Search terms | File list, matches | Low |
| **[type-analysis.md](./type-analysis.md)** | Analyze type definitions | Type files | Data contracts | Low |
| **[test-analysis.md](./test-analysis.md)** | Extract behavior from tests | Test files | Acceptance criteria | Low |
| **[end-state-spec.md](./end-state-spec.md)** | Synthesize specification | All evidence | Full specification | Medium |
| **[acceptance-criteria.md](./acceptance-criteria.md)** | Extract testable criteria | Tests, docs | Acceptance criteria | Medium |
| **[risk-gaps.md](./risk-gaps.md)** | Identify risks and gaps | Specification | Risk/gap analysis | Low |
| **[missing-details-regression.md](./missing-details-regression.md)** | Check completeness | Specification | 14-slot matrix | Medium |
| **[evidence-plan.md](./evidence-plan.md)** | Generate probe plan | Gaps | Prioritized probes | Low |

## Workflow

### Standard Exploration Flow

```
1. codebase-search
   ↓ (relevant files identified)
2. type-analysis + test-analysis (parallel)
   ↓ (contracts and behaviors)
3. acceptance-criteria
   ↓ (testable criteria)
4. end-state-spec
   ↓ (synthesized specification)
5. missing-details-regression
   ↓ (completeness matrix)
6. risk-gaps
   ↓ (risk/gap analysis)
7. evidence-plan
   ↓ (prioritized probes)
8. Execute probes → Update spec → Repeat if needed
```

### Quick Analysis (< 5 minutes)

```
1. codebase-search (find key files)
2. Read tests (understand behavior)
3. Read types (understand contracts)
→ Quick context summary
```

## 14-Slot Completeness Model

Every specification must address these 14 slots:

| # | Slot | Critical? | Common Sources |
|---|------|-----------|----------------|
| 1 | **Goal/Outcome** | ✓ | Docs, README, tests |
| 2 | **User Persona/Stakeholder** | ✓ | Docs, API design |
| 3 | **Scope (In/Out)** | ✓ | File structure, exports |
| 4 | **Constraints** | ✓ | Config, dependencies |
| 5 | **Interfaces & Integrations** | ✓ | API definitions, imports |
| 6 | **Data Shape/Schemas/Contracts** | ✓ | Type defs, schemas |
| 7 | **Behavioral Rules/Business Logic** | - | Tests, service code |
| 8 | **Performance Expectations** | - | Tests, docs, config |
| 9 | **Reliability Expectations** | - | Error handling, retries |
| 10 | **Security/Privacy Requirements** | ✓ | Auth code, validation |
| 11 | **Observability Requirements** | - | Logging, metrics |
| 12 | **Acceptance Criteria** | ✓ | Test files |
| 13 | **Rollout/Migration Plan** | - | Scripts, docs |
| 14 | **Risks & Unknowns** | ✓ | TODO/FIXME comments |

**Slot Status Values**:
- **FILLED**: Strong evidence, high confidence
- **EMPTY**: No evidence found
- **VAGUE**: Partial/ambiguous evidence
- **CONFLICTING**: Contradictory evidence

## Evidence Source Types

| Source | Signal Value | Cost | When to Use |
|--------|--------------|------|-------------|
| **Test files** | Very High | Low | Always check first |
| **Type definitions** | Very High | Low | Data contracts |
| **API definitions** | High | Low | Interface contracts |
| **README/Docs** | High | Low | Context and intent |
| **Schema files** | High | Low | Data structure |
| **Service code** | Medium | Medium | Implementation details |
| **Config files** | Medium | Low | Constraints |
| **Comments** | Low | Low | Explanations |

## Probe Types

| Probe | Tool | When to Use |
|-------|------|-------------|
| Find files | Glob | Locate files by pattern |
| Find patterns | Grep | Search for text/regex |
| Go to definition | LSP | Find symbol source |
| Find references | LSP | Find all usages |
| Read file | Read | Examine specific file |

## Best Practices

### Do's
- Start with high-signal sources (tests, types)
- Use LSP for navigation
- Always check completeness
- Generate specific probes
- Track confidence levels
- Identify conflicts explicitly

### Don'ts
- Don't modify any files (READ_ONLY)
- Don't use git history commands
- Don't infer without evidence
- Don't skip completeness check
- Don't accept VAGUE when FILLED is achievable

## Completeness Thresholds

| Completeness | Recommendation |
|--------------|----------------|
| **< 50%** | NOT READY - More exploration needed |
| **50-70%** | PARTIAL - Proceed with gaps tracked |
| **70-85%** | GOOD - Minor gaps acceptable |
| **> 85%** | EXCELLENT - High confidence |

**Critical Slots** (must be FILLED):
1, 2, 3, 5, 6, 10, 12

## File Structure

```
context-explorer/
├── README.md                      # This file
├── SKILL.md                       # Main orchestration skill
├── codebase-search.md             # Find files and patterns
├── type-analysis.md               # Analyze types
├── test-analysis.md               # Analyze tests
├── end-state-spec.md              # Synthesize specification
├── acceptance-criteria.md         # Extract criteria
├── risk-gaps.md                   # Identify risks/gaps
├── missing-details-regression.md  # Completeness check
└── evidence-plan.md               # Generate probe plan
```

---

**Version**: 2.0
**Mode**: READ_ONLY
