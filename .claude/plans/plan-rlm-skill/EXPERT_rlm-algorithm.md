# RLM Algorithm Translation for Claude Code: Implementation Analysis

## Executive Summary

The Recursive Language Model (RLM) pattern from arXiv 2512.24601v2 describes a system where an LLM treats long prompts as external data, programmatically decomposes them, and recursively processes chunks. This document analyzes how to adapt RLM for Claude Code skills, mapping paper concepts to Claude Code's architecture where:

- **Root model (Sonnet)**: The skill itself, running in the main conversation
- **Sub-model (Haiku)**: Task tool subagents spawned for chunk processing
- **REPL**: Claude Code's Bash tool and file system
- **Symbolic handles**: User input stored in temp files, accessed via metadata
- **Termination**: When synthesis is complete or iteration limit reached

**Critical Constraint**: Claude Code subagents cannot nest (no recursive sub-sub-agents). This fundamentally changes the recursion model from the paper's infinite depth to a two-level hierarchy: strategic decomposition (sonnet) + parallel chunk processing (haiku subagents).

---

## 1. Core RLM Algorithm Translation for Claude Code

### 1.1 The Paper's REPL Loop

In the original RLM paper:

```python
# Pseudocode from paper
prompt = store_in_variable(user_input)  # Symbolic handle
metadata = {"length": len(prompt), "preview": prompt[:100]}

while not FINAL_set:
    code = llm.generate(metadata)  # LLM generates decomposition code
    result = repl.execute(code)    # Execute: slice, sub-LLM calls, aggregation
    metadata = result.stdout       # Only constant-size metadata propagates
```

The key innovation: **full prompt never enters LLM context**, only metadata about it.

### 1.2 Claude Code Adaptation

Claude Code IS the REPL. The skill runs as the root LLM with full tool access:

```markdown
## RLM Skill Main Loop (Sonnet)

1. **Initialization Phase**
   - Write user input to temp file: `/tmp/rlm-{uuid}-input.txt`
   - Generate metadata: line count, size, content preview, detected structure
   - Store metadata in skill state (not full content)

2. **Decomposition Phase** (Root Sonnet reasoning)
   - Analyze metadata to choose strategy:
     - Uniform chunking (simple: split by N lines)
     - Keyword filtering (extract relevant sections via grep)
     - Structure-aware (detect markdown sections, code blocks, etc.)
   - Generate decomposition plan: list of chunks to process
   - For each chunk: define query, line range/filter, expected output

3. **Parallel Processing Phase**
   - For each chunk in plan:
     - Extract chunk to temp file
     - Spawn Task tool subagent (haiku) with:
       - Chunk file path
       - Specific question to answer
       - Output format requirements
   - Collect all subagent results

4. **Aggregation Phase** (Root Sonnet synthesis)
   - Read all subagent outputs
   - Synthesize into unified answer
   - Determine if sufficient or need another iteration

5. **Iteration or Termination**
   - If answer complete: output and exit
   - If need refinement: update metadata, adjust strategy, goto step 2
   - If max iterations reached: output best available synthesis
```

### 1.3 Symbolic Handle Implementation

The paper stores prompts as REPL variables. Claude Code uses the file system:

```bash
# Store user input symbolically
USER_INPUT_FILE="/tmp/rlm-session-${SESSION_ID}-input.txt"
echo "$USER_INPUT" > "$USER_INPUT_FILE"

# Generate metadata (constant size, always fits in context)
METADATA=$(cat <<EOF
{
  "file": "$USER_INPUT_FILE",
  "lines": $(wc -l < "$USER_INPUT_FILE"),
  "bytes": $(stat -f%z "$USER_INPUT_FILE"),
  "preview": "$(head -n 5 "$USER_INPUT_FILE")",
  "structure": {
    "markdown_sections": $(grep -c '^#' "$USER_INPUT_FILE"),
    "code_blocks": $(grep -c '```' "$USER_INPUT_FILE"),
    "blank_lines": $(grep -c '^$' "$USER_INPUT_FILE")
  }
}
EOF
)
```

**Key insight**: The skill never reads the full input file into its reasoning context. It only reasons about metadata and works with chunks.

### 1.4 Unbounded Output Construction

The paper allows arbitrarily long outputs by building them programmatically:

```python
# Paper's pattern
results = []
for chunk in chunks:
    result = sub_llm(chunk)
    results.append(result)
# Final output can be arbitrarily long
```

Claude Code adaptation:

```bash
# Accumulation buffer
RESULTS_DIR="/tmp/rlm-session-${SESSION_ID}-results"
mkdir -p "$RESULTS_DIR"

# Each subagent writes to numbered result file
# Subagent 1 -> results/chunk-001.txt
# Subagent 2 -> results/chunk-002.txt
# ...

# Final synthesis reads all results
cat "$RESULTS_DIR"/chunk-*.txt > "$RESULTS_DIR/aggregated.txt"
```

**Key insight**: Results stored externally, only summaries propagate to root model context.

---

## 2. Decomposition Strategies

### 2.1 Strategy Selection Logic

The root model (skill) examines metadata and selects strategy:

| Strategy | When to Use | Implementation |
|----------|------------|----------------|
| **Uniform Chunking** | No obvious structure, general Q&A | Split input into N-line chunks, process each with same query |
| **Keyword Filtering** | Targeted search within large context | Use grep/ripgrep to extract relevant sections, process matches |
| **Structure-Aware** | Markdown docs, code files, structured data | Parse structure (sections, functions, etc.), process by unit |
| **Two-Pass Hybrid** | Complex analysis needs | Pass 1: keyword filter to narrow context. Pass 2: deep analysis on filtered subset |

### 2.2 Uniform Chunking

**Use case**: "Summarize this 10,000 line transcript"

```bash
# Split into chunks
CHUNK_SIZE=500  # lines per chunk
TOTAL_LINES=$(wc -l < "$INPUT_FILE")
NUM_CHUNKS=$(( ($TOTAL_LINES + $CHUNK_SIZE - 1) / $CHUNK_SIZE ))

# Create chunk files
for i in $(seq 1 $NUM_CHUNKS); do
    START=$(( ($i - 1) * $CHUNK_SIZE + 1 ))
    END=$(( $i * $CHUNK_SIZE ))
    sed -n "${START},${END}p" "$INPUT_FILE" > "$CHUNKS_DIR/chunk-$(printf '%03d' $i).txt"
done
```

**Subagent query pattern**: Same query for each chunk
```
Analyze the following chunk (part {i} of {n}) and extract key points.
Focus on: [specific aspects based on user question]
```

### 2.3 Keyword Filtering

**Use case**: "Find all mentions of 'authentication' in this codebase documentation and explain the auth flow"

```bash
# Extract relevant sections
grep -i -C 10 'authentication\|auth\|login' "$INPUT_FILE" > "$FILTERED_FILE"

# Count matches to decide if further splitting needed
MATCH_COUNT=$(grep -c -i 'authentication\|auth\|login' "$INPUT_FILE")

if [ $MATCH_COUNT -lt 20 ]; then
    # Few matches: process as single chunk
    # Spawn one subagent with filtered content
else
    # Many matches: split filtered content into chunks
    # Apply uniform chunking to filtered file
fi
```

**Advantage**: Dramatically reduces context for targeted questions.

### 2.4 Structure-Aware Decomposition

**Use case**: "Analyze each section of this markdown specification"

```bash
# Detect markdown sections
grep -n '^#' "$INPUT_FILE" > "$SECTIONS_INDEX"

# Extract each section to separate file
while IFS=: read -r LINE_NUM HEADER; do
    SECTION_ID=$(echo "$HEADER" | sed 's/[^a-zA-Z0-9]/-/g')
    NEXT_LINE=$(grep -A1 "^${LINE_NUM}:" "$SECTIONS_INDEX" | tail -1 | cut -d: -f1)

    if [ -z "$NEXT_LINE" ]; then
        NEXT_LINE=$(wc -l < "$INPUT_FILE")
    fi

    sed -n "${LINE_NUM},${NEXT_LINE}p" "$INPUT_FILE" > "$CHUNKS_DIR/${SECTION_ID}.txt"
done < "$SECTIONS_INDEX"
```

**Subagent query pattern**: Context-aware per chunk
```
Analyze this section: {section_title}
Task: {specific analysis relevant to this section's content}
```

### 2.5 Strategy Decision Tree

```
Root model examines metadata:

1. Check structure indicators:
   - Has markdown headers? -> Structure-aware
   - Has clear delimiters (---, ===)? -> Structure-aware
   - Is code with functions/classes? -> Structure-aware (parse symbols)

2. If no structure:
   - User query contains keywords? -> Keyword filtering
   - User query is open-ended? -> Uniform chunking

3. If filtered result still large (>5000 lines):
   - Apply uniform chunking to filtered result (two-pass hybrid)
```

---

## 3. Iteration Loop Design

### 3.1 Main Loop Structure

```markdown
## Iteration Loop (Root Sonnet)

State variables (stored in temp files, not in LLM context):
- `state/iteration.txt`: Current iteration number
- `state/strategy.txt`: Current decomposition strategy
- `state/chunks-plan.json`: List of chunks and queries
- `state/synthesis.txt`: Current synthesis result
- `state/refinement-needed.txt`: Boolean + reason if true

Loop:
1. Read iteration count
2. If iteration > MAX_ITERATIONS (default 3): jump to final synthesis
3. Generate/refine chunks-plan.json based on current state
4. Execute parallel chunk processing (spawn subagents)
5. Collect results to results/{iteration}/
6. Synthesize results into synthesis.txt
7. Evaluate: Is answer sufficient?
   - YES: Write to output and exit
   - NO: Write refinement reason, increment iteration, loop
```

### 3.2 Metadata Tracked Between Iterations

Only constant-size metadata propagates (never full chunks or results):

```json
{
  "iteration": 2,
  "input_metadata": {
    "file": "/tmp/rlm-abc123-input.txt",
    "lines": 15000,
    "bytes": 450000
  },
  "strategy_history": [
    {"iteration": 1, "strategy": "keyword_filter", "chunks": 12},
    {"iteration": 2, "strategy": "uniform_chunk", "chunks": 8}
  ],
  "synthesis_summary": {
    "iteration_1": "Identified 5 main themes, but lacking detail on implementation",
    "iteration_2": "Added implementation details, still missing error handling discussion"
  },
  "next_action": {
    "focus": "error_handling",
    "strategy": "keyword_filter",
    "keywords": ["error", "exception", "failure", "retry"]
  }
}
```

**Critical**: Full chunk contents and results never enter root model context. Only summaries and metadata.

### 3.3 Convergence Criteria

When to terminate:

1. **Explicit completion**: Synthesis answers user question fully
   - Check: Can we write a complete answer based on current synthesis?
   - Verify: Does answer address all aspects of user query?

2. **Diminishing returns**: New iteration adds <10% new information
   - Compare synthesis from iteration N vs N-1
   - If minimal delta, terminate

3. **Max iterations**: Hard limit (default 3) to prevent infinite loops
   - Configurable via skill parameter

4. **User-defined threshold**: Confidence score meets target
   - Root model rates synthesis confidence: 0-100
   - Threshold: default 80

### 3.4 Accumulation Buffer Management

```bash
# Directory structure
/tmp/rlm-session-{uuid}/
├── input.txt                    # Original input (never read in full)
├── metadata.json                # Constant-size metadata
├── state/
│   ├── iteration.txt            # Current iteration
│   ├── strategy.txt             # Current strategy
│   └── convergence-score.txt    # 0-100 confidence
├── chunks/
│   ├── iter-01/
│   │   ├── chunk-001.txt
│   │   ├── chunk-002.txt
│   │   └── ...
│   └── iter-02/
│       └── ...
├── results/
│   ├── iter-01/
│   │   ├── result-001.txt       # Subagent outputs
│   │   ├── result-002.txt
│   │   └── synthesis.txt        # Root synthesis of this iteration
│   └── iter-02/
│       └── ...
└── final-output.txt             # Written only at termination
```

**Key operations**:
- Chunks: Root model creates, subagents read
- Results: Subagents write, root model reads summaries only
- Synthesis: Root model writes, carries forward between iterations

---

## 4. Sub-LLM Call Patterns

### 4.1 Task Tool Subagent Invocation

Claude Code's Task tool spawns isolated subagents (haiku model for cost efficiency):

```markdown
## Root Model (Sonnet) spawns subagent:

For chunk 3 of 10, create task:

**Task**: Analyze authentication implementation
**Input file**: /tmp/rlm-session-abc/chunks/iter-01/chunk-003.txt
**Query**:
- Read the provided chunk
- Identify all authentication mechanisms mentioned
- Extract code examples if present
- List security considerations mentioned
- Output format: JSON with keys: mechanisms[], examples[], security[]

**Output file**: /tmp/rlm-session-abc/results/iter-01/result-003.json

Execute and write result to output file.
```

Spawn via Task tool:
```
Use Task tool with description:
"Process authentication chunk 3/10: read chunk file, extract auth mechanisms and security notes, write JSON to result file"
```

### 4.2 Context Passed to Each Subagent

**Minimal context principle**: Only what's needed for the specific chunk.

```
You are processing chunk {i} of {n} as part of a larger analysis.

## Your Input
File: {chunk_file_path}
Lines: {chunk_line_count}

## Your Task
{specific_query_for_this_chunk}

## Output Requirements
- Format: {JSON | Markdown | Plain text}
- Write to: {result_file_path}
- Include: {specific_fields_needed}

## Constraints
- Do NOT attempt to read the full original input
- Focus ONLY on the provided chunk
- Keep output concise: {max_length} chars
- If chunk is not relevant to query, write: {"relevant": false, "reason": "..."}

## Context from Previous Iteration (if any)
{summary_of_what_was_learned_so_far}
```

**Key insight**: Each subagent is stateless. Context about previous findings comes from root model's synthesis, not from other subagents.

### 4.3 Aggregation of Sub-Results

After all subagents complete:

```bash
# Root model reads results (NOT full content, just structured data)
for result_file in results/iter-01/result-*.json; do
    # Parse JSON, extract key fields
    jq -r '.mechanisms[]' "$result_file" >> temp/all-mechanisms.txt
done

# Count unique findings
sort temp/all-mechanisms.txt | uniq -c > temp/mechanism-frequency.txt
```

**Root model reasoning** (on aggregated metadata, not raw results):
```
Mechanism frequency analysis:
- OAuth2: mentioned in 8/10 chunks
- JWT: mentioned in 6/10 chunks
- API Keys: mentioned in 3/10 chunks

Synthesis: System primarily uses OAuth2 with JWT tokens, fallback to API keys for legacy clients.
```

**Key insight**: Root model synthesizes from summaries, not raw subagent outputs. Full outputs stay on disk.

### 4.4 Error Handling for Sub-Calls

Subagent failures:

| Failure Type | Detection | Recovery Strategy |
|--------------|-----------|-------------------|
| **Timeout** | Task tool timeout (default 120s) | Mark chunk as failed, continue with other chunks, note gap in synthesis |
| **Empty output** | Result file empty or missing | Retry chunk with simplified query, or mark as "no relevant info" |
| **Malformed output** | JSON parse error | Retry with explicit format instructions, or extract text content |
| **Subagent reports irrelevant** | `{"relevant": false}` in output | Skip chunk in synthesis, don't count as failure |

**Retry logic**:
```markdown
If subagent fails:
1. Check failure type
2. If timeout: Reduce chunk size by 50%, retry
3. If malformed: Simplify output format (JSON -> plain text), retry
4. If still fails after 1 retry: Mark chunk as skipped, continue

Track failure rate:
- If >30% of chunks fail: Switch decomposition strategy, start new iteration
- If >50% fail: Abort RLM loop, fall back to direct (non-RLM) processing
```

### 4.5 Parallel vs Sequential Subagent Execution

**Default: Parallel** (since Claude Code supports concurrent Task tools)

```markdown
## Parallel Execution (default)

Spawn all subagents simultaneously:
- Task 1: Process chunk 1
- Task 2: Process chunk 2
- ...
- Task N: Process chunk N

Wait for all to complete (or timeout), then aggregate.

Advantages:
- Fast: All chunks processed in parallel
- Scales well for many small chunks

Disadvantages:
- No inter-chunk learning
- Higher resource usage
```

**Sequential fallback** (when chunks have dependencies)

```markdown
## Sequential Execution (rare)

Only when chunks are interdependent:
Example: "Compare section 1 vs section 2"

Process chunk 1 -> Get result 1 -> Pass summary to chunk 2 processor
```

**Decision rule**:
- If user query is per-chunk independent (summarize, extract, list): Parallel
- If query requires comparison or ordering: Sequential

---

## 5. Termination & Synthesis

### 5.1 Convergence Detection

Root model evaluates after each iteration:

```markdown
## Convergence Check (Root Sonnet)

Read current synthesis: state/synthesis.txt
Compare to user question: state/user-query.txt

Evaluation criteria:
1. **Completeness**: Does synthesis address all parts of user query?
   - Checklist: [aspect 1: covered, aspect 2: covered, ...]
   - Score: % of aspects covered

2. **Sufficiency**: Is detail level adequate?
   - Can user take action based on answer?
   - Are examples/evidence provided?

3. **Confidence**: How certain are we?
   - Based on: % of input covered, consistency across chunks, no contradictions
   - Score: 0-100

Decision:
- If completeness ≥ 90% AND sufficiency = YES AND confidence ≥ 80: TERMINATE
- Else if iteration < MAX_ITERATIONS: REFINE (specify what's missing)
- Else: TERMINATE (max iterations reached, output best available)
```

### 5.2 Final Synthesis Step

**Two-tier synthesis**:

1. **Per-iteration synthesis** (after each chunk processing round)
   - Aggregate chunk results
   - Identify themes, patterns, conflicts
   - Note gaps or areas needing refinement
   - Write to: `results/iter-{N}/synthesis.txt`

2. **Final synthesis** (at termination)
   - Read all per-iteration syntheses
   - Unified narrative combining all findings
   - Cite chunk/iteration sources for key claims
   - Write to: `final-output.txt`

**Final synthesis quality boost**: Use Sonnet for final synthesis (even if Haiku was used for chunks)

```markdown
## Final Synthesis Prompt (Sonnet)

You are synthesizing the results of a multi-iteration analysis.

Input:
- User question: {original_query}
- Iteration 1 synthesis: {summary only, 200 chars}
- Iteration 2 synthesis: {summary only, 200 chars}
- ...

Full synthesis files available at:
- results/iter-01/synthesis.txt
- results/iter-02/synthesis.txt

Task:
1. Read all synthesis files (these are short, already-synthesized outputs)
2. Create unified answer that:
   - Addresses user question directly
   - Integrates findings from all iterations
   - Highlights main insights
   - Notes any limitations or gaps
   - Provides examples/evidence where relevant

Output format: {user preference: concise summary | detailed report | structured JSON}
```

### 5.3 Output Formatting

User-facing output includes:

```markdown
# Answer to: {user_query}

{main_synthesis_content}

---

## Analysis Summary
- Input: {line_count} lines, {byte_count} bytes
- Strategy: {strategies_used}
- Iterations: {iteration_count}
- Chunks processed: {total_chunks}
- Processing time: {duration}

## Confidence: {score}/100

{if_confidence_low}
**Note**: This analysis is based on {chunks_successful}/{total_chunks} successfully processed chunks.
Some sections may be incomplete due to: {failure_reasons}
{/if}

---
Generated using RLM skill with {root_model} + {sub_model} agents.
```

---

## 6. Limitations & Adaptations

### 6.1 No Recursive Nesting

**Paper's approach**: Infinite recursion depth
```python
def rlm(input):
    if small_enough(input):
        return llm(input)
    else:
        chunks = decompose(input)
        return aggregate([rlm(chunk) for chunk in chunks])  # Recursive
```

**Claude Code constraint**: Subagents cannot spawn sub-subagents.

**Adaptation**: Two-level hierarchy only
```markdown
Level 0 (Root): Sonnet skill
  └─> Level 1 (Subagents): Haiku tasks
       └─> Level 2: NOT ALLOWED

Workaround:
- If a chunk is still too large for Haiku subagent, ROOT model must re-decompose
- Root spawns new set of subagents with finer-grained chunks
- This becomes a new iteration, not recursion
```

**Practical impact**:
- Cannot handle arbitrarily deep decomposition in single pass
- Solution: Iterative refinement replaces recursive depth

### 6.2 Context Window vs Prompt Length

**Paper's problem**: Prompt length exceeds model's context
**Claude Code reality**: Context window is large (200K for Sonnet)

**When RLM is actually needed**:
- Input truly exceeds 200K tokens (rare)
- User wants to avoid cost of processing huge context (valid)
- Targeted search: Only small part of input is relevant (common)

**Adaptation**: Make RLM opt-in or strategy-triggered
```markdown
Skill decision tree:
1. Check input size
2. If <50K tokens AND user query is general: Use direct processing (non-RLM)
3. If >50K tokens OR query is targeted search: Use RLM
4. If 10K-50K tokens: Ask user preference (fast RLM vs comprehensive direct)
```

### 6.3 Bash/Task Tools vs Python REPL

**Paper uses Python REPL**: Rich data structures, easy list/dict manipulation

**Claude Code uses Bash + Task tool**:
- Bash: Good for file ops, text processing, basic logic
- Task tool: Good for spawning isolated LLM agents
- JSON via jq: Structured data handling

**Adaptation**:
- Use Bash for orchestration, file manipulation
- Use jq for JSON parsing/generation (structured plans, results)
- Use Task tool for LLM-based processing only (not computation)
- Avoid complex logic in Bash (keep it simple: file I/O, spawning, counting)

**Example: Don't do complex parsing in Bash**:
```bash
# BAD: Complex parsing in Bash
while IFS= read -r line; do
    if [[ "$line" =~ ^#+\ (.+) ]]; then
        # Complex regex logic...
    fi
done < "$file"

# GOOD: Use standard tools
grep '^#' "$file" | sed 's/^#* //' > sections.txt
```

### 6.4 Subagent Isolation

**Paper's sub-LLMs**: Share no state, completely independent

**Claude Code subagents**: Isolated contexts, but can access same filesystem

**Risk**: Subagent could read input file directly, defeating symbolic handle pattern

**Mitigation**:
```markdown
Subagent prompt MUST include:

**CRITICAL CONSTRAINT**:
You are processing a CHUNK of a larger input. Your chunk file is: {chunk_file}.
Do NOT attempt to read any other files from the session directory.
Do NOT read: {input_file} (the full input).
Only process the provided chunk file.
```

**Enforcement**: Monitor subagent tool calls (if possible), or accept as documented constraint.

### 6.5 Cost Model

**Paper**: Constant cost per iteration (only metadata in root context)

**Claude Code**:
- Root model (Sonnet): More expensive, but only processes metadata
- Subagents (Haiku): Cheaper, but more of them

**Cost analysis**:
```
Direct processing (no RLM):
- 1 Sonnet call with full input (e.g., 100K tokens)
- Cost: 100K tokens * $15/MTok = $1.50

RLM processing:
- 3 iterations:
  - Root reasoning: 3 * 5K tokens * $15/MTok = $0.23
  - Subagents: 10 chunks/iter * 3 iter * 5K tokens * $3/MTok = $0.45
- Total: $0.68

Savings: 55% (when input is large and only part is relevant)
```

**When RLM is cost-effective**:
- Large input (>50K tokens)
- Targeted query (only need <20% of input)
- Can use cheaper sub-model (Haiku vs Sonnet)

### 6.6 Latency Considerations

**Parallel subagents**: Fast wall-clock time (all chunks process simultaneously)

**Sequential iterations**: Adds latency

**Optimization**:
- Prefer single iteration with good decomposition over multiple iterations
- Use aggressive convergence criteria (don't over-iterate)
- Consider user preference: Speed vs thoroughness

**Latency estimate**:
```
Single iteration RLM:
- Root decomposition: 10s
- Subagents (parallel): 30s (limited by slowest chunk)
- Root synthesis: 10s
- Total: ~50s

Three iteration RLM:
- 3 * 50s = 150s (2.5 minutes)

Direct processing:
- 1 Sonnet call: 60s (for large input)

Trade-off: RLM may be slower unless parallelization advantage dominates.
```

---

## 7. Practical Implementation Roadmap

### 7.1 Minimal Viable RLM Skill

**Phase 1: Basic uniform chunking**
- Input: User provides large text file or pastes content
- Strategy: Fixed uniform chunking (500 lines/chunk)
- Sub-model: Haiku subagents with identical query
- Synthesis: Simple concatenation of results
- Termination: Single iteration only

**Deliverable**: Skill that can process 100K+ line inputs via chunking.

### 7.2 Enhanced RLM Skill

**Phase 2: Add strategy selection**
- Metadata analysis: Detect structure, keywords
- Strategy options: Uniform, keyword filter, structure-aware
- Root model chooses strategy based on query + metadata
- Synthesis: Intelligent aggregation (remove duplicates, merge themes)

**Deliverable**: Skill adapts decomposition to input structure.

### 7.3 Full RLM Skill

**Phase 3: Add iteration loop**
- Convergence criteria: Completeness + confidence scoring
- Multi-iteration refinement: Root analyzes synthesis, generates new plan
- Hybrid strategies: Two-pass processing
- Error handling: Retry logic, fallback strategies

**Deliverable**: Skill matches paper's full RLM pattern (minus recursion depth).

### 7.4 Skill Interface Design

```markdown
---
name: rlm
description: "Process large inputs using Recursive Language Model pattern. Use for documents exceeding 50K tokens or targeted analysis of massive codebases. Triggers on: analyze large file, process long document, search huge context."
---

# RLM: Recursive Language Model Processor

Process large inputs efficiently using strategic decomposition and parallel chunk processing.

## Arguments

- **input_file**: Path to input file (or use inline content via prompt)
- **query**: The question or task to perform on the input
- **strategy**: auto | uniform | keyword | structure (default: auto)
- **max_iterations**: 1-5 (default: 3)
- **chunk_size**: Lines per chunk for uniform strategy (default: 500)
- **sub_model**: haiku | sonnet (default: haiku for cost efficiency)

## Usage Examples

**Example 1: Summarize large transcript**
```
/rlm input_file="/path/to/transcript.txt" query="Summarize the main discussion points and decisions made"
```

**Example 2: Find auth mentions in docs**
```
/rlm input_file="./docs/**/*.md" query="Find all authentication mechanisms and explain the auth flow" strategy=keyword
```

**Example 3: Analyze codebase structure**
```
/rlm input_file="./src/**/*.py" query="List all API endpoints and their purposes" strategy=structure
```

## Output

- Direct answer to your query
- Analysis metadata (chunks processed, strategy used, confidence score)
- Full results available in session directory (if you need raw data)
```

### 7.5 Testing Strategy

**Unit tests** (mock Task tool):
- Test decomposition strategies on known inputs
- Verify metadata generation accuracy
- Test convergence criteria logic

**Integration tests** (with real subagents):
- Small input (1K lines): Verify RLM produces same result as direct
- Large input (100K lines): Verify completion without timeout
- Targeted query: Verify keyword strategy finds relevant sections

**Benchmark tests**:
- Compare RLM vs direct processing: accuracy, cost, latency
- Measure convergence rates for different input types
- Test failure recovery (inject subagent failures)

---

## 8. Advanced Patterns

### 8.1 Two-Model Strategy from Paper

**Paper's approach**: Root model (larger, strategic) + Sub-model (smaller, processing)

**Claude Code implementation**:
- Root: Sonnet 4.5 (best reasoning for decomposition strategy)
- Sub: Haiku 3.5 (cheap, fast, sufficient for chunk processing)

**When to use same model for both**:
- Complex chunks requiring deep reasoning (use Sonnet for both)
- Cost is not a concern
- Subagent tasks are not formulaic

**Cost trade-off**:
```
10 chunks, 5K tokens each:

Haiku subagents:
- 10 * 5K * $3/MTok = $0.15

Sonnet subagents:
- 10 * 5K * $15/MTok = $0.75

Savings: 80% by using Haiku
```

### 8.2 Buffer Accumulation Pattern

**Paper's technique**: Results stored in variables, appended each iteration

**Claude Code**: Use filesystem as accumulator

```bash
# Iteration 1: Process chunks 1-10
cat results/iter-01/result-*.txt > buffer/cumulative.txt

# Iteration 2: Process refined chunks 11-15
cat results/iter-02/result-*.txt >> buffer/cumulative.txt

# Final synthesis reads cumulative buffer (summary only)
wc -l buffer/cumulative.txt  # Just metadata
head -n 20 buffer/cumulative.txt  # Preview
# Full content never enters root context
```

**Key insight**: Buffer grows unboundedly on disk, but only constant-size summaries enter LLM context.

### 8.3 Symbolic Recursion Emulation

**Paper's FINAL(answer) pattern**: Termination signal

**Claude Code adaptation**:

```bash
# Root model writes termination signal
echo "COMPLETE" > state/status.txt
cat synthesis.txt > final-output.txt

# Loop check
if [ "$(cat state/status.txt)" = "COMPLETE" ]; then
    # Output final answer and exit
    cat final-output.txt
    exit 0
fi
```

**FINAL_VAR(variable_name) pattern**: Return intermediate result

```bash
# If synthesis is sufficient but not yet polished
echo "NEEDS_POLISH" > state/status.txt
echo "synthesis.txt" > state/final-var.txt

# Next iteration: Root model reads synthesis.txt and polishes (no new chunks)
```

---

## 9. Concrete Example Walkthrough

**Scenario**: User asks to analyze a 80K-line codebase documentation and find all security best practices mentioned.

### Iteration 1: Initial Discovery

**Root (Sonnet) reasoning**:
```
Input metadata:
- File: /tmp/rlm-s123/input.txt
- Lines: 80,000
- Size: 3.2MB
- Structure: Markdown with 450 sections
- Preview: "# Security Guide..."

Query: "Find security best practices"

Strategy decision: KEYWORD filter
- Keywords: security, secure, auth, encryption, password, token, vulnerability
- Estimated relevant sections: ~40 (based on grep count)

Plan:
- Extract sections containing keywords -> 40 sections, ~8K lines total
- Chunk filtered content into 16 chunks (500 lines each)
- Spawn 16 Haiku subagents (parallel)
- Each subagent: Extract best practices from chunk, output as JSON list
```

**Subagent 3 prompt** (example):
```markdown
You are processing chunk 3 of 16.

Input file: /tmp/rlm-s123/chunks/iter-01/chunk-003.txt

Task: Extract security best practices mentioned in this chunk.

Output format (write to /tmp/rlm-s123/results/iter-01/result-003.json):
{
  "practices": [
    {"practice": "...", "description": "...", "source_line": N}
  ],
  "relevant": true
}

If chunk has no security practices, output: {"relevant": false}
```

**Aggregation**:
```bash
# Root model executes:
jq -s 'map(.practices) | flatten | unique_by(.practice)' \
  results/iter-01/result-*.json > results/iter-01/all-practices.json

wc -l results/iter-01/all-practices.json
# Output: 47 practices found
```

**Synthesis**:
```markdown
Iteration 1 synthesis (written to results/iter-01/synthesis.txt):

Found 47 security best practices across 16 chunks:
- Authentication: 12 practices (OAuth2, JWT, MFA...)
- Data encryption: 8 practices (TLS, at-rest encryption...)
- Input validation: 9 practices (sanitization, allowlists...)
- Access control: 11 practices (RBAC, least privilege...)
- Error handling: 7 practices (don't leak info, log securely...)

Completeness: 85% (all major categories covered)
Confidence: 70% (some practices may be in non-keyword sections)

Refinement needed: Check for best practices in introduction/conclusion sections
(which may not contain explicit keywords).
```

### Iteration 2: Refinement

**Root reasoning**:
```
Iteration 1 covered keyword-filtered sections (85% complete).
Gap: Introduction/conclusion sections without keywords may have high-level best practices.

New strategy: STRUCTURE-aware (process intro/conclusion of each major section)

Plan:
- Extract first/last paragraph of each of the 450 sections
- Filter to non-redundant content (exclude already-processed)
- Chunk into 6 chunks
- Spawn 6 Haiku subagents
```

**Aggregation**:
```bash
# Merge iteration 1 + 2 results
jq -s 'map(.practices) | flatten | unique_by(.practice)' \
  results/iter-01/all-practices.json \
  results/iter-02/result-*.json > results/iter-02/all-practices.json

wc -l results/iter-02/all-practices.json
# Output: 52 practices (5 new from iteration 2)
```

**Synthesis**:
```markdown
Iteration 2 synthesis (written to results/iter-02/synthesis.txt):

Added 5 high-level best practices from section introductions:
- "Security by design" principle
- "Assume breach" mindset
- Regular security audits
- Security training for developers
- Incident response planning

Completeness: 95% (comprehensive coverage)
Confidence: 85% (high confidence, two-pass validation)

Convergence: YES (new iteration added <10% new info)
```

**Termination decision**:
```
Completeness ≥ 90%: YES (95%)
Confidence ≥ 80%: YES (85%)
Iteration < MAX (3): YES (iteration 2)

Decision: TERMINATE (convergence reached)
```

### Final Synthesis

**Root (Sonnet) generates final output**:
```markdown
# Security Best Practices from Codebase Documentation

## Summary
Found 52 distinct security best practices across 450 documentation sections.

## Categories

### 1. Authentication (12 practices)
- Use OAuth2 for third-party integrations
- Implement MFA for sensitive operations
- Rotate API keys every 90 days
- [9 more...]

### 2. Data Encryption (8 practices)
- Enforce TLS 1.3 for all connections
- Encrypt sensitive data at rest using AES-256
- [6 more...]

[... remaining categories ...]

## High-Level Principles
- Security by design: Consider security from project inception
- Assume breach: Design systems to limit damage from compromises
- Regular audits: Conduct security reviews quarterly

---

**Analysis Summary**
- Input: 80,000 lines (3.2MB markdown)
- Strategy: Two-pass (keyword filter + structure-aware)
- Iterations: 2
- Chunks processed: 22 (16 + 6)
- Processing time: 78 seconds
- Confidence: 85/100

Generated using RLM skill with Claude Sonnet 4.5 + Claude Haiku 3.5
```

---

## 10. Summary: Key Differences from Paper

| Aspect | Paper (RLM) | Claude Code Adaptation |
|--------|-------------|------------------------|
| **REPL** | Python interpreter | Bash + filesystem + Task tool |
| **Symbolic handle** | Python variable | Temp file path |
| **Root model** | Any LLM | Claude Sonnet 4.5 (skill) |
| **Sub-model** | Any LLM (can be same) | Claude Haiku 3.5 (Task tool subagents) |
| **Recursion depth** | Unlimited (recursive calls) | 2 levels only (root + subagents) |
| **Iteration** | While loop until FINAL | Max iterations with convergence check |
| **Metadata propagation** | Stdout strings | JSON files + jq parsing |
| **Termination** | FINAL(answer) or FINAL_VAR() | Status file + convergence criteria |
| **Primary use case** | Prompts exceeding context | Targeted search or cost optimization on large inputs |
| **Sub-call execution** | Sequential (in paper examples) | Parallel (Claude Code Task tool) |

---

## 11. Implementation Checklist

### Phase 1: Core RLM (Minimal)
- [ ] Design session directory structure
- [ ] Implement metadata generation from input file
- [ ] Implement uniform chunking strategy
- [ ] Create subagent prompt template
- [ ] Implement Task tool spawning for chunks
- [ ] Implement result aggregation (simple concatenation)
- [ ] Write single-iteration synthesis logic
- [ ] Test with 10K line input

### Phase 2: Strategy Selection
- [ ] Implement keyword filtering strategy
- [ ] Implement structure-aware strategy (markdown sections)
- [ ] Create strategy decision tree
- [ ] Add strategy metadata to session state
- [ ] Test all three strategies on diverse inputs

### Phase 3: Iteration Loop
- [ ] Implement iteration counter and state management
- [ ] Create convergence evaluation logic
- [ ] Implement refinement planning (root decides next iteration)
- [ ] Add max iteration limit
- [ ] Test multi-iteration refinement

### Phase 4: Error Handling
- [ ] Add subagent timeout handling
- [ ] Implement retry logic for failed chunks
- [ ] Add fallback to direct processing
- [ ] Log failure metrics

### Phase 5: Polish
- [ ] Add cost estimation (before processing)
- [ ] Add progress reporting (streaming updates)
- [ ] Optimize chunk size based on input characteristics
- [ ] Add user-facing configuration options
- [ ] Write comprehensive skill documentation

---

## 12. References

**Paper**: "Recursive Language Model" (arXiv 2512.24601v2)

**Key concepts**:
- Symbolic handles for unbounded prompts
- Constant-size metadata propagation
- Programmatic decomposition via code generation
- Two-model strategy (strategic + tactical)
- FINAL() termination signal

**Claude Code specific**:
- Task tool documentation (for spawning subagents)
- Bash tool capabilities (file operations, text processing)
- Cost model: Sonnet ($15/MTok) vs Haiku ($3/MTok)
- Context window: 200K tokens for Sonnet 4.5

**Related patterns**:
- Map-reduce for LLMs (similar to RLM's decompose-aggregate)
- ReAct pattern (reasoning + action, but RLM adds recursion)
- Tree-of-thoughts (explores multiple reasoning paths, RLM explores chunks)

---

## Final Recommendations

1. **Start with Phase 1** (single iteration, uniform chunking) to validate the core pattern
2. **Use Haiku subagents** by default for cost efficiency (can override per-skill invocation)
3. **Make RLM opt-in** (not automatic) until proven reliable
4. **Monitor convergence quality** across diverse inputs before enabling multi-iteration by default
5. **Provide cost estimates** before processing (let user decide if RLM is worth it)
6. **Log detailed metrics** (chunks, tokens, cost, latency) for optimization
7. **Consider non-RLM fallback** for small inputs (<10K tokens) where direct processing is simpler

The RLM pattern is powerful for targeted analysis of massive inputs, but adds complexity. Implement incrementally and validate at each phase.
