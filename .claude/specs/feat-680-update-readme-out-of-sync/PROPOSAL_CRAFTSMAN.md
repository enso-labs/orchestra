# PROPOSAL: Update README.md (Out-of-Sync) - Issue #680

## Agent: THE CRAFTSMAN
**Expertise Focus:** Clean Code, Maintainability, SOLID Principles Applied to Documentation

---

## 1. Executive Summary

The README.md documentation has drifted out of sync with the actual codebase following PR #676 (Presidio removal) and PR #657 (distributed workers). This proposal recommends a targeted, maintainable update that:

1. **Removes obsolete Presidio references** from the environment variables documentation
2. **Adds distributed worker configuration** to align with the new `.example.env` and docker-compose.yml
3. **Streamlines development instructions** by promoting Makefile commands as the primary interface
4. **Ensures alignment** between README.md, docker/README.md, backend/README.md, and CLAUDE.md

---

## 2. Architectural Analysis

### 2.1 Current State Assessment

#### Files Requiring Updates

| File | Issue | Lines Affected |
|------|-------|----------------|
| `README.md` | Contains obsolete "Services (Alpha)" Presidio section | 380-386 |
| `README.md` | Missing distributed worker env vars (REDIS_URL, DISTRIBUTED_WORKERS) | N/A (need to add) |
| `README.md` | Development section uses verbose manual commands | 99-131 |
| `docker/README.md` | Contains same obsolete Presidio section | 190-196 |
| `backend/README.md` | Identical to root README.md (copied during build) | Same as root |

#### Documentation Hierarchy

```
CLAUDE.md (AI Agent source of truth)
    |
    +-- README.md (Human developer primary reference)
    |       |
    |       +-- Duplicated to backend/README.md during docker build
    |
    +-- docker/README.md (Docker-specific deployment guide)
```

**Key Insight:** `backend/README.md` is auto-generated from either `README.md` or `docker/README.md` via `scripts/build.sh`. Only `README.md` and `docker/README.md` need direct updates.

### 2.2 Proposed Changes

#### A. Remove Presidio References (Breaking Change from PR #676)

The Presidio service has been completely removed and replaced by PIIMiddleware, which requires no user configuration. The "Services (Alpha)" section is now obsolete.

**Current (README.md lines 380-386):**
```markdown
#### Services (Alpha)

| Variable                  | Description                 | Default |
| ------------------------- | --------------------------- | ------- |
| `PRESIDIO_ANALYZE_HOST`   | Presidio analyze endpoint   | -       |
| `PRESIDIO_ANONYMIZE_HOST` | Presidio anonymize endpoint | -       |
| `PRESIDIO_API_KEY`        | Presidio API key            | -       |
```

**Proposed:** Remove this section entirely. PII handling is now automatic via middleware.

#### B. Add Distributed Workers Configuration (New Feature from PR #657)

The `.example.env` now includes worker configuration that should be documented:

**Proposed new section (replace "Services (Alpha)"):**
```markdown
#### Distributed Workers (Optional)

| Variable              | Description                              | Default   |
| --------------------- | ---------------------------------------- | --------- |
| `REDIS_URL`           | Redis connection URL for worker queue    | -         |
| `DISTRIBUTED_WORKERS` | Enable distributed worker mode           | `false`   |
```

#### C. Streamline Development Instructions (Maintainability)

**Current Problem:** The development section (lines 99-131) uses verbose manual commands that duplicate Makefile functionality and are harder to maintain.

**Proposed Enhancement:** Restructure to highlight Makefile commands while preserving manual commands for advanced users.

**Current (lines 99-118):**
```markdown
3. **Setup Server Environment**

    Assumes you're using [astral uv](https://github.com/astral-sh/uv?tab=readme-ov-file#installation). See `./backend/scripts` directory for other dev utilities.

    ```bash
    # Change directory
    cd <project-root>/backend

    # Generate virtualenv
    uv venv

    # Activate
    source .venv/bin/activate

    # Install
    uv sync

    # Run
    bash scripts/dev.sh # Select "no" when prompted.
    ```
```

**Proposed:**
```markdown
3. **Setup Server Environment**

    Assumes you're using [astral uv](https://github.com/astral-sh/uv?tab=readme-ov-file#installation).

    ```bash
    cd <project-root>/backend

    # Option A: Quick Start (Recommended)
    make dev  # Starts dev server on port 8000

    # Option B: Manual Setup
    uv venv && source .venv/bin/activate && uv sync
    bash scripts/dev.sh
    ```

    **Common Backend Commands:**

    | Command           | Description                    |
    |-------------------|--------------------------------|
    | `make dev`        | Run dev server on port 8000    |
    | `make test`       | Run all tests                  |
    | `make format`     | Format code with Ruff          |
    | `make seeds.user` | Seed default users             |
```

### 2.3 Integration Points and Dependencies

| Dependency | Impact | Action Required |
|------------|--------|-----------------|
| `backend/.example.env` | Already updated in PR #657 | No action (source of truth for env vars) |
| `docker-compose.yml` | Already includes worker/redis services | Document in README |
| `CLAUDE.md` | Already documents Makefile commands | Align README with CLAUDE.md |
| `docker/README.md` | Mirrors root README structure | Apply same Presidio removal |

---

## 3. Implementation Strategy

### 3.1 Step-by-Step Implementation Plan

#### Phase 1: Remove Obsolete Content (Priority: High)

**Step 1.1:** Edit `README.md` lines 380-386 - Remove "Services (Alpha)" section

**Step 1.2:** Edit `docker/README.md` lines 190-196 - Remove matching "Services (Alpha)" section

**Step 1.3:** Verify no other Presidio references exist in README files
```bash
grep -i "presidio" README.md docker/README.md
# Expected: No matches
```

#### Phase 2: Add Distributed Workers Section (Priority: Medium)

**Step 2.1:** In `README.md`, replace the removed "Services (Alpha)" section (after line 378) with:

```markdown
#### Distributed Workers (Optional)

For high-throughput deployments, Orchestra supports distributed worker mode using Redis and TaskIQ.

| Variable              | Description                              | Default   |
| --------------------- | ---------------------------------------- | --------- |
| `REDIS_URL`           | Redis connection URL for worker queue    | -         |
| `DISTRIBUTED_WORKERS` | Enable distributed worker mode           | `false`   |

> **Note:** When `DISTRIBUTED_WORKERS=true`, ensure Redis is available and run the worker process separately:
> ```bash
> make dev.worker  # In a separate terminal
> ```
```

**Step 2.2:** Apply the same addition to `docker/README.md` after removing Presidio section

**Step 2.3:** Update docker-compose services table to include `redis` and `worker`:

In `README.md` around line 278, add:
```markdown
| `redis`         | 6379      | Redis message broker (for workers)     |
| `worker`        | -         | TaskIQ worker (no external port)       |
```

#### Phase 3: Streamline Development Section (Priority: Low)

**Step 3.1:** Update "Setup Server Environment" section (lines 99-118) to promote Makefile commands

**Step 3.2:** Add a condensed "Common Commands" table after the setup instructions

**Step 3.3:** Align "Database Migrations" section (lines 133-171) to reference Makefile commands:

**Current (verbose Alembic commands):**
```markdown
### Initial Setup

1. Create the database (if not exists):

    ```bash
    cd backend
    alembic upgrade head
    ```
```

**Proposed (Makefile-first):**
```markdown
### Initial Setup

1. Apply all migrations:

    ```bash
    cd backend
    make migrate.up  # or: alembic upgrade head
    ```
```

### 3.2 File Changes Summary

| File | Change Type | Lines | Description |
|------|-------------|-------|-------------|
| `README.md` | DELETE | 380-386 | Remove "Services (Alpha)" section |
| `README.md` | INSERT | ~380 | Add "Distributed Workers" section |
| `README.md` | UPDATE | ~278-286 | Add redis/worker to services table |
| `README.md` | UPDATE | 99-118 | Streamline server setup with Makefile |
| `README.md` | UPDATE | 133-171 | Update migration docs to use Makefile |
| `docker/README.md` | DELETE | 190-196 | Remove "Services (Alpha)" section |
| `docker/README.md` | INSERT | ~190 | Add "Distributed Workers" section |

### 3.3 Key Patterns to Follow

1. **Table Format Consistency:** Use the existing markdown table alignment style with `|` padding
2. **Code Block Style:** Use triple-backtick with language hints (bash, yaml, markdown)
3. **Section Headers:** Use `####` for subsections within the Environment Variables section
4. **Note Blocks:** Use `> **Note:**` for callouts
5. **Cross-Reference Style:** Link to other sections using `#-section-name` anchors

---

## 4. Design Decisions

### 4.1 Trade-offs Considered

| Decision | Alternative Considered | Why This Approach |
|----------|------------------------|-------------------|
| **Remove Presidio entirely** vs comment it out | Keep section with "deprecated" note | Clean removal follows YAGNI - obsolete docs cause confusion |
| **Add Worker docs to README** vs separate doc | Create new WORKERS.md | Keep entry point simple; advanced users can reference docker-compose.yml |
| **Promote Makefile** vs keep manual commands | Only show Makefile commands | Balance: Show Makefile first, keep manual for flexibility |
| **Update both README.md and docker/README.md** | Only update root README | Consistency across all entry points prevents confusion |

### 4.2 Why This Approach Over Alternatives

**Single Responsibility (Documentation SOLID):**
- README.md = Quick start + development overview
- docker/README.md = Docker-specific deployment details
- CLAUDE.md = AI agent reference (already well-structured)

**DRY Principle:**
- The Makefile encapsulates common commands
- Documentation should point to Makefile rather than duplicate command logic
- When Makefile commands change, only Makefile and CLAUDE.md need updates

**Open/Closed Principle:**
- New features (workers) are added as new sections, not modifications to existing sections
- Removal of features (Presidio) cleanly removes entire sections

### 4.3 Alignment with Existing Codebase Patterns

- **Markdown Style:** Follows existing heading hierarchy (##, ###, ####)
- **Table Alignment:** Matches existing pipe-aligned tables
- **Code Examples:** Uses existing bash code block pattern with comments
- **Variable Documentation:** Follows Variable | Description | Default pattern

---

## 5. Risk Assessment

### 5.1 Potential Pitfalls

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Missing Presidio reference elsewhere** | Low | Low | Grep verification after changes |
| **Breaking docker build** | Very Low | Medium | backend/README.md is copied from docker/README.md during build; verify build script |
| **Inconsistency between files** | Medium | Low | Update both README.md and docker/README.md in same commit |
| **Worker docs premature** | Low | Low | Mark as "Optional" and reference docker-compose for full config |

### 5.2 Edge Cases to Handle

1. **Users with existing .env files containing PRESIDIO vars:**
   - These vars are now no-ops; no action needed
   - Consider adding migration note: "PRESIDIO_* variables can be safely removed"

2. **Users running older docker-compose without redis:**
   - Workers are optional; document as enhancement, not requirement
   - `DISTRIBUTED_WORKERS=false` (default) works without Redis

3. **CI/CD pipelines referencing old env vars:**
   - Workflows already updated in PR #657
   - README update is documentation catch-up only

### 5.3 Testing Considerations

| Test Type | Approach |
|-----------|----------|
| **Link Validation** | Verify all anchor links resolve correctly |
| **Markdown Lint** | Run markdownlint to catch formatting issues |
| **Visual Review** | Preview rendered markdown on GitHub before merge |
| **Grep Verification** | `grep -i presidio README.md docker/README.md` should return empty |
| **Build Test** | Run `bash backend/scripts/build.sh` to verify no README-related errors |

---

## 6. Estimated Complexity

| Metric | Assessment |
|--------|------------|
| **Scope** | **Small** - Documentation-only changes to 2 files |
| **Risk Level** | **Low** - No code changes, only documentation |
| **Estimated Time** | 30-45 minutes for implementation |
| **Review Effort** | Low - Straightforward line-by-line comparison |

### 6.1 Suggested Priority Order

1. **P0 (Must-Have):** Remove Presidio section from README.md and docker/README.md
2. **P1 (Should-Have):** Add Distributed Workers section
3. **P1 (Should-Have):** Update docker-compose services table with redis/worker
4. **P2 (Nice-to-Have):** Streamline development section with Makefile commands
5. **P2 (Nice-to-Have):** Update migration section with Makefile references

### 6.2 Minimal Viable Change

If time-constrained, the absolute minimum change is:
- Delete lines 380-386 in README.md (Presidio section)
- Delete lines 190-196 in docker/README.md (Presidio section)

This removes the documented-but-nonexistent feature, preventing user confusion.

---

## 7. Verification Checklist

After implementation, verify:

- [ ] `grep -i presidio README.md docker/README.md` returns no matches
- [ ] `grep -i "REDIS_URL\|DISTRIBUTED_WORKERS" README.md` returns matches in new section
- [ ] Markdown renders correctly in GitHub preview
- [ ] All internal anchor links work (#-section-name)
- [ ] `bash backend/scripts/build.sh` completes without errors
- [ ] CLAUDE.md remains aligned (already correct - no changes needed)
- [ ] `.example.env` already has correct variables (verified - no changes needed)

---

## 8. Appendix: Diff Preview

### README.md - Remove Presidio (lines 380-386)

```diff
-#### Services (Alpha)
-
-| Variable                  | Description                 | Default |
-| ------------------------- | --------------------------- | ------- |
-| `PRESIDIO_ANALYZE_HOST`   | Presidio analyze endpoint   | -       |
-| `PRESIDIO_ANONYMIZE_HOST` | Presidio anonymize endpoint | -       |
-| `PRESIDIO_API_KEY`        | Presidio API key            | -       |
+#### Distributed Workers (Optional)
+
+For high-throughput deployments, Orchestra supports distributed worker mode using Redis and TaskIQ.
+
+| Variable              | Description                              | Default   |
+| --------------------- | ---------------------------------------- | --------- |
+| `REDIS_URL`           | Redis connection URL for worker queue    | -         |
+| `DISTRIBUTED_WORKERS` | Enable distributed worker mode           | `false`   |
+
+> **Note:** When `DISTRIBUTED_WORKERS=true`, ensure Redis is available and run the worker process separately:
+> ```bash
+> make dev.worker  # In a separate terminal
+> ```
```

### README.md - Services Table Update (around line 286)

```diff
 | `search_engine` | 8080      | SearXNG search engine              |
 | `exec_server`   | 3005      | Shell execution server             |
 | `ollama`        | 11434     | Local LLM inference (requires GPU) |
+| `redis`         | 6379      | Redis message broker (for workers) |
+| `worker`        | -         | TaskIQ worker (no exposed port)    |
```

---

**Prepared by:** THE CRAFTSMAN
**Date:** 2026-01-16
**Issue Reference:** GitHub Issue #680
**Related PRs:** #676 (Presidio removal), #657 (Distributed workers)
