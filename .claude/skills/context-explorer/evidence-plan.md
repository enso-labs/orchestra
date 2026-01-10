# Skill: Evidence Plan Generation (CRITICAL)

## Purpose
Generate prioritized, targeted evidence-gathering plan to fill gaps in specification understanding.

## Inputs
- [ ] Completeness matrix from missing-details-regression
- [ ] Gap analysis from risk-gaps
- [ ] Current evidence quality assessment
- [ ] Available evidence sources

## Outputs
- [ ] Prioritized evidence-gathering action list (P0/P1/P2)
- [ ] Specific probe commands/actions per gap
- [ ] Success criteria per probe
- [ ] Failure response per probe
- [ ] Estimated cost per probe
- [ ] Total time estimate

## Execution Checklist

1. [ ] Import gaps from missing-details-regression
   - EMPTY slots → Evidence needed
   - VAGUE slots → Clarification needed
   - CONFLICTING slots → Resolution needed

2. [ ] For each gap, identify probe type
   - **diff**: Check specific file changes
   - **commit**: Extract commit details
   - **doc**: Read documentation
   - **file**: Read source code
   - **test**: Check test coverage
   - **ask**: Query developer (last resort)

3. [ ] For each gap, design specific probe
   ```markdown
   Gap: Performance Expectations (Slot 8) - EMPTY

   Probe 1: Search docs for performance targets
   - Type: doc
   - Command: `grep -riE "(<[0-9]+ms|req.*sec|[0-9]+% uptime)" docs/`
   - Success: Find explicit performance numbers
   - Failure: Try Probe 2
   - Cost: Low (30 seconds)

   Probe 2: Check test files for performance assertions
   - Type: test
   - Command: `grep -r "performance\|timeout\|benchmark" tests/`
   - Success: Find performance test cases
   - Failure: Mark as EMPTY, ask developer
   - Cost: Low (1 minute)

   Probe 3: Ask developer for performance targets
   - Type: ask
   - Question: "What are the performance targets for auth endpoints?"
   - Success: Get specific targets
   - Failure: Use industry standards as default
   - Cost: High (blocks on human response)
   ```

4. [ ] Prioritize probes by impact and cost
   - **P0**: Blocks implementation, low cost to validate
   - **P1**: Blocks deployment, low-medium cost
   - **P2**: Reduces quality, any cost

5. [ ] Generate ordered action plan
   ```markdown
   ## Evidence Gathering Plan

   ### Phase 1: Quick Wins (P0, Low Cost)
   **Estimated Time: 15 minutes**

   1. [ ] Slot 4: Check Constraints
      - Probe: `Read package.json` + `Read tsconfig.json`
      - Target: Technical constraints (dependencies, TypeScript config)
      - Success: Identify tech stack constraints
      - Failure: Check docker files, config files

   2. [ ] Slot 8: Check Performance Requirements
      - Probe: `grep -riE "(<[0-9]+ms|req.*sec)" docs/ PROPOSAL*.md`
      - Target: Performance expectations
      - Success: Find explicit targets
      - Failure: Move to test files

   3. [ ] Slot 11: Check Observability
      - Probe: `grep -r "logger\|console\.log\|metrics" src/`
      - Target: Logging/monitoring patterns
      - Success: Identify observability approach
      - Failure: Mark as EMPTY, add to backlog

   ### Phase 2: Medium Cost (P1, Medium Cost)
   **Estimated Time: 30 minutes**

   4. [ ] Slot 7: Clarify Behavioral Rules
      - Probe: `Read src/auth/service.ts` + `Read tests/auth.test.ts`
      - Target: Business logic rules
      - Success: Document all rules
      - Failure: Infer from test cases

   5. [ ] Slot 13: Check Rollout Plan
      - Probe: `Read deployment/` + `git log --grep="deploy\|migration"`
      - Target: Deployment strategy
      - Success: Find migration scripts, deploy docs
      - Failure: Ask for rollout plan

   ### Phase 3: Developer Input (P0/P1, High Cost)
   **Estimated Time: Async (blocks on human)**

   6. [ ] Slot 4: Clarify Time Constraints
      - Probe: Ask "What is the target completion date?"
      - Target: Timeline/deadline
      - Success: Get specific date
      - Failure: Assume flexible timeline

   7. [ ] Slot 9: Clarify Reliability Expectations
      - Probe: Ask "What are the uptime/SLA requirements?"
      - Target: Reliability targets
      - Success: Get SLA requirements
      - Failure: Use industry standard (99.9%)

   ### Phase 4: Deferred (P2, Optional)
   **Estimated Time: 15 minutes**

   8. [ ] Slot 11: Enhance Observability Understanding
      - Probe: `Read monitoring config files`
      - Target: Detailed monitoring setup
      - Success: Document metrics/alerts
      - Failure: Acceptable to leave vague
   ```

6. [ ] Add probe execution template
   ```markdown
   ## Probe Execution Template

   ### Probe: [Name]
   - [ ] Execute command
   - [ ] Record findings
   - [ ] Update completeness matrix
   - [ ] If success → Mark slot FILLED
   - [ ] If failure → Execute fallback probe or mark EMPTY

   **Command**:
   ```bash
   [specific command]
   ```

   **Success Criteria**:
   - [Specific outcome]

   **Failure Response**:
   - [Next action]

   **Findings**:
   [Record results here]
   ```

7. [ ] Generate summary
   ```markdown
   ## Plan Summary

   **Total Probes**: 8
   **P0 (Critical)**: 3 probes, 15 min estimated
   **P1 (Important)**: 2 probes, 30 min estimated
   **P2 (Nice to have)**: 3 probes, 15 min estimated

   **Total Estimated Time**: 60 minutes + async developer input

   **Expected Outcome**: Fill 6/7 gaps, 1 requires developer input

   **Next Action**: Execute Phase 1 probes (15 min)
   ```

## Failure Signals

- **No probes generated** → Re-check gap analysis
- **All probes are "ask"** → Not trying code/doc probes first
- **No success criteria** → Can't validate probe results
- **No cost estimates** → Can't prioritize effectively
- **Vague commands** → Need specific, executable probes

## Quality Gates

- [ ] At least one probe per non-FILLED slot
- [ ] Each probe has specific command/action
- [ ] Each probe has clear success criteria
- [ ] Each probe has failure response
- [ ] Each probe has cost estimate (Low/Medium/High)
- [ ] Probes prioritized by (Impact / Cost)
- [ ] "Ask" probes are last resort (tried code/doc first)
- [ ] Total time estimate provided
- [ ] Probes are ordered by priority
- [ ] Each probe targets specific completeness slot

## Probe Type Reference

### diff - Check File Changes
**When**: Need to see what changed in specific files
**Command**: `git diff <range> -- path/to/file`
**Cost**: Low
**Example**: `git diff main...HEAD -- src/auth/types.ts`

### commit - Extract Commit Details
**When**: Need commit message context
**Command**: `git log --format=fuller <range>`
**Cost**: Low
**Example**: `git log --grep="auth" --format="%H %s %b" main...HEAD`

### doc - Read Documentation
**When**: Need explicit requirements/design
**Command**: `Read path/to/doc.md`
**Cost**: Low-Medium (depends on doc size)
**Example**: `Read docs/PROPOSAL_AUTH.md`

### file - Read Source Code
**When**: Need implementation details
**Command**: `Read path/to/file.ts`
**Cost**: Medium (requires code understanding)
**Example**: `Read src/auth/service.ts`

### test - Check Test Coverage
**When**: Need behavioral validation
**Command**: `Read tests/` or `Grep "describe"`
**Cost**: Medium
**Example**: `Read tests/auth/auth.test.ts`

### ask - Query Developer
**When**: All other probes failed
**Command**: Ask specific question
**Cost**: High (blocks on human)
**Example**: "What are the performance targets for auth endpoints?"

## Prioritization Matrix

| Impact | Cost | Priority | Action |
|--------|------|----------|--------|
| Critical | Low | **P0** | Execute immediately |
| Critical | Medium | **P0** | Execute in Phase 1 |
| Critical | High | **P1** | Execute if necessary |
| High | Low | **P1** | Execute in Phase 2 |
| High | Medium | **P1** | Execute in Phase 2 |
| High | High | **P2** | Defer or ask |
| Medium | Low | **P2** | Execute if time |
| Medium | Medium | **P2** | Defer |
| Medium | High | **P3** | Skip or backlog |
| Low | Any | **P3** | Skip |

## Probe Design Checklist

Each probe must have:

- [ ] **Target Slot**: Which completeness slot does this fill?
- [ ] **Type**: diff/commit/doc/file/test/ask
- [ ] **Command**: Specific, executable command
- [ ] **Success Criteria**: What outcome means success?
- [ ] **Failure Response**: What to do if probe fails?
- [ ] **Cost Estimate**: Low/Medium/High
- [ ] **Priority**: P0/P1/P2/P3

## Example Probe Designs

### Good Probe (Specific, Actionable)
```markdown
Probe: Find performance targets for auth endpoints
- Target Slot: 8 (Performance Expectations)
- Type: doc
- Command: `grep -riE "auth.*(ms|sec|timeout)" docs/`
- Success: Find "< 200ms" or similar explicit target
- Failure: Try test files for timeout values
- Cost: Low (30 seconds)
- Priority: P1
```

### Bad Probe (Vague, Not Actionable)
```markdown
Probe: Check if performance is defined
- Target Slot: 8
- Type: ?
- Command: Look for performance stuff
- Success: Find something
- Failure: ?
- Cost: ?
- Priority: ?
```

## Cost Estimation Guidelines

### Low Cost (< 5 minutes)
- `grep` or `Grep` searches
- `Read` single small file
- `git log` specific query
- Simple diff check

### Medium Cost (5-30 minutes)
- Read multiple files
- Analyze test suite
- Review large diff
- Parse complex docs

### High Cost (> 30 minutes or async)
- Ask developer (blocks on human)
- Write new test to validate
- Prototype implementation
- Multi-person coordination

## Phase Execution Order

1. **Phase 1: Quick Wins**
   - P0 probes with Low cost
   - Execute all in parallel
   - Fast feedback loop

2. **Phase 2: Medium Effort**
   - P1 probes with Medium cost
   - Execute sequentially (may depend on Phase 1)
   - Deeper investigation

3. **Phase 3: Developer Input**
   - P0/P1 probes with High cost (ask)
   - Execute async (don't block)
   - Prepare specific questions

4. **Phase 4: Deferred**
   - P2 probes (nice to have)
   - Execute only if time permits
   - Can skip if needed
