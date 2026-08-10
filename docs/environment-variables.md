# Environment variables

This is the canonical environment-variable reference for the single Aegra API runtime. The tracked template is [`backend/.example.env`](../backend/.example.env).

Copy the template to the operator-local backend file; never commit the copy:

```bash
mkdir -p ~/.config/orchestra
cp backend/.example.env ~/.config/orchestra/.env.backend
```

The frontend uses the distinct `~/.config/orchestra/.env.frontend` file. Set `ORCHESTRA_ENV_FILE` or `ENV_FILE` only when an explicit override is required.

## Required configuration

| Variable | Purpose |
|---|---|
| `APP_ENV` | Runtime environment, normally `development` locally or `production` in deployment. |
| `APP_SECRET_KEY` | Fernet key used for encrypted application settings. |
| `JWT_SECRET_KEY` | Signing key used for authentication tokens. |
| `POSTGRES_CONNECTION_STRING` | Orchestra database URL. |
| `DATABASE_URL` | Aegra/LangGraph database URL; it must resolve to the same existing database. |
| `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` | At least one provider credential for agent execution. |

Generate real signing keys with a local secret manager or an equivalent secure command. Do not place credentials in this repository.

## Runtime and service configuration

| Variable | Purpose |
|---|---|
| `MIGRATION_DATABASE_NAME` | Optional fail-closed database identity check. |
| `AEGRA_CONFIG` | Aegra config path; the image default is `/app/aegra.json`. |
| `RUN_MIGRATIONS_ON_STARTUP` | Keep `false`; the ordered migration init runs before the API. |
| `REDIS_URL` | Redis URL for Aegra events and application cache. |
| `SEARX_SEARCH_HOST_URL` | Search service URL. |
| `SHELL_EXEC_SERVER_URL` | Shell-execution service URL. |
| `MINIO_HOST`, `S3_REGION`, `ACCESS_KEY_ID`, `ACCESS_SECRET_KEY`, `BUCKET` | Optional object-storage settings. |

Compose rewrites service hostnames for its network. Host-run development normally uses `localhost`; containerized deployment uses the service names in `infra/docker-compose.yml`.

## Optional providers

The template contains optional provider and integration variables such as `GROQ_API_KEY`, `XAI_API_KEY`, `TAVILY_API_KEY`, `EXA_API_KEY`, `OLLAMA_BASE_URL`, and Bedrock settings. Leave them empty unless the corresponding integration is enabled.

## Secret handling

Keep real values under `~/.config/orchestra/` or a deployment secret store. Never commit `.env` files, provider keys, database passwords, storage credentials, or application signing keys.
