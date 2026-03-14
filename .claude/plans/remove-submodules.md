# Plan: Remove cli, sandboxes, and website submodules

**Issue**: #873
**Branch**: `feat/873-remove-submodules`

## Steps

1. **Deinit submodules** — `git submodule deinit -f cli sandboxes website`
   - Removes entries from `.git/config` and cleans working directories

2. **Remove from index** — `git rm -f cli sandboxes website`
   - Removes submodule entries from `.gitmodules` and the git index
   - Stages the removal of the submodule paths

3. **Clean cached module data** — `rm -rf .git/modules/cli .git/modules/sandboxes .git/modules/website`
   - Removes the cloned module repos from `.git/modules/`

4. **Update issue metadata** — Edit the issue body to fill in the actual issue number in the metadata block

5. **Verify** — `git submodule status` should only show `wiki`

6. **Commit** — Single commit with all changes staged

## What stays
- `wiki` submodule remains untouched
