# COUNCIL REVIEW: Deployment Worker Update

**Review Date:** 2026-01-13
**PR Reference:** #657 (Distributed Workers via TaskIQ)
**Objective:** Enable single TaskIQ worker in deployment configuration

---

## 1. Executive Summary

All five elite agents (ARCHITECT, CRAFTSMAN, GUARDIAN, OPTIMIZER, INTEGRATOR) reviewed PR #657 and produced comprehensive proposals for deploying a single TaskIQ worker. This review synthesizes their findings into a unified implementation plan.

**Unanimous Consensus:**
- Uncomment the worker service in `docker-compose.yml`
- Set `deploy.replicas: 1` (not 2 as originally commented)
- Use `command:` override (no Dockerfile changes required)
- Document `REDIS_URL` and `DISTRIBUTED_WORKERS` in `.example.env`

**Overall Assessment:**
| Metric | Value |
|--------|-------|
| Scope | **Small** |
| Risk Level | **Low** |
| Files Modified | 2-3 |
| Estimated Effort | 1-2 hours |

---

## 2. Proposal Comparison Matrix

| Aspect | ARCHITECT | CRAFTSMAN | GUARDIAN | OPTIMIZER | INTEGRATOR |
|--------|-----------|-----------|----------|-----------|------------|
| **Approach** | Command override | Command override | Command override | Command override | Command override |
| **Replicas** | 1 | 1 | 1 | 1 | 1 |
| **Healthcheck** | Optional | Yes (`pgrep`) | Yes (HTTP endpoint) | Yes (`pgrep`) | Optional |
| **container_name** | Keep | Remove | Remove | Keep (single replica) | Keep |
| **Resource Limits** | Not specified | Not specified | Not specified | 1GB/1CPU | Not specified |
| **Redis Auth** | Not specified | Not specified | Recommended | Not specified | Not specified |
| **DB Pool Tuning** | Not specified | Not specified | Not specified | Yes (10 max) | Not specified |
| **Entrypoint Script** | Future enhancement | Future enhancement | Not recommended | Optional | Not needed |

---

## 3. Synthesized Recommendations

### 3.1 Must Implement (High Priority)

These changes have unanimous agreement and are required for deployment:

#### 1. Uncomment Worker Service in `docker-compose.yml`

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
    restart: unless-stopped
```

**Key Changes from Original Commented Version:**
- Remove `container_name: orchestra_worker` (CRAFTSMAN recommendation - allows future scaling)
- Remove `env_file: ./backend/.env.docker` (file doesn't exist, use `environment:` instead)
- Change `replicas: 2` to `replicas: 1`

#### 2. Update `.example.env`

```bash
#########################################################
## Distributed Workers (TaskIQ)
#########################################################
REDIS_URL=redis://localhost:6379/0
DISTRIBUTED_WORKERS=false
```

### 3.2 Should Implement (Medium Priority)

These changes improve reliability and observability:

#### 1. Add Healthcheck (CRAFTSMAN + OPTIMIZER)

```yaml
healthcheck:
    test: ["CMD", "pgrep", "-f", "taskiq"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 10s
```

**Rationale:** Simple process check verifies worker is running. Docker Compose can restart failed workers automatically.

**Alternative (GUARDIAN):** HTTP health endpoint - more complex, requires code changes, defer to future iteration.

### 3.3 Could Implement (Lower Priority)

These are optional optimizations for future consideration:

#### 1. Resource Limits (OPTIMIZER)

```yaml
deploy:
    replicas: 1
    resources:
        limits:
            cpus: '1.0'
            memory: 1G
        reservations:
            cpus: '0.25'
            memory: 256M
```

**Rationale:** Prevents unbounded memory growth. Single worker estimated at 512MB-1GB during agent execution.

**Decision:** Include in initial deployment for predictable resource usage.

#### 2. Database Connection Pool Tuning (OPTIMIZER)

```yaml
environment:
    - DB_POOL_MIN_SIZE=2
    - DB_POOL_MAX_SIZE=10
```

**Rationale:** Prevents connection exhaustion. Worker needs fewer connections than API.

**Decision:** Defer - existing per-task connection pattern is sufficient for 1 worker.

#### 3. Redis Authentication (GUARDIAN)

**Rationale:** Security best practice for production.

**Decision:** Defer - not required for initial deployment. Document as future enhancement.

#### 4. Entrypoint Script (ARCHITECT + CRAFTSMAN)

**Rationale:** Self-documenting, extensible for future modes.

**Decision:** Defer - command override is sufficient and simpler.

---

## 4. Risk Assessment Summary

| Risk | Likelihood | Impact | Mitigation | Owner |
|------|------------|--------|------------|-------|
| Worker fails to start | Low | Medium | Healthcheck + restart policy | Ops |
| Redis connection issues | Low | High | `depends_on` with `service_healthy` | Config |
| DB connection exhaustion | Low | High | Monitor pool usage | Ops |
| Task queue backlog | Medium | Low | Monitor XLEN, scale if needed | Ops |
| Environment mismatch | Medium | Medium | Single source env vars | Config |

**Rollback Strategy (All Agents Agree):**
1. Comment out worker service in docker-compose.yml
2. Set `DISTRIBUTED_WORKERS=false` on API container
3. Clear pending tasks: `docker exec redis redis-cli DEL orchestra_tasks`

---

## 5. Final Implementation Specification

### Files to Modify

| File | Action | Priority |
|------|--------|----------|
| `docker-compose.yml` | Uncomment worker, update config | **Critical** |
| `backend/.example.env` | Add REDIS_URL, DISTRIBUTED_WORKERS | **High** |
| `.github/workflows/deploy-docker.yml` | Add worker container deployment | **High** |
| `.github/workflows/test.yml` | Uncomment Redis service, add REDIS_URL env | **High** |
| `.github/workflows/deploy-vm.yml` | Add worker tmux session (optional) | Medium |

### Final docker-compose.yml Worker Block

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

---

## 6. Testing Requirements

### Pre-Deployment Verification

```bash
# 1. Build the image
docker compose build worker

# 2. Start infrastructure
docker compose up -d postgres redis

# 3. Start worker in foreground (verify startup)
docker compose run --rm worker

# 4. Test full flow
docker compose up -d worker
curl -X POST http://localhost:8000/api/llm/stream \
  -H "Content-Type: application/json" \
  -d '{"input":{"messages":[{"role":"user","content":"Hello"}]},"model":"openai:gpt-4.1-mini"}'
# Should return 202 with thread_id

# 5. Verify Redis stream
docker exec redis redis-cli XINFO STREAM orchestra_tasks
```

### Post-Deployment Verification

- [ ] Worker container running: `docker compose ps worker`
- [ ] Worker logs show TaskIQ startup: `docker compose logs worker`
- [ ] API returns 202 for /llm/stream requests
- [ ] Stream consumption works: `GET /api/threads/{id}/stream`
- [ ] Redis memory stable: `docker exec redis redis-cli INFO memory`

---

## 7. Conclusion

The deployment update for enabling a single TaskIQ worker is a **low-complexity, low-risk change**. The backend implementation from PR #657 is complete - this proposal addresses only the deployment configuration layer.

**Recommended Implementation Order:**
1. Update `docker-compose.yml` with final worker block (above)
2. Add environment variables to `.example.env`
3. Update `.github/workflows/test.yml` to enable Redis service
4. Update `.github/workflows/deploy-docker.yml` to deploy worker container
5. Test locally with `docker compose up redis postgres worker`
6. Deploy to production

**Future Enhancements (Out of Scope):**
- Redis authentication for production security
- Worker scaling (replicas: 2+) based on load
- Entrypoint script for multi-mode container
- Database connection pool tuning
- Comprehensive monitoring/alerting

---

*Council Review completed by synthesis of ARCHITECT, CRAFTSMAN, GUARDIAN, OPTIMIZER, and INTEGRATOR proposals.*
