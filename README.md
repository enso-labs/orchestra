<div align="center">

<table align="center">
  <tr>
    <td style="padding: 0; vertical-align: middle;">
      <img
        src="https://avatars.githubusercontent.com/u/139279732?s=200&v=4"
        width="60"
        height="60"
        style="border-radius: 50%; display: block;"
        alt="Ruska Logo"
      />
    </td>
    <td style="padding: 0 0 0 2px; vertical-align: middle;">
      <span style="font-weight: 600; font-style: italic; font-size: 2.4rem; line-height: 1;">
        RCHESTRA
      </span>
    </td>
  </tr>
</table>


Steerable Harnesses for [DeepAgents](https://docs.langchain.com/oss/python/deepagents/overview)

<a href="https://discord.com/invite/QRfjg4YNzU"><img src="https://img.shields.io/badge/Join-Discord-purple"></a>
<a href="https://chat.ruska.ai/api"><img src="https://img.shields.io/badge/View-API Docs-blue"></a>
<a href="https://ruska.ai/socials"><img src="https://img.shields.io/badge/Follow-Social-black"></a>
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)
[![DCO](https://img.shields.io/badge/DCO-1.1-yellow)](DCO)

<!-- <img src="https://github.com/ryaneggz/static/blob/main/enso/landing-page-light.gif?raw=true"> -->

</div>

**Open-source AI agent orchestration platform** built on LangGraph and powered by the [MCP](https://github.com/modelcontextprotocol) & [A2A](https://github.com/google/A2A) protocols.

Self-host for free or let us deploy it for you. Your agents, your data, your infrastructure.

---

## 🚀 Deployment Options

| Option | Best For | Get Started |
|--------|----------|-------------|
| **Community (Free)** | Developers, self-hosting | `docker pull ghcr.io/ruska-ai/orchestra:latest` |
| **Managed Cloud** | Teams wanting convenience | [chat.ruska.ai](https://chat.ruska.ai) |
| **Enterprise** | Organizations needing SSO, compliance, SLA | [Contact Us](https://ruska.ai/enterprise) |

---

## 📖 Table of Contents

This project includes tools for running shell commands and Docker container operations. For detailed information, please refer to the following documentation:

-   [Documentation](./docs/README.md) — full user docs, also published at [docs.ruska.ai](https://docs.ruska.ai)
-   [Tools Documentation](./docs/tools/tools.md)
-   [Docker Deployment (GHCR / Docker Compose)](#-docker-deployment-ghcr--docker-compose)

## 🐳 Docker Deployment (GHCR)

We publish the backend image to GitHub Container Registry (GHCR). For the full Docker/Docker Compose deployment guide (env setup, services, migrations, troubleshooting), jump to [Docker Deployment details](#-docker-deployment-ghcr--docker-compose).

```bash
docker pull ghcr.io/ruska-ai/orchestra:latest
```

## 📋 Prerequisites

-   [Docker](https://docs.docker.com/engine/install/ubuntu/) Installed
-   Python 3.12 or higher
-   Access to OpenAI API (for GPT-4o model) or Anthropic API (for Claude 3.5 Sonnet)

## 🛠️ Development

### Quick Reference

| Command           | Description                      |
|-------------------|----------------------------------|
| `make dev`        | Start the Aegra API (port 8000)  |
| `make test`       | Run all backend tests            |
| `make format`     | Format code with Ruff            |
| `make seeds.user` | Seed default users               |
| `make migrate.up` | Run ordered migration preflight  |

For all commands, see `backend/Makefile`.

1. **Environment Variables:**

    Store backend secrets in `~/.config/orchestra/.env.backend` and frontend
    settings in the distinct `~/.config/orchestra/.env.frontend` file:

    ```bash
    mkdir -p ~/.config/orchestra

    # Backend runtime
    cd <project-root>/backend
    cp .example.env ~/.config/orchestra/.env.backend

    # Frontend
    cd <project-root>/frontend
    cp .example.env ~/.config/orchestra/.env.frontend
    ```

    Compose accepts `ORCHESTRA_ENV_FILE=/path/to/file` as an explicit backend
    env-file override; Make targets accept `ENV_FILE=/path/to/file`.

2. **Start Docker Services**

    Below will start the database service.

    ```bash
    cd <project-root>
    docker compose up postgres
    ```

### Dockerized Dev Stack

For containerized local development with hot reload, the whole stack (single Aegra
app, ordered migration init, postgres, redis, minio, ollama, search_engine) runs
from the single `infra/docker-compose.yml`. The frontend runs on the host
(`cd frontend && npm run dev`).

```bash
cd <project-root>
make dev.docker.up        # docker compose -f infra/docker-compose.yml up --build -d
```

Useful endpoints while debugging:

-   Backend API: `http://localhost:8000/docs`
-   Frontend (host): `http://localhost:5173`

Tail the main service logs in one stream:

```bash
make dev.docker.logs
```

3. **Setup Server Environment**

    ```bash
    cd <project-root>/backend
    make dev
    ```

    <details>
    <summary>Manual setup (if Makefile unavailable)</summary>

    Assumes you're using [astral uv](https://github.com/astral-sh/uv?tab=readme-ov-file#installation).

    ```bash
    cd <project-root>/backend
    uv venv --python 3.12
    source .venv/bin/activate
    uv sync --python 3.12
    bash scripts/dev.sh
    ```
    </details>

4. **Setup Client Environment**

    ```bash
    # Change Directory
    cd <project-root>/frontend

    # Install
    npm install

    # Run
    npm run dev
    ```

## Database Migrations

This project uses two explicit Alembic chains. The ordered migration init runs
Orchestra's `orchestra_alembic_version` chain first, then Aegra's
`alembic_version` chain, and finally verifies LangGraph tables/content before
Aegra starts. It does not create, restore, or rename databases.

### Initial Setup

1. Configure `POSTGRES_CONNECTION_STRING` and `DATABASE_URL` for the same
   existing database, then run:

    ```bash
    cd backend
    make migrate.up
    ```

    ```bash
    python -m seeds.user_seeder
    ```

2. Create new

    ```bash
    alembic revision -m "description_of_changes"
    ```

    ```bash
    ### Appliy Next
    alembic upgrade +1

    ### Speicif revision
    alembic upgrade <revis_id>

    ### Appliy Down
    alembic downgrade -1

    ### Appliy Down
    alembic downgrade <revis_id>

    ### History
    alembic history
    ```

### Run Playwright MCP Locally

1. Start Ngrok on port 8931

    ```bash
    ngrok http 8931
    ```

2. Run MCP server

    ```bash
    npx @playwright/mcp@latest \
    --port 8931 \
    --executable-path $HOME/.cache/ms-playwright/chromium-<version>/chrome-linux/chrome \
    --vision
    ```

## 🤝 Integrations

-   [Configuring gcalcli](https://github.com/insanum/gcalcli/blob/HEAD/docs/api-auth.md)
-   [Issues Logging into gcalcli](https://github.com/insanum/gcalcli/issues/808)

## 🗺️ Roadmap

Stay up to date on [Discord](https://discord.com/invite/QRfjg4YNzU). Full release history in [Changelog.md](./Changelog.md).

### March 2026

| Feature | Category | Status |
|---------|----------|--------|
| Human-In-The-Loop | Agent Control | 🔵 Planned |

### February 2026

| Feature | Category | Status |
|---------|----------|--------|
| [Search Threads](https://github.com/ruska-ai/orchestra/issues/801) | UX | ✅ Shipped |
| [Migrate Memories Seeder](https://github.com/ruska-ai/orchestra/issues/787) | Data | ✅ Shipped |
| [Docs Agent Guidance](https://github.com/ruska-ai/orchestra/issues/804) | Docs | 🟡 In Progress |
| [RLM Skill](https://github.com/ruska-ai/orchestra/issues/736) | Skills | ✅ Shipped |
| Deferred jobs and trajectory support | Runtime | Follow-up after Aegra cutover |

### January 2026

| Feature | Category | Status |
|---------|----------|--------|
| Single Aegra API runtime | Infra | ✅ Shipped |
| [Public Agents](https://github.com/ruska-ai/orchestra/issues/471) | Agents | ✅ Shipped |
| [File Tree Sidebar](https://github.com/ruska-ai/orchestra/issues/650) | UX | ✅ Shipped |
| [AWS Model Support](https://github.com/ruska-ai/orchestra/issues/666) | Integrations | ✅ Shipped |
| [Shareable Thread Links](https://github.com/ruska-ai/orchestra/issues/663) | UX | ✅ Shipped |
| [Subagent Tool Calls](https://github.com/ruska-ai/orchestra/issues/694) | UX | ✅ Shipped |
| [User Default Settings](https://github.com/ruska-ai/orchestra/issues/665) | Settings | ✅ Shipped |
| [Speech Dictation](https://github.com/ruska-ai/orchestra/issues/654) | UX | ✅ Shipped |

<details>
<summary>📦 Archive (Dec 2025 and earlier)</summary>

See [Changelog.md](./Changelog.md) for the full release history.

</details>

---

## 🏢 Enterprise

For organizations needing managed deployment, compliance, or dedicated support:

| Feature | Description |
|---------|-------------|
| **SSO/SAML** | Integrate with your identity provider |
| **Audit Logging** | Comprehensive logs for compliance |
| **Air-Gapped Deployment** | Run in isolated environments |
| **Priority Support** | SLA-backed response times |
| **Custom Integrations** | Connect to your internal tools |

We partner with you to deploy Orchestra inside your infrastructure. [Contact us](https://ruska.ai/enterprise) to discuss your requirements.

---

## 🐳 Docker Deployment (GHCR / Docker Compose)

This section covers deploying the Orchestra backend using Docker. For local development, see the sections above.

### 📋 Prerequisites

-   [Docker](https://docs.docker.com/engine/install/) installed
-   [Docker Compose](https://docs.docker.com/compose/install/) installed
-   Access to AI provider API keys (OpenAI, Anthropic, etc.)

### 🚀 Quick Start

#### Using Pre-built Image

Pull the latest image from GitHub Container Registry:

```bash
docker pull ghcr.io/ruska-ai/orchestra:latest
```

#### 1. Environment Setup

Create the backend runtime environment file at `~/.config/orchestra/.env.backend`:

```bash
cd backend
mkdir -p ~/.config/orchestra
cp .example.env ~/.config/orchestra/.env.backend
```

Use `ORCHESTRA_ENV_FILE=/path/to/file` to override the Compose default, or
`ENV_FILE=/path/to/file` with Make targets.

Update the following values for Docker networking:

```bash
# Database - provide both URLs for the same configured target
POSTGRES_CONNECTION_STRING="postgresql://admin:test1234@postgres:5432/<configured-db>?sslmode=disable"
DATABASE_URL="postgresql://admin:test1234@postgres:5432/<configured-db>?sslmode=disable"
MIGRATION_DATABASE_NAME=<configured-db>

# Tools - use container names for internal services
SEARX_SEARCH_HOST_URL="http://search_engine:8080"
```

#### 2. Start Services

From the project root directory:

```bash
# Start Postgres/Redis, the ordered migration init, and one Aegra API
docker compose -f infra/docker-compose.yml up --build postgres redis migrate app

# Or start all supporting services and the API
docker compose -f infra/docker-compose.yml up --build
```

#### 3. Verify Deployment

The single Aegra API will be available at `http://localhost:8000`; the migration init must complete before it starts.

-   API Docs: `http://localhost:8000/docs`
-   Health Check: `http://localhost:8000/health`

### 🧩 Docker Compose Services

| Service         | Port      | Description                        |
| --------------- | --------- | ---------------------------------- |
| `app`           | 8000      | Single Aegra API runtime           |
| `migrate`       | -         | Ordered migration/preflight init   |
| `postgres`      | 5432      | PostgreSQL with pgvector           |
| `minio`         | 9000/9001 | S3-compatible file storage         |
| `search_engine` | 8080      | SearXNG search engine              |
| `ollama`        | 11434     | Local LLM inference (requires GPU) |
| `redis`         | 6379      | Aegra event broker                 |

### 🧱 Docker Compose Example

```yaml
services:
    # PGVector
    postgres:
        image: pgvector/pgvector:pg16
        container_name: postgres
        environment:
            POSTGRES_USER: admin
            POSTGRES_PASSWORD: test1234
            POSTGRES_DB: postgres
        ports:
            - "5432:5432"

    # Server (use pre-built image or build locally)
    migrate:
        image: ghcr.io/ruska-ai/orchestra:latest
        env_file: ${ORCHESTRA_ENV_FILE:-~/.config/orchestra/.env.backend}
        command: ["python", "-B", "scripts/migrate.py"]
        depends_on:
            - postgres

    app:
        image: ghcr.io/ruska-ai/orchestra:latest
        container_name: orchestra
        env_file: ${ORCHESTRA_ENV_FILE:-~/.config/orchestra/.env.backend}
        ports:
            - "8000:8000"
        depends_on:
            migrate:
                condition: service_completed_successfully
```

### 🏗️ Build Commands

#### Build with Script (Recommended)

The build script copies the Docker deployment README into the image and handles tagging:

```bash
# From project root
bash backend/scripts/build.sh

# Or with custom tag
bash backend/scripts/build.sh v1.0.0
```

#### Build with Docker Compose

```bash
docker compose -f infra/docker-compose.yml build app
```

#### Manual Build

```bash
# Copy README first, then build (Dockerfile lives in infra/)
cp infra/README.md backend/README.md
docker build -t orchestra:local -f infra/backend.Dockerfile backend
```

### ⚙️ Environment Variables

#### Application Config

| Variable         | Description                          | Default       |
| ---------------- | ------------------------------------ | ------------- |
| `APP_ENV`        | Environment (development/production) | `development` |
| `APP_LOG_LEVEL`  | Logging level                        | `DEBUG`       |
| `APP_SECRET_KEY` | Application secret key               | -             |
| `JWT_SECRET_KEY` | JWT signing key                      | -             |
| `USER_AGENT`     | User agent string for requests       | `ruska-dev`    |
| `TEST_USER_ID`   | Test user UUID                       | -             |

#### Database

| Variable                     | Description                  | Default |
| ---------------------------- | ---------------------------- | ------- |
| `POSTGRES_CONNECTION_STRING` | Orchestra PostgreSQL connection string | -       |
| `DATABASE_URL`               | Aegra PostgreSQL connection string     | same target as above |
| `MIGRATION_DATABASE_NAME`    | Optional expected database name for preflight | - |

#### AI Providers (at least one required)

| Variable            | Description       | Default |
| ------------------- | ----------------- | ------- |
| `OPENAI_API_KEY`    | OpenAI API key    | -       |
| `GROQ_API_KEY`      | Groq API key      | -       |
| `ANTHROPIC_API_KEY` | Anthropic API key | -       |
| `XAI_API_KEY`       | xAI API key       | -       |
| `OLLAMA_BASE_URL`   | Ollama server URL | -       |

#### Tool Config

| Variable                | Description              | Default                      |
| ----------------------- | ------------------------ | ---------------------------- |
| `SEARX_SEARCH_HOST_URL` | SearXNG search endpoint  | `http://localhost:8080`      |
| `TAVILY_API_KEY`        | Tavily search API key    | -                            |

#### Aegra Runtime

| Variable               | Description                          | Default |
| ---------------------- | ------------------------------------ | ------- |
| `REDIS_URL`            | Aegra event broker connection        | -       |
| `REDIS_BROKER_ENABLED` | Enable Aegra's Redis event broker    | `true`  |
| `AEGRA_CONFIG`         | Image-relative Aegra config path     | `/app/aegra.json` |
| `RUN_MIGRATIONS_ON_STARTUP` | Disabled; init runs migrations | `false` |

#### Storage

| Variable            | Description       | Default    |
| ------------------- | ----------------- | ---------- |
| `MINIO_HOST`        | MinIO/S3 host URL | -          |
| `S3_REGION`         | S3 region         | -          |
| `ACCESS_KEY_ID`     | S3 access key     | -          |
| `ACCESS_SECRET_KEY` | S3 secret key     | -          |
| `BUCKET`            | S3 bucket name    | `enso_dev` |

### 🗄️ Database Migrations

The one-shot `migrate` service runs Orchestra's `orchestra_alembic_version`
chain first, then Aegra's `alembic_version` chain, initializes LangGraph
checkpoint/store tables, verifies the configured database identity, and checks
pre-existing content digests before the API starts:

```bash
make dev.docker.migrate
# or, with an already configured shell:
docker compose -f infra/docker-compose.yml run --rm migrate
```

Set `DATABASE_URL` and (optionally) `MIGRATION_DATABASE_NAME` to the same target
as `POSTGRES_CONNECTION_STRING`. The init step never creates, restores, or
renames databases; those operator-only actions are documented in
`.oh/tasks/aegra-full-inversion/runbook-us003.md`.

### 🚢 Production Considerations

#### Security

-   Generate strong values for `APP_SECRET_KEY` and `JWT_SECRET_KEY`
-   Use SSL/TLS termination (nginx, traefik, etc.)
-   Restrict database access to internal networks
-   Never expose `.env` files

#### Performance

-   Configure appropriate resource limits in `docker-compose.yml`
-   Use a reverse proxy for load balancing
-   Enable PostgreSQL connection pooling for high traffic

#### Dockerfile Features

The Dockerfile uses a multi-stage build:

1. **Builder Stage**: Installs the pinned backend/Aegra dependencies.
2. **Runtime Stage**: Ships the source modules, migration hooks, config, and
   built `src/public` assets required by Aegra's source-path loaders.

> **Note**: Python source is intentionally retained: Aegra resolves the graph,
> auth, and custom-app paths from `/app/aegra.json` at startup.

### 🧰 Troubleshooting

#### Container won't start

```bash
# Check logs
docker compose -f infra/docker-compose.yml logs app

# Verify environment file exists
ls -la ~/.config/orchestra/.env.backend
```

#### Database connection failed

```bash
# Ensure postgres is running
docker compose ps postgres

# Check postgres logs
docker compose logs postgres
```

#### Port already in use

```bash
# Check what's using the port
lsof -i :8000

# Or change the port mapping in docker-compose.yml
ports:
  - "8001:8000"  # Map to different host port
```
