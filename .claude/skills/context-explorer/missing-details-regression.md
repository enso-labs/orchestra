# Skill: Missing Details Regression (CRITICAL)

## Purpose
Compare synthesized specification against 14-slot completeness model to identify missing critical details.

## Inputs
- [ ] Synthesized specification from end-state-spec
- [ ] Evidence gathered from all sources
- [ ] 14-slot completeness model template

## Outputs
- [ ] Completeness matrix (14 slots × 4 dimensions)
- [ ] Status per slot (FILLED/EMPTY/VAGUE/CONFLICTING)
- [ ] Confidence level per slot (High/Medium/Low)
- [ ] Evidence sources per slot
- [ ] For non-FILLED slots: Evidence needed + cheapest probe + impact if wrong

## Execution Checklist

1. [ ] Initialize 14-slot completeness matrix
   ```markdown
   | Slot | Status | Value | Evidence | Confidence | If Missing |
   |------|--------|-------|----------|------------|------------|
   ```

2. [ ] Evaluate Slot 1: Goal/Outcome
   - [ ] Status: FILLED | EMPTY | VAGUE | CONFLICTING
   - [ ] Current Value/Hypothesis: [What are we trying to achieve?]
   - [ ] Evidence Sources: [commit abc, PROPOSAL.md:L10]
   - [ ] Confidence: High | Medium | Low
   - [ ] If not FILLED:
     - Evidence Needed: [Explicit goal statement]
     - Cheapest Probe: [Read PROPOSAL.md, check commit messages]
     - Impact If Wrong: [Build wrong feature, miss objectives]

3. [ ] Evaluate Slot 2: User Persona/Stakeholder
   - [ ] Status: FILLED | EMPTY | VAGUE | CONFLICTING
   - [ ] Current Value/Hypothesis: [Who is this for?]
   - [ ] Evidence Sources: [...]
   - [ ] Confidence: High | Medium | Low
   - [ ] If not FILLED:
     - Evidence Needed: [User personas, stakeholder list]
     - Cheapest Probe: [Grep for "as a", "user", "persona"]
     - Impact If Wrong: [Build for wrong audience, miss requirements]

4. [ ] Evaluate Slot 3: Scope (In/Out)
   - [ ] Status: FILLED | EMPTY | VAGUE | CONFLICTING
   - [ ] Current Value/Hypothesis: [What's included? What's excluded?]
   - [ ] Evidence Sources: [...]
   - [ ] Confidence: High | Medium | Low
   - [ ] If not FILLED:
     - Evidence Needed: [Explicit scope boundaries]
     - Cheapest Probe: [Search for "in scope", "out of scope", "future work"]
     - Impact If Wrong: [Scope creep, missed features]

5. [ ] Evaluate Slot 4: Constraints
   - [ ] Status: FILLED | EMPTY | VAGUE | CONFLICTING
   - [ ] Current Value/Hypothesis: [Tech, time, compliance, cost limits]
   - [ ] Evidence Sources: [...]
   - [ ] Confidence: High | Medium | Low
   - [ ] If not FILLED:
     - Evidence Needed: [Technical stack requirements, deadlines, budget]
     - Cheapest Probe: [Check config files, package.json, timelines]
     - Impact If Wrong: [Technical incompatibility, missed deadline]

6. [ ] Evaluate Slot 5: Interfaces & Integrations
   - [ ] Status: FILLED | EMPTY | VAGUE | CONFLICTING
   - [ ] Current Value/Hypothesis: [What systems connect?]
   - [ ] Evidence Sources: [...]
   - [ ] Confidence: High | Medium | Low
   - [ ] If not FILLED:
     - Evidence Needed: [API endpoints, service dependencies]
     - Cheapest Probe: [Check route files, import statements]
     - Impact If Wrong: [Integration failures, broken contracts]

7. [ ] Evaluate Slot 6: Data Shape/Schemas/Contracts
   - [ ] Status: FILLED | EMPTY | VAGUE | CONFLICTING
   - [ ] Current Value/Hypothesis: [Data structures, types]
   - [ ] Evidence Sources: [...]
   - [ ] Confidence: High | Medium | Low
   - [ ] If not FILLED:
     - Evidence Needed: [Type definitions, schemas, API contracts]
     - Cheapest Probe: [Read schema files, TypeScript interfaces]
     - Impact If Wrong: [Data corruption, type errors]

8. [ ] Evaluate Slot 7: Behavioral Rules/Business Logic
   - [ ] Status: FILLED | EMPTY | VAGUE | CONFLICTING
   - [ ] Current Value/Hypothesis: [Business rules, logic flows]
   - [ ] Evidence Sources: [...]
   - [ ] Confidence: High | Medium | Low
   - [ ] If not FILLED:
     - Evidence Needed: [Business rules, state transitions]
     - Cheapest Probe: [Read service files, test cases]
     - Impact If Wrong: [Incorrect behavior, business logic errors]

9. [ ] Evaluate Slot 8: Performance Expectations
   - [ ] Status: FILLED | EMPTY | VAGUE | CONFLICTING
   - [ ] Current Value/Hypothesis: [Latency, throughput, resource targets]
   - [ ] Evidence Sources: [...]
   - [ ] Confidence: High | Medium | Low
   - [ ] If not FILLED:
     - Evidence Needed: [Response time targets, scale requirements]
     - Cheapest Probe: [Search docs for "<Xms", "req/sec", "uptime"]
     - Impact If Wrong: [Performance issues, poor UX]

10. [ ] Evaluate Slot 9: Reliability Expectations
    - [ ] Status: FILLED | EMPTY | VAGUE | CONFLICTING
    - [ ] Current Value/Hypothesis: [Uptime, error handling]
    - [ ] Evidence Sources: [...]
    - [ ] Confidence: High | Medium | Low
    - [ ] If not FILLED:
      - Evidence Needed: [SLA targets, error handling strategy]
      - Cheapest Probe: [Check error handling code, retry logic]
      - Impact If Wrong: [System instability, poor reliability]

11. [ ] Evaluate Slot 10: Security/Privacy Requirements
    - [ ] Status: FILLED | EMPTY | VAGUE | CONFLICTING
    - [ ] Current Value/Hypothesis: [Auth, authorization, data protection]
    - [ ] Evidence Sources: [...]
    - [ ] Confidence: High | Medium | Low
    - [ ] If not FILLED:
      - Evidence Needed: [Security requirements, auth strategy]
      - Cheapest Probe: [Check auth code, security middleware]
      - Impact If Wrong: [Security vulnerabilities, data breaches]

12. [ ] Evaluate Slot 11: Observability Requirements
    - [ ] Status: FILLED | EMPTY | VAGUE | CONFLICTING
    - [ ] Current Value/Hypothesis: [Logging, metrics, tracing]
    - [ ] Evidence Sources: [...]
    - [ ] Confidence: High | Medium | Low
    - [ ] If not FILLED:
      - Evidence Needed: [Logging strategy, metrics to track]
      - Cheapest Probe: [Check for logger imports, monitoring config]
      - Impact If Wrong: [Cannot debug issues, no visibility]

13. [ ] Evaluate Slot 12: Acceptance Criteria (Testable)
    - [ ] Status: FILLED | EMPTY | VAGUE | CONFLICTING
    - [ ] Current Value/Hypothesis: [Testable success conditions]
    - [ ] Evidence Sources: [...]
    - [ ] Confidence: High | Medium | Low
    - [ ] If not FILLED:
      - Evidence Needed: [Specific testable criteria]
      - Cheapest Probe: [Read test files, acceptance criteria in docs]
      - Impact If Wrong: [Cannot validate success, ambiguous done]

14. [ ] Evaluate Slot 13: Rollout/Migration Plan
    - [ ] Status: FILLED | EMPTY | VAGUE | CONFLICTING
    - [ ] Current Value/Hypothesis: [Deployment strategy, migrations]
    - [ ] Evidence Sources: [...]
    - [ ] Confidence: High | Medium | Low
    - [ ] If not FILLED:
      - Evidence Needed: [Deployment plan, migration scripts]
      - Cheapest Probe: [Check for migration files, deployment docs]
      - Impact If Wrong: [Deployment failures, data loss]

15. [ ] Evaluate Slot 14: Risks & Unknowns
    - [ ] Status: FILLED | EMPTY | VAGUE | CONFLICTING
    - [ ] Current Value/Hypothesis: [Known risks, unknowns]
    - [ ] Evidence Sources: [...]
    - [ ] Confidence: High | Medium | Low
    - [ ] If not FILLED:
      - Evidence Needed: [Risk assessment, unknowns list]
      - Cheapest Probe: [Search for TODO, FIXME, risk mentions]
      - Impact If Wrong: [Surprises during implementation/deploy]

16. [ ] Generate completeness summary
    ```markdown
    ## Completeness Summary

    **FILLED**: X/14 (Y%)
    **EMPTY**: X/14 (Y%)
    **VAGUE**: X/14 (Y%)
    **CONFLICTING**: X/14 (Y%)

    **Overall Confidence**: [High/Medium/Low]
    **Ready for Implementation**: [Yes/No/Partial]
    ```

17. [ ] Generate missing details report
    ```markdown
    ## Missing Critical Details

    ### P0 Gaps (Blocking)
    1. **Slot X**: [Name]
       - Status: EMPTY
       - Evidence Needed: [Specific information]
       - Cheapest Probe: [Command/action]
       - Impact If Wrong: [Consequence]
       - Estimated Cost: [Low/Medium/High]

    ### P1 Gaps (Important)
    [Similar format]

    ### P2 Gaps (Nice to have)
    [Similar format]
    ```

## Failure Signals

- **All slots FILLED** → Re-check rigor, unlikely to have everything
- **All slots EMPTY** → Re-run evidence gathering
- **No confidence levels** → Need to assess evidence quality
- **No probes suggested** → Need actionable next steps

## Quality Gates

- [ ] All 14 slots evaluated
- [ ] Each slot has status (FILLED/EMPTY/VAGUE/CONFLICTING)
- [ ] Each slot has confidence level
- [ ] Each slot has evidence sources listed
- [ ] For non-FILLED slots: Evidence needed specified
- [ ] For non-FILLED slots: Cheapest probe identified
- [ ] For non-FILLED slots: Impact if wrong described
- [ ] Overall completeness percentage calculated
- [ ] Critical gaps prioritized (P0/P1/P2)

## Completeness Matrix Template

```markdown
# Completeness Matrix

| # | Slot | Status | Confidence | Evidence | Value/Hypothesis |
|---|------|--------|------------|----------|------------------|
| 1 | Goal/Outcome | FILLED | High | commit abc, PROPOSAL.md:L10 | Add JWT auth to API |
| 2 | User Persona | VAGUE | Medium | Inferred from context | API consumers (mobile/web) |
| 3 | Scope (In/Out) | FILLED | High | PROPOSAL.md:L45-60 | JWT auth IN, OAuth OUT |
| 4 | Constraints | EMPTY | - | - | Unknown |
| 5 | Interfaces | FILLED | Medium | routes/auth.ts | POST /auth/login, /auth/refresh |
| 6 | Data Schemas | FILLED | High | types/auth.ts:L15-30 | AuthRequest, AuthResponse |
| 7 | Behavioral Rules | VAGUE | Low | Inferred from tests | Token expires after 1h |
| 8 | Performance | EMPTY | - | - | Unknown |
| 9 | Reliability | EMPTY | - | - | Unknown |
| 10 | Security | FILLED | Medium | PROPOSAL.md:L75 | JWT + refresh tokens |
| 11 | Observability | EMPTY | - | - | Unknown |
| 12 | Acceptance Criteria | FILLED | High | PROPOSAL.md:L90-95, tests | 5 criteria defined |
| 13 | Rollout | VAGUE | Low | No explicit plan | Assuming standard deploy |
| 14 | Risks | FILLED | Medium | TODO comments | Token storage strategy TBD |

## Summary
- FILLED: 7/14 (50%)
- EMPTY: 4/14 (29%)
- VAGUE: 3/14 (21%)
- CONFLICTING: 0/14 (0%)

Overall: **PARTIAL** - Need to fill critical gaps before implementation
```

## Gap Impact Assessment

### Critical Impact (P0) - Blocks Implementation
- Goal/Outcome EMPTY → Don't know what to build
- User Persona EMPTY → Don't know who for
- Scope EMPTY → Don't know boundaries
- Interfaces EMPTY → Don't know contracts
- Data Schemas EMPTY → Don't know types
- Security EMPTY → Vulnerability risk

### High Impact (P1) - Blocks Deployment
- Performance EMPTY → May not meet needs
- Reliability EMPTY → May have outages
- Acceptance Criteria EMPTY → Can't validate
- Rollout Plan EMPTY → Deployment risk

### Medium Impact (P2) - Reduces Quality
- Constraints VAGUE → May hit limitations
- Behavioral Rules VAGUE → Edge cases unclear
- Observability EMPTY → Hard to debug
- Risks EMPTY → Surprises later

## Status Definitions

### FILLED
- Explicit statement in evidence
- Multiple corroborating sources
- No ambiguity
- High confidence

### EMPTY
- No evidence found
- No reasonable inference possible
- Critical information gap

### VAGUE
- Partial evidence
- Ambiguous statements
- Weak inference
- Low confidence in interpretation

### CONFLICTING
- Contradictory evidence sources
- Unresolved disagreement
- Need clarification
- Cannot synthesize single answer
