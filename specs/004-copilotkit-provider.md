# Spec 004: Wrap App with CopilotKit Provider

## Summary
Add `<CopilotKit>` provider to the app root so CopilotKit hooks work throughout the frontend.

## Changes

### Files
- `frontend/src/app/layout.tsx` or equivalent root component — wrap with provider

### Details
1. Import `CopilotKit` from `@copilotkit/react-core`
2. Wrap app with `<CopilotKit runtimeUrl="/api/copilotkit" agent="deepagent">`
3. Import CopilotKit CSS styles

## Acceptance Criteria
- [ ] App wrapped with `<CopilotKit>` provider
- [ ] runtimeUrl points to backend endpoint
- [ ] CopilotKit styles imported
- [ ] App renders without errors
- [ ] Typecheck passes
- [ ] Verify in browser using agent-browser skill
