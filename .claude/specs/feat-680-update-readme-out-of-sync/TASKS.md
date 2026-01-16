# Implementation Tasks: Update README.md (Issue #680)

**Created:** 2026-01-16
**Based on:** REVIEW.md Council Synthesis
**Scope:** Small | **Risk:** Low

---

## Pre-Implementation

- [x] Verify development environment setup
- [x] Review REVIEW.md council decisions
- [x] Confirm current working directory is `.worktrees/feat-680`

## Core Implementation

### Task 1: Remove Presidio Section from README.md
- **Files:** `README.md`
- **Lines:** 380-386 (Services Alpha section)
- **Action:** Delete entire section
- **Acceptance:** `grep -i "presidio" README.md` returns no results

### Task 2: Remove Presidio Section from docker/README.md
- **Files:** `docker/README.md`
- **Lines:** 190-196 (Services Alpha section)
- **Action:** Delete entire section
- **Acceptance:** `grep -i "presidio" docker/README.md` returns no results

### Task 3: Add Distributed Workers Section to README.md
- **Files:** `README.md`
- **Location:** Replace removed Services Alpha section
- **Content:**
```markdown
#### Distributed Workers (Optional)

| Variable              | Description                           | Default |
| --------------------- | ------------------------------------- | ------- |
| `REDIS_URL`           | Redis connection for task queue       | -       |
| `DISTRIBUTED_WORKERS` | Enable distributed worker mode        | `false` |

> **Note**: When enabled, run the worker process separately: `make dev.worker`
```
- **Acceptance:** `grep "DISTRIBUTED_WORKERS\|REDIS_URL" README.md` returns matches

### Task 4: Add Distributed Workers Section to docker/README.md
- **Files:** `docker/README.md`
- **Location:** Replace removed Services Alpha section
- **Content:** Same as Task 3
- **Acceptance:** `grep "DISTRIBUTED_WORKERS\|REDIS_URL" docker/README.md` returns matches

### Task 5: Add redis/worker to Docker Services Table
- **Files:** `README.md`
- **Location:** After `ollama` row in Docker Compose Services table (~line 286)
- **Content:**
```markdown
| `redis`         | 6379      | Redis message broker (for workers) |
| `worker`        | -         | TaskIQ worker (no exposed port)    |
```
- **Acceptance:** `grep "redis.*6379\|worker.*TaskIQ" README.md` returns matches

### Task 6: Add Makefile Quick Reference Table
- **Files:** `README.md`
- **Location:** After "## Development" header, before "Environment Variables"
- **Content:**
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
- **Acceptance:** Table rendered correctly, commands match backend/Makefile

### Task 7: Streamline Server Setup Section
- **Files:** `README.md`
- **Location:** Lines 99-118 (Setup Server Environment)
- **Action:** Update to prefer Makefile commands, keep manual as optional
- **Content:**
```markdown
3. **Setup Server Environment**

    ```bash
    cd <project-root>/backend
    make dev
    ```

    <details>
    <summary>Manual setup (if Makefile unavailable)</summary>

    Assumes you're using [astral uv](https://github.com/astral-sh/uv?tab=readme-ov-file#installation).

    ```bash
    cd <project-root>/backend
    uv venv
    source .venv/bin/activate
    uv sync
    bash scripts/dev.sh
    ```
    </details>
```
- **Acceptance:** Section shows `make dev` prominently with manual fallback

## Verification

- [x] `grep -ri "presidio" README.md docker/README.md` returns no results
- [x] `grep "DISTRIBUTED_WORKERS" README.md docker/README.md` returns matches in both files
- [x] `grep "make dev" README.md` returns matches for quick reference and setup
- [ ] README.md renders correctly in GitHub preview
- [ ] docker/README.md renders correctly in GitHub preview
- [ ] All internal anchor links work

## Post-Implementation

- [ ] Stage all changes: `git add README.md docker/README.md`
- [ ] Commit with descriptive message
- [ ] Verify commit succeeded

---

## Completion Signature

- **Total Tasks:** 7 core tasks + verification
- **Estimated Effort:** ~45 minutes
- **Dependencies:** None (PRs #676 and #657 already merged)
- **Risk:** Low (documentation only, trivial rollback)

---

## Progress Log

- [x] Task 1: Removed Presidio section from README.md - 2026-01-16
- [x] Task 2: Removed Presidio section from docker/README.md - 2026-01-16
- [x] Task 3: Added Distributed Workers section to README.md - 2026-01-16
- [x] Task 4: Added Distributed Workers section to docker/README.md - 2026-01-16
- [x] Task 5: Added redis/worker to Docker Services tables in both files - 2026-01-16
- [x] Task 6: Added Makefile Quick Reference table to README.md - 2026-01-16
- [x] Task 7: Streamlined Server Setup section with collapsible manual fallback - 2026-01-16

## Validation Results

**Status: PASS**

### Verification Commands Executed:
1. `grep -ri "presidio" README.md docker/README.md` - No results (PASS)
2. `grep "DISTRIBUTED_WORKERS" README.md docker/README.md` - Found in both files (PASS)
3. `grep "make dev" README.md` - Found in quick reference and setup sections (PASS)

### Summary:
- All Presidio references successfully removed
- Distributed worker documentation added to both README files
- Docker services tables updated with redis/worker entries
- Development section modernized with Makefile commands
- Server setup streamlined with collapsible manual fallback

