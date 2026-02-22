#!/bin/bash
#
# tag.sh — Create and push a YYYY.MM.DD-RR version tag
#
# Usage:
#   ./backend/scripts/tag.sh              # auto-generates next tag for today
#   ./backend/scripts/tag.sh 2026.02.22-03  # use explicit tag
#

set -euo pipefail
ORIGIN="${GIT_REMOTE:-origin}"

# Generate or accept tag
if [ -n "${1:-}" ]; then
    TAG="$1"
else
    TODAY=$(date -u +%Y.%m.%d)
    # Find the highest revision for today
    LAST_REV=$(git tag -l "${TODAY}-*" --sort=-version:refname | head -1 | grep -oP '\d+$' || echo "0")
    NEXT_REV=$(printf "%02d" $((10#${LAST_REV} + 1)))
    TAG="${TODAY}-${NEXT_REV}"
fi

echo "Tag: $TAG"
read -p "Message (press enter for none): " MESSAGE

# Confirm
echo ""
echo "  Tag:     $TAG"
echo "  Message: ${MESSAGE:-<empty>}"
echo "  Remote:  $ORIGIN"
read -p "Proceed? (y/N) " CONFIRM

if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

if git rev-parse "$TAG" >/dev/null 2>&1; then
    echo "Error: Tag $TAG already exists locally. Delete with: git tag -d $TAG"
    exit 1
fi

git tag -a "$TAG" -m "${MESSAGE:-$TAG}"

if git push "$ORIGIN" "$TAG"; then
    echo "✅ Tag $TAG created and pushed."
else
    echo "❌ Push failed. If remote tag exists, force with: git push $ORIGIN $TAG --force"
    exit 1
fi
