#!/bin/bash
set -euo pipefail

# ORCHESTRA_ENV_FILE/ENV_FILE are explicit overrides for the runtime file.
DEFAULT_ENV_FILE="${ORCHESTRA_ENV_FILE:-${ENV_FILE:-$HOME/.config/orchestra/.env.backend}}"
PRODUCTION_ENV_FILE="${ORCHESTRA_ENV_FILE:-${ENV_FILE:-$HOME/.config/orchestra/.env.production}}"

if [ "${answer:-}" = "yes" ]; then
    echo "Start Prod Env locally"
    ENV_FILE="$PRODUCTION_ENV_FILE"
elif [ "${answer:-}" = "no" ]; then
    ENV_FILE="$DEFAULT_ENV_FILE"
    echo "Starting Dev Server.."
else
    read -r -p "Connect to prod? (yes/no) " answer
    if [ "$answer" = "yes" ]; then
        ENV_FILE="$PRODUCTION_ENV_FILE"
    elif [ "$answer" = "no" ]; then
        ENV_FILE="$DEFAULT_ENV_FILE"
    else
        echo "Invalid input. Please enter 'yes' or 'no'." >&2
        exit 1
    fi
fi

# Export the selected environment without printing its contents.
set -a
source "$ENV_FILE"
set +a

if git log -n1 --pretty="format:%d" | grep -q 'tag:'; then
    API_VERSION=$(git log -n1 --pretty="format:%d" | sed "s/, /\n/g" | grep 'tag:' | sed 's/tag: \|)//g' | head -n1)
else
    API_VERSION=$(git rev-parse --short HEAD)
fi
export APP_VERSION="$API_VERSION"

export AEGRA_CONFIG="${AEGRA_CONFIG:-$(pwd)/aegra.json}"
export RUN_MIGRATIONS_ON_STARTUP=false
uv run --python 3.12 python scripts/migrate.py

exec uv run --python 3.12 uvicorn aegra_api.main:app \
    --log-level debug \
    --reload \
    --host 0.0.0.0 \
    --port "${PORT:-8000}"
