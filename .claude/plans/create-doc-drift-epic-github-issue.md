# Plan: Create Doc-Drift Epic GitHub Issue

## Context

The `/doc-drift` command completed a full documentation drift detection between docs.ruska.ai and chat.ruska.ai. The council review (`.doc-drift/2026-02-19/COUNCIL_REVIEW.md`) identified **25 drift items** (12 CRITICAL, 13 IMPORTANT) and graded the documentation health as **F (CRITICAL)**. The user wants a single GitHub epic issue to track all remediation work.

## Steps

### 1. Create "epic" label
No `epic` label exists in the repo. Create it via `gh label create`.

```bash
gh label create "epic" --description "Tracks a collection of related issues" --color "3E4B9E"
```

### 2. Create the epic issue

Use `gh issue create` with the feature request template structure adapted for an epic. The issue will:

- Title: `feat(docs): Documentation drift remediation — Grade F, 12 CRITICAL items`
- Labels: `epic`, `enhancement`
- Body structured as:
  - **Metadata** section (per template convention)
  - **User Stories** (3 stories covering API integrators, new users, self-hosters)
  - **Summary** with executive summary from council review
  - **CRITICAL items checklist** (12 items, each as a task checkbox)
  - **IMPORTANT items checklist** (13 items, each as a task checkbox)
  - **Affected Files** table (wiki doc pages to fix)
  - **Acceptance Criteria** (doc health grade improvement targets)
  - Link to full council review at `.doc-drift/2026-02-19/COUNCIL_REVIEW.md`

### 3. Return the issue URL

## Files Referenced
- `.doc-drift/2026-02-19/COUNCIL_REVIEW.md` — full council review with ranked findings
- `.doc-drift/2026-02-19/DRIFT_ITEMS.md` — detailed drift item descriptions
- `.github/ISSUE_TEMPLATE/feature_request.md` — repo issue template conventions

## Verification
- `gh issue view <number>` confirms the issue was created with correct labels and content
