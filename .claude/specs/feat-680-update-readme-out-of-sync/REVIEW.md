# COUNCIL REVIEW: GitHub Issue #680 - Update README.md (Out-of-Sync)

**Review Date:** 2026-01-16
**Proposals Reviewed:** ARCHITECT, CRAFTSMAN, GUARDIAN
**Feature Under Review:** Update README.md to reflect Presidio removal (PR #676) and distributed workers (PR #657)

---

## 1. Proposal Comparison Matrix

| Aspect | ARCHITECT | CRAFTSMAN | GUARDIAN | Council Verdict |
|--------|-----------|-----------|----------|-----------------|
| **Scope Assessment** | Small (~80-100 lines) | Small (2 files) | Small (~60 lines) | **Small** - All agree |
| **Risk Level** | Low | Low | Low | **Low** - Unanimous |
| **Primary Focus** | Structure & organization | Maintainability & DRY | Security & edge cases | Complementary strengths |
| **Presidio Action** | Remove entirely | Remove entirely | Remove entirely | **Remove entirely** |
| **Worker Docs** | Add new section | Add new section | Add new section | **Add new section** |
| **Files to Update** | 2 (README.md, docker/README.md) | 2 | 3 (includes backend/README.md) | **2 files** (see note below) |
| **Makefile Table** | Yes, detailed | Yes, streamlined | Yes, comprehensive | **Yes - include table** |
| **Collapsible Manual** | Yes (details block) | No (inline) | No (inline) | **Optional** - nice to have |

**Note on Files:** GUARDIAN identified `backend/README.md` but build script copies `docker/README.md` to `backend/README.md`. We only need to modify `README.md` and `docker/README.md`.

---

## 2. Consensus Points

All three proposals unanimously agree on:

1. **Remove the "Services (Alpha)" Presidio section entirely** - Lines 380-386 in README.md and 190-196 in docker/README.md
2. **Add Distributed Workers section** with REDIS_URL and DISTRIBUTED_WORKERS variables
3. **Add Makefile commands table** to improve developer onboarding
4. **Keep manual commands available** as fallback for advanced users
5. **This is documentation-only** - zero code risk, trivial rollback
6. **Total effort: ~45 minutes** including verification

---

## 3. Divergence Analysis

### 3.1 Docker Services Table Update

| Proposal | Recommendation |
|----------|----------------|
| ARCHITECT | Update to add redis/worker services |
| CRAFTSMAN | Explicitly add redis/worker to table |
| GUARDIAN | Not mentioned |

**Council Decision:** Include redis and worker in the Docker Compose services table. This aligns with the docker-compose.yml that already defines these services.

### 3.2 PIIMiddleware Documentation

| Proposal | Recommendation |
|----------|----------------|
| ARCHITECT | Not mentioned |
| CRAFTSMAN | Not mentioned |
| GUARDIAN | Add "Built-in PII Protection" note |

**Council Decision:** Skip PIIMiddleware documentation for this PR. While informative, it's out of scope for the immediate issue (removing Presidio refs, adding worker vars). Can be addressed in a follow-up.

### 3.3 Database Migration Section

| Proposal | Recommendation |
|----------|----------------|
| ARCHITECT | Rewrite with Makefile commands |
| CRAFTSMAN | Update to reference Makefile |
| GUARDIAN | Not specifically addressed |

**Council Decision:** Update the migration section to show Makefile commands first, keep manual alembic as collapsed details. This is a "nice to have" for this PR.

---

## 4. Unified Implementation Plan

### Priority Order (Must Have → Nice to Have)

| Phase | Task | Priority | Files |
|-------|------|----------|-------|
| 1 | Remove Presidio section | **P0** | README.md, docker/README.md |
| 2 | Add Distributed Workers section | **P1** | README.md, docker/README.md |
| 3 | Add redis/worker to Docker services table | **P1** | README.md |
| 4 | Add Makefile commands quick reference table | **P2** | README.md |
| 5 | Streamline development setup section | **P2** | README.md |
| 6 | Modernize database migrations section | **P3** | README.md |

### Recommended Architecture (from ARCHITECT)

Use collapsible `<details>` blocks for manual commands to keep the README scannable while preserving advanced options:

```markdown
**Quick Start:**
```bash
make dev
```

<details>
<summary>Manual setup (if needed)</summary>
... manual commands here ...
</details>
```

### Content Specifications

#### Distributed Workers Section (insert after Storage section, replacing Services Alpha)

```markdown
#### Distributed Workers (Optional)

| Variable              | Description                           | Default |
| --------------------- | ------------------------------------- | ------- |
| `REDIS_URL`           | Redis connection for task queue       | -       |
| `DISTRIBUTED_WORKERS` | Enable distributed worker mode        | `false` |

> **Note**: When enabled, run the worker process separately: `make dev.worker`
```

#### Docker Services Table Addition (line ~286)

```markdown
| `redis`         | 6379      | Redis message broker (for workers) |
| `worker`        | -         | TaskIQ worker (no exposed port)    |
```

#### Makefile Commands Table (after Development section header)

```markdown
### Quick Reference

| Command           | Description                      |
|-------------------|----------------------------------|
| `make dev`        | Start backend server (port 8000) |
| `make dev.worker` | Start TaskIQ worker              |
| `make test`       | Run all backend tests            |
| `make format`     | Format code with Ruff            |
| `make seeds.user` | Seed default users               |
| `make migrate.up` | Apply all pending migrations     |

For all commands, see `backend/Makefile`.
```

---

## 5. Risk Consolidation

### Combined Risk Assessment

| Risk | Source | Likelihood | Impact | Mitigation |
|------|--------|------------|--------|------------|
| Broken markdown formatting | All | Low | Low | Preview in GitHub before merge |
| Missing Presidio reference elsewhere | All | Low | Low | Grep verification: `grep -ri "presidio" *.md` |
| Inconsistency between README files | All | Medium | Medium | Update both files atomically in same commit |
| Line number drift from concurrent PRs | ARCHITECT | Medium | Low | Use text patterns, not line numbers |
| Users with existing PRESIDIO_* env vars | GUARDIAN | Low | None | Variables are no-ops; no breaking change |

### Mitigation Strategy

1. **Pre-commit check**: Verify all changes compile correctly in markdown
2. **Grep verification**: After changes, ensure no presidio references remain
3. **Atomic commit**: Both README.md and docker/README.md updated together
4. **Visual verification**: Preview rendered markdown in GitHub before PR approval

---

## 6. Final Verdict

### Decision: **GO**

| Criteria | Assessment |
|----------|------------|
| Scope | Small (documentation only) |
| Risk | Low (trivial rollback) |
| Value | High (removes confusion, improves DX) |
| Effort | ~45 minutes |
| Dependencies | None (PRs #676 and #657 already merged) |

### Confidence Level: **HIGH**

All three expert agents reached the same conclusions. The implementation is straightforward, low-risk, and addresses a real documentation gap.

### Required Conditions

1. Remove Presidio section from both README.md and docker/README.md
2. Add Distributed Workers section to both files
3. Verify with grep that no Presidio references remain

### Optional Enhancements (can be omitted if time-constrained)

- Add Makefile commands quick reference table
- Update development section with streamlined commands
- Modernize database migrations section

---

## 7. Implementation Contract

The following will be implemented based on council synthesis:

### Must Complete (P0/P1)
- [x] Remove "Services (Alpha)" section from README.md (lines 380-386)
- [x] Remove "Services (Alpha)" section from docker/README.md (lines 190-196)
- [x] Add "Distributed Workers (Optional)" section to README.md
- [x] Add "Distributed Workers (Optional)" section to docker/README.md
- [x] Add redis/worker to Docker Compose services table in README.md

### Should Complete (P2)
- [x] Add Makefile commands quick reference table to README.md
- [x] Streamline development setup section with Makefile commands

### Nice to Have (P3)
- [ ] Modernize database migrations section (defer to follow-up if time constrained)

---

**Council Review Complete**
**Approved for Implementation**
