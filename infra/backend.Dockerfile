# Single production image: Aegra owns the API process and Orchestra's
# migration init command runs from this same image before the API starts.
FROM python:3.12-slim-bookworm AS base-builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/
WORKDIR /app

# Keep dependency installation cacheable and use the backend lockfile as the
# only source of truth for Aegra and Orchestra runtime dependencies.
COPY pyproject.toml uv.lock /app/
RUN python -m venv /app/.venv && \
    . /app/.venv/bin/activate && \
    uv sync --frozen --no-cache --no-dev --no-install-project

FROM base-builder AS api-builder

# The frontend CI build writes src/public/ into this backend build context.
# Copy all Python source rather than deleting modules after bytecode compilation:
# Aegra resolves aegra.json, custom_app.py, aegra_auth.py, and the graph factory
# by source path at runtime.
COPY . /app
RUN test -f /app/aegra.json && \
    test -f /app/custom_app.py && \
    test -f /app/aegra_auth.py && \
    test -f /app/src/agents/factory.py && \
    test -f /app/scripts/migrate.py

FROM python:3.12-slim-bookworm AS api

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH" \
    AEGRA_CONFIG=/app/aegra.json \
    RUN_MIGRATIONS_ON_STARTUP=false

WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/
COPY --from=api-builder /app /app

# The entrypoint only derives Aegra's DATABASE_URL from the existing
# POSTGRES_CONNECTION_STRING when an operator has not supplied both. It does
# not create databases or perform any migration itself.
ENTRYPOINT ["/app/scripts/entrypoint.sh"]
CMD ["python", "-B", "-m", "uvicorn", "aegra_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
