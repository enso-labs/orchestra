# Spec 004: CI/CD Updates

## Problem

The current CI/CD pipeline builds and deploys a single Docker image for both API and Worker. After splitting into multi-target builds, the pipeline must build, push, and deploy two separate images.

## Changes

### 1. Update `.github/workflows/build.yml` — Build Job

Replace the single `docker build` with two target builds:

```yaml
- name: Build and push API image
  working-directory: ./backend
  run: |
    TAG=${GITHUB_REF#refs/tags/}
    docker build --target api \
      -t ghcr.io/ruska-ai/orchestra-api:$TAG \
      -t ghcr.io/ruska-ai/orchestra-api:latest \
      -t ghcr.io/ruska-ai/orchestra:$TAG \
      -t ghcr.io/ruska-ai/orchestra:latest \
      .
    docker push ghcr.io/ruska-ai/orchestra-api:$TAG
    docker push ghcr.io/ruska-ai/orchestra-api:latest
    docker push ghcr.io/ruska-ai/orchestra:$TAG
    docker push ghcr.io/ruska-ai/orchestra:latest

- name: Build and push Worker image
  working-directory: ./backend
  run: |
    TAG=${GITHUB_REF#refs/tags/}
    docker build --target worker \
      -t ghcr.io/ruska-ai/orchestra-worker:$TAG \
      -t ghcr.io/ruska-ai/orchestra-worker:latest \
      .
    docker push ghcr.io/ruska-ai/orchestra-worker:$TAG
    docker push ghcr.io/ruska-ai/orchestra-worker:latest
```

**Backward compatibility**: `ghcr.io/ruska-ai/orchestra:$TAG` is kept as an alias for the API image. Existing deployments that pull `orchestra:latest` will get the API image with the same entrypoint as before.

### 2. Update `.github/workflows/build.yml` — Deploy Job

Update the SSH deployment script:

```bash
# Pull both images
docker pull $GHCR_IMAGE-api:$TAG
docker pull $GHCR_IMAGE-worker:$TAG

# API deployment (same blue-green pattern, use -api image)
docker run -d \
  --name graphchat_new \
  --network graphchat_default \
  --env-file ./backend/.env \
  -p 8006:8000 \
  $GHCR_IMAGE-api:$TAG

# ... health check, swap, promote ...

docker run -d \
  --name graphchat \
  --network graphchat_default \
  --restart always \
  --env-file ./backend/.env \
  -e APP_VERSION=$TAG \
  -p 8005:8000 \
  $GHCR_IMAGE-api:$TAG

# Worker deployment (use -worker image, no --entrypoint override needed)
docker run -d \
  --name graphchat_worker \
  --network graphchat_default \
  --restart always \
  --env-file ./backend/.env \
  -e DISTRIBUTED_WORKERS=true \
  -e REDIS_URL=redis://redis7:6379/0 \
  -e DB_POOL_MIN_SIZE=1 \
  -e DB_POOL_MAX_SIZE=5 \
  --memory=1g \
  --cpus=1 \
  $GHCR_IMAGE-worker:$TAG
```

**Key change**: Worker no longer needs `--entrypoint uv ... run taskiq worker` — the entrypoint is baked into the Worker image.

### 3. Update `backend/scripts/build.sh`

```bash
# Build both targets
docker build --target api -t $FULL_IMAGE-api:$TAG -t $FULL_IMAGE-api:latest "$BACKEND_DIR"
docker build --target worker -t $FULL_IMAGE-worker:$TAG -t $FULL_IMAGE-worker:latest "$BACKEND_DIR"

# Backward compat alias
docker tag $FULL_IMAGE-api:$TAG $FULL_IMAGE:$TAG
docker tag $FULL_IMAGE-api:latest $FULL_IMAGE:latest
```

### 4. Update `docker-compose.yml` (production standalone)

```yaml
services:
  backend:
    build:
      context: ./backend
      target: api
    # ...

  worker:
    build:
      context: ./backend
      target: worker
    # ... (remove entrypoint override)
```

### 5. No changes to dev compose

`docker-compose.dev.yml` uses `Dockerfile.dev` with volume mounts — unaffected by this change.

## Files Modified

- `.github/workflows/build.yml`
- `backend/scripts/build.sh`
- `docker-compose.yml`

## Verification

```bash
# Local: build both targets
bash backend/scripts/build.sh test

# Verify images exist
docker images | grep orchestra

# Test deploy script locally (dry run)
docker compose -f docker-compose.yml up -d
docker compose -f docker-compose.yml ps
docker compose -f docker-compose.yml down
```
