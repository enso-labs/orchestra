# Context Explorer Skills

Modular, composable, deterministic skills for systematically extracting context from git history, diffs, commits, and documentation to understand development intent and create complete specifications.

## Overview

The Context Explorer is a systematic approach to understanding what code changes are trying to accomplish by extracting evidence from multiple sources and synthesizing a complete specification.

**Core Philosophy**: Every PR/branch has an intent. Our job is to extract that intent from available evidence (diffs, commits, docs, tests) and identify gaps in understanding before implementation or review.

## Skill Index

| Skill | Purpose | Inputs | Outputs | Cost |
|-------|---------|--------|---------|------|
| **[diff-triage.md](./diff-triage.md)** | Prioritize diffs by signal value | Git diff output | P0/P1/P2 file list | Low |
| **[commit-intent-extraction.md](./commit-intent-extraction.md)** | Extract intent from commits | Commit messages | Goals, scope, risks | Low |
| **[doc-delta-scan.md](./doc-delta-scan.md)** | Scan doc changes for specs | Documentation diffs | Requirements, criteria | Low |
| **[end-state-spec.md](./end-state-spec.md)** | Synthesize complete spec | All evidence | Full specification | Medium |
| **[acceptance-criteria.md](./acceptance-criteria.md)** | Extract testable criteria | Tests, docs, code | Acceptance criteria | Medium |
| **[risk-gaps.md](./risk-gaps.md)** | Identify risks and gaps | Specification | Risk/gap analysis | Low |
| **[missing-details-regression.md](./missing-details-regression.md)** | Compare against completeness model | Specification | 14-slot matrix | Medium |
| **[evidence-plan.md](./evidence-plan.md)** | Generate evidence gathering plan | Gaps, completeness matrix | Prioritized probes | Low |

## Workflow

### Standard Context Exploration Flow

```
1. diff-triage
   ↓ (prioritized file list)
2. commit-intent-extraction + doc-delta-scan (parallel)
   ↓ (intent signals)
3. acceptance-criteria (from tests)
   ↓ (testable criteria)
4. end-state-spec
   ↓ (synthesized specification)
5. missing-details-regression
   ↓ (completeness matrix)
6. risk-gaps
   ↓ (risk/gap analysis)
7. evidence-plan
   ↓ (prioritized probes)
8. Execute probes → Update spec → Repeat if needed
```

### Quick Analysis Flow (< 5 minutes)

```
1. diff-triage (1 min)
2. commit-intent-extraction (2 min)
3. doc-delta-scan (2 min)
→ Quick context summary
```

### Deep Analysis Flow (30-60 minutes)

```
Full workflow (steps 1-8 above)
→ Complete specification with confidence levels
→ Evidence-based gap filling
```

## 14-Slot Completeness Model

Every specification must address these 14 slots:

| # | Slot | Critical? | Common Sources |
|---|------|-----------|----------------|
| 1 | **Goal/Outcome** | ✓ | Commit messages, PROPOSAL docs |
| 2 | **User Persona/Stakeholder** | ✓ | "As a..." statements, README |
| 3 | **Scope (In/Out)** | ✓ | Doc sections, commit scope |
| 4 | **Constraints** | ✓ | package.json, configs, timelines |
| 5 | **Interfaces & Integrations** | ✓ | Routes, API files, imports |
| 6 | **Data Shape/Schemas/Contracts** | ✓ | Type defs, schema files |
| 7 | **Behavioral Rules/Business Logic** | - | Service files, tests |
| 8 | **Performance Expectations** | - | Docs, test timeouts |
| 9 | **Reliability Expectations** | - | Error handling, retry logic |
| 10 | **Security/Privacy Requirements** | ✓ | Auth code, security docs |
| 11 | **Observability Requirements** | - | Logging, metrics code |
| 12 | **Acceptance Criteria** | ✓ | Test files, checklist in docs |
| 13 | **Rollout/Migration Plan** | - | Migration files, deploy docs |
| 14 | **Risks & Unknowns** | ✓ | TODO/FIXME comments, risk sections |

**Slot Status Values**:
- **FILLED**: Explicit evidence, high confidence
- **EMPTY**: No evidence found
- **VAGUE**: Partial/ambiguous evidence
- **CONFLICTING**: Contradictory evidence

## Usage Examples

### Example 1: Analyze a PR

```markdown
User: "What is PR #649 trying to accomplish?"

Agent Workflow:
1. diff-triage: Identify high-signal files (PROPOSAL docs, test files)
2. commit-intent-extraction: Extract goals from commit messages
3. doc-delta-scan: Extract requirements from PROPOSAL changes
4. end-state-spec: Synthesize complete specification
5. missing-details-regression: Check completeness (8/14 slots filled)
6. risk-gaps: Identify 3 P0 risks
7. evidence-plan: Generate 5 probes to fill gaps

Output:
- Complete specification with confidence levels
- 3 critical gaps identified with probes
- 8/14 completeness slots filled
- Ready for targeted questions to developer
```

### Example 2: Understand Branch Changes

```markdown
User: "What does the feature/auth branch do?"

Agent Workflow:
1. diff-triage: Scan branch diff (45 files changed)
2. Prioritize: 3 P0 files (PROPOSAL, tests), 8 P1 files (types, services)
3. commit-intent-extraction: "Add JWT authentication"
4. doc-delta-scan: Extract acceptance criteria from PROPOSAL
5. acceptance-criteria: Map 5 criteria to test coverage
6. end-state-spec: Generate specification
7. missing-details-regression: Performance slot EMPTY, Security slot FILLED
8. evidence-plan: Generate probes for performance targets

Output:
- Specification: "Add JWT-based authentication with refresh tokens"
- Acceptance Criteria: 5 defined, 4 tested, 1 missing
- Gaps: Performance targets undefined
- Next Action: Execute probe to find perf requirements
```

### Example 3: Pre-Implementation Context Check

```markdown
User: "Do we have enough context to implement ticket #456?"

Agent Workflow:
1. Read ticket description
2. Search for related PRs/branches
3. Run full completeness check
4. Generate evidence plan for gaps

Output:
- Completeness: 6/14 slots FILLED, 4 EMPTY, 4 VAGUE
- Critical Gaps: Performance, Rollout Plan, Data Schemas
- Recommendation: Need 3 developer clarifications before starting
- Evidence Plan: 8 probes (estimated 30 min) to fill gaps
```

## Evidence Source Types

| Source | Signal Value | Cost | When to Use |
|--------|--------------|------|-------------|
| **PROPOSAL/SPEC docs** | Very High | Low | Always check first |
| **Test files** | High | Low | Behavioral validation |
| **Commit messages** | High | Low | Intent extraction |
| **Type definitions** | Medium | Low | Contract clarity |
| **README changes** | Medium | Low | User-facing changes |
| **Source code** | Variable | Medium | Implementation details |
| **Config files** | Low | Low | Constraints |
| **Build files** | Low | Low | Infrastructure changes |

## Probe Types

| Probe | Command Example | When to Use | Cost |
|-------|----------------|-------------|------|
| **diff** | `git diff main...HEAD -- path/to/file` | Check specific changes | Low |
| **commit** | `git log --grep="auth"` | Extract intent | Low |
| **doc** | `Read PROPOSAL.md` | Get requirements | Low |
| **file** | `Read src/service.ts` | Implementation details | Medium |
| **test** | `Read tests/auth.test.ts` | Behavioral validation | Medium |
| **ask** | "What are performance targets?" | Last resort | High |

## Best Practices

### Do's
- Start with high-signal sources (docs, tests, commits)
- Use deterministic extraction patterns
- Always run completeness check
- Generate specific, executable probes
- Track confidence levels
- Identify conflicts explicitly
- Prioritize P0 gaps

### Don'ts
- Don't skip diff-triage (waste time on low-signal files)
- Don't infer without evidence citation
- Don't ask developers before checking code/docs
- Don't mark slots FILLED without confidence level
- Don't skip evidence plan (leads to random exploration)
- Don't accept VAGUE when FILLED is achievable

## Skill Composition Patterns

### Pattern 1: Quick Context (< 5 min)
```
diff-triage → commit-intent-extraction → doc-delta-scan
→ Quick summary of intent
```

### Pattern 2: Spec Synthesis (15-30 min)
```
diff-triage → commit-intent → doc-delta → acceptance-criteria
→ end-state-spec → missing-details-regression
→ Complete specification with gaps identified
```

### Pattern 3: Gap Filling (30-60 min)
```
[Pattern 2] → risk-gaps → evidence-plan → Execute probes
→ Iteratively fill gaps until acceptable completeness
```

### Pattern 4: Pre-Implementation Validation
```
Read ticket/issue → Search related branches
→ [Pattern 2] → Completeness check
→ GO/NO-GO decision with evidence plan
```

## Quality Gates

Before considering analysis complete:

- [ ] All 14 completeness slots evaluated
- [ ] Each FILLED slot has evidence source cited
- [ ] Each non-FILLED slot has probe suggested
- [ ] Confidence levels assigned (High/Medium/Low)
- [ ] Conflicts flagged and explained
- [ ] Overall completeness percentage calculated
- [ ] P0 gaps identified and prioritized
- [ ] Evidence plan generated for gaps
- [ ] Next actions clearly specified

## Completeness Thresholds

| Completeness | Recommendation |
|--------------|----------------|
| **< 50%** | NOT READY - Need substantial evidence gathering |
| **50-70%** | PARTIAL - Can start with known gaps tracked |
| **70-85%** | GOOD - Minor gaps acceptable with risk mitigation |
| **> 85%** | EXCELLENT - Proceed with high confidence |

**Critical Slots** (must be FILLED for implementation):
1. Goal/Outcome
2. User Persona
3. Scope
5. Interfaces
6. Data Schemas
10. Security
12. Acceptance Criteria

If any critical slot is EMPTY, status is automatically NOT READY.

## File Structure

```
context-explorer/
├── README.md                          # This file
├── SKILL.md                           # Main orchestration skill
├── diff-triage.md                     # Skill 1: Prioritize diffs
├── commit-intent-extraction.md        # Skill 2: Extract commit intent
├── doc-delta-scan.md                  # Skill 3: Scan documentation
├── end-state-spec.md                  # Skill 4: Synthesize specification
├── acceptance-criteria.md             # Skill 5: Extract criteria
├── risk-gaps.md                       # Skill 6: Identify risks/gaps
├── missing-details-regression.md      # Skill 7: Completeness check (CRITICAL)
└── evidence-plan.md                   # Skill 8: Generate probe plan (CRITICAL)
```

## Integration with Orchestra

These skills integrate with Orchestra's existing skills:

- **explaining-code**: Use after context extraction to explain implementation
- **test-frontend/test-backend**: Validate acceptance criteria match tests
- **manage-app**: Deploy changes after completeness validated

## Troubleshooting

### Problem: No evidence found
**Solution**:
1. Check git range is correct
2. Verify branch has commits
3. Try broader search patterns
4. Fall back to asking developer

### Problem: All slots marked VAGUE
**Solution**:
1. Re-run evidence gathering with broader patterns
2. Check if docs exist but weren't scanned
3. Lower confidence but proceed with assumptions documented

### Problem: Conflicting evidence
**Solution**:
1. Apply conflict resolution heuristics (docs > commits)
2. Check timestamp (recent > old)
3. If unresolvable, ask developer for clarification

### Problem: Too many P0 gaps
**Solution**:
1. Re-evaluate priority (are they truly blocking?)
2. Group related gaps into single probe
3. Consider parallel probe execution
4. Accept higher risk with mitigation plan

## Metrics

Track these metrics to improve context extraction:

- **Time to Context**: How long to get 70% completeness?
- **Probe Hit Rate**: % of probes that successfully fill gaps
- **Evidence Quality**: % of FILLED slots with High confidence
- **Ask Rate**: % of gaps requiring developer questions (goal: < 20%)

## Version History

- **v1.0**: Initial skill set with 8 composable skills
- Focus on deterministic, modular, checklist-driven approach
- 14-slot completeness model as foundation

---

**Next Steps**: Use `SKILL.md` to orchestrate these skills for complete context extraction workflows.