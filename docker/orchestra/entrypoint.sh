#!/usr/bin/env bash
# Orchestra Local — Lightweight entrypoint
# Expects Postgres to be available as an external service.
set -e

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"
LOG_LEVEL="${LOG_LEVEL:-info}"
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"

# -----------------------------------------------------------------------------
# Wait for Postgres
# -----------------------------------------------------------------------------
echo "[entrypoint] Waiting for Postgres at ${POSTGRES_HOST}:${POSTGRES_PORT}..."
until bash -c "echo > /dev/tcp/${POSTGRES_HOST}/${POSTGRES_PORT}" 2>/dev/null; do
    sleep 1
done
echo "[entrypoint] Postgres is ready."

# -----------------------------------------------------------------------------
# Optional: Run database migrations
# -----------------------------------------------------------------------------
if [ "${RUN_MIGRATIONS}" = "true" ]; then
    echo "[entrypoint] Running database migrations..."
    /app/backend/.venv/bin/python -m alembic upgrade head
    echo "[entrypoint] Migrations complete."
fi

# -----------------------------------------------------------------------------
# Optional: Seed default users
# -----------------------------------------------------------------------------
if [ "${SEED_USERS}" = "true" ]; then
    echo "[entrypoint] Seeding default users..."
    /app/backend/.venv/bin/python -m seeds.user_seeder \
        || echo "[entrypoint] User seeding skipped or already seeded."
fi

# -----------------------------------------------------------------------------
# Start uvicorn
# -----------------------------------------------------------------------------
echo "[entrypoint] Starting uvicorn on ${HOST}:${PORT} (log-level: ${LOG_LEVEL})..."
exec /app/backend/.venv/bin/python -m uvicorn main:app \
    --host "${HOST}" \
    --port "${PORT}" \
    --log-level "${LOG_LEVEL}"
