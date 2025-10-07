# Fix AgentStatePydantic Import Deprecation Warning

## Issue
Remove pytest ignore entry for AgentStatePydantic deprecation warning and update imports to use the canonical path.

## Current State
- `backend/pyproject.toml` (lines 60-61) contains pytest ignore entry: `"ignore:AgentStatePydantic has been moved to langchain.agents"`
- Codebase may have imports from the old module path

## Plan

### 1. Search for AgentStatePydantic Imports
- Search entire repository for `AgentStatePydantic` import statements
- Identify all files using the old import path

### 2. Update Import Statements
- Change imports from old module to `langchain.agents`
- Verify the correct canonical import path

### 3. Run Tests
- Execute test suite to verify all imports work correctly
- Ensure no runtime errors from import changes

### 4. Remove Pytest Ignore Entry
- Only after tests pass, remove the ignore line from `backend/pyproject.toml`
- This ensures pytest will surface any remaining issues

## Success Criteria
- All imports use the canonical `langchain.agents` path
- Tests pass without errors
- Pytest ignore entry removed from pyproject.toml
- No deprecation warnings appear in test output
