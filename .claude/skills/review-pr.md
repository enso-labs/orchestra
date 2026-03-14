---
name: review-pr
description: Structured PR code review. Accepts a PR URL or number.
---

# Review PR

Input: GitHub PR URL or number. Extract `NUMBER` from URL or use directly.

NEVER read `.env*` files. NEVER commit `frontend/vite.config.ts`. Always `git commit -s`. Always `git add <specific-files>` only.

Default ports: **frontend 5173**, **backend 8000**. If 5173 is taken, pick lowest free in 5170-5179.

## 0. Setup

```bash
gh pr view <NUMBER> --json number,title,headRefName,baseRefName,url
git worktree list | grep feat-<NUMBER>  # use worktree if exists
which node                               # store dir as NODE_DIR
ss -tlnp | grep 5173                     # confirm 5173 free, else scan 5170-5179
```

**Report to user immediately after setup:**
```
Review Environment:
  PR:       #<NUMBER> — <title>
  Branch:   <head> → <base>
  Frontend: http://localhost:5173
  Backend:  http://localhost:8000
  Worktree: <path or "none">
```

## 1. Study

```bash
git log --oneline <base>..<head>
git show <head>:.ralph/progress.txt 2>/dev/null
git show <head>:.ralph/prd.json 2>/dev/null          # extract acceptance criteria
git diff <base>..<head>
```

## 2. Static Analysis

```bash
git diff --name-only <base>..<head> -- 'frontend/src/**'
# From frontend/:
node_modules/.bin/tsc --noEmit
npx eslint <changed-frontend-files>
# If Python files changed, from backend/:
make format && make lint
```

Report pass/fail. Continue even on failure.

## 3. Code Review & Fixes

Review diff for: dead code, `any` types, stale closures, missing dedup, unused imports, OWASP issues, AGENTS.md convention violations.

If issues found: fix, re-run static analysis, list changes.

## 4. Browser Validation

agent-browser cannot reach localhost. Tunnel via cloudflared.

```bash
# a. Patch frontend/vite.config.ts: proxy target http://localhost:8000, allowedHosts: true

# b. Start Vite
systemd-run --user --unit=vite-<NUMBER> --remain-after-exit \
  --setenv=PATH=<NODE_DIR>:/usr/bin:/bin --setenv=HOME=$HOME \
  --working-directory=$(pwd)/frontend \
  -- <NODE_DIR>/node node_modules/.bin/vite --port <PORT> --host 0.0.0.0

# c. Verify
ss -tlnp | grep <PORT> && curl -s -o /dev/null -w "%{http_code}" http://localhost:<PORT>/

# d. Tunnel
nohup cloudflared tunnel --url http://localhost:<PORT> > /tmp/cf-tunnel-<NUMBER>.log 2>&1 &
sleep 8 && grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/cf-tunnel-<NUMBER>.log | head -1
```

**Report to user when tunnel is ready:**
```
Tunnel live: <TUNNEL_URL>
Validating <N> acceptance criteria...
```

Validate each acceptance criterion from prd.json via agent-browser at TUNNEL_URL. Screenshot to `/tmp/pr-<NUMBER>-<slug>.png`. No prd.json = smoke test only.

## 5. Cleanup (MANDATORY, even on failure)

```bash
agent-browser close 2>/dev/null || true
pkill -f "cloudflared tunnel" 2>/dev/null || true
systemctl --user stop vite-<NUMBER> 2>/dev/null || true
systemctl --user reset-failed vite-<NUMBER> 2>/dev/null || true
ss -tlnp | grep <PORT>
git checkout frontend/vite.config.ts
git status
```

## 6. Commit & Push (only if fixes applied)

```bash
git add <fix-files-only>
git commit -s -m "review: <description>"
git push origin <head>
```

## 7. Report

```markdown
## PR Review Report: #<NUMBER> — <title>
**Branch**: `<head>` → `<base>` | **Reviewed**: <date>

### Static Analysis
| Tool | Result | Issues |
|------|--------|--------|
| tsc --noEmit | PASS/FAIL | count |
| ESLint | PASS/FAIL | count |
| Ruff format | PASS/FAIL/SKIPPED | count |
| Ruff lint | PASS/FAIL/SKIPPED | count |

### Code Review Findings
<severity> <category>: <title> — <file>:<line> — Fix applied: yes/no

### Browser Validation
| Criterion | Result | Screenshot |
|-----------|--------|------------|
| ... | PASS/FAIL/SKIPPED | /tmp/pr-<NUMBER>-<slug>.png |

### Cleanup
- [ ] tunnel killed, vite stopped, port free, vite.config.ts restored, no unintended files

### Verdict: APPROVED / CHANGES REQUESTED / BLOCKED
<summary>
```
