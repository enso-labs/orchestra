# Spec 002: Add CopilotKit Frontend Packages

## Summary
Install CopilotKit React packages in the frontend.

## Changes

### Files
- `frontend/package.json` — add dependencies

### Details
1. `pnpm add @copilotkit/react-core @copilotkit/react-ui @copilotkit/runtime`
2. Verify packages resolve and build succeeds

## Acceptance Criteria
- [ ] `@copilotkit/react-core` in frontend dependencies
- [ ] `@copilotkit/react-ui` in frontend dependencies
- [ ] `@copilotkit/runtime` in frontend dependencies
- [ ] `pnpm install` succeeds
- [ ] Frontend builds without errors
- [ ] Typecheck passes
