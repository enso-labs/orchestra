# PROPOSAL: Deployment Worker Update - Integration Analysis

**Agent:** AGENT_5 (INTEGRATOR)
**Focus:** APIs, Interfaces, and System Boundaries
**Date:** 2026-01-13
**PR Reference:** #657 (Distributed Workers via TaskIQ)

---

## 1. Executive Summary

The deployment update requires adding a single TaskIQ worker container to the existing infrastructure, coordinating environment variables between the API and worker services, and ensuring proper network connectivity via Redis for message passing. The recommended approach is to uncomment and configure the existing worker service definition in `docker-compose.yml` with `replicas: 1`, align environment variables between services, and update the deployment workflow to handle the new container lifecycle.

---

## 2. Architectural Analysis

### 2.1 Integration Points Between API, Worker, and Redis

The PR #657 establishes a clear integration pattern between three primary components:

```
+-------------+       TaskIQ        +-------------+       Redis Streams     +-------------+
|   FastAPI   | -----------------> |    Redis    | <------------------>  |   TaskIQ    |
|     API     |    (enqueue)       |   :6379     |    (dequeue/xadd)     |   Worker    |
+-------------+                    +-------------+                       +-------------+
      |                                  ^                                     |
      |                                  |                                     |
      +------ SSE (xread) ---------------+                                     |
      |                                                                        |
      +--------------------------- PostgreSQL <--------------------------------+
                                   (checkpoints, store)
```

**Communication Pathways:**

| Source | Destination | Protocol | Purpose |
|--------|-------------|----------|---------|
| API | Redis | TaskIQ broker (RedisStreamBroker) | Enqueue `run_agent_stream` task |
| Worker | Redis | TaskIQ broker | Dequeue task from `orchestra_tasks` queue |
| Worker | Redis | Redis Streams (XADD) | Write stream chunks to `agent:stream:{thread_id}` |
| API | Redis | Redis Streams (XREAD) | Consume stream chunks for SSE response |
| Worker | PostgreSQL | AsyncPG | Fresh DB connections per task for checkpoints/store |
| API | PostgreSQL | AsyncPG | Direct queries for thread management |

**Key Files Implementing Integration:**

| File | Role |
|------|------|
| `/home/ryaneggz/ruska-ai/orchestra/backend/src/workers/broker.py` | Broker configuration (REDIS_URL) |
| `/home/ryaneggz/ruska-ai/orchestra/backend/src/workers/tasks.py` | Task definition with Redis stream output |
| `/home/ryaneggz/ruska-ai/orchestra/backend/src/routes/v0/llm.py` | Conditional routing via `DISTRIBUTED_WORKERS` |
| `/home/ryaneggz/ruska-ai/orchestra/backend/src/routes/v0/thread.py` | Stream consumption endpoint (`/threads/{id}/stream`) |
| `/home/ryaneggz/ruska-ai/orchestra/backend/src/utils/stream.py` | `stream_from_redis()` consumer function |

### 2.2 Network Configuration Between Containers

**Current docker-compose.yml Network Topology:**

The existing `docker-compose.yml` uses Docker's default bridge network (implicit). All services can communicate via container names:

| Service | Container Name | Ports | Notes |
|---------|---------------|-------|-------|
| postgres | postgres | 5432:5432 | pgvector/pgvector:pg16 |
| redis | redis | 6379:6379 | redis:7-alpine with healthcheck |
| minio | minio | 9000:9000, 9001:9001 | Optional file storage |
| ollama | ollama | 11434:11434 | Optional local LLM |
| exec_server | exec_server | 3005:3005 | Shell execution |
| search_engine | search_engine | 8080:8080 | SearXNG |

**Worker Service Network Requirements:**

The worker service (currently commented out) needs:

1. **Redis connectivity**: `redis://redis:6379/0` (container name resolution)
2. **PostgreSQL connectivity**: `postgresql://admin:test1234@postgres:5432/...`
3. **No external port exposure**: Workers only communicate internally

**DNS Resolution Pattern:**

```yaml
# Within docker-compose default network
worker -> redis:6379      # TaskIQ broker + stream output
worker -> postgres:5432   # Checkpoint/store access
api -> redis:6379         # Stream consumption
api -> postgres:5432      # Direct queries
```

### 2.3 Environment Variable Synchronization

**Critical Environment Variables for Worker:**

| Variable | API Value | Worker Value | Synchronization Strategy |
|----------|-----------|--------------|-------------------------|
| `REDIS_URL` | `redis://redis:6379/0` | `redis://redis:6379/0` | Identical (container DNS) |
| `DISTRIBUTED_WORKERS` | `true` | Not required | API-only flag |
| `POSTGRES_CONNECTION_STRING` | From `.env` | From `.env` | Shared via `env_file` |
| AI Provider Keys | From `.env` | From `.env` | Shared via `env_file` |
| `STREAM_TIMEOUT_MS` | Optional | Optional | Default 60000ms |

**Environment File Strategy:**

The commented worker definition references `./backend/.env.docker`, but this file does not exist. Options:

1. **Create `.env.docker`**: Docker-specific environment with container DNS names
2. **Use existing pattern**: Share `~/.env/orchestra/.env.backend` (development)
3. **Production pattern**: Use secrets management (GitHub Actions secrets)

**Recommended: Create `.env.docker.example`:**

```bash
# Docker-specific environment (uses container names)
POSTGRES_CONNECTION_STRING=postgresql://admin:test1234@postgres:5432/lg_template_dev
REDIS_URL=redis://redis:6379/0
# All other vars from .example.env
```

---

## 3. Implementation Strategy

### 3.1 Step-by-Step Implementation

#### Step 1: Create Docker Environment File Template

Create `/home/ryaneggz/ruska-ai/orchestra/backend/.env.docker.example`:

```bash
#########################################################
## Docker Compose Environment (Container DNS)
#########################################################
APP_ENV=development
APP_LOG_LEVEL="DEBUG"
APP_SECRET_KEY="<generate-secure-key>"
JWT_SECRET_KEY="<generate-secure-key>"

#########################################################
## Database (Container DNS)
#########################################################
POSTGRES_CONNECTION_STRING="postgresql://admin:test1234@postgres:5432/lg_template_dev?sslmode=disable"

#########################################################
## Redis (Container DNS)
#########################################################
REDIS_URL="redis://redis:6379/0"

#########################################################
## AI Providers
#########################################################
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
# ... other providers
```

#### Step 2: Uncomment and Configure Worker Service

Modify `/home/ryaneggz/ruska-ai/orchestra/docker-compose.yml`:

```yaml
##############################################
## TaskIQ Worker (Distributed Agent Execution)
##############################################
worker:
    build:
        context: ./backend
        dockerfile: Dockerfile
    container_name: orchestra_worker
    env_file:
        - ./backend/.env.docker  # Create this file
    environment:
        - REDIS_URL=redis://redis:6379/0
        - DISTRIBUTED_WORKERS=true  # Not strictly needed for worker
    command: uv run taskiq worker src.workers.tasks:broker
    depends_on:
        redis:
            condition: service_healthy
        postgres:
            condition: service_started
    deploy:
        replicas: 1  # Single worker as requested
    restart: unless-stopped
    networks:
        - default  # Use default bridge network
```

**Key Configuration Decisions:**

- `replicas: 1`: Single worker as specified in the ticket
- `depends_on.redis.condition: service_healthy`: Wait for Redis healthcheck
- `restart: unless-stopped`: Auto-restart on failure
- `command: uv run taskiq worker src.workers.tasks:broker`: TaskIQ worker command

#### Step 3: Update Dockerfile for Worker Entrypoint

The current Dockerfile hardcodes the API entrypoint:

```dockerfile
ENTRYPOINT ["python", "-B", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Option A (Recommended): Override via docker-compose command**

The `command:` directive in docker-compose already overrides ENTRYPOINT for the worker. No Dockerfile changes needed.

**Option B: Multi-stage with separate worker entrypoint**

If needed, add a worker-specific stage (not required for this implementation).

#### Step 4: API Service Configuration

If running the API via docker-compose as well (currently commented out), add:

```yaml
##############################################
## Orchestra API
##############################################
orchestra:
    build:
        context: ./backend
        dockerfile: Dockerfile
    container_name: orchestra
    env_file:
        - ./backend/.env.docker
    environment:
        - REDIS_URL=redis://redis:6379/0
        - DISTRIBUTED_WORKERS=true  # Enable distributed mode
    ports:
        - "8000:8000"
    depends_on:
        redis:
            condition: service_healthy
        postgres:
            condition: service_started
    restart: unless-stopped
```

#### Step 5: Update Deployment Workflow

Modify `/home/ryaneggz/ruska-ai/orchestra/.github/workflows/deploy-docker.yml`:

**Current flow deploys single container. For distributed mode:**

```yaml
# Additional step: Start worker container
docker run -d \
  --name orchestra_worker \
  --network graphchat_default \
  --env-file ./backend/.env \
  -e REDIS_URL=redis://redis:6379/0 \
  $GHCR_IMAGE:$TAG \
  uv run taskiq worker src.workers.tasks:broker

# Health check for worker (optional - workers are stateless)
# Workers don't expose HTTP endpoints, verify via Redis connection
```

### 3.2 Network Configuration Requirements

**Docker Compose Default Network:**

All services automatically join the default network. No explicit network configuration needed.

**Production Deployment (graphchat_default):**

The deployment workflow uses `--network graphchat_default`. Ensure:

1. Redis container is on the same network
2. PostgreSQL is accessible
3. Worker uses same network flag

```bash
# Production deployment pattern
docker network create graphchat_default 2>/dev/null || true

docker run -d \
  --name redis \
  --network graphchat_default \
  -v redis_data:/data \
  redis:7-alpine redis-server --appendonly yes

docker run -d \
  --name orchestra_worker \
  --network graphchat_default \
  --env-file ./backend/.env \
  -e REDIS_URL=redis://redis:6379/0 \
  $GHCR_IMAGE:$TAG \
  uv run taskiq worker src.workers.tasks:broker
```

### 3.3 Environment Variable Alignment

**Alignment Matrix:**

| Component | REDIS_URL | POSTGRES_CONNECTION_STRING | DISTRIBUTED_WORKERS |
|-----------|-----------|---------------------------|---------------------|
| API (local dev) | `redis://localhost:6379/0` | `...@localhost:5432/...` | `true` |
| API (docker) | `redis://redis:6379/0` | `...@postgres:5432/...` | `true` |
| Worker (docker) | `redis://redis:6379/0` | `...@postgres:5432/...` | N/A |
| Frontend | N/A | N/A | Detects via 202 response |

**Configuration Sharing Strategy:**

```bash
# Development (local)
DISTRIBUTED_WORKERS=true make dev  # API on host
docker compose up redis postgres   # Services in containers
uv run taskiq worker src.workers.tasks:broker  # Worker on host

# Development (all containers)
docker compose up redis postgres worker orchestra

# Production
# Worker via deploy-docker.yml with --env-file
```

---

## 4. Design Decisions

### 4.1 Service Communication Patterns

**Chosen Pattern: Redis Streams**

Rationale from PR #657:
- **Persistence**: Streams survive Redis restarts
- **Ordering**: Messages maintain insertion order
- **Consumer Groups**: Future support for multiple consumers
- **Backpressure**: Built-in blocking reads (XREAD BLOCK)

**Alternative Considered: Redis Pub/Sub**
- Pro: Simpler
- Con: No persistence, no replay on reconnect

### 4.2 Network Isolation vs Accessibility Trade-offs

**Decision: Minimal Isolation (Default Bridge)**

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Default bridge | Simple, all services visible | Less secure | Chosen for simplicity |
| Custom networks | Better isolation | More config | Future enhancement |
| Host network | No DNS resolution needed | Security risk | Not recommended |

**Rationale:**
- Workers only need Redis and PostgreSQL access
- No external port exposure required
- Complexity not justified for single-worker deployment

### 4.3 Configuration Sharing Strategies

**Decision: Shared env_file with Environment Overrides**

```yaml
worker:
    env_file:
        - ./backend/.env.docker  # Base configuration
    environment:
        - REDIS_URL=redis://redis:6379/0  # Docker-specific override
```

**Rationale:**
- Single source of truth for secrets
- Docker-specific values as explicit overrides
- Clear precedence (environment > env_file)

---

## 5. Risk Assessment

### 5.1 Integration Failure Scenarios

| Scenario | Probability | Impact | Mitigation |
|----------|-------------|--------|------------|
| Redis connection failure | Medium | High - Tasks lost | Healthcheck dependency, retry logic |
| PostgreSQL connection failure | Medium | High - State lost | Fresh connections per task (existing pattern) |
| Task serialization failure | Low | Medium - Single task fails | Comprehensive unit tests |
| Stream key collision | Very Low | Low - Stale data | Thread-unique keys, stream deletion before new task |

### 5.2 Network Connectivity Issues

| Issue | Symptoms | Resolution |
|-------|----------|------------|
| DNS resolution failure | `redis` hostname not found | Verify same Docker network |
| Port blocked | Connection refused | Check no firewall rules |
| Redis not ready | Task enqueue fails | Use `depends_on` with healthcheck |
| PostgreSQL timeout | Worker task hangs | Connection pool tuning |

**Healthcheck Configuration (already in docker-compose.yml):**

```yaml
redis:
    healthcheck:
        test: ["CMD", "redis-cli", "ping"]
        interval: 10s
        timeout: 5s
        retries: 5
```

### 5.3 Configuration Drift Between Services

| Risk | Detection | Prevention |
|------|-----------|------------|
| REDIS_URL mismatch | Connection errors | Single env file |
| DB connection string mismatch | Auth failures | Shared env_file |
| API in sync mode, worker running | 202 never returned | Startup log check |
| Worker not consuming tasks | Stream grows indefinitely | Monitoring (future) |

**Recommended Startup Verification:**

```bash
# Verify distributed mode enabled
curl -s http://localhost:8000/api/info | jq '.distributed'

# Verify worker connected to Redis
docker logs orchestra_worker 2>&1 | grep -i "connected to redis"

# Verify task queue exists
docker exec redis redis-cli XINFO STREAM orchestra_tasks
```

---

## 6. Estimated Complexity

### 6.1 Scope Assessment

| Category | Assessment |
|----------|------------|
| **Scope** | **Small** |
| Files Modified | 2-3 (docker-compose.yml, deploy workflow, optional env template) |
| New Files | 1 (.env.docker.example) |
| Infrastructure Changes | Single container addition |
| Code Changes | None (backend already complete) |
| Testing Impact | Existing tests cover distributed mode |

### 6.2 Risk Level

| Category | Assessment | Justification |
|----------|------------|---------------|
| **Risk Level** | **Low-Medium** | |
| Technical Risk | Low | Backend implementation complete and tested |
| Integration Risk | Medium | First production deployment of distributed mode |
| Rollback Complexity | Low | Comment out worker, set DISTRIBUTED_WORKERS=false |

### 6.3 Priority Order for Implementation

1. **P0 (Critical):** Create `.env.docker` with production secrets
2. **P1 (High):** Uncomment worker service in docker-compose.yml with replicas: 1
3. **P2 (Medium):** Update deploy-docker.yml to manage worker container
4. **P3 (Low):** Add .env.docker.example to repository for documentation
5. **P4 (Optional):** Add worker health monitoring (not HTTP-based)

---

## 7. Implementation Checklist

### 7.1 Pre-Deployment

- [ ] Create `.env.docker` from `.example.env` with container DNS names
- [ ] Verify Redis is running and healthy: `docker compose up redis -d`
- [ ] Test worker locally: `uv run taskiq worker src.workers.tasks:broker`
- [ ] Test API with `DISTRIBUTED_WORKERS=true`: `curl -X POST /api/llm/stream`
- [ ] Verify 202 response with `distributed: true`
- [ ] Verify stream consumption: `GET /api/threads/{id}/stream`

### 7.2 Deployment

- [ ] Uncomment worker service in `docker-compose.yml`
- [ ] Set `replicas: 1`
- [ ] Deploy Redis container (if not already running)
- [ ] Deploy worker container
- [ ] Deploy API with `DISTRIBUTED_WORKERS=true`
- [ ] Verify worker logs show TaskIQ startup
- [ ] Test end-to-end streaming

### 7.3 Post-Deployment

- [ ] Monitor Redis memory usage
- [ ] Check for orphaned streams (TTL should expire in 5 min)
- [ ] Verify checkpoint updates in PostgreSQL
- [ ] Document rollback procedure

---

## 8. Rollback Procedure

If distributed mode causes issues:

```bash
# 1. Stop worker container
docker stop orchestra_worker && docker rm orchestra_worker

# 2. Restart API without distributed mode
docker stop graphchat
docker run -d \
  --name graphchat \
  --network graphchat_default \
  --env-file ./backend/.env \
  -e DISTRIBUTED_WORKERS=false \
  -p 8005:8000 \
  $GHCR_IMAGE:$TAG

# 3. Clear any pending tasks (optional)
docker exec redis redis-cli DEL orchestra_tasks

# 4. Verify sync mode
curl -s http://localhost:8005/api/llm/stream -X POST -H "Content-Type: application/json" \
  -d '{"input":{"messages":[{"role":"user","content":"test"}]}}' | head -1
# Should return 200 with SSE stream, not 202
```

---

## 9. Conclusion

The deployment update for adding a single TaskIQ worker is a **low-complexity, low-risk** change that leverages the already-complete backend implementation from PR #657. The primary work involves:

1. Creating a Docker-specific environment file
2. Uncommenting and configuring the worker service
3. Ensuring network connectivity via the default Docker bridge network
4. Optionally updating the deployment workflow for production

The integration points are well-defined, with Redis serving as the central message broker for both task distribution and streaming results. The existing healthcheck on Redis and the TaskIQ dependency configuration provide sufficient startup coordination.

**Recommended Next Steps:**

1. Create `.env.docker` with production secrets
2. Uncomment worker service with `replicas: 1`
3. Test locally with `docker compose up redis postgres worker`
4. Deploy to production via updated workflow
