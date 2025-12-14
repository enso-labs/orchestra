# =============================================================================
# Stage 1: Build - Install deps and compile .py to .pyc
# =============================================================================
FROM python:3.12-slim AS builder

# Install curl, unzip (required for Deno install)
RUN apt-get update && apt-get install -y curl unzip && rm -rf /var/lib/apt/lists/*

# Install Deno
RUN curl -fsSL https://deno.land/install.sh | sh

# uv CLI
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV DENO_INSTALL="/root/.deno"
ENV PATH="$DENO_INSTALL/bin:$PATH"
WORKDIR /app

# Copy only dep files first for better caching
COPY pyproject.toml uv.lock* /app/

# Install deps
RUN uv sync --frozen --no-cache --no-dev

# Copy app code
COPY . /app

# Compile all .py files to .pyc (optimized bytecode)
RUN python -m compileall -b -f -q /app

# Remove all .py source files, keep only .pyc
# Exclude migrations/ directory - Alembic requires .py files
RUN find /app -type f -name "*.py" ! -path "/app/migrations/*" -delete

# =============================================================================
# Stage 2: Runtime - Ship only .pyc bytecode
# =============================================================================
FROM python:3.12-slim

# Install curl, unzip (required for Deno install), then clean up
RUN apt-get update && apt-get install -y curl unzip && rm -rf /var/lib/apt/lists/*

# Install Deno
RUN curl -fsSL https://deno.land/install.sh | sh

# uv CLI
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV PYTHONUNBUFFERED=1 \
    DENO_INSTALL="/root/.deno"
ENV PATH="$DENO_INSTALL/bin:$PATH"
WORKDIR /app

# Copy compiled bytecode and installed deps from builder
COPY --from=builder /app /app

CMD ["uv", "run", "python", "-B", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]