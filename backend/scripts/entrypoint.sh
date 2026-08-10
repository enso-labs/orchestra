#!/bin/sh
set -eu

# Aegra reads DATABASE_URL while Orchestra keeps POSTGRES_CONNECTION_STRING as
# its canonical setting. Deployments may provide both; this fallback preserves
# older env files without embedding a database name in the image.
if [ -z "${DATABASE_URL:-}" ]; then
    : "${POSTGRES_CONNECTION_STRING:?POSTGRES_CONNECTION_STRING is required}"
    export DATABASE_URL="$POSTGRES_CONNECTION_STRING"
fi

exec "$@"
