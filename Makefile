.PHONY: setup tag changelog dev.docker.up dev.docker.down dev.docker.logs dev.docker.ps dev.docker.migrate dev.docker.test.up dev.docker.test.down benchmark.images test.images

ENV ?= dev
# Override with ENV_FILE=/path/to/file; Compose receives it as ORCHESTRA_ENV_FILE.
ENV_FILE ?= $(HOME)/.config/orchestra/.env.backend
COMPOSE = docker compose -f infra/docker-compose.yml
COMPOSE_TEST = docker compose -f infra/docker-compose.yml -f infra/docker-compose.test.yml
DOCKER_DEV_LOG_SERVICES ?= app

# Compose interpolates the database URL before it reads service env_file
# entries, so load the operator-selected env file explicitly for all targets.
define compose_with_env
	@test -f "$(ENV_FILE)" || { echo "Missing ENV_FILE=$(ENV_FILE)" >&2; exit 1; }
	@set -a && . "$(ENV_FILE)" && set +a && ORCHESTRA_ENV_FILE="$(ENV_FILE)" $(1)
endef

# Install pre-commit hooks
setup:
	pre-commit install

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

dev.docker.up:
	$(call compose_with_env,$(COMPOSE) up --build -d)

dev.docker.down:
	$(call compose_with_env,$(COMPOSE) down --remove-orphans)

dev.docker.logs:
	$(call compose_with_env,$(COMPOSE) logs -f --tail=200 $(DOCKER_DEV_LOG_SERVICES))

dev.docker.ps:
	$(call compose_with_env,$(COMPOSE) ps)

dev.docker.migrate:
	$(call compose_with_env,$(COMPOSE) run --rm migrate)

# Local end-to-end test stack (default + test overlay). CI uses pytest + GH services.
dev.docker.test.up:
	$(call compose_with_env,$(COMPOSE_TEST) up --build -d)

dev.docker.test.down:
	$(call compose_with_env,$(COMPOSE_TEST) down --remove-orphans)

# Image benchmark — build the single API target and report its size
benchmark.images:
	bash backend/scripts/benchmark-images.sh

# Integration test with split images
test.images:
	bash backend/scripts/test-images.sh $(TAG)
