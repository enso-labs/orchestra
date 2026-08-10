#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TAG=${1:-latest}
export API_IMAGE="ghcr.io/ruska-ai/orchestra-api:$TAG"
: "${POSTGRES_CONNECTION_STRING:?POSTGRES_CONNECTION_STRING is required}"

# This script validates the single API image and its ordered init path.
echo "=== Testing single Aegra API image: $API_IMAGE ==="

cleanup() {
  docker stop orchestra_api_image_test >/dev/null 2>&1 || true
  docker compose -f "$PROJECT_ROOT/infra/docker-compose.yml" down --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker compose -f "$PROJECT_ROOT/infra/docker-compose.yml" up -d postgres redis

echo "Waiting for Postgres/Redis..."
for i in $(seq 1 30); do
  if docker compose -f "$PROJECT_ROOT/infra/docker-compose.yml" exec -T postgres pg_isready -U admin >/dev/null 2>&1 \
    && docker compose -f "$PROJECT_ROOT/infra/docker-compose.yml" exec -T redis redis-cli ping >/dev/null 2>&1; then
    break
  fi
  sleep 2
  if [ "$i" -eq 30 ]; then
    docker compose -f "$PROJECT_ROOT/infra/docker-compose.yml" logs postgres redis
    exit 1
  fi
done

echo "Running migration/preflight init..."
docker run --rm \
  --network orchestra_default \
  -e POSTGRES_CONNECTION_STRING="${POSTGRES_CONNECTION_STRING:?POSTGRES_CONNECTION_STRING is required}" \
  -e DATABASE_URL="${DATABASE_URL:-$POSTGRES_CONNECTION_STRING}" \
  -e MIGRATION_DATABASE_NAME="${MIGRATION_DATABASE_NAME:-}" \
  -e AEGRA_CONFIG=/app/aegra.json \
  "$API_IMAGE" python -B scripts/migrate.py

echo "Starting API image..."
docker run -d --rm \
  --name orchestra_api_image_test \
  --network orchestra_default \
  -e POSTGRES_CONNECTION_STRING="${POSTGRES_CONNECTION_STRING}" \
  -e DATABASE_URL="${DATABASE_URL:-$POSTGRES_CONNECTION_STRING}" \
  -e AEGRA_CONFIG=/app/aegra.json \
  -e RUN_MIGRATIONS_ON_STARTUP=false \
  -e REDIS_URL=redis://redis:6379/0 \
  -p 8000:8000 \
  "$API_IMAGE"

for i in $(seq 1 30); do
  if curl -sf http://localhost:8000/health >/dev/null; then
    echo "Aegra health: PASS"
    curl -sf http://localhost:8000/api/info/health >/dev/null
    echo "Custom /api/info/health: PASS"
    exit 0
  fi
  sleep 2
done

docker logs orchestra_api_image_test
exit 1
