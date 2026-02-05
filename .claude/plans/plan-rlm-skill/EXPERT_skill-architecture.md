# Expert Analysis: RLM Skill Architecture

## Executive Summary

The RLM (Recursive Language Model) skill implements a supervisor-worker pattern where a root model (Sonnet) decomposes large tasks into manageable chunks, spawns sub-models (Haiku) to process each chunk via the Task tool, then synthesizes results. This architecture optimally handles inputs too large for single-pass processing (massive codebases, lengthy documents, complex multi-file analysis).

**Target Size**: 2,500-3,500 words (well under the 5,000 word limit)
**Complexity Level**: High (similar to reflection skill)
**Primary Pattern**: Supervisor-first decomposition with parallel worker execution

---

## 1. SKILL.md Structure

### Recommended Sections

```markdown
---
name: rlm
description: |
  Recursive Language Model pattern for processing large inputs that exceed single-pass context.
  Decomposes complex tasks (analyzing massive codebases, reviewing lengthy documents,
  answering questions requiring multi-file synthesis) into chunks, processes them in parallel
  via sub-agents, then synthesizes results. Use when: analyzing 50+ files, reviewing 10,000+
  line documents, or when told "this is too large to process at once."
  Triggers: process large codebase, analyze entire repository, review massive document,
  comprehensive analysis, recursive processing.
---

# Recursive Language Model (RLM)

Handle inputs too large for single-pass processing by decomposing tasks, spawning parallel
sub-agents, and synthesizing results.

## Core Concept

[2-3 paragraphs explaining the supervisor-worker pattern]

## Prerequisites

[List requirements: Task tool access, scratchpad directory, model selection capability]

## Workflow

### Phase 1: Decomposition (Supervisor)
[Analyze input, determine chunking strategy, create work plan]

### Phase 2: Parallel Processing (Workers)
[Spawn Haiku sub-agents via Task tool, process chunks independently]

### Phase 3: Synthesis (Supervisor)
[Aggregate worker results, identify patterns, produce final output]

## Instructions

### Step 1: Assess Task Complexity
[When to use RLM vs standard processing]

### Step 2: Decompose the Problem
[How to chunk effectively - by file, by topic, by question]

### Step 3: Spawn Worker Sub-Agents
[Task tool invocation patterns, passing context]

### Step 4: Monitor and Aggregate
[Collecting results, handling failures]

### Step 5: Synthesize Final Output
[Pattern detection, consolidation, presentation]

## Chunking Strategies

[File-based, topic-based, question-based, time-based strategies]

## Examples

### Example 1: Comprehensive Codebase Review
[Complete walkthrough: 200 files → chunk into 10 groups → spawn 10 workers → synthesize]

### Example 2: Long Document Analysis
[Research paper: 100 pages → chunk by section → extract insights → combine]

### Example 3: Multi-File Question Answering
[Question requiring 30+ files → identify relevant files → parallel analysis → answer]

## Guidelines

### Decomposition Best Practices
[How to chunk effectively, avoiding over/under-splitting]

### Worker Coordination
[Managing parallel execution, handling dependencies]

### Synthesis Quality
[Avoiding information loss, pattern recognition]

### Performance Optimization
[When to parallelize vs serialize, optimal chunk sizes]

## Quality Standards

[What good RLM output looks like]

## Important Notes

### When NOT to Use RLM
[Small tasks, already-structured data, simple queries]

### Model Selection
[Sonnet for supervisor, Haiku for workers - why]

### Scratchpad Management
[Intermediate results, cleanup]
```

### Degrees of Freedom Assessment

| Section | DoF Level | Rationale |
|---------|-----------|-----------|
| **Decomposition Strategy** | High | Must adapt to task type - codebase vs document vs Q&A all require different chunking |
| **Chunking Decisions** | High | Size, boundaries, overlap depend on input characteristics |
| **Worker Invocation** | Medium | Task tool syntax is fixed, but prompt design for workers varies |
| **Synthesis Approach** | High | Pattern detection and consolidation require judgment |
| **When to Use RLM** | Medium | Clear rules for task size thresholds, but edge cases exist |
| **Model Selection** | Low | Sonnet (supervisor) and Haiku (workers) is the standard pattern |
| **Parallel vs Serial** | Medium | Usually parallel, but dependencies force sequential processing |
| **Output Format** | Medium | Varies by task type but should follow consistent structure |

**Overall Degrees of Freedom**: **Medium-High** - The skill provides structured workflow (decompose → process → synthesize) with low DoF, but the specific implementation of each phase requires significant judgment based on task characteristics.

### Estimated Size

- **Frontmatter**: 150 words
- **Core Concept**: 250 words
- **Prerequisites**: 100 words
- **Workflow Overview**: 400 words
- **Detailed Instructions**: 800 words
- **Chunking Strategies**: 400 words
- **Examples (3 scenarios)**: 600 words
- **Guidelines**: 500 words
- **Quality Standards**: 150 words
- **Important Notes**: 150 words

**Total Estimated**: ~3,500 words (70% of 5,000 word limit)

This leaves room for expansion without hitting the constraint, while remaining comprehensive.

---

## 2. Skill Directory Layout

### Recommended Structure

```
.claude/skills/rlm/
├── SKILL.md                          # Main skill definition (~3,500 words)
├── references/
│   ├── rlm-algorithm.md              # Formal RLM algorithm reference
│   ├── chunking-strategies.md        # Deep dive on decomposition patterns
│   └── synthesis-patterns.md         # Pattern recognition and consolidation techniques
├── scripts/
│   └── estimate-chunks.sh            # Helper to estimate task size and chunk count
└── assets/
    ├── template-worker-prompt.md     # Template for worker sub-agent prompts
    ├── template-synthesis-report.md  # Template for final output structure
    └── flowchart-rlm.txt             # ASCII flowchart of RLM workflow
```

### Rationale for Each Component

**SKILL.md**
- Primary skill definition following Orchestra pattern
- Covers 80% of use cases
- References external files for deep dives

**references/rlm-algorithm.md**
- Formal description of the RLM pattern
- Theory and research background
- When/why it works better than single-pass
- Mathematical considerations (chunk size optimization)
- NOT read by Claude every time - consulted when needed

**references/chunking-strategies.md**
- Detailed guide to decomposition approaches
- File-based: Group by directory, module, or dependencies
- Topic-based: Chunk by semantic sections (for documents)
- Question-based: Decompose complex questions into sub-questions
- Hybrid strategies for complex tasks
- Trade-offs and decision trees

**references/synthesis-patterns.md**
- How to aggregate results without losing information
- Pattern detection across chunks
- Handling contradictions
- Weighting and prioritization
- Examples of good vs poor synthesis

**scripts/estimate-chunks.sh**
- Bash script to analyze input size
- Estimates: file count, line count, token count
- Suggests chunk size and parallelization factor
- Helps decide if RLM is needed
```bash
#!/bin/bash
# Usage: estimate-chunks.sh <directory|file>
# Output: Recommended chunk count and strategy
```

**assets/template-worker-prompt.md**
- Reusable template for Task tool invocations
- Ensures consistent worker prompts
- Variables: `{chunk_description}`, `{analysis_focus}`, `{output_format}`
```markdown
Analyze the following files: {chunk_description}

Focus on: {analysis_focus}

Output format:
{output_format}

Context: You are one of N workers processing a larger task. Your output will be
synthesized with others, so be concise but complete.
```

**assets/template-synthesis-report.md**
- Template for final output structure
- Ensures consistency across RLM invocations
```markdown
# RLM Analysis: {task_name}

## Summary
[2-3 sentence overview]

## Key Findings
[Aggregated insights from all workers]

## Patterns Identified
[Cross-chunk patterns and themes]

## Detailed Results
[Section for each worker's contribution]

## Recommendations
[Action items based on analysis]
```

**assets/flowchart-rlm.txt**
- ASCII diagram of the RLM workflow
- Visual reference for understanding the pattern
```
┌─────────────────┐
│  Input: Large   │
│  Task/Dataset   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  Phase 1: Decomposition │ (Sonnet Supervisor)
│  - Analyze input        │
│  - Determine chunks     │
│  - Create work plan     │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Phase 2: Processing    │ (Haiku Workers)
│  ┌───┐ ┌───┐ ┌───┐     │
│  │W1 │ │W2 │ │W3 │ ... │ (Parallel)
│  └─┬─┘ └─┬─┘ └─┬─┘     │
└────┼─────┼─────┼────────┘
     │     │     │
     ▼     ▼     ▼
┌─────────────────────────┐
│  Phase 3: Synthesis     │ (Sonnet Supervisor)
│  - Aggregate results    │
│  - Identify patterns    │
│  - Produce final output │
└────────┬────────────────┘
         │
         ▼
   ┌──────────┐
   │  Output  │
   └──────────┘
```

---

## 3. Instruction Design

### Main Workflow Steps (Imperative Form)

The instruction section uses **imperative, action-oriented language** with **medium degrees of freedom** - providing structure while allowing adaptation.

```markdown
## Instructions

### Step 1: Assess Task Complexity

Determine if RLM processing is necessary:

1. **Check input size**:
   - File count > 50: Consider RLM
   - Total lines > 10,000: Consider RLM
   - Single file > 5,000 lines: Consider RLM
   - Estimated tokens > 100k: Definitely use RLM

2. **Evaluate task type**:
   - Comprehensive codebase review: RLM appropriate
   - Single-file focused task: Standard processing sufficient
   - Cross-file analysis required: RLM appropriate

3. **Announce decision**: Tell the user "This task exceeds single-pass capacity.
   Using RLM pattern to decompose, process in parallel, and synthesize."

### Step 2: Decompose the Problem

Create an explicit decomposition plan:

1. **Analyze input structure**:
   - For codebases: Map directory structure, identify modules
   - For documents: Parse sections, chapters, or topics
   - For questions: Break down into sub-questions

2. **Determine chunking strategy**:
   - File-based: Group 5-10 related files per chunk
   - Topic-based: One chunk per major section/theme
   - Question-based: One chunk per sub-question
   (See references/chunking-strategies.md for detailed guidance)

3. **Create work plan**:
   ```
   Chunk 1: Files A, B, C - Focus: Authentication logic
   Chunk 2: Files D, E, F - Focus: Database interactions
   Chunk 3: Files G, H, I - Focus: API endpoints
   ...
   ```

4. **Save work plan** to scratchpad: `scratchpad/rlm-work-plan.md`

### Step 3: Spawn Worker Sub-Agents

Execute parallel processing:

1. **Prepare worker prompts**:
   - Use assets/template-worker-prompt.md as base
   - Fill in: chunk description, analysis focus, output format
   - Keep prompts under 500 tokens for efficiency

2. **Invoke Task tool for each chunk**:
   ```
   Task: Analyze [chunk description]. Focus on [specific aspect].
   Output format: [structured format]. Context: You are 1 of N workers.
   Model: haiku (for speed and cost efficiency)
   Output file: scratchpad/rlm-chunk-{N}.md
   ```

3. **Execute in parallel**:
   - Spawn all workers in single message if no dependencies
   - Use sequential spawning only if chunks depend on each other

4. **Track worker completion**:
   - Wait for all TaskOutput results
   - Note any failures for retry

### Step 4: Monitor and Aggregate

Collect worker results:

1. **Read all worker outputs**:
   - Read scratchpad/rlm-chunk-1.md
   - Read scratchpad/rlm-chunk-2.md
   - ... (all chunks)

2. **Validate completeness**:
   - Ensure each worker addressed its assigned focus
   - Check for any empty or error outputs
   - Retry failed chunks if needed

3. **Prepare for synthesis**:
   - Have all worker outputs available in context
   - Review work plan to recall overall task goal

### Step 5: Synthesize Final Output

Produce comprehensive final result:

1. **Aggregate findings**:
   - Extract key insights from each worker
   - Identify redundant information across chunks
   - Note conflicting information for resolution

2. **Identify cross-chunk patterns**:
   - Common themes across multiple workers
   - Architectural patterns that span chunks
   - Issues that appear repeatedly

3. **Structure final output**:
   - Use assets/template-synthesis-report.md as framework
   - Summary: High-level overview (2-3 sentences)
   - Key Findings: Top 5-10 insights
   - Patterns: Cross-chunk themes
   - Detailed Results: Per-chunk contributions
   - Recommendations: Actionable next steps

4. **Present to user**:
   - Clear, comprehensive report
   - Reference specific files/sections
   - Highlight most important findings first

5. **Clean up scratchpad** (optional):
   - Remove intermediate worker outputs if no longer needed
   - Keep work plan for reference
```

### Decompose → Process → Synthesize Loop

The three-phase structure is **rigid** (low DoF) to ensure consistency:

**Phase 1 (Decompose)** - ALWAYS happens first
- Supervisor (Sonnet) analyzes input
- Creates explicit work plan
- Determines chunk boundaries
- NO processing happens yet

**Phase 2 (Process)** - ALWAYS uses Task tool
- Workers (Haiku) execute in parallel
- Each worker gets clear, focused prompt
- Results saved to scratchpad
- NO synthesis happens yet

**Phase 3 (Synthesize)** - ALWAYS happens last
- Supervisor (Sonnet) reads all worker outputs
- Identifies patterns and themes
- Produces unified final output
- Presents to user

**Critical**: These phases are **sequential** (Phase 2 depends on Phase 1, Phase 3 depends on Phase 2), but **workers within Phase 2** execute in **parallel**.

### What the Skill Specifies (Low DoF)

1. **Three-phase structure**: Decompose → Process → Synthesize (mandatory)
2. **Model selection**: Sonnet for supervisor, Haiku for workers (mandatory)
3. **Tool usage**: Task tool for worker spawning (mandatory)
4. **Scratchpad usage**: Intermediate results must be saved (mandatory)
5. **Work plan creation**: Must create explicit plan before processing (mandatory)

### What the Skill Leaves Flexible (High DoF)

1. **Chunking boundaries**: Adapt to input structure
2. **Number of workers**: Depends on task size
3. **Worker prompt design**: Tailored to analysis type
4. **Synthesis approach**: Varies by task goals
5. **Output format**: Matches user's needs
6. **When to use RLM**: Judgment call for borderline cases

---

## 4. Example Scenarios

### Example 1: Processing a Large Codebase for Comprehensive Review

**Scenario**: User asks "Review the entire backend codebase for security issues and architectural problems."

**Task Characteristics**:
- 150 Python files
- ~25,000 lines of code
- Multiple modules: auth, database, API, utils
- Too large for single-pass analysis

**Execution**:

**Phase 1: Decomposition**
```
Supervisor (Sonnet) analysis:
- Input: 150 files, 25k lines → Definitely use RLM
- Structure: 5 main modules (auth, database, api, services, utils)
- Strategy: Module-based chunking (file-based within modules)

Work Plan:
Chunk 1: auth/ (12 files) - Focus: Authentication security, session management
Chunk 2: database/ (18 files) - Focus: SQL injection, query optimization
Chunk 3: api/ (45 files) - Focus: Input validation, error handling
Chunk 4: services/ (50 files) - Focus: Business logic, OWASP Top 10
Chunk 5: utils/ (25 files) - Focus: Utility security, dependencies

Estimated processing time: 5 workers × 2 min = 10 minutes total
```

**Phase 2: Parallel Processing**
```
Spawn 5 workers (Haiku) via Task tool:

Worker 1 Prompt:
"Analyze auth/ module files [list]. Focus on: authentication security,
session management, password handling, JWT implementation. Look for:
weak crypto, hardcoded secrets, insecure session storage. Output format:
Markdown with severity ratings (Critical/High/Medium/Low) for each finding."

[Similar prompts for Workers 2-5]

All workers execute in parallel. Results saved to:
- scratchpad/rlm-chunk-1-auth.md
- scratchpad/rlm-chunk-2-database.md
- scratchpad/rlm-chunk-3-api.md
- scratchpad/rlm-chunk-4-services.md
- scratchpad/rlm-chunk-5-utils.md
```

**Phase 3: Synthesis**
```
Supervisor (Sonnet) reads all 5 worker outputs:

Aggregation:
- Total findings: 47 issues (3 Critical, 12 High, 20 Medium, 12 Low)
- Most common: Input validation missing (8 occurrences across chunks)
- Critical issues: SQL injection in database/, hardcoded API key in utils/

Cross-chunk patterns:
- Pattern 1: Inconsistent error handling across all modules
- Pattern 2: No rate limiting on API endpoints (chunk 3) affects auth (chunk 1)
- Pattern 3: Utils/ (chunk 5) has insecure dependencies used by all modules

Final Output:
# Comprehensive Codebase Security Review

## Executive Summary
Analysis of 150 files (25k lines) identified 47 security and architectural
issues. 3 critical issues require immediate attention. Systemic problems
include inconsistent error handling and missing input validation across modules.

## Critical Issues (Immediate Action Required)
1. **SQL Injection in database/query_builder.py** - Lines 45-67 use string
   concatenation for queries. Affects all database operations.
2. **Hardcoded API Key in utils/config.py** - Line 12 exposes production
   credentials. Rotate immediately.
3. **Missing Authentication on Admin Endpoints** - api/admin_routes.py has
   no @requires_auth decorator on 5 sensitive endpoints.

## High Priority Issues (12 items)
[Details from worker outputs]

## Architectural Patterns Identified
- **Inconsistent Error Handling**: Each module uses different patterns
  (exceptions vs status codes vs logging). Recommend standardization.
- **Circular Dependencies**: services/ and database/ modules import each other,
  creating tight coupling.
- **Missing Rate Limiting**: API endpoints vulnerable to abuse.

## Recommendations
1. Immediate: Fix 3 critical issues within 24 hours
2. Short-term: Implement input validation middleware (addresses 8 findings)
3. Long-term: Refactor error handling for consistency
4. Dependency: Update 3 vulnerable packages in utils/requirements.txt

## Detailed Findings by Module
[Section for each chunk with specific findings]
```

**Outcome**: User gets comprehensive, actionable review that would be impossible in single-pass.

---

### Example 2: Analyzing a Long Document/Research Paper

**Scenario**: User asks "Summarize this 80-page research paper and extract key insights."

**Task Characteristics**:
- Single PDF file, 80 pages
- ~45,000 words
- Structured: Abstract, Intro, 5 chapters, Conclusion
- Too long for single read

**Execution**:

**Phase 1: Decomposition**
```
Supervisor analysis:
- Input: 80 pages, 45k words → Use RLM
- Structure: 8 major sections (Abstract, Intro, Ch1-5, Conclusion)
- Strategy: Section-based chunking

Work Plan:
Chunk 1: Abstract + Introduction (pages 1-8) - Focus: Research question, methodology
Chunk 2: Chapter 1 - Literature Review (pages 9-20) - Focus: Prior work, gaps
Chunk 3: Chapter 2 - Methodology (pages 21-32) - Focus: Research design, methods
Chunk 4: Chapter 3 - Results (pages 33-50) - Focus: Findings, data
Chunk 5: Chapter 4 - Discussion (pages 51-65) - Focus: Interpretation, implications
Chunk 6: Chapter 5 - Limitations (pages 66-72) - Focus: Constraints, future work
Chunk 7: Conclusion (pages 73-80) - Focus: Summary, contributions
```

**Phase 2: Parallel Processing**
```
Spawn 7 workers:

Worker 1 Prompt:
"Read pages 1-8 (Abstract + Introduction). Extract: (1) Research question,
(2) Hypothesis, (3) Methodology overview, (4) Key terms. Format as bulleted list."

[Similar prompts for Workers 2-7]

Workers execute in parallel, reading assigned page ranges.
```

**Phase 3: Synthesis**
```
Supervisor synthesizes:

Final Output:
# Research Paper Summary: [Title]

## Overview
This study investigates [research question from Worker 1]. Using [methodology
from Worker 3], the authors found [key results from Worker 4] with implications
for [impact from Worker 5].

## Key Insights
1. **Novel Finding**: [From Worker 4] - First study to demonstrate X
2. **Methodological Innovation**: [From Worker 3] - New approach to Y
3. **Theoretical Contribution**: [From Worker 5] - Challenges existing Z theory

## Research Question
[From Worker 1]

## Methodology
[From Worker 3]

## Major Findings
[From Worker 4, cross-referenced with Worker 5's discussion]

## Limitations
[From Worker 6]

## Future Research Directions
[From Workers 5 & 6]

## Citations to Follow Up
[Extracted from Worker 2's literature review]
```

---

### Example 3: Answering Complex Question Requiring Multi-File Analysis

**Scenario**: User asks "How does the authentication flow work across our entire application? Trace from login to database."

**Task Characteristics**:
- Question spans 30+ files
- Requires tracing execution flow
- Frontend → API → Backend → Database
- Complex multi-tier analysis

**Execution**:

**Phase 1: Decomposition**
```
Supervisor analysis:
- Input: Question requires analysis across frontend, API, backend, database layers
- Relevant files: Identified 35 files via initial grep
- Strategy: Question decomposition + layer-based chunking

Work Plan:
Chunk 1: How does the frontend login form work? (5 files: LoginForm.tsx, authSlice.ts, api.ts)
Chunk 2: How does the API receive and validate login requests? (8 files: auth_routes.py, middleware/)
Chunk 3: How does the backend verify credentials? (12 files: auth_service.py, user_service.py, crypto/)
Chunk 4: How does the database store and query user data? (10 files: user_model.py, migrations/, queries/)
```

**Phase 2: Parallel Processing**
```
Spawn 4 workers:

Worker 1 Prompt:
"Trace authentication flow in frontend files: LoginForm.tsx, authSlice.ts, api.ts.
Document: (1) User interaction (button click), (2) Form validation, (3) API call
construction, (4) Data sent to backend. Include code snippets."

[Similar prompts for Workers 2-4]
```

**Phase 3: Synthesis**
```
Supervisor connects the dots:

Final Output:
# Authentication Flow: Login to Database

## Complete Flow Diagram
```
User enters credentials → Frontend validates → API endpoint receives →
Backend verifies → Database queries → Session created → Token returned
```

## Step-by-Step Trace

### 1. Frontend (LoginForm.tsx)
[From Worker 1]
- User clicks "Login" button (line 45)
- Form validation checks email format (line 38)
- Redux action dispatched: `authSlice.login()` (line 52)
- API call constructed: POST /api/auth/login with {email, password}

### 2. API Layer (auth_routes.py)
[From Worker 2]
- Request received at `/api/auth/login` endpoint (line 23)
- Middleware validates: CSRF token (middleware/security.py line 15)
- Rate limiting applied: 5 requests per minute (middleware/rate_limit.py line 8)
- Request passed to backend: `auth_service.authenticate()`

### 3. Backend (auth_service.py)
[From Worker 3]
- Credentials received and sanitized (line 67)
- User lookup: `user_service.get_by_email()` calls database (line 72)
- Password verification: bcrypt.verify() with stored hash (line 78)
- If valid: Generate JWT token (crypto/jwt.py line 34)
- Session creation: Store in Redis with 1-hour TTL (line 89)

### 4. Database (user_model.py)
[From Worker 4]
- Query: SELECT id, email, password_hash FROM users WHERE email = ?
- Defined in: user_model.py line 45, executed via SQLAlchemy
- Password stored as: bcrypt hash (cost factor 12)
- Migration created field: migrations/2024_01_15_add_password_hash.py

## Security Observations
- ✓ Passwords hashed with bcrypt (Backend - Worker 3)
- ✓ CSRF protection enabled (API - Worker 2)
- ✓ Rate limiting prevents brute force (API - Worker 2)
- ✗ No 2FA implemented (all layers)
- ✗ Password reset flow not traced (out of scope)

## Key Files Referenced
[Complete list with line numbers from all workers]
```

**Outcome**: User gets complete end-to-end trace that no single analysis could provide.

---

## 5. Integration Points

### How This Skill Works with the Task Tool

**Task Tool Role**: Spawns sub-agent workers to process individual chunks.

**Integration Pattern**:

```markdown
## Task Tool Usage in RLM

The RLM skill uses the Task tool to spawn Haiku sub-agents for parallel chunk processing.

### Invocation Pattern

**For each chunk in the work plan**:

```
Task: [Focused prompt for this chunk]
Model: haiku (faster, cheaper for worker tasks)
Output: scratchpad/rlm-chunk-{N}.md
Context: You are processing chunk {N} of {TOTAL}. Focus only on your assigned scope.
```

**Example Task Invocation**:
```
Task: Analyze authentication module files: auth/login.py, auth/session.py, auth/middleware.py.
Identify security vulnerabilities related to: password handling, session management,
token generation. Output format: Markdown list with severity ratings.
Model: haiku
Output: scratchpad/rlm-chunk-1-auth.md
```

### Parallel Execution

Spawn all workers in a **single message** if chunks are independent:

```
[Invoke Task tool: Chunk 1]
[Invoke Task tool: Chunk 2]
[Invoke Task tool: Chunk 3]
[Invoke Task tool: Chunk 4]
[Invoke Task tool: Chunk 5]
```

All workers execute concurrently. Wait for all TaskOutput results before proceeding to synthesis.

### Sequential Execution (Rare)

Use sequential spawning only if chunks have dependencies:

```
[Invoke Task tool: Chunk 1 - Analyze API contracts]
[Wait for completion]
[Invoke Task tool: Chunk 2 - Analyze implementations that depend on Chunk 1 contracts]
```

### Worker Prompt Guidelines

Keep worker prompts:
- **Focused**: One clear task per worker
- **Concise**: Under 500 tokens
- **Structured**: Explicit output format
- **Context-aware**: Tell worker they're part of larger task
- **Self-contained**: Worker shouldn't need supervisor's full context

### Error Handling

If a worker Task fails:
```
1. Check TaskOutput for error message
2. Identify cause: timeout, invalid input, crash
3. Retry with adjusted prompt or smaller chunk
4. If retry fails: Continue with other chunks, note gap in synthesis
```

### TaskOutput Collection

After all workers complete:
```
1. Read each TaskOutput result
2. Check for completion: Look for expected output file in scratchpad
3. Validate content: Ensure worker addressed assigned focus
4. Prepare for synthesis: Have all outputs loaded in context
```

---

### How This Skill Specifies Model Selection

**Explicit Model Roles**:

**Sonnet (Supervisor)**:
- **When**: Phases 1 (Decomposition) and 3 (Synthesis)
- **Why**: Requires high-level reasoning, strategic planning, pattern recognition
- **Cost**: Higher per token, but processes less overall (only work plan + synthesis)
- **Tasks**: Analyzing input structure, creating work plans, aggregating results, identifying patterns

**Haiku (Workers)**:
- **When**: Phase 2 (Parallel Processing)
- **Why**: Focused, narrow tasks that don't require deep reasoning
- **Cost**: Lower per token, but processes more overall (all chunks)
- **Tasks**: Analyzing specific files, extracting information, identifying issues in narrow scope

**Model Selection Rule**:

```markdown
## Model Selection in RLM

**Supervisor = Sonnet**
- Complex reasoning required
- Strategic decision-making
- Cross-chunk pattern recognition
- Final synthesis and presentation

**Workers = Haiku**
- Focused, well-defined tasks
- Narrow scope analysis
- Extraction and summarization
- Repetitive processing
```

**Cost Optimization**:

```
Example task: 150 files, 25k lines

Single-pass with Sonnet:
- Input: ~150k tokens
- Output: ~5k tokens
- Cost: High (all tokens at Sonnet rate)

RLM with Sonnet + Haiku:
- Sonnet (supervisor): ~2k input (work plan) + ~10k input (synthesis) + ~5k output = ~17k tokens
- Haiku (5 workers): ~30k input per worker × 5 = ~150k tokens, ~2k output per worker × 5 = ~10k tokens
- Cost: Lower overall (most tokens at Haiku rate)
- Speed: Faster (parallel execution)
```

**Specification in SKILL.md**:

```markdown
## Model Selection

This skill requires model specification for optimal performance:

**Phase 1 & 3 (Supervisor)**: Use Sonnet
- Invoke this skill as primary agent (Sonnet by default)
- Decomposition and synthesis require advanced reasoning

**Phase 2 (Workers)**: Use Haiku
- Explicitly specify in Task tool invocation: `Model: haiku`
- Workers perform focused analysis that doesn't need Sonnet's capabilities
- Parallel execution with Haiku reduces cost and increases speed

**Example**:
```
Task: Analyze files X, Y, Z for security issues. Output to scratchpad/chunk-1.md
Model: haiku
```

**Never**:
- Don't use Haiku for supervisor tasks (decomposition/synthesis)
- Don't use Sonnet for all workers (unnecessarily expensive)
```

---

### How It Handles the Scratchpad Directory

**Scratchpad Purpose**: Store intermediate worker results before final synthesis.

**Directory Structure**:

```
scratchpad/
├── rlm-work-plan.md              # Decomposition plan (Phase 1)
├── rlm-chunk-1.md                # Worker 1 output (Phase 2)
├── rlm-chunk-2.md                # Worker 2 output (Phase 2)
├── rlm-chunk-3.md                # Worker 3 output (Phase 2)
├── ...
└── rlm-final-output.md           # Synthesis result (Phase 3) [optional]
```

**File Naming Convention**:

```markdown
## Scratchpad File Naming

Follow this pattern for consistency:

**Work Plan**: `scratchpad/rlm-work-plan.md`
- Created in Phase 1
- Contains decomposition plan
- Referenced throughout execution

**Worker Outputs**: `scratchpad/rlm-chunk-{N}-{description}.md`
- `{N}`: Chunk number (1, 2, 3, ...)
- `{description}`: Brief descriptor (auth, database, api, etc.)
- Example: `scratchpad/rlm-chunk-1-auth.md`

**Final Output** (optional): `scratchpad/rlm-final-output.md`
- Created in Phase 3
- Contains synthesis report
- Usually presented directly to user instead of saving
```

**Scratchpad Workflow**:

```markdown
## Scratchpad Management

### Phase 1: Decomposition
1. Create work plan
2. Save to `scratchpad/rlm-work-plan.md`
3. Example:
   ```markdown
   # RLM Work Plan

   Task: Comprehensive security review
   Date: 2026-02-05

   ## Chunks
   - Chunk 1: auth/ (12 files) - Focus: authentication security
   - Chunk 2: database/ (18 files) - Focus: SQL injection
   ...
   ```

### Phase 2: Processing
1. Each worker Task specifies output file
2. Task tool writes results to scratchpad automatically
3. Example Task invocation:
   ```
   Task: Analyze auth module for security issues
   Model: haiku
   Output: scratchpad/rlm-chunk-1-auth.md
   ```

### Phase 3: Synthesis
1. Read all worker outputs from scratchpad:
   - Read scratchpad/rlm-chunk-1-auth.md
   - Read scratchpad/rlm-chunk-2-database.md
   - ... (all chunks)
2. Aggregate and synthesize
3. Present final output to user
4. Optionally save synthesis to scratchpad for reference

### Cleanup
After synthesis, optionally clean up intermediate files:
```bash
rm scratchpad/rlm-chunk-*.md
```
Keep `rlm-work-plan.md` for audit trail.
```

**Error Handling**:

```markdown
## Scratchpad Error Handling

**Missing worker output**:
```
If scratchpad/rlm-chunk-3.md doesn't exist:
1. Check if worker Task failed
2. Check TaskOutput for errors
3. Retry worker if possible
4. If retry fails: Note gap in synthesis, proceed with available data
```

**Corrupt worker output**:
```
If worker output is empty or malformed:
1. Check TaskOutput for errors
2. Re-read file to confirm corruption
3. Retry worker with clearer prompt
4. If retry fails: Exclude chunk from synthesis, note limitation
```

**Scratchpad full**:
```
If scratchpad/ contains many files from previous RLM runs:
1. Create subdirectory: scratchpad/rlm-{timestamp}/
2. Save all outputs to subdirectory
3. Keeps scratchpad organized for multi-run sessions
```
```

**Persistence**:

```markdown
## Scratchpad Persistence

**Within Session**:
- Scratchpad files persist throughout conversation
- Subsequent RLM invocations can reference previous results
- Useful for iterative refinement

**Between Sessions**:
- Scratchpad typically cleared between sessions
- If persistence needed: Save important outputs outside scratchpad
- Work plan can be recreated from conversation history if needed

**Collaboration**:
- Other skills can read RLM scratchpad outputs
- Example: Reflection skill could analyze RLM patterns
- Use clear naming to indicate RLM ownership
```

---

## 6. Quality Standards

### What the Output Should Look Like

**Comprehensive Yet Concise**:
- Summary: 2-3 sentences capturing essence
- Key Findings: Top 5-10 insights (not everything)
- Patterns: Cross-chunk themes that wouldn't be visible in single-pass
- Detail: Available but organized for optional deep-dive

**Actionable**:
- Clear recommendations based on findings
- Prioritized by impact/urgency
- Specific file/line references when relevant
- Next steps explicitly stated

**Well-Structured**:
- Hierarchical organization (Executive Summary → Details)
- Consistent formatting across RLM invocations
- Easy to skim (bullets, headers, emphasis)
- Visual elements where helpful (ASCII diagrams, tables)

**Accurate**:
- No hallucinations (all findings traceable to worker outputs)
- No information loss (critical insights preserved from workers)
- Contradictions resolved or explicitly noted
- Uncertainty acknowledged when present

**Example of Good Output**:

```markdown
# Comprehensive Security Review: Backend Codebase

## Executive Summary
Analysis of 150 files identified 47 security issues (3 Critical, 12 High, 20 Medium,
12 Low). Immediate action required on SQL injection vulnerability affecting all
database operations. Systemic issues include missing input validation and
inconsistent error handling across modules.

## Critical Issues (Immediate Action)
1. **SQL Injection in database/query_builder.py [HIGH PRIORITY]**
   - Lines 45-67 use string concatenation
   - Affects: All database operations (auth, user management, content)
   - Fix: Migrate to parameterized queries
   - Reference: Worker 2 (database chunk), lines 23-45 in output

2. **Hardcoded API Key in utils/config.py [HIGH PRIORITY]**
   - Line 12 exposes production credentials
   - Action: Rotate immediately, move to environment variables
   - Reference: Worker 5 (utils chunk), finding #1

3. **Missing Authentication on Admin Endpoints [HIGH PRIORITY]**
   - api/admin_routes.py has 5 unprotected endpoints
   - Exposure: User deletion, data export, config changes
   - Fix: Add @requires_auth decorator
   - Reference: Worker 3 (API chunk), section 2.3

## Patterns Identified (Cross-Chunk Analysis)
- **Input Validation Gap**: 8 occurrences across all modules (Workers 1-5 all noted)
  - Recommendation: Implement centralized validation middleware
- **Inconsistent Error Handling**: Each module uses different patterns
  - Recommendation: Standardize on exception-based approach with logging
- **Circular Dependencies**: services/ ↔ database/ tight coupling
  - Recommendation: Introduce abstraction layer

## Recommendations by Priority

**Immediate (This Week)**:
- [ ] Fix 3 critical issues above
- [ ] Rotate exposed API key
- [ ] Add authentication to admin endpoints

**Short-term (This Month)**:
- [ ] Implement input validation middleware (addresses 8 findings)
- [ ] Standardize error handling
- [ ] Update vulnerable dependencies (3 packages in utils/)

**Long-term (This Quarter)**:
- [ ] Refactor circular dependencies
- [ ] Add comprehensive test coverage for auth flows
- [ ] Implement rate limiting across all API endpoints

## Detailed Findings by Module
[Expandable sections for each worker's detailed output]

<details>
<summary>Auth Module (Worker 1) - 8 findings</summary>

[Full worker output]
</details>

<details>
<summary>Database Module (Worker 2) - 12 findings</summary>

[Full worker output]
</details>

...

## Methodology
- Tool: RLM pattern (Recursive Language Model)
- Chunks: 5 (by module)
- Workers: 5 Haiku sub-agents
- Synthesis: Sonnet supervisor
- Duration: 10 minutes total
```

**Example of Poor Output** (What to Avoid):

```markdown
# Security Review

I found some issues.

**Problems**:
- SQL injection somewhere
- Some API keys
- Missing auth

**Recommendation**:
- Fix the issues

[No structure, no specifics, no priorities, no file references]
```

---

### How to Validate Results

**Validation Checklist**:

```markdown
## RLM Output Validation

Before presenting results to user, verify:

### Completeness
- [ ] All chunks processed (check against work plan)
- [ ] No missing worker outputs
- [ ] All questions from original task addressed
- [ ] Key findings from each worker represented in synthesis

### Accuracy
- [ ] All findings traceable to specific worker outputs
- [ ] File/line references verified
- [ ] No hallucinated information
- [ ] Contradictions resolved or explicitly noted

### Quality
- [ ] Summary is concise (2-3 sentences)
- [ ] Findings prioritized by impact
- [ ] Recommendations are actionable
- [ ] Structure is clear and scannable

### Cross-Chunk Analysis
- [ ] Patterns identified across multiple workers
- [ ] Redundancies eliminated
- [ ] Connections made between related findings
- [ ] Holistic insights that couldn't come from single chunk

### Presentation
- [ ] Consistent formatting
- [ ] Code references with line numbers
- [ ] Visual elements (tables, diagrams) where helpful
- [ ] Optional deep-dive details available but not overwhelming
```

**Self-Check Questions**:

```markdown
## Synthesis Self-Check

Ask yourself before presenting results:

1. **Completeness**: "If the user read only my summary, would they understand
   the most important findings?"

2. **Actionability**: "Can the user immediately act on my recommendations, or
   do they need to ask clarifying questions?"

3. **Traceability**: "Can I point to specific worker outputs for every claim
   I'm making?"

4. **Value-Add**: "Did the RLM approach reveal insights that single-pass
   analysis would have missed?"

5. **Clarity**: "Is my output organized such that the user can skim for high-level
   info or dive deep as needed?"

If any answer is "No", revise synthesis before presenting.
```

---

### Error Handling Patterns

**Worker Failure**:

```markdown
## Handling Worker Failures

**Scenario**: Worker 3 Task fails or produces empty output.

**Response**:
1. **Detect**: Check TaskOutput, verify scratchpad file
2. **Diagnose**:
   - Timeout? → Chunk too large, split further
   - Invalid prompt? → Revise and retry
   - Context error? → Provide more background
3. **Retry**: Invoke Task again with adjusted parameters
4. **Fallback**: If retry fails, proceed with gap:
   ```
   Note in synthesis:
   "Chunk 3 (API module) could not be processed due to [reason].
   Analysis is incomplete for this module. Recommend manual review."
   ```
5. **Communicate**: Tell user about gap and its impact
```

**Incomplete Decomposition**:

```markdown
## Handling Incomplete Decomposition

**Scenario**: After workers complete, realize some files weren't covered.

**Response**:
1. **Detect**: Compare work plan to original input
2. **Assess Impact**: Are missing files critical?
3. **Options**:
   - **High Impact**: Spawn additional worker for missing chunk
   - **Low Impact**: Note limitation in output
4. **Prevent**: In Phase 1, verify work plan covers all inputs before spawning workers
```

**Synthesis Overload**:

```markdown
## Handling Synthesis Overload

**Scenario**: Worker outputs total 50k tokens, too much for supervisor to synthesize at once.

**Response**:
1. **Detect**: Estimate total token count from worker outputs
2. **Adjust Strategy**:
   - **Option 1**: Read worker outputs in batches, synthesize incrementally
   - **Option 2**: Ask workers for more concise outputs (re-run with stricter limits)
   - **Option 3**: Hierarchical synthesis (group workers, synthesize groups first,
     then synthesize group summaries)
3. **Communicate**: Tell user synthesis is complex, may take longer
```

**Contradictory Findings**:

```markdown
## Handling Contradictions

**Scenario**: Worker 2 says "No security issues in auth module" but Worker 4
says "Database queries from auth module vulnerable to SQL injection."

**Response**:
1. **Detect**: Compare findings across workers during synthesis
2. **Investigate**: Re-read relevant worker outputs
3. **Resolve**:
   - If one is clearly wrong: Correct in synthesis, note discrepancy
   - If both partially right: Present both perspectives, explain context
   - If unclear: Explicitly state contradiction, recommend manual review
4. **Example Output**:
   ```
   Note: Conflicting findings on auth module security. Worker 2 found no
   direct issues in auth code, but Worker 4 identified SQL injection risk
   in database layer called by auth. Both are accurate in their scope.
   Recommendation: Address database layer vulnerability (affects auth and other modules).
   ```
```

**User Interruption**:

```markdown
## Handling Interruptions

**Scenario**: User interrupts during Phase 2 (workers still running).

**Response**:
1. **Checkpoint**: Save current state (which workers completed, which pending)
2. **Options**:
   - **Resume**: Wait for pending workers to complete, then continue
   - **Partial Results**: Synthesize only completed workers, note incomplete analysis
   - **Cancel**: Abort remaining workers, provide partial results
3. **Communicate**: Ask user preference
   ```
   "RLM processing in progress. 3 of 5 workers completed. Options:
   (1) Wait for remaining workers (~2 min) for complete analysis
   (2) Synthesize partial results now (3 chunks only)
   (3) Cancel and provide what we have so far
   Which would you prefer?"
   ```
```

---

## Summary

The RLM skill architecture is designed to handle large-scale analysis tasks through a structured three-phase approach:

1. **Decompose** (Supervisor/Sonnet): Analyze input, create work plan
2. **Process** (Workers/Haiku): Execute focused analysis in parallel
3. **Synthesize** (Supervisor/Sonnet): Aggregate results, identify patterns

**Key Design Principles**:
- **Structured workflow** with low degrees of freedom (three-phase pattern is rigid)
- **Flexible adaptation** with high degrees of freedom (chunking, prompts, synthesis vary by task)
- **Model optimization** (expensive Sonnet for reasoning, cheap Haiku for processing)
- **Parallel execution** (workers run concurrently for speed)
- **Quality output** (comprehensive yet actionable, traceable to sources)

**Target Size**: ~3,500 words in SKILL.md (70% of limit), with deep-dive content in references/

**Directory Structure**: Minimal subdirectories (references/, scripts/, assets/), supporting material doesn't bloat main skill file

**Integration**: Clean Task tool usage pattern, explicit model selection, organized scratchpad management

This architecture provides a robust foundation for implementing recursive language model patterns in the Orchestra project, enabling Claude to handle analysis tasks that would otherwise exceed single-pass capabilities.
