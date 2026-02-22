# Plan: Documentation Drift Detection Agent Team

## Context

Detect documentation drift between [docs.ruska.ai](https://docs.ruska.ai) (Docusaurus wiki) and [chat.ruska.ai](https://chat.ruska.ai) (React+FastAPI app). Uses the **Claude Code Agent Teams** feature (experimental, `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) where multiple Claude Code instances coordinate via shared task list and inter-agent messaging.

**Why Agent Teams over Subagents**: Teammates need to share findings and challenge each other's assessments (council deliberation). Agent teams support direct inter-agent messaging and a shared task list -- subagents can only report back to the parent.

---

## Files to Create (3 files)

| # | File | Purpose |
|---|------|---------|
| 1 | `.claude/skills/doc-drift/SKILL.md` | Domain knowledge: drift categories, scoring rubric, crawl strategies, council criteria |
| 2 | `.claude/skills/doc-drift/references/scoring-rubric.md` | Detailed scoring rubric reference |
| 3 | `.claude/commands/doc-drift.md` | Command: instructs the lead to set up the agent team, define tasks, and coordinate |

**No separate agent `.md` files needed** -- Agent Teams teammates are full Claude Code instances that automatically load CLAUDE.md, skills, and project context. The command and skill provide all the domain knowledge they need.

---

## Architecture

```
Lead (you invoke /doc-drift)
  |
  |-- Creates agent team with 5 teammates
  |-- Creates shared task list with dependencies
  |-- Coordinates and synthesizes
  |
  +-- Teammate: DOCS_CRAWLER
  |     Uses agent-browser to crawl docs.ruska.ai
  |     Writes DOCS_MANIFEST.md
  |
  +-- Teammate: APP_CRAWLER
  |     Uses agent-browser to crawl chat.ruska.ai
  |     Writes APP_MANIFEST.md
  |
  +-- Teammate: USER_ADVOCATE (assessor)
  |     Reads manifests, scores drift from end-user perspective
  |     Messages other assessors to challenge findings
  |
  +-- Teammate: API_AUDITOR (assessor)
  |     Reads manifests, scores drift from API accuracy perspective
  |     Messages other assessors to challenge findings
  |
  +-- Teammate: ONBOARDING_SENTINEL (assessor)
  |     Reads manifests, scores drift from first-time user perspective
  |     Messages other assessors to challenge findings
  |
  Lead synthesizes all assessor findings into COUNCIL_REVIEW.md
```

Teammates communicate directly (assessors debate each other). Lead manages task dependencies and writes the final council review.

---

## Output Artifacts

All written to `.doc-drift/<YYYY-MM-DD>/`:
```
DOCS_MANIFEST.md        # What the docs say (by DOCS_CRAWLER)
APP_MANIFEST.md         # What the app does (by APP_CRAWLER)
DRIFT_ITEMS.md          # Scored drift items (by lead, after crawls)
ASSESSMENT_USER_ADVOCATE.md       # (by assessor teammate)
ASSESSMENT_API_AUDITOR.md         # (by assessor teammate)
ASSESSMENT_ONBOARDING_SENTINEL.md # (by assessor teammate)
COUNCIL_REVIEW.md       # Final council verdict (by lead)
evidence/               # Screenshots from both sites
```

---

## Command Workflow (`doc-drift.md`)

### Phase 0: Initialize
- Read `CLAUDE.md` + `AGENTS.md` for project context
- Create output dir: `mkdir -p .doc-drift/<date>/evidence`
- Enable agent teams: verify `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`

### Phase 1: Crawl (parallel teammates)
Create an agent team with 2 crawler teammates:

**DOCS_CRAWLER** spawn prompt:
> You are DOCS_CRAWLER. Use agent-browser to crawl https://docs.ruska.ai/docs systematically. Open the docs homepage, extract the sidebar navigation via `agent-browser snapshot`, then visit each doc page. For each page: extract text with `agent-browser get text`, take a screenshot to `.doc-drift/<date>/evidence/docs-<slug>.png`, and catalog all documented features, API endpoints, UI elements, and user workflows. Write your complete findings to `.doc-drift/<date>/DOCS_MANIFEST.md`. Load the doc-drift skill for output format reference.

**APP_CRAWLER** spawn prompt:
> You are APP_CRAWLER. Use agent-browser to crawl https://chat.ruska.ai systematically. Start with public pages (landing, login). Crawl the API docs at /docs (Swagger UI) to extract all endpoints. Attempt login with default credentials for authenticated routes; fall back to public-only if auth fails. For each accessible route: take a snapshot, screenshot to `.doc-drift/<date>/evidence/app-<slug>.png`, catalog all UI elements, features, and navigation. Write findings to `.doc-drift/<date>/APP_MANIFEST.md`. Load the doc-drift skill for output format reference.

Task dependencies: assessor tasks are blocked until both crawl tasks complete.

### Phase 2: Drift Detection (lead)
After both manifests are written, the lead:
- Reads both `DOCS_MANIFEST.md` and `APP_MANIFEST.md`
- Compares across 6 drift categories (from skill)
- Scores each item using the 3-dimension rubric (from skill)
- Writes `DRIFT_ITEMS.md` with ranked items

### Phase 3: Independent Assessment (3 assessor teammates)
Spawn 3 assessor teammates, each with a distinct lens:

**USER_ADVOCATE** -- Can a new user follow the docs to actually use the app?
**API_AUDITOR** -- Do documented endpoints, parameters, responses match reality?
**ONBOARDING_SENTINEL** -- Is the getting-started critical path accurate?

Each assessor:
1. Reads both manifests + `DRIFT_ITEMS.md`
2. Validates/adjusts scores from their perspective
3. Identifies missed drift items
4. Flags false positives
5. **Messages other assessors** to challenge findings and debate severity
6. Writes `ASSESSMENT_<PERSONA>.md`

Key agent team advantage: assessors message each other directly to debate, like the "competing hypotheses" pattern from the docs. This produces stronger consensus than independent reports.

### Phase 4: Council Review (lead)
Lead reads all 3 assessments and synthesizes:
- Score Consensus Matrix (initial vs each assessor vs final)
- Consensus points and divergence analysis
- False positive resolution
- Final ranked report: CRITICAL (>= 4.0) / IMPORTANT (>= 2.5) / MINOR (< 2.5)
- Documentation health grade (A-F)
- Verdict: HEALTHY / DRIFTING / CRITICAL
- Writes `COUNCIL_REVIEW.md`

### Phase 5: Cleanup
Lead asks all teammates to shut down, then cleans up the team.

---

## Skill: `doc-drift/SKILL.md`

### Drift Categories
| Category | Code | Definition |
|----------|------|------------|
| Missing Documentation | `MISSING_DOC` | Feature exists in app but has no documentation |
| Stale Documentation | `STALE_DOC` | Docs describe outdated behavior |
| Incorrect Documentation | `INCORRECT_DOC` | Docs contradict actual app behavior |
| Missing Feature | `MISSING_FEAT` | Docs describe feature not in app |
| Incomplete Documentation | `INCOMPLETE_DOC` | Feature documented but significant gaps |
| Dead Reference | `DEAD_REF` | Broken links or references to nonexistent resources |

### Scoring Rubric (3 dimensions, 1-5 scale)
- **User Impact** (weight 0.4): How many users affected, how severely
  - 5 = Blocks core workflow, 4 = Significant confusion, 3 = Moderate, 2 = Minor, 1 = Cosmetic
- **Feature Visibility** (weight 0.3): How prominent the feature is
  - 5 = Core (assistants, chat), 4 = Important (tools, memories), 3 = Supporting (settings), 2 = Niche (A2A, sandbox), 1 = Internal
- **Drift Severity** (weight 0.3): How wrong/missing the docs are
  - 5 = Completely missing/wrong, 4 = Major gaps, 3 = Partially incorrect, 2 = Minor inaccuracy, 1 = Could be clearer

Composite: `(Impact * 0.4) + (Visibility * 0.3) + (Severity * 0.3)`
Rating: HIGH (>= 4.0), MEDIUM (>= 2.5), LOW (< 2.5)

### Council Drift Standard
For an item to qualify as "documentation drift" (not just acceptable variance), it must meet ALL of:
1. A reasonable user would be confused or misled
2. The discrepancy is factual (not stylistic)
3. The correct information exists somewhere to compare against

### Manifest Output Formats
(Templates for DOCS_MANIFEST.md, APP_MANIFEST.md, DRIFT_ITEMS.md, ASSESSMENT, COUNCIL_REVIEW)

---

## Key Reference Files

| File | Why |
|------|-----|
| `.claude/commands/team.md` | Pattern for council synthesis, comparison matrix, persona generation |
| `.claude/skills/agent-browser/SKILL.md` | All browser automation commands, selectors, sessions |
| `wiki/sidebars.ts` | Exact sidebar structure of docs.ruska.ai for systematic crawling |
| `frontend/src/routes/AppRoutes.tsx` | All routes in chat.ruska.ai for systematic crawling |
| `AGENTS.md` | Project overview, known features, tech stack |

---

## Implementation Order

1. **Skill first**: `.claude/skills/doc-drift/SKILL.md` + `references/scoring-rubric.md`
   - All domain knowledge: categories, rubric, council standard, output templates
   - Loaded by all teammates automatically
2. **Command last**: `.claude/commands/doc-drift.md`
   - Lead instructions: team setup, task creation, spawn prompts, synthesis workflow
   - References the skill for domain knowledge

---

## Verification

1. Ensure `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set in settings
2. Run `/doc-drift` from orchestra root
3. Verify 5 teammates spawn (2 crawlers + 3 assessors, staged via task dependencies)
4. Check `.doc-drift/<date>/` has all 7 expected artifacts
5. Verify `COUNCIL_REVIEW.md` contains consensus matrix, ranked findings, and health verdict
6. Verify `evidence/` contains screenshots from both sites
