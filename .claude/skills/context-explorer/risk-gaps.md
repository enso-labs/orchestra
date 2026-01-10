# Skill: Risk and Gap Identification

## Purpose
Identify risks, gaps, and unknowns in current understanding of the change.

## Inputs
- [ ] Synthesized specification
- [ ] Completeness model status
- [ ] Evidence quality assessment
- [ ] Test coverage analysis

## Outputs
- [ ] Prioritized risk list (P0/P1/P2)
- [ ] Gap analysis (critical missing information)
- [ ] Unknown/assumption list
- [ ] Mitigation recommendations
- [ ] Impact assessment per risk

## Execution Checklist

1. [ ] Analyze completeness slots
   - Count EMPTY slots → Critical gaps
   - Count VAGUE slots → Clarity gaps
   - Count CONFLICTING slots → Consistency risks

2. [ ] Identify risk categories
   - **Technical risks**: Architecture, scalability, compatibility
   - **Security risks**: Auth, data protection, vulnerabilities
   - **Performance risks**: Latency, throughput, resource usage
   - **Reliability risks**: Uptime, error handling, recovery
   - **Operational risks**: Deployment, rollback, monitoring
   - **Compliance risks**: Regulations, policies, legal

3. [ ] Extract explicit risks from evidence
   ```bash
   # From documentation
   grep -iE "risk|concern|warning|todo|fixme|hack|workaround" *.md

   # From commits
   git log --grep="TODO\|FIXME\|HACK\|workaround"

   # From code comments
   grep -rE "TODO|FIXME|HACK|XXX|WARN" src/
   ```

4. [ ] Infer implicit risks
   - Missing tests → Untested behavior risk
   - Empty performance slot → Performance uncertainty
   - No rollback plan → Deployment risk
   - Vague security requirements → Security vulnerability risk
   - No monitoring defined → Observability risk

5. [ ] Assess impact of each risk/gap
   - **Critical (P0)**: Blocks deployment, data loss, security breach
   - **High (P1)**: Degraded experience, workarounds needed
   - **Medium (P2)**: Minor inconvenience, can defer

6. [ ] Calculate "cost to validate"
   - Can we probe this cheaply? (read test, check config)
   - Or does it require expensive work? (integration test, load test)

7. [ ] Generate risk/gap report
   ```markdown
   ## Critical Risks (P0)

   ### R1: Token storage strategy undefined
   - **Category**: Technical Architecture
   - **Impact**: Cannot implement without decision
   - **Evidence**: TODO in PROPOSAL.md:L89, no code for storage
   - **Blockers**: Blocks token refresh implementation
   - **Mitigation**: Decide between Redis vs Postgres (estimated 2h)
   - **Cost to Validate**: Low (architectural decision)

   ### R2: No rate limiting implemented
   - **Category**: Security
   - **Impact**: API vulnerable to brute force attacks
   - **Evidence**: FIXME in auth.service.ts:L45
   - **Blockers**: Security audit will fail
   - **Mitigation**: Add rate limiting middleware (estimated 4h)
   - **Cost to Validate**: Medium (requires implementation)

   ## High Priority Gaps (P1)

   ### G1: Performance targets not specified
   - **Category**: Performance
   - **Impact**: Cannot validate if implementation meets needs
   - **Evidence**: Performance slot is EMPTY
   - **Blockers**: No acceptance criteria for perf testing
   - **Mitigation**: Define targets: auth < 200ms, token validation < 10ms
   - **Cost to Validate**: Low (define requirements)

   ## Medium Priority Risks (P2)

   ### R3: Token expiry configuration hardcoded
   - **Category**: Operational Flexibility
   - **Impact**: Requires code change to adjust expiry
   - **Evidence**: Hardcoded "1h" in jwt.service.ts:L12
   - **Blockers**: None (works, just inflexible)
   - **Mitigation**: Move to environment config
   - **Cost to Validate**: Low (code review)

   ## Unknowns/Assumptions

   ### U1: Assumption - Single instance deployment
   - **Impact**: Token storage in memory won't work with multiple instances
   - **Evidence**: No distributed storage mentioned
   - **Validation Needed**: Clarify deployment architecture
   - **Cost to Validate**: Low (ask deployment team)

   ### U2: Unknown - Token rotation policy
   - **Impact**: Security best practice unclear
   - **Evidence**: Not mentioned in any docs
   - **Validation Needed**: Define rotation requirements
   - **Cost to Validate**: Low (security team input)
   ```

8. [ ] Prioritize by (Impact × Likelihood) / Cost to Validate
   - High impact, high likelihood, low cost → P0
   - High impact, low likelihood, high cost → P1
   - Low impact, any likelihood, any cost → P2

9. [ ] Recommend next actions
   - P0 risks → Block until resolved
   - P1 risks → Resolve before deploy
   - P2 risks → Track in backlog
   - Unknowns → Add to evidence plan

## Failure Signals

- **No risks identified** → Re-analyze, risks always exist
- **All risks P0** → Over-prioritizing, re-assess
- **No mitigation suggestions** → Need actionable recommendations
- **Vague impact statements** → Be specific about consequences

## Quality Gates

- [ ] At least one risk/gap per EMPTY completeness slot
- [ ] Each risk has category, impact, evidence
- [ ] Each risk has priority (P0/P1/P2)
- [ ] Each risk has mitigation recommendation
- [ ] Each risk has cost-to-validate estimate
- [ ] Unknowns separated from risks
- [ ] Next actions prioritized

## Risk Categories and Examples

### Technical Risks
- Architecture doesn't scale to requirements
- Technology choice incompatible with existing stack
- Breaking changes to API contracts
- Data migration complexity

### Security Risks
- Authentication bypass vulnerability
- Sensitive data exposure
- Injection attack vectors
- Insufficient access controls

### Performance Risks
- Response time exceeds targets
- Memory/CPU usage too high
- Database query inefficiency
- Network bottlenecks

### Reliability Risks
- Single point of failure
- Inadequate error handling
- No retry/fallback logic
- Insufficient monitoring

### Operational Risks
- Complex deployment process
- No rollback strategy
- Breaking changes for users
- Insufficient logging

### Compliance Risks
- GDPR/privacy violations
- Audit trail gaps
- Regulatory requirements not met
- Data retention issues

## Impact Assessment Matrix

| Priority | Impact | Likelihood | Example |
|----------|--------|------------|---------|
| **P0** | Critical | High | Security vulnerability, data loss |
| **P0** | Critical | Medium | System outage, major bug |
| **P1** | High | High | Performance degradation |
| **P1** | High | Medium | User experience issue |
| **P1** | Critical | Low | Edge case crash |
| **P2** | Medium | High | Minor inconvenience |
| **P2** | Medium | Medium | Technical debt |
| **P2** | Low | Any | Cosmetic issues |

## Cost to Validate

### Low Cost (<1 hour)
- Read configuration file
- Review code section
- Check documentation
- Ask clarifying question

### Medium Cost (1-4 hours)
- Write integration test
- Prototype solution
- Research technology
- Analyze performance

### High Cost (>4 hours)
- Full load test
- Security audit
- Refactor implementation
- Multi-team coordination

## Risk Signal Patterns

### Explicit Risk Markers
- "TODO: Security review needed"
- "FIXME: Performance bottleneck"
- "HACK: Temporary workaround"
- "WARNING: This may break if..."
- "Known issue: ..."

### Implicit Risk Indicators
- No tests for critical path
- Hardcoded credentials/secrets
- Missing error handling
- Complex nested logic
- External dependencies without fallback
- No monitoring/alerting defined

### Gap Indicators
- Completeness slot marked EMPTY
- Documentation section says "TBD"
- Acceptance criteria missing for feature
- No rollout/migration plan
- Security requirements not mentioned
- Performance targets undefined
