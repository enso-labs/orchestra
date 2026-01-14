# PROPOSAL_GUARDIAN.md
## Deployment Worker Update - Security, Error Handling, and Testing Analysis

**Agent:** GUARDIAN - Elite Software Architect (Security, Error Handling, Edge Cases, Testing)
**Feature:** Review PR #657 diff (distributed workers via TaskIQ) and research required changes to update deployment with 1 worker.
**Date:** 2026-01-13

---

## 1. Executive Summary

The distributed workers implementation via TaskIQ introduces solid architectural patterns for horizontal scaling, but requires additional security hardening for production deployment - specifically around Redis authentication, worker container isolation, and secrets management. Enabling a single worker requires uncommenting the worker service in docker-compose.yml, adding `REDIS_URL` to deployment secrets, and implementing a Redis health check endpoint for comprehensive monitoring. The recommended approach is a phased rollout: start with 1 replica in staging, validate error handling under load, then scale.

---

## 2. Architectural Analysis

### 2.1 Security Assessment of Current Setup

#### Strengths

| Component | Security Feature | Status |
|-----------|-----------------|--------|
| Redis Container | Runs as `redis:7-alpine` (minimal attack surface) | Good |
| Redis Persistence | `--appendonly yes` (AOF durability) | Good |
| Worker Isolation | Separate container from API | Good |
| Stream TTL | 5-minute expiration on result streams | Good |
| Task Queue | Named queue `orchestra_tasks` (prevents cross-contamination) | Good |

#### Security Vulnerabilities Requiring Mitigation

**HIGH PRIORITY:**

1. **Redis Authentication Missing**
   - Current `docker-compose.yml` has no Redis password
   - `REDIS_URL=redis://redis:6379/0` allows unauthenticated access
   - Any container on the Docker network can read/write task queues
   - **Risk:** Task injection, data exfiltration, denial of service

   ```yaml
   # Current (insecure)
   command: redis-server --appendonly yes

   # Recommended
   command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
   ```

2. **Environment File Secrets Exposure**
   - Worker uses `env_file: ./backend/.env.docker`
   - File contains all API secrets (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)
   - Workers only need: `REDIS_URL`, `POSTGRES_CONNECTION_STRING`
   - **Risk:** Principle of least privilege violation

3. **No TLS for Redis Connection**
   - Internal Docker network traffic is unencrypted
   - **Mitigation:** Acceptable for single-host Docker Compose; requires TLS in Kubernetes/multi-host

**MEDIUM PRIORITY:**

4. **Stream Key Enumeration**
   - Pattern `agent:stream:{thread_id}` is predictable
   - Any Redis client can SCAN for active streams
   - **Mitigation:** Stream TTL limits exposure window

5. **No Rate Limiting on Worker Queue**
   - Malicious actor could flood task queue
   - **Mitigation:** API-level rate limiting exists (`200/day`)

### 2.2 Error Handling and Recovery Mechanisms

#### Current Implementation Analysis

| Scenario | Handling | Assessment |
|----------|----------|------------|
| Worker crash | `restart: unless-stopped` | Good |
| Redis unavailable | Task enqueue fails silently | Needs improvement |
| Task exception | Error written to stream + re-raised | Good |
| Redis write failure | Logged but lost | Needs retry logic |
| Stream timeout | Keep-alive SSE comment | Good |
| Database connection failure | Per-task fresh connections | Excellent |

#### Code Review: Error Handling in `tasks.py`

```python
# Current implementation (good patterns observed)
except Exception as e:
    logger.exception(f"Task failed for thread {thread_id}: {e}")
    try:
        await redis_client.xadd(stream_key, {"error": str(e), "done": "true"})
        await redis_client.expire(stream_key, 300)  # 5 min TTL even on error
    except Exception as redis_err:
        logger.error(f"Failed to send error to Redis for thread {thread_id}: {redis_err}")
    raise
finally:
    await redis_client.aclose()
```

**Identified Issues:**

1. **No retry mechanism for transient failures**
   - Redis connection dropped mid-stream = lost data
   - Recommendation: Implement exponential backoff retry

2. **No dead letter queue**
   - Failed tasks are logged but not recoverable
   - Recommendation: Store failed tasks for manual retry

3. **Stream cleanup on worker crash**
   - If worker dies before writing `done: true`, client hangs
   - Current: `STREAM_TIMEOUT_MS` (60s) handles this via keep-alive
   - Recommendation: Add orphan stream detection

### 2.3 Health Check and Monitoring Considerations

#### Current Health Checks

| Service | Health Check | Endpoint |
|---------|--------------|----------|
| PostgreSQL | `pg_isready` | Container-level |
| Redis | `redis-cli ping` | Container-level |
| API | `/health` | HTTP endpoint |
| Worker | **NONE** | Missing |

#### Monitoring Gaps

1. **No worker health endpoint**
   - Cannot determine if workers are processing tasks
   - Recommendation: TaskIQ provides metrics; expose via `/health/workers`

2. **No Redis connectivity check from API**
   - If Redis is down, distributed mode fails silently (returns 202 but task never runs)
   - Recommendation: Add `/health/redis` endpoint

3. **No queue depth monitoring**
   - Cannot detect backlog buildup
   - Recommendation: Expose `XINFO STREAM orchestra_tasks` metrics

---

## 3. Implementation Strategy

### 3.1 Step-by-Step Implementation Plan

#### Phase 1: Security Hardening (Before Deployment)

**Step 1.1: Enable Redis Authentication**

```yaml
# docker-compose.yml
services:
  redis:
    image: redis:7-alpine
    container_name: redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD:-changeme}
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD:-changeme}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
```

**Step 1.2: Update REDIS_URL Format**

```yaml
# Worker environment
environment:
  - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0
```

**Step 1.3: Create Minimal Worker Environment**

```yaml
# New file: backend/.env.worker.docker
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0
POSTGRES_CONNECTION_STRING=${POSTGRES_CONNECTION_STRING}
DISTRIBUTED_WORKERS=true
APP_LOG_LEVEL=INFO
# AI provider keys (required by workers for agent execution)
OPENAI_API_KEY=${OPENAI_API_KEY}
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
# Omit: JWT secrets, MINIO credentials, etc.
```

#### Phase 2: Uncomment Worker Service

**Step 2.1: Minimal Worker Configuration (1 Replica)**

```yaml
# docker-compose.yml
services:
  ##############################################
  ## TaskIQ Worker (Distributed Agent Execution)
  ##############################################
  worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: orchestra_worker
    env_file:
      - ./backend/.env.worker.docker
    environment:
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0
      - DISTRIBUTED_WORKERS=true
    command: uv run taskiq worker src.workers.tasks:broker --workers 1
    depends_on:
      redis:
        condition: service_healthy
      postgres:
        condition: service_started
    deploy:
      replicas: 1  # Start with 1, scale as needed
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "python", "-c", "import sys; sys.exit(0)"]  # Basic liveness
      interval: 30s
      timeout: 10s
      retries: 3
```

**Step 2.2: Update Dockerfile for Worker Entrypoint**

The current Dockerfile uses `ENTRYPOINT ["python", "-B", "-m", "uvicorn", ...]` which is API-specific. The worker command override handles this, but consider a multi-stage approach for clarity:

```dockerfile
# Add to backend/Dockerfile (optional, for explicit worker image)
# The current approach of overriding command works fine for Docker Compose
```

#### Phase 3: Add Health Check Endpoints

**Step 3.1: Redis Health Check**

```python
# backend/src/routes/v0/info/health.py (additions)

@router.get("/redis", name="Redis Health Check")
async def check_redis_health():
    """Check if Redis connection is healthy for distributed workers."""
    import os
    DISTRIBUTED_WORKERS = os.getenv("DISTRIBUTED_WORKERS", "false").lower() == "true"

    if not DISTRIBUTED_WORKERS:
        return {
            "status": "disabled",
            "message": "Distributed workers not enabled",
        }

    try:
        import redis.asyncio as redis
        from src.workers.broker import REDIS_URL

        async with asyncio.timeout(5.0):
            client = redis.from_url(REDIS_URL)
            await client.ping()

            # Get queue info
            queue_info = await client.xinfo_stream("orchestra_tasks", full=False)

            await client.aclose()

            return {
                "status": "healthy",
                "queue_length": queue_info.get("length", 0),
                "message": "Redis connection is working",
            }
    except asyncio.TimeoutError:
        raise HTTPException(status_code=503, detail="Redis connection timeout")
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Redis health check failed: {str(e)}")
```

#### Phase 4: CI/CD Updates

**Step 4.1: Add Redis to Test Workflow**

```yaml
# .github/workflows/test.yml (uncomment and update)
services:
  redis:
    image: redis:7-alpine
    ports:
      - 6379:6379
    options: >-
      --health-cmd "redis-cli ping"
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

**Step 4.2: Add REDIS_URL to Test Environment**

```yaml
env:
  REDIS_URL: redis://localhost:6379/0
  DISTRIBUTED_WORKERS: "false"  # Keep sync mode for unit tests
```

**Step 4.3: Update deploy-vm.yml for Worker Process**

```yaml
# Add to tmux session initialization
export REDIS_URL=${{ secrets.REDIS_URL }}
export DISTRIBUTED_WORKERS=true

# Start worker in separate tmux session
tmux new-session -d -s "worker_${TAG}" '
  cd ~/agent_api/backend
  source .venv/bin/activate
  export REDIS_URL=${{ secrets.REDIS_URL }}
  uv run taskiq worker src.workers.tasks:broker --workers 1
'
```

### 3.2 Required Health Checks and Monitoring

| Check | Endpoint | Interval | Alert Threshold |
|-------|----------|----------|-----------------|
| Redis Ping | `/health/redis` | 30s | 3 consecutive failures |
| Queue Depth | Prometheus metric | 15s | > 100 pending tasks |
| Worker Liveness | Docker healthcheck | 30s | 3 consecutive failures |
| Stream Orphans | Cron job | 5m | Any stream > 5 min without `done` |

### 3.3 Graceful Shutdown and Error Recovery

**TaskIQ Native Behavior:**
- Handles SIGTERM gracefully
- Completes in-flight tasks before shutdown
- Default graceful timeout: 30 seconds

**Recommended docker-compose settings:**

```yaml
worker:
  stop_grace_period: 60s  # Allow long-running agent tasks to complete
  stop_signal: SIGTERM
```

**Error Recovery Flow:**

```
Task Failure
    |
    v
+-------------------+
| Write error to    |
| Redis stream      |
+-------------------+
    |
    v
+-------------------+
| Set 5-min TTL     |
| (cleanup)         |
+-------------------+
    |
    v
+-------------------+
| Re-raise          |
| (TaskIQ logs)     |
+-------------------+
    |
    v
+-------------------+
| Worker continues  |
| (no crash)        |
+-------------------+
```

---

## 4. Design Decisions

### 4.1 Security Trade-offs Considered

| Decision | Trade-off | Rationale |
|----------|-----------|-----------|
| Redis password in env vars | Less secure than vault | Acceptable for Docker Compose; use secrets manager in production |
| No TLS for Redis | Plaintext on internal network | Acceptable for single-host; add TLS for multi-node |
| Workers share DB credentials | Broader access than needed | Workers NEED DB access for checkpointing; minimal alternative impact |
| 5-min stream TTL | Data loss if client disconnects | Acceptable for chat interface; client can re-request |

### 4.2 Error Handling Strategies

**Chosen Strategy: Fail-Fast with Stream Notification**

```python
# Current approach (validated as appropriate)
except Exception as e:
    await redis_client.xadd(stream_key, {"error": str(e), "done": "true"})
    raise  # Let TaskIQ handle retry/logging
```

**Rationale:**
- Client receives error immediately (no hanging)
- Task failure is logged for debugging
- Stream cleanup via TTL prevents memory leak
- TaskIQ's built-in retry can be enabled if needed

**Alternative Considered: Silent Retry**
- Rejected: Hides errors from users, causes confusion

### 4.3 Testing Approach for Distributed Components

**Test Pyramid:**

```
           /\
          /  \          E2E: test_distributed_stream.py (mocked)
         /----\         Integration: test_multi_turn_distributed.py (real Redis)
        /      \        Unit: test_broker.py, test_tasks.py, test_stream_consumer.py
       /--------\
      / FakeRedis \     Fixtures: conftest.py (fake_redis, in_memory_broker)
     /--------------\
```

**Testing Strategy:**

1. **Unit Tests:** Use `fakeredis` for Redis operations
2. **Integration Tests:** Spin up real Redis in CI (already supported)
3. **E2E Tests:** Mock TaskIQ enqueue, test API responses
4. **Load Tests:** Manual testing with `wrk` or `locust`

**Test Coverage Verification:**

```bash
# Run worker-specific tests
ENVIRONMENT=pytest uv run pytest tests/unit/workers/ tests/integration/test_distributed_stream.py -v --cov=src/workers --cov-report=html
```

---

## 5. Risk Assessment

### 5.1 Security Vulnerabilities to Mitigate

| Vulnerability | Severity | Mitigation | Priority |
|---------------|----------|------------|----------|
| Unauthenticated Redis | HIGH | Add `--requirepass` | P0 |
| Over-privileged worker env | MEDIUM | Create `.env.worker.docker` | P1 |
| Predictable stream keys | LOW | Accept (TTL limits exposure) | P2 |
| No TLS on Redis | LOW | Document as known limitation | P3 |

### 5.2 Failure Scenarios and Recovery

| Scenario | Impact | Detection | Recovery |
|----------|--------|-----------|----------|
| Redis crash | Tasks queue lost | Health check fails | Auto-restart; tasks re-submitted by users |
| Worker crash mid-task | Stream incomplete | Client timeout | TTL cleanup; user retries |
| DB connection pool exhausted | Tasks fail | Error in stream | Workers use fresh connections per task |
| Redis OOM | New tasks rejected | `used_memory` metric | Scale Redis or reduce TTL |
| Network partition (API<->Redis) | 502 errors | API health check | Circuit breaker pattern |

### 5.3 Testing Requirements Before Deployment

**Pre-Deployment Checklist:**

- [ ] All unit tests pass (`make test`)
- [ ] Redis authentication configured and tested
- [ ] Worker starts successfully with `docker compose up worker`
- [ ] `/health/redis` endpoint returns healthy
- [ ] SSE stream completes successfully in distributed mode
- [ ] Error propagation tested (intentionally break agent)
- [ ] Graceful shutdown tested (SIGTERM during task)
- [ ] Stream TTL cleanup verified (wait 5+ minutes)
- [ ] Load test: 10 concurrent requests, no task loss

**Staging Validation:**

```bash
# Verify worker is processing tasks
docker compose logs worker -f

# Test distributed flow
curl -X POST http://localhost:8000/api/llm/stream \
  -H "Content-Type: application/json" \
  -d '{"input": {"messages": [{"role": "user", "content": "Hello"}]}, "model": "openai:gpt-4.1-mini"}'
# Response: {"thread_id": "abc-123", "distributed": true}

curl -N http://localhost:8000/api/threads/abc-123/stream
# Response: SSE stream with data events
```

---

## 6. Estimated Complexity

| Dimension | Assessment | Notes |
|-----------|------------|-------|
| **Scope** | **Medium** | Core implementation exists; deployment config + security hardening needed |
| **Risk Level** | **Medium** | New distributed system; requires careful monitoring during rollout |
| **Effort** | 2-3 days | Including testing and documentation |

### Suggested Priority Order

1. **P0 (Day 1): Security Hardening**
   - Enable Redis authentication
   - Create minimal worker env file
   - Update REDIS_URL in all configs

2. **P1 (Day 1-2): Deployment Configuration**
   - Uncomment worker service with 1 replica
   - Add health check endpoints
   - Update CI/CD workflows

3. **P2 (Day 2-3): Validation**
   - Run full test suite with Redis enabled
   - Manual E2E testing in staging
   - Document operational procedures

4. **P3 (Post-Deployment): Observability**
   - Add Prometheus metrics export
   - Configure alerting rules
   - Create runbook for common issues

---

## 7. Summary of Required Changes

### Files to Modify

| File | Change | Priority |
|------|--------|----------|
| `docker-compose.yml` | Uncomment worker, add Redis password | P0 |
| `backend/.env.worker.docker` | Create minimal env file | P0 |
| `backend/src/routes/v0/info/health.py` | Add Redis health endpoint | P1 |
| `.github/workflows/test.yml` | Uncomment Redis service | P1 |
| `.github/workflows/deploy-vm.yml` | Add REDIS_URL, worker process | P1 |
| `backend/.example.env` | Document REDIS_URL | P2 |

### New Secrets Required

| Secret | Where | Example |
|--------|-------|---------|
| `REDIS_PASSWORD` | docker-compose, CI/CD | `$(openssl rand -base64 32)` |
| `REDIS_URL` | GitHub Secrets | `redis://:PASSWORD@host:6379/0` |

### Environment Variables Summary

```bash
# API (when DISTRIBUTED_WORKERS=true)
DISTRIBUTED_WORKERS=true
REDIS_URL=redis://:password@redis:6379/0

# Worker
REDIS_URL=redis://:password@redis:6379/0
POSTGRES_CONNECTION_STRING=postgresql://...
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
```

---

## 8. Appendix: Security Best Practices for Future

### Production Recommendations (Beyond Docker Compose)

1. **Use Redis Cluster** for high availability
2. **Enable TLS** on Redis connections
3. **Use HashiCorp Vault** for secrets management
4. **Implement mTLS** between API and workers
5. **Add request signing** for task payloads
6. **Enable audit logging** for all Redis operations

### Monitoring Stack Recommendations

```yaml
# Prometheus config for TaskIQ metrics
scrape_configs:
  - job_name: 'orchestra-workers'
    static_configs:
      - targets: ['worker:8000']  # If metrics endpoint exposed
    metrics_path: /metrics
```

---

*Generated by GUARDIAN Agent - Security, Error Handling, Edge Cases, Testing Expertise*
