# Multi-Model Orchestration Expert Analysis
## RLM Skill for Claude Code

**Expert Domain**: Multi-model agent orchestration using Claude Code's Task tool
**Pattern**: Recursive Language Model (RLM) with Sonnet (root) and Haiku (sub-agents)
**Reference Implementation**: `/examples/agents/RLM.ipynb` (V1-V3)
**Date**: 2026-02-05

---

## Table of Contents

1. [Model Routing Strategy](#1-model-routing-strategy)
2. [Task Tool Invocation Patterns](#2-task-tool-invocation-patterns)
3. [Data Flow Architecture](#3-data-flow-architecture)
4. [Practical Claude Code Constraints](#4-practical-claude-code-constraints)
5. [Error Handling & Resilience](#5-error-handling--resilience)
6. [Prompt Engineering for Sub-Calls](#6-prompt-engineering-for-sub-calls)
7. [Synthesis Pattern](#7-synthesis-pattern)
8. [Implementation Roadmap](#8-implementation-roadmap)

---

## 1. Model Routing Strategy

### 1.1 When Sonnet Handles Tasks Directly

**Strategic Decision-Making** (Sonnet-only, no delegation):
- Initial query analysis and decomposition planning
- Determining chunk boundaries and distribution strategy
- Final synthesis of all sub-agent results
- Complex reasoning about document structure
- Error recovery and fallback logic
- Small inputs (< 5,000 characters) where delegation overhead exceeds benefit

**Decision Heuristic**:
```python
def should_use_sonnet_only(task_type, input_size, complexity):
    if task_type in ["strategy", "synthesis", "error_recovery"]:
        return True
    if input_size < 5000:  # Below delegation threshold
        return True
    if complexity == "requires_deep_reasoning":
        return True
    return False
```

**Example Scenarios**:
- "What is the overall argument structure of this paper?" → Sonnet-only (strategic)
- "Summarize the methodology section" → Delegate to Haiku (focused extraction)
- "How do sections 2 and 5 contradict each other?" → Sonnet (cross-section reasoning)

### 1.2 When to Spawn Haiku Subagents

**Chunk Processing** (Parallel Haiku calls):
- Extracting facts from document sections
- Filtering irrelevant content from large regions
- Pattern matching across multiple chunks
- Counting/tabulating occurrences
- Summarizing well-defined sections

**Extraction Tasks** (Single or parallel Haiku):
- "Find all mentions of X in the document"
- "Extract methodology details from section Y"
- "List all benchmarks discussed"
- "Count occurrences of pattern Z"

**Decision Heuristic**:
```python
def should_spawn_haiku(task_type, chunk_size, parallelizable):
    if task_type in ["extract", "filter", "count", "summarize_section"]:
        if chunk_size > 5000 and chunk_size < 50000:
            return True
    if parallelizable and num_chunks > 1:
        return True  # Parallel haiku calls
    return False
```

### 1.3 Routing Decision Criteria

**Input Size Thresholds**:
| Input Size | Strategy | Reasoning |
|-----------|----------|-----------|
| < 5K chars | Sonnet direct | Overhead of delegation exceeds benefit |
| 5K-50K chars | Single Haiku | Sweet spot for focused sub-task |
| 50K-200K chars | Parallel Haiku (2-5 agents) | Divide into chunks, process parallel |
| 200K+ chars | Parallel Haiku (5-10 agents) | Heavy parallelization needed |

**Task Complexity Assessment**:
```
High Complexity (Sonnet):
- Cross-document reasoning
- Synthesis of multiple perspectives
- Detecting contradictions
- Strategic decomposition

Low Complexity (Haiku):
- Single-region extraction
- Pattern matching
- Fact collection
- Summarization of well-scoped content
```

### 1.4 Cost Optimization Considerations

**Cost Model** (Anthropic pricing as of 2026):
- **Sonnet**: ~$3 per million input tokens, ~$15 per million output tokens
- **Haiku**: ~$0.25 per million input tokens, ~$1.25 per million output tokens

**Optimization Strategy**:
```python
# Sonnet for 100K input + 1K output:
cost_sonnet = (100000 * 3 / 1e6) + (1000 * 15 / 1e6) = $0.315

# Haiku for 10x 10K chunks + 100 output each:
cost_haiku = 10 * ((10000 * 0.25 / 1e6) + (100 * 1.25 / 1e6)) = $0.026

# Savings: 92% cost reduction with chunking
```

**Key Insight**: RLM pattern can achieve **10-20x cost reduction** for large context tasks by:
1. Using Haiku for 90%+ of token processing (chunks)
2. Using Sonnet only for strategic decisions and synthesis
3. Parallelizing Haiku calls to maintain latency targets

**When Cost Optimization Fails**:
- Too many small chunks (delegation overhead dominates)
- Chunks have high inter-dependencies (requires re-reading context)
- Synthesis requires re-processing everything (loses chunk efficiency)

---

## 2. Task Tool Invocation Patterns

### 2.1 Claude Code Task Tool Basics

**Task Tool Signature** (from agent-builder.md reference):
```python
Task(
    subagent_type="general-purpose",  # or domain-specific
    model="haiku",                     # "sonnet", "haiku", "opus"
    prompt="...",                      # Self-contained instruction
    description="..."                  # What this subagent does
)
```

**Key Constraints**:
- Subagents CANNOT spawn other subagents (no nesting)
- Each subagent starts with fresh context (must gather what it needs)
- Subagents return text results to parent
- Parent must aggregate all results

### 2.2 Chunk-Processing Subagent Pattern

**Template for Single Chunk Analysis**:
```python
Task(
    subagent_type="general-purpose",
    model="haiku",
    prompt=f"""You are analyzing a chunk of a larger document.

DOCUMENT METADATA:
- Total length: {total_length:,} characters
- This chunk: characters {start}-{end}
- Chunk context: {section_name}

CHUNK CONTENT:
```
{chunk_text}
```

TASK: {specific_extraction_task}

OUTPUT FORMAT:
- Provide a structured list of findings
- Include character positions for each finding (relative to chunk start: {start})
- If no findings, return "NONE"

CRITICAL: Focus ONLY on this chunk. Do not make assumptions about content outside this region.
""",
    description=f"Extract {task_name} from chunk {chunk_id}"
)
```

**Parallel Chunk Pattern** (Multiple Tasks in one message):
```python
# In root Sonnet agent, spawn multiple haiku subagents simultaneously:

chunk_tasks = []
for i, (start, end, chunk) in enumerate(chunks):
    chunk_tasks.append(Task(
        subagent_type="general-purpose",
        model="haiku",
        prompt=build_chunk_prompt(chunk, start, end, extraction_query),
        description=f"Process chunk {i+1}/{len(chunks)}"
    ))

# Claude Code executes these in parallel, returns all results
# Root agent then synthesizes
```

### 2.3 Optimal Chunk Sizes for Haiku

**Haiku Context Window**: ~200K tokens (~800K characters with 4:1 compression)

**Recommended Chunk Sizes**:
| Chunk Size | Tokens (est) | Use Case | Haiku Utilization |
|-----------|--------------|----------|-------------------|
| 5K chars | ~1,250 | Small sections | 0.6% (underutilized) |
| 20K chars | ~5,000 | Subsections | 2.5% (good for speed) |
| 50K chars | ~12,500 | Full sections | 6.25% (sweet spot) |
| 100K chars | ~25,000 | Multiple sections | 12.5% (good balance) |
| 200K chars | ~50,000 | Large regions | 25% (max recommended) |

**Chunking Strategy**:
```python
def calculate_optimal_chunk_size(total_size, num_parallel_limit=10):
    """
    Balance between:
    - Chunk size (larger = fewer API calls, better Haiku utilization)
    - Parallelism (more chunks = faster if parallel)
    - Haiku capacity (don't exceed ~200K chars per chunk)
    """
    if total_size < 50000:
        return total_size  # Single chunk, no split

    # Aim for 50-100K per chunk
    target_chunk_size = 75000
    num_chunks = (total_size // target_chunk_size) + 1

    # Cap at parallel limit
    if num_chunks > num_parallel_limit:
        num_chunks = num_parallel_limit
        target_chunk_size = total_size // num_chunks

    return min(target_chunk_size, 200000)  # Never exceed Haiku limit
```

### 2.4 Parallel vs Sequential Subagent Spawning

**Parallel Spawning** (Preferred for independent chunks):
```python
# All in ONE root agent message:
Task(model="haiku", prompt=chunk_1_prompt, description="Chunk 1")
Task(model="haiku", prompt=chunk_2_prompt, description="Chunk 2")
Task(model="haiku", prompt=chunk_3_prompt, description="Chunk 3")
# ... up to N tasks
```

**Benefits**:
- Massive latency reduction (10x faster for 10 chunks)
- Cost-neutral (same tokens processed)
- Simple orchestration (Claude Code handles parallelism)

**Limitations**:
- Results return together (can't use chunk 1 result to inform chunk 2)
- Memory overhead (all results in parent context)
- Practical limit: ~10-20 parallel subagents (context window constraints)

**Sequential Spawning** (For dependent tasks):
```python
# Round 1: Locate relevant sections
result_1 = Task(model="haiku", prompt="Find all sections mentioning X")

# Round 2: Deep-dive into findings from Round 1
for section in parse_results(result_1):
    result_2 = Task(model="haiku", prompt=f"Analyze section {section}")
```

**Use When**:
- Later chunks depend on earlier findings
- Adaptive chunking (adjust based on intermediate results)
- Recursive exploration (narrow down progressively)

### 2.5 Practical Limits on Subagent Count

**Claude Code Constraints**:
- **Context window**: Sonnet has ~200K token context (all subagent results must fit)
- **API rate limits**: Parallel calls may hit rate limits (implementation-dependent)
- **Cognitive load**: >20 subagents makes synthesis complex for root model

**Recommended Limits**:
```python
MAX_PARALLEL_SUBAGENTS = {
    "conservative": 5,   # Safe for most use cases
    "standard": 10,      # Good balance
    "aggressive": 20,    # Max recommended
    "extreme": 50,       # Only for large context needs, risks synthesis quality
}
```

**Adaptive Parallelism**:
```python
def determine_parallelism(total_size, synthesis_complexity):
    base_parallel = min(total_size // 50000, 10)

    if synthesis_complexity == "simple":  # e.g., count, list
        return min(base_parallel * 2, 20)
    elif synthesis_complexity == "moderate":  # e.g., summarize each
        return base_parallel
    else:  # "complex" - e.g., find contradictions
        return max(base_parallel // 2, 3)
```

---

## 3. Data Flow Architecture

### 3.1 Input Distribution to Subagents

**Chunking Strategy Options**:

**A. Fixed-size chunks** (Simple, parallelizable):
```python
def chunk_fixed(content, chunk_size=75000):
    chunks = []
    for i in range(0, len(content), chunk_size):
        chunks.append({
            "id": len(chunks),
            "start": i,
            "end": min(i + chunk_size, len(content)),
            "text": content[i:i+chunk_size]
        })
    return chunks
```

**B. Semantic chunks** (Better quality, slower):
```python
def chunk_semantic(content):
    # Use Sonnet to identify section boundaries first
    sections = identify_sections(content)  # Sonnet task

    chunks = []
    for section in sections:
        chunks.append({
            "id": section.id,
            "start": section.start,
            "end": section.end,
            "text": content[section.start:section.end],
            "metadata": {"title": section.title, "type": section.type}
        })
    return chunks
```

**C. Overlap chunks** (For cross-boundary patterns):
```python
def chunk_overlap(content, chunk_size=75000, overlap=5000):
    chunks = []
    i = 0
    while i < len(content):
        end = min(i + chunk_size, len(content))
        chunks.append({
            "id": len(chunks),
            "start": i,
            "end": end,
            "text": content[max(0, i-overlap):end],  # Include overlap
            "overlap_start": i if i > 0 else None
        })
        i += (chunk_size - overlap)
    return chunks
```

**Distribution Pattern**:
```
Root Sonnet:
  1. Receive user query + document handle
  2. Choose chunking strategy based on query type
  3. Generate chunks with metadata
  4. Build Task calls for each chunk
  5. Spawn all Tasks in parallel (single message)
```

### 3.2 Subagent Results Flow Back to Root

**Result Structure** (Enforce via prompt):
```json
{
  "chunk_id": 3,
  "findings": [
    {"type": "benchmark", "name": "OOLONG", "position": 45230, "context": "..."},
    {"type": "benchmark", "name": "DeepResearch", "position": 67800, "context": "..."}
  ],
  "summary": "Found 2 benchmarks in this chunk",
  "confidence": "high",
  "needs_followup": false
}
```

**Aggregation in Root**:
```python
# After all haiku subagents return:
all_results = [result_1, result_2, ..., result_N]

# Root Sonnet synthesizes:
deduplicated = remove_duplicates(all_results)
sorted_findings = sort_by_position(deduplicated)
final_answer = synthesize_narrative(sorted_findings, original_query)
```

### 3.3 Intermediate Storage Patterns

**Option A: In-Context Only** (No files):
- **Pro**: Simple, no I/O
- **Con**: Limited by Sonnet context window (~200K tokens)
- **Use when**: < 10 chunks, simple results

**Option B: Scratchpad Files**:
```python
# Root writes intermediate results to files:
for i, result in enumerate(chunk_results):
    Write(
        file_path=f"/tmp/rlm-scratch/chunk_{i}_results.json",
        content=json.dumps(result)
    )

# Later synthesis step reads back:
all_results = []
for i in range(num_chunks):
    content = Read(f"/tmp/rlm-scratch/chunk_{i}_results.json")
    all_results.append(json.loads(content))
```

**Pro**: Scales beyond context limits
**Con**: Slower (I/O), requires cleanup
**Use when**: >10 chunks, complex results, or iterative refinement

**Option C: Accumulation Buffer** (Hybrid):
```python
# Keep rolling summary in context, details in files:
accumulation_buffer = {
    "total_findings": 0,
    "categories": {},
    "detail_files": []
}

for chunk_result in process_chunks():
    # Update summary in-context
    accumulation_buffer["total_findings"] += len(chunk_result.findings)
    accumulation_buffer["categories"][chunk_result.category] = \
        accumulation_buffer["categories"].get(chunk_result.category, 0) + 1

    # Write details to file
    detail_file = f"/tmp/rlm-scratch/chunk_{chunk_result.id}_detail.json"
    Write(detail_file, json.dumps(chunk_result))
    accumulation_buffer["detail_files"].append(detail_file)
```

**Use when**: Need to track progress across many chunks but keep context lean

### 3.4 Accumulation Buffer Across Iterations

**Pattern: Iterative Refinement**
```
Iteration 1: Broad search across all chunks
  → Accumulation buffer: {regions_of_interest: [3, 7, 12]}

Iteration 2: Deep-dive into regions of interest
  → Spawn haiku subagents ONLY for chunks 3, 7, 12
  → Accumulation buffer: {detailed_findings: [...]}

Iteration 3: Synthesis
  → Root Sonnet reads accumulation buffer
  → Generates final answer
```

**Buffer Management**:
```python
class AccumulationBuffer:
    def __init__(self):
        self.iterations = []
        self.current = {"findings": [], "metadata": {}}

    def add_chunk_result(self, chunk_id, result):
        self.current["findings"].append(result)
        self.current["metadata"][f"chunk_{chunk_id}"] = {
            "processed": True,
            "finding_count": len(result.get("findings", []))
        }

    def commit_iteration(self, iteration_type):
        self.iterations.append({
            "type": iteration_type,
            "findings": self.current["findings"],
            "metadata": self.current["metadata"]
        })
        # Keep summary, optionally clear details
        self.current = {
            "findings": [],
            "metadata": {"previous_iterations": len(self.iterations)}
        }

    def get_summary(self):
        return {
            "total_iterations": len(self.iterations),
            "total_findings": sum(len(it["findings"]) for it in self.iterations),
            "iteration_types": [it["type"] for it in self.iterations]
        }
```

---

## 4. Practical Claude Code Constraints

### 4.1 No Nested Subagents

**Constraint**: Subagents cannot spawn other subagents.

**Implication for RLM**:
- The RLM pattern in the paper uses **true recursion** (sub-agents can subcall)
- Claude Code requires **flattened recursion** (only root can spawn)

**Workaround: Iterative Pseudo-Recursion**:
```
Traditional RLM (nested):
  Root → Haiku-1 → Haiku-1a (not possible in Claude Code)
                 → Haiku-1b

Claude Code RLM (flattened):
  Round 1: Root → Haiku-1, Haiku-2, Haiku-3 (broad search)
  Round 2: Root analyzes results, decides next targets
  Round 3: Root → Haiku-1a, Haiku-1b, Haiku-2a (narrow search)
```

**Example**:
```python
# Round 1: Broad search
broad_results = [
    Task(model="haiku", prompt=f"Find X in region {i}", ...)
    for i in range(10)
]

# Root analyzes broad_results, identifies promising regions
promising = [r for r in broad_results if r.confidence > 0.7]

# Round 2: Focused deep-dive (simulates recursion)
deep_results = [
    Task(model="haiku", prompt=f"Deep analyze region {r.id}", ...)
    for r in promising
]
```

**Depth Limiting** (Safety):
```python
MAX_ITERATION_DEPTH = 3

for depth in range(MAX_ITERATION_DEPTH):
    results = spawn_subagents(current_targets)
    current_targets = refine_targets(results)
    if len(current_targets) == 0:
        break  # Converged
```

### 4.2 Context Window Limits

**Sonnet Context**: ~200K tokens input
**Haiku Context**: ~200K tokens input

**Impact on RLM**:
- **Haiku chunks**: Must stay under 200K tokens (~800K chars)
- **Root accumulation**: All subagent results must fit in Sonnet's context
- **Synthesis**: Root must read all results + produce answer within context

**Mitigation Strategies**:

**A. Chunked Synthesis**:
```python
# If total results exceed context, synthesize in stages:
def chunked_synthesis(all_results, chunk_size=10):
    summaries = []
    for i in range(0, len(all_results), chunk_size):
        chunk = all_results[i:i+chunk_size]
        summary = synthesize_chunk(chunk)  # Sonnet task
        summaries.append(summary)

    # Final synthesis of summaries
    return synthesize_final(summaries)
```

**B. Filtering Before Synthesis**:
```python
# Haiku subagents return structured data, root filters:
filtered_results = [
    r for r in all_results
    if r.get("relevance_score", 0) > 0.6
]
# Reduces context load for final synthesis
```

**C. Progressive Summarization**:
```python
# After each haiku result, immediately summarize:
rolling_summary = ""
for result in stream_haiku_results():
    rolling_summary = update_summary(rolling_summary, result)
    # Discard full result, keep only summary
```

### 4.3 Token Cost Implications

**Cost Model Comparison**:

**Sonnet-only approach** (baseline):
- Process 500K chars in single Sonnet call
- Input cost: ~125K tokens × $3/M = $0.375
- Output cost: ~1K tokens × $15/M = $0.015
- **Total: $0.39 per query**

**RLM approach** (10 Haiku chunks + Sonnet synthesis):
- Haiku processing: 10 × 50K chars = 500K chars
  - Input: 10 × 12.5K tokens × $0.25/M = $0.03125
  - Output: 10 × 200 tokens × $1.25/M = $0.0025
- Sonnet synthesis: 2K input (summaries) + 1K output
  - Input: 2K × $3/M = $0.006
  - Output: 1K × $15/M = $0.015
- **Total: $0.055 per query**

**Savings: 86%** (typical for RLM pattern)

**When RLM Costs More**:
- Very small inputs (< 20K chars): delegation overhead
- High synthesis complexity (requires re-reading full context)
- Many iterations (each round adds cost)

### 4.4 Latency Considerations

**Parallel Haiku Latency**:
- 10 parallel Haiku calls: ~same latency as 1 call (if truly parallel)
- Actual speedup depends on API backend (may have queuing)

**Sequential Sonnet Latency**:
- 1 large Sonnet call: ~30-60s for 500K chars
- RLM with synthesis: Haiku 10s + Sonnet synthesis 5s = ~15s
- **Speedup: 2-4x** (typical)

**Latency Budget**:
```python
LATENCY_TARGETS = {
    "interactive": 10,   # seconds, user waiting
    "background": 60,    # seconds, batch processing
    "research": 300,     # seconds, deep analysis
}

def estimate_rlm_latency(num_chunks, chunk_size, synthesis_complexity):
    haiku_time = 10  # Parallel, ~constant
    sonnet_synthesis_time = 5 + (synthesis_complexity * 2)
    return haiku_time + sonnet_synthesis_time
```

---

## 5. Error Handling & Resilience

### 5.1 Haiku Subagent Failure Modes

**Common Failures**:
1. **Timeout**: Haiku takes too long (rare, usually <10s)
2. **Malformed output**: Returns non-JSON when JSON expected
3. **Empty result**: Returns "NONE" or empty findings
4. **Hallucination**: Returns plausible but incorrect data
5. **Partial processing**: Runs out of context mid-chunk

**Detection**:
```python
def validate_haiku_result(result, chunk_id):
    errors = []

    # Check structure
    if not isinstance(result, dict):
        errors.append(f"Chunk {chunk_id}: Expected dict, got {type(result)}")

    # Check required fields
    required = ["chunk_id", "findings", "summary"]
    for field in required:
        if field not in result:
            errors.append(f"Chunk {chunk_id}: Missing field '{field}'")

    # Check plausibility
    if result.get("chunk_id") != chunk_id:
        errors.append(f"Chunk {chunk_id}: ID mismatch {result.get('chunk_id')}")

    # Check hallucination signals
    if len(result.get("findings", [])) > 100:
        errors.append(f"Chunk {chunk_id}: Suspiciously high finding count")

    return errors
```

### 5.2 Retry Strategies

**Retry Policy**:
```python
MAX_RETRIES = 2
RETRY_DELAY = 1  # seconds

def spawn_haiku_with_retry(prompt, chunk_id, max_retries=MAX_RETRIES):
    for attempt in range(max_retries + 1):
        try:
            result = Task(
                model="haiku",
                prompt=prompt,
                description=f"Process chunk {chunk_id} (attempt {attempt+1})"
            )

            # Validate
            errors = validate_haiku_result(result, chunk_id)
            if not errors:
                return result

            # Log errors, retry
            log(f"Chunk {chunk_id} attempt {attempt+1} failed: {errors}")

        except TimeoutError:
            log(f"Chunk {chunk_id} attempt {attempt+1} timed out")

        if attempt < max_retries:
            time.sleep(RETRY_DELAY * (attempt + 1))  # Exponential backoff

    # All retries exhausted
    return {
        "chunk_id": chunk_id,
        "error": "MAX_RETRIES_EXCEEDED",
        "findings": [],
        "summary": "Failed to process this chunk"
    }
```

### 5.3 Partial Result Handling

**Strategy: Proceed with Partial Data**
```python
def aggregate_with_partial_failures(results):
    successful = [r for r in results if "error" not in r]
    failed = [r for r in results if "error" in r]

    if len(failed) == 0:
        return aggregate_all(successful)

    if len(failed) > len(successful):
        # Too many failures, abort
        raise TooManyFailuresError(f"{len(failed)}/{len(results)} chunks failed")

    # Partial success: synthesize with caveats
    return {
        "findings": aggregate_all(successful),
        "caveats": f"Note: {len(failed)} chunks failed to process: {[f['chunk_id'] for f in failed]}",
        "completeness": len(successful) / len(results)
    }
```

**User-Facing Message**:
```
⚠️ Partial results (8/10 chunks processed successfully)

Failed chunks: 3, 7

I was able to analyze 80% of the document. Here's what I found:
[... results ...]

Would you like me to retry the failed chunks?
```

### 5.4 Graceful Degradation

**Fallback: Sonnet-Only Mode**
```python
def rlm_with_fallback(query, document):
    try:
        # Try RLM approach
        chunks = chunk_document(document)
        if len(chunks) <= 1:
            return sonnet_direct(query, document)  # Too small for RLM

        haiku_results = spawn_parallel_haikus(chunks)

        # Check failure rate
        failure_rate = count_failures(haiku_results) / len(haiku_results)
        if failure_rate > 0.3:
            log("High failure rate, falling back to Sonnet-only")
            return sonnet_direct(query, document)

        # Synthesize
        return sonnet_synthesize(haiku_results, query)

    except Exception as e:
        log(f"RLM failed: {e}, falling back to Sonnet-only")
        return sonnet_direct(query, document)
```

**Fallback Triggers**:
- >30% chunk failures
- Context window exceeded
- Synthesis quality too low
- User timeout exceeded

---

## 6. Prompt Engineering for Sub-Calls

### 6.1 Haiku Extraction Prompt Template

```python
EXTRACTION_TEMPLATE = """You are a specialized extraction agent processing a chunk of a larger document.

DOCUMENT CONTEXT:
- Document type: {doc_type}
- Total document size: {total_size:,} characters
- Your chunk: characters {start:,} to {end:,}
- Chunk section: {section_name}

CHUNK CONTENT:
```
{chunk_text}
```

EXTRACTION TASK:
{task_description}

OUTPUT REQUIREMENTS:
1. Return results in JSON format
2. Include absolute character positions (add {start} to relative positions)
3. Include confidence score (0.0-1.0) for each finding
4. If no findings, return {{"findings": [], "summary": "No matches found"}}

CRITICAL CONSTRAINTS:
- ONLY extract from the content shown above
- Do NOT make up information
- Do NOT reference content outside this chunk
- If a pattern spans chunk boundaries, note it in "boundary_issues"

OUTPUT FORMAT:
{{
  "chunk_id": {chunk_id},
  "findings": [
    {{
      "type": "...",
      "content": "...",
      "position": <absolute_char_position>,
      "confidence": 0.95,
      "context": "...surrounding text..."
    }}
  ],
  "summary": "Found X items of type Y",
  "boundary_issues": ["Pattern Z may continue beyond chunk"],
  "confidence": 0.9
}}
"""

def build_extraction_prompt(chunk, chunk_id, start, end, task):
    return EXTRACTION_TEMPLATE.format(
        doc_type="research paper",
        total_size=DOCUMENT_SIZE,
        start=start,
        end=end,
        section_name=chunk.get("section", "unknown"),
        chunk_text=chunk["text"],
        task_description=task,
        chunk_id=chunk_id
    )
```

### 6.2 Haiku Analysis Prompt Template

```python
ANALYSIS_TEMPLATE = """You are analyzing a specific section of a document for deeper insights.

DOCUMENT CONTEXT:
- Document: {doc_description}
- Section: {section_name} (chars {start:,}-{end:,})

SECTION CONTENT:
```
{chunk_text}
```

ANALYSIS QUESTION:
{analysis_question}

ANALYSIS FRAMEWORK:
1. Identify key claims or statements
2. Extract supporting evidence
3. Note any caveats or limitations mentioned
4. Assess confidence in findings

OUTPUT REQUIREMENTS:
Return JSON:
{{
  "chunk_id": {chunk_id},
  "key_claims": ["claim 1", "claim 2"],
  "evidence": [
    {{"claim": "claim 1", "evidence": "quote from text", "position": <char_pos>}}
  ],
  "caveats": ["caveat 1"],
  "confidence": 0.85,
  "summary": "2-3 sentence summary of findings"
}}

CRITICAL:
- Base analysis ONLY on the text provided
- Cite specific quotes with positions
- Distinguish between explicit statements and inferences
- If the section doesn't address the question, state that clearly
"""
```

### 6.3 Haiku Filtering Prompt Template

```python
FILTERING_TEMPLATE = """You are filtering a chunk of text for relevance to a specific query.

QUERY: {user_query}

CHUNK CONTENT (chars {start:,}-{end:,}):
```
{chunk_text}
```

FILTERING TASK:
1. Determine relevance of this chunk to the query (score 0.0-1.0)
2. If relevant, extract key passages
3. Explain relevance reasoning

OUTPUT FORMAT:
{{
  "chunk_id": {chunk_id},
  "relevance_score": 0.75,
  "is_relevant": true,
  "key_passages": [
    {{"text": "...", "position": <start_pos>, "reason": "why relevant"}}
  ],
  "reasoning": "This chunk discusses X which relates to query because Y",
  "action": "INCLUDE" // or "SKIP"
}}

SCORING GUIDE:
- 0.0-0.3: Not relevant, recommend SKIP
- 0.3-0.6: Possibly relevant, include if space permits
- 0.6-1.0: Highly relevant, must INCLUDE

CRITICAL:
- Be conservative: false negatives okay, false positives costly
- Consider indirect relevance (context that supports understanding)
- If unsure, err on side of inclusion (score 0.5)
"""
```

### 6.4 Self-Contained Prompts (No Implicit Context)

**Anti-Pattern** (Implicit context):
```python
# BAD: Assumes subagent knows about previous findings
Task(model="haiku", prompt="Now analyze the next section")
```

**Correct Pattern** (Self-contained):
```python
# GOOD: Every subagent gets full context it needs
Task(
    model="haiku",
    prompt=f"""You are processing chunk 3 of 10 in a document analysis task.

OVERALL TASK: {original_user_query}

PREVIOUS FINDINGS SUMMARY:
- Chunks 1-2 found: {summary_of_prior_chunks}

YOUR CHUNK (3/10):
{chunk_3_text}

YOUR SPECIFIC TASK:
Continue the analysis, looking for {specific_pattern}.
Output format: {output_format}
"""
)
```

**Checklist for Self-Contained Prompts**:
- [ ] Subagent knows the overall goal
- [ ] Subagent knows its specific task
- [ ] Subagent has all data it needs (no references to "parent context")
- [ ] Output format is explicitly specified
- [ ] Constraints are clear (what to do if no findings, etc.)

---

## 7. Synthesis Pattern

### 7.1 Aggregating Results from Multiple Haiku Calls

**Aggregation Strategies**:

**A. Simple Concatenation** (For lists):
```python
def aggregate_list_findings(results):
    all_findings = []
    for result in results:
        all_findings.extend(result.get("findings", []))

    # Deduplicate by position
    seen_positions = set()
    unique_findings = []
    for finding in all_findings:
        pos = finding.get("position")
        if pos not in seen_positions:
            unique_findings.append(finding)
            seen_positions.add(pos)

    # Sort by position
    return sorted(unique_findings, key=lambda f: f.get("position", 0))
```

**B. Weighted Aggregation** (For scores):
```python
def aggregate_scores(results):
    total_weight = sum(r.get("chunk_size", 1) for r in results)
    weighted_sum = sum(
        r.get("score", 0) * r.get("chunk_size", 1)
        for r in results
    )
    return weighted_sum / total_weight if total_weight > 0 else 0
```

**C. Hierarchical Summary** (For narratives):
```python
def aggregate_narratives(results):
    # Group by section
    by_section = {}
    for result in results:
        section = result.get("section_name", "unknown")
        if section not in by_section:
            by_section[section] = []
        by_section[section].append(result.get("summary", ""))

    # Build hierarchical structure
    return {
        section: "\n".join(summaries)
        for section, summaries in by_section.items()
    }
```

### 7.2 When to Use Sonnet for Final Synthesis

**Use Sonnet Synthesis When**:
- Results are complex and require reasoning to integrate
- Contradictions or inconsistencies need resolution
- Narrative structure needed (not just a list)
- User query requires interpretation of findings
- Quality bar is high (user-facing final answer)

**Synthesis Prompt Template**:
```python
SYNTHESIS_TEMPLATE = """You are synthesizing results from multiple sub-analyses into a final answer.

ORIGINAL USER QUERY:
{user_query}

DOCUMENT ANALYZED:
- Type: {doc_type}
- Size: {doc_size:,} characters
- Chunks processed: {num_chunks}

SUB-ANALYSIS RESULTS:
{formatted_results}

SYNTHESIS TASK:
1. Integrate findings from all chunks
2. Resolve any contradictions or overlaps
3. Organize into coherent narrative
4. Provide comprehensive answer to user query
5. Cite specific positions in document for key claims

OUTPUT FORMAT:
## Answer

[Comprehensive answer to user query]

## Key Findings

1. [Finding 1] (see chars X-Y)
2. [Finding 2] (see chars A-B)

## Methodology Note

Analyzed {num_chunks} sections totaling {doc_size:,} characters using parallel chunk processing.

QUALITY STANDARDS:
- Accurate: Every claim must be grounded in sub-analysis results
- Complete: Address all aspects of user query
- Coherent: Organize findings into logical structure
- Cited: Reference specific document positions
- Honest: Acknowledge gaps or uncertainties
"""
```

### 7.3 Inline Aggregation vs Sonnet Synthesis

**Inline Aggregation** (No LLM for synthesis):
```python
# Fast, deterministic, cheap
def inline_aggregate(results, query_type):
    if query_type == "count":
        return sum(r["count"] for r in results)
    elif query_type == "list":
        return deduplicate_and_sort([f for r in results for f in r["findings"]])
    elif query_type == "max":
        return max(results, key=lambda r: r["score"])
```

**Sonnet Synthesis** (LLM-based):
```python
# Slower, flexible, expensive
def sonnet_synthesize(results, query):
    return Task(
        model="sonnet",
        prompt=build_synthesis_prompt(results, query),
        description="Synthesize final answer"
    )
```

**Decision Matrix**:
| Query Type | Inline | Sonnet | Reasoning |
|-----------|--------|--------|-----------|
| Count occurrences | ✅ | ❌ | Simple sum |
| List all X | ✅ | ❌ | Dedupe + sort |
| Summarize Y | ❌ | ✅ | Requires interpretation |
| Compare A vs B | ❌ | ✅ | Requires reasoning |
| Find contradictions | ❌ | ✅ | Complex logic |
| Extract facts | ✅ | Maybe | Inline if structured, Sonnet if needs cleaning |

### 7.4 Output Quality Assurance

**Quality Metrics**:
```python
def assess_synthesis_quality(synthesis_result, original_chunks):
    metrics = {}

    # Completeness: Does it address all chunks?
    chunks_cited = count_citations(synthesis_result)
    metrics["completeness"] = chunks_cited / len(original_chunks)

    # Accuracy: Are citations valid?
    invalid_citations = validate_citations(synthesis_result, original_chunks)
    metrics["citation_accuracy"] = 1 - (len(invalid_citations) / max(chunks_cited, 1))

    # Coherence: Is it readable?
    metrics["coherence"] = assess_coherence(synthesis_result.text)  # LLM-based or heuristic

    # Coverage: Does it answer the query?
    metrics["query_coverage"] = assess_query_coverage(synthesis_result, original_query)

    return metrics
```

**Quality Thresholds**:
```python
QUALITY_THRESHOLDS = {
    "completeness": 0.8,      # Must cite 80%+ of chunks
    "citation_accuracy": 0.95, # 95%+ valid citations
    "coherence": 0.7,          # Subjective but trackable
    "query_coverage": 0.9,     # 90%+ query answered
}

def passes_quality_bar(metrics):
    return all(
        metrics.get(k, 0) >= v
        for k, v in QUALITY_THRESHOLDS.items()
    )
```

**Fallback on Quality Failure**:
```python
if not passes_quality_bar(synthesis_metrics):
    # Option 1: Retry synthesis with stronger prompt
    synthesis_v2 = sonnet_synthesize_v2(results, query, previous_attempt=synthesis_result)

    # Option 2: Fall back to simpler inline aggregation
    if not passes_quality_bar(assess_quality(synthesis_v2)):
        return inline_aggregate(results, query_type="list")  # Simple but reliable
```

---

## 8. Implementation Roadmap

### 8.1 Phase 1: Basic RLM Skill (MVP)

**Scope**: Single-round parallel Haiku processing with Sonnet synthesis

**Components**:
1. **Chunking function**: Fixed-size chunks (50K chars)
2. **Haiku extraction prompt**: Template-based
3. **Parallel Task spawning**: Up to 10 Haikus
4. **Inline aggregation**: Simple list concatenation
5. **Sonnet synthesis**: Basic narrative generation

**Success Criteria**:
- Handles documents up to 500K characters
- Cost reduction: >70% vs Sonnet-only
- Latency: <30s for typical queries
- Quality: Comparable to Sonnet-only baseline

**Deliverables**:
- `/skills/rlm/SKILL.md` (skill definition)
- `/skills/rlm/prompts/haiku_extract.md` (template)
- `/skills/rlm/prompts/sonnet_synthesize.md` (template)
- `/skills/rlm/examples/basic_usage.md` (documentation)

### 8.2 Phase 2: Adaptive Chunking

**Scope**: Semantic chunking and overlap handling

**Components**:
1. **Section detection**: Sonnet pre-pass to identify structure
2. **Semantic chunking**: Chunk on section boundaries
3. **Overlap handling**: 10% overlap for cross-boundary patterns
4. **Boundary reconciliation**: Deduplicate findings at chunk edges

**Success Criteria**:
- Better quality for structured documents (papers, reports)
- <10% finding loss at chunk boundaries
- Minimal latency increase (<20%)

### 8.3 Phase 3: Iterative Refinement

**Scope**: Multi-round RLM with progressive narrowing

**Components**:
1. **Broad search round**: Low-precision, high-recall
2. **Filtering**: Identify high-relevance chunks
3. **Deep-dive round**: High-precision on filtered chunks
4. **Accumulation buffer**: Track findings across rounds

**Success Criteria**:
- Handles documents up to 2M characters
- Quality improvement: +15% over single-round
- Cost: <50% increase (still cheaper than Sonnet-only)

### 8.4 Phase 4: Advanced Features

**Scope**: Error handling, quality assurance, scratchpad storage

**Components**:
1. **Retry logic**: Automatic retry on Haiku failures
2. **Quality metrics**: Track synthesis quality
3. **Scratchpad files**: Support >10 chunk results
4. **Graceful degradation**: Fallback to Sonnet-only

**Success Criteria**:
- 95%+ success rate on challenging documents
- Quality metrics tracked and reported
- Handles edge cases gracefully

### 8.5 Testing Strategy

**Test Levels**:

**Unit Tests**:
- Chunking algorithms (fixed, semantic, overlap)
- Aggregation functions (list, score, narrative)
- Validation functions (result structure, citations)

**Integration Tests**:
- Single Haiku call → validate result
- Parallel Haikus → aggregate correctly
- Sonnet synthesis → quality check

**End-to-End Tests**:
- Full RLM flow on sample documents
- Cost/latency benchmarks
- Quality comparison vs Sonnet baseline

**Test Data**:
- Small doc (10K chars) - edge case for RLM
- Medium doc (100K chars) - sweet spot
- Large doc (500K chars) - stress test
- Huge doc (2M chars) - extreme case

**Quality Baselines**:
| Document | Sonnet-Only Quality | RLM Target Quality | Cost Reduction Target |
|----------|-------------------|-------------------|---------------------|
| Small | 0.90 | 0.85 (acceptable degradation) | N/A (use Sonnet) |
| Medium | 0.92 | 0.90 | 70%+ |
| Large | 0.88 | 0.85 | 80%+ |
| Huge | 0.70 (struggles) | 0.80 (better than baseline!) | 85%+ |

---

## Appendix A: Code Examples

### A.1 Basic RLM Flow

```python
def rlm_analyze(query: str, document: str) -> str:
    """
    Basic RLM pattern: chunk → parallel Haiku → Sonnet synthesis
    """
    # Step 1: Chunk the document
    chunks = chunk_fixed(document, chunk_size=50000)

    if len(chunks) <= 1:
        # Too small for RLM, use Sonnet directly
        return Task(
            model="sonnet",
            prompt=f"Analyze this document:\n{document}\n\nQuery: {query}",
            description="Direct Sonnet analysis"
        )

    # Step 2: Spawn parallel Haiku extractors
    haiku_results = []
    for i, chunk in enumerate(chunks):
        result = Task(
            model="haiku",
            prompt=build_extraction_prompt(chunk, i, query),
            description=f"Extract from chunk {i+1}/{len(chunks)}"
        )
        haiku_results.append(result)

    # Step 3: Validate results
    valid_results = [r for r in haiku_results if validate_result(r)]

    # Step 4: Synthesize with Sonnet
    synthesis = Task(
        model="sonnet",
        prompt=build_synthesis_prompt(valid_results, query),
        description="Synthesize final answer"
    )

    return synthesis
```

### A.2 Iterative Refinement Flow

```python
def rlm_iterative(query: str, document: str, max_rounds: int = 3) -> str:
    """
    Multi-round RLM: broad search → filter → deep dive
    """
    chunks = chunk_fixed(document, chunk_size=75000)

    # Round 1: Broad search (all chunks, low detail)
    broad_results = []
    for i, chunk in enumerate(chunks):
        result = Task(
            model="haiku",
            prompt=f"Quick scan for relevance to: {query}\n\nChunk {i}:\n{chunk['text']}",
            description=f"Broad search chunk {i}"
        )
        broad_results.append(result)

    # Filter for high-relevance chunks
    relevant_chunks = [
        chunks[i] for i, r in enumerate(broad_results)
        if r.get("relevance_score", 0) > 0.6
    ]

    if len(relevant_chunks) == 0:
        return "No relevant content found in document"

    # Round 2: Deep dive (only relevant chunks, high detail)
    deep_results = []
    for chunk in relevant_chunks:
        result = Task(
            model="haiku",
            prompt=build_deep_analysis_prompt(chunk, query),
            description=f"Deep analysis chunk {chunk['id']}"
        )
        deep_results.append(result)

    # Round 3: Synthesis
    return Task(
        model="sonnet",
        prompt=build_synthesis_prompt(deep_results, query),
        description="Final synthesis"
    )
```

---

## Appendix B: Comparison to Paper Implementation

| Aspect | Paper (LangGraph) | Claude Code (Task Tool) | Adaptation Needed |
|--------|------------------|------------------------|-------------------|
| Recursion | True nested calls | Flattened iterations | Yes - use rounds |
| Subagent spawn | `subcall()` tool | `Task()` invocations | Rename, similar |
| Model choice | `gpt-5-mini` | `haiku` | Direct mapping |
| REPL execution | Python `exec()` | Not needed (Task handles) | Remove REPL layer |
| State management | LangGraph state | Claude context | Context-based |
| Parallelism | LangGraph handles | Claude Code handles | No change |
| Tools (peek/grep) | Custom Python | Use Claude tools (Read, Grep) | Replace with native |
| Context storage | In graph state | In-context or files | Add file option |

**Key Takeaway**: The RLM **pattern** translates cleanly to Claude Code, but the **implementation** must use Task tool instead of true recursion. Quality should be comparable, cost savings similar.

---

## Appendix C: References

1. **RLM Paper**: "Recursive Language Models" - https://alexzhang13.github.io/blog/2025/rlm/
2. **Claude Code Agent Builder**: `.claude/agents/agent-builder.md`
3. **Reflection Skill** (multi-agent patterns): `.claude/skills/reflection/SKILL.md`
4. **RLM Notebook Examples**: `/examples/agents/RLM.ipynb`
5. **Orchestra AGENTS.md**: Project coding guidelines and stack info

---

**END OF EXPERT ANALYSIS**
