# Spec: #826 — Remove Duplicate CI Jobs & Chain Deploy

## Problem

1. **Duplicate test runs**: `test.yml` triggers on `push` (all branches) AND `pull_request`. When pushing to a PR branch, both fire → 2x test-frontend + 2x test-backend = 4 redundant jobs.
2. **Deploy not chained**: `build.yml` runs on tag push, builds Docker image. But `deploy-docker.yml` requires manual `workflow_dispatch` — should auto-deploy after build.

## Current Workflow Files

### test.yml
- **push trigger**: all branches (`"*"`) with path-ignore
- **pull_request trigger**: opened, synchronize, reopened with same path-ignore
- **Jobs**: test-frontend, test-backend
- Both jobs run independently (no dependency)

### build.yml
- **push trigger**: tags (`"*"`)
- **Jobs**: single `build` job that builds frontend, backend, Docker image, pushes to GHCR

### deploy-docker.yml
- **workflow_dispatch trigger**: manual with `tag` input
- **Jobs**: single `deploy` job that SSHs to VM and deploys the tagged image
- Condition: only runs if tag contains "rc"

## Solution

### Fix 1: Deduplicate test runs

Change `test.yml` push trigger from all branches to only `development` and `main`:

```yaml
on:
  push:
    branches:
      - development
      - main
    paths-ignore: [...]
  pull_request:
    types: [opened, synchronize, reopened]
    paths-ignore: [...]
```

This way:
- PR branches → tested via `pull_request` trigger only (1 run)
- Direct pushes to development/main → tested via `push` trigger (1 run)
- No overlap

### Fix 2: Auto-deploy after build

Add `workflow_run` trigger to `deploy-docker.yml`:

```yaml
on:
  workflow_run:
    workflows: ["Build"]
    types: [completed]
  workflow_dispatch:
    inputs:
      tag: ...
```

In the deploy job, extract the tag from `github.event.workflow_run.head_branch` (for auto-trigger) or `inputs.tag` (for manual).

Add condition: only deploy if build succeeded (`github.event.workflow_run.conclusion == 'success'`).

## Files Changed

| File | Change |
|------|--------|
| `.github/workflows/test.yml` | Restrict push trigger to `development` and `main` branches |
| `.github/workflows/deploy-docker.yml` | Add `workflow_run` trigger after Build workflow |

## Risks

- `workflow_run` fires on default branch only — need to verify tag-triggered builds emit the event correctly
- Alternative: chain deploy as a second job in `build.yml` instead of using `workflow_run`
- Fallback: keep `workflow_dispatch` for manual deploys regardless

## Acceptance Criteria

- [ ] PR pushes trigger exactly 1 set of test jobs (not 2)
- [ ] Direct pushes to development/main still trigger tests
- [ ] Tag push → build → auto-deploy (for rc tags)
- [ ] Manual deploy-docker dispatch still works
- [ ] All YAML valid
