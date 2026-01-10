# Targeted Evidence Plan

**Project**: `<PROJECT_NAME>`
**Branch**: `<TARGET_BRANCH>`
**Generated**: `<TIMESTAMP>`
**Iteration**: `<N>`
**Source**: Missing Details Backlog v`<VERSION>`

---

## Plan Summary

| Metric | Value |
|--------|-------|
| Total Probes | `___` |
| P0 Probes | `___` |
| P1 Probes | `___` |
| P2 Probes | `___` |
| Estimated Time | `___ min` |
| Slots Targeted | `___/14` |

---

## Execution Phases

### Phase 1: Quick Wins (< 5 min each, execute first)

| # | Gap ID | Slot | Probe Type | Command | Success Criteria | Failure Response | Est. Time |
|---|--------|------|------------|---------|------------------|------------------|-----------|
| 1 | G-01 | _[slot]_ | `diff` | `git diff <ref> -- <path>` | _[what to find]_ | _[what to do]_ | 2 min |
| 2 | G-02 | _[slot]_ | `file` | `cat <path>` | _[what to find]_ | _[what to do]_ | 1 min |
| 3 | G-03 | _[slot]_ | `commit` | `git log --oneline -5 -- <path>` | _[what to find]_ | _[what to do]_ | 2 min |

**Phase 1 Checkpoint**:
- [ ] All Quick Win probes executed
- [ ] Results documented
- [ ] Slots updated in Completeness Matrix
- [ ] Ready for Phase 2 OR sufficient completeness achieved

---

### Phase 2: Medium Cost (5-15 min each)

| # | Gap ID | Slot | Probe Type | Command | Success Criteria | Failure Response | Est. Time |
|---|--------|------|------------|---------|------------------|------------------|-----------|
| 4 | G-04 | _[slot]_ | `doc` | `grep -ri "<term>" docs/` | _[what to find]_ | _[what to do]_ | 10 min |
| 5 | G-05 | _[slot]_ | `test` | `grep -ri "test.*<feature>" tests/` | _[what to find]_ | _[what to do]_ | 10 min |
| 6 | G-06 | _[slot]_ | `file` | `find . -name "*<pattern>*"` | _[what to find]_ | _[what to do]_ | 5 min |

**Phase 2 Checkpoint**:
- [ ] All Medium Cost probes executed
- [ ] Results documented
- [ ] Slots updated in Completeness Matrix
- [ ] Ready for Phase 3 OR sufficient completeness achieved

---

### Phase 3: Developer Input (Last Resort)

| # | Gap ID | Slot | Question | Context | Fallback if No Response | Est. Time |
|---|--------|------|----------|---------|-------------------------|-----------|
| 7 | G-07 | _[slot]_ | _[specific question]_ | _[why we need to know]_ | _[assumption to use]_ | 15 min |
| 8 | G-08 | _[slot]_ | _[specific question]_ | _[why we need to know]_ | _[assumption to use]_ | 15 min |

**Phase 3 Checkpoint**:
- [ ] All Developer Input probes attempted
- [ ] Responses documented OR fallbacks applied
- [ ] Slots updated in Completeness Matrix
- [ ] Final completeness assessed

---

### Phase 4: Deferred (Time Permitting)

| # | Gap ID | Slot | Probe Type | Command | Success Criteria | Est. Time |
|---|--------|------|------------|---------|------------------|-----------|
| 9 | G-09 | _[slot]_ | _[type]_ | `<command>` | _[criteria]_ | 20 min |
| 10 | G-10 | _[slot]_ | _[type]_ | `<command>` | _[criteria]_ | 20 min |

**Defer Criteria**: Execute only if time permits AND all P0/P1 gaps resolved.

---

## Probe Execution Log

| # | Gap ID | Command Executed | Timestamp | Result | Finding | Slot Updated To |
|---|--------|------------------|-----------|--------|---------|-----------------|
| 1 | G-01 | `git diff...` | _[time]_ | SUCCESS / FAIL | _[finding]_ | FILLED / VAGUE |
| 2 | G-02 | `cat...` | _[time]_ | SUCCESS / FAIL | _[finding]_ | FILLED / VAGUE |

---

## Results Summary

### Before This Iteration

| Slot | Status | Confidence |
|------|--------|------------|
| Goal/Outcome | _[status]_ | _[conf]_ |
| User Persona | _[status]_ | _[conf]_ |
| ... | ... | ... |

### After This Iteration

| Slot | Status | Confidence | Changed |
|------|--------|------------|---------|
| Goal/Outcome | _[status]_ | _[conf]_ | YES/NO |
| User Persona | _[status]_ | _[conf]_ | YES/NO |
| ... | ... | ... | ... |

### Improvement Metrics

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Completeness | `___%` | `___%` | `+___%` |
| P0 Gaps | `___` | `___` | `-___` |
| P1 Gaps | `___` | `___` | `-___` |
| Average Confidence | `___` | `___` | `+___` |

---

## Next Iteration Recommendations

### Continue Probing (if completeness < 70%)
- [ ] Re-run `missing-details-regression` with new evidence
- [ ] Generate new Targeted Evidence Plan
- [ ] Execute Phase 1 of new plan

### Accept with Caveats (if completeness 70-85%)
- [ ] Document remaining gaps as "Accepted Risks"
- [ ] Apply fallback assumptions
- [ ] Proceed with implementation

### Ready to Proceed (if completeness > 85%)
- [ ] Finalize End-State Snapshot
- [ ] Archive Missing Details Backlog
- [ ] Begin implementation

---

## Probe Type Reference

| Type | When to Use | Cost | Reliability |
|------|-------------|------|-------------|
| `diff` | Check specific file changes | LOW | HIGH |
| `commit` | Extract commit intent | LOW | HIGH |
| `file` | Read source code | LOW | HIGH |
| `doc` | Search documentation | MEDIUM | MEDIUM |
| `test` | Infer from test cases | MEDIUM | HIGH |
| `ask` | Query developer (last resort) | HIGH | VARIES |

### Cost Guidelines
- **LOW**: < 5 minutes, no external dependencies
- **MEDIUM**: 5-15 minutes, may require reading multiple files
- **HIGH**: > 15 minutes, requires human input or external access

### Reliability Guidelines
- **HIGH**: Direct evidence, unlikely to be outdated
- **MEDIUM**: Indirect evidence, may need interpretation
- **VARIES**: Depends on response quality

---

## Template: New Probe Entry

```markdown
| # | Gap ID | Slot | Probe Type | Command | Success Criteria | Failure Response | Est. Time |
|---|--------|------|------------|---------|------------------|------------------|-----------|
| X | G-XX | _[slot]_ | `type` | `<command>` | _[criteria]_ | _[response]_ | X min |
```

---

## Abort Conditions

Stop evidence gathering if:
- [ ] 3+ consecutive probe failures on same slot
- [ ] Time budget exceeded by 50%
- [ ] All probe types exhausted for a P0 gap
- [ ] Developer explicitly states information unavailable

**Abort Actions**:
1. Document all attempts in Execution Log
2. Apply fallback assumptions from Missing Details Backlog
3. Mark slot as "ACCEPTED_RISK" in Completeness Matrix
4. Proceed with explicit risk acknowledgment
