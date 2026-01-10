# Decision Log

**Project**: `<PROJECT_NAME>`
**Branch**: `<TARGET_BRANCH>`
**Started**: `<TIMESTAMP>`
**Last Updated**: `<TIMESTAMP>`

---

## Purpose

Track all decisions made during context exploration. Decisions document choices, rationale, and alternatives considered. Use this log to maintain accountability and enable future reference.

---

## Decision Status

| Status | Meaning |
|--------|---------|
| `PROPOSED` | Decision under consideration |
| `ACCEPTED` | Decision approved and active |
| `REJECTED` | Decision explicitly declined |
| `SUPERSEDED` | Replaced by a newer decision |
| `DEFERRED` | Postponed for later consideration |

---

## Active Decisions

### D-001: _[Decision Title]_

| Field | Value |
|-------|-------|
| **ID** | D-001 |
| **Status** | `PROPOSED / ACCEPTED / REJECTED / SUPERSEDED / DEFERRED` |
| **Date** | `<TIMESTAMP>` |
| **Context** | _[What situation prompted this decision?]_ |
| **Decision** | _[What was decided?]_ |
| **Rationale** | _[Why was this decided?]_ |
| **Alternatives Considered** | _[What else was considered?]_ |
| **Consequences** | _[What are the implications?]_ |
| **Evidence** | _[What evidence informed this?]_ |
| **Owner** | _[Who made this decision?]_ |
| **Reviewers** | _[Who reviewed?]_ |
| **Supersedes** | _[If applicable, which decision does this replace?]_ |
| **Superseded By** | _[If applicable, which decision replaced this?]_ |

**Alternatives Analysis**:

| Alternative | Pros | Cons | Why Not Chosen |
|-------------|------|------|----------------|
| _[Alt 1]_ | _[pros]_ | _[cons]_ | _[reason]_ |
| _[Alt 2]_ | _[pros]_ | _[cons]_ | _[reason]_ |

**Impact Assessment**:

| Dimension | Impact | Notes |
|-----------|--------|-------|
| Scope | `HIGH / MEDIUM / LOW` | _[notes]_ |
| Timeline | `HIGH / MEDIUM / LOW` | _[notes]_ |
| Risk | `HIGH / MEDIUM / LOW` | _[notes]_ |
| Cost | `HIGH / MEDIUM / LOW` | _[notes]_ |

---

### D-002: _[Decision Title]_

| Field | Value |
|-------|-------|
| **ID** | D-002 |
| **Status** | `PROPOSED / ACCEPTED / REJECTED / SUPERSEDED / DEFERRED` |
| **Date** | `<TIMESTAMP>` |
| **Context** | _[situation]_ |
| **Decision** | _[choice]_ |
| **Rationale** | _[why]_ |
| **Alternatives Considered** | _[options]_ |
| **Consequences** | _[implications]_ |
| **Evidence** | _[sources]_ |
| **Owner** | _[owner]_ |
| **Reviewers** | _[reviewers]_ |
| **Supersedes** | _[n/a]_ |
| **Superseded By** | _[n/a]_ |

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Total Decisions | `___` |
| ACCEPTED | `___` |
| REJECTED | `___` |
| DEFERRED | `___` |
| SUPERSEDED | `___` |

---

## Decision Categories

### Architecture Decisions
| ID | Title | Status | Date |
|----|-------|--------|------|
| D-001 | _[title]_ | ACCEPTED | _[date]_ |

### Scope Decisions
| ID | Title | Status | Date |
|----|-------|--------|------|
| D-002 | _[title]_ | ACCEPTED | _[date]_ |

### Process Decisions
| ID | Title | Status | Date |
|----|-------|--------|------|
| D-003 | _[title]_ | DEFERRED | _[date]_ |

---

## Decision Dependencies

_Track how decisions relate to each other:_

```
D-001 (ACCEPTED)
  └── D-003 (depends on D-001)
       └── D-005 (depends on D-003)

D-002 (SUPERSEDED)
  └── D-004 (superseded D-002)
```

---

## Revision History

| Date | Decision | Change | Reason |
|------|----------|--------|--------|
| `<DATE>` | D-001 | Created | _[reason]_ |
| `<DATE>` | D-001 | Status → ACCEPTED | _[reason]_ |
| `<DATE>` | D-002 | Status → SUPERSEDED | D-004 created |

---

## Quick Reference: Good Decision Records

### Decision Checklist
- [ ] Clear context explaining why decision was needed
- [ ] Explicit statement of what was decided
- [ ] Rationale with evidence
- [ ] Alternatives documented with analysis
- [ ] Consequences identified
- [ ] Owner assigned
- [ ] Impact assessed

### Bad Decision Records
- ❌ "We decided to use X" (no context or rationale)
- ❌ "After discussion, we went with the obvious choice" (no alternatives)
- ❌ "This is the best option" (no evidence)

### Good Decision Records
- ✅ "Given the need for <100ms latency (AC-003), we chose Redis over PostgreSQL for session storage because..."
- ✅ "We considered options A, B, C. B was rejected due to licensing. A vs C came down to..."

---

## Template: New Decision Entry

```markdown
### D-XXX: _[Decision Title]_

| Field | Value |
|-------|-------|
| **ID** | D-XXX |
| **Status** | PROPOSED |
| **Date** | <TIMESTAMP> |
| **Context** | _[situation]_ |
| **Decision** | _[choice]_ |
| **Rationale** | _[why]_ |
| **Alternatives Considered** | _[options]_ |
| **Consequences** | _[implications]_ |
| **Evidence** | _[sources]_ |
| **Owner** | _[owner]_ |
| **Reviewers** | _[reviewers]_ |
| **Supersedes** | n/a |
| **Superseded By** | n/a |

**Alternatives Analysis**:

| Alternative | Pros | Cons | Why Not Chosen |
|-------------|------|------|----------------|
| _[Alt 1]_ | _[pros]_ | _[cons]_ | _[reason]_ |

**Impact Assessment**:

| Dimension | Impact | Notes |
|-----------|--------|-------|
| Scope | MEDIUM | _[notes]_ |
| Timeline | LOW | _[notes]_ |
| Risk | LOW | _[notes]_ |
| Cost | LOW | _[notes]_ |
```
