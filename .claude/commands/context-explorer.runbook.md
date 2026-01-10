# Context Explorer Runbook

Complete executable runbook for Context Explorer agent workflows. This runbook provides copy/paste CLI commands for systematically extracting context from git history, diffs, commits, and documentation.

## Overview

**Purpose**: Understand what code changes are trying to accomplish by extracting evidence from multiple sources and synthesizing a complete specification.

**Use Cases**:
- Analyze PR to understand developer intent
- Build specification from branch changes
- Pre-implementation context validation
- Fill gaps in existing specifications

**Core Philosophy**: Every PR/branch has an intent. Extract that intent from available evidence (diffs, commits, docs, tests) and identify gaps before implementation or review.

---

## Execution Phases

### PHASE 1: GATHER

**Objective**: Collect raw evidence from git history, diffs, and file changes.

#### Step 1.1: Set Target References

```bash
# Define your target branch and comparison base
SINCE_REF="main"
TARGET_BRANCH="HEAD"

# For specific branches:
# SINCE_REF="development"
# TARGET_BRANCH="feature/auth"

# For specific commits:
# SINCE_REF="e291f614"
# TARGET_BRANCH="d1c18f49"

# For PRs (after fetching PR branch):
# SINCE_REF="development"
# TARGET_BRANCH="origin/pr/649"
```

#### Step 1.2: Gather Diff Stats

```bash
# Get diff summary showing changed files
git diff --stat ${SINCE_REF}...${TARGET_BRANCH}

# Get diff with line counts
git diff --numstat ${SINCE_REF}...${TARGET_BRANCH}

# Get diff showing file changes only
git diff --name-status ${SINCE_REF}...${TARGET_BRANCH}
```

#### Step 1.3: Gather Commit History

```bash
# Get commit messages (oneline)
git log --oneline ${SINCE_REF}..${TARGET_BRANCH}

# Get full commit details
git log --format=fuller ${SINCE_REF}..${TARGET_BRANCH}

# Get commit messages with structured format
git log --format="%H%n%an <%ae>%n%ad%n%s%n%b%n---" ${SINCE_REF}..${TARGET_BRANCH}

# Get commit count
git log --oneline ${SINCE_REF}..${TARGET_BRANCH} | wc -l
```

#### Step 1.4: Identify Changed File Types

```bash
# List documentation changes
git diff --name-only ${SINCE_REF}...${TARGET_BRANCH} | grep -E '\.(md|txt|rst)$'

# List test file changes
git diff --name-only ${SINCE_REF}...${TARGET_BRANCH} | grep -E '(test|spec)\.(ts|tsx|js|jsx|py)$'

# List schema/type changes
git diff --name-only ${SINCE_REF}...${TARGET_BRANCH} | grep -E '(schema|types?|models?)/'

# List configuration changes
git diff --name-only ${SINCE_REF}...${TARGET_BRANCH} | grep -E '\.(json|ya?ml|toml|env|config)$'

# List source code changes (TypeScript/JavaScript)
git diff --name-only ${SINCE_REF}...${TARGET_BRANCH} | grep -E '\.(ts|tsx|js|jsx)$' | grep -v test | grep -v spec

# List source code changes (Python)
git diff --name-only ${SINCE_REF}...${TARGET_BRANCH} | grep -E '\.py$' | grep -v test_
```

#### Step 1.5: Extract High-Signal Files

```bash
# Find PROPOSAL documents
git diff --name-only ${SINCE_REF}...${TARGET_BRANCH} | grep -i 'proposal'

# Find SPEC documents
git diff --name-only ${SINCE_REF}...${TARGET_BRANCH} | grep -i 'spec'

# Find README changes
git diff --name-only ${SINCE_REF}...${TARGET_BRANCH} | grep -i 'readme'

# Find CHANGELOG changes
git diff --name-only ${SINCE_REF}...${TARGET_BRANCH} | grep -i 'changelog'

# Find new files (additions only)
git diff --name-status ${SINCE_REF}...${TARGET_BRANCH} | grep '^A' | cut -f2
```

#### Step 1.6: Gather Specific File Diffs

```bash
# View specific file diff (replace with actual path)
git diff ${SINCE_REF}...${TARGET_BRANCH} -- path/to/file.ext

# View only additions in a file
git diff ${SINCE_REF}...${TARGET_BRANCH} -- path/to/file.ext | grep '^+'

# View documentation diffs
for file in $(git diff --name-only ${SINCE_REF}...${TARGET_BRANCH} | grep -E '\.md$'); do
  echo "=== $file ==="
  git diff ${SINCE_REF}...${TARGET_BRANCH} -- "$file"
done
```

#### Step 1.7: Check Test Coverage Changes

```bash
# List all test files changed
git diff --name-only ${SINCE_REF}...${TARGET_BRANCH} | grep -E '(test|spec)\.(ts|tsx|js|jsx|py)$'

# View test file diffs
for file in $(git diff --name-only ${SINCE_REF}...${TARGET_BRANCH} | grep -E 'test\.(ts|tsx|js|jsx)$'); do
  echo "=== $file ==="
  git diff ${SINCE_REF}...${TARGET_BRANCH} -- "$file"
done

# Count test additions vs deletions
git diff --numstat ${SINCE_REF}...${TARGET_BRANCH} | grep -E '(test|spec)\.' | awk '{added+=$1; deleted+=$2} END {print "Added:", added, "Deleted:", deleted}'
```

**Gather Phase Checklist**:
- [ ] Diff stats collected
- [ ] Commit history retrieved
- [ ] High-signal files identified (docs, tests, proposals)
- [ ] File types categorized
- [ ] Test coverage changes noted

---

### PHASE 2: EXTRACT INTENT

**Objective**: Extract developer intent, goals, and scope signals from collected evidence.

#### Step 2.1: Run diff-triage Skill

**Purpose**: Prioritize files by signal value.

**Manual Execution**:
```bash
# Save diff stat to file
git diff --stat ${SINCE_REF}...${TARGET_BRANCH} > /tmp/diff-stat.txt

# Now use Claude Code to invoke:
# "Invoke diff-triage skill on /tmp/diff-stat.txt"
```

**Expected Output**:
- P0 files (high signal: docs, tests, proposals)
- P1 files (medium signal: types, source code)
- P2 files (low signal: config, build files)
- SKIP files (no signal: generated files)

**Checklist**:
- [ ] Files prioritized by signal value
- [ ] P0 files identified for immediate analysis
- [ ] Generated/noise files marked SKIP

#### Step 2.2: Run commit-intent-extraction Skill

**Purpose**: Extract goals, scope, and risks from commits.

**Manual Commands**:
```bash
# Get commit messages for analysis
git log --format="%H|%s|%b" ${SINCE_REF}..${TARGET_BRANCH} > /tmp/commits.txt

# Search for conventional commit patterns
git log --oneline ${SINCE_REF}..${TARGET_BRANCH} | grep -E '^[0-9a-f]+ (feat|fix|docs|refactor|test|chore|perf)(\(.+\))?:'

# Extract issue references
git log --format="%s %b" ${SINCE_REF}..${TARGET_BRANCH} | grep -oE '(#[0-9]+|[A-Z]+-[0-9]+|Closes|Fixes|Relates)'

# Find TODO/FIXME signals
git log --format="%h %s" ${SINCE_REF}..${TARGET_BRANCH} | grep -iE '(todo|fixme|hack|workaround|temporary)'

# Extract breaking changes
git log --format="%h %s %b" ${SINCE_REF}..${TARGET_BRANCH} | grep -iE 'breaking( change)?:'

# Now use Claude Code to invoke:
# "Invoke commit-intent-extraction skill on /tmp/commits.txt"
```

**Expected Output**:
- Primary intent/goal
- Secondary objectives
- Stakeholders mentioned
- Related issues/tickets
- Scope signals (in/out)
- Risk signals (concerns, TODOs)

**Checklist**:
- [ ] Primary goal extracted
- [ ] Scope boundaries identified
- [ ] Risk signals flagged
- [ ] Related issues/tickets linked
- [ ] Confidence level assigned

#### Step 2.3: Run doc-delta-scan Skill

**Purpose**: Find specification signals in documentation changes.

**Manual Commands**:
```bash
# List all documentation changes
git diff --name-only ${SINCE_REF}...${TARGET_BRANCH} | grep -E '\.(md|txt|rst)$' > /tmp/doc-files.txt

# View PROPOSAL document additions
for file in $(cat /tmp/doc-files.txt | grep -i proposal); do
  echo "=== $file (additions) ==="
  git diff ${SINCE_REF}...${TARGET_BRANCH} -- "$file" | grep '^+' | grep -v '^+++'
done

# Search for acceptance criteria patterns
git diff ${SINCE_REF}...${TARGET_BRANCH} -- '*.md' | grep -iE '(acceptance|criteria|must|should|shall|will)'

# Search for requirements patterns
git diff ${SINCE_REF}...${TARGET_BRANCH} -- '*.md' | grep -iE '(requirement|needs to|has to|required)'

# Search for scope patterns
git diff ${SINCE_REF}...${TARGET_BRANCH} -- '*.md' | grep -iE '(in scope|out of scope|includes|excludes)'

# Search for "as a" user stories
git diff ${SINCE_REF}...${TARGET_BRANCH} -- '*.md' | grep -iE 'as a (user|developer|admin|customer)'

# Now use Claude Code to invoke:
# "Invoke doc-delta-scan skill on documentation changes"
```

**Expected Output**:
- Requirements extracted from docs
- Acceptance criteria found
- User personas identified
- Scope boundaries from docs

**Checklist**:
- [ ] Documentation changes analyzed
- [ ] Requirements extracted
- [ ] Acceptance criteria identified
- [ ] User personas/stakeholders found

**Extract Intent Phase Checklist**:
- [ ] diff-triage executed (files prioritized)
- [ ] commit-intent-extraction executed (goals/scope extracted)
- [ ] doc-delta-scan executed (requirements found)
- [ ] All intent signals collected and documented

---

### PHASE 3: SYNTHESIZE

**Objective**: Combine all evidence into a complete specification.

#### Step 3.1: Run end-state-spec Skill

**Purpose**: Synthesize complete specification from all evidence.

**Input Preparation**:
```bash
# Create evidence bundle
cat > /tmp/evidence-bundle.md <<EOF
# Evidence Bundle for Specification Synthesis

## Diff Triage Results
$(cat /tmp/diff-triage-results.txt 2>/dev/null || echo "Run diff-triage first")

## Commit Intent Results
$(cat /tmp/commit-intent-results.txt 2>/dev/null || echo "Run commit-intent-extraction first")

## Documentation Scan Results
$(cat /tmp/doc-delta-results.txt 2>/dev/null || echo "Run doc-delta-scan first")

## Test Coverage
$(git diff --name-only ${SINCE_REF}...${TARGET_BRANCH} | grep -E 'test\.')

EOF

# Now use Claude Code to invoke:
# "Invoke end-state-spec skill using /tmp/evidence-bundle.md"
```

**Expected Output**: Complete specification document with:
- All 14 completeness slots addressed
- Status per slot (FILLED/EMPTY/VAGUE/CONFLICTING)
- Confidence levels (High/Medium/Low)
- Evidence sources cited
- Gaps explicitly listed
- Conflicts flagged

**Checklist**:
- [ ] All 14 slots evaluated
- [ ] Each slot has status
- [ ] Evidence sources cited
- [ ] Confidence levels assigned
- [ ] Gaps listed

#### Step 3.2: Run acceptance-criteria Skill

**Purpose**: Extract testable acceptance criteria.

**Manual Commands**:
```bash
# Find test descriptions
for file in $(git diff --name-only ${SINCE_REF}...${TARGET_BRANCH} | grep -E 'test\.(ts|tsx|js|jsx)$'); do
  echo "=== $file ==="
  git diff ${SINCE_REF}...${TARGET_BRANCH} -- "$file" | grep -E "(describe|it|test)\("
done

# Find test assertions
git diff ${SINCE_REF}...${TARGET_BRANCH} | grep -E 'expect\(|assert|should'

# Search docs for acceptance criteria
git diff ${SINCE_REF}...${TARGET_BRANCH} -- '*.md' | grep -iE '(acceptance|criteria|checklist)' -A 5

# Now use Claude Code to invoke:
# "Invoke acceptance-criteria skill from tests and docs"
```

**Expected Output**:
- List of testable criteria
- Test coverage per criterion
- Gaps in test coverage

**Checklist**:
- [ ] Acceptance criteria extracted
- [ ] Test coverage mapped
- [ ] Gaps in coverage identified

**Synthesize Phase Checklist**:
- [ ] end-state-spec executed (complete specification)
- [ ] acceptance-criteria executed (testable criteria)
- [ ] Specification document created
- [ ] Completeness evaluated

---

### PHASE 4: REGRESS MISSING DETAILS

**Objective**: Compare specification against 14-slot completeness model and identify gaps.

#### Step 4.1: Run missing-details-regression Skill

**Purpose**: Generate completeness matrix with gap analysis.

**Manual Preparation**:
```bash
# Create 14-slot checklist template
cat > /tmp/completeness-check.md <<'EOF'
# 14-Slot Completeness Check

## Instructions
For each slot, determine: FILLED | EMPTY | VAGUE | CONFLICTING

1. Goal/Outcome - What are we trying to achieve?
2. User Persona/Stakeholder - Who is this for?
3. Scope (In/Out) - What's included/excluded?
4. Constraints - Technical, time, compliance, cost limits
5. Interfaces & Integrations - What systems connect?
6. Data Shape/Schemas/Contracts - Data structures?
7. Behavioral Rules/Business Logic - What are the rules?
8. Performance Expectations - Speed, scale, efficiency
9. Reliability Expectations - Uptime, error handling
10. Security/Privacy Requirements - Auth, data protection
11. Observability Requirements - Logging, monitoring, metrics
12. Acceptance Criteria - Testable success conditions
13. Rollout/Migration Plan - How to deploy safely
14. Risks & Unknowns - What could go wrong?

EOF

# Now use Claude Code to invoke:
# "Invoke missing-details-regression skill with end-state-spec output"
```

**Expected Output**: Completeness Matrix

```markdown
| # | Slot | Status | Confidence | Evidence | Value |
|---|------|--------|------------|----------|-------|
| 1 | Goal/Outcome | FILLED | High | commit abc, PROPOSAL.md:L10 | Add JWT auth |
| 2 | User Persona | VAGUE | Medium | Inferred | API consumers |
| 3 | Scope | FILLED | High | PROPOSAL.md:L45 | JWT IN, OAuth OUT |
| 4 | Constraints | EMPTY | - | - | Unknown |
| 5 | Interfaces | FILLED | Medium | routes/auth.ts | POST /auth/login |
| 6 | Data Schemas | FILLED | High | types/auth.ts | AuthRequest, AuthResponse |
| 7 | Behavioral Rules | VAGUE | Low | Inferred | Token expires 1h |
| 8 | Performance | EMPTY | - | - | Unknown |
| 9 | Reliability | EMPTY | - | - | Unknown |
| 10 | Security | FILLED | Medium | PROPOSAL.md:L75 | JWT + refresh |
| 11 | Observability | EMPTY | - | - | Unknown |
| 12 | Acceptance Criteria | FILLED | High | tests | 5 criteria |
| 13 | Rollout | VAGUE | Low | - | Standard deploy? |
| 14 | Risks | FILLED | Medium | TODO comments | Storage TBD |

Summary:
- FILLED: 7/14 (50%)
- EMPTY: 4/14 (29%)
- VAGUE: 3/14 (21%)
- Overall: PARTIAL - Need to fill critical gaps
```

#### Step 4.2: Generate Missing Details Backlog

**Manual Extraction**:
```bash
# Save completeness matrix output to file
# (After Claude Code generates it)
cat > /tmp/missing-details-backlog.md <<'EOF'
# Missing Details Backlog

## P0 Gaps (Blocking Implementation)
- Slot 4: Constraints - EMPTY
  - Evidence Needed: Technical stack requirements, deadlines
  - Cheapest Probe: Check config files, package.json
  - Impact If Wrong: Technical incompatibility, missed deadline

- Slot 8: Performance - EMPTY
  - Evidence Needed: Response time targets, throughput
  - Cheapest Probe: Search docs for "<Xms", "req/sec"
  - Impact If Wrong: Performance issues, poor UX

## P1 Gaps (Important)
- Slot 2: User Persona - VAGUE
  - Evidence Needed: Explicit user personas
  - Cheapest Probe: Grep for "as a", "user", "persona"
  - Impact If Wrong: Build for wrong audience

- Slot 7: Behavioral Rules - VAGUE
  - Evidence Needed: Complete business logic rules
  - Cheapest Probe: Read service files, test cases
  - Impact If Wrong: Incorrect behavior

## P2 Gaps (Nice to Have)
- Slot 9: Reliability - EMPTY
- Slot 11: Observability - EMPTY
- Slot 13: Rollout Plan - VAGUE

EOF
```

**Checklist**:
- [ ] All 14 slots evaluated
- [ ] Status assigned to each slot
- [ ] Confidence levels noted
- [ ] Gaps prioritized (P0/P1/P2)
- [ ] Missing Details Backlog created

**Regress Phase Checklist**:
- [ ] missing-details-regression executed
- [ ] Completeness matrix generated
- [ ] Gaps identified and prioritized
- [ ] Missing Details Backlog created
- [ ] Overall completeness percentage calculated

---

### PHASE 5: PLAN PROBES

**Objective**: Generate targeted evidence-gathering plan to fill identified gaps.

#### Step 5.1: Run evidence-plan Skill

**Purpose**: Create prioritized probe plan with specific commands.

**Input**: Missing Details Backlog from Phase 4

**Manual Probe Design**:
```bash
# For each gap, design specific probes

# Example: Slot 4 (Constraints) - EMPTY
# Probe 1: Check technical constraints
cat package.json | jq '.dependencies, .devDependencies'
cat backend/pyproject.toml | grep -A 10 'dependencies'

# Probe 2: Check configuration constraints
ls -la *.config.* tsconfig.json jest.config.js

# Example: Slot 8 (Performance) - EMPTY
# Probe 1: Search docs for performance targets
grep -riE "(<[0-9]+ms|req.*sec|[0-9]+% uptime)" docs/ PROPOSAL*.md README.md

# Probe 2: Check test timeouts
grep -r "timeout\|jest.setTimeout" tests/ frontend/src/

# Example: Slot 2 (User Persona) - VAGUE
# Probe: Search for user persona mentions
grep -riE "(as a |user persona|stakeholder)" docs/ *.md

# Example: Slot 7 (Behavioral Rules) - VAGUE
# Probe: Read service implementation
# (Use Read tool for src/auth/service.ts, tests/auth.test.ts)
```

**Expected Output**: Targeted Evidence Plan

```markdown
## Evidence Gathering Plan

### Phase 1: Quick Wins (P0, Low Cost)
**Estimated Time: 15 minutes**

1. [ ] Slot 4: Check Constraints
   - Probe: Read package.json + pyproject.toml
   - Command: `cat package.json backend/pyproject.toml`
   - Success: Identify tech stack constraints
   - Cost: Low (2 min)

2. [ ] Slot 8: Check Performance Requirements
   - Probe: `grep -riE "(<[0-9]+ms|req.*sec)" docs/`
   - Success: Find explicit targets
   - Cost: Low (3 min)

3. [ ] Slot 11: Check Observability
   - Probe: `grep -r "logger\|console\.log" src/`
   - Success: Identify logging patterns
   - Cost: Low (3 min)

### Phase 2: Medium Cost (P1, Medium Cost)
**Estimated Time: 30 minutes**

4. [ ] Slot 7: Clarify Behavioral Rules
   - Probe: Read src/auth/service.ts + tests/auth.test.ts
   - Success: Document all business rules
   - Cost: Medium (15 min)

5. [ ] Slot 13: Check Rollout Plan
   - Probe: Read deployment/ + migration files
   - Success: Find deployment strategy
   - Cost: Medium (10 min)

### Phase 3: Developer Input (High Cost)
**Estimated Time: Async**

6. [ ] Slot 9: Clarify Reliability Expectations
   - Probe: Ask "What are uptime/SLA requirements?"
   - Success: Get SLA requirements
   - Cost: High (blocks on human)

### Summary
- Total Probes: 6
- P0: 3 probes, 15 min
- P1: 2 probes, 30 min
- P2: 1 probe, async
- Total Time: 45 min + async
```

**Checklist**:
- [ ] Each gap has at least one probe
- [ ] Probes are specific and executable
- [ ] Success criteria defined per probe
- [ ] Cost estimates provided
- [ ] Probes prioritized by (Impact / Cost)

#### Step 5.2: Execute Phase 1 Probes (Quick Wins)

**Execute immediately** - these are low cost, high value:

```bash
# Probe 1: Check Constraints (Slot 4)
echo "=== Technical Constraints ==="
echo "Frontend Dependencies:"
cat frontend/package.json | jq '.dependencies' 2>/dev/null || cat frontend/package.json | grep -A 20 '"dependencies"'
echo ""
echo "Backend Dependencies:"
cat backend/pyproject.toml | grep -A 20 'dependencies' || echo "No pyproject.toml"
echo ""
echo "TypeScript Config:"
cat frontend/tsconfig.json 2>/dev/null | head -20

# Probe 2: Check Performance Requirements (Slot 8)
echo "=== Performance Targets ==="
grep -riE "(<[0-9]+ms|req.*sec|[0-9]+% uptime|performance|latency)" docs/ frontend/*.md backend/*.md 2>/dev/null | head -20

# Probe 3: Check Observability (Slot 11)
echo "=== Observability Patterns ==="
grep -r "logger\|console\.log\|console\.error\|logging\|metrics" frontend/src/ backend/src/ 2>/dev/null | head -20

# Save results
cat > /tmp/phase1-probe-results.txt <<EOF
Phase 1 Probe Results
$(date)

[Paste output from above commands]
EOF
```

**Checklist**:
- [ ] All Phase 1 probes executed
- [ ] Results documented
- [ ] Completeness matrix updated with findings

**Plan Probes Phase Checklist**:
- [ ] evidence-plan skill executed
- [ ] Targeted Evidence Plan created
- [ ] Phase 1 probes executed (Quick Wins)
- [ ] Results documented
- [ ] Completeness matrix updated

---

### PHASE 6: RE-RUN (MANDATORY)

**Objective**: Repeat analysis with new evidence to measure improvement.

#### Step 6.1: Update Evidence Bundle

```bash
# Append Phase 1 probe results to evidence bundle
cat >> /tmp/evidence-bundle.md <<EOF

## Phase 1 Probe Results ($(date))
$(cat /tmp/phase1-probe-results.txt)

EOF
```

#### Step 6.2: Re-run missing-details-regression

```bash
# Use Claude Code to invoke:
# "Re-run missing-details-regression with updated evidence from /tmp/evidence-bundle.md"
```

**Expected**: Improved completeness score

**Before Phase 5**:
```
FILLED: 7/14 (50%)
EMPTY: 4/14 (29%)
VAGUE: 3/14 (21%)
```

**After Phase 6 (target improvement)**:
```
FILLED: 9/14 (64%)
EMPTY: 2/14 (14%)
VAGUE: 3/14 (21%)
```

#### Step 6.3: Execute Phase 2 Probes (If Time Permits)

```bash
# Probe 4: Read service implementation (Slot 7)
# Use Claude Code Read tool:
# "Read src/auth/service.ts and extract behavioral rules"

# Probe 5: Check deployment plan (Slot 13)
echo "=== Deployment Files ==="
ls -la deployment/ .github/workflows/ docker/ 2>/dev/null
find . -name "*migration*" -o -name "*deploy*" 2>/dev/null | grep -v node_modules | grep -v .venv | head -20
```

#### Step 6.4: Measure Improvement

```bash
# Compare before/after completeness
cat > /tmp/completeness-comparison.md <<EOF
# Completeness Improvement

## Before Probes
- FILLED: 7/14 (50%)
- EMPTY: 4/14 (29%)
- VAGUE: 3/14 (21%)
- Status: PARTIAL

## After Phase 1 Probes
- FILLED: 9/14 (64%)
- EMPTY: 2/14 (14%)
- VAGUE: 3/14 (21%)
- Status: GOOD

## Improvement
- +2 slots filled (Slot 4: Constraints, Slot 8: Performance)
- -2 empty slots
- +14% completeness

## Remaining Gaps (P1)
- Slot 9: Reliability (EMPTY)
- Slot 11: Observability (EMPTY)
- Slot 2: User Persona (VAGUE)
- Slot 7: Behavioral Rules (VAGUE)
- Slot 13: Rollout Plan (VAGUE)
EOF
```

**Re-Run Phase Checklist**:
- [ ] Evidence bundle updated with probe results
- [ ] missing-details-regression re-executed
- [ ] Completeness improvement measured
- [ ] At least +10% improvement achieved
- [ ] Remaining gaps prioritized

---

### PHASE 7: EMIT

**Objective**: Produce final artifacts for stakeholders.

#### Step 7.1: Generate End-State Snapshot

```bash
# Create final specification document
cat > /tmp/END_STATE_SNAPSHOT.md <<'EOF'
# End-State Snapshot: [Feature Name]

**Generated**: [Date]
**Completeness**: 64% (9/14 slots FILLED)
**Status**: GOOD - Ready for implementation with tracked gaps
**Confidence**: Medium-High

---

## 1. Goal/Outcome
**Status**: FILLED | **Confidence**: High
**Sources**: commit abc123, frontend/PROPOSAL_ARCHITECT.md:L10-25

[Goal description from analysis]

---

## 2. User Persona/Stakeholder
**Status**: VAGUE | **Confidence**: Medium
**Sources**: Inferred from context

[Persona description - mark as needing clarification]

---

[Continue for all 14 slots...]

---

## Summary

### Strengths
- Clear goal and scope defined
- Data schemas documented
- Acceptance criteria testable
- Security requirements explicit

### Gaps (Tracked)
1. **Reliability Expectations** (Slot 9) - EMPTY - P1 priority
2. **Observability Requirements** (Slot 11) - EMPTY - P2 priority
3. **User Personas** (Slot 2) - VAGUE - Needs validation

### Recommended Next Steps
1. Execute remaining probes (Phase 2: 30 min)
2. Validate assumptions with developer (15 min)
3. Document decisions in SPEC.md
EOF
```

#### Step 7.2: Generate Missing Details Backlog (Final)

```bash
# Create final backlog with remaining gaps
cat > /tmp/MISSING_DETAILS_BACKLOG.md <<'EOF'
# Missing Details Backlog (Final)

**As of**: [Date]
**Overall Completeness**: 64% (9/14 slots)
**Critical Gaps Remaining**: 2 (P1 priority)

---

## P0 Gaps (None Remaining)
All critical blocking gaps have been resolved.

---

## P1 Gaps (Important - Should Fill)

### Gap 1: Reliability Expectations (Slot 9)
- **Status**: EMPTY
- **Evidence Needed**: Uptime targets, SLA requirements, error handling strategy
- **Recommended Probe**:
  ```bash
  # Check for error handling patterns
  grep -r "try\|catch\|error\|retry\|timeout" src/

  # Ask developer
  Question: "What are the uptime/SLA requirements for this feature?"
  ```
- **Impact If Not Filled**: May have unexpected downtime, poor error handling
- **Estimated Cost**: Medium (15 min) or High (ask developer)

### Gap 2: Observability Requirements (Slot 11)
- **Status**: EMPTY (partial patterns found)
- **Evidence Needed**: Logging strategy, metrics to track, monitoring setup
- **Recommended Probe**:
  ```bash
  # Already found console.log usage
  # Need to determine: structured logging? metrics? alerts?
  Read backend/src/utils/logger.py
  Read frontend/src/lib/monitoring.ts
  ```
- **Impact If Not Filled**: Difficult to debug production issues
- **Estimated Cost**: Medium (15 min)

---

## P2 Gaps (Nice to Have)

### Gap 3: User Persona Clarification (Slot 2)
- **Status**: VAGUE (inferred as "API consumers")
- **Evidence Needed**: Explicit user personas, use cases
- **Recommended Probe**: Ask developer or PM
- **Impact If Not Filled**: Low - current inference is reasonable
- **Estimated Cost**: Low (5 min question)

### Gap 4: Behavioral Rules Details (Slot 7)
- **Status**: VAGUE (some rules inferred from tests)
- **Evidence Needed**: Complete business logic documentation
- **Recommended Probe**: Read service implementation thoroughly
- **Impact If Not Filled**: Medium - may miss edge cases
- **Estimated Cost**: Medium (20 min)

### Gap 5: Rollout Plan Details (Slot 13)
- **Status**: VAGUE (assumed standard deployment)
- **Evidence Needed**: Explicit deployment strategy, migration plan
- **Recommended Probe**: Check deployment/ directory, .github/workflows/
- **Impact If Not Filled**: Medium - deployment may have issues
- **Estimated Cost**: Low (10 min)

---

## Execution Priority

**Next Actions** (in order):
1. Execute Gap 2 probe (Observability) - 15 min
2. Execute Gap 1 probe (Reliability) - 15 min or ask
3. If time permits: Execute Gap 4 (Behavioral Rules) - 20 min
4. Defer to developer questions: Gaps 1 (SLA), 3 (Personas)

**Total Estimated Time**: 50 minutes + async developer input

EOF
```

#### Step 7.3: Generate Targeted Evidence Plan (For Remaining Gaps)

```bash
# Create actionable plan for next iteration
cat > /tmp/TARGETED_EVIDENCE_PLAN.md <<'EOF'
# Targeted Evidence Plan (Next Iteration)

**Purpose**: Fill remaining gaps to achieve 80%+ completeness

---

## Quick Probes (Can Execute Now)

### Probe 1: Observability Deep Dive (Gap 2 - Slot 11)
**Target**: Understand logging and monitoring strategy
**Commands**:
```bash
# Check for structured logging
grep -r "logger\|logging\.get" backend/src/

# Check for metrics/monitoring
grep -r "metrics\|prometheus\|statsd\|datadog" backend/ frontend/

# Check for error tracking
grep -r "sentry\|bugsnag\|rollbar" backend/ frontend/

# Read monitoring config
ls -la backend/monitoring/ frontend/src/lib/monitoring*
```
**Success Criteria**: Find logging library, metrics tracking, error monitoring
**Time**: 15 minutes
**Priority**: P1

---

### Probe 2: Reliability Patterns (Gap 1 - Slot 9)
**Target**: Understand error handling and retry logic
**Commands**:
```bash
# Check error handling patterns
grep -r "try.*except\|try.*catch" backend/src/ frontend/src/ | head -30

# Check for retry logic
grep -r "retry\|backoff\|circuit.*breaker" backend/ frontend/

# Check for timeout configuration
grep -r "timeout\|deadline" backend/pyproject.toml frontend/package.json *.config.*
```
**Success Criteria**: Find error handling strategy, retry patterns, timeout configs
**Time**: 15 minutes
**Priority**: P1

---

### Probe 3: Deployment Investigation (Gap 5 - Slot 13)
**Target**: Understand deployment and migration strategy
**Commands**:
```bash
# Check CI/CD workflows
cat .github/workflows/*.yml | grep -A 5 "deploy\|build\|release"

# Check for migrations
find . -name "*migration*" -o -name "migrate" | grep -v node_modules | grep -v .venv

# Check deployment docs
ls -la deployment/ docker/ kubernetes/ 2>/dev/null
cat deployment/README.md docker/README.md 2>/dev/null
```
**Success Criteria**: Find deployment workflow, migration strategy
**Time**: 10 minutes
**Priority**: P2

---

## Developer Questions (Async)

### Question 1: SLA/Reliability Targets (Gap 1 - Slot 9)
**Ask**: "What are the uptime/SLA requirements for this feature? Are there specific error rate targets?"
**Priority**: P1
**Alternative**: If no answer, use industry standard (99.9% uptime)

### Question 2: User Persona Validation (Gap 3 - Slot 2)
**Ask**: "Can you confirm the primary user personas for this feature?"
**Priority**: P2
**Alternative**: Document assumption ("API consumers - mobile/web clients")

---

## Execution Order

1. **Now**: Execute Probes 1-3 (40 minutes total)
2. **Async**: Send developer questions
3. **Next**: Re-run missing-details-regression with new evidence
4. **Goal**: Achieve 80%+ completeness (11/14 slots FILLED)

EOF
```

**Emit Phase Checklist**:
- [ ] End-State Snapshot created (final specification)
- [ ] Missing Details Backlog finalized
- [ ] Targeted Evidence Plan for remaining gaps created
- [ ] All artifacts ready for stakeholder review

---

## Success Criteria

A Context Explorer workflow is successful when:

### Minimum Success (Quick Analysis - 15 min)
- [ ] Diff triaged (P0 files identified)
- [ ] Commit intent extracted (primary goal clear)
- [ ] Documentation scanned (requirements found)
- [ ] Quick context summary provided

### Standard Success (Complete Analysis - 60 min)
- [ ] All 7 phases executed
- [ ] Completeness ≥ 60% (8-9 slots FILLED)
- [ ] All critical slots (1,2,3,5,6,10,12) addressed
- [ ] End-State Snapshot created
- [ ] Missing Details Backlog with specific probes
- [ ] At least one probe cycle completed

### Excellent Success (Deep Analysis - 120 min)
- [ ] All 7 phases executed with multiple probe cycles
- [ ] Completeness ≥ 80% (11+ slots FILLED)
- [ ] All critical slots FILLED with High confidence
- [ ] Multiple probe cycles show improvement
- [ ] Developer questions minimal (< 3)
- [ ] Ready for implementation with high confidence

---

## Abort Conditions

Stop the workflow and escalate if:

### Unrecoverable Failures
- **No commits in range**: Git range is invalid or branch is empty
- **No evidence sources**: No docs, tests, or meaningful code changes
- **All slots EMPTY after Phase 5**: Evidence gathering yielded nothing
- **Conflicting evidence unresolvable**: Contradictory signals with no clear resolution

### Recovery Actions
- **Invalid git range**: Verify branch names, use `git log` to check
- **No evidence**: Expand search scope, check if work is in different branch
- **Low completeness**: Document assumptions, flag for developer review
- **Conflicts**: Flag as CONFLICTING, ask developer for clarification

---

## Quick Reference: Command Templates

### Set Up Environment
```bash
export SINCE_REF="main"
export TARGET_BRANCH="HEAD"
export WORK_DIR="/tmp/context-explorer-$(date +%s)"
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"
```

### Gather Phase (5 min)
```bash
git diff --stat ${SINCE_REF}...${TARGET_BRANCH}
git log --oneline ${SINCE_REF}..${TARGET_BRANCH}
git diff --name-only ${SINCE_REF}...${TARGET_BRANCH} | grep -E '\.(md|test\.)'
```

### Extract Phase (15 min)
```bash
# Invoke diff-triage skill (Claude Code)
# Invoke commit-intent-extraction skill (Claude Code)
# Invoke doc-delta-scan skill (Claude Code)
```

### Synthesize Phase (20 min)
```bash
# Invoke end-state-spec skill (Claude Code)
# Invoke acceptance-criteria skill (Claude Code)
```

### Regress Phase (10 min)
```bash
# Invoke missing-details-regression skill (Claude Code)
# Generate Missing Details Backlog
```

### Plan Probes Phase (10 min)
```bash
# Invoke evidence-plan skill (Claude Code)
# Execute Phase 1 probes (Quick Wins)
```

### Re-Run Phase (10 min)
```bash
# Re-run missing-details-regression with new evidence
# Measure improvement
```

### Emit Phase (10 min)
```bash
# Generate End-State Snapshot
# Finalize Missing Details Backlog
# Create Targeted Evidence Plan
```

---

## Troubleshooting

### Problem: No evidence found in Phase 1
**Solution**:
1. Verify git range: `git log ${SINCE_REF}..${TARGET_BRANCH}`
2. Check if commits exist: `git log --oneline | head`
3. Try broader search: Expand to `origin/main...HEAD`
4. Look in different branches: `git branch -a`

### Problem: All slots marked VAGUE in Phase 4
**Solution**:
1. Re-run evidence gathering with broader patterns
2. Lower confidence but proceed with documented assumptions
3. Generate more aggressive probe plan
4. Accept higher risk with mitigation noted

### Problem: Conflicting evidence in Phase 3
**Solution**:
1. Apply conflict resolution heuristics (docs > commits > code)
2. Check timestamps (recent > old)
3. If unresolvable, mark as CONFLICTING and ask developer

### Problem: Too many gaps (< 50% completeness) in Phase 4
**Solution**:
1. Execute all Phase 1 probes immediately
2. Execute Phase 2 probes if time permits
3. Document assumptions for remaining gaps
4. Flag as "Needs Developer Review" and continue

### Problem: No improvement after Phase 6
**Solution**:
1. Verify probes were executed correctly
2. Check if probe results were added to evidence bundle
3. Try different probe strategies (read files vs grep)
4. Accept current completeness, flag gaps for developer

---

## Integration with Orchestra

### Backend Analysis Commands
```bash
# Python files changed
git diff --name-only ${SINCE_REF}...${TARGET_BRANCH} | grep '\.py$'

# Backend tests
git diff --name-only ${SINCE_REF}...${TARGET_BRANCH} | grep 'backend.*test_'

# Backend schemas
git diff --name-only ${SINCE_REF}...${TARGET_BRANCH} | grep 'backend.*schemas/'
```

### Frontend Analysis Commands
```bash
# TypeScript files changed
git diff --name-only ${SINCE_REF}...${TARGET_BRANCH} | grep -E '\.(tsx?|jsx?)$'

# Frontend tests
git diff --name-only ${SINCE_REF}...${TARGET_BRANCH} | grep 'frontend.*\.(test|spec)\.'

# React components
git diff --name-only ${SINCE_REF}...${TARGET_BRANCH} | grep 'frontend.*components/'
```

### Full-Stack Analysis
```bash
# Changes affecting both
git diff --name-only ${SINCE_REF}...${TARGET_BRANCH} | grep -E '(backend|frontend)'

# API contract changes
git diff ${SINCE_REF}...${TARGET_BRANCH} -- backend/src/routes/ frontend/src/api/
```

---

## Metrics and KPIs

Track these metrics to improve Context Explorer effectiveness:

### Time Metrics
- **Time to 50% completeness**: Target < 30 min
- **Time to 70% completeness**: Target < 60 min
- **Total workflow time**: Target < 90 min (including probes)

### Quality Metrics
- **Probe hit rate**: % of probes that successfully fill gaps (Target: > 70%)
- **Evidence quality**: % of FILLED slots with High confidence (Target: > 60%)
- **Ask rate**: % of gaps requiring developer questions (Target: < 20%)

### Outcome Metrics
- **Final completeness**: % of slots FILLED (Target: > 70%)
- **Critical slots filled**: % of 7 critical slots FILLED (Target: 100%)
- **Implementation readiness**: GO / PARTIAL / NO-GO

---

**Version**: 1.0
**Last Updated**: 2026-01-10
**Maintained by**: Orchestra Development Team
