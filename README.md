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
| **Community (Free)** | Developers, self-hosting | `docker pull ghcr.io/ruska-ai/orchestra-api:latest` |
| **Managed Cloud** | Teams wanting convenience | [chat.ruska.ai](https://chat.ruska.ai) |
| **Enterprise** | Organizations needing SSO, compliance, SLA | [Contact Us](https://ruska.ai/enterprise) |

---

## 📖 Table of Contents

This project includes tools for running shell commands and Docker container operations. For detailed information, please refer to the following documentation:

-   [Documentation](./docs/README.md) — full user docs, also published at [docs.ruska.ai](https://docs.ruska.ai)
-   [Tools Documentation](./docs/tools/tools.md)
-   [Docker Deployment (GHCR / Docker Compose)](#-docker-deployment-ghcr--docker-compose)

## 🐳 Docker Deployment (GHCR)

We publish separate API and worker images to GitHub Container Registry (GHCR). For the full Docker/Docker Compose deployment guide (env setup, services, migrations, troubleshooting), jump to [Docker Deployment details](#-docker-deployment-ghcr--docker-compose).

```bash
docker pull ghcr.io/ruska-ai/orchestra-api:latest
docker pull ghcr.io/ruska-ai/orchestra-worker:latest
```

## 📋 Prerequisites

-   [Docker](https://docs.docker.com/engine/install/ubuntu/) Installed
-   Python 3.11 or higher
-   Access to OpenAI API (for GPT-4o model) or Anthropic API (for Claude 3.5 Sonnet)

## 🛠️ Development

### Quick Reference

| Command           | Description                      |
|-------------------|----------------------------------|
| `make dev`        | Start backend server (port 8000) |
| `make dev.worker` | Start TaskIQ worker              |
| `make test`       | Run all backend tests            |
| `make format`     | Format code with Ruff            |
| `make seeds.user` | Seed default users               |
| `make migrate.up` | Apply all pending migrations     |

For all commands, see `backend/Makefile`.

1. **Environment Variables:**

    Create a `.env` file in the root directory and add your API key(s):

    ```bash
    # Backend
    cd <project-root>/backend
    cp .example.env .env

    # Frontend
    cd <project-root>/frontend
    cp .example.env .env
    ```

    Ensure that your `.env` file is not tracked by git by checking the `.gitignore`:

2. **Start Docker Services**

    Below will start the database service.

    ```bash
    cd <project-root>
    docker compose -f infra/docker-compose.yml up postgres
    ```

### Dockerized Dev Stack

For containerized local development with hot reload, the whole stack (app, worker,
postgres, redis, minio, ollama, search_engine) runs from the single
`infra/docker-compose.yml`. The frontend runs on the host (`cd frontend && npm run dev`).

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
    uv venv
    source .venv/bin/activate
    uv sync
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

This project uses Alembic for database migrations. Here's how to work with migrations:

### Initial Setup

1. Create the database (if not exists):

    ```bash
    cd backend
    alembic upgrade head
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
| [Frontend Schedule Refactor](https://github.com/ruska-ai/orchestra/issues/722) | Scheduling | ✅ Shipped |

### January 2026

| Feature | Category | Status |
|---------|----------|--------|
| [Distributed Workers (TaskIQ)](https://github.com/ruska-ai/orchestra/issues/656) | Infra | ✅ Shipped |
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

This section covers the production registry deployment. For local development, use
`infra/docker-compose.yml`; it is intentionally separate from the production files.
The production files are self-contained under `deploy/` and never build images.

### 📋 VM prerequisites

Use a supported Linux VM with:

- [Docker Engine](https://docs.docker.com/engine/install/) and the Compose v2 plugin
- At least 2 vCPUs, 4 GB RAM, and persistent disk sized for Postgres, MinIO, and logs
- A firewall that permits SSH and your TLS reverse proxy, but not database, Redis,
  MinIO, SearXNG, or Ollama ports
- A DNS name and TLS termination in front of the API if it will be internet-facing

### 🔐 GHCR and environment setup

The images are private registry images in some deployments. Authenticate on the VM
with a GitHub token that has `read:packages` (do not put the token in a committed file):

```bash
export GHCR_USERNAME=your-github-user
read -rsp 'GHCR token: ' GHCR_TOKEN; echo
echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
unset GHCR_TOKEN
```

Create the ignored runtime env file from the tracked production template. Replace
all `replace-with-*` values, use URL-safe database credentials when the overlay will
construct a connection URL, and never commit the copied file:

```bash
cp deploy/.example.env deploy/orchestra.env
chmod 600 deploy/orchestra.env
# Edit deploy/orchestra.env with strong keys, service URLs, and at least one model provider key.
```

Generate signing keys, for example. `APP_SECRET_KEY` is a Fernet key, while
`JWT_SECRET_KEY` can be any long random signing value:

```bash
python3 -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'  # APP_SECRET_KEY
openssl rand -hex 32                                                                         # JWT_SECRET_KEY
```

### 🚀 Base-only deployment (external dependencies)

The base stack contains only the registry API and worker images. It does not start
Postgres, Redis, MinIO, SearXNG, or Ollama, so all dependency URLs can point to
managed or separately operated services. `ORCHESTRA_IMAGE_TAG` defaults to `latest` and the
API binds only to loopback; put a reverse proxy in front of it when remote access is
needed.

```bash
cd /path/to/orchestra
docker compose --env-file deploy/orchestra.env \
  -f deploy/docker-compose.yml up -d

docker compose --env-file deploy/orchestra.env \
  -f deploy/docker-compose.yml ps
curl --fail "http://$(docker compose --env-file deploy/orchestra.env \
  -f deploy/docker-compose.yml port api 8000)/api/info/health"
```

For a release tag, set `ORCHESTRA_IMAGE_TAG=your-tag` in the runtime environment.
Production startup runs migrations automatically. If you need a separate migration
step, use the entrypoint override below before routing traffic:

```bash
# Production startup runs Alembic automatically. To run it explicitly without
# starting the API entrypoint, override the image entrypoint:
docker compose --env-file deploy/orchestra.env \
  -f deploy/docker-compose.yml run --rm --no-deps --entrypoint python api \
  -m alembic upgrade head
```

### 🧩 Explicit database overlay

The database overlay is opt-in. It adds private-network-only Postgres with pgvector,
Redis, MinIO, and SearXNG, and overrides API/worker URLs and dependency ordering to
use the Compose service names. It also runs an idempotent MinIO bucket initializer.
It does not load merely because it is next to the base file; always pass both files explicitly:

```bash
mkdir -p deploy/searxng
cp deploy/searxng/settings.example.yml deploy/searxng/settings.yml
sed -i "s/REPLACE_WITH_A_RANDOM_SECRET/$(openssl rand -hex 32)/" \
  deploy/searxng/settings.yml
chmod 600 deploy/searxng/settings.yml

# Replace the overlay credentials in deploy/orchestra.env first. The template includes
# ORCHESTRA_POSTGRES_PASSWORD, ORCHESTRA_REDIS_PASSWORD,
# ORCHESTRA_MINIO_ROOT_USER, and ORCHESTRA_MINIO_ROOT_PASSWORD.
docker compose --env-file deploy/orchestra.env \
  -f deploy/docker-compose.yml -f deploy/docker-compose.database.yml up -d

# Production startup runs Alembic automatically. To run it explicitly:
docker compose --env-file deploy/orchestra.env \
  -f deploy/docker-compose.yml -f deploy/docker-compose.database.yml \
  run --rm --no-deps --entrypoint python api -m alembic upgrade head
```

Dependency ports are not published to the VM host. SearXNG has API and JSON enabled
but is reachable only by the API and worker on the private Compose network. The
tracked `settings.example.yml` is non-debug and contains no usable secret; generate
and keep the ignored `deploy/searxng/settings.yml` on the VM.

### 🦙 Optional Ollama profile

Ollama is in the database overlay but has its own `ollama` profile. Enabling the
database overlay alone does not require a GPU or download a model. To use local
inference, set `ORCHESTRA_OLLAMA_BASE_URL=http://ollama:11434` in
`deploy/orchestra.env`, then start the profile:

```bash
docker compose --env-file deploy/orchestra.env \
  -f deploy/docker-compose.yml -f deploy/docker-compose.database.yml \
  --profile ollama up -d

docker compose --env-file deploy/orchestra.env \
  -f deploy/docker-compose.yml -f deploy/docker-compose.database.yml \
  exec ollama ollama pull llama3.2
```

The profile uses the standard `ollama serve` command and persists models in the
`ollama_data` volume. Configure a suitable CPU/GPU VM separately; model downloads
are intentionally an explicit operator action. For production updates, set an
immutable `ORCHESTRA_IMAGE_TAG` and pull before recreating the API and worker:
`docker compose ... pull api worker` followed by `docker compose ... up -d --pull always`.

### ✅ Health checks and lifecycle

Inspect health and logs with the same file list used to start the stack:

```bash
docker compose --env-file deploy/orchestra.env \
  -f deploy/docker-compose.yml -f deploy/docker-compose.database.yml ps
docker compose --env-file deploy/orchestra.env \
  -f deploy/docker-compose.yml -f deploy/docker-compose.database.yml logs --tail=100 api worker
```

Use `docker compose stop` for a temporary pause and `docker compose start` to resume.
Use `docker compose down` to remove containers and the network while retaining named
volumes. Do not use `down -v` unless you intentionally want to destroy application
data. Back up Postgres (including pgvector data), MinIO buckets, and the runtime
SearXNG settings before VM replacement or any volume cleanup; test restores before
calling a backup usable.

### 🛠️ Custom image builds (development)

The production deployment consumes the tagged GHCR images and never builds on the VM.
For local development or a custom image, use the existing build script or Dockerfile:

```bash
bash backend/scripts/build.sh
# Or build a local API image directly:
cp infra/README.md backend/README.md
docker build -t orchestra:local -f infra/backend.Dockerfile backend
```

The Dockerized development stack remains `infra/docker-compose.yml`; it is separate
from the production files under `deploy/`.

### ⚙️ Environment reference

The tracked `deploy/.example.env` is the production-oriented starting point. The
[canonical environment-variable guide](./docs/environment-variables.md) remains the
source of truth for provider and application settings.

| Variable | Production role |
|----------|-----------------|
| `APP_ENV` | Set to `production` to run startup migrations |
| `APP_SECRET_KEY` | Fernet key for encrypted application values |
| `JWT_SECRET_KEY` | JWT signing key |
| `POSTGRES_CONNECTION_STRING` | External PostgreSQL URL in base-only mode |
| `REDIS_URL` | External Redis URL in base-only mode |
| `MINIO_HOST` / `ACCESS_KEY_ID` / `ACCESS_SECRET_KEY` / `BUCKET` | External S3-compatible storage in base-only mode |
| `SEARX_SEARCH_HOST_URL` | External SearXNG URL in base-only mode |
| `DISTRIBUTED_WORKERS` | Enabled by the production API/worker stack |
| `ORCHESTRA_*` | Credentials and service settings for the explicit dependency overlay |

### 🧰 Troubleshooting

```bash
# Inspect the production services and recent logs
docker compose --env-file deploy/orchestra.env \
  -f deploy/docker-compose.yml ps
docker compose --env-file deploy/orchestra.env \
  -f deploy/docker-compose.yml logs --tail=100 api worker

# Verify the loopback health endpoint
curl --fail "http://$(docker compose --env-file deploy/orchestra.env \
  -f deploy/docker-compose.yml port api 8000)/api/info/health"
```

For application configuration details, see the [environment-variable guide](./docs/environment-variables.md).
