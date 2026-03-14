---
name: doc-drift
description: |
  Documentation drift detection between docs.ruska.ai (Docusaurus wiki) and chat.ruska.ai
  (React+FastAPI app). Provides domain knowledge for drift categories, scoring rubric,
  crawl strategies, council assessment criteria, and output format templates. Used by the
  /doc-drift command which orchestrates an Agent Team of crawlers and assessors.
---

# Documentation Drift Detection

Detect and score discrepancies between what the documentation says and what the application actually does. This skill provides the shared domain knowledge used by all teammates in the doc-drift agent team.

## Drift Categories

| Code | Category | Definition |
|------|----------|------------|
| `MISSING_DOC` | Missing Documentation | Feature exists in app but has no documentation |
| `STALE_DOC` | Stale Documentation | Docs describe outdated behavior (old UI, renamed features, deprecated flows) |
| `INCORRECT_DOC` | Incorrect Documentation | Docs actively contradict actual app behavior |
| `MISSING_FEAT` | Missing Feature | Docs describe a feature not present in the app |
| `INCOMPLETE_DOC` | Incomplete Documentation | Feature is documented but has significant gaps (missing params, steps, caveats) |
| `DEAD_REF` | Dead Reference | Broken links, references to nonexistent pages, or images that 404 |

## Scoring Rubric (Summary)

Three dimensions, weighted to produce a composite score:

| Dimension | Weight | Scale |
|-----------|--------|-------|
| **User Impact** | 0.4 | 1 (cosmetic) to 5 (blocks core workflow) |
| **Feature Visibility** | 0.3 | 1 (internal/rare) to 5 (core feature used every session) |
| **Drift Severity** | 0.3 | 1 (could be clearer) to 5 (completely wrong/missing) |

**Composite**: `(Impact * 0.4) + (Visibility * 0.3) + (Severity * 0.3)`

| Rating | Range | Action |
|--------|-------|--------|
| **CRITICAL** | >= 4.0 | Must fix immediately |
| **IMPORTANT** | >= 2.5 | Should fix soon |
| **MINOR** | < 2.5 | Fix when convenient |

For detailed scoring examples and assessor lens modifiers, see `references/scoring-rubric.md`.

## Council Drift Standard

For an item to qualify as "documentation drift" (not acceptable variance), it must meet ALL three criteria:

1. **User confusion**: A reasonable user would be confused or misled
2. **Factual discrepancy**: The difference is factual, not stylistic (word choice, formatting)
3. **Verifiable**: Correct information exists in the app or codebase to compare against

Items that fail any criterion should be flagged as **false positives** and excluded from final scoring.

## Crawl Strategies

### docs.ruska.ai (Docusaurus)

The wiki uses Docusaurus with a sidebar defined in `wiki/sidebars.ts`. Crawl strategy:

1. Open `https://docs.ruska.ai/docs` (landing/intro page)
2. Take a snapshot to extract sidebar navigation links
3. Visit each sidebar link systematically (depth-first through categories)
4. For each page:
   - `agent-browser get text` to extract all content
   - `agent-browser screenshot` to `.doc-drift/<date>/evidence/docs-<slug>.png`
   - Record: page title, URL, features documented, API endpoints mentioned, UI elements described, user workflows outlined
5. Check for broken internal links by attempting navigation

### chat.ruska.ai (React + FastAPI)

The app routes are defined in `frontend/src/routes/AppRoutes.tsx`. API endpoints are at `/docs` (Swagger). Crawl strategy:

1. Start with public pages: landing page, login page
2. Crawl API docs at `https://chat.ruska.ai/docs` (FastAPI Swagger UI):
   - Extract all endpoint paths, methods, parameters, response schemas
   - Group by tag/category
3. Attempt authenticated access:
   - Try default credentials from agent-browser skill defaults
   - If auth succeeds: systematically visit each route from AppRoutes.tsx
   - If auth fails: document public-only scope, note authenticated routes as uncrawled
4. For each accessible route:
   - `agent-browser snapshot` to catalog UI elements, buttons, forms, navigation
   - `agent-browser screenshot` to `.doc-drift/<date>/evidence/app-<slug>.png`
   - Record: route path, page title, visible features, interactive elements, API calls observed

## Output Format Templates

### DOCS_MANIFEST.md

```markdown
# Documentation Manifest
**Source**: https://docs.ruska.ai
**Crawled**: <YYYY-MM-DD HH:MM>
**Pages crawled**: <N>

## Sidebar Structure
<!-- Reproduce the sidebar hierarchy -->
- Category: ...
  - Page: ... (URL)

## Documented Features
| Feature | Doc Page | Description | API Endpoints Referenced | UI Elements Described |
|---------|----------|-------------|------------------------|-----------------------|
| ... | ... | ... | ... | ... |

## Documented API Endpoints
| Method | Path | Doc Page | Parameters | Response |
|--------|------|----------|------------|----------|
| ... | ... | ... | ... | ... |

## Documented User Workflows
| Workflow | Doc Page | Steps |
|----------|----------|-------|
| ... | ... | 1. ... 2. ... |

## Internal Links
| Link Text | Target | Status |
|-----------|--------|--------|
| ... | ... | OK / BROKEN |

## Notes
<!-- Anything unusual observed during crawl -->
```

### APP_MANIFEST.md

```markdown
# Application Manifest
**Source**: https://chat.ruska.ai
**Crawled**: <YYYY-MM-DD HH:MM>
**Auth scope**: <public-only | authenticated>
**Routes crawled**: <N>

## Route Map
| Route | Page Title | Auth Required | Key Features |
|-------|------------|---------------|--------------|
| ... | ... | Yes/No | ... |

## API Endpoints (from /docs)
| Method | Path | Tag | Parameters | Response Schema |
|--------|------|-----|------------|-----------------|
| ... | ... | ... | ... | ... |

## UI Features Observed
| Feature | Route | Description | Interactive Elements |
|---------|-------|-------------|---------------------|
| ... | ... | ... | buttons, forms, etc. |

## Navigation Structure
<!-- Describe the app's navigation hierarchy as observed -->

## Notes
<!-- Auth failures, inaccessible routes, unexpected behavior -->
```

### DRIFT_ITEMS.md

```markdown
# Documentation Drift Items
**Generated**: <YYYY-MM-DD HH:MM>
**Total items**: <N>
**By rating**: CRITICAL: <n> | IMPORTANT: <n> | MINOR: <n>

## Items (ranked by composite score)

### DRIFT-001: <title>
- **Category**: <MISSING_DOC | STALE_DOC | INCORRECT_DOC | MISSING_FEAT | INCOMPLETE_DOC | DEAD_REF>
- **Docs reference**: <page URL or "N/A">
- **App reference**: <route or endpoint>
- **Description**: <what the drift is>
- **Evidence**:
  - Docs say: "<quote or description>"
  - App shows: "<quote or description>"
  - Screenshots: `evidence/docs-<slug>.png`, `evidence/app-<slug>.png`
- **Scoring**:
  - User Impact: <1-5> -- <justification>
  - Feature Visibility: <1-5> -- <justification>
  - Drift Severity: <1-5> -- <justification>
  - **Composite: <score> (<CRITICAL|IMPORTANT|MINOR>)**

### DRIFT-002: ...
<!-- Continue for all items -->
```

### ASSESSMENT_<PERSONA>.md

```markdown
# Assessment: <PERSONA_NAME>
**Assessor**: <USER_ADVOCATE | API_AUDITOR | ONBOARDING_SENTINEL>
**Lens**: <one-sentence description of assessment perspective>
**Date**: <YYYY-MM-DD>

## Summary
<2-3 sentence overall assessment from this persona's perspective>

## Score Adjustments
| Item | Original Score | Adjusted Score | Justification |
|------|---------------|----------------|---------------|
| DRIFT-001 | 3.8 | 4.2 | <why this persona scores differently> |
| ... | ... | ... | ... |

## Missed Items
<!-- Drift items not in DRIFT_ITEMS.md that this assessor identified -->
### NEW-001: <title>
- **Category**: ...
- **Scoring**: ...
- **Why missed**: <why the lead's initial pass didn't catch this>

## False Positives
<!-- Items in DRIFT_ITEMS.md that this assessor believes are NOT real drift -->
| Item | Reason for False Positive |
|------|--------------------------|
| DRIFT-XXX | <why this doesn't meet the Council Drift Standard> |

## Cross-Assessor Challenges
<!-- Record of debates with other assessors -->
| Challenged | Item | My Position | Their Position | Resolution |
|------------|------|-------------|----------------|------------|
| API_AUDITOR | DRIFT-003 | Score should be 4.0 | Score fine at 3.2 | Agreed on 3.6 |

## Key Findings
1. ...
2. ...
3. ...
```

### COUNCIL_REVIEW.md

```markdown
# Documentation Drift Council Review
**Date**: <YYYY-MM-DD>
**Docs source**: https://docs.ruska.ai
**App source**: https://chat.ruska.ai

## Executive Summary
<3-5 sentence overview of documentation health>

## Score Consensus Matrix
| Item | Lead Score | USER_ADVOCATE | API_AUDITOR | ONBOARDING_SENTINEL | Final Score |
|------|-----------|---------------|-------------|---------------------|-------------|
| DRIFT-001 | ... | ... | ... | ... | ... |
| ... | ... | ... | ... | ... | ... |

## Consensus Points
<!-- What all assessors agreed on -->
1. ...

## Divergence Analysis
<!-- Where assessors disagreed and how it was resolved -->
| Item | Divergence | Resolution |
|------|-----------|------------|
| ... | ... | ... |

## False Positive Resolution
| Item | Flagged By | Verdict | Reasoning |
|------|-----------|---------|-----------|
| ... | ... | Confirmed FP / Kept | ... |

## Final Ranked Report

### CRITICAL (>= 4.0)
| # | Item | Score | Category | Summary |
|---|------|-------|----------|---------|
| 1 | DRIFT-XXX | 4.8 | ... | ... |

### IMPORTANT (>= 2.5)
| # | Item | Score | Category | Summary |
|---|------|-------|----------|---------|
| 1 | DRIFT-XXX | 3.2 | ... | ... |

### MINOR (< 2.5)
| # | Item | Score | Category | Summary |
|---|------|-------|----------|---------|
| 1 | DRIFT-XXX | 1.8 | ... | ... |

## Documentation Health

### Grade: <A|B|C|D|F>
| Grade | Criteria |
|-------|----------|
| A | 0 CRITICAL, <= 2 IMPORTANT |
| B | 0 CRITICAL, <= 5 IMPORTANT |
| C | <= 2 CRITICAL, any IMPORTANT |
| D | 3-5 CRITICAL |
| F | > 5 CRITICAL |

### Verdict: <HEALTHY | DRIFTING | CRITICAL>
- **HEALTHY**: Grade A or B -- docs are reliable
- **DRIFTING**: Grade C or D -- docs need attention
- **CRITICAL**: Grade F -- docs are unreliable, users at risk

## Recommendations
<!-- Prioritized list of actions to improve documentation health -->
1. **[CRITICAL]** ...
2. **[IMPORTANT]** ...
3. ...

## Methodology
- Crawled <N> doc pages and <N> app routes
- Identified <N> drift items across <N> categories
- 3 independent assessors evaluated from distinct perspectives
- Cross-assessor debate resolved <N> divergences
- <N> false positives removed from final report
```

## Key Reference Files

When working on doc-drift detection, these files provide essential context:

| File | Purpose |
|------|---------|
| `wiki/sidebars.ts` | Exact sidebar structure for systematic docs crawling |
| `frontend/src/routes/AppRoutes.tsx` | All app routes for systematic app crawling |
| `AGENTS.md` | Project overview, tech stack, known features |
| `.claude/skills/agent-browser/SKILL.md` | Browser automation commands and patterns |
