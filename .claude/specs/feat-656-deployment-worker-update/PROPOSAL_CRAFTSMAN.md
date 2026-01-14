# PROPOSAL: Deployment Update for Distributed Workers (1 Worker)

**Author:** CRAFTSMAN (Elite Software Architect)
**Focus:** Clean Code, Maintainability, SOLID Principles
**Date:** 2026-01-13

---

## 1. Executive Summary

This proposal recommends a minimal, clean configuration update to enable distributed workers in the Orchestra deployment. The approach maintains the existing multi-stage Dockerfile pattern while adding an entrypoint script that supports both API and worker modes via environment variable. The docker-compose.yml worker service should be uncommented with `replicas: 1` and proper service dependencies.

---

## 2. Architectural Analysis

### 2.1 Current State Assessment

#### Docker Compose (`docker-compose.yml`)

**Strengths:**
- Well-organized with clear section comments (`##############################################`)
- Consistent naming convention (`container_name`, `service_healthy` conditions)
- Redis service already properly configured with healthcheck
- Worker service skeleton exists (commented out, lines 51-69)

**Current Worker Configuration (Commented):**
```yaml
# worker:
#     build:
#         context: ./backend
#         dockerfile: Dockerfile
#     container_name: orchestra_worker
#     env_file:
#         - ./backend/.env.docker
#     environment:
#         - REDIS_URL=redis://redis:6379/0
#         - DISTRIBUTED_WORKERS=true
#     command: uv run taskiq worker src.workers.tasks:broker
#     depends_on:
#         redis:
#             condition: service_healthy
#         postgres:
#             condition: service_started
#     deploy:
#         replicas: 2  # Horizontal scaling
#     restart: unless-stopped
```

**Issues Identified:**
1. `container_name: orchestra_worker` conflicts with `replicas` (container names must be unique)
2. References non-existent `.env.docker` file pattern
3. Hardcoded `replicas: 2` - should be configurable (starting with 1)
4. No healthcheck for the worker service

#### Dockerfile (`backend/Dockerfile`)

**Current Pattern:**
```dockerfile
ENTRYPOINT ["python", "-B", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Issues Identified:**
1. Hardcoded entrypoint only supports API mode
2. No mechanism to switch to worker mode
3. Requires separate command override in docker-compose

### 2.2 Proposed Architecture

The cleanest approach follows the **Single Responsibility Principle** by:

1. **Dockerfile** - Builds a universal image capable of running either mode
2. **Entrypoint Script** - Routes to API or worker based on `RUN_MODE` environment variable
3. **Docker Compose** - Defines separate service blocks with clear responsibilities

```
+------------------+     +-----------------+     +----------------+
|   Dockerfile     | --> | entrypoint.sh   | --> | API Server     |
|   (Build Image)  |     | (Mode Router)   |     | OR             |
+------------------+     +-----------------+     | TaskIQ Worker  |
                                                 +----------------+
```

---

## 3. Implementation Strategy

### 3.1 Step 1: Create Entrypoint Script

**File:** `backend/docker/entrypoint.sh`

```bash
#!/bin/bash
set -e

# Default to API mode
RUN_MODE="${RUN_MODE:-api}"

case "$RUN_MODE" in
    api)
        echo "Starting Orchestra API server..."
        exec python -B -m uvicorn main:app --host 0.0.0.0 --port 8000
        ;;
    worker)
        echo "Starting Orchestra TaskIQ worker..."
        exec uv run taskiq worker src.workers.tasks:broker
        ;;
    *)
        echo "Unknown RUN_MODE: $RUN_MODE"
        echo "Supported modes: api, worker"
        exit 1
        ;;
esac
```

**Rationale:**
- Uses `exec` to replace shell process (proper signal handling)
- Clear logging of startup mode
- Explicit error handling for invalid modes
- Extensible for future modes (e.g., `scheduler`, `migrations`)

### 3.2 Step 2: Update Dockerfile

**File:** `backend/Dockerfile`

**Current (line 59):**
```dockerfile
ENTRYPOINT ["python", "-B", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Proposed:**
```dockerfile
# Copy entrypoint script
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Default environment (can be overridden)
ENV RUN_MODE=api

ENTRYPOINT ["/entrypoint.sh"]
```

**Alternative (Simpler, No Script):**

If adding a script feels like overkill for the current scope, use CMD override directly:

```dockerfile
# Keep existing ENTRYPOINT as default API command
ENTRYPOINT ["python", "-B", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

# In docker-compose, override with:
# command: ["uv", "run", "taskiq", "worker", "src.workers.tasks:broker"]
```

The current configuration already uses this pattern - the worker service has `command:` which overrides `ENTRYPOINT`.

### 3.3 Step 3: Update Docker Compose

**File:** `docker-compose.yml`

**Replace lines 48-69 with:**

```yaml
    ##############################################
    ## TaskIQ Worker (Distributed Agent Execution)
    ##############################################
    worker:
        build:
            context: ./backend
            dockerfile: Dockerfile
        # Note: container_name removed to allow replicas
        environment:
            - REDIS_URL=redis://redis:6379/0
            - DISTRIBUTED_WORKERS=true
            # Add any other required env vars here, or use env_file
        command: uv run taskiq worker src.workers.tasks:broker
        depends_on:
            redis:
                condition: service_healthy
            postgres:
                condition: service_started
        deploy:
            replicas: 1  # Start with 1 worker, scale as needed
        restart: unless-stopped
        healthcheck:
            test: ["CMD", "pgrep", "-f", "taskiq"]
            interval: 30s
            timeout: 10s
            retries: 3
            start_period: 10s
```

### 3.4 Step 4: Environment Variable Documentation

**Update:** `backend/.example.env`

Add new section:

```ini
#########################################################
## Distributed Workers (TaskIQ)
#########################################################
REDIS_URL=redis://localhost:6379/0
DISTRIBUTED_WORKERS=false
```

### 3.5 Step 5: Deployment Workflow Update (Optional)

For production deployment (`deploy-docker.yml`), add worker container management:

```yaml
# After starting graphchat container, start worker:
docker run -d \
  --name graphchat_worker \
  --network graphchat_default \
  --restart always \
  --env-file ./backend/.env \
  -e DISTRIBUTED_WORKERS=true \
  -e REDIS_URL=redis://redis:6379/0 \
  $GHCR_IMAGE:$TAG \
  uv run taskiq worker src.workers.tasks:broker
```

---

## 4. Design Decisions

### 4.1 Why Command Override vs. Entrypoint Script?

| Approach | Pros | Cons |
|----------|------|------|
| **Command Override** (Recommended for v1) | No Dockerfile changes, works today, minimal diff | Less discoverable, pattern must be repeated |
| **Entrypoint Script** | Self-documenting, extensible, single source of truth | Requires new file, Dockerfile change, more testing |

**Recommendation:** Use command override for initial deployment (simpler). Plan entrypoint script for v2 when scaling needs increase.

### 4.2 Why Remove `container_name`?

Docker Compose's `deploy.replicas` creates multiple containers. Each needs a unique name. Removing `container_name` lets Docker generate unique names like `orchestra-worker-1`, `orchestra-worker-2`.

### 4.3 Why Add Healthcheck?

Workers should be monitored. The simple `pgrep -f taskiq` healthcheck:
- Verifies the worker process is running
- Enables Docker Compose to restart failed workers
- Provides visibility in `docker-compose ps`

### 4.4 Why `replicas: 1` Initially?

- Validates configuration works before scaling
- Simpler debugging during initial rollout
- Resource-conscious (workers consume memory/CPU for agent execution)
- Can scale up via `docker-compose up --scale worker=N` or edit replicas

### 4.5 Alignment with Existing Patterns

The proposed configuration follows established patterns in the codebase:

1. **Section Comments:** Uses existing `##############################################` format
2. **Depends On:** Uses same `service_healthy`/`service_started` conditions as other services
3. **Healthcheck:** Follows Redis healthcheck pattern
4. **Restart Policy:** Uses `unless-stopped` like other persistent services

---

## 5. Risk Assessment

### 5.1 Potential Issues

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Worker crashes on startup | Medium | Low | Healthcheck + restart policy |
| Redis connection issues | Low | Medium | Depends_on with service_healthy |
| Database connection pool exhaustion | Medium | High | Monitor pool usage, tune settings |
| Environment variable mismatch | Medium | Medium | Document required env vars |
| Message broker desync | Low | Medium | Redis Streams provides durability |

### 5.2 Configuration Drift Risks

- **Problem:** Worker and API may drift if separate env files are used
- **Solution:** Use same env_file or document shared variables

### 5.3 Documentation Needs

1. Update `CLAUDE.md` with worker deployment instructions
2. Add `REDIS_URL` and `DISTRIBUTED_WORKERS` to `.example.env`
3. Create runbook for scaling workers (`docker-compose up --scale worker=N`)
4. Document healthcheck monitoring approach

---

## 6. Implementation Checklist

### Minimal Implementation (Scope: Small)

- [ ] **docker-compose.yml:** Uncomment worker service
- [ ] **docker-compose.yml:** Remove `container_name` line
- [ ] **docker-compose.yml:** Change `replicas: 2` to `replicas: 1`
- [ ] **docker-compose.yml:** Add healthcheck section
- [ ] **.example.env:** Add `REDIS_URL` and `DISTRIBUTED_WORKERS`

### Extended Implementation (Scope: Medium)

- [ ] All minimal items above
- [ ] **backend/docker/entrypoint.sh:** Create mode-switching script
- [ ] **backend/Dockerfile:** Use entrypoint script
- [ ] **.github/workflows/deploy-docker.yml:** Add worker container deployment

---

## 7. Estimated Complexity

| Metric | Assessment |
|--------|------------|
| **Scope** | **Small** |
| **Risk Level** | **Low** |
| **Files Changed** | 2-3 (docker-compose.yml, .example.env, optionally Dockerfile) |
| **Testing Required** | Manual verification of worker startup and task processing |
| **Rollback Strategy** | Comment out worker service, set `DISTRIBUTED_WORKERS=false` |

### Priority Order

1. **Highest:** docker-compose.yml worker service update
2. **High:** .example.env documentation update
3. **Medium:** Deployment workflow update (for production)
4. **Lower:** Entrypoint script refactor (for maintainability)

---

## 8. Final Diff Summary

### `docker-compose.yml` (Lines 48-69)

```diff
     ##############################################
     ## TaskIQ Worker (Distributed Agent Execution)
     ##############################################
-    # worker:
-    #     build:
-    #         context: ./backend
-    #         dockerfile: Dockerfile
-    #     container_name: orchestra_worker
-    #     env_file:
-    #         - ./backend/.env.docker
-    #     environment:
-    #         - REDIS_URL=redis://redis:6379/0
-    #         - DISTRIBUTED_WORKERS=true
-    #     command: uv run taskiq worker src.workers.tasks:broker
-    #     depends_on:
-    #         redis:
-    #             condition: service_healthy
-    #         postgres:
-    #             condition: service_started
-    #     deploy:
-    #         replicas: 2  # Horizontal scaling
-    #     restart: unless-stopped
+    worker:
+        build:
+            context: ./backend
+            dockerfile: Dockerfile
+        environment:
+            - REDIS_URL=redis://redis:6379/0
+            - DISTRIBUTED_WORKERS=true
+        command: uv run taskiq worker src.workers.tasks:broker
+        depends_on:
+            redis:
+                condition: service_healthy
+            postgres:
+                condition: service_started
+        deploy:
+            replicas: 1
+        restart: unless-stopped
+        healthcheck:
+            test: ["CMD", "pgrep", "-f", "taskiq"]
+            interval: 30s
+            timeout: 10s
+            retries: 3
+            start_period: 10s
```

### `backend/.example.env` (Append)

```diff
+ #########################################################
+ ## Distributed Workers (TaskIQ)
+ #########################################################
+ REDIS_URL=redis://localhost:6379/0
+ DISTRIBUTED_WORKERS=false
```

---

## 9. Conclusion

This proposal provides a clean, maintainable path to enabling distributed workers with minimal changes. The approach:

- Follows existing code conventions
- Maintains single responsibility in configuration
- Provides clear rollback strategy
- Scales from 1 to N workers seamlessly
- Documents the configuration for future maintainers

The recommended implementation is the **minimal scope** (Small), which requires only uncommenting and adjusting the docker-compose.yml worker service. The entrypoint script approach is documented for future consideration when the team wants a more self-documenting container image.
