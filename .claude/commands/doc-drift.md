# Documentation Drift Detection

Orchestrate an Agent Team to detect documentation drift between docs.ruska.ai and chat.ruska.ai.

**Usage:** `/doc-drift`

**Requires:** `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` environment variable

---

## Phase 0: Initialize

### Step 1: Load Context

Read these files for project context (do NOT skip):
- `CLAUDE.md` and `AGENTS.md` -- project overview, tech stack, known features
- `wiki/sidebars.ts` -- exact sidebar structure for docs crawling
- `frontend/src/routes/AppRoutes.tsx` -- all app routes for app crawling

Store the combined context as `PROJECT_CONTEXT`.

### Step 2: Create Output Directory

```bash
DATE=$(date +%Y-%m-%d)
mkdir -p .doc-drift/$DATE/evidence
```

Store `DATE` for use in all subsequent prompts.

### Step 3: Verify Agent Teams

Confirm the environment supports agent teams. If `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is not set, warn the user and stop.

### Step 4: Load Skill

Load the `doc-drift` skill for drift categories, scoring rubric, crawl strategies, and output templates. All teammates will automatically have access to this skill.

---

## Phase 1: Crawl (Parallel Teammates)

Create an agent team with 2 crawler teammates. Both run in parallel.

### Teammate: DOCS_CRAWLER

Spawn with this prompt:

```
You are DOCS_CRAWLER, a systematic documentation crawler.

YOUR MISSION: Crawl https://docs.ruska.ai/docs and produce a comprehensive manifest of everything the documentation says.

CONTEXT:
<INSERT PROJECT_CONTEXT>

OUTPUT: Write to .doc-drift/<DATE>/DOCS_MANIFEST.md

INSTRUCTIONS:
1. Load the doc-drift skill for output format reference
2. Open https://docs.ruska.ai/docs using agent-browser
3. Take a snapshot to extract the sidebar navigation
4. Visit EVERY page in the sidebar systematically (depth-first through categories)
5. For each page:
   - Run `agent-browser get text` to extract all content
   - Run `agent-browser screenshot .doc-drift/<DATE>/evidence/docs-<slug>.png`
   - Record: page title, URL, features documented, API endpoints mentioned, UI elements described, user workflows
6. Check internal links for broken references
7. Write the complete DOCS_MANIFEST.md following the template in the doc-drift skill

Be thorough. Every page, every feature, every endpoint mentioned in docs must be cataloged. The assessors depend on your completeness.
```

### Teammate: APP_CRAWLER

Spawn with this prompt:

```
You are APP_CRAWLER, a systematic application crawler.

YOUR MISSION: Crawl https://chat.ruska.ai and its API docs to produce a comprehensive manifest of what the application actually does.

CONTEXT:
<INSERT PROJECT_CONTEXT>

OUTPUT: Write to .doc-drift/<DATE>/APP_MANIFEST.md

INSTRUCTIONS:
1. Load the doc-drift skill for output format reference
2. Start with public pages:
   - Open https://chat.ruska.ai using agent-browser and screenshot the landing/login page
3. Crawl API documentation:
   - Open https://chat.ruska.ai/docs (FastAPI Swagger UI)
   - Extract ALL endpoint paths, methods, parameters, response schemas
   - Screenshot: .doc-drift/<DATE>/evidence/app-swagger.png
4. Attempt authenticated access:
   - Try login with default credentials (admin@example.com / test1234)
   - If auth succeeds: visit each route systematically
   - If auth fails: document public-only scope and note which routes require auth
5. For each accessible route:
   - Run `agent-browser snapshot` to catalog all UI elements
   - Run `agent-browser screenshot .doc-drift/<DATE>/evidence/app-<slug>.png`
   - Record: route path, page title, visible features, interactive elements, forms, buttons
6. Write the complete APP_MANIFEST.md following the template in the doc-drift skill

Be thorough. Every route, every API endpoint, every UI feature must be cataloged. The assessors depend on your completeness.
```

### Task Dependencies

Create shared tasks for the team:
- **Task: Crawl docs.ruska.ai** -- assigned to DOCS_CRAWLER
- **Task: Crawl chat.ruska.ai** -- assigned to APP_CRAWLER
- **Task: Detect drift items** -- blocked by both crawl tasks (lead will do this)
- **Task: Assess as USER_ADVOCATE** -- blocked by drift detection task
- **Task: Assess as API_AUDITOR** -- blocked by drift detection task
- **Task: Assess as ONBOARDING_SENTINEL** -- blocked by drift detection task
- **Task: Council review** -- blocked by all three assessment tasks

Wait for both crawlers to complete before proceeding to Phase 2.

---

## Phase 2: Drift Detection (Lead)

After both manifests exist, the lead performs drift detection:

1. Read `.doc-drift/<DATE>/DOCS_MANIFEST.md`
2. Read `.doc-drift/<DATE>/APP_MANIFEST.md`
3. Compare systematically across all 6 drift categories:
   - `MISSING_DOC`: Features in APP_MANIFEST not in DOCS_MANIFEST
   - `STALE_DOC`: Features in both but described differently
   - `INCORRECT_DOC`: Docs that actively contradict app behavior
   - `MISSING_FEAT`: Features in DOCS_MANIFEST not in APP_MANIFEST
   - `INCOMPLETE_DOC`: Features in both but docs have significant gaps
   - `DEAD_REF`: Broken links found during docs crawl
4. Score each item using the 3-dimension rubric from the doc-drift skill
5. Apply the Council Drift Standard -- exclude items that don't meet all 3 criteria
6. Write `.doc-drift/<DATE>/DRIFT_ITEMS.md` following the template, ranked by composite score

Mark the "Detect drift items" task as complete.

---

## Phase 3: Independent Assessment (3 Assessor Teammates)

Spawn 3 assessor teammates. All run in parallel but can message each other.

### Teammate: USER_ADVOCATE

```
You are USER_ADVOCATE, assessing documentation drift from the end-user perspective.

YOUR LENS: Can a new user follow the docs to actually use the app? You care about clarity, accuracy of steps, and whether the documented workflows match reality.

INPUTS (read these files):
- .doc-drift/<DATE>/DOCS_MANIFEST.md
- .doc-drift/<DATE>/APP_MANIFEST.md
- .doc-drift/<DATE>/DRIFT_ITEMS.md

INSTRUCTIONS:
1. Load the doc-drift skill for scoring rubric and assessment template
2. Read all three input files carefully
3. For each item in DRIFT_ITEMS.md:
   - Validate the score from YOUR perspective (user confusion matters most)
   - Adjust scores where your lens reveals different impact
   - Justify every adjustment
4. Look for MISSED drift items that the lead didn't catch:
   - Workflows that seem documented but would actually confuse a real user
   - Missing "getting started" steps
   - Unclear prerequisites or assumptions
5. Flag FALSE POSITIVES: items that technically differ but wouldn't actually confuse users
6. MESSAGE the other assessors (API_AUDITOR, ONBOARDING_SENTINEL) to:
   - Challenge their scores on items where you disagree
   - Debate severity of items you see differently
   - Reach consensus or document the disagreement
7. Write .doc-drift/<DATE>/ASSESSMENT_USER_ADVOCATE.md following the assessment template

You are an advocate for the end user. If the docs would confuse a real person, that's a problem regardless of technical accuracy.
```

### Teammate: API_AUDITOR

```
You are API_AUDITOR, assessing documentation drift from the API accuracy perspective.

YOUR LENS: Do documented endpoints, parameters, request/response schemas, and error codes match what the API actually does? You care about technical precision.

INPUTS (read these files):
- .doc-drift/<DATE>/DOCS_MANIFEST.md
- .doc-drift/<DATE>/APP_MANIFEST.md
- .doc-drift/<DATE>/DRIFT_ITEMS.md

INSTRUCTIONS:
1. Load the doc-drift skill for scoring rubric and assessment template
2. Read all three input files carefully
3. For each item in DRIFT_ITEMS.md:
   - Validate the score from YOUR perspective (API correctness matters most)
   - Adjust scores where your lens reveals different severity
   - Justify every adjustment
4. Look for MISSED drift items that the lead didn't catch:
   - Endpoint parameters that differ between docs and Swagger
   - Response schemas that don't match
   - Authentication requirements that differ
   - Missing error codes or status codes
5. Flag FALSE POSITIVES: items where the difference is cosmetic or backward-compatible
6. MESSAGE the other assessors (USER_ADVOCATE, ONBOARDING_SENTINEL) to:
   - Challenge their scores on items where you disagree
   - Debate whether API differences truly impact users
   - Reach consensus or document the disagreement
7. Write .doc-drift/<DATE>/ASSESSMENT_API_AUDITOR.md following the assessment template

You are a precision-focused auditor. If the API docs say one thing and the API does another, that's drift -- even if most users wouldn't notice.
```

### Teammate: ONBOARDING_SENTINEL

```
You are ONBOARDING_SENTINEL, assessing documentation drift from the first-time user perspective.

YOUR LENS: Is the getting-started critical path accurate? Can a brand-new user go from zero to their first successful interaction using only the docs? You care about the first 5 minutes of experience.

INPUTS (read these files):
- .doc-drift/<DATE>/DOCS_MANIFEST.md
- .doc-drift/<DATE>/APP_MANIFEST.md
- .doc-drift/<DATE>/DRIFT_ITEMS.md

INSTRUCTIONS:
1. Load the doc-drift skill for scoring rubric and assessment template
2. Read all three input files carefully
3. For each item in DRIFT_ITEMS.md:
   - Validate the score from YOUR perspective (first-run experience matters most)
   - Boost scores for anything on the critical onboarding path
   - Justify every adjustment
4. Look for MISSED drift items that the lead didn't catch:
   - Missing prerequisites (account setup, API keys, etc.)
   - First-run UI that differs from docs screenshots
   - Quickstart guides that skip essential steps
   - Default settings that changed since docs were written
5. Flag FALSE POSITIVES: items that don't affect the onboarding experience
6. MESSAGE the other assessors (USER_ADVOCATE, API_AUDITOR) to:
   - Challenge their scores on onboarding-critical items
   - Debate whether items affect first-time users specifically
   - Reach consensus or document the disagreement
7. Write .doc-drift/<DATE>/ASSESSMENT_ONBOARDING_SENTINEL.md following the assessment template

You are the guardian of first impressions. If a new user's first experience is broken by bad docs, that's the highest-priority drift.
```

### Assessor Coordination

The key advantage of using agent teams here: assessors **message each other directly** to challenge findings and debate severity. This produces stronger consensus than independent reports.

Expected interactions:
- USER_ADVOCATE challenges API_AUDITOR on items that are technically wrong but wouldn't confuse users
- API_AUDITOR challenges USER_ADVOCATE on items that seem fine on the surface but have wrong API details
- ONBOARDING_SENTINEL boosts scores for any drift on the getting-started path

Wait for all 3 assessors to complete their assessments before proceeding.

---

## Phase 4: Council Review (Lead)

After all assessments are written, the lead synthesizes:

1. Read all 3 assessment files:
   - `.doc-drift/<DATE>/ASSESSMENT_USER_ADVOCATE.md`
   - `.doc-drift/<DATE>/ASSESSMENT_API_AUDITOR.md`
   - `.doc-drift/<DATE>/ASSESSMENT_ONBOARDING_SENTINEL.md`

2. Build the **Score Consensus Matrix**: For each drift item, show the lead's initial score alongside each assessor's score, then determine the final score (weighted average or reasoned override).

3. Document **Consensus Points**: What all assessors agreed on.

4. Analyze **Divergences**: Where assessors disagreed, what the debate was, and how it resolved. If unresolved, the lead makes the final call with justification.

5. Resolve **False Positives**: If any assessor flagged an item as false positive, determine whether to keep or remove it. Require at least 2 of 3 assessors to agree for removal.

6. Incorporate **New Items**: Add any drift items discovered by assessors that weren't in the original DRIFT_ITEMS.md. Score them using the consensus of assessor evaluations.

7. Produce the **Final Ranked Report**:
   - CRITICAL (>= 4.0): Must fix immediately
   - IMPORTANT (>= 2.5): Should fix soon
   - MINOR (< 2.5): Fix when convenient

8. Calculate **Documentation Health Grade** (A-F) and **Verdict** (HEALTHY/DRIFTING/CRITICAL):
   | Grade | Criteria |
   |-------|----------|
   | A | 0 CRITICAL, <= 2 IMPORTANT |
   | B | 0 CRITICAL, <= 5 IMPORTANT |
   | C | <= 2 CRITICAL, any IMPORTANT |
   | D | 3-5 CRITICAL |
   | F | > 5 CRITICAL |

9. Write actionable **Recommendations** prioritized by impact.

10. Write `.doc-drift/<DATE>/COUNCIL_REVIEW.md` following the template in the doc-drift skill.

---

## Phase 5: Cleanup

1. Ask all teammates to shut down
2. Clean up the agent team
3. Present a summary to the user:

```markdown
## Doc-Drift Analysis Complete

**Output**: `.doc-drift/<DATE>/`
**Grade**: <grade> | **Verdict**: <verdict>

### Artifacts
- DOCS_MANIFEST.md -- <N> pages crawled
- APP_MANIFEST.md -- <N> routes crawled
- DRIFT_ITEMS.md -- <N> items detected
- ASSESSMENT_USER_ADVOCATE.md
- ASSESSMENT_API_AUDITOR.md
- ASSESSMENT_ONBOARDING_SENTINEL.md
- COUNCIL_REVIEW.md -- final report
- evidence/ -- <N> screenshots

### Top Findings
1. [CRITICAL] ...
2. [CRITICAL] ...
3. [IMPORTANT] ...

Read COUNCIL_REVIEW.md for the full report.
```

---

## Quick Reference

| Phase | Who | Input | Output |
|-------|-----|-------|--------|
| 0 | Lead | CLAUDE.md, AGENTS.md | Output dir, context |
| 1 | DOCS_CRAWLER + APP_CRAWLER (parallel) | URLs, context | DOCS_MANIFEST.md, APP_MANIFEST.md |
| 2 | Lead | Both manifests | DRIFT_ITEMS.md |
| 3 | 3 assessors (parallel, messaging) | Manifests + DRIFT_ITEMS | 3 ASSESSMENT files |
| 4 | Lead | All assessments | COUNCIL_REVIEW.md |
| 5 | Lead | All artifacts | User summary |
