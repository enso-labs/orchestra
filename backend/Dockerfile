# =============================================================================
# Stage 1: Build - Install deps and compile .py to .pyc
# =============================================================================
FROM cgr.dev/chainguard/wolfi-base AS builder

ARG PYTHON_VERSION=3.12

ENV LANG=C.UTF-8 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# Install Python, pip, and build essentials
RUN apk update && apk add --no-cache \
    python-${PYTHON_VERSION} \
    py${PYTHON_VERSION}-pip \
    curl \
    unzip

# Install Deno (required by langchain-sandbox)
ENV DENO_INSTALL="/opt/deno"
RUN mkdir -p $DENO_INSTALL/bin && \
    curl -fsSL https://deno.land/install.sh | DENO_INSTALL=$DENO_INSTALL sh

# Copy uv CLI
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/

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
# Stage 2: Runtime - Minimal distroless Python image
# =============================================================================
FROM cgr.dev/chainguard/python:latest

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DENO_INSTALL="/opt/deno" \
    PATH="/opt/deno/bin:/app/.venv/bin:$PATH"

WORKDIR /app

# Copy Deno binary from builder
COPY --from=builder /opt/deno /opt/deno

# Copy virtual environment and compiled bytecode from builder
COPY --from=builder /app /app

ENTRYPOINT ["python", "-B", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
