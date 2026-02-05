---
name: rlm
description: |
  Recursive Language Model pattern for processing large inputs using Sonnet orchestrator
  and parallel Haiku subagents. Decomposes complex tasks into chunks, processes them
  in parallel via sub-agents, then synthesizes results. Use when: analyze large codebase,
  recursive analysis, deep analysis, process large input, comprehensive review,
  rlm, recursive reasoning, review massive document, analyze entire repository.
---

# Recursive Language Model (RLM)

Process large inputs that exceed single-pass capacity by decomposing tasks into manageable chunks, spawning parallel Haiku sub-agents to process each chunk, and synthesizing results into a unified output.

The RLM pattern implements a two-level supervisor-worker hierarchy: a Sonnet supervisor handles strategic decomposition and final synthesis, while Haiku workers handle focused chunk processing in parallel. This achieves cost reduction (Haiku processes 90%+ of tokens) and speed improvement (parallel execution) while maintaining quality through Sonnet-level synthesis.

## Prerequisites

- **Task tool access**: Required for spawning Haiku sub-agents
- **Scratchpad directory**: Use the session scratchpad for intermediate results
- **Model selection**: Sonnet for supervisor (decomposition + synthesis), Haiku for workers (chunk processing)

## Workflow Overview

```
Input -> [Step 1: Assess] -> [Step 2: Decompose] -> [Step 3: Spawn Workers]
                                                           |
                                                     [Parallel Haiku]
                                                           |
                                                    [Step 4: Evaluate]
                                                      /          \
                                              Gaps found?    Complete?
                                                 |               |
                                          Re-decompose    [Step 5: Synthesize]
                                          (new iteration)        |
                                                              Output
```

## Instructions

### Step 1: Assess Task Complexity

Determine whether RLM processing is needed based on input size:

| Metric | Threshold | Action |
|--------|-----------|--------|
| File count | > 50 files | Use RLM |
| Total lines | > 10,000 lines | Use RLM |
| Estimated tokens | > 100,000 tokens | Use RLM |
| File count | <= 50 files | Process directly without RLM |
| Total lines | <= 10,000 lines | Process directly without RLM |
| Estimated tokens | <= 100,000 tokens | Process directly without RLM |

1. **Measure input size**: Use Glob to count files, estimate line counts and token volume.
2. **Compare against thresholds**: If ANY threshold is exceeded, use RLM.
3. **Announce decision**: Tell the user: "This task exceeds single-pass capacity. Using RLM pattern to decompose, process in parallel, and synthesize."
4. **If below thresholds**: Process the input directly with standard tools. Do NOT use RLM for small inputs.

### Step 2: Decompose the Problem

Analyze the input and create an explicit decomposition plan using one of three strategies.

#### Strategy 1: Uniform Chunking

Split input into equally-sized chunks by line count.

**When to use**: No obvious structure, general queries, homogeneous content (logs, transcripts, flat text).

**Procedure**:
1. Calculate total line count.
2. Split into chunks of ~200 lines each.
3. Add 5-10 lines of overlap between adjacent chunks to avoid boundary artifacts.
4. Assign the same query to each chunk.

#### Strategy 2: Keyword Filtering

Use Grep to narrow the input to relevant sections before chunking.

**When to use**: Targeted queries where only a fraction of the input is relevant (e.g., "find all authentication mentions in this codebase").

**Procedure**:
1. Extract keywords from the user query.
2. Use Grep to find all matching sections with surrounding context.
3. If filtered result is small enough (< 10,000 lines), process as a single chunk.
4. If filtered result is still large, apply uniform chunking to the filtered content.

#### Strategy 3: Structural Decomposition

Parse the input by its natural structure (sections, functions, modules, headings).

**When to use**: Structured content like markdown documents (split by headings), codebases (split by module/directory), or multi-file projects (split by functional area).

**Procedure**:
1. Identify structural boundaries: markdown headings, directory boundaries, class/function definitions.
2. Group related structural units into chunks (e.g., 5-10 related files per chunk).
3. Label each chunk with its structural context (section title, module name).
4. Tailor the worker query to each chunk's context.

#### Choosing a Strategy

| Input Type | Query Type | Recommended Strategy |
|-----------|-----------|---------------------|
| Flat text (logs, transcripts) | General summary | Uniform Chunking |
| Any content type | Targeted search for specific topic | Keyword Filtering |
| Markdown documents | Section-by-section analysis | Structural Decomposition |
| Codebase (multi-file) | Module-level review | Structural Decomposition |
| Codebase (multi-file) | Find specific pattern | Keyword Filtering |
| Large document | Comprehensive review | Structural Decomposition |

#### Chunk Size Guidance

Target ~200 lines or ~8,000 tokens per chunk with 5-10 lines overlap between adjacent chunks. Adjust based on content density:
- Dense code: smaller chunks (~150 lines)
- Prose text: larger chunks (~300 lines)
- Mixed content: default (~200 lines)

#### Create and Save Work Plan

Write the decomposition plan to the scratchpad:

```
# RLM Work Plan

Query: [user's original question]
Strategy: [uniform | keyword | structural]
Total chunks: [N]

## Chunks
- Chunk 1: [description] - Focus: [specific aspect]
- Chunk 2: [description] - Focus: [specific aspect]
...
```

Save to: `scratchpad/rlm-work-plan.md`

### Step 3: Spawn Worker Sub-Agents

Execute parallel chunk processing using the Task tool with Haiku model.

1. **Build worker prompts**: Each worker receives:
   - The chunk content (or file paths to read)
   - The specific question to answer for this chunk
   - The output format requirements
   - A constraint to focus ONLY on the assigned chunk

2. **Invoke Task tool for each chunk**:

```
Task(
  subagent_type: "general-purpose",
  model: "haiku",
  description: "Process chunk N of M: [brief description]",
  prompt: "You are processing chunk {N} of {M} in a larger analysis.

ORIGINAL QUERY: {user_query}

YOUR CHUNK:
{chunk_content}

TASK: {specific_task_for_this_chunk}

OUTPUT FORMAT:
- Provide findings as a structured list
- Include confidence score (0-1) for each finding
- If no relevant findings, state: No relevant findings in this chunk.

CONSTRAINT: Focus ONLY on this chunk. Do NOT reference external content."
)
```

3. **Spawn all workers in a single message** if chunks are independent (default). Use sequential spawning only if later chunks depend on earlier results.

4. **Collect all results**: Wait for all Task outputs to return.

### Step 4: Evaluate Completeness

After collecting all worker results, assess whether the analysis is sufficient.

**Convergence Criteria**:
- **Completeness >= 90%**: Does the synthesis address all aspects of the user query?
- **Confidence >= 80%**: Are findings well-supported and consistent across chunks?
- **Max iterations: 3**: Hard limit to prevent infinite loops.

**Evaluation Procedure**:
1. Count how many chunks returned meaningful results.
2. Check if all aspects of the user query are addressed.
3. Identify gaps: aspects of the query not covered by any chunk.
4. Rate completeness (0-100%) and confidence (0-100%).

**Decision**:
- If completeness >= 90% AND confidence >= 80%: Proceed to Step 5 (Synthesize).
- If gaps found AND iteration < 3: Re-decompose the missing areas and spawn a new batch of Haiku workers targeting the gaps. This is iterative deepening - the workaround for the no-nesting constraint (subagents cannot spawn sub-subagents, so the root model must orchestrate additional rounds).
- If max iterations reached: Proceed to Step 5 with best available results, noting gaps.

### Step 5: Synthesize Final Output

Aggregate all worker results into a unified output.

1. **Read all worker outputs**: Collect findings from every chunk across all iterations.

2. **Deduplicate**: Remove findings that appear in multiple chunks (especially from overlap regions).

3. **Identify cross-chunk patterns**: Look for themes, issues, or insights that span multiple chunks. These cross-chunk patterns are the primary value-add of the RLM approach over independent analysis.

4. **Resolve contradictions**: If workers disagree, investigate the conflict. Cite both perspectives and explain the resolution.

5. **Structure the final output**:

```markdown
# [Analysis Title]

## Summary
[2-3 sentence overview of key findings]

## Key Findings
1. [Finding 1] - [source chunk(s)]
2. [Finding 2] - [source chunk(s)]
...

## Cross-Chunk Patterns
- [Pattern spanning multiple chunks]
...

## Detailed Results
[Per-chunk breakdown if relevant]

## Recommendations
[Actionable next steps based on findings]

## Analysis Metadata
- Input: [size description]
- Strategy: [decomposition strategy used]
- Chunks processed: [N]
- Iterations: [N]
- Confidence: [score]/100
```

6. **Present to user**: Deliver the synthesized output directly.

## Model Selection

| Role | Model | Phase | Reasoning |
|------|-------|-------|-----------|
| **Supervisor** | Sonnet | Decomposition (Step 2) | Requires strategic reasoning about input structure |
| **Workers** | Haiku | Chunk Processing (Step 3) | Focused extraction tasks, cost-efficient |
| **Supervisor** | Sonnet | Evaluation (Step 4) | Requires judgment about completeness |
| **Supervisor** | Sonnet | Synthesis (Step 5) | Requires cross-chunk reasoning and pattern detection |

Explicitly specify `model: "haiku"` in every Task tool invocation for worker sub-agents. The supervisor runs as the main Sonnet conversation.
