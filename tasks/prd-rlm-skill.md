# PRD: RLM (Recursive Language Model) Skill

## Introduction

Create a Claude Code skill that implements the Recursive Language Model (RLM) pattern from research paper arXiv 2512.24601v2. The skill enables Claude to process inputs that exceed single-pass capacity by decomposing tasks into chunks, spawning parallel Haiku subagents via the Task tool, and synthesizing results. The root orchestrator uses Sonnet for strategic decisions and synthesis, while Haiku workers handle individual chunk processing — achieving significant cost reduction and enabling analysis of massive codebases, long documents, and complex multi-file questions.

## Goals

- Enable Claude to analyze inputs too large for single-pass processing (50+ files, 10K+ lines)
- Use Sonnet as root orchestrator for decomposition strategy and synthesis
- Use Haiku subagents for parallel chunk processing via the Task tool
- Implement the decompose → process → synthesize loop from the RLM paper
- Achieve cost reduction vs. processing everything in Sonnet directly
- Provide structured, traceable output with confidence assessments
- Handle errors gracefully with retry and fallback mechanisms

## User Stories

### US-001: Create RLM skill directory structure
**Description:** As a developer, I need the skill directory and files created so the skill can be loaded by Claude Code.

**Acceptance Criteria:**
- [ ] Directory created at `.claude/skills/rlm/`
- [ ] `SKILL.md` created with valid YAML frontmatter (name: `rlm`, description with trigger keywords)
- [ ] `references/` directory created with `prompt-templates.md`
- [ ] Skill is under 5,000 words
- [ ] Typecheck passes (N/A — markdown only)

### US-002: Implement core SKILL.md with decompose-process-synthesize workflow
**Description:** As Claude, I need clear instructions on how to execute the RLM pattern so I can process large inputs effectively.

**Acceptance Criteria:**
- [ ] SKILL.md contains Prerequisites section listing requirements (Task tool access, scratchpad)
- [ ] SKILL.md contains "Step 1: Assess Task Complexity" with size thresholds (>50 files, >10K lines, >100K tokens)
- [ ] SKILL.md contains "Step 2: Decompose the Problem" with 3 strategies (uniform chunking, keyword filtering, structural)
- [ ] SKILL.md contains "Step 3: Spawn Worker Sub-Agents" with Task tool invocation pattern specifying `model: "haiku"`
- [ ] SKILL.md contains "Step 4: Evaluate Completeness" with convergence criteria
- [ ] SKILL.md contains "Step 5: Synthesize Final Output" with aggregation instructions
- [ ] Instructions use imperative form throughout
- [ ] Model selection explicitly specified: Sonnet = supervisor, Haiku = workers

### US-003: Add decomposition strategy guidance
**Description:** As Claude, I need guidance on which decomposition strategy to choose based on input characteristics.

**Acceptance Criteria:**
- [ ] Uniform chunking strategy documented (when: homogeneous content, how: split by line count ~200 lines per chunk)
- [ ] Keyword filtering strategy documented (when: targeted search, how: use Grep tool to narrow before chunking)
- [ ] Structural decomposition documented (when: content has natural boundaries, how: parse sections/functions/headings)
- [ ] Decision criteria provided: when to use each strategy based on input type and query type
- [ ] Chunk size guidance: target ~200 lines or ~8K tokens per chunk for Haiku
- [ ] Overlap guidance: 5-10 lines overlap between chunks to preserve context continuity

### US-004: Add Task tool invocation templates for Haiku workers
**Description:** As Claude, I need reusable prompt templates for spawning Haiku chunk-processing subagents.

**Acceptance Criteria:**
- [ ] `references/prompt-templates.md` contains extraction prompt template (for pulling specific information from chunks)
- [ ] `references/prompt-templates.md` contains analysis prompt template (for analyzing chunks against a query)
- [ ] `references/prompt-templates.md` contains filtering prompt template (for determining chunk relevance)
- [ ] All templates are self-contained (include original query, chunk content, output format — no implicit context)
- [ ] All templates specify structured output format (findings, confidence, cross-references)
- [ ] Templates include constraint: "Focus ONLY on this chunk, do NOT reference external content"

### US-005: Add iteration loop and convergence logic
**Description:** As Claude, I need guidance on when to loop (refine chunks and re-process) vs. when to terminate and synthesize.

**Acceptance Criteria:**
- [ ] Maximum iteration limit documented (default: 3)
- [ ] Convergence criteria defined: completeness >= 90% AND confidence >= 80%
- [ ] Refinement logic described: if gaps found, re-decompose and spawn new Haiku batch
- [ ] Iterative deepening pattern documented as workaround for no-nesting constraint
- [ ] Metadata tracking between iterations: which chunks processed, confidence scores, gaps identified

### US-006: Add error handling and fallback patterns
**Description:** As Claude, I need to handle failures gracefully when Haiku subagents fail or return poor results.

**Acceptance Criteria:**
- [ ] Single failure handling: retry once with same prompt
- [ ] Multiple failures (>30%): fall back to Sonnet-only processing
- [ ] All failures: process entire input directly with Sonnet (no chunking)
- [ ] Partial results: produce output with gaps noted and completeness percentage
- [ ] Graceful degradation ladder documented: Full RLM → Partial → Sonnet fallback → Best-effort

### US-007: Add realistic example scenarios
**Description:** As Claude, I need examples showing the RLM pattern applied to real tasks so I understand the expected workflow.

**Acceptance Criteria:**
- [ ] Example 1: Comprehensive codebase security review (150 files → 5 module-based chunks → parallel Haiku analysis → security report)
- [ ] Example 2: Long document analysis (80-page paper → section-based chunks → extract key findings → unified summary)
- [ ] Example 3: Multi-file question answering (trace auth flow across 30+ files → layer-based chunks → end-to-end trace)
- [ ] Each example shows all 3 phases: Decomposition, Processing, Synthesis
- [ ] Examples demonstrate model routing: Sonnet for strategy/synthesis, Haiku for chunks

### US-008: Create install.sh script for standalone skill installation
**Description:** As a developer who finds this skill on GitHub, I want a single `install.sh` script so I can download and install the RLM skill into any project without cloning the entire Orchestra repo.

**Acceptance Criteria:**
- [ ] Script created at `.claude/skills/rlm/install.sh`
- [ ] Script is executable (`chmod +x`)
- [ ] Script creates `.claude/skills/rlm/` directory in the current project (or `~/.claude/skills/rlm/` with a `--global` flag)
- [ ] Script downloads `SKILL.md` and `references/prompt-templates.md` from the repo's raw GitHub URLs
- [ ] Script validates that both files were downloaded successfully (non-empty)
- [ ] Script prints success message with usage instructions after install
- [ ] Script is idempotent — running it again overwrites existing files without error
- [ ] Script includes a header comment with usage: `curl -fsSL <raw-url>/install.sh | bash`
- [ ] Typecheck passes (N/A — bash script)

## Functional Requirements

- FR-1: The skill MUST be located at `.claude/skills/rlm/SKILL.md` with valid YAML frontmatter
- FR-2: The YAML description MUST include trigger keywords: "analyze large", "recursive analysis", "deep analysis", "process large input", "comprehensive review", "rlm"
- FR-3: The skill MUST specify Sonnet for root orchestration (Phases 1 and 3) and Haiku for worker subagents (Phase 2)
- FR-4: The skill MUST include a three-phase workflow: Decompose → Process → Synthesize
- FR-5: The skill MUST provide at least 3 decomposition strategies: uniform chunking, keyword filtering, and structural decomposition
- FR-6: The skill MUST include Task tool invocation patterns with `model: "haiku"` explicitly specified
- FR-7: The skill MUST include convergence criteria for the iteration loop (max 3 iterations, completeness/confidence thresholds)
- FR-8: The skill MUST include error handling with fallback to Sonnet-only processing
- FR-9: The skill MUST include at least 3 realistic example scenarios
- FR-10: The skill MUST use the scratchpad directory for intermediate results
- FR-11: The skill MUST be under 5,000 words total
- FR-12: The `references/prompt-templates.md` file MUST contain self-contained prompt templates for Haiku subagents
- FR-13: The skill MUST include an `install.sh` script that allows standalone installation via `curl | bash`

## Non-Goals

- No backend or frontend code changes — this is a Claude Code skill (markdown only)
- No actual Python/Bash scripts for chunking — Claude uses its tools directly
- No fine-tuning or model training — this is a prompt-engineering skill
- No integration with external APIs beyond Claude Code's built-in tools
- No automatic activation — the skill is opt-in, triggered by keywords or explicit request
- No recursive subagent nesting — Claude Code's Task tool doesn't support it; we use iterative deepening instead

## Design Considerations

### Skill Directory Structure
```
.claude/skills/rlm/
├── SKILL.md                      # Core skill instructions (~3,500 words)
├── install.sh                    # Standalone installer (curl | bash)
└── references/
    └── prompt-templates.md       # Reusable Haiku prompt templates
```

### Key Architecture Decisions
- **Two-level hierarchy**: Sonnet (root) → Haiku (workers). No deeper nesting.
- **Iterative deepening** replaces true recursion: if chunks need further decomposition, the root spawns new Haiku batches in subsequent iterations
- **Scratchpad for intermediates**: Worker outputs stored in scratchpad files to keep root context clean
- **Parallel by default**: All independent chunks processed simultaneously via parallel Task tool calls
- **Max 5 parallel workers**: Practical limit to keep synthesis manageable

### Model Selection Rationale
| Role | Model | Reasoning |
|------|-------|-----------|
| Decomposition strategy | Sonnet | Requires high-level reasoning about input structure |
| Chunk processing | Haiku | Focused extraction/analysis, doesn't need deep reasoning |
| Convergence evaluation | Sonnet | Cross-chunk reasoning, gap identification |
| Final synthesis | Sonnet | Pattern recognition, narrative construction, quality output |

## Technical Considerations

- Skill is pure markdown — no code to test or deploy
- Must follow existing skill patterns in `.claude/skills/` (frontmatter, imperative form, examples)
- Should reference the RLM paper concepts but adapt them for Claude Code's architecture
- Must work within Claude Code's constraint that subagents cannot spawn sub-subagents
- Haiku chunk size should target ~200 lines / ~8K tokens to leave room for instructions and output
- The skill should NOT auto-activate for all large inputs — it should be triggered by keywords or explicit request

## Success Metrics

- Skill loads correctly when triggered by keywords ("rlm", "analyze large", "recursive analysis")
- Claude can process a 150+ file codebase using the RLM pattern
- Claude correctly routes: Sonnet for strategy/synthesis, Haiku for chunk processing
- Output includes structured findings with confidence assessments and source references
- Fallback to Sonnet-only works when Haiku subagents fail

## Open Questions

- Should the skill include a cost estimation step before processing (warn user about expected subagent count)?
- Should there be a "quick mode" (single iteration, no convergence check) vs "thorough mode" (multi-iteration)?
- Should the skill support user-configurable chunk sizes or always auto-detect?
- Should intermediate scratchpad files be automatically cleaned up or preserved for audit?
