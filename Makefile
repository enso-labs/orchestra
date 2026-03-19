.PHONY: update-submodules ralph archive setup tag changelog dev.storage.up dev.storage.down dev.storage.ps dev.services.up dev.services.down dev.services.ps dev.docker.up dev.docker.down dev.docker.logs dev.docker.ps dev.docker.migrate dev.docker.debug benchmark.images test.images

ENV ?= dev
MAX_ITERATIONS ?= 200
DOCKER_STORAGE_COMPOSE = docker compose -f docker-compose.storage.yml
DOCKER_SERVICES_COMPOSE = docker compose -f docker-compose.services.yml
DOCKER_DEV_COMPOSE = docker compose -f docker-compose.dev.yml
DOCKER_DEBUG_COMPOSE = docker compose -f docker-compose.dev.yml -f docker-compose.debug.yml
DOCKER_DEV_LOG_SERVICES ?= backend worker frontend

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

# Archive current prd.json and progress.txt into [feat|bug]-<issue#> directory
archive:
	@BRANCH=$$(jq -r '.branchName' .ralph/prd.json 2>/dev/null) && \
	if [ -z "$$BRANCH" ] || [ "$$BRANCH" = "null" ]; then echo "No .ralph/prd.json or branchName found"; exit 1; fi && \
	ARCHIVE_DIR=".ralph/archive/$$(echo $$BRANCH | sed 's|/\([0-9]*\).*|-\1|')" && \
	mkdir -p "$$ARCHIVE_DIR" && \
	cp .ralph/prd.json "$$ARCHIVE_DIR/prd.json" && \
	[ -f .ralph/progress.txt ] && cp .ralph/progress.txt "$$ARCHIVE_DIR/progress.txt" || true && \
	if ls specs/*.md >/dev/null 2>&1; then mkdir -p "$$ARCHIVE_DIR/specs" && cp specs/*.md "$$ARCHIVE_DIR/specs/"; fi && \
	rm -f .ralph/prd.json .ralph/progress.txt && \
	echo "Archived to $$ARCHIVE_DIR"

# Add a changelog entry for the current branch (YYYY.M.D[-N] format)
changelog:
	@YEAR=$$(date -u +%Y) && MONTH=$$(date -u +%-m) && DAY=$$(date -u +%-d) && \
	TODAY="$${YEAR}.$${MONTH}.$${DAY}" && \
	BRANCH=$$(git rev-parse --abbrev-ref HEAD) && \
	EXISTING=$$(grep -cP "^## $${TODAY}($$|-)" Changelog.md 2>/dev/null || echo "0") && \
	if [ "$$EXISTING" -eq 0 ]; then VERSION="$${TODAY}"; \
	else \
		MAX=$$(grep -oP "^## $${TODAY}-\K\d+" Changelog.md 2>/dev/null | sort -rn | head -1 || echo "1") && \
		if [ "$$MAX" -gt 1 ]; then VERSION="$${TODAY}-$$((MAX+1))"; else VERSION="$${TODAY}-2"; fi; \
	fi && \
	HEADER="## $${VERSION}" && \
	ENTRY="  - $${BRANCH}" && \
	FIRST_ENTRY=$$(grep -n '^## ' Changelog.md | head -1 | cut -d: -f1) && \
	if [ -z "$$FIRST_ENTRY" ]; then \
		printf "%s\n\n### Changed\n%s\n" "$$HEADER" "$$ENTRY" >> Changelog.md; \
	else \
		sed -i "$${FIRST_ENTRY}i\\$${HEADER}\n\n### Changed\n$${ENTRY}\n" Changelog.md; \
	fi && \
	echo "📝 Added $${VERSION} entry for $${BRANCH}"

# Create and push a YYYY.MM.DD-RR git tag
tag:
	@bash backend/scripts/tag.sh $(TAG)

dev.storage.up:
	@$(DOCKER_STORAGE_COMPOSE) up -d

dev.storage.down:
	@$(DOCKER_STORAGE_COMPOSE) down --remove-orphans

dev.storage.ps:
	@$(DOCKER_STORAGE_COMPOSE) ps

dev.services.up:
	@$(DOCKER_SERVICES_COMPOSE) up --build -d

dev.services.down:
	@$(DOCKER_SERVICES_COMPOSE) down --remove-orphans

dev.services.ps:
	@$(DOCKER_SERVICES_COMPOSE) ps

dev.docker.up:
	@$(DOCKER_DEV_COMPOSE) up --build -d

dev.docker.debug:
	@$(DOCKER_DEBUG_COMPOSE) up --build -d

dev.docker.down:
	@$(DOCKER_DEV_COMPOSE) down --remove-orphans

dev.docker.logs:
	@$(DOCKER_DEV_COMPOSE) logs -f --tail=200 $(DOCKER_DEV_LOG_SERVICES)

dev.docker.ps:
	@$(DOCKER_DEV_COMPOSE) ps

dev.docker.migrate:
	@$(DOCKER_DEV_COMPOSE) run --rm backend uv run alembic upgrade head

# Image benchmarks — build both targets and report sizes
benchmark.images:
	bash backend/scripts/benchmark-images.sh

# Integration test with split images
test.images:
	bash backend/scripts/test-images.sh $(TAG)
