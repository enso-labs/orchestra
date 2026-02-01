---
name: ralph:archive
description: "Archive the current Ralph prd.json and progress.txt before starting a new feature. Use when you need to archive a completed or abandoned Ralph run. Triggers on: archive ralph, archive prd, ralph archive, clear ralph, reset ralph."
---

# Ralph Archive

Archives the current `.ralph/prd.json` and `.ralph/progress.txt` into `.ralph/archive/YYYY-MM-DD-feature-name/` so a new Ralph run can start clean.

---

## The Job

1. Check if `.ralph/prd.json` exists — if not, inform the user there is nothing to archive and stop
2. Read `.ralph/prd.json` to extract the feature name from `branchName` (strip `ralph/` prefix) or `description`
3. Create the archive directory: `.ralph/archive/YYYY-MM-DD-feature-name/` using today's date
4. Move `.ralph/prd.json` to the archive directory
5. Move `.ralph/progress.txt` to the archive directory (if it exists)
6. Confirm to the user what was archived and where

---

## Rules

- **Date format:** `YYYY-MM-DD` (e.g., `2026-01-31`)
- **Feature name:** Derived from `branchName` in the prd.json. Strip the `ralph/` prefix and use as-is (already kebab-case). If branchName contains slashes beyond the `ralph/` prefix (e.g., `feat/123-feature-name`), preserve them in the directory path.
- **If the archive directory already exists:** Append a numeric suffix (e.g., `2026-01-31-feature-name-2/`)
- **Do NOT delete or modify** any files in the archive after moving them
- **Do NOT create a new prd.json or progress.txt** — that is the ralph skill's job

---

## Example

Given `.ralph/prd.json` contains:
```json
{
  "branchName": "ralph/task-status",
  "description": "Task Status Feature"
}
```

Running this skill on 2026-01-31 produces:
```
.ralph/archive/2026-01-31-task-status/prd.json
.ralph/archive/2026-01-31-task-status/progress.txt
```

---

## Steps (for the agent)

```bash
# 1. Read branchName from prd.json
BRANCH=$(jq -r '.branchName' .ralph/prd.json)
FEATURE=$(echo "$BRANCH" | sed 's|^ralph/||')
DATE=$(date +%Y-%m-%d)
ARCHIVE_DIR=".ralph/archive/${DATE}-${FEATURE}"

# 2. Handle collision
if [ -d "$ARCHIVE_DIR" ]; then
  SUFFIX=2
  while [ -d "${ARCHIVE_DIR}-${SUFFIX}" ]; do
    SUFFIX=$((SUFFIX + 1))
  done
  ARCHIVE_DIR="${ARCHIVE_DIR}-${SUFFIX}"
fi

# 3. Create and move
mkdir -p "$ARCHIVE_DIR"
mv .ralph/prd.json "$ARCHIVE_DIR/"
[ -f .ralph/progress.txt ] && mv .ralph/progress.txt "$ARCHIVE_DIR/"
```

---

## Checklist

- [ ] `.ralph/prd.json` exists before archiving
- [ ] Archive directory uses today's date and feature name
- [ ] Both `prd.json` and `progress.txt` are moved (not copied)
- [ ] No files remain in `.ralph/` root (prd.json, progress.txt)
- [ ] Confirmed archive location to user
