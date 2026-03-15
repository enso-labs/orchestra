# Add frontend to docker-compose.dev.yml + resource limits

## Context
The frontend is currently running in a local tmux session (`orchestra-dev-frontend-1`). It should be containerized as part of the `docker-compose.dev.yml` app stack so everything runs in Docker. Additionally, resource limits are needed on all services across all three compose files to prevent sudden crashes on the 16GB / 32-core dev machine.

## Changes

### 1. `docker-compose.dev.yml` — add frontend service + resource limits

**Add frontend service:**
- Uses existing `frontend/Dockerfile.dev` (node:22-bookworm-slim, `npm ci`)
- Sets `VITE_PROXY_TARGET=http://backend:8000` (used by `vite.config.ts` proxy)
- Polling env vars for hot-reload in Docker: `CHOKIDAR_USEPOLLING=true`, `WATCHPACK_POLLING=true`
- Volume-mounts `./frontend:/app` with a named volume for `node_modules` to avoid overwriting the container's `npm ci` install
- Depends on backend healthy
- Port 5173:5173
- Command: `npm install && npm run dev -- --host 0.0.0.0 --port 5173`

**Add `deploy.resources.limits` to all services:**
- `backend`: 2 CPus, 2GB RAM
- `worker`: 2 CPUs, 2GB RAM
- `frontend`: 1 CPU, 1GB RAM

### 2. `docker-compose.storage.yml` — add resource limits

- `postgres`: 2 CPUs, 2GB RAM
- `redis`: 0.5 CPUs, 512MB RAM

### 3. `docker-compose.services.yml` — add resource limits

- `search_engine`: 1 CPU, 1GB RAM
- `dozzle`: 0.25 CPUs, 256MB RAM
- `exec_server`: 1 CPU, 1GB RAM

### 4. `Makefile` — update log services default

- Add `frontend` to `DOCKER_DEV_LOG_SERVICES` default: `backend worker frontend`

### 5. `CLAUDE.md` — update Docker section

- Add `frontend` service back to services/ports list (`:5173`)
- Note resource limits are set

### 6. Kill tmux session

- `tmux kill-session -t orchestra-dev-frontend-1`

## Files to modify
- `docker-compose.dev.yml` — add frontend service + deploy limits on backend/worker/frontend
- `docker-compose.storage.yml` — add deploy limits on postgres/redis
- `docker-compose.services.yml` — add deploy limits on search_engine/dozzle/exec_server
- `Makefile` — update `DOCKER_DEV_LOG_SERVICES`
- `CLAUDE.md` — update Docker section

## Verification
1. `docker compose -f docker-compose.dev.yml config` — validates with frontend + limits
2. `docker compose -f docker-compose.storage.yml config` — validates limits
3. `docker compose -f docker-compose.services.yml config` — validates limits
4. `tmux list-sessions` — confirm `orchestra-dev-frontend-1` is gone
5. `make dev.docker.down && make dev.docker.up` — restart app stack
6. `make dev.docker.ps` — shows backend, worker, frontend
7. `curl http://localhost:5173` — frontend responds
8. `docker stats --no-stream` — confirm resource limits are applied
