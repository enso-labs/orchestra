# =============================================================================
# Stage 1: Build - Install deps and compile .py to .pyc
# =============================================================================
FROM python:3.12-slim-bookworm AS builder

# Install curl and unzip (required for Deno install)
RUN apt-get update && apt-get install -y --no-install-recommends curl unzip && rm -rf /var/lib/apt/lists/*

# Install Deno to a shared location
ENV DENO_INSTALL="/opt/deno"
RUN mkdir -p $DENO_INSTALL/bin && \
    curl -fsSL https://deno.land/install.sh | DENO_INSTALL=$DENO_INSTALL sh

# uv CLI
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/

ENV PATH="$DENO_INSTALL/bin:$PATH"
WORKDIR /app

# Copy only dep files first for better caching
COPY pyproject.toml uv.lock* /app/

# Install deps into virtual environment
RUN python -m venv /app/.venv && \
    . /app/.venv/bin/activate && \
    uv sync --frozen --no-cache --no-dev

# Copy app code
COPY . /app

# Compile all .py files to .pyc (optimized bytecode)
RUN python -m compileall -b -f -q /app

# Remove all .py source files, keep only .pyc
# Exclude migrations/ directory - Alembic requires .py files
RUN find /app -type f -name "*.py" ! -path "/app/migrations/*" -delete

# =============================================================================
# Stage 2: Runtime - Ship only .pyc bytecode (distroless)
# =============================================================================
FROM python:3.12-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DENO_INSTALL="/opt/deno" \
    PATH="/opt/deno/bin:/app/.venv/bin:$PATH"

WORKDIR /app

# Copy Deno binary from builder
COPY --from=builder /opt/deno /opt/deno

# Copy uv CLI
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/

# Copy virtual environment and compiled bytecode from builder
COPY --from=builder /app /app

ENTRYPOINT ["python", "-B", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]