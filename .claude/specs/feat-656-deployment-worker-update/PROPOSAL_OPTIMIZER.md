# PROPOSAL: Distributed Workers Deployment Update (1 Worker)

**Agent:** AGENT_4: OPTIMIZER
**Focus Area:** Performance, Efficiency, and Resource Management
**Date:** 2026-01-13
**PR Reference:** #657 (Distributed Workers via TaskIQ)

---

## 1. Executive Summary

The PR #657 introduces TaskIQ-based distributed workers with Redis Streams for reliable agent execution offloading. The current docker-compose.yml suggests `deploy.replicas: 2` which is over-provisioned for initial deployment. This proposal recommends deploying with **1 worker replica** with optimized resource limits, proper connection pooling configuration, and performance monitoring to ensure efficient resource utilization while maintaining reliability. The single-worker approach reduces infrastructure costs by ~50% while providing adequate throughput for typical workloads, with clear scaling triggers defined for future horizontal expansion.

---

## 2. Architectural Analysis

### 2.1 Resource Analysis for 1-Worker Deployment

**Worker Process Resource Profile:**

| Resource | Estimated Usage | Rationale |
|----------|----------------|-----------|
| **Memory** | 512MB - 1GB | LangChain/LangGraph agent execution with model serialization |
| **CPU** | 0.5 - 1.0 cores | Async I/O bound with periodic CPU bursts during response parsing |
| **Database Connections** | 2-4 per task | `AsyncPostgresSaver` + `AsyncPostgresStore` with connection pooling |
| **Redis Connections** | 2-3 per worker | Broker connection + stream writes + result backend |

**Current Configuration Analysis:**

```python
# From backend/src/constants/__init__.py
DB_POOL_MIN_SIZE = 5    # Per-process pool minimum
DB_POOL_MAX_SIZE = 20   # Per-process pool maximum
DB_POOL_MAX_LIFETIME = 3600  # 1 hour connection lifetime
```

**Bottleneck Identification:**

1. **Database Connection Saturation**: With default `DB_POOL_MAX_SIZE=20`, a single worker can consume up to 20 PostgreSQL connections. Combined with the main API server, this approaches typical PostgreSQL `max_connections` limits (100 default).

2. **Redis Stream Memory**: Each `agent:stream:{thread_id}` key with 5-minute TTL can accumulate significant data for long-running agent tasks. Estimated 10-50KB per stream depending on tool call verbosity.

3. **Memory Pressure**: Agent execution loads multiple LangChain/LangGraph components into memory. Without proper limits, worker memory can grow unbounded during heavy load.

### 2.2 Performance Implications of Distributed Architecture

**Latency Analysis:**

| Path | Direct Streaming | Distributed (TaskIQ) |
|------|-----------------|---------------------|
| **Request to First Byte** | ~50-200ms | ~200-500ms (+Redis queue latency) |
| **Task Handoff** | N/A | ~10-50ms (Redis XADD) |
| **Stream Consumption** | Direct SSE | Redis XREAD polling (configurable) |

**Throughput Considerations:**

- Single worker with async execution can handle 5-20 concurrent agent tasks depending on model latency
- Redis Streams provides ordering guarantees within a stream key
- Result backend 5-minute TTL prevents indefinite result accumulation

### 2.3 Bottleneck Mitigation Strategy

| Bottleneck | Mitigation |
|------------|------------|
| DB Connection Exhaustion | Reduce `DB_POOL_MAX_SIZE` to 10 for workers, 15 for API |
| Redis Memory Growth | Already addressed with 300s TTL on streams and results |
| Worker Memory Bloat | Container memory limit of 1GB with OOM handling |
| Cold Start Latency | Worker healthcheck with startup probe |

---

## 3. Implementation Strategy

### 3.1 Step-by-Step Implementation

#### Step 1: Update docker-compose.yml Worker Configuration

Uncomment and modify the worker service with resource-optimized settings:

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
        # Reduced pool sizes for worker process
        - DB_POOL_MIN_SIZE=2
        - DB_POOL_MAX_SIZE=10
        - DB_POOL_MAX_IDLE_TIME=300
    command: uv run taskiq worker src.workers.tasks:broker --workers 1
    depends_on:
        redis:
            condition: service_healthy
        postgres:
            condition: service_started
    deploy:
        replicas: 1  # Single worker for initial deployment
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
        start_period: 60s
```

#### Step 2: Update Environment Configuration

Add to `.example.env` and production `.env.docker`:

```bash
#########################################################
## Distributed Workers (TaskIQ)
#########################################################
DISTRIBUTED_WORKERS=false  # Set to 'true' to enable distributed mode
REDIS_URL=redis://localhost:6379/0
STREAM_TIMEOUT_MS=60000  # SSE stream polling timeout

# Worker-specific pool settings (lower than API server)
# DB_POOL_MIN_SIZE=2
# DB_POOL_MAX_SIZE=10
```

#### Step 3: Update Redis Configuration for Performance

Enhance Redis container with memory optimization:

```yaml
redis:
    image: redis:7-alpine
    container_name: redis
    ports:
        - "6379:6379"
    volumes:
        - redis_data:/data
    command: >
        redis-server
        --appendonly yes
        --maxmemory 256mb
        --maxmemory-policy volatile-ttl
        --tcp-keepalive 60
    healthcheck:
        test: ["CMD", "redis-cli", "ping"]
        interval: 10s
        timeout: 5s
        retries: 5
    deploy:
        resources:
            limits:
                memory: 512M
            reservations:
                memory: 128M
```

#### Step 4: Update Deployment Workflow

Modify `.github/workflows/deploy-docker.yml` to deploy worker alongside main container:

```yaml
# After main container deployment, start worker
echo '--- Starting worker container ---'
docker stop orchestra_worker 2>/dev/null || true
docker rm orchestra_worker 2>/dev/null || true

docker run -d \
  --name orchestra_worker \
  --network graphchat_default \
  --restart always \
  --env-file ./backend/.env \
  -e DISTRIBUTED_WORKERS=true \
  -e REDIS_URL=redis://redis:6379/0 \
  -e DB_POOL_MIN_SIZE=2 \
  -e DB_POOL_MAX_SIZE=10 \
  --memory=1g \
  --cpus=1 \
  $GHCR_IMAGE:$TAG \
  uv run taskiq worker src.workers.tasks:broker --workers 1

echo '--- Worker deployment complete ---'
```

#### Step 5: Create Worker Dockerfile (Optional)

If the worker needs a dedicated entry point, create `backend/Dockerfile.worker`:

```dockerfile
# Extends main Dockerfile with worker-specific entrypoint
FROM python:3.12-slim-bookworm AS worker

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# Copy from main build
COPY --from=builder /app /app

ENTRYPOINT ["uv", "run", "taskiq", "worker", "src.workers.tasks:broker", "--workers", "1"]
```

### 3.2 Recommended Resource Limits and Reservations

| Service | Memory Limit | Memory Reserve | CPU Limit | CPU Reserve |
|---------|-------------|----------------|-----------|-------------|
| **worker** | 1GB | 256MB | 1.0 | 0.25 |
| **redis** | 512MB | 128MB | 0.5 | 0.1 |
| **postgres** | 2GB | 512MB | 2.0 | 0.5 |
| **orchestra (API)** | 2GB | 512MB | 2.0 | 0.5 |

### 3.3 Connection Pool and Memory Optimization

**Database Connection Budget:**

| Process | Pool Min | Pool Max | Rationale |
|---------|----------|----------|-----------|
| API Server | 5 | 15 | Higher concurrency for HTTP requests |
| Worker | 2 | 10 | Lower, tasks are serialized |
| **Total Maximum** | 7 | **25** | Under PostgreSQL default 100 |

**Redis Connection Budget:**

- Broker: 1 persistent connection per worker
- Stream writes: Reused from broker
- Result backend: 1 persistent connection
- API stream consumer: 1 connection per active SSE stream

**Estimated Total Redis Connections:** 5-20 depending on concurrent streams

---

## 4. Design Decisions

### 4.1 Single Worker vs Multiple Workers Trade-offs

| Factor | 1 Worker | 2+ Workers |
|--------|----------|------------|
| **Resource Cost** | Lower (1GB RAM, 1 CPU) | Higher (2GB+ RAM, 2+ CPU) |
| **Fault Tolerance** | Lower (single point of failure) | Higher (redundancy) |
| **Throughput** | 5-20 concurrent tasks | 10-40+ concurrent tasks |
| **Complexity** | Simpler deployment | Redis consumer group coordination |
| **Scaling Trigger** | Queue depth > 10, P99 > 5s | N/A |

**Recommendation:** Start with 1 worker. The async nature of TaskIQ combined with I/O-bound LLM operations means a single worker can handle significant load. Scale when:
- Average queue depth exceeds 10 messages for > 1 minute
- P99 task latency exceeds 5 seconds
- Worker memory consistently exceeds 80% (800MB)

### 4.2 Resource Allocation Strategy

**Tiered Resource Allocation:**

```
Priority 1 (Critical): postgres, redis
Priority 2 (High):     orchestra (API)
Priority 3 (Medium):   worker
Priority 4 (Low):      ollama, search_engine, exec_server
```

**OOM Handling:**
- Worker should be set to `restart: unless-stopped`
- Container runtime will kill and restart on OOM
- Consider adding `oom_score_adj: 500` to make worker first to be killed under system pressure

### 4.3 Performance Monitoring Recommendations

**Key Metrics to Monitor:**

1. **Redis Stream Metrics:**
   - `XLEN orchestra_tasks` - Queue depth
   - `XINFO GROUPS orchestra_tasks` - Consumer lag
   - `INFO memory` - Redis memory usage

2. **Worker Process Metrics:**
   - Task duration histogram
   - Error rate by exception type
   - Memory RSS over time

3. **Database Metrics:**
   - `pg_stat_activity` connection count
   - Query latency percentiles
   - Connection pool wait time

**Suggested Monitoring Commands:**

```bash
# Redis queue depth
docker exec redis redis-cli XLEN orchestra_tasks

# Active PostgreSQL connections
docker exec postgres psql -U admin -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"

# Worker memory usage
docker stats orchestra_worker --no-stream
```

---

## 5. Risk Assessment

### 5.1 Performance Bottlenecks to Watch

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Queue Backlog** | Medium | High | Monitor XLEN, scale workers if > 10 pending |
| **DB Connection Exhaustion** | Low | Critical | Reduced pool sizes, connection monitoring |
| **Redis Memory Overflow** | Low | Medium | 256MB maxmemory with volatile-ttl eviction |
| **Worker OOM** | Medium | Medium | 1GB limit with restart policy |
| **Cold Start Delays** | Low | Low | 60s startup probe, preload critical imports |

### 5.2 Resource Exhaustion Scenarios

**Scenario 1: Burst Traffic (100 concurrent requests)**
- Queue depth spikes to 100
- Single worker processes ~5/minute with typical LLM latency
- Expected clear time: 20 minutes
- **Mitigation:** If unacceptable, pre-scale to 2 workers

**Scenario 2: Long-Running Agent Tasks (10+ minutes)**
- Worker blocked on single task
- Queue depth grows linearly
- **Mitigation:** Task timeout configuration, worker concurrency tuning

**Scenario 3: Redis Restart**
- In-flight tasks lost (Redis Streams are persisted but workers may not retry)
- **Mitigation:** TaskIQ has retry mechanisms; ensure `--appendonly yes` for Redis

### 5.3 Scaling Considerations for Future

**Horizontal Scaling Trigger Points:**

| Metric | Threshold | Action |
|--------|-----------|--------|
| Queue Depth | > 10 sustained | Add 1 worker replica |
| P99 Latency | > 5 seconds | Add 1 worker replica |
| Worker Memory | > 80% sustained | Increase limit OR add replica |
| Error Rate | > 5% | Investigate before scaling |

**Vertical Scaling Limits:**
- Single worker max recommended: 2GB RAM, 2 CPU
- Beyond this, horizontal scaling is more cost-effective

**Redis Consumer Groups (Future):**
When scaling to 2+ workers, consider Redis Consumer Groups for load distribution:
```python
# Future enhancement to broker.py
broker = RedisStreamBroker(
    url=REDIS_URL,
    queue_name="orchestra_tasks",
    group_name="orchestra_workers",  # Enable consumer groups
)
```

---

## 6. Estimated Complexity

### Scope Assessment

| Category | Assessment |
|----------|------------|
| **Scope** | **Medium** |
| **Risk Level** | **Low** |
| **Estimated Effort** | 4-8 hours |

### Implementation Priority Order

1. **High Priority (Required for deployment)**
   - Uncomment and configure worker service in docker-compose.yml
   - Set `deploy.replicas: 1` with resource limits
   - Add `DISTRIBUTED_WORKERS=true` to production environment

2. **Medium Priority (Recommended)**
   - Update Redis configuration with memory limits
   - Add worker deployment step to CI/CD workflow
   - Configure reduced DB pool sizes for worker

3. **Low Priority (Nice to have)**
   - Create dedicated Dockerfile.worker
   - Add monitoring/alerting configuration
   - Document scaling runbook

### Files to Modify

| File | Change Type | Priority |
|------|-------------|----------|
| `docker-compose.yml` | Uncomment worker, set replicas=1, add resources | High |
| `backend/.env.docker` | Add DISTRIBUTED_WORKERS, REDIS_URL | High |
| `backend/.example.env` | Document worker env vars | Medium |
| `.github/workflows/deploy-docker.yml` | Add worker container deployment | Medium |
| `backend/src/constants/__init__.py` | No change needed (env vars sufficient) | N/A |

---

## 7. Summary of Recommendations

1. **Deploy with 1 worker replica** to minimize resource usage while validating the distributed architecture
2. **Set container memory limit to 1GB** to prevent unbounded growth
3. **Reduce worker DB pool size** to 10 max connections to prevent connection exhaustion
4. **Configure Redis maxmemory** to 256MB with volatile-ttl eviction
5. **Monitor queue depth and P99 latency** as scaling triggers
6. **Plan for horizontal scaling** when queue depth exceeds 10 or P99 exceeds 5 seconds

The single-worker configuration provides a safe, observable entry point for distributed agent execution. The architecture is designed for straightforward horizontal scaling when performance requirements increase.

---

*Proposal prepared by AGENT_4: OPTIMIZER*
*Focus: Performance, Efficiency, and Resource Management*
