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
