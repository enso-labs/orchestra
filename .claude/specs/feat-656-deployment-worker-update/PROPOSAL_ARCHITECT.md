# Deployment Update Proposal: Distributed Workers via TaskIQ

**Author:** AGENT_1: ARCHITECT
**Date:** 2026-01-13
**PR Reference:** #657
**Target:** Single Worker Deployment Configuration

---

## 1. Executive Summary

This proposal outlines the minimal changes required to enable distributed worker deployment in Orchestra's Docker Compose configuration. The core TaskIQ integration is already complete in PR #657 - the remaining work involves uncommenting and configuring the worker service with `replicas: 1`, updating the Dockerfile to support dual-mode operation (API vs Worker), and ensuring environment configuration parity between services. This is a low-risk, targeted deployment configuration update.

---

## 2. Architectural Analysis

### 2.1 Current State Assessment

**Infrastructure Already in Place:**

| Component | Status | Location |
|-----------|--------|----------|
| Redis broker | Active | `docker-compose.yml:34-46` |
| TaskIQ broker config | Complete | `backend/src/workers/broker.py` |
| Worker task (`run_agent_stream`) | Complete | `backend/src/workers/tasks.py` |
| Stream consumer (`stream_from_redis`) | Complete | `backend/src/utils/stream.py:298-350` |
| SSE polling endpoint | Complete | `backend/src/routes/v0/thread.py:227-265` |
| Distributed mode flag | Complete | `backend/src/routes/v0/llm.py:38` |
| Worker service (commented) | Ready | `docker-compose.yml:48-69` |

**What PR #657 Delivered:**
- `RedisStreamBroker` with `RedisAsyncResultBackend` for task queuing
- `run_agent_stream` task that mirrors `stream_generator` logic
- `DISTRIBUTED_WORKERS` environment variable toggling behavior
- `/threads/{thread_id}/stream` endpoint for SSE consumption
- Frontend updates for 202 Accepted handling and polling

**What Remains:**
1. Uncomment worker service in `docker-compose.yml`
2. Set `deploy.replicas: 1` (instead of 2)
3. Modify Dockerfile to support worker mode via entrypoint
4. Add `REDIS_URL` and `DISTRIBUTED_WORKERS` to `.example.env`
5. Optionally create `docker-compose.distributed.yml` override

### 2.2 Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Docker Compose Network                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐       │
│  │   FastAPI    │      │    Redis     │      │  PostgreSQL  │       │
│  │   (API)      │◄────►│   :6379      │◄────►│    :5432     │       │
│  │   :8000      │      │              │      │              │       │
│  └──────────────┘      └──────────────┘      └──────────────┘       │
│         │                     ▲                     ▲                │
│         │                     │                     │                │
│         └─────────────────────┼─────────────────────┘                │
│                               │                                      │
│                        ┌──────────────┐                              │
│                        │   TaskIQ     │                              │
│                        │   Worker     │                              │
│                        │   (1 replica)│                              │
│                        └──────────────┘                              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Request Flow (Distributed Mode):**

```
Client                API                  Redis                 Worker
  │                    │                     │                      │
  │ POST /llm/stream   │                     │                      │
  ├───────────────────►│                     │                      │
  │                    │ run_agent_stream.kiq│                      │
  │                    ├────────────────────►│                      │
  │                    │                     │◄─────────────────────┤
  │                    │                     │  XREAD (blocking)    │
  │◄───────────────────┤                     │                      │
  │ 202 {thread_id}    │                     │                      │
  │                    │                     │                      │
  │ GET /threads/{id}/stream                 │                      │
  ├───────────────────►│                     │                      │
  │                    │ XREAD agent:stream:id                      │
  │                    ├────────────────────►│◄─────────────────────┤
  │◄───────────────────┤◄────────────────────┤  XADD (stream data)  │
  │ SSE stream         │                     │                      │
```

### 2.3 Integration Points and Dependencies

| Dependency | Required For | Status |
|------------|--------------|--------|
| Redis 7 | Message broker + result streams | Already running |
| PostgreSQL | Checkpoints + Store (both API and Worker) | Already running |
| `taskiq-redis>=1.0.0` | Broker implementation | Already in `pyproject.toml` |
| `REDIS_URL` env var | Worker connection | Needs documentation |
| `DISTRIBUTED_WORKERS=true` | API mode switch | Needs documentation |

---

## 3. Implementation Strategy

### 3.1 Step-by-Step Implementation Plan

#### Phase 1: Docker Compose Update (Required)

**File: `docker-compose.yml`**

Uncomment and modify the worker service:

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
        - ./backend/.env.docker
    environment:
        - REDIS_URL=redis://redis:6379/0
        - DISTRIBUTED_WORKERS=true
    command: uv run taskiq worker src.workers.tasks:broker --fs-discover
    depends_on:
        redis:
            condition: service_healthy
        postgres:
            condition: service_started
    deploy:
        replicas: 1  # Start with single worker
    restart: unless-stopped
```

**Key Changes from Commented Version:**
- `replicas: 1` instead of 2 (start conservative)
- Added `--fs-discover` flag for task discovery
- `container_name` only works with single replica

#### Phase 2: Dockerfile Modification (Recommended)

**File: `backend/Dockerfile`**

The current Dockerfile hardcodes uvicorn as the entrypoint. Modify to support both modes:

**Option A - CMD Override (Simplest, Recommended)**

Keep existing Dockerfile, rely on `command:` in docker-compose.yml to override:

```dockerfile
# Current ENTRYPOINT stays the same - serves API by default
ENTRYPOINT ["python", "-B", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

The `command:` in docker-compose.yml already overrides this:
```yaml
command: uv run taskiq worker src.workers.tasks:broker --fs-discover
```

**Option B - Flexible Entrypoint Script (More Robust)**

Create `backend/scripts/entrypoint.sh`:

```bash
#!/bin/bash
set -e

if [ "$1" = "worker" ]; then
    echo "Starting TaskIQ Worker..."
    exec uv run taskiq worker src.workers.tasks:broker --fs-discover
else
    echo "Starting FastAPI Server..."
    exec python -B -m uvicorn main:app --host 0.0.0.0 --port 8000
fi
```

Update Dockerfile:

```dockerfile
# Copy entrypoint script
COPY scripts/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["api"]  # Default to API mode
```

Worker compose:
```yaml
command: worker
```

**Recommendation:** Use Option A for initial deployment. It requires zero Dockerfile changes and the compose `command:` already provides the override mechanism.

#### Phase 3: Environment Configuration (Required)

**File: `backend/.example.env`**

Add new environment variables:

```env
#########################################################
## Distributed Workers (TaskIQ)
#########################################################
# Enable distributed mode - tasks enqueued to workers
DISTRIBUTED_WORKERS=false

# Redis connection for worker communication
REDIS_URL=redis://localhost:6379/0

# Stream consumer timeout (ms) - how long to wait for messages
STREAM_TIMEOUT_MS=60000
```

**File: `backend/.env.docker` (or equivalent)**

```env
DISTRIBUTED_WORKERS=true
REDIS_URL=redis://redis:6379/0
```

#### Phase 4: API Container Update (Required)

The API container also needs access to Redis for:
1. Enqueuing tasks via `run_agent_stream.kiq()`
2. Reading streams via `stream_from_redis()`

**File: `docker-compose.yml` - API service (if using one)**

```yaml
orchestra:
    build:
        context: ./backend
        dockerfile: Dockerfile
    container_name: orchestra
    env_file:
        - ./backend/.env.docker
    environment:
        - REDIS_URL=redis://redis:6379/0
        - DISTRIBUTED_WORKERS=true
    ports:
        - "8000:8000"
    depends_on:
        redis:
            condition: service_healthy
        postgres:
            condition: service_started
    restart: unless-stopped
```

### 3.2 File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `docker-compose.yml` | MODIFY | Uncomment worker service, set replicas to 1 |
| `backend/.example.env` | MODIFY | Add DISTRIBUTED_WORKERS, REDIS_URL, STREAM_TIMEOUT_MS |
| `backend/Dockerfile` | NO CHANGE | Command override via compose is sufficient |
| `backend/src/workers/` | NO CHANGE | Already complete |
| `backend/src/routes/v0/llm.py` | NO CHANGE | Already complete |
| `backend/src/routes/v0/thread.py` | NO CHANGE | Already complete |

### 3.3 Deployment Workflow Configuration

**File: `.github/workflows/deploy-docker.yml`**

For production deployment with workers, the deploy script needs to:

1. Start worker container(s) alongside API
2. Ensure Redis is accessible on the network
3. Pass correct environment variables

```yaml
# Add after API container start:
echo '--- Starting Worker Container ---'
docker run -d \
  --name graphchat_worker \
  --network graphchat_default \
  --restart always \
  --env-file ./backend/.env \
  -e DISTRIBUTED_WORKERS=true \
  -e REDIS_URL=redis://redis:6379/0 \
  $GHCR_IMAGE:$TAG \
  uv run taskiq worker src.workers.tasks:broker --fs-discover
```

---

## 4. Design Decisions

### 4.1 Trade-offs Considered

| Decision | Choice | Alternative | Rationale |
|----------|--------|-------------|-----------|
| Worker count | 1 replica | 2+ replicas | Start conservative; scale based on load |
| Entrypoint | Compose override | Custom script | Simpler, no Dockerfile changes needed |
| Health check | Rely on restart policy | Custom health endpoint | TaskIQ has no built-in health; restart is sufficient |
| Redis streams | Use existing setup | Separate queue | PR #657 already configured streams correctly |

### 4.2 Why This Approach

**1. Minimal Changes Philosophy**
The TaskIQ integration is already complete. This proposal focuses solely on deployment configuration, avoiding any application code changes.

**2. Single Replica Start**
Starting with 1 worker allows for:
- Simpler debugging during initial rollout
- Baseline performance measurement
- Lower resource consumption
- Easy scale-up via `docker compose up --scale worker=N`

**3. Command Override vs Entrypoint Script**
Using `command:` in docker-compose.yml:
- Requires zero Dockerfile modifications
- Keeps the image identical for both API and worker
- Provides flexibility without build complexity
- Is the standard Docker pattern for multi-mode containers

**4. Environment Variable Isolation**
Keeping `DISTRIBUTED_WORKERS=true` in compose (not the image):
- Same image works for both sync and distributed modes
- Easy A/B testing by changing one env var
- Rollback is trivial (flip the flag)

### 4.3 Alignment with Existing Patterns

- **Service definition style** matches existing postgres, redis, minio services
- **Environment handling** follows the `env_file` + `environment` override pattern
- **Dependency management** uses `depends_on` with health conditions
- **Container naming** follows `orchestra_*` convention

---

## 5. Risk Assessment

### 5.1 Potential Pitfalls

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Worker fails to connect to Redis | Low | High | Health check on Redis; worker restart policy |
| Database connection exhaustion | Medium | Medium | Workers create fresh connections per task (existing pattern) |
| Stream data loss on worker crash | Low | Medium | Redis Streams persist; client can retry polling |
| Memory pressure on single worker | Medium | Low | Monitor and scale horizontally |
| Import errors in compiled bytecode | Low | High | Test worker startup in Docker before deploy |

### 5.2 Edge Cases to Handle

1. **Worker starts before Redis is healthy**
   - Mitigation: `depends_on.redis.condition: service_healthy`

2. **API receives request but no workers available**
   - Task queues in Redis; processed when worker comes online
   - Consider adding queue depth monitoring

3. **Client disconnects during polling**
   - Redis stream persists; client can reconnect with same thread_id
   - 5-minute TTL on streams prevents indefinite growth

4. **Long-running LLM requests exceed timeout**
   - `STREAM_TIMEOUT_MS` configurable (default 60s keep-alive)
   - Consider increasing for production deployments

### 5.3 Testing Considerations

**Pre-deployment Verification:**

```bash
# 1. Build the image
docker compose build

# 2. Start infrastructure
docker compose up -d postgres redis

# 3. Start worker in foreground to verify startup
docker compose run --rm worker

# 4. In another terminal, verify Redis connectivity
docker exec redis redis-cli PING

# 5. Test the full flow
docker compose up -d
curl -X POST http://localhost:8000/api/llm/stream \
  -H "Content-Type: application/json" \
  -d '{"input":{"messages":[{"role":"user","content":"Hello"}]},"model":"openai:gpt-4.1-mini"}'
```

**Integration Test (Already Exists):**
- `backend/tests/integration/test_distributed_stream.py`
- `backend/tests/integration/test_multi_turn_distributed.py`

---

## 6. Estimated Complexity

| Metric | Assessment |
|--------|------------|
| **Scope** | Small |
| **Risk Level** | Low |
| **Effort** | 1-2 hours |
| **Lines Changed** | ~30 |
| **Files Modified** | 2-3 |

### 6.1 Implementation Priority Order

1. **Update `docker-compose.yml`** - Uncomment and configure worker service
2. **Update `.example.env`** - Document new environment variables
3. **Create `.env.docker`** - Production-ready env file for distributed mode
4. **Test locally** - Verify worker startup and task processing
5. **Update deploy workflow** - Add worker container to deployment

### 6.2 Rollback Plan

If issues arise after deployment:

```bash
# Option 1: Disable distributed mode (zero downtime)
# Set DISTRIBUTED_WORKERS=false on API container
# Worker continues running but receives no new tasks

# Option 2: Stop worker (minimal disruption)
docker stop graphchat_worker

# Option 3: Full rollback
# Deploy previous image version without worker
```

---

## 7. Appendix: Complete docker-compose.yml Worker Section

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
        - ./backend/.env.docker
    environment:
        - REDIS_URL=redis://redis:6379/0
        - DISTRIBUTED_WORKERS=true
        - STREAM_TIMEOUT_MS=60000
    command: uv run taskiq worker src.workers.tasks:broker --fs-discover
    depends_on:
        redis:
            condition: service_healthy
        postgres:
            condition: service_started
    deploy:
        replicas: 1
    restart: unless-stopped
    # Optional: resource limits
    # deploy:
    #     resources:
    #         limits:
    #             cpus: '2'
    #             memory: 4G
```

---

## 8. Summary

This deployment update requires minimal changes to enable distributed worker functionality:

1. **Uncomment** the worker service in `docker-compose.yml`
2. **Set** `replicas: 1` for initial deployment
3. **Document** new environment variables in `.example.env`
4. **Test** locally before production deployment

The core TaskIQ integration from PR #657 is complete and battle-tested. This proposal addresses only the deployment configuration layer, making it a low-risk, high-value enhancement that enables horizontal scaling of LLM processing workloads.
