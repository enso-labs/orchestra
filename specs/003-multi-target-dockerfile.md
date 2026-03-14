# Spec 003: Multi-Target Dockerfile

## Problem

A single `backend/Dockerfile` produces one image used for both API and Worker. The Worker image contains:
- Deno binary (~40-60MB) — unused by any Python code
- FastAPI + uvicorn + related packages (~15-25MB)
- mkdocs ecosystem (~30-50MB)
- Frontend static files in `src/public/` (~5-15MB)
- Route definitions the Worker never imports

## Changes

### Rewrite `backend/Dockerfile` as a multi-target build

```dockerfile
# =============================================================================
# Stage 1: Base builder — shared deps (langchain, DB, auth, redis, taskiq)
# =============================================================================
FROM python:3.12-slim-bookworm AS base-builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/
WORKDIR /app

# Copy only dep files first for caching
COPY pyproject.toml uv.lock* /app/

# Install core deps (no extras, no dev)
RUN python -m venv /app/.venv && \
    . /app/.venv/bin/activate && \
    uv sync --frozen --no-cache --no-dev

# =============================================================================
# Stage 2: API builder — adds api extra + frontend assets
# =============================================================================
FROM base-builder AS api-builder

# Install API-specific deps
RUN . /app/.venv/bin/activate && \
    uv sync --frozen --no-cache --no-dev --extra api

# Copy app code (includes src/public/ with frontend build)
COPY . /app

# Compile to bytecode + remove source
RUN python -m compileall -b -f -q /app && \
    find /app -type f -name "*.py" \
      ! -path "/app/migrations/*" \
      ! -path "/app/seeds/*" \
      -delete

# =============================================================================
# Stage 3: Worker builder — core deps only, no API files
# =============================================================================
FROM base-builder AS worker-builder

# Copy app code
COPY . /app

# Remove files the Worker never needs
RUN rm -rf /app/src/public /app/src/routes /app/main.py

# Compile to bytecode + remove source
RUN python -m compileall -b -f -q /app && \
    find /app -type f -name "*.py" \
      ! -path "/app/migrations/*" \
      ! -path "/app/seeds/*" \
      -delete

# =============================================================================
# Stage 4: API runtime
# =============================================================================
FROM python:3.12-slim-bookworm AS api

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/
COPY --from=api-builder /app /app

ENTRYPOINT ["python", "-B", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

# =============================================================================
# Stage 5: Worker runtime
# =============================================================================
FROM python:3.12-slim-bookworm AS worker

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/
COPY --from=worker-builder /app /app

ENTRYPOINT ["python", "-B", "-m", "taskiq", "worker", "src.workers.tasks:broker"]
```

### Key decisions

| Decision | Rationale |
|----------|-----------|
| **Deno removed entirely** | Zero references in Python source. Saves ~40-60MB per image. |
| **No `--squash` flag** | Multi-target builds share layer cache; `--squash` defeats this. Use BuildKit instead. |
| **Worker entrypoint uses `python -B -m taskiq`** | Avoids shipping `uv` in Worker runtime (saves ~25MB). API can do the same but kept for consistency with current behavior. |
| **`uv` kept in runtime** | Needed for `alembic upgrade head` on API startup and potential runtime tasks. Can be removed later. |
| **base-builder shared stage** | Docker caches this layer; both targets reuse it, speeding up builds. |

### Alternative: Keep single Dockerfile, use build ARG

If two targets add too much CI complexity, a simpler approach:
```dockerfile
ARG TARGET=api
# ... conditional logic based on $TARGET
```
This is less clean but requires fewer CI changes. **Not recommended** — multi-target is the Docker-native pattern.

## Files Modified

- `backend/Dockerfile` (rewritten)

## Estimated Total Savings

| Removed Component | Size |
|-------------------|------|
| Deno binary | ~40-60MB |
| mkdocs ecosystem (Spec 001) | ~30-50MB |
| FastAPI+deps (Worker only) | ~15-25MB |
| Frontend static (Worker only) | ~5-15MB |
| Routes bytecode (Worker only) | ~1MB |
| **Total Worker reduction** | **~90-150MB** |
| **Total API reduction** | **~70-110MB** |

## Verification

```bash
# Build both targets
docker build --target api -t orchestra-api:test backend/
docker build --target worker -t orchestra-worker:test backend/

# Compare sizes
docker images orchestra-api:test --format "{{.Size}}"
docker images orchestra-worker:test --format "{{.Size}}"

# Verify API starts
docker run --rm -e APP_ENV=development orchestra-api:test &
curl -f http://localhost:8000/api/info

# Verify Worker starts (needs Redis)
docker run --rm --network host -e REDIS_URL=redis://localhost:6379/0 orchestra-worker:test
```
