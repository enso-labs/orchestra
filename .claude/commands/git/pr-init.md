---
description: "Initialize a new branch, update the changelog, and open a tracking pull request for a given objective."
argument-hint: "<objective> <branch-name?>"
allowed-tools: "git, github-cli, bash"
---

# Pull Request Init

Create a new branch, update the changelog with new branch info, commit init to new branch, create corresponding PR for tracking.

## Variables

OBJECTIVE: $1
BRANCH_NAME: $2

```yml
conditions:
  - if: "!$BRANCH_NAME"
    then:
      - title: "Take $OBJECTIVE and map into the following format based on issue type:"
      - example: "[bug|feat]/[issue-number]-[short-desc]"
```

## Workflow

1. _RUN_ `git branch | grep "*"` to check the current branch for context.
2. _CREATE_ new branch using the format described in `conditions` if `$BRANCH_NAME` is not provided, otherwise use `$BRANCH_NAME`.
3. _RUN_ from the project root: `bash backend/scripts/changelog.sh`
4. _RUN_ `git branch | grep "*"` again to confirm the current branch context.
5. _READ_ `Changelog.md` to verify the update.
6. _COMMIT_ changes to the current branch.
7. _CREATE_ a pull request using the GitHub CLI: `FROM [source-branch-name] TO [target-branch-name|development]`.
8. _WRITE_ in the PR description: `Closes #[issue-number]`

## Report

If an error occurs along the way, exit and report the error; otherwise, report successful completion.