# TASK CONTRACT: Deployment Worker Update

**Generated:** 2026-01-13
**PR Reference:** #657 (Distributed Workers via TaskIQ)
**Objective:** Enable single TaskIQ worker in deployment configuration

---

## Task Overview

| Attribute | Value |
|-----------|-------|
| **Scope** | Small-Medium |
| **Risk Level** | Low |
| **Files Modified** | 4-5 |
| **Estimated Effort** | 2-3 hours |

---

## Tasks

### Task 1: Update docker-compose.yml Worker Service

**File:** `/home/ryaneggz/ruska-ai/orchestra/docker-compose.yml`

**Action:** Replace commented worker service block (lines ~48-69) with active configuration.

**Implementation:**

```yaml
##############################################
## TaskIQ Worker (Distributed Agent Execution)
##############################################
worker:
    build:
        context: ./backend
        dockerfile: Dockerfile
    environment:
        - REDIS_URL=redis://redis:6379/0
        - DISTRIBUTED_WORKERS=true
    command: uv run taskiq worker src.workers.tasks:broker
    depends_on:
        redis:
            condition: service_healthy
        postgres:
            condition: service_started
    deploy:
        replicas: 1
        resources:
            limits:
                cpus: '1.0'
                memory: 1G
            reservations:
                cpus: '0.25'
                memory: 256M
    restart: unless-stopped
    healthcheck:
        test: ["CMD", "pgrep", "-f", "taskiq"]
        interval: 30s
        timeout: 10s
        retries: 3
        start_period: 10s
```

**Key Changes from Commented Version:**
- Removed `container_name: orchestra_worker` (allows future scaling)
- Removed `env_file: ./backend/.env.docker` (doesn't exist)
- Changed `replicas: 2` to `replicas: 1`
- Added `resources:` limits and reservations
- Added `healthcheck:` configuration

**Acceptance Criteria:**
- [ ] Worker service is uncommented and active
- [ ] `replicas: 1` is set
- [ ] `container_name` is removed
- [ ] `env_file` reference is removed
- [ ] Resource limits are defined
- [ ] Healthcheck is configured

---

### Task 2: Update .example.env Documentation

**File:** `/home/ryaneggz/ruska-ai/orchestra/backend/.example.env`

**Action:** Add new section documenting distributed worker environment variables.

**Implementation:** Append to end of file:

```bash
#########################################################
## Distributed Workers (TaskIQ)
#########################################################
REDIS_URL=redis://localhost:6379/0
DISTRIBUTED_WORKERS=false
```

**Acceptance Criteria:**
- [ ] `REDIS_URL` variable documented with default value
- [ ] `DISTRIBUTED_WORKERS` variable documented with `false` default
- [ ] Section follows existing formatting conventions

---

### Task 3: Update deploy-docker.yml for Worker Container

**File:** `/home/ryaneggz/ruska-ai/orchestra/.github/workflows/deploy-docker.yml`

**Action:** Add worker container deployment after main API container.

**Implementation:** Add after line 106 (after `$GHCR_IMAGE:$TAG`):

```bash
echo '--- Stopping and removing old worker container if it exists ---'
docker stop graphchat_worker 2>/dev/null || true
docker rm graphchat_worker 2>/dev/null || true

echo '--- Starting worker container ---'
docker run -d \
  --name graphchat_worker \
  --network graphchat_default \
  --restart always \
  --env-file ./backend/.env \
  -e DISTRIBUTED_WORKERS=true \
  -e REDIS_URL=redis://redis:6379/0 \
  --memory=1g \
  --cpus=1 \
  $GHCR_IMAGE:$TAG \
  uv run taskiq worker src.workers.tasks:broker

echo '--- Worker deployment complete ---'
```

**Acceptance Criteria:**
- [ ] Worker container `graphchat_worker` is deployed
- [ ] Worker uses same network as API (`graphchat_default`)
- [ ] Worker has resource limits (1GB memory, 1 CPU)
- [ ] Worker has `DISTRIBUTED_WORKERS=true` and `REDIS_URL` set
- [ ] Worker command overrides to run TaskIQ

---

### Task 4: Uncomment Redis Service in test.yml

**File:** `/home/ryaneggz/ruska-ai/orchestra/.github/workflows/test.yml`

**Action:** Uncomment Redis service for CI testing (lines 108-116).

**Current (commented):**
```yaml
# redis:
#   image: redis:alpine
#   ports:
#     - 6379:6379
#   options: >-
#     --health-cmd "redis-cli ping"
#     --health-interval 10s
#     --health-timeout 5s
#     --health-retries 5
```

**Implementation:** Uncomment to:
```yaml
redis:
    image: redis:alpine
    ports:
        - 6379:6379
    options: >-
        --health-cmd "redis-cli ping"
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5
```

**Also add to env section (after line 93):**
```yaml
REDIS_URL: redis://localhost:6379/0
```

**Acceptance Criteria:**
- [ ] Redis service is uncommented and active
- [ ] `REDIS_URL` is added to test environment variables
- [ ] CI tests can run distributed worker integration tests

---

### Task 5 (Optional): Update deploy-vm.yml for Worker Process

**File:** `/home/ryaneggz/ruska-ai/orchestra/.github/workflows/deploy-vm.yml`

**Action:** Add separate tmux session for worker process.

**Implementation:** Add after main session creation (after line 73):

```bash
# Create worker tmux session
WORKER_SESSION=\"agent_worker_${TAG}\"
tmux new-session -d -s \"\${WORKER_SESSION}\" '
  cd ~/agent_api/backend
  source .venv/bin/activate
  export REDIS_URL=redis://localhost:6379/0
  export DISTRIBUTED_WORKERS=true
  export POSTGRES_CONNECTION_STRING=${{ secrets.POSTGRES_CONNECTION_STRING }}
  uv run taskiq worker src.workers.tasks:broker
'

echo \"Worker session started: \${WORKER_SESSION}\"
```

**Note:** This requires Redis to be running on the VM. May need additional setup.

**Acceptance Criteria:**
- [ ] Worker tmux session created alongside API session
- [ ] Worker has required environment variables
- [ ] Redis is available on VM (prerequisite)

---

## Verification Checklist

### Pre-Merge Verification

```bash
# 1. Validate docker-compose syntax
docker compose config

# 2. Build worker image
docker compose build worker

# 3. Start infrastructure only
docker compose up -d postgres redis

# 4. Verify Redis healthcheck passes
docker compose ps redis  # Should show "healthy"

# 5. Start worker and verify startup
docker compose up worker
# Look for: "TaskIQ worker started" or similar

# 6. Stop test containers
docker compose down
```

### Post-Deployment Verification

```bash
# 1. Verify all services running
docker compose ps

# 2. Check worker logs
docker compose logs worker --tail=50

# 3. Verify Redis connection
docker exec redis redis-cli PING

# 4. Check task queue exists
docker exec redis redis-cli XINFO STREAM orchestra_tasks

# 5. Test distributed flow (requires API running with DISTRIBUTED_WORKERS=true)
curl -X POST http://localhost:8000/api/llm/stream \
  -H "Content-Type: application/json" \
  -d '{"input":{"messages":[{"role":"user","content":"Hello"}]}}'
# Should return 202 Accepted with thread_id
```

---

## Rollback Procedure

If issues arise after deployment:

```bash
# 1. Stop worker container
docker compose stop worker

# 2. Comment out worker service in docker-compose.yml
# (or set scale to 0)
docker compose up -d --scale worker=0

# 3. Disable distributed mode on API
# Set DISTRIBUTED_WORKERS=false and restart API

# 4. Clear pending tasks (optional)
docker exec redis redis-cli DEL orchestra_tasks
```

---

## Out of Scope

The following items were considered but deferred:

1. **Redis Authentication** - Security enhancement for production
2. **Entrypoint Script** - Multi-mode container support
3. **Database Pool Tuning** - Worker-specific connection limits
4. **Monitoring/Alerting** - Queue depth and performance metrics

---

## Definition of Done

- [ ] Task 1 complete: docker-compose.yml worker service active
- [ ] Task 2 complete: .example.env updated with new variables
- [ ] Task 3 complete: deploy-docker.yml deploys worker container
- [ ] Task 4 complete: test.yml has Redis service enabled
- [ ] Task 5 (optional): deploy-vm.yml has worker tmux session
- [ ] Pre-merge verification passes
- [ ] PR review approved
- [ ] Changes merged to target branch

---

*Task contract generated from Council Review synthesis.*
