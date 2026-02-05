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

## Error Handling

Handle failures at each level with graceful degradation.

### Single Subagent Failure

If one worker Task fails (timeout, empty output, malformed result):

1. **Retry once** with the same prompt and chunk.
2. If retry succeeds, use the result normally.
3. If retry fails, mark the chunk as skipped and continue with remaining results.

### Multiple Failures (>30% of chunks)

If more than 30% of worker Tasks fail:

1. **Fall back to Sonnet-only processing**: Abandon the parallel Haiku approach.
2. Process the input directly with Sonnet, using a single pass or sequential reads.
3. Accept reduced coverage over unreliable parallel results.

### All Failures

If every worker Task fails:

1. **Process the entire input directly** with Sonnet without chunking.
2. Read the input in sequential passes if it exceeds context.
3. Produce the best output possible from direct processing.

### Partial Results

When some chunks succeed and others fail (but failure rate <= 30%):

1. **Produce output from successful chunks**, noting gaps.
2. Include a completeness percentage in the output metadata.
3. State which areas were not analyzed and why.

Example output note:
```
Note: Analysis covers 7 of 10 chunks (70% completeness).
Chunks 3, 7, 9 could not be processed. Areas not covered: [list].
```

### Graceful Degradation Ladder

When problems occur, degrade through these levels in order:

| Level | Condition | Action |
|-------|-----------|--------|
| **Full RLM** | All workers succeed | Normal workflow: decompose, parallel process, synthesize |
| **Partial RLM** | Some workers fail (<= 30%) | Synthesize from successful chunks, note gaps |
| **Sonnet Fallback** | Many workers fail (> 30%) | Abandon chunking, process directly with Sonnet |
| **Best-Effort** | All workers fail or Sonnet fallback also struggles | Produce whatever output is possible, clearly state limitations |

Always inform the user which degradation level was reached and why.

## When NOT to Use RLM

Do NOT invoke the RLM pattern for:

- **Small inputs (< 500 lines)**: Direct processing is faster and simpler. The overhead of decomposition and synthesis exceeds the benefit.
- **Single file analysis**: If the task involves one file that fits in context, process it directly.
- **Simple queries**: Questions like "what does function X do?" or "fix this bug" do not need parallel decomposition.
- **Already-structured data**: If the user provides a clear, bounded dataset (a single JSON file, a specific API response), process it directly.
- **Time-sensitive tasks**: If the user needs an immediate answer, RLM adds latency from decomposition and synthesis. Use direct processing for speed.

## Examples

### Example 1: Comprehensive Codebase Security Review

**User request**: "Review the entire backend codebase for security vulnerabilities."

**Phase 1: Decomposition (Sonnet supervisor)**

Assess: 150 Python files, ~25,000 lines. Exceeds thresholds. Use RLM.

Strategy: Structural Decomposition (group by module).

Work plan:
```
Chunk 1: auth/ (12 files) - Focus: authentication security, session management
Chunk 2: database/ (18 files) - Focus: SQL injection, query safety
Chunk 3: api/ (45 files) - Focus: input validation, error handling
Chunk 4: services/ (50 files) - Focus: business logic, OWASP Top 10
Chunk 5: utils/ (25 files) - Focus: dependency security, utility safety
```

**Phase 2: Processing (5 parallel Haiku workers)**

Spawn 5 Task tool calls in a single message:

```
Task(
  subagent_type: "general-purpose",
  model: "haiku",
  description: "Process chunk 1 of 5: auth module security review",
  prompt: "You are processing chunk 1 of 5 in a codebase security review.

ORIGINAL QUERY: Review backend for security vulnerabilities.

YOUR CHUNK: auth/ module - files: login.py, session.py, middleware.py, jwt.py, ...

TASK: Analyze for authentication vulnerabilities: weak crypto, hardcoded secrets,
insecure session storage, JWT implementation issues.

OUTPUT FORMAT:
- List each finding with severity (Critical/High/Medium/Low)
- Include file name and line number
- Confidence score (0-1) per finding

CONSTRAINT: Focus ONLY on this chunk. Do NOT reference external content."
)
```

(Repeat for chunks 2-5 with module-specific focus.)

**Phase 3: Synthesis (Sonnet supervisor)**

```markdown
# Backend Security Review

## Summary
Analysis of 150 files (25K lines) identified 47 security issues across 5 modules.
3 critical issues require immediate attention. Most common finding: missing input
validation (8 occurrences across modules).

## Key Findings
1. SQL injection in database/query_builder.py:45 - Critical - (Chunk 2)
2. Hardcoded API key in utils/config.py:12 - Critical - (Chunk 5)
3. Missing auth on admin endpoints in api/admin_routes.py - Critical - (Chunk 3)

## Cross-Chunk Patterns
- Input validation missing in 4 of 5 modules
- Inconsistent error handling across all modules
- Vulnerable dependency in utils/ used by auth/ and services/

## Recommendations
1. Immediate: Fix 3 critical issues
2. Short-term: Add input validation middleware
3. Long-term: Standardize error handling

## Analysis Metadata
- Input: 150 files, 25,000 lines
- Strategy: Structural Decomposition (by module)
- Chunks processed: 5
- Iterations: 1
- Confidence: 88/100
```

### Example 2: Long Document Analysis

**User request**: "Summarize this 80-page research paper and extract key findings."

**Phase 1: Decomposition (Sonnet supervisor)**

Assess: Single document, ~45,000 words, ~15,000 lines. Exceeds thresholds. Use RLM.

Strategy: Structural Decomposition (split by section headings).

Work plan:
```
Chunk 1: Abstract + Introduction (pages 1-8) - Focus: research question, methodology overview
Chunk 2: Literature Review (pages 9-20) - Focus: prior work, identified gaps
Chunk 3: Methodology (pages 21-35) - Focus: research design, methods used
Chunk 4: Results (pages 36-55) - Focus: key findings, data highlights
Chunk 5: Discussion (pages 56-70) - Focus: interpretation, implications
Chunk 6: Conclusion (pages 71-80) - Focus: contributions, future work
```

**Phase 2: Processing (6 parallel Haiku workers)**

```
Task(
  subagent_type: "general-purpose",
  model: "haiku",
  description: "Process chunk 4 of 6: extract results findings",
  prompt: "You are processing chunk 4 of 6 in a research paper analysis.

ORIGINAL QUERY: Summarize paper and extract key findings.

YOUR CHUNK: Results section (pages 36-55)
[section content here]

TASK: Extract key findings, statistical results, and data highlights.
List each finding with supporting evidence from the text.

OUTPUT FORMAT:
- Finding: [description]
- Evidence: [quote or data point]
- Confidence: [0-1]

CONSTRAINT: Focus ONLY on this chunk. Do NOT reference external content."
)
```

**Phase 3: Synthesis (Sonnet supervisor)**

```markdown
# Research Paper Summary: [Title]

## Summary
This study investigates [research question]. Using [methodology], the authors found
[primary result] with implications for [field impact]. The work builds on identified
gaps in [prior work area] and contributes a novel approach to [contribution].

## Key Findings
1. [Primary finding from Results chunk] - supported by [evidence]
2. [Secondary finding] - statistical significance p < 0.01
3. [Methodological innovation from Methodology chunk]

## Cross-Chunk Patterns
- Research question (Chunk 1) directly answered by findings (Chunk 4)
- Limitations (Chunk 6) qualify the strength of results (Chunk 4)
- Prior work gaps (Chunk 2) addressed by methodology (Chunk 3)

## Recommendations
- Follow-up reading: [key citations from literature review]
- Future research directions identified in Conclusion

## Analysis Metadata
- Input: 80 pages, ~45,000 words
- Strategy: Structural Decomposition (by section)
- Chunks processed: 6
- Iterations: 1
- Confidence: 92/100
```

### Example 3: Multi-File Question Answering

**User request**: "How does the authentication flow work from login to database? Trace the full path."

**Phase 1: Decomposition (Sonnet supervisor)**

Assess: Question spans 30+ files across frontend, API, backend, and database layers. Use RLM.

Strategy: Structural Decomposition (split by application layer).

Work plan:
```
Chunk 1: Frontend layer (5 files) - Focus: LoginForm, auth state, API call construction
Chunk 2: API layer (8 files) - Focus: auth routes, middleware, request validation
Chunk 3: Backend layer (12 files) - Focus: auth service, credential verification, token generation
Chunk 4: Database layer (10 files) - Focus: user model, queries, password storage
```

**Phase 2: Processing (4 parallel Haiku workers)**

```
Task(
  subagent_type: "general-purpose",
  model: "haiku",
  description: "Process chunk 1 of 4: trace frontend auth flow",
  prompt: "You are processing chunk 1 of 4 in an authentication flow trace.

ORIGINAL QUERY: Trace the authentication flow from login to database.

YOUR CHUNK: Frontend layer files.
Read these files: frontend/src/components/LoginForm.tsx,
frontend/src/store/authSlice.ts, frontend/src/api/auth.ts

TASK: Trace the authentication flow in the frontend layer:
1. What triggers the login? (button click, form submit)
2. What validation happens client-side?
3. What API call is made? (endpoint, method, payload)
4. Include file names and line numbers.

OUTPUT FORMAT:
- Step: [description]
- File: [filename:line]
- Code: [relevant snippet]
- Next: [what happens next / what data passes to next layer]

CONSTRAINT: Focus ONLY on this chunk. Do NOT reference external content."
)
```

**Phase 3: Synthesis (Sonnet supervisor)**

```markdown
# Authentication Flow: Login to Database

## Summary
The auth flow spans 4 layers across 35 files. User submits credentials via
LoginForm.tsx, which dispatches to the API via authSlice. The API validates
the request through middleware, the backend verifies credentials with bcrypt,
and the database stores password hashes with the user model.

## End-to-End Trace

### 1. Frontend (LoginForm.tsx)
- User clicks "Login" button (LoginForm.tsx:45)
- Client-side email validation (LoginForm.tsx:38)
- Redux action: authSlice.login() dispatched (authSlice.ts:52)
- API call: POST /api/auth/login with {email, password} (auth.ts:15)

### 2. API Layer (auth_routes.py)
- Request received at /api/auth/login (auth_routes.py:23)
- CSRF validation middleware (middleware/security.py:15)
- Rate limiting: 5 requests/minute (middleware/rate_limit.py:8)
- Passes to backend: auth_service.authenticate()

### 3. Backend (auth_service.py)
- Credentials sanitized (auth_service.py:67)
- User lookup: user_service.get_by_email() (auth_service.py:72)
- Password verify: bcrypt.verify() (auth_service.py:78)
- JWT token generated (crypto/jwt.py:34)

### 4. Database (user_model.py)
- Query: SELECT id, email, password_hash FROM users WHERE email = ?
- Password stored as bcrypt hash (cost factor 12)

## Cross-Chunk Patterns
- CSRF protection at API layer guards frontend requests
- Rate limiting prevents brute force from frontend
- bcrypt used consistently (backend stores, database persists)

## Analysis Metadata
- Input: 35 files across 4 application layers
- Strategy: Structural Decomposition (by layer)
- Chunks processed: 4
- Iterations: 1
- Confidence: 90/100
```
