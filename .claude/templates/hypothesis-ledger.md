# Hypothesis Ledger

**Project**: `<PROJECT_NAME>`
**Branch**: `<TARGET_BRANCH>`
**Started**: `<TIMESTAMP>`
**Last Updated**: `<TIMESTAMP>`

---

## Purpose

Track all hypotheses made during context exploration. Each hypothesis must be validated or invalidated with evidence before the analysis is complete.

---

## Status Legend

| Status | Meaning |
|--------|---------|
| `OPEN` | Hypothesis formed, not yet tested |
| `TESTING` | Currently gathering evidence |
| `CONFIRMED` | Evidence supports hypothesis |
| `REJECTED` | Evidence contradicts hypothesis |
| `REVISED` | Original hypothesis modified based on evidence |

---

## Active Hypotheses

### H-001: _[Hypothesis Title]_

| Field | Value |
|-------|-------|
| **ID** | H-001 |
| **Status** | `OPEN / TESTING / CONFIRMED / REJECTED / REVISED` |
| **Slot** | _[Which completeness slot this addresses]_ |
| **Statement** | _[Clear, falsifiable statement]_ |
| **Basis** | _[What evidence led to this hypothesis]_ |
| **Confidence** | `HIGH / MEDIUM / LOW` |
| **Impact if Wrong** | `CRITICAL / SIGNIFICANT / MINOR` |
| **Test Plan** | _[How to validate/invalidate]_ |
| **Evidence Needed** | _[Specific evidence that would confirm]_ |
| **Counter-Evidence** | _[What would disprove this]_ |
| **Created** | `<TIMESTAMP>` |
| **Updated** | `<TIMESTAMP>` |

**Evidence Collected**:
- [ ] _[Evidence 1]_ → Supports / Contradicts / Neutral
- [ ] _[Evidence 2]_ → Supports / Contradicts / Neutral

**Resolution**: _[If resolved, what was the conclusion?]_

---

### H-002: _[Hypothesis Title]_

| Field | Value |
|-------|-------|
| **ID** | H-002 |
| **Status** | `OPEN / TESTING / CONFIRMED / REJECTED / REVISED` |
| **Slot** | _[Which completeness slot this addresses]_ |
| **Statement** | _[Clear, falsifiable statement]_ |
| **Basis** | _[What evidence led to this hypothesis]_ |
| **Confidence** | `HIGH / MEDIUM / LOW` |
| **Impact if Wrong** | `CRITICAL / SIGNIFICANT / MINOR` |
| **Test Plan** | _[How to validate/invalidate]_ |
| **Evidence Needed** | _[Specific evidence that would confirm]_ |
| **Counter-Evidence** | _[What would disprove this]_ |
| **Created** | `<TIMESTAMP>` |
| **Updated** | `<TIMESTAMP>` |

**Evidence Collected**:
- [ ] _[Evidence 1]_ → Supports / Contradicts / Neutral
- [ ] _[Evidence 2]_ → Supports / Contradicts / Neutral

**Resolution**: _[If resolved, what was the conclusion?]_

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total Hypotheses | `___` |
| OPEN | `___` |
| TESTING | `___` |
| CONFIRMED | `___` |
| REJECTED | `___` |
| REVISED | `___` |
| Confirmation Rate | `___%` |

---

## Hypothesis Chain

_Track how hypotheses relate to each other:_

```
H-001 (CONFIRMED)
  └── H-003 (derived from H-001)
       └── H-005 (derived from H-003)

H-002 (REJECTED)
  └── H-004 (REVISED: replaced H-002)
```

---

## Revision History

| Date | Hypothesis | Change | Reason |
|------|------------|--------|--------|
| `<DATE>` | H-001 | Created | _[reason]_ |
| `<DATE>` | H-001 | Status → TESTING | _[reason]_ |
| `<DATE>` | H-001 | Status → CONFIRMED | _[evidence found]_ |
| `<DATE>` | H-002 | Status → REJECTED | _[counter-evidence]_ |

---

## Quick Reference: Creating Good Hypotheses

### Hypothesis Checklist
- [ ] Addresses a specific completeness slot
- [ ] Is falsifiable (can be proven wrong)
- [ ] Has clear test plan
- [ ] Specifies evidence needed
- [ ] Specifies what would disprove it
- [ ] Has impact assessment

### Bad Hypothesis Examples
- ❌ "The code probably works" (not falsifiable)
- ❌ "Something about performance" (too vague)
- ❌ "Users will like it" (not testable from code)

### Good Hypothesis Examples
- ✅ "The PR adds JWT authentication to the /api/users endpoint" (specific, testable)
- ✅ "The schema migration is backwards-compatible" (falsifiable via schema diff)
- ✅ "Performance constraint is <100ms response time" (testable via test files)

---

## Template: New Hypothesis Entry

```markdown
### H-XXX: _[Hypothesis Title]_

| Field | Value |
|-------|-------|
| **ID** | H-XXX |
| **Status** | OPEN |
| **Slot** | _[slot]_ |
| **Statement** | _[statement]_ |
| **Basis** | _[basis]_ |
| **Confidence** | MEDIUM |
| **Impact if Wrong** | _[impact]_ |
| **Test Plan** | _[plan]_ |
| **Evidence Needed** | _[evidence]_ |
| **Counter-Evidence** | _[counter]_ |
| **Created** | <TIMESTAMP> |
| **Updated** | <TIMESTAMP> |

**Evidence Collected**:
- [ ] _[pending]_

**Resolution**: _[pending]_
```
