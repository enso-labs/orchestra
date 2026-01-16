# PROPOSAL: ARCHITECT
## GitHub Issue #680: Update README.md (out-of-sync)

---

## 1. EXECUTIVE SUMMARY

The README.md requires targeted updates to remove deprecated Presidio documentation, add distributed worker environment variables, modernize development instructions with Makefile commands, and align database migration documentation with current tooling. This is a **documentation-only** change with **zero code impact** - the goal is to bring README.md into alignment with the actual codebase state after PRs #676 (Presidio removal) and #657 (distributed workers).

---

## 2. ARCHITECTURAL ANALYSIS

### 2.1 Current State Assessment

**README Structure Overview:**
```
README.md (466 lines)
├── Header & Badges (1-33)
├── Deployment Options (41-48)
├── Table of Contents (51-57)
├── Docker Deployment Quick (58-64)
├── Prerequisites (66-70)
├── Development Section (72-131)           ← NEEDS UPDATE
│   ├── Environment Variables (74-86)
│   ├── Docker Services (90-97)
│   ├── Server Environment (99-118)        ← Manual commands, should use Makefile
│   └── Client Environment (120-131)
├── Database Migrations (133-171)          ← Manual alembic, should use Makefile
├── Playwright MCP (173-188)
├── Integrations (190-193)
├── Roadmap (195-198)
├── Enterprise (201-214)
├── Docker Deployment Full (217-465)
│   ├── Environment Variables (343-396)
│   │   └── Services (Alpha) (380-386)     ← PRESIDIO REFERENCES - REMOVE
│   └── ...rest
```

### 2.2 Issues Identified

| Issue | Location | Severity | Impact |
|-------|----------|----------|--------|
| Presidio env vars documented | Lines 380-386 | HIGH | Confuses users with non-existent config |
| Manual server setup commands | Lines 99-118 | MEDIUM | Missed opportunity for streamlined onboarding |
| Manual migration commands | Lines 133-171 | MEDIUM | Inconsistent with Makefile patterns |
| Missing distributed worker vars | Env var tables | MEDIUM | Users can't configure worker mode |
| Duplicate Docker README content | Lines 217-465 vs `/docker/README.md` | LOW | Maintenance burden |

### 2.3 Files Requiring Changes

| File | Change Type | Scope |
|------|-------------|-------|
| `/README.md` | MODIFY | Primary target - all issues addressed here |
| `/docker/README.md` | MODIFY | Remove Presidio, add distributed workers |
| `/backend/README.md` | VERIFY | Check for Presidio references |

### 2.4 Related Documentation State

**CLAUDE.md already documents:**
- `make test` - Run ALL test cases
- `make format` - Format project files
- `make dev` - Run dev server
- `make seeds.user` - Seed default users

**Backend Makefile provides:**
- `make migrate.up` - Run all pending migrations
- `make migrate.down` - Rollback one migration
- `make migrate.history` - View migration history
- `make migrate.revision` - Create new migration
- `make dev.worker` - Run TaskIQ worker

**Backend `.example.env` includes (from PR #657):**
```bash
## Distributed Workers (TaskIQ)
REDIS_URL=redis://localhost:6379/0
DISTRIBUTED_WORKERS=false
```

---

## 3. IMPLEMENTATION STRATEGY

### Phase 1: Remove Deprecated Presidio Documentation

**Step 1.1: Remove from README.md (lines 380-386)**

Current (to be removed):
```markdown
#### Services (Alpha)

| Variable                  | Description                 | Default |
| ------------------------- | --------------------------- | ------- |
| `PRESIDIO_ANALYZE_HOST`   | Presidio analyze endpoint   | -       |
| `PRESIDIO_ANONYMIZE_HOST` | Presidio anonymize endpoint | -       |
| `PRESIDIO_API_KEY`        | Presidio API key            | -       |
```

**Step 1.2: Remove from docker/README.md (lines 190-197)**

Same Presidio section exists in the docker-specific README.

### Phase 2: Add Distributed Worker Documentation

**Step 2.1: Add new environment variable section**

Add after "Storage" section in README.md:
```markdown
#### Distributed Workers (Optional)

| Variable              | Description                           | Default     |
| --------------------- | ------------------------------------- | ----------- |
| `REDIS_URL`           | Redis connection for worker queue     | -           |
| `DISTRIBUTED_WORKERS` | Enable distributed LLM execution      | `false`     |

> **Note**: Distributed workers require Redis and TaskIQ. Use `make dev.worker` to start a worker process locally.
```

### Phase 3: Modernize Development Section

**Step 3.1: Add Makefile commands table**

Insert after "Setup Server Environment" section header:
```markdown
### Common Development Commands

| Command           | Description                        |
|-------------------|------------------------------------|
| `make dev`        | Start backend server (port 8000)   |
| `make test`       | Run all backend tests              |
| `make format`     | Format code with Ruff              |
| `make seeds.user` | Seed default users                 |
| `make migrate.up` | Apply all pending migrations       |

For a complete list, see `backend/Makefile`.
```

**Step 3.2: Streamline server setup instructions**

Update the server setup to prefer Makefile while keeping manual commands as reference:
```markdown
**Using Makefile (Recommended):**
```bash
cd backend
make dev
```

**Manual Setup (if needed):**
[existing commands retained for reference]
```

### Phase 4: Modernize Database Migrations Section

**Step 4.1: Replace manual alembic commands with Makefile**

Update "Database Migrations" section:
```markdown
## Database Migrations

### Using Makefile (Recommended)

```bash
cd backend

# Apply all migrations
make migrate.up

# Rollback one migration
make migrate.down

# View migration history
make migrate.history

# Create new migration
make migrate.revision
```

### Seeding Initial Data

```bash
make seeds.user
```
```

---

## 4. DESIGN DECISIONS

### 4.1 Trade-offs Considered

| Decision | Alternative | Rationale |
|----------|-------------|-----------|
| Keep manual commands as fallback | Remove entirely | Some users may need flexibility or be debugging |
| Add distributed workers to README | Separate WORKERS.md | Workers are production-relevant; single README preferred |
| Mirror changes to docker/README.md | Only update root README | Docker README is bundled into image; must stay in sync |

### 4.2 Why This Approach

1. **Single Source of Truth**: CLAUDE.md already documents Makefile commands; README should align
2. **Backward Compatibility**: Manual commands remain for users who need them
3. **Progressive Enhancement**: Distributed workers documented but marked optional
4. **Consistency**: All env var tables follow same markdown format

### 4.3 Alignment with Codebase Patterns

- **CLAUDE.md Convention**: Development commands use Makefile (this proposal extends that pattern to README)
- **Env Var Tables**: Existing format with Variable | Description | Default columns preserved
- **Section Headers**: Existing emoji + title format maintained (e.g., "## :tools: Development")

---

## 5. RISK ASSESSMENT

### 5.1 Low-Risk Factors

1. **Documentation Only**: No code changes = no runtime risk
2. **Additive Changes**: New sections don't break existing workflows
3. **Clear Precedent**: CLAUDE.md already establishes Makefile pattern
4. **Tested Configuration**: `.example.env` already contains worker vars

### 5.2 Potential Pitfalls

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Broken markdown formatting | Low | Preview rendered output before commit |
| Outdated info in docker/README.md | Medium | Update both files in same PR |
| Missing Presidio reference elsewhere | Low | Grep for "presidio" across all .md files |
| Line number drift from concurrent PRs | Medium | Use text patterns, not line numbers |

### 5.3 Testing Considerations

- **Manual Review**: Render README.md in GitHub preview
- **Link Verification**: Ensure all internal anchor links work
- **Grep Verification**: `grep -ri "presidio" *.md` should return no results after changes

---

## 6. ESTIMATED COMPLEXITY

### Scope: **SMALL**

| Metric | Value |
|--------|-------|
| Files to modify | 2 (README.md, docker/README.md) |
| Sections to add | 2 (Distributed Workers, Makefile commands) |
| Sections to remove | 1 (Services Alpha / Presidio) |
| Sections to rewrite | 2 (Development, Database Migrations) |
| Total lines changed | ~80-100 |

### Risk Level: **LOW**

- No code changes
- No database migrations
- No breaking API changes
- Purely documentation synchronization

### Suggested Priority Order

1. **P1 (Must Have)**: Remove Presidio documentation (lines 380-386)
2. **P1 (Must Have)**: Update docker/README.md to mirror changes
3. **P2 (Should Have)**: Add Distributed Workers environment variables
4. **P3 (Nice to Have)**: Modernize Development section with Makefile commands
5. **P3 (Nice to Have)**: Modernize Database Migrations section

---

## 7. DETAILED CHANGE SPECIFICATIONS

### 7.1 README.md Changes

#### Change 1: Remove Services (Alpha) Section (Lines 380-386)

**Before:**
```markdown
#### Services (Alpha)

| Variable                  | Description                 | Default |
| ------------------------- | --------------------------- | ------- |
| `PRESIDIO_ANALYZE_HOST`   | Presidio analyze endpoint   | -       |
| `PRESIDIO_ANONYMIZE_HOST` | Presidio anonymize endpoint | -       |
| `PRESIDIO_API_KEY`        | Presidio API key            | -       |
```

**After:** (section deleted entirely)

#### Change 2: Add Distributed Workers Section (After Storage)

**Insert after line ~396:**
```markdown
#### Distributed Workers (Optional)

| Variable              | Description                           | Default     |
| --------------------- | ------------------------------------- | ----------- |
| `REDIS_URL`           | Redis connection for task queue       | -           |
| `DISTRIBUTED_WORKERS` | Enable distributed agent execution    | `false`     |

> **Note**: Distributed workers enable horizontal scaling of LLM workloads. Requires Redis and a worker process (`make dev.worker`).
```

#### Change 3: Add Makefile Commands Reference (After line ~72)

**Insert after "## Development" header:**
```markdown
### Quick Reference

| Command           | Description                        |
|-------------------|------------------------------------|
| `make dev`        | Start backend server (port 8000)   |
| `make dev.worker` | Start TaskIQ worker                |
| `make test`       | Run all backend tests              |
| `make format`     | Format code with Ruff              |
| `make seeds.user` | Seed default users                 |
| `make migrate.up` | Apply all pending migrations       |

For all available commands, see `backend/Makefile`.
```

#### Change 4: Simplify Development Server Setup (Lines 99-118)

**Current (verbose manual commands):**
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

**Proposed (Makefile-first with manual fallback):**
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

#### Change 5: Modernize Database Migrations Section (Lines 133-171)

**Proposed update:**
```markdown
## Database Migrations

This project uses Alembic for database migrations. The Makefile provides convenient commands.

### Apply Migrations

```bash
cd backend

# Apply all pending migrations
make migrate.up

# Apply next migration only
make migrate.upgrade
```

### Rollback Migrations

```bash
# Rollback one migration
make migrate.down
```

### Create New Migration

```bash
make migrate.revision
# Edit the generated file in migrations/versions/
```

### View Migration History

```bash
make migrate.history
```

### Seed Initial Data

```bash
make seeds.user
```

<details>
<summary>Manual Alembic commands (advanced)</summary>

```bash
# Direct alembic commands (requires env file setup)
alembic upgrade head
alembic downgrade -1
alembic history
alembic revision -m "description_of_changes"
```
</details>
```

### 7.2 docker/README.md Changes

#### Change 1: Remove Services (Alpha) Section (Lines 190-197)

Same removal as README.md - delete the Presidio environment variable table.

#### Change 2: Add Distributed Workers Section

Same addition as README.md - add after Storage section.

---

## 8. VERIFICATION CHECKLIST

After implementation, verify:

- [ ] `grep -ri "presidio" *.md` returns no results in README files
- [ ] README.md renders correctly in GitHub preview
- [ ] docker/README.md renders correctly in GitHub preview
- [ ] All internal anchor links work
- [ ] Makefile commands match what's documented
- [ ] Environment variables match `.example.env`

---

## 9. APPENDIX: ALIGNMENT MATRIX

| User Story | Addressed By |
|------------|--------------|
| Story 1: Remove Presidio Documentation | Change 1 (both files) |
| Story 2: Document Makefile Commands | Change 3 |
| Story 3: Modernize Development Setup | Change 4, Change 5 |
| Story 4: Document Distributed Workers | Change 2 (both files) |
