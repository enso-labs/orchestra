# =============================================================================
# Orchestra Local — Lightweight multi-stage Docker image
# Build context: repo root
#
# Stage 1: Build frontend (Node)
# Stage 2: Backend runtime (Python 3.12 + uv)
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1 — Frontend build
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS frontend

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --ignore-scripts

COPY frontend/ ./
RUN npm run build
# Output: /app/backend/src/public (per vite.config.ts outDir)

# ---------------------------------------------------------------------------
# Stage 2 — Backend runtime
# ---------------------------------------------------------------------------
FROM python:3.12-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# System deps: curl (healthcheck), libpq-dev (psycopg), git (langchain deps)
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      curl \
      libpq-dev \
      git \
 && rm -rf /var/lib/apt/lists/*

# uv package manager
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app/backend

# Install Python deps (cached layer)
COPY backend/pyproject.toml backend/uv.lock* ./
RUN uv venv --python python3.12 \
 && uv sync --frozen --no-cache --no-dev --extra distributed

# Copy backend source
COPY backend/ ./

# Copy frontend static assets from stage 1
COPY --from=frontend /app/backend/src/public ./src/public

# Copy entrypoint
COPY docker/orchestra/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
