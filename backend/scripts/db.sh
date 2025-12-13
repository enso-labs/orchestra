#!/bin/bash
set -euo pipefail

# Usage: ./db.sh [env_file]
ENV_FILE="${1:-.env.prod}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Env file '$ENV_FILE' not found."
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

PG_CONNECTION_STRING="${POSTGRES_CONNECTION_STRING:?POSTGRES_CONNECTION_STRING environment variable not set}"

# Supabase typically requires SSL. Ensure sslmode=require exists.
if [[ "$PG_CONNECTION_STRING" != *"sslmode="* ]]; then
  if [[ "$PG_CONNECTION_STRING" == *"?"* ]]; then
    PG_CONNECTION_STRING="${PG_CONNECTION_STRING}&sslmode=require"
  else
    PG_CONNECTION_STRING="${PG_CONNECTION_STRING}?sslmode=require"
  fi
fi

echo "Connecting to Supabase Postgres..."

BACKUP_DIR=".backups"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/db_backup_$(date +%Y%m%d_%H%M%S).dump.gz"

# Run pg_dump inside a disposable Postgres container
docker run --rm -i postgres:16-alpine \
  pg_dump -Fc "$PG_CONNECTION_STRING" \
  | gzip -9 > "$BACKUP_FILE"

echo "Backup saved to $BACKUP_FILE"
