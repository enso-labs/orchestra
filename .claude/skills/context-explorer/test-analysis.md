---
name: test-analysis
description: Extract expected behavior from test files
---

# Test Analysis

Extract expected behavior and acceptance criteria from test files.

## Purpose

Tests are the highest-signal evidence for expected behavior. Extract what the code should do.

## Evidence Sources

| Source | Location | Signal Value |
|--------|----------|--------------|
| Python tests | `**/test_*.py` | Very High |
| TypeScript tests | `**/*.test.ts` | Very High |
| React tests | `**/*.test.tsx` | Very High |
| Spec files | `**/*.spec.ts` | Very High |

## Search Patterns

```bash
# Find test files
Glob: **/test_*.py
Glob: **/*.test.ts
Glob: **/*.test.tsx
Glob: **/*.spec.ts

# Find test descriptions
Grep: "describe\\("
Grep: "it\\("
Grep: "test\\("
Grep: "def test_"

# Find assertions
Grep: "expect\\("
Grep: "assert"
Grep: "should"
Grep: "toBe|toEqual|toHaveBeenCalled"
```

## What to Extract

| Element | Example | Documents |
|---------|---------|-----------|
| Test names | `it('should login')` | Expected behavior |
| Assertions | `expect(result).toBe(true)` | Success criteria |
| Error cases | `expect(...).toThrow()` | Error handling |
| Mocks | `jest.mock()` | Dependencies |
| Setup | `beforeEach()` | Prerequisites |

## Output

Acceptance criteria from tests:
- What should happen (happy path)
- What should not happen (error cases)
- Edge cases handled
- Dependencies and integrations

## Usage

1. Find test files with Glob
2. Read test descriptions
3. Extract assertions as criteria
4. Document edge cases
