---
description: "Create a new GitHub issue and initialize corresponding branch and PR flow based on a development topic."
argument-hint: "<topic-description>"
allowed-tools: "github-cli, context-explorer, spec-generator"
---

# Git Issue Init

Create a ticket when provided a topic.

## Variables

TOPIC: $ARGUMENTS

## Workflow

1. _RESEARCH_ topic using the @agent-context-explorer and provide report to @agent-spec-generator.
2. _CREATE_ GitHub issue using the CLI. The title prefix should be either `FEAT: [short-desc]` or `BUG: [short-desc]` depending on context.
3. _WRITE_ an outlined implementation plan in the issue description.
4. _READ-THEN-EXECUTE_ the `$PROJECT_ROOT/.claude/commands/git/pr-init.md` to initialize branch and PR flow.

## Report

If error encountered, exit and report the issue; otherwise, report successful completion.