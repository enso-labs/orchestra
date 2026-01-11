# Context Explorer Runbook

Executable runbook for Context Explorer agent workflows. This runbook provides search and LSP-based methods for systematically extracting context from codebases.

**MODE: READ_ONLY** - No file modifications allowed.

## Overview

**Purpose**: Understand code structure and intent by exploring the codebase using search and LSP.

**Use Cases**:
- Understand how a feature works
- Explore architecture and dependencies
- Find implementations and interfaces
- Build specifications from existing code
- Identify gaps in understanding

**Core Philosophy**: Every feature has an intent. Extract that intent from available evidence (tests, types, docs, code) using search and LSP.

---

## Allowed Operations

| ✅ Allowed | ❌ Not Allowed |
|-----------|----------------|
| Read files | Write/modify files |
| Grep patterns | Git history commands |
| Glob file search | Git log/commit/branch |
| LSP definitions | File creation/deletion |
| LSP references | Any file mutations |
| `git diff --name-only` (unstaged only) | `git log`, `git diff <ref>` |

---

## Execution Phases

### PHASE 1: SCOPE

**Objective**: Define what to explore.

#### Step 1.1: Check Recently Edited Files (Optional)

```bash
# ONLY allowed git command - check unstaged changes
git diff --name-only
```

#### Step 1.2: Define Focus Area

```bash
# Set focus paths (examples)
FOCUS_PATHS="backend/src/services/auth"
SEARCH_TERMS="authentication JWT token"
```

**Checklist**:
- [ ] Focus area defined
- [ ] Search terms identified
- [ ] Scope boundaries established

---

### PHASE 2: DISCOVER

**Objective**: Find relevant files and code using search.

#### Step 2.1: Find Files by Pattern

```bash
# Find relevant files
Glob: **/*.py              # All Python files
Glob: **/auth/**/*.ts      # Auth-related TypeScript
Glob: **/test_*.py         # Python test files
Glob: **/*.test.tsx        # React test files
Glob: **/schema*.ts        # Schema files
Glob: **/types/*.ts        # Type definitions
```

#### Step 2.2: Search for Patterns

```bash
# Search for keywords
Grep: "authentication"     # Find auth references
Grep: "class.*Service"     # Find service classes
Grep: "def test_"          # Find Python tests
Grep: "describe\\("        # Find JS/TS tests
Grep: "TODO|FIXME"         # Find work items
Grep: "@api_route"         # Find API endpoints
```

#### Step 2.3: Use LSP Navigation

| Action | Purpose |
|--------|---------|
| Go to Definition | Find where symbol is defined |
| Find References | Find all usages of symbol |
| Find Implementations | Find interface implementations |
| Find Type Definition | Find type for symbol |

**Checklist**:
- [ ] Key files identified via Glob
- [ ] Patterns searched via Grep
- [ ] Symbols resolved via LSP
- [ ] Test files examined

---

### PHASE 3: EXTRACT

**Objective**: Extract intent from discovered evidence.

#### Step 3.1: Analyze Tests

Tests are the highest-signal evidence for expected behavior.

```bash
# Find test files
Glob: **/test_*.py
Glob: **/*.test.ts
Glob: **/*.spec.tsx

# Search for test descriptions
Grep: "describe\\(|it\\(|test\\("
Grep: "def test_"

# Search for assertions
Grep: "expect\\(|assert|should"
```

**Extract from tests**:
- Expected behaviors
- Edge cases handled
- Error conditions
- Integration points

#### Step 3.2: Analyze Types/Schemas

```bash
# Find type definitions
Glob: **/types/*.ts
Glob: **/schemas/*.py
Glob: **/*.d.ts

# Search for interfaces
Grep: "interface.*\\{"
Grep: "class.*Pydantic|BaseModel"
Grep: "type.*="
```

**Extract from types**:
- Data contracts
- API shapes
- Required vs optional fields
- Validation rules

#### Step 3.3: Analyze Documentation

```bash
# Find documentation
Glob: **/*.md
Glob: **/README*

# Search for requirements
Grep: "must|should|shall"
Grep: "acceptance|criteria"
Grep: "## Requirements"
```

**Extract from docs**:
- User stories
- Acceptance criteria
- Constraints
- Scope boundaries

**Checklist**:
- [ ] Test behaviors extracted
- [ ] Type contracts documented
- [ ] Documentation scanned
- [ ] API interfaces identified

---

### PHASE 4: VERIFY

**Objective**: Cross-reference evidence for consistency.

| Evidence A | Evidence B | Verify |
|------------|------------|--------|
| Tests | Implementation | Does code satisfy tests? |
| Types | Implementation | Does code match types? |
| Docs | Code | Are docs accurate? |
| Tests | Types | Are contracts tested? |

**Conflict Resolution**:
- Prefer: Tests > Types > Docs > Implementation
- Flag conflicts explicitly
- Mark confidence as LOW when conflicting

**Checklist**:
- [ ] Cross-references verified
- [ ] Conflicts documented
- [ ] Confidence assessed

---

### PHASE 5: REGRESS

**Objective**: Check completeness against 14-slot model.

For each slot, assign status: `FILLED` | `EMPTY` | `VAGUE` | `CONFLICTING`

| # | Slot | Status | Evidence Source |
|---|------|--------|-----------------|
| 1 | Goal/Outcome | ? | Docs, tests |
| 2 | User Persona | ? | Docs, API design |
| 3 | Scope (In/Out) | ? | File structure |
| 4 | Constraints | ? | Config, deps |
| 5 | Interfaces | ? | API defs, imports |
| 6 | Data Schemas | ? | Types, schemas |
| 7 | Business Logic | ? | Tests, services |
| 8 | Performance | ? | Tests, docs |
| 9 | Reliability | ? | Error handling |
| 10 | Security | ? | Auth checks |
| 11 | Observability | ? | Logging code |
| 12 | Acceptance Criteria | ? | Tests |
| 13 | Rollout Plan | ? | Scripts, docs |
| 14 | Risks | ? | TODOs, FIXMEs |

**Checklist**:
- [ ] All 14 slots evaluated
- [ ] Status assigned to each
- [ ] Gaps identified

---

### PHASE 6: PLAN PROBES

**Objective**: Create plan to fill gaps.

For each gap, define a probe:

| Gap Slot | Probe Type | Search Query | Success Criteria |
|----------|------------|--------------|------------------|
| [slot] | Grep | [pattern] | [what confirms] |
| [slot] | Glob | [pattern] | [what confirms] |
| [slot] | Read | [file path] | [what confirms] |
| [slot] | LSP | [symbol] | [what confirms] |

**Probe Priority**:
- P0: Blocks understanding
- P1: Important for completeness
- P2: Nice to have

**Checklist**:
- [ ] Probe for each gap
- [ ] Probes prioritized
- [ ] Success criteria defined

---

### PHASE 7: EXECUTE PROBES

**Objective**: Fill gaps by executing probes.

Execute probes in priority order:

```bash
# Example probes
Grep: "timeout|deadline" path/to/dir      # Performance constraints
Read: path/to/config.yaml                  # Configuration
LSP: findReferences("AuthService")         # Find all usages
Glob: **/migration*.sql                    # Migration files
```

After each probe:
- Update completeness matrix
- Re-evaluate confidence
- Mark slot as FILLED if confirmed

**Checklist**:
- [ ] P0 probes executed
- [ ] Completeness updated
- [ ] Improvement measured

---

### PHASE 8: EMIT

**Objective**: Produce final artifacts.

#### Output 1: Codebase Snapshot

```markdown
# Codebase Snapshot: [Feature Name]

**Completeness**: X/14 slots (Y%)
**Confidence**: HIGH/MEDIUM/LOW

## Target Outcome
[Description with evidence]

## Scope
- Included: [list]
- Excluded: [list]

## Interfaces
[Table of interfaces]

## Acceptance Criteria
[List from tests]

## Open Questions
[Remaining gaps]
```

#### Output 2: Missing Details Backlog

```markdown
## P0 Gaps
| Slot | Status | Hypothesis | Probe |
|------|--------|------------|-------|

## P1 Gaps
| Slot | Status | Hypothesis | Probe |
|------|--------|------------|-------|
```

#### Output 3: Evidence Plan

```markdown
## Remaining Probes
| Priority | Slot | Query | Success Criteria |
|----------|------|-------|------------------|
```

**Checklist**:
- [ ] Snapshot generated
- [ ] Backlog documented
- [ ] Evidence plan created

---

## Quick Reference

### Discovery Commands

| Purpose | Tool | Example |
|---------|------|---------|
| Find files | Glob | `**/*.service.ts` |
| Find patterns | Grep | `"class.*Controller"` |
| Find definition | LSP | Go to definition |
| Find usages | LSP | Find references |

### Evidence Priority

| Source | Priority | Signal Value |
|--------|----------|--------------|
| Tests | P0 | Very High |
| Types/Schemas | P0 | Very High |
| API definitions | P1 | High |
| Documentation | P1 | High |
| Implementation | P2 | Medium |
| Comments | P3 | Low |

### Completeness Thresholds

| Score | Status | Action |
|-------|--------|--------|
| < 50% | NOT READY | More exploration needed |
| 50-70% | PARTIAL | Can proceed with gaps tracked |
| 70-85% | GOOD | Minor gaps acceptable |
| > 85% | EXCELLENT | High confidence |

---

## Troubleshooting

### No files found
1. Broaden glob pattern
2. Check file extensions
3. Try different directory

### No pattern matches
1. Simplify regex
2. Try alternative terms
3. Check case sensitivity

### Conflicting evidence
1. Note both positions
2. Mark confidence LOW
3. Add to questions

### Low completeness
1. Execute more probes
2. Read related files
3. Accept with documentation

---

**Version**: 2.0
**Mode**: READ_ONLY
**Last Updated**: 2026-01-10
