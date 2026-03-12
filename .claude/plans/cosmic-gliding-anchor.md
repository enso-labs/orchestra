# Plan: Docker Development Environment Section in AGENTS.md

## Context
The codebase has new Docker dev infrastructure (`docker-compose.dev.yml`, `backend/Dockerfile.dev`, `frontend/Dockerfile.dev`, Makefile targets) but AGENTS.md doesn't mention it. AI agents need to know how to start and manage the containerized dev environment when working on the project.

## Changes

### 1. Add "Docker Development Environment" section to `AGENTS.md`
Add a new section after "Build, Test, and Development Commands" (line 64) covering:

- **When to use it** — full-stack development requiring all services (backend, frontend, worker, postgres, redis, search)
- **Starting the stack** — `make dev.docker.up` with env file overrides (`BACKEND_ENV_FILE`, `FRONTEND_ENV_FILE`)
- **Services and ports** — backend:8000, frontend:5173, postgres:5432, redis:6379, search_engine:8080, dozzle:8088
- **Management commands** — `make dev.docker.logs`, `make dev.docker.ps`, `make dev.docker.down`, `make dev.docker.migrate`
- **Optional sandbox** — `COMPOSE_PROFILES=tools make dev.docker.up` for exec_server on port 3005
- **Key details** — hot-reload via volume mounts, env files default to `./backend/.env.docker.dev` and `./frontend/.env.docker.dev`

Content will be concise bullet-point style matching the existing AGENTS.md format.

### 2. Since CLAUDE.md mirrors AGENTS.md, it will automatically pick up the change
CLAUDE.md currently has identical content to AGENTS.md. The user may want to keep them in sync — will update both files.

## Files to Modify
- `AGENTS.md` (add section)
- `CLAUDE.md` (add same section to keep in sync)

## Verification
- Read both files after editing to confirm formatting and consistency
- Run `make dev.docker.up` dry-check (ensure Makefile target exists)
