# Implementation Tasks: Add File-Watching Reload to TaskIQ Worker

## Pre-Implementation

- [ ] Review REVIEW.md council decisions
- [ ] Verify `watchdog` or `watchfiles` is available in the backend venv

## Core Implementation

- [ ] Task 1: Verify watcher dependency availability
  - Files: `backend/pyproject.toml`
  - Action: Run `uv run python -c "import watchdog"` or `uv run python -c "import watchfiles"` to check availability
  - Acceptance: At least one watcher library is importable; if not, add `watchdog` to dev dependencies in `pyproject.toml`

- [ ] Task 2: Update Makefile dev.worker target with --reload flag
  - Files: `backend/Makefile`
  - Action: Add `--reload --reload-dir src` to the `dev.worker` target command
  - Acceptance: `make dev.worker` starts the TaskIQ worker with file-watching enabled, scoped to the `src/` directory

## Testing

- [ ] Task 3: Verify reload triggers on file change
  - Action: Start worker with `make dev.worker`, modify a file in `backend/src/`, confirm worker restarts
  - Acceptance: Worker process restarts after file modification; startup hook runs (checkpointer initializes)

## Verification

- [ ] All changes are in dev-only paths (Makefile target)
- [ ] Production `docker-compose.yml` worker entrypoint is unchanged
- [ ] Linting/formatting clean (`make format`)
- [ ] Ready for PR

## Completion Signature

- Total Tasks: 3
- Dependencies: None
