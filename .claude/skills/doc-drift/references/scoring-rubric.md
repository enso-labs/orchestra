# Documentation Drift Scoring Rubric

Detailed reference for scoring documentation drift items. Each item is scored on 3 dimensions, weighted to produce a composite score.

## Dimension 1: User Impact (Weight: 0.4)

How many users are affected and how severely?

| Score | Label | Criteria | Examples |
|-------|-------|----------|----------|
| 5 | Blocks Core Workflow | Users cannot complete a primary task by following docs | Docs say "click Create Assistant" but button is labeled "New Agent"; login flow completely different from documented |
| 4 | Significant Confusion | Users will waste significant time or make errors | API endpoint returns different response shape than documented; required parameter not mentioned |
| 3 | Moderate Friction | Users will need to figure something out on their own | Settings page reorganized but docs show old layout; feature works differently than described but is still usable |
| 2 | Minor Inconvenience | Users might notice but can work around easily | Screenshot shows old UI theme; minor parameter name difference with backward compat |
| 1 | Cosmetic Only | Almost no user impact | Typo in feature name that doesn't affect usage; slightly outdated version number |

## Dimension 2: Feature Visibility (Weight: 0.3)

How prominent and frequently used is the affected feature?

| Score | Label | Criteria | Examples |
|-------|-------|----------|----------|
| 5 | Core Feature | Used by nearly every user in every session | Chat/conversation, assistants/agents, authentication, main navigation |
| 4 | Important Feature | Used regularly by most users | Tools integration, memory/context, file upload, model selection |
| 3 | Supporting Feature | Used periodically by active users | Settings, API keys management, conversation history, export |
| 2 | Niche Feature | Used by specific user segments | A2A protocol, sandbox/code execution, admin panel, webhooks |
| 1 | Internal/Rare | Rarely accessed by end users | Debug endpoints, internal config, developer-only features |

## Dimension 3: Drift Severity (Weight: 0.3)

How wrong or incomplete is the documentation relative to reality?

| Score | Label | Criteria | Examples |
|-------|-------|----------|----------|
| 5 | Completely Wrong/Missing | Docs entirely absent or describe something that doesn't exist | Feature shipped with zero docs; docs describe a feature that was removed |
| 4 | Major Gaps | Significant portions missing or substantially incorrect | API endpoint documented but 3 of 5 parameters wrong; whole workflow section outdated |
| 3 | Partially Incorrect | Some information correct, some wrong or missing | Steps 1-3 correct but step 4 changed; most parameters right but one renamed |
| 2 | Minor Inaccuracy | Small factual errors that don't fundamentally mislead | Default value changed; optional parameter now required but still works without |
| 1 | Could Be Clearer | Technically correct but could cause confusion | Ambiguous wording; missing edge case documentation; unclear prerequisites |

## Composite Score Calculation

```
composite = (user_impact * 0.4) + (feature_visibility * 0.3) + (drift_severity * 0.3)
```

### Score Ranges

| Range | Rating | Action Priority |
|-------|--------|-----------------|
| >= 4.0 | **CRITICAL** | Must fix immediately -- users are blocked or significantly misled |
| >= 2.5 | **IMPORTANT** | Should fix soon -- causes notable friction or confusion |
| < 2.5 | **MINOR** | Fix when convenient -- low impact or cosmetic |

### Example Calculations

**Example 1: Login docs show old OAuth flow, app uses magic links**
- User Impact: 5 (blocks core workflow -- can't log in)
- Feature Visibility: 5 (every user must authenticate)
- Drift Severity: 5 (completely wrong)
- Composite: (5 * 0.4) + (5 * 0.3) + (5 * 0.3) = **5.0 CRITICAL**

**Example 2: Docs missing new "memories" feature**
- User Impact: 3 (feature works without docs, but users miss it)
- Feature Visibility: 4 (important feature for regular users)
- Drift Severity: 5 (completely missing)
- Composite: (3 * 0.4) + (4 * 0.3) + (5 * 0.3) = **3.9 IMPORTANT**

**Example 3: API docs show old parameter name, both old and new work**
- User Impact: 2 (backward compatible, minor confusion)
- Feature Visibility: 2 (niche API feature)
- Drift Severity: 2 (minor inaccuracy)
- Composite: (2 * 0.4) + (2 * 0.3) + (2 * 0.3) = **2.0 MINOR**

## Assessor Lens Modifiers

Each assessor persona may weight dimensions slightly differently based on their perspective:

### USER_ADVOCATE
- Tends to weight **User Impact** higher (may bump +1 if the confusion would frustrate a non-technical user)
- Focuses on: Can someone follow the docs step-by-step and succeed?

### API_AUDITOR
- Tends to weight **Drift Severity** higher (may bump +1 for incorrect types, missing params, wrong status codes)
- Focuses on: Would a developer integrating via API get correct results using the docs?

### ONBOARDING_SENTINEL
- Tends to weight **Feature Visibility** higher for getting-started features (may bump +1 for first-run flow items)
- Focuses on: Can a brand-new user go from zero to first successful interaction?

Assessors document their lens-adjusted scores alongside the base scores and justify any divergence.
