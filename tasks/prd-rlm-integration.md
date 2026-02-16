# PRD: RLM (Recursive Language Model) Integration

## Introduction

Research and implement the best approach to integrate Recursive Language Models from Alex Zhang's paper (arXiv:2512.24601v2) into Orchestra. The RLM paradigm enables LLMs to process arbitrarily long prompts through decomposition, recursive self-calls in a REPL environment, and synthesis. A reference Python library exists at `pip install rlms`.

## Goals

- Analyze the `rlms` library architecture and map to Orchestra's infrastructure
- Evaluate 4 integration options with pros/cons/effort
- Build a proof of concept with the recommended approach
- Document the final recommendation for full implementation

## User Stories

### US-001: Analyze rlms library architecture
**Description:** As a developer, I need to understand how the rlms library works internally so I can evaluate integration options.

**Acceptance Criteria:**
- [ ] Clone https://github.com/alexzhang13/rlm and read source code
- [ ] Document: how `rlm.completion()` orchestrates decomposition
- [ ] Document: REPL environment interface (methods, state management)
- [ ] Document: how recursive calls are tracked and results aggregated
- [ ] Document: prompt templates used for decomposition and synthesis
- [ ] Document: sandbox backend abstraction (local, Docker, Modal)
- [ ] Save analysis to `docs/rlm-analysis.md` in the repo

### US-002: Map RLM concepts to Orchestra infrastructure
**Description:** As a developer, I need to identify which Orchestra components correspond to RLM concepts and where gaps exist.

**Acceptance Criteria:**
- [ ] Create mapping table: RLM concept → Orchestra equivalent → Gap
- [ ] Identify: SubAgent ↔ sub-LM calls, Daytona ↔ REPL, stream_generator ↔ rlm.completion
- [ ] Document gaps that need to be bridged for each integration option
- [ ] Add mapping to `docs/rlm-analysis.md`

### US-003: Evaluate integration options
**Description:** As a developer, I need a clear comparison of all integration approaches so the team can choose the best path.

**Acceptance Criteria:**
- [ ] Evaluate Option A: Direct rlms library integration (pros/cons/effort)
- [ ] Evaluate Option B: LangGraph native implementation (pros/cons/effort)
- [ ] Evaluate Option C: Hybrid rlms + LangGraph streaming (pros/cons/effort)
- [ ] Evaluate Option D: Tool-based exposure (pros/cons/effort)
- [ ] Include streaming/UI visibility analysis for each option
- [ ] Save comparison to `docs/rlm-recommendation.md`

### US-004: Build proof of concept
**Description:** As a developer, I need a working prototype to validate the recommended approach.

**Acceptance Criteria:**
- [ ] Install `rlms` in backend venv (or create isolated test script)
- [ ] Create `backend/scripts/rlm_prototype.py` that runs rlm.completion() with Orchestra's model config
- [ ] Test with a large input (e.g., analyze the Orchestra codebase itself)
- [ ] Measure and document: latency, cost, quality vs standard completion
- [ ] Document findings in `docs/rlm-recommendation.md`

### US-005: Design full integration architecture
**Description:** As a developer, I need an architecture design for the production integration.

**Acceptance Criteria:**
- [ ] Document where RLM fits in agent construction pipeline
- [ ] Document how recursive steps stream to frontend
- [ ] Document how UI shows decomposition progress
- [ ] Document how sandbox environments are configured
- [ ] Document how cost tracking works across recursive calls
- [ ] Include dependency on #694 (subagent UI) for rendering recursive steps
- [ ] Add architecture to `docs/rlm-recommendation.md`

### US-006: Write final recommendation
**Description:** As a developer, I need a clear recommendation document for the team.

**Acceptance Criteria:**
- [ ] Recommended approach clearly stated with justification
- [ ] Architecture overview (could be text-based diagram)
- [ ] Migration path from existing `.claude/skills/rlm/` skill
- [ ] Timeline and effort estimate
- [ ] Dependencies listed
- [ ] `docs/rlm-recommendation.md` is complete and reviewable

### US-007: Verify workspace is clean and push final changes
**Description:** As a developer, I want to ensure all changes are committed and pushed.

**Acceptance Criteria:**
- [ ] Run git status to check for uncommitted changes
- [ ] If remaining changes exist, commit and push to branch
- [ ] All commits visible in GitHub PR
