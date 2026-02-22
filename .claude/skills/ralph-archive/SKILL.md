---
name: ralph:archive
description: "Archive the current Ralph prd.json and progress.txt before starting a new feature. Use when you need to archive a completed or abandoned Ralph run. Triggers on: archive ralph, archive prd, ralph archive, clear ralph, reset ralph."
---

# Ralph Archive

Archives the current `.ralph/prd.json` and `.ralph/progress.txt` into `.ralph/archive/[feat|bug]-<issue#>/` so a new Ralph run can start clean.

---

## The Job

1. Check if `.ralph/prd.json` exists &mdash; if not, inform the user there is nothing to archive and stop
2. Read `.ralph/prd.json` to extract the branch name from `branchName`
3. Derive the archive folder name from the branch: `feat/810-feature-name` &rarr; `feat-810`, `bug/796-save-error` &rarr; `bug-796`
4. Create the archive directory: `.ralph/archive/[feat|bug]-<issue#>/`
5. Copy `.ralph/prd.json` to the archive directory
6. Copy `.ralph/progress.txt` to the archive directory (if it exists)
7. Remove the originals from `.ralph/` root
8. Confirm to the user what was archived and where

---

## Rules

- **Directory naming:** `[feat|bug]-<issue#>` derived from `branchName` in prd.json (e.g., `feat/810-feature-name` &rarr; `feat-810`)
- **If the archive directory already exists:** Append a numeric suffix (e.g., `feat-810-2/`)
- **Do NOT delete or modify** any files in the archive after moving them
- **Do NOT create a new prd.json or progress.txt** &mdash; that is the ralph skill&apos;s job

---

## Example

Given `.ralph/prd.json` contains:
```json
{
  "branchName": "feat/810-collapsible-tool-inputs",
  "description": "Collapsible Tool Inputs Feature"
}
```

Running this skill produces:
```
.ralph/archive/feat-810/prd.json
.ralph/archive/feat-810/progress.txt
```

---

## Steps (for the agent)

```bash
# 1. Read branchName from prd.json
BRANCH=$(jq -r '.branchName' .ralph/prd.json)
ARCHIVE_DIR=".ralph/archive/$(echo $BRANCH | sed 's|/\([0-9]*\).*|-\1|')"

# 2. Handle collision
if [ -d "$ARCHIVE_DIR" ]; then
  SUFFIX=2
  while [ -d "${ARCHIVE_DIR}-${SUFFIX}" ]; do
    SUFFIX=$((SUFFIX + 1))
  done
  ARCHIVE_DIR="${ARCHIVE_DIR}-${SUFFIX}"
fi

# 3. Create, copy, and clean
mkdir -p "$ARCHIVE_DIR"
cp .ralph/prd.json "$ARCHIVE_DIR/"
[ -f .ralph/progress.txt ] && cp .ralph/progress.txt "$ARCHIVE_DIR/"
rm -f .ralph/prd.json .ralph/progress.txt
```

---

## Checklist

- [ ] `.ralph/prd.json` exists before archiving
- [ ] Archive directory uses `[feat|bug]-<issue#>` naming from branchName
- [ ] Both `prd.json` and `progress.txt` are copied then originals removed
- [ ] No working files remain in `.ralph/` root (prd.json, progress.txt)
- [ ] Confirmed archive location to user
