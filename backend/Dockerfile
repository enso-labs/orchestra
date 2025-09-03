FROM python:3.12-slim

# uv CLI
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app

# Copy only dep files first for better caching
COPY pyproject.toml uv.lock* /app/

# Use psycopg[binary] in pyproject (and remove psycopg2-binary)
# Then install deps
RUN uv sync --frozen --no-cache

# App code
COPY . /app

CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
