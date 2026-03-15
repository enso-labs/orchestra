# Spec 005: Test & Benchmark Environment

## Problem

No automated way to measure image sizes, validate that split images work correctly, or detect regressions in container behavior.

## Changes

### 1. Create `docker-compose.test.yml`

Integration test compose file that validates both images work together:

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: test1234
      POSTGRES_DB: lg_template_test
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U admin"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    image: ${API_IMAGE:-ghcr.io/ruska-ai/orchestra-api:latest}
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    environment:
      APP_ENV: test
      POSTGRES_CONNECTION_STRING: postgresql://admin:test1234@postgres:5432/lg_template_test
      REDIS_URL: redis://redis:6379/0
    ports: ["8000:8000"]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/info"]
      interval: 10s
      timeout: 5s
      retries: 5

  worker:
    image: ${WORKER_IMAGE:-ghcr.io/ruska-ai/orchestra-worker:latest}
    depends_on:
      api: { condition: service_healthy }
      redis: { condition: service_healthy }
    environment:
      DISTRIBUTED_WORKERS: "true"
      POSTGRES_CONNECTION_STRING: postgresql://admin:test1234@postgres:5432/lg_template_test
      REDIS_URL: redis://redis:6379/0
    healthcheck:
      test: ["CMD", "pgrep", "-f", "taskiq"]
      interval: 10s
      timeout: 5s
      retries: 5
```

### 2. Create `backend/scripts/benchmark-images.sh`

```bash
#!/bin/bash
set -e

echo "=== Image Size Benchmark ==="

# Build both targets
docker build --target api -t orchestra-api:bench backend/
docker build --target worker -t orchestra-worker:bench backend/

# Report sizes
echo ""
echo "| Image | Size |"
echo "|-------|------|"
docker images orchestra-api:bench --format "| API | {{.Size}} |"
docker images orchestra-worker:bench --format "| Worker | {{.Size}} |"

# If baseline exists, compare
if docker images orchestra:baseline --format "{{.Size}}" 2>/dev/null; then
  docker images orchestra:baseline --format "| Baseline (before) | {{.Size}} |"
fi

echo ""
echo "=== Layer Analysis ==="
echo "--- API layers ---"
docker history orchestra-api:bench --format "{{.Size}}\t{{.CreatedBy}}" | head -10
echo ""
echo "--- Worker layers ---"
docker history orchestra-worker:bench --format "{{.Size}}\t{{.CreatedBy}}" | head -10
```

### 3. Create `backend/scripts/test-images.sh`

```bash
#!/bin/bash
set -e

TAG=${1:-latest}
export API_IMAGE="ghcr.io/ruska-ai/orchestra-api:$TAG"
export WORKER_IMAGE="ghcr.io/ruska-ai/orchestra-worker:$TAG"

echo "=== Testing images: API=$API_IMAGE, Worker=$WORKER_IMAGE ==="

# Start test environment
docker compose -f docker-compose.test.yml up -d

# Wait for health
echo "Waiting for services..."
for i in {1..30}; do
  if curl -sf http://localhost:8000/api/info > /dev/null 2>&1; then
    echo "API is healthy!"
    break
  fi
  sleep 2
  if [ $i -eq 30 ]; then
    echo "FAIL: API did not become healthy"
    docker compose -f docker-compose.test.yml logs
    docker compose -f docker-compose.test.yml down -v
    exit 1
  fi
done

# Validate Worker is running
WORKER_RUNNING=$(docker compose -f docker-compose.test.yml ps worker --format "{{.Health}}")
if [[ "$WORKER_RUNNING" == *"healthy"* ]]; then
  echo "Worker is healthy!"
else
  echo "WARN: Worker health unknown, checking process..."
  docker compose -f docker-compose.test.yml exec worker pgrep -f taskiq || {
    echo "FAIL: Worker process not found"
    docker compose -f docker-compose.test.yml logs worker
    docker compose -f docker-compose.test.yml down -v
    exit 1
  }
fi

# Basic API smoke tests
echo "=== Smoke Tests ==="
curl -sf http://localhost:8000/api/info | python -m json.tool
echo "GET /api/info: PASS"

# Cleanup
docker compose -f docker-compose.test.yml down -v
echo "=== All tests passed ==="
```

### 4. Add CI benchmark step to `.github/workflows/build.yml`

Add after the build step:

```yaml
- name: Report image sizes
  run: |
    echo "## Docker Image Sizes" >> $GITHUB_STEP_SUMMARY
    echo "" >> $GITHUB_STEP_SUMMARY
    echo "| Image | Size |" >> $GITHUB_STEP_SUMMARY
    echo "|-------|------|" >> $GITHUB_STEP_SUMMARY
    docker images ghcr.io/ruska-ai/orchestra-api --format "| API | {{.Size}} |" >> $GITHUB_STEP_SUMMARY
    docker images ghcr.io/ruska-ai/orchestra-worker --format "| Worker | {{.Size}} |" >> $GITHUB_STEP_SUMMARY
```

### 5. Add Makefile targets

```makefile
# Image benchmarks
benchmark.images:
	bash backend/scripts/benchmark-images.sh

# Integration test with split images
test.images:
	bash backend/scripts/test-images.sh $(TAG)
```

## Files Created/Modified

- `docker-compose.test.yml` (new)
- `backend/scripts/benchmark-images.sh` (new)
- `backend/scripts/test-images.sh` (new)
- `.github/workflows/build.yml` (add size reporting step)
- `Makefile` (add benchmark/test targets)

## Verification

```bash
# Before changes: tag current image as baseline
docker build -t orchestra:baseline backend/

# After changes: run benchmarks
make benchmark.images

# Run integration tests
make test.images TAG=test
```
