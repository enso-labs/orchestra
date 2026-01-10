# Skill: End-State Specification Synthesis

## Purpose
Synthesize complete end-state specification from all evidence sources with confidence levels.

## Inputs
- [ ] Findings from diff-triage
- [ ] Intent from commit-intent-extraction
- [ ] Signals from doc-delta-scan
- [ ] Test coverage analysis
- [ ] Code change patterns

## Outputs
- [ ] Complete specification document
- [ ] Confidence level per section (High/Medium/Low)
- [ ] Evidence sources cited
- [ ] Gaps identified
- [ ] Conflicting signals flagged

## Execution Checklist

1. [ ] Aggregate all evidence
   - Commit intent findings
   - Documentation extractions
   - Test case signals
   - Type/schema changes
   - Configuration changes

2. [ ] Synthesize each completeness slot
   - Slot 1: Goal/Outcome
   - Slot 2: User Persona/Stakeholder
   - Slot 3: Scope (In/Out)
   - Slot 4: Constraints
   - Slot 5: Interfaces & Integrations
   - Slot 6: Data Shape/Schemas/Contracts
   - Slot 7: Behavioral Rules/Business Logic
   - Slot 8: Performance Expectations
   - Slot 9: Reliability Expectations
   - Slot 10: Security/Privacy Requirements
   - Slot 11: Observability Requirements
   - Slot 12: Acceptance Criteria
   - Slot 13: Rollout/Migration Plan
   - Slot 14: Risks & Unknowns

3. [ ] Resolve conflicts
   - Identify contradicting evidence
   - Apply resolution heuristics:
     - Documentation > Commit messages
     - Tests > Comments
     - Explicit > Implicit
     - Recent > Old
   - Flag unresolvable conflicts

4. [ ] Assign confidence levels
   - **High**: Multiple corroborating sources, explicit statements
   - **Medium**: Single source, clear inference
   - **Low**: Weak inference, assumption

5. [ ] Cite evidence sources
   - Format: `[Source: commit abc123, PROPOSAL.md:L45]`
   - Link each statement to origin

6. [ ] Format specification document
   ```markdown
   # Specification: [Feature Name]

   **Confidence: [Overall]** | **Status: [DRAFT/COMPLETE]**

   ## 1. Goal/Outcome
   **Confidence: High** | [Sources: ...]

   [Goal statement]

   ## 2. User Persona/Stakeholder
   **Confidence: Medium** | [Sources: ...]

   [Personas identified]

   ...

   ## Gaps
   - Slot X: [What's missing]
   - Slot Y: [What's unclear]

   ## Conflicts
   - [Conflicting signal description]
   ```

7. [ ] Validate completeness
   - Check all 14 slots addressed
   - Ensure each has status (FILLED/EMPTY/VAGUE/CONFLICTING)
   - Verify evidence citations
   - Confirm confidence rationale

## Failure Signals

- **No evidence for any slot** → Re-run evidence gathering
- **All confidence "Low"** → Need better evidence sources
- **Unresolved conflicts** → Need developer clarification
- **More than 50% slots EMPTY** → Insufficient context for spec

## Quality Gates

- [ ] All 14 completeness slots addressed
- [ ] Each slot has confidence level (High/Medium/Low)
- [ ] Evidence sources cited for FILLED slots
- [ ] Gaps explicitly listed
- [ ] Conflicts flagged and explained
- [ ] Overall confidence score calculated
- [ ] Specification is actionable (testable, implementable)

## Specification Template

```markdown
# Specification: [Feature/Change Name]

**Overall Confidence: [High/Medium/Low]**
**Completeness: [X/14 slots filled]**
**Status: [DRAFT/COMPLETE/NEEDS_REVIEW]**

---

## 1. Goal/Outcome
**Status: [FILLED/EMPTY/VAGUE/CONFLICTING]**
**Confidence: [High/Medium/Low]**
**Sources: [commit abc123, PROPOSAL.md:L45-60]**

[What are we trying to achieve?]

---

## 2. User Persona/Stakeholder
**Status: [FILLED/EMPTY/VAGUE/CONFLICTING]**
**Confidence: [High/Medium/Low]**
**Sources: [...]**

[Who is this for? Who are the stakeholders?]

---

## 3. Scope
**Status: [FILLED/EMPTY/VAGUE/CONFLICTING]**
**Confidence: [High/Medium/Low]**
**Sources: [...]**

### In Scope
- [Item 1]
- [Item 2]

### Out of Scope
- [Item 1]
- [Item 2]

---

## 4. Constraints
**Status: [FILLED/EMPTY/VAGUE/CONFLICTING]**
**Confidence: [High/Medium/Low]**
**Sources: [...]**

### Technical Constraints
- [Constraint 1]

### Time Constraints
- [Constraint 1]

### Compliance Constraints
- [Constraint 1]

### Cost Constraints
- [Constraint 1]

---

## 5. Interfaces & Integrations
**Status: [FILLED/EMPTY/VAGUE/CONFLICTING]**
**Confidence: [High/Medium/Low]**
**Sources: [...]**

[What systems/APIs/services does this connect to?]

---

## 6. Data Shape/Schemas/Contracts
**Status: [FILLED/EMPTY/VAGUE/CONFLICTING]**
**Confidence: [High/Medium/Low]**
**Sources: [...]**

```typescript
// Example schema
interface Example {
  field: string;
}
```

---

## 7. Behavioral Rules/Business Logic
**Status: [FILLED/EMPTY/VAGUE/CONFLICTING]**
**Confidence: [High/Medium/Low]**
**Sources: [...]**

- Rule 1: [Condition → Action]
- Rule 2: [Condition → Action]

---

## 8. Performance Expectations
**Status: [FILLED/EMPTY/VAGUE/CONFLICTING]**
**Confidence: [High/Medium/Low]**
**Sources: [...]**

- Response time: [target]
- Throughput: [target]
- Resource usage: [target]

---

## 9. Reliability Expectations
**Status: [FILLED/EMPTY/VAGUE/CONFLICTING]**
**Confidence: [High/Medium/Low]**
**Sources: [...]**

- Uptime: [target]
- Error rate: [target]
- Recovery time: [target]

---

## 10. Security/Privacy Requirements
**Status: [FILLED/EMPTY/VAGUE/CONFLICTING]**
**Confidence: [High/Medium/Low]**
**Sources: [...]**

- Authentication: [approach]
- Authorization: [approach]
- Data protection: [approach]

---

## 11. Observability Requirements
**Status: [FILLED/EMPTY/VAGUE/CONFLICTING]**
**Confidence: [High/Medium/Low]**
**Sources: [...]**

- Logging: [requirements]
- Metrics: [requirements]
- Tracing: [requirements]

---

## 12. Acceptance Criteria
**Status: [FILLED/EMPTY/VAGUE/CONFLICTING]**
**Confidence: [High/Medium/Low]**
**Sources: [...]**

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

---

## 13. Rollout/Migration Plan
**Status: [FILLED/EMPTY/VAGUE/CONFLICTING]**
**Confidence: [High/Medium/Low]**
**Sources: [...]**

[How will this be deployed? Migration strategy?]

---

## 14. Risks & Unknowns
**Status: [FILLED/EMPTY/VAGUE/CONFLICTING]**
**Confidence: [High/Medium/Low]**
**Sources: [...]**

### Known Risks
- [Risk 1] → Mitigation: [approach]

### Unknowns
- [Unknown 1] → Need to: [probe]

---

## Summary

### Filled Slots: X/14
[List filled slots]

### Empty/Vague Slots: Y/14
[List gaps]

### Conflicts: Z
[List conflicts]

### Recommended Next Actions
1. [Action to fill critical gap]
2. [Action to resolve conflict]
3. [Action to validate assumption]

---

## Evidence Quality Assessment

| Slot | Status | Confidence | Evidence Strength |
|------|--------|------------|-------------------|
| 1. Goal | FILLED | High | Multiple sources |
| 2. Persona | VAGUE | Low | Inferred only |
| ... | ... | ... | ... |
```

## Confidence Level Criteria

### High Confidence
- Multiple corroborating sources (docs + commits + tests)
- Explicit, unambiguous statements
- Recent evidence
- Author is subject matter expert

### Medium Confidence
- Single clear source (e.g., proposal doc)
- Clear inference from code changes
- Older evidence but still valid
- Author is contributor

### Low Confidence
- Weak inference only
- Contradictory signals
- No explicit statement
- Assumption required

## Conflict Resolution Heuristics

1. **Documentation > Commit messages** (docs are deliberate)
2. **Tests > Comments** (tests are executable)
3. **Explicit > Implicit** (stated > inferred)
4. **Recent > Old** (latest commits win)
5. **Author > Contributor** (original author intent)
6. **Specific > General** (detailed > vague)

When conflicts can't be resolved, flag as **CONFLICTING** and list both sides.
