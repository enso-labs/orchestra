#!/bin/bash

# Check Docker version
DOCKER_VERSION=$(docker --version | grep -oP '\d+\.\d+\.\d+')

# Determine if the `docker compose` command is available
if docker compose version &>/dev/null; then
    COMPOSE_COMMAND="docker compose"
else
    # Fall back to legacy `docker-compose`
    if command -v docker-compose &>/dev/null; then
        COMPOSE_COMMAND="docker-compose"
    else
        echo "Neither docker compose nor docker-compose is available. Please install Docker Compose."
        exit 1
    fi
fi

# Run the command
$COMPOSE_COMMAND up postgres --remove-orphans --build -d
