---
name: codebase-search
description: Find files and patterns in codebase using Glob and Grep
---

# Codebase Search

Find relevant files and patterns using Glob and Grep.

## Purpose

Locate files by name pattern and search for text/regex patterns across the codebase.

## Tools

| Tool | Purpose | Example |
|------|---------|---------|
| Glob | Find files by pattern | `**/*.service.ts` |
| Grep | Find text patterns | `"class.*Controller"` |

## Common Patterns

### Find Files

```bash
# By type
Glob: **/*.py           # Python files
Glob: **/*.ts           # TypeScript files
Glob: **/*.md           # Markdown files

# By name pattern
Glob: **/test_*.py      # Python tests
Glob: **/*.test.tsx     # React tests
Glob: **/schema*.ts     # Schema files
Glob: **/types/*.ts     # Type definitions

# By directory
Glob: backend/src/**/*.py
Glob: frontend/src/components/**/*.tsx
```

### Find Patterns

```bash
# Classes/Functions
Grep: "class.*Service"
Grep: "def test_"
Grep: "function.*export"

# Tests
Grep: "describe\\("
Grep: "it\\("
Grep: "expect\\("

# TODOs
Grep: "TODO|FIXME|HACK"

# API endpoints
Grep: "@api_route|@router"
Grep: "app\\.get\\(|app\\.post\\("
```

## Output

Returns list of matching files or text matches with context.

## Usage

1. Start broad, narrow as needed
2. Use Glob for file discovery
3. Use Grep for content search
4. Combine both for targeted results
