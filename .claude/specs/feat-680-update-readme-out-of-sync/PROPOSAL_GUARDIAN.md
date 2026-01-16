# PROPOSAL: GUARDIAN
## GitHub Issue #680: Update README.md (Out-of-Sync)

**Author**: AGENT_3: THE GUARDIAN
**Expertise Lens**: Security, Error Handling, Edge Cases, Testing
**Date**: 2026-01-16

---

## 1. Executive Summary

The README.md contains outdated environment variable documentation for Presidio services that no longer exist (removed in PR #676), creating a security anti-pattern where developers may waste time configuring deprecated services while missing the actual PIIMiddleware that provides automatic PII protection. This proposal recommends surgically removing the obsolete Presidio section, adding documentation for the new distributed worker environment variables (PR #657), and modernizing the development section to leverage Makefile commands for reduced onboarding friction and fewer configuration errors.

---

## 2. Architectural Analysis

### 2.1 Current State Assessment

#### Security Concerns Identified

| Issue | Severity | Impact |
|-------|----------|--------|
| **Ghost configuration** - Presidio env vars documented but service removed | MEDIUM | Developers may create `.env` entries for non-existent services, potentially exposing configuration habits |
| **Hidden security feature** - PIIMiddleware not documented | LOW | Developers unaware that credit card masking and API key blocking is automatic |
| **Missing distributed worker vars** - REDIS_URL, DISTRIBUTED_WORKERS undocumented | LOW | Production deployments may fail silently |
| **Stale migration commands** - Manual alembic vs Makefile | LOW | More error-prone manual approach documented |

#### Files With Outdated Documentation

| File | Issue | Lines Affected |
|------|-------|----------------|
| `/README.md` | Presidio env vars table | Lines 380-386 |
| `/backend/README.md` | Same content duplicated | Lines 380-386 |
| `/docker/README.md` | Same content duplicated | Lines 190-196 |

#### Source of Truth Comparison

| Configuration | `.example.env` | `README.md` | Status |
|---------------|----------------|-------------|--------|
| PRESIDIO_ANALYZE_HOST | Commented out | Documented | **OUT OF SYNC** |
| PRESIDIO_ANONYMIZE_HOST | Commented out | Documented | **OUT OF SYNC** |
| PRESIDIO_API_KEY | Commented out | Documented | **OUT OF SYNC** |
| REDIS_URL | Present | Missing | **OUT OF SYNC** |
| DISTRIBUTED_WORKERS | Present | Missing | **OUT OF SYNC** |

### 2.2 Proposed Changes

#### Change 1: Remove Presidio Documentation

**Rationale**: The Presidio service was completely removed in PR #676. The PIIMiddleware in `/backend/src/utils/middleware.py` now handles PII protection automatically via:
- Credit card masking (`strategy="mask"`)
- API key blocking (`strategy="block"` with regex `sk-[A-Za-z0-9]+`)

Documenting removed configuration creates security anti-patterns where developers expect to configure external services when protection is already built-in.

#### Change 2: Add Distributed Worker Documentation (Optional Section)

**Rationale**: PR #657 introduced TaskIQ-based distributed workers. The `.example.env` already contains:
```bash
## Distributed Workers (TaskIQ)
REDIS_URL=redis://localhost:6379/0
DISTRIBUTED_WORKERS=false
```

For production scalability, operators need this documented.

#### Change 3: Modernize Development Commands

**Rationale**: The Makefile provides standardized commands that reduce:
- Environment configuration errors
- Inconsistent development setups
- Onboarding time for new developers

Current README uses manual `alembic` commands while `backend/CLAUDE.md` and the Makefile provide cleaner alternatives.

### 2.3 Integration Points and Dependencies

| Component | Dependency | Risk |
|-----------|------------|------|
| README.md | None | No code changes |
| backend/README.md | README.md | Keep in sync |
| docker/README.md | README.md | Keep in sync |
| .example.env | Already updated | Source of truth |
| CLAUDE.md | Already correct | Reference only |

---

## 3. Implementation Strategy

### Step-by-Step Plan

#### Phase 1: Remove Presidio Section (All READMEs)

**File**: `/README.md`
**Action**: Remove lines 380-386 (Services Alpha table)

```markdown
<!-- REMOVE THIS ENTIRE SECTION -->
#### Services (Alpha)

| Variable                  | Description                 | Default |
| ------------------------- | --------------------------- | ------- |
| `PRESIDIO_ANALYZE_HOST`   | Presidio analyze endpoint   | -       |
| `PRESIDIO_ANONYMIZE_HOST` | Presidio anonymize endpoint | -       |
| `PRESIDIO_API_KEY`        | Presidio API key            | -       |
```

**Repeat for**:
- `/backend/README.md` (same line range)
- `/docker/README.md` (lines 190-196)

#### Phase 2: Add Distributed Workers Section (Optional)

**File**: `/README.md`
**Location**: After "Tool Config" section, before "Storage"

```markdown
#### Distributed Workers (Optional)

For high-availability deployments, Orchestra supports distributed LLM streaming via Redis and TaskIQ.

| Variable              | Description                           | Default                     |
| --------------------- | ------------------------------------- | --------------------------- |
| `REDIS_URL`           | Redis connection string for task queue | `redis://localhost:6379/0` |
| `DISTRIBUTED_WORKERS` | Enable distributed worker mode        | `false`                     |

> **Note**: When `DISTRIBUTED_WORKERS=true`, you must run a separate worker process: `make dev.worker`
```

#### Phase 3: Modernize Development Section

**File**: `/README.md`
**Location**: Lines 99-118 (Setup Server Environment)

Replace manual commands with Makefile reference:

```markdown
3. **Setup Server Environment**

    Assumes you're using [astral uv](https://github.com/astral-sh/uv?tab=readme-ov-file#installation).

    ```bash
    # Change directory
    cd <project-root>/backend

    # Generate virtualenv and install dependencies
    uv venv && source .venv/bin/activate && uv sync

    # Run dev server (uses ~/.env/orchestra/.env.backend)
    make dev
    ```

    **Available Makefile Commands:**

    | Command | Description |
    |---------|-------------|
    | `make dev` | Start dev server on port 8000 |
    | `make dev.worker` | Start TaskIQ worker (for distributed mode) |
    | `make test` | Run all tests |
    | `make format` | Format code with Ruff |
    | `make seeds.user` | Seed default users |
    | `make migrate.up` | Run all pending migrations |
    | `make migrate.down` | Rollback one migration |

    See `backend/CLAUDE.md` for detailed development instructions.
```

#### Phase 4: Add PIIMiddleware Note (Security Documentation)

**File**: `/README.md`
**Location**: After "Security" in Production Considerations section

```markdown
#### Built-in PII Protection

Orchestra includes automatic PII protection via PIIMiddleware (no configuration required):
- **Credit card masking**: Numbers are automatically masked in responses
- **API key blocking**: Known API key patterns (e.g., `sk-*`) are blocked from being processed

This protection is enabled by default and requires no additional configuration.
```

### File Changes Summary

| File | Action | Estimated Lines Changed |
|------|--------|------------------------|
| `/README.md` | Edit | ~40 lines |
| `/backend/README.md` | Edit | ~10 lines |
| `/docker/README.md` | Edit | ~10 lines |

---

## 4. Design Decisions

### 4.1 Trade-offs Considered

| Decision | Alternative | Chosen Approach | Rationale |
|----------|-------------|-----------------|-----------|
| Remove vs Comment Presidio | Comment out | **Remove entirely** | Commented docs suggest feature exists; removal is cleaner |
| Document worker vars in README | Separate DEPLOYMENT.md | **README** | Single source reduces fragmentation |
| Makefile table vs inline | Inline commands | **Table format** | Scannable, consistent with existing style |
| PIIMiddleware note location | Dedicated section | **Security subsection** | Contextually appropriate for production guidance |

### 4.2 Why This Approach Over Alternatives

**Alternative 1: Minimal Change (Remove Presidio Only)**
- Pros: Smallest diff
- Cons: Misses opportunity to improve developer experience
- Rejected: Technical debt accumulates

**Alternative 2: Complete README Rewrite**
- Pros: Fresh, optimized structure
- Cons: High review burden, regression risk
- Rejected: Overkill for this issue

**Alternative 3: Symlink/Include from CLAUDE.md**
- Pros: Single source of truth
- Cons: README must be self-contained for GitHub display
- Rejected: Platform limitations

### 4.3 Alignment with Existing Patterns

- **Table format**: Matches existing env var documentation style
- **Section headers**: Uses existing emoji + title pattern
- **Command examples**: Uses existing code block format
- **No emojis in technical content**: Per CLAUDE.md guidelines

---

## 5. Risk Assessment

### 5.1 Potential Pitfalls

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing deployments | NONE | - | Documentation-only changes |
| Confusing users with removed vars | LOW | LOW | Clean removal, no deprecated notice needed for alpha feature |
| Missing other stale docs | MEDIUM | LOW | Grep verification step included |
| Inconsistency across 3 READMEs | MEDIUM | MEDIUM | Apply changes atomically |

### 5.2 Edge Cases to Handle

1. **Users with existing PRESIDIO_* in .env**
   - Impact: Variables will be ignored (no error)
   - Resolution: Not a breaking change; users can clean up at leisure

2. **Users expecting Presidio functionality**
   - Impact: May be confused when config doesn't work
   - Resolution: PIIMiddleware provides equivalent/better protection automatically

3. **Docker deployments using old README as reference**
   - Impact: May try to configure non-existent services
   - Resolution: Update docker/README.md simultaneously

4. **CI/CD scripts parsing README for env vars**
   - Impact: Unlikely but possible
   - Resolution: This is an anti-pattern; not a supported use case

### 5.3 Testing Considerations

#### Pre-Implementation Verification

```bash
# Verify Presidio is truly removed from codebase
grep -r "presidio\|Presidio" backend/src --include="*.py" | grep -v "PII"
# Expected: No results or only comments

# Verify .example.env is the source of truth
diff -u <(grep -E "^[A-Z_]+=" backend/.example.env | sort) <(grep -E "^\| \`[A-Z_]+\`" README.md | sed 's/.*`\([A-Z_]*\)`.*/\1/' | sort)
# Should show PRESIDIO_* only in README, REDIS_URL/DISTRIBUTED_WORKERS only in .example.env
```

#### Post-Implementation Verification

```bash
# No Presidio references in any README
grep -l "PRESIDIO" README.md backend/README.md docker/README.md
# Expected: No results

# Distributed worker vars documented
grep "DISTRIBUTED_WORKERS\|REDIS_URL" README.md
# Expected: Both present

# Makefile commands documented
grep "make dev\|make test\|make format" README.md
# Expected: All present
```

#### Documentation Rendering Test

1. View README.md in GitHub web interface
2. Verify tables render correctly
3. Verify code blocks have syntax highlighting
4. Verify links work

---

## 6. Estimated Complexity

### Scope: **Small**

| Metric | Assessment |
|--------|------------|
| Files changed | 3 |
| Lines changed | ~60 |
| Code complexity | None (documentation only) |
| Test requirements | Manual verification |
| Review burden | Low |

### Risk Level: **Low**

| Factor | Assessment |
|--------|------------|
| Breaking changes | None |
| Security impact | Positive (removes misleading config) |
| Rollback complexity | Trivial (git revert) |
| Cross-team coordination | None |

### Suggested Priority Order

1. **Remove Presidio section** (all 3 files) - Eliminates confusion immediately
2. **Add distributed worker section** - Enables production deployments
3. **Modernize development commands** - Improves DX
4. **Add PIIMiddleware note** - Completes security documentation

### Estimated Effort

| Task | Time |
|------|------|
| Phase 1: Remove Presidio | 5 minutes |
| Phase 2: Add workers | 10 minutes |
| Phase 3: Dev commands | 15 minutes |
| Phase 4: PII note | 5 minutes |
| Verification | 10 minutes |
| **Total** | **~45 minutes** |

---

## 7. Security-Specific Recommendations

### 7.1 Do NOT Document

- Specific API key patterns blocked by PIIMiddleware (security through obscurity helps here)
- Internal Redis authentication if used
- Any bypass mechanisms

### 7.2 DO Document

- That PII protection is automatic (sets expectations)
- That sensitive data should still not be logged (defense in depth)
- Strong secret generation for JWT_SECRET_KEY and APP_SECRET_KEY

### 7.3 Security Review Checklist

- [ ] No secrets committed in documentation examples
- [ ] No internal URLs/IPs exposed
- [ ] No vulnerable version numbers pinned
- [ ] Strong secret generation guidance included
- [ ] Default credentials clearly marked as examples only

---

## 8. Summary

This proposal addresses documentation drift between the codebase and README by:

1. **Removing obsolete Presidio configuration** - Eliminates developer confusion and false security expectations
2. **Adding distributed worker documentation** - Enables production scalability
3. **Modernizing development commands** - Reduces onboarding friction and configuration errors
4. **Documenting built-in PII protection** - Sets correct security expectations

The changes are low-risk, documentation-only modifications that bring the README into alignment with the actual system behavior. No code changes are required, and the implementation can be completed in under an hour with minimal review burden.

---

## Appendix: Cross-Reference Validation

### Files Verified

| File | Status | Notes |
|------|--------|-------|
| `/backend/src/utils/middleware.py` | CURRENT | PIIMiddleware active |
| `/backend/.example.env` | CURRENT | Source of truth for env vars |
| `/backend/Makefile` | CURRENT | Commands documented |
| `/backend/CLAUDE.md` | CURRENT | Detailed dev instructions |
| `/.claude/specs/feat-675-cleanup-presidio/REVIEW.md` | MERGED | Presidio removal complete |
| `/.claude/specs/feat-656-distributed-workers-taskiq/FRONTEND-SPEC.md` | MERGED | Worker vars documented |

### Grep Results Summary

```
PRESIDIO references in README: 3 files (to be removed)
PRESIDIO references in backend/src: 0 files (already cleaned)
PIIMiddleware references: Active in middleware.py
DISTRIBUTED_WORKERS in .example.env: Present (line 56)
REDIS_URL in .example.env: Present (line 55)
```
