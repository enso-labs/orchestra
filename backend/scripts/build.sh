#!/bin/bash

# Get the project root directory (one level up from backend)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"

SHORT_SHA=$(git rev-parse --short HEAD)

# Set TAG to first argument if provided, otherwise use SHORT_SHA
TAG=${1:-$SHORT_SHA}

########################################################################
## Container Registry
########################################################################
REGISTRY="ghcr.io"
REPOSITORY="ruska-ai"
IMAGE_NAME="orchestra"
FULL_IMAGE="$REGISTRY/$REPOSITORY/$IMAGE_NAME"

# Copy Docker README to backend for inclusion in image
cp "$PROJECT_ROOT/docker/README.md" "$BACKEND_DIR/README.md"
cp "$PROJECT_ROOT/LICENSE" "$BACKEND_DIR/LICENSE"

# Build the Docker image from backend directory
docker build --squash -t $FULL_IMAGE:$TAG "$BACKEND_DIR"
docker tag $FULL_IMAGE:$TAG $FULL_IMAGE:latest

########################################################################
## GitHub Container Registry
########################################################################
echo ""
echo "Do you want to push the image to GitHub Container Registry? (y/n)"
read -r response
if [[ $response =~ ^([yY][eE][sS]|[yY])$ ]]
then
  docker push $FULL_IMAGE:$TAG
  docker push $FULL_IMAGE:latest
fi
