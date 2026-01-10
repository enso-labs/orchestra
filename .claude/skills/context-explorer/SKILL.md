---
name: context-explorer
description: |
  Systematically extract context from git history, diffs, commits, and documentation to
  understand development intent and create complete specifications. Use when you need to
  understand what a PR/branch is trying to accomplish, extract requirements from changes,
  or build a specification from existing code changes.
---

# Context Explorer

Systematically extract context from git history, diffs, commits, and documentation to understand development intent and create complete specifications from code changes.

## Instructions

### Prerequisites

- Git repository with commit history
- Access to diff outputs, commit messages, documentation files
- Understanding of the 14-slot completeness model

### Workflow

1. **Initial Triage**: Scan available evidence sources (diffs, commits, docs)
2. **Intent Extraction**: Extract developer intent from commits and changes
3. **Documentation Analysis**: Scan for specification signals in doc changes
4. **Completeness Check**: Compare findings against 14-slot model
5. **Gap Identification**: Identify missing critical details
6. **Evidence Planning**: Generate targeted probe plan for gaps
7. **Synthesis**: Compile end-state specification with confidence levels

### Core Skills

This skill orchestrates 8 sub-skills:

1. **diff-triage**: Prioritize diffs by signal value
2. **commit-intent-extraction**: Extract intent from commit messages
3. **doc-delta-scan**: Find specification signals in docs
4. **end-state-spec**: Synthesize complete specification
5. **acceptance-criteria**: Extract testable criteria
6. **risk-gaps**: Identify risks and gaps
7. **missing-details-regression**: Compare against completeness model
8. **evidence-plan**: Generate targeted evidence-gathering plan

## Examples

### Example 1: Analyze PR for Context

User: "What is this PR trying to accomplish?"
Assistant: I'll analyze the PR to extract context.
1. Triaging diffs for signal value
2. Extracting intent from commits
3. Scanning documentation changes
4. Checking completeness against model
5. Generating evidence plan for gaps

[Provides complete specification with confidence levels]

### Example 2: Build Specification from Branch

User: "Build a spec from the changes in feature/auth"
Assistant: I'll extract the specification from the branch changes.
1. Reading commit history and diffs
2. Extracting behavioral signals
3. Identifying acceptance criteria
4. Checking for gaps in understanding
5. Generating evidence plan

[Provides specification with risk assessment]

## 14-Slot Completeness Model

Every specification must address:

1. **Goal/Outcome**: What are we trying to achieve?
2. **User Persona/Stakeholder**: Who is this for?
3. **Scope (In/Out)**: What's included/excluded?
4. **Constraints**: Technical, time, compliance, cost limits
5. **Interfaces & Integrations**: What systems connect?
6. **Data Shape/Schemas/Contracts**: What data structures?
7. **Behavioral Rules/Business Logic**: What are the rules?
8. **Performance Expectations**: Speed, scale, efficiency
9. **Reliability Expectations**: Uptime, error handling
10. **Security/Privacy Requirements**: Auth, data protection
11. **Observability Requirements**: Logging, monitoring, metrics
12. **Acceptance Criteria**: Testable success conditions
13. **Rollout/Migration Plan**: How to deploy safely
14. **Risks & Unknowns**: What could go wrong?

Each slot must have:
- **Status**: FILLED | EMPTY | VAGUE | CONFLICTING
- **Current Value/Hypothesis**: What we know or assume
- **Evidence Source(s)**: Where this came from
- **Confidence Level**: High/Medium/Low
- **If not FILLED**: Evidence needed + cheapest probe + impact if wrong

## Guidelines

- Start with high-signal sources (commit messages, doc changes)
- Use deterministic extraction patterns
- Always check completeness against 14-slot model
- Generate specific evidence-gathering probes, not vague questions
- Track confidence levels for all findings
- Identify conflicting signals explicitly
- Prioritize P0 gaps that block understanding

## Reference

### Evidence Source Types

| Type | Value | Cost | Signal Quality |
|------|-------|------|----------------|
| Commit message | High | Low | High if well-written |
| Doc changes | High | Low | High for intent |
| Test changes | High | Medium | High for behavior |
| Type definitions | Medium | Low | Medium for contracts |
| File diffs | Medium | High | Variable |
| File tree changes | Low | Low | Low for new files |

### Probe Types

| Probe | When to Use | Example |
|-------|-------------|---------|
| `diff` | Check specific file changes | `git diff main...HEAD -- path/to/file` |
| `commit` | Extract commit details | `git log --format=full` |
| `doc` | Read documentation | `Read PROPOSAL.md` |
| `file` | Read source code | `Read src/module.ts` |
| `test` | Check test coverage | `Grep "describe" --glob "*.test.ts"` |
| `ask` | Query developer (last resort) | "What is the performance target?" |
