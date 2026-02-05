---
name: ralph:plan
description: "Generate a PRD using parallel specialized subagents with isolated context. Use when planning a new feature or creating requirements. Triggers on: plan feature, create plan for, prd for, spec out."
---

# Plan

Generate a PRD for a feature using parallel specialized subagents with isolated context.

## Variables

TOPIC: $ARGUMENTS.topic
SUBAGENTS: $ARGUMENTS.subagents (default: 3)

## Workflow

1. _ANALYZE_ TOPIC to extract search terms:
   - _EXTRACT_ 5-10 relevant keywords/patterns from TOPIC
   - _SPLIT_ into: codebase terms (function names, components) + domain terms (concepts, patterns)

2. _RESEARCH_ parallel discovery (codebase + web):

   **Codebase greps (parallel):**
   - _RUN_ concurrent `rg` searches for codebase keywords
   - _COLLECT_ file paths and line counts per keyword
   - _RANK_ files by hit frequency → hotspots
   - _OUTPUT_ `{ keyword: [file:line, ...], hotspots: [most-hit files] }`

   **Web searches (parallel):**
   - _SEARCH_ domain terms for best practices, patterns, prior art
   - _FIND_ relevant docs, tutorials, implementation guides
   - _COLLECT_ URLs and key insights for ambiguous/undefined scope areas
   - _OUTPUT_ `{ term: [url, summary], references: [most relevant links] }`

3. _DETERMINE_ SUBAGENTS specialized expert personas from TOPIC:
   - _DECOMPOSE_ TOPIC into distinct domains requiring expertise
   - _GENERATE_ expert persona for each domain
   - _ASSIGN_ each persona:
     - Focused scope
     - Relevant files from grep manifest
     - Relevant external references from web search
   - _ENSURE_ no overlap — each agent owns a distinct aspect of TOPIC

4. _SPAWN_ SUBAGENTS parallel expert subagents (isolated context each):

   **Each specialized subagent receives:**
   - Assigned expert persona and scope
   - File hints from grep (starting points, not exhaustive)
   - External references for undefined/ambiguous areas

   **Each subagent:**
   - _START_ from provided file hints + external context
   - _EXPLORE_ codebase through persona's lens
   - _CONSULT_ external references to clarify scope
   - _ANALYZE_ TOPIC requirements within their domain
   - _IDENTIFY_ constraints, patterns, risks specific to their expertise
   - _OUTPUT_ `EXPERT_<persona-slug>.md`: findings, recommendations, requirements

   **Example for TOPIC="real-time notifications":**
   - Agent 1 — WebSocket Specialist: files with socket hits + WebSocket best practices docs
   - Agent 2 — Event System Architect: event/queue hits + pub/sub pattern guides
   - Agent 3 — UI/UX Notification Expert: toast/alert hits + notification UX guidelines

5. _COLLECT_ all expert outputs into `.claude/plans/plan-<topic-slug>/`

6. _SYNTHESIZE_ via integration subagent:
   - _READ_ all expert outputs
   - _RECONCILE_ overlapping recommendations
   - _IDENTIFY_ cross-cutting concerns missed by specialists
   - _PRODUCE_ unified analysis document

7. _GENERATE_ PRD via prd subagent:
   - _LOAD_ the prd skill
   - _CREATE_ PRD for TOPIC incorporating all expert analysis
   - _APPLY_ sizing rules:
     - Each user story completable in ONE iteration
     - One story touches 1-3 files max
     - Backend and frontend are SEPARATE stories
     - Add "Typecheck passes" to every story
     - Add "Verify in browser using agent-browser skill" to UI stories
   - _SAVE_ to `tasks/prd-<topic-slug>.md`

8. _REPORT_ completion:
   - Keywords searched: [codebase terms]
   - Web queries: [domain terms]
   - Hotspot files: [most relevant files]
   - External references: [key URLs]
   - Experts spawned: [list persona names]
   - Spec folder: `.claude/plans/plan-<topic-slug>/`
   - PRD location: `tasks/prd-<topic-slug>.md`

## Error Handling

- **Empty TOPIC**: _REPORT_ "Topic required. Usage: /plan topic=\"your feature description\""
- **No grep hits**: Proceed with web references and broader exploration
- **No web results**: Proceed with codebase context only
- **Subagent failure**: _REPORT_ which expert failed, continue with available outputs
- **PRD generation failure**: _REPORT_ "Failed to generate PRD. Check spec folder for partial outputs."

## Example Invocations

```bash
# Auth feature → greps: jwt, token, auth + web: "JWT best practices 2026", "session vs token auth"
/plan topic="user authentication with JWT tokens"

# Notifications → greps: websocket, event, toast + web: "real-time notification patterns", "WebSocket scaling"
/plan topic="real-time notifications system" subagents=5
```

## Report

Confirm completion with:
- Topic: TOPIC
- Codebase keywords: [extracted terms]
- Web queries: [domain searches]
- Hotspots: [high-frequency files]
- References: [external URLs]
- Expert personas: [dynamically generated]
- Spec folder: `.claude/plans/plan-<topic-slug>/`
- PRD generated: `tasks/prd-<topic-slug>.md`
