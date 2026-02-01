---
name: parallel-edits
description: "Apply coordinated changes across multiple files efficiently using parallel Edit tool calls. Use when making systematic changes like renaming variables, updating imports, applying pattern changes, or refactoring across files. Triggers on: rename across files, update all imports, change pattern in multiple files, refactor across codebase, batch edit files."
---

# Parallel File Edits

Efficiently apply coordinated changes across multiple files by validating all edits first, then executing them in parallel using multiple Edit tool calls.

## When to Use

- Renaming variables, functions, or classes across files
- Updating import statements throughout the codebase
- Applying pattern changes or refactoring across multiple files
- Fixing common issues in multiple locations
- Updating configuration or constants in multiple places

## Workflow

1. **Plan the edits**: Identify all files and determine exact old/new string pairs
2. **Read all target files**: Use multiple Read calls in parallel to fetch and validate content
3. **Validate before applying**: Check that old_string exists and is unique (or use replace_all)
4. **Execute edits in parallel**: Make all Edit tool calls in a single response
5. **Report results**: Confirm successes and report any failures with clear messages

## Validation Checklist

Before executing edits, verify:

- [ ] All target files have been read and exist
- [ ] Each old_string is present in its target file
- [ ] old_string is unique OR replace_all will be used
- [ ] new_string differs from old_string
- [ ] Indentation matches exactly (no line number prefixes)
- [ ] File paths are absolute, not relative

## Important Guidelines

### Indentation Preservation
- When reading files, line numbers appear as: [spaces][number][tab][content]
- The actual file content starts AFTER the tab
- Never include line number prefixes in old_string or new_string
- Preserve exact indentation (tabs/spaces) as it appears in the file

### Uniqueness Requirements
- If old_string appears multiple times, provide more context to make it unique
- OR use replace_all: true to change all instances
- The Edit tool will fail if old_string is not unique without replace_all

### Parallel Execution
- All Edit calls should be made in the same tool invocation block
- This maximizes efficiency for coordinated changes
- Each edit is independent and does not depend on others

### Error Handling
- If validation fails, stop before making any edits
- Report which validation check failed and why
- Suggest corrections or ask for clarification

## Examples

### Example 1: Renaming a Variable Across Files

User: "Rename the variable userId to accountId across all files in the auth module"
Assistant: I will rename userId to accountId across the auth module files.

[Reads: auth/login.ts, auth/session.ts, auth/middleware.ts in parallel]
[Validates: Each file contains userId, strings are unique]
[Executes: 3 Edit tool calls in parallel with replace_all=true]

Successfully renamed userId to accountId in 3 files:
- /src/auth/login.ts (2 instances)
- /src/auth/session.ts (4 instances)
- /src/auth/middleware.ts (1 instance)

### Example 2: Updating Import Statements

User: "Update all imports from @/lib/utils to @/lib/helpers across the components folder"

Assistant: I will update the import paths across all component files.

[Searches: components folder for files importing @/lib/utils]
[Reads: 5 component files in parallel]
[Validates: Each contains import from @/lib/utils]
[Executes: 5 Edit tool calls in parallel]

Successfully updated import paths in 5 files:
- /src/components/Button.tsx
- /src/components/Card.tsx
- /src/components/Modal.tsx
- /src/components/Form.tsx
- /src/components/Table.tsx

## Reference

### Edit Tool Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| file_path | string | Yes | Absolute path to the file |
| old_string | string | Yes | Exact text to replace (no line numbers) |
| new_string | string | Yes | Replacement text (must differ from old_string) |
| replace_all | boolean | No | Replace all instances (default: false) |

### Common Patterns

**Simple Rename**: Grep for occurrences, read all files in parallel, edit all with replace_all=true

**Import Update**: Grep for old import path, read matching files, edit import lines with exact strings

**Surgical Change**: Read specific files, include surrounding context for uniqueness, edit with replace_all=false