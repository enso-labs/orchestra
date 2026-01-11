---
name: type-analysis
description: Analyze type definitions to understand data contracts
---

# Type Analysis

Analyze type definitions to understand data contracts and interfaces.

## Purpose

Extract data shapes, contracts, and interface definitions from type files.

## Evidence Sources

| Source | Location | Signal Value |
|--------|----------|--------------|
| TypeScript types | `**/types/*.ts` | Very High |
| Pydantic models | `**/schemas/*.py` | Very High |
| Interface definitions | `**/*.d.ts` | High |
| Schema files | `**/schema*.ts` | High |

## Search Patterns

```bash
# TypeScript
Glob: **/types/*.ts
Glob: **/*.d.ts
Grep: "interface.*\\{"
Grep: "type.*="
Grep: "export type"

# Python
Glob: **/schemas/*.py
Glob: **/models/*.py
Grep: "class.*BaseModel"
Grep: "class.*Pydantic"
```

## What to Extract

| Element | Example | Documents |
|---------|---------|-----------|
| Required fields | `name: string` | Mandatory data |
| Optional fields | `name?: string` | Optional data |
| Validation | `@validator` | Business rules |
| Enums | `enum Status` | Valid values |
| Generics | `Response<T>` | Patterns |

## Output

Data contract documentation:
- Field names and types
- Required vs optional
- Validation rules
- Relationships

## Usage

1. Find type files with Glob
2. Read definitions
3. Document contracts
4. Map relationships
