# Context Explorer Report

**Generated**: `<TIMESTAMP>`
**Branch**: `<TARGET_BRANCH>`
**Since**: `<SINCE_REF>`
**Analyst**: Context Explorer Agent

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Completeness Score | `___%` |
| Confidence Level | `HIGH / MEDIUM / LOW` |
| Critical Gaps | `___` |
| Evidence Sources | `___` |
| Iterations Completed | `___` |

**One-Line Summary**: _[What this change set is trying to accomplish]_

---

## End-State Snapshot

### Target Outcome
_[1 paragraph: what the system will look like when this work is complete]_

### In-Scope
- [ ] _Item 1_
- [ ] _Item 2_
- [ ] _Item 3_

### Out-of-Scope
- [ ] _Explicitly excluded item 1_
- [ ] _Explicitly excluded item 2_

### Constraints
| Type | Constraint | Source |
|------|------------|--------|
| Technical | _[e.g., Must use existing DB schema]_ | _[commit/doc]_ |
| Time | _[e.g., Must ship before Q2]_ | _[doc]_ |
| Compliance | _[e.g., GDPR requirements]_ | _[doc]_ |
| Cost | _[e.g., No new infrastructure]_ | _[commit]_ |

### Interfaces Affected
| Interface | Change Type | Impact |
|-----------|-------------|--------|
| _[API endpoint]_ | `ADD / MODIFY / REMOVE` | `HIGH / MEDIUM / LOW` |
| _[Component]_ | `ADD / MODIFY / REMOVE` | `HIGH / MEDIUM / LOW` |
| _[Schema]_ | `ADD / MODIFY / REMOVE` | `HIGH / MEDIUM / LOW` |

### Acceptance Criteria (Testable)
- [ ] **AC-1**: _[Given X, When Y, Then Z]_
- [ ] **AC-2**: _[Given X, When Y, Then Z]_
- [ ] **AC-3**: _[Given X, When Y, Then Z]_

---

## Completeness Matrix

| Slot | Status | Value/Hypothesis | Evidence | Confidence |
|------|--------|------------------|----------|------------|
| Goal/Outcome | `FILLED / EMPTY / VAGUE / CONFLICTING` | _[value]_ | _[source]_ | `H / M / L` |
| User Persona | `FILLED / EMPTY / VAGUE / CONFLICTING` | _[value]_ | _[source]_ | `H / M / L` |
| Scope (In) | `FILLED / EMPTY / VAGUE / CONFLICTING` | _[value]_ | _[source]_ | `H / M / L` |
| Scope (Out) | `FILLED / EMPTY / VAGUE / CONFLICTING` | _[value]_ | _[source]_ | `H / M / L` |
| Constraints | `FILLED / EMPTY / VAGUE / CONFLICTING` | _[value]_ | _[source]_ | `H / M / L` |
| Interfaces | `FILLED / EMPTY / VAGUE / CONFLICTING` | _[value]_ | _[source]_ | `H / M / L` |
| Data Shape | `FILLED / EMPTY / VAGUE / CONFLICTING` | _[value]_ | _[source]_ | `H / M / L` |
| Business Logic | `FILLED / EMPTY / VAGUE / CONFLICTING` | _[value]_ | _[source]_ | `H / M / L` |
| Performance | `FILLED / EMPTY / VAGUE / CONFLICTING` | _[value]_ | _[source]_ | `H / M / L` |
| Reliability | `FILLED / EMPTY / VAGUE / CONFLICTING` | _[value]_ | _[source]_ | `H / M / L` |
| Security | `FILLED / EMPTY / VAGUE / CONFLICTING` | _[value]_ | _[source]_ | `H / M / L` |
| Observability | `FILLED / EMPTY / VAGUE / CONFLICTING` | _[value]_ | _[source]_ | `H / M / L` |
| Acceptance Criteria | `FILLED / EMPTY / VAGUE / CONFLICTING` | _[value]_ | _[source]_ | `H / M / L` |
| Rollout Plan | `FILLED / EMPTY / VAGUE / CONFLICTING` | _[value]_ | _[source]_ | `H / M / L` |
| Risks | `FILLED / EMPTY / VAGUE / CONFLICTING` | _[value]_ | _[source]_ | `H / M / L` |

**Completeness**: `___/14 slots FILLED` (`___%`)

---

## Missing Details Backlog

### P0 (Critical) — Blocks Implementation
| ID | Slot | Gap Description | Hypothesis | Probe |
|----|------|-----------------|------------|-------|
| G-01 | _[slot]_ | _[what's missing]_ | _[best guess]_ | _[cheapest probe]_ |

### P1 (Important) — Blocks Deployment
| ID | Slot | Gap Description | Hypothesis | Probe |
|----|------|-----------------|------------|-------|
| G-02 | _[slot]_ | _[what's missing]_ | _[best guess]_ | _[cheapest probe]_ |

### P2 (Nice to Have) — Quality Improvement
| ID | Slot | Gap Description | Hypothesis | Probe |
|----|------|-----------------|------------|-------|
| G-03 | _[slot]_ | _[what's missing]_ | _[best guess]_ | _[cheapest probe]_ |

---

## Targeted Evidence Plan

### Phase 1: Quick Wins (< 5 min each)
| Priority | Target Slot | Probe Type | Action | Success Criteria |
|----------|-------------|------------|--------|------------------|
| P0 | _[slot]_ | `diff` | `git show <ref>:<file>` | _[what we expect to find]_ |
| P0 | _[slot]_ | `file` | `cat <path>` | _[what we expect to find]_ |

### Phase 2: Medium Cost (5-15 min each)
| Priority | Target Slot | Probe Type | Action | Success Criteria |
|----------|-------------|------------|--------|------------------|
| P1 | _[slot]_ | `doc` | `grep -ri "<term>" docs/` | _[what we expect to find]_ |
| P1 | _[slot]_ | `test` | `grep -ri "test.*<feature>"` | _[what we expect to find]_ |

### Phase 3: Developer Input (Last Resort)
| Priority | Target Slot | Question | Fallback if No Response |
|----------|-------------|----------|-------------------------|
| P0 | _[slot]_ | _[specific question]_ | _[assumption to use]_ |

---

## Open Questions

| ID | Question | Impact if Unanswered | Assigned To |
|----|----------|----------------------|-------------|
| Q-01 | _[question]_ | `HIGH / MEDIUM / LOW` | _[person]_ |
| Q-02 | _[question]_ | `HIGH / MEDIUM / LOW` | _[person]_ |

---

## Ranked Next Actions

| Priority | Action | Owner | Depends On |
|----------|--------|-------|------------|
| 1 | _[action]_ | _[owner]_ | _[deps]_ |
| 2 | _[action]_ | _[owner]_ | _[deps]_ |
| 3 | _[action]_ | _[owner]_ | _[deps]_ |

---

## Evidence Log

| Source | Type | Key Finding | Confidence | Used For |
|--------|------|-------------|------------|----------|
| `<commit>` | commit | _[finding]_ | `H / M / L` | _[slot]_ |
| `<file>` | diff | _[finding]_ | `H / M / L` | _[slot]_ |
| `<doc>` | doc | _[finding]_ | `H / M / L` | _[slot]_ |

---

## Iteration History

| Iteration | Completeness | Gaps Closed | New Gaps Found | Time Spent |
|-----------|--------------|-------------|----------------|------------|
| 1 | `___%` | `___` | `___` | `___ min` |
| 2 | `___%` | `___` | `___` | `___ min` |

---

## Appendix: Raw Evidence

### A. Diff Summary
```
<paste diff stats here>
```

### B. Commit Log
```
<paste commit log here>
```

### C. High-Signal Files
```
<list files here>
```
