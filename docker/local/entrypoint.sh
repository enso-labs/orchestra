#!/usr/bin/env bash
# Orchestra Local VM Entrypoint
# Initializes PostgreSQL, Redis, runs migrations, and starts all services via supervisor.
set -e

ENV_FILE="/root/.env/orchestra/.env.backend.local"

# =============================================================================
# PostgreSQL Initialization
# =============================================================================
echo "[entrypoint] Initializing PostgreSQL..."

# Initialize PostgreSQL data directory if empty
if [ ! -f /var/lib/postgresql/16/main/PG_VERSION ]; then
    sudo -u postgres /usr/lib/postgresql/16/bin/initdb -D /var/lib/postgresql/16/main
fi

# Start PostgreSQL temporarily for setup
sudo -u postgres /usr/lib/postgresql/16/bin/pg_ctl \
    -D /var/lib/postgresql/16/main \
    -l /var/log/postgresql/startup.log \
    start -w

# Create database and enable pgvector
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = 'orchestra'" \
    | grep -q 1 \
    || sudo -u postgres createdb orchestra

sudo -u postgres psql -d orchestra -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null || true

# Allow local connections with password
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';" 2>/dev/null || true

# Ensure pg_hba.conf allows md5 auth for local TCP connections
PG_HBA="/etc/postgresql/16/main/pg_hba.conf"
if [ -f "$PG_HBA" ]; then
    # Replace peer/ident with md5 for local connections
    sed -i 's/local\s\+all\s\+all\s\+peer/local   all             all                                     md5/' "$PG_HBA"
    sed -i 's/host\s\+all\s\+all\s\+127.0.0.1\/32\s\+scram-sha-256/host    all             all             127.0.0.1\/32            md5/' "$PG_HBA"
    sed -i 's/host\s\+all\s\+all\s\+::1\/128\s\+scram-sha-256/host    all             all             ::1\/128                 md5/' "$PG_HBA"
    sudo -u postgres /usr/lib/postgresql/16/bin/pg_ctl -D /var/lib/postgresql/16/main reload
fi

# =============================================================================
# Run Database Migrations
# =============================================================================
echo "[entrypoint] Running database migrations..."
cd /app/backend

# Load env vars for migration
set -a
# shellcheck source=/dev/null
. "$ENV_FILE"
set +a

# Run Alembic migrations
/app/backend/.venv/bin/python -m alembic upgrade head 2>/dev/null || echo "[entrypoint] Migrations may need review"

# Seed default users
/app/backend/.venv/bin/python -m seeds.user_seeder --env-file "$ENV_FILE" 2>/dev/null || echo "[entrypoint] User seeding skipped"

# Stop temporary PostgreSQL (supervisor will manage it)
sudo -u postgres /usr/lib/postgresql/16/bin/pg_ctl \
    -D /var/lib/postgresql/16/main \
    stop -w

# =============================================================================
# Start All Services via Supervisor
# =============================================================================
echo "[entrypoint] Starting services..."
exec /usr/bin/supervisord -n -c /etc/supervisor/supervisord.conf
