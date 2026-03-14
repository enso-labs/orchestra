#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Image Size Benchmark ==="

# Build both targets
docker build --target api -t orchestra-api:bench "$BACKEND_DIR"
docker build --target worker -t orchestra-worker:bench "$BACKEND_DIR"

# Report sizes
echo ""
echo "| Image | Size |"
echo "|-------|------|"
docker images orchestra-api:bench --format "| API | {{.Size}} |"
docker images orchestra-worker:bench --format "| Worker | {{.Size}} |"

# If baseline exists, compare
if docker images orchestra:baseline --format "{{.Size}}" 2>/dev/null | grep -q .; then
  docker images orchestra:baseline --format "| Baseline (before) | {{.Size}} |"
fi

echo ""
echo "=== Layer Analysis ==="
echo "--- API layers ---"
docker history orchestra-api:bench --format "{{.Size}}\t{{.CreatedBy}}" | head -10
echo ""
echo "--- Worker layers ---"
docker history orchestra-worker:bench --format "{{.Size}}\t{{.CreatedBy}}" | head -10
