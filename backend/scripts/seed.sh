#!/bin/bash

ENV_FILE="${ORCHESTRA_ENV_FILE:-${ENV_FILE:-$HOME/.config/orchestra/.env.backend}}"
set -a
source "$ENV_FILE"
set +a

python -m $1