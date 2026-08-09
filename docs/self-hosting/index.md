---
title: Self-Hosting Guide
sidebar_position: 3
---

# Self-Hosting Orchestra

This guide covers environment configuration for self-hosting Orchestra with various AI providers.

## Prerequisites

For a VM deployment, use Linux with Docker Engine and the Compose v2 plugin, at least
2 vCPUs and 4 GB RAM, persistent disk for Postgres and MinIO, SSH access, and a DNS
name with TLS termination. Keep database, Redis, MinIO, SearXNG, and Ollama ports on
the private Docker network; publish only the loopback-bound API or a reverse proxy.

## Production Docker deployment

The registry-only base stack is `deploy/docker-compose.yml`. It runs only the GHCR
API and worker images and expects externally managed dependency URLs. Set
`ORCHESTRA_IMAGE_TAG` to deploy a release tag; it defaults to `latest`. Authenticate
to GHCR with a token that has `read:packages` before pulling private images:

```bash
export GHCR_USERNAME=your-github-user
read -rsp 'GHCR token: ' GHCR_TOKEN; echo
echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
unset GHCR_TOKEN
```

Create the ignored runtime file from the tracked production template. Replace all
`replace-with-*` values, use URL-safe database credentials when the overlay will
construct a connection URL, and never commit the copied file or provider credentials.

```bash
cp deploy/.example.env deploy/orchestra.env
chmod 600 deploy/orchestra.env
# Edit it with strong signing keys, service URLs, and at least one provider key, then:
# APP_SECRET_KEY: python3 -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'
# JWT_SECRET_KEY: openssl rand -hex 32
docker compose --env-file deploy/orchestra.env \
  -f deploy/docker-compose.yml up -d
curl --fail "http://$(docker compose --env-file deploy/orchestra.env \
  -f deploy/docker-compose.yml port api 8000)/api/info/health"
```

The database stack is an explicit overlay, never an implicit `COMPOSE_FILE`:

```bash
mkdir -p deploy/searxng
cp deploy/searxng/settings.example.yml deploy/searxng/settings.yml
sed -i "s/REPLACE_WITH_A_RANDOM_SECRET/$(openssl rand -hex 32)/" \
  deploy/searxng/settings.yml
chmod 600 deploy/searxng/settings.yml

# Replace the overlay credentials from deploy/.example.env in deploy/orchestra.env.
# The overlay constructs its internal URLs from those ORCHESTRA_* values.
docker compose --env-file deploy/orchestra.env \
  -f deploy/docker-compose.yml -f deploy/docker-compose.database.yml up -d
```

The overlay provides private Postgres with pgvector, Redis, MinIO, and SearXNG with
persistent named volumes, healthchecks, credentials from environment variables, and
service-name URLs for API/worker dependencies. An idempotent MinIO initializer creates
the configured bucket. The tracked SearXNG example enables API/JSON and disables
debug; the generated `deploy/searxng/settings.yml` is ignored. Production startup
runs migrations automatically; to run them explicitly without the API entrypoint:

```bash
docker compose --env-file deploy/orchestra.env \
  -f deploy/docker-compose.yml -f deploy/docker-compose.database.yml \
  run --rm --no-deps --entrypoint python api -m alembic upgrade head
```

Ollama is separately gated behind the `ollama` profile, so enabling the database
overlay does not require GPU support or model downloads. To use local inference, set
`ORCHESTRA_OLLAMA_BASE_URL=http://ollama:11434` in `deploy/orchestra.env`, then start
standard `ollama serve` with its persistent volume:

```bash
docker compose --env-file deploy/orchestra.env \
  -f deploy/docker-compose.yml -f deploy/docker-compose.database.yml \
  --profile ollama up -d
# Pull models explicitly when desired:
docker compose --env-file deploy/orchestra.env \
  -f deploy/docker-compose.yml -f deploy/docker-compose.database.yml \
  exec ollama ollama pull llama3.2
```

For production updates, set an immutable `ORCHESTRA_IMAGE_TAG`, run
`docker compose ... pull api worker`, then recreate with `docker compose ... up -d --pull always`.
Check service health and logs with `docker compose ... ps` and `docker compose ...
logs`. Use `stop`/`start` for pauses and `down` to remove containers while retaining
named volumes. Avoid `down -v` unless destroying data. Back up and test restores for
Postgres, MinIO, and runtime settings before VM replacement or volume cleanup.

## Environment Configuration

Orchestra uses environment variables to configure AI providers. For general
application development, copy the tracked template to a user-local ignored file:

```bash
mkdir -p ~/.config/orchestra
cp backend/.example.env ~/.config/orchestra/.env
```

### AI Provider Configuration

Orchestra supports multiple AI providers. Enable providers by setting their respective environment variables.

#### OpenAI

```bash
OPENAI_API_KEY=sk-your-openai-api-key
```

#### Anthropic (Claude)

```bash
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key
```

#### Google (Gemini)

```bash
GOOGLE_API_KEY=your-google-api-key
```

#### xAI (Grok)

```bash
XAI_API_KEY=your-xai-api-key
```

#### Groq

```bash
GROQ_API_KEY=your-groq-api-key
```

#### AWS Bedrock

AWS Bedrock requires AWS credentials. Bedrock models are enabled when `AWS_BEARER_TOKEN_BEDROCK` is set to any value.

```bash
# Enable Bedrock (set to any value to enable)
AWS_BEARER_TOKEN_BEDROCK=enabled

# AWS credentials (choose one method)
# Method 1: Environment variables
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_DEFAULT_REGION=us-east-1

# Method 2: AWS credentials file (~/.aws/credentials)
# Method 3: IAM roles (for EC2/ECS/Lambda deployments)
```

**Important: Inference Profiles**

Claude 4.5 and newer models require [inference profiles](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html) instead of direct model IDs. The model IDs include a regional prefix:

- `us.` - US regions (us-east-1, us-west-2, etc.)
- `eu.` - EU regions (eu-west-1, eu-central-1, etc.)
- `apac.` - Asia Pacific regions

Orchestra defaults to US inference profiles. For other regions, you may need to customize the model IDs.

**Available Bedrock Models:**

| Model | ID (US Region) |
|-------|-----|
| Claude 4.5 Sonnet | `bedrock_converse:us.anthropic.claude-sonnet-4-5-20250929-v1:0` |
| Claude 4.5 Haiku | `bedrock_converse:us.anthropic.claude-haiku-4-5-20251001-v1:0` |
| Claude 4.5 Opus | `bedrock_converse:us.anthropic.claude-opus-4-5-20251101-v1:0` |
| Kimi K2 Thinking | `bedrock_converse:us.moonshot.kimi-k2-thinking` |
| Claude 3.5 Sonnet | `bedrock_converse:us.anthropic.claude-3-5-sonnet-20241022-v2:0` |
| Claude 3.5 Haiku | `bedrock_converse:us.anthropic.claude-3-5-haiku-20241022-v1:0` |
| Titan Text Premier | `bedrock_converse:amazon.titan-text-premier-v1:0` |
| Llama 3.2 90B | `bedrock_converse:us.meta.llama3-2-90b-instruct-v1:0` |
| Mistral Large | `bedrock_converse:us.mistral.mistral-large-2407-v1:0` |

**IAM Policy Requirements:**

Your AWS credentials need permissions for Bedrock model invocation:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:*::foundation-model/*",
        "arn:aws:bedrock:*:*:inference-profile/*"
      ]
    }
  ]
}
```

#### Ollama (Local Models)

For local model inference using Ollama:

```bash
OLLAMA_BASE_URL=http://localhost:11434
```

### Database Configuration

```bash
POSTGRES_CONNECTION_STRING=postgresql://admin:password@localhost:5432/orchestra
```

### Storage Configuration (Optional)

For file uploads and RAG capabilities:

```bash
MINIO_HOST=localhost:9000
S3_REGION=us-east-2
ACCESS_KEY_ID=minio-access-key
ACCESS_SECRET_KEY=minio-secret-key
BUCKET=orchestra
```

## Sandbox (Optional)

Orchestra supports an optional sandbox environment for secure shell command execution via the `exec_server` MCP service.

To enable the sandbox alongside your Orchestra stack:

```bash
COMPOSE_PROFILES=tools docker compose up -d
```

This starts the `exec_server` container on port `3005`, providing the `exec_command` tool to your agents.

For full configuration details, see the [Sandbox documentation](../tools/sandbox.md).

## Running Orchestra

### Development Mode

```bash
cd backend
make dev
```

### Production with Docker

Use the production commands in [Production Docker deployment](#production-docker-deployment)
above. Do not use `docker compose up -d` without explicitly naming the production
files, and do not use `infra/docker-compose.yml` for a VM deployment; that file is
the development stack.

## Verifying Configuration

After starting Orchestra, verify your configured providers appear in the model selector:

1. Navigate to your Orchestra instance
2. Click the model dropdown at the top of the chat interface
3. Verify models from your configured providers appear in the list

For AWS Bedrock specifically, you should see models prefixed with `bedrock_converse:` in the dropdown.

## Troubleshooting

### AWS Bedrock Models Not Appearing

1. Verify `AWS_BEARER_TOKEN_BEDROCK` is set
2. Check AWS credentials are configured (env vars, credentials file, or IAM role)
3. Ensure your AWS account has Bedrock model access enabled in the AWS Console
4. Verify the IAM policy includes `bedrock:InvokeModel` permissions

### Model Invocation Errors

- **ValidationException: "Invocation with on-demand throughput isn't supported"**: Claude 4.5 models require inference profiles. Ensure model IDs have the regional prefix (e.g., `us.anthropic.claude-sonnet-4-5-...`)
- **AccessDeniedException**: Check IAM permissions include both `foundation-model/*` and `inference-profile/*` resources
- **ResourceNotFoundException**: The model may not be available in your region
- **ThrottlingException**: You've hit API rate limits; implement backoff or request limit increase

## Next Steps

- [Configure Tools & Integrations](../tools/tools.md)
- [Set up MCP Servers](../tools/mcp.md)
- [Enable A2A Protocol](../tools/a2a.md)
