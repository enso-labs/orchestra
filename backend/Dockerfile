FROM python:3.12-slim

# Install curl, unzip (required for Deno install), then clean up
RUN apt-get update && apt-get install -y curl unzip && rm -rf /var/lib/apt/lists/*

# Install Deno
RUN curl -fsSL https://deno.land/install.sh | sh

# uv CLI
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DENO_INSTALL="/root/.deno"
ENV PATH="$DENO_INSTALL/bin:$PATH"
WORKDIR /app

# Copy only dep files first for better caching
COPY pyproject.toml uv.lock* /app/

# Use psycopg[binary] in pyproject (and remove psycopg2-binary)
# Then install deps
RUN uv sync --frozen --no-cache --no-dev

# App code
COPY . /app

CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]