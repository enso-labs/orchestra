.PHONY: update-submodules ralph archive setup local docker.build docker.push docker.all docker.configure docker.up docker.down

ENV ?= dev
MAX_ITERATIONS ?= 200

update-submodules:
	@echo "🔍 Initializing submodules..."
	git submodule init

	@echo "⬇️  Updating all submodules to their latest remote commits..."
	git submodule update --remote --merge

	@echo "📝 Staging changes..."
	git add .

	@echo "✅ Committing updated submodules..."
	git commit -m "Update all submodules to latest remote commits" || echo "No changes to commit."

	@echo "🏁 Done."

# Install pre-commit hooks
setup:
	pre-commit install

# Run the Ralph autonomous agent loop using Claude Code
ralph:
	@unset CLAUDECODE; bash .ralph/ralph.sh $(MAX_ITERATIONS)

# Start Orchestra in local mode with filesystem backend
local:
	cd backend && uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000 --log-level debug --env-file $(HOME)/.env/orchestra/.env.backend.local

# Archive current prd.json and progress.txt into dated directory
archive:
	claude --dangerously-skip-permissions -p "Archive the latest prd.json & progress.json into \`./.ralph/archive/YYYY-MM-DD/prd.json\` and \`./.ralph/archive/YYYY-MM-DD/progress.json\` respectively. Create the directory if it doesn't exist."

# =============================================================================
# Docker — Orchestra Local image
# =============================================================================
REGISTRY    = ghcr.io/ruska-ai
IMAGE       = $(REGISTRY)/orchestra
DOCKER_TAG ?= local

# Build the lightweight Orchestra image
docker.build:
	docker build -f docker/Dockerfile -t $(IMAGE):$(DOCKER_TAG) .

# Push the image (tagged version + :local alias)
docker.push:
	docker push $(IMAGE):$(DOCKER_TAG)
	@if [ "$(DOCKER_TAG)" != "local" ]; then \
		docker tag $(IMAGE):$(DOCKER_TAG) $(IMAGE):local; \
		docker push $(IMAGE):local; \
	fi

# Build and push
docker.all: docker.build docker.push

# Configure credentials for local Docker deployment
docker.configure:
	@if [ ! -f .env.docker ]; then \
		cp .env.docker.example .env.docker; \
		echo "Created .env.docker from template."; \
		echo "Edit .env.docker to add your API keys, then run:"; \
		echo "  make docker.up"; \
	else \
		echo ".env.docker already exists. Edit it directly."; \
	fi

# Start the local Docker stack (with migrations + seeding on first boot)
docker.up:
	RUN_MIGRATIONS=true SEED_USERS=true docker compose -f docker-compose.local.yml up --build -d

# Stop the local Docker stack
docker.down:
	docker compose -f docker-compose.local.yml down