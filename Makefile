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

# Archive current prd.json and progress.txt into dated directory
archive:
	claude --dangerously-skip-permissions -p "Archive the latest prd.json & progress.json into \`./.ralph/archives/YYYY-MM-DD/prd.json\` and \`./.ralph/archives/YYYY-MM-DD/progress.json\` respectively. Create the directory if it doesn't exist."