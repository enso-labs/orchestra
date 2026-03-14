#!/bin/bash
#
# tag.sh — Create and push a YYYY.M.D[-N] version tag
#
# Format: YYYY.M.D (no zero-padding). Multiple releases per day
# get a -N suffix: 2026.2.22, 2026.2.22-2, 2026.2.22-3, ...
#
# Usage:
#   ./backend/scripts/tag.sh                # auto-generates next tag for today
#   ./backend/scripts/tag.sh 2026.2.22-3    # use explicit tag
#

set -euo pipefail
ORIGIN="${GIT_REMOTE:-origin}"

if [ -n "${1:-}" ]; then
    TAG="$1"
else
    # YYYY.M.D (no zero-padding)
    YEAR=$(date -u +%Y)
    MONTH=$(date -u +%-m)
    DAY=$(date -u +%-d)
    TODAY="${YEAR}.${MONTH}.${DAY}"

    # Check existing tags for today
    EXISTING=$(git tag -l "${TODAY}" "${TODAY}-*" 2>/dev/null | wc -l)
    if [ "$EXISTING" -eq 0 ]; then
        TAG="${TODAY}"
    else
        # Find highest suffix
        MAX=$(git tag -l "${TODAY}-*" --sort=-version:refname | head -1 | grep -oP '(?<=-)\d+$' || echo "1")
        if git tag -l "${TODAY}" --quiet 2>/dev/null | grep -q .; then
            # Base tag exists, so next is at least -2
            NEXT=$((MAX > 1 ? MAX + 1 : 2))
        else
            NEXT=$((MAX + 1))
        fi
        TAG="${TODAY}-${NEXT}"
    fi
fi

echo "Tag: $TAG"
read -p "Message (press enter for none): " MESSAGE

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
