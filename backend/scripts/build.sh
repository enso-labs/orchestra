#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
SHORT_SHA="$(git -C "$PROJECT_ROOT" rev-parse --short HEAD)"
TAG=${1:-$SHORT_SHA}

REGISTRY="ghcr.io"
REPOSITORY="ruska-ai"
IMAGE_NAME="orchestra"
FULL_IMAGE="$REGISTRY/$REPOSITORY/$IMAGE_NAME"

# The frontend build is expected to have populated backend/src/public before
# this command, just as the tagged CI build does.
cp "$PROJECT_ROOT/infra/README.md" "$BACKEND_DIR/README.md"
cp "$PROJECT_ROOT/LICENSE" "$BACKEND_DIR/LICENSE"

docker build --target api \
  -f "$PROJECT_ROOT/infra/backend.Dockerfile" \
  -t "$FULL_IMAGE-api:$TAG" \
  -t "$FULL_IMAGE-api:latest" \
  -t "$FULL_IMAGE:$TAG" \
  -t "$FULL_IMAGE:latest" \
  "$BACKEND_DIR"

echo ""
echo "=== Built single Aegra API image ==="
docker images "$FULL_IMAGE" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | head -5

echo ""
echo "Do you want to push the image to GitHub Container Registry? (y/n)"
read -r response
if [[ $response =~ ^([yY][eE][sS]|[yY])$ ]]; then
  docker push "$FULL_IMAGE-api:$TAG"
  docker push "$FULL_IMAGE-api:latest"
  docker push "$FULL_IMAGE:$TAG"
  docker push "$FULL_IMAGE:latest"
fi
