# PRD: Local VM Backend (OpenClaw-like Architecture)

## Introduction

Transform Orchestra to run on a single Ubuntu/WSL VM as a personal assistant using `FilesystemBackend` from deepagents for local code execution. Remove the distributed TaskIQ worker dependency, add a curl install script, and provide a Docker test container.

## User Stories

### US-001: Add FilesystemBackend to sandbox factory
**Description:** As a developer, I want Orchestra to support FilesystemBackend for local execution.

**Acceptance Criteria:**
- [ ] Import `FilesystemBackend` from `deepagents.backends` in `backend/src/agents/__init__.py`
- [ ] Add `BACKEND_TYPE` env var to `backend/src/constants/__init__.py` (default: `"auto"`, options: `"filesystem"`, `"daytona"`, `"state"`, `"auto"`)
- [ ] Add `WORKSPACE_ROOT` env var to constants, defaulting to `~/.ruska/workspace/`
- [ ] Create `_create_filesystem_backend()` factory function that creates `FilesystemBackend` with `WORKSPACE_ROOT` as root
- [ ] Add `"filesystem"` key to `_SANDBOX_FACTORIES` dict
- [ ] Update `resolve_sandbox_backend()` to respect `BACKEND_TYPE` env var when `sandbox_type` is None/auto
- [ ] Auto-create `WORKSPACE_ROOT` directory on startup if it doesn't exist
- [ ] Typecheck passes

### US-002: Make TaskIQ workers optional
**Description:** As a developer, I want TaskIQ to be optional so local mode doesn't require it.

**Acceptance Criteria:**
- [ ] In `backend/src/routes/v0/llm.py`, wrap TaskIQ import in `if DISTRIBUTED_WORKERS:` guard
- [ ] In `backend/src/workers/__init__.py`, make imports conditional
- [ ] Ensure `DISTRIBUTED_WORKERS=false` (already the default) skips all TaskIQ code paths
- [ ] Move `taskiq-redis` to optional dependencies group in `backend/pyproject.toml`
- [ ] Backend starts without error when `taskiq-redis` is not installed and `DISTRIBUTED_WORKERS=false`
- [ ] Typecheck passes

### US-003: Create local environment configuration
**Description:** As a DevOps engineer, I want to configure Orchestra for local deployment via environment variables.

**Acceptance Criteria:**
- [ ] Create `backend/.env.local.example` with documented variables: `BACKEND_TYPE=filesystem`, `WORKSPACE_ROOT=~/.ruska/workspace/`, `DISTRIBUTED_WORKERS=false`, `POSTGRES_CONNECTION_STRING`, `REDIS_URL`, `PORT=8000`
- [ ] Add `make local` target to root `Makefile` that starts backend with `.env.local.example` defaults
- [ ] Add `/api/health` endpoint in `backend/src/routes/v0/__init__.py` returning `{"status": "ok", "mode": "<backend_type>", "workspace": "<workspace_root>"}`
- [ ] Typecheck passes

### US-004: Create install script
**Description:** As a user, I want to install Orchestra on Ubuntu/WSL with a single curl command.

**Acceptance Criteria:**
- [ ] Script created at `scripts/install.sh`
- [ ] Script detects OS (Ubuntu/Debian/WSL) and validates prerequisites
- [ ] Script installs system dependencies: Python 3.12+, Node 22+, Redis, PostgreSQL (via apt)
- [ ] Script creates directory structure: `~/.ruska/workspace/`, `~/.ruska/config/`, `~/.ruska/data/`
- [ ] Script clones Orchestra repo to `~/.ruska/orchestra/` (or user-specified path)
- [ ] Script creates Python venv, installs backend deps via `uv`
- [ ] Script installs frontend deps via `npm install` and builds for production
- [ ] Script generates `.env` from `.env.local.example`
- [ ] Script runs database setup (createdb + migrations)
- [ ] Script is idempotent (safe to re-run)
- [ ] Reference: check `ruska-ai/sandboxes` openclaw branch for patterns

### US-005: Create Docker test container
**Description:** As a developer, I want a Docker container that simulates an Ubuntu VM for testing local deployment.

**Acceptance Criteria:**
- [ ] `docker/Dockerfile.local` created based on `ubuntu:24.04`
- [ ] Image includes Python 3.12, Node 22, Redis, PostgreSQL
- [ ] Orchestra backend runs on port 8000, frontend on port 5173
- [ ] `~/.ruska/workspace/` created inside container
- [ ] `docker-compose.local.yml` created with single service
- [ ] `docker compose -f docker-compose.local.yml up` starts Orchestra and it's accessible at `localhost:8000`

### US-006: Verify workspace is clean and push final changes
**Description:** As a developer, I want to ensure all changes are committed and pushed.

**Acceptance Criteria:**
- [ ] Run `git status` to check for uncommitted changes
- [ ] If remaining changes exist, commit and push to branch
- [ ] All commits visible in GitHub PR
