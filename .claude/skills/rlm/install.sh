#!/usr/bin/env bash
# RLM Skill Installer - Recursive Language Model pattern for Claude Code
# Usage: curl -fsSL https://raw.githubusercontent.com/ruska-ai/orchestra/master/.claude/skills/rlm/install.sh | bash
# Global: curl -fsSL https://raw.githubusercontent.com/ruska-ai/orchestra/master/.claude/skills/rlm/install.sh | bash -s -- --global
set -e

BASE_URL="https://raw.githubusercontent.com/ruska-ai/orchestra/master/.claude/skills/rlm"
INSTALL_DIR=".claude/skills/rlm"

# Parse flags
for arg in "$@"; do
  case "$arg" in
    --global)
      INSTALL_DIR="$HOME/.claude/skills/rlm"
      ;;
  esac
done

echo "Installing RLM skill to ${INSTALL_DIR}..."

# Create directories
mkdir -p "${INSTALL_DIR}/references"

# Download SKILL.md
curl -fsSL "${BASE_URL}/SKILL.md" -o "${INSTALL_DIR}/SKILL.md"

# Download references/prompt-templates.md
curl -fsSL "${BASE_URL}/references/prompt-templates.md" -o "${INSTALL_DIR}/references/prompt-templates.md"

# Validate downloads are non-empty
if [ ! -s "${INSTALL_DIR}/SKILL.md" ]; then
  echo "Error: SKILL.md download failed or is empty" >&2
  exit 1
fi

if [ ! -s "${INSTALL_DIR}/references/prompt-templates.md" ]; then
  echo "Error: prompt-templates.md download failed or is empty" >&2
  exit 1
fi

echo ""
echo "RLM skill installed successfully!"
echo "  Location: ${INSTALL_DIR}"
echo "  Files:"
echo "    - SKILL.md"
echo "    - references/prompt-templates.md"
echo ""
echo "Trigger with: analyze large, recursive analysis, deep analysis,"
echo "  process large input, comprehensive review, rlm, recursive reasoning"
