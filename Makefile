.PHONY: update-submodules ralph archive setup

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

# Archive current prd.json and progress.txt into [feat|bug]-<issue#> directory
archive:
	@BRANCH=$$(jq -r '.branchName' .ralph/prd.json 2>/dev/null) && \
	if [ -z "$$BRANCH" ] || [ "$$BRANCH" = "null" ]; then echo "No .ralph/prd.json or branchName found"; exit 1; fi && \
	ARCHIVE_DIR=".ralph/archive/$$(echo $$BRANCH | sed 's|/\([0-9]*\).*|-\1|')" && \
	mkdir -p "$$ARCHIVE_DIR" && \
	cp .ralph/prd.json "$$ARCHIVE_DIR/prd.json" && \
	[ -f .ralph/progress.txt ] && cp .ralph/progress.txt "$$ARCHIVE_DIR/progress.txt" || true && \
	rm -f .ralph/prd.json .ralph/progress.txt && \
	echo "Archived to $$ARCHIVE_DIR"