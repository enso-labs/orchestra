# Docker Deployment Guide

This guide covers deploying the Orchestra backend using Docker.

## Prerequisites

-   [Docker](https://docs.docker.com/engine/install/) installed
-   [Docker Compose](https://docs.docker.com/compose/install/) installed
-   Access to AI provider API keys (OpenAI, Anthropic, etc.)

## Quick Start

### 1. Environment Setup

Create a `.env.docker` file in the `backend/` directory:

```bash
cd backend
cp .example.env .env.docker
```

Update the following values for Docker networking:

```bash
# Database - use container name instead of localhost
POSTGRES_CONNECTION_STRING="postgresql://admin:test1234@postgres:5432/orchestra?sslmode=disable"

# Tools - use container names for internal services
SEARX_SEARCH_HOST_URL="http://search_engine:8080"
SHELL_EXEC_SERVER_URL="http://exec_server:3005/exec"
```

### 2. Start Services

From the project root directory:

```bash
# Start database and backend
docker compose up postgres orchestra

# Or start all services
docker compose up
```

### 3. Verify Deployment

The API will be available at `http://localhost:8000`

-   API Docs: `http://localhost:8000/docs`
-   Health Check: `http://localhost:8000/health`

## Docker Compose Services

| Service         | Port      | Description                        |
| --------------- | --------- | ---------------------------------- |
| `orchestra`     | 8000      | Backend API                        |
| `postgres`      | 5432      | PostgreSQL with pgvector           |
| `pgadmin`       | 4040      | Database admin UI                  |
| `minio`         | 9000/9001 | S3-compatible file storage         |
| `search_engine` | 8080      | SearXNG search engine              |
| `exec_server`   | 3005      | Shell execution server             |
| `ollama`        | 11434     | Local LLM inference (requires GPU) |

## Docker Compose Example

```yaml
services:
    # PGVector
    postgres:
        image: pgvector/pgvector:pg16
        container_name: postgres
        environment:
            POSTGRES_USER: admin
            POSTGRES_PASSWORD: test1234
            POSTGRES_MULTIPLE_DATABASES: "orchestra"
        ports:
            - "5432:5432"
        volumes:
            - ./docker/postgres/data:/var/lib/postgresql/data
            - ./docker/postgres/init-db.sh:/docker-entrypoint-initdb.d/init-db.sh

    # Server
    orchestra:
        build:
            context: ./backend
            dockerfile: Dockerfile
        container_name: orchestra
        env_file:
            - ./backend/.env.docker
        ports:
            - "8000:8000"
        depends_on:
            - postgres

    # Search
    search_engine:
        image: searxng/searxng
        container_name: search_engine
        ports:
            - "8080:8080"
        volumes:
            - ./docker/searxng/settings.yml:/etc/searxng/settings.yml:ro
        environment:
            SEARXNG_SETTINGS_PATH: "/etc/searxng/settings.yml"
```

## Build Commands

### Build Image Locally

```bash
cd backend
docker build -t orchestra:local .
```

### Build with Docker Compose

```bash
docker compose build orchestra
```

## Environment Variables

### Application Config

| Variable         | Description                          | Default       |
| ---------------- | ------------------------------------ | ------------- |
| `APP_ENV`        | Environment (development/production) | `development` |
| `APP_LOG_LEVEL`  | Logging level                        | `DEBUG`       |
| `APP_SECRET_KEY` | Application secret key               | -             |
| `JWT_SECRET_KEY` | JWT signing key                      | -             |
| `USER_AGENT`     | User agent string for requests       | `enso-dev`    |
| `TEST_USER_ID`   | Test user UUID                       | -             |

### Database

| Variable                     | Description                  | Default |
| ---------------------------- | ---------------------------- | ------- |
| `POSTGRES_CONNECTION_STRING` | PostgreSQL connection string | -       |

### AI Providers (at least one required)

| Variable            | Description       | Default |
| ------------------- | ----------------- | ------- |
| `OPENAI_API_KEY`    | OpenAI API key    | -       |
| `GROQ_API_KEY`      | Groq API key      | -       |
| `ANTHROPIC_API_KEY` | Anthropic API key | -       |
| `XAI_API_KEY`       | xAI API key       | -       |
| `OLLAMA_BASE_URL`   | Ollama server URL | -       |

### Tool Config

| Variable                | Description              | Default                      |
| ----------------------- | ------------------------ | ---------------------------- |
| `SEARX_SEARCH_HOST_URL` | SearXNG search endpoint  | `http://localhost:8080`      |
| `SHELL_EXEC_SERVER_URL` | Shell execution endpoint | `http://localhost:3005/exec` |
| `TAVILY_API_KEY`        | Tavily search API key    | -                            |

### Services (Alpha)

| Variable                  | Description                 | Default |
| ------------------------- | --------------------------- | ------- |
| `PRESIDIO_ANALYZE_HOST`   | Presidio analyze endpoint   | -       |
| `PRESIDIO_ANONYMIZE_HOST` | Presidio anonymize endpoint | -       |
| `PRESIDIO_API_KEY`        | Presidio API key            | -       |

### Storage

| Variable            | Description       | Default    |
| ------------------- | ----------------- | ---------- |
| `MINIO_HOST`        | MinIO/S3 host URL | -          |
| `S3_REGION`         | S3 region         | -          |
| `ACCESS_KEY_ID`     | S3 access key     | -          |
| `ACCESS_SECRET_KEY` | S3 secret key     | -          |
| `BUCKET`            | S3 bucket name    | `enso_dev` |

## Database Migrations

Run migrations inside the container:

```bash
# Using docker compose exec
docker compose exec orchestra alembic upgrade head

# Or run migrations before starting
docker compose run --rm orchestra alembic upgrade head
```

## Production Considerations

### Security

-   Generate strong values for `APP_SECRET_KEY` and `JWT_SECRET_KEY`
-   Use SSL/TLS termination (nginx, traefik, etc.)
-   Restrict database access to internal networks
-   Never expose `.env` files

### Performance

-   Configure appropriate resource limits in `docker-compose.yml`
-   Use a reverse proxy for load balancing
-   Enable PostgreSQL connection pooling for high traffic

### Dockerfile Features

The Dockerfile uses a multi-stage build:

1. **Builder Stage**: Installs dependencies, compiles Python to bytecode (`.pyc`)
2. **Runtime Stage**: Ships only compiled bytecode for smaller image size

> **Note**: Migration files (`.py`) are preserved since Alembic requires source files.

## Troubleshooting

### Container won't start

```bash
# Check logs
docker compose logs orchestra

# Verify environment file exists
ls -la backend/.env.docker
```

### Database connection failed

```bash
# Ensure postgres is running
docker compose ps postgres

# Check postgres logs
docker compose logs postgres
```

### Port already in use

```bash
# Check what's using the port
lsof -i :8000

# Or change the port mapping in docker-compose.yml
ports:
  - "8001:8000"  # Map to different host port
```
