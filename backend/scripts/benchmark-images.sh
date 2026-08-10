#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"

echo "=== Single Aegra API image size benchmark ==="
docker build --target api -t orchestra-api:bench -f "$PROJECT_ROOT/infra/backend.Dockerfile" "$BACKEND_DIR"

echo ""
echo "| Image | Size |"
echo "|-------|------|"
docker images orchestra-api:bench --format "| API | {{.Size}} |"

echo ""
echo "=== Layer Analysis ==="
docker history orchestra-api:bench --format "{{.Size}}\t{{.CreatedBy}}" | head -10
