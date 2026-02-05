# RLM Prompt Templates

Reusable prompt templates for spawning sub-agents during RLM processing. Copy and adapt these templates when invoking the Task tool.

---

## Extraction Template

Pull specific information from a chunk: findings, positions, and confidence scores.

**Usage**: `model: "haiku"` via Task tool. Use for fact extraction, data collection, and information retrieval from individual chunks.

```
You are processing chunk {CHUNK_NUMBER} of {TOTAL_CHUNKS} in a larger analysis.

ORIGINAL QUERY:
{original_query}

CHUNK CONTENT:
{chunk_content}

TASK:
Extract all instances of {extraction_target} from this chunk.

OUTPUT FORMAT:
For each finding, provide:
- Finding: [description of what was found]
- Location: [file name and line number, or position in text]
- Evidence: [direct quote or code snippet]
- Confidence: [0.0-1.0 score indicating certainty]

If no relevant findings exist in this chunk, state:
No relevant findings in this chunk.

CONSTRAINT: Focus ONLY on this chunk. Do NOT reference external content.
Do NOT make assumptions about content outside this chunk.
```

---

## Analysis Template

Analyze a chunk against a specific query, extracting claims, evidence, and caveats.

**Usage**: `model: "haiku"` via Task tool. Use for deep analysis of individual chunks where interpretation is needed, not just extraction.

```
You are processing chunk {CHUNK_NUMBER} of {TOTAL_CHUNKS} in a larger analysis.

ORIGINAL QUERY:
{original_query}

CHUNK CONTENT:
{chunk_content}

TASK:
Analyze this chunk to answer: {analysis_question}

ANALYSIS FRAMEWORK:
1. Identify key claims or statements relevant to the query
2. Extract supporting evidence (quotes, data, code)
3. Note any caveats, limitations, or qualifications
4. Assess confidence in findings

OUTPUT FORMAT:
Claims:
- Claim: [statement]
  Evidence: [supporting quote or data]
  Confidence: [0.0-1.0]

Caveats:
- [any limitations or qualifications found]

Summary: [2-3 sentence summary of analysis findings for this chunk]

If this chunk does not address the query, state:
This chunk does not contain content relevant to the query.

CONSTRAINT: Focus ONLY on this chunk. Do NOT reference external content.
Distinguish between explicit statements and inferences.
```

---

## Filtering Template

Determine chunk relevance to a query, scoring and extracting key passages.

**Usage**: `model: "haiku"` via Task tool. Use as a first pass to identify which chunks deserve deeper analysis, reducing processing for irrelevant chunks.

```
You are processing chunk {CHUNK_NUMBER} of {TOTAL_CHUNKS} in a relevance filtering pass.

QUERY:
{original_query}

CHUNK CONTENT:
{chunk_content}

TASK:
Determine the relevance of this chunk to the query.

OUTPUT FORMAT:
Relevance Score: [0.0-1.0]
Action: [INCLUDE or SKIP]

Key Passages (if INCLUDE):
- Passage: [relevant text excerpt]
  Position: [location in chunk]
  Reason: [why this passage is relevant]

Reasoning: [1-2 sentences explaining relevance assessment]

SCORING GUIDE:
- 0.0-0.3: Not relevant. Action: SKIP
- 0.3-0.6: Possibly relevant. Action: INCLUDE if related to query
- 0.6-1.0: Highly relevant. Action: INCLUDE

CONSTRAINT: Focus ONLY on this chunk. Do NOT reference external content.
When uncertain, err on the side of INCLUDE (false negatives are costlier than false positives).
```

---

## Synthesis Template

Aggregate findings from all worker chunks into a unified output. Used by the Sonnet supervisor after all workers complete.

**Usage**: `model: "sonnet"` - this template is for the supervisor synthesis step, NOT for chunk workers.

```
You are synthesizing results from {TOTAL_CHUNKS} chunk analyses into a final answer.

ORIGINAL QUERY:
{original_query}

INPUT METADATA:
- Total size: {input_size_description}
- Chunks processed: {chunks_processed} of {TOTAL_CHUNKS}
- Strategy: {decomposition_strategy}

WORKER RESULTS:
{formatted_worker_results}

SYNTHESIS TASK:
1. Integrate findings from all chunks into a coherent answer
2. Deduplicate findings that appear in multiple chunks
3. Identify cross-chunk patterns and themes
4. Resolve any contradictions between chunks (cite both sides)
5. Assess overall completeness and confidence

OUTPUT FORMAT:
## Summary
[2-3 sentence overview answering the original query]

## Key Findings
1. [Finding] - Source: [chunk number(s)]
2. [Finding] - Source: [chunk number(s)]
...

## Cross-Chunk Patterns
- [Pattern observed across multiple chunks]
...

## Contradictions or Gaps
- [Any unresolved conflicts or missing areas]

## Completeness Assessment
- Completeness: [0-100%]
- Confidence: [0-100%]
- Gaps: [areas not covered, if any]

QUALITY STANDARDS:
- Every claim must trace to a specific worker result
- Acknowledge gaps rather than filling them with assumptions
- Prioritize findings by relevance to the original query
- If completeness < 90%, identify what additional analysis is needed
```
