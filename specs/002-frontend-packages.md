# Spec 002: Add CopilotKit Frontend Packages

## Objective
Install CopilotKit React packages in the frontend.

## Files Modified
- `frontend/package.json` — add dependencies

## Dependencies to Add
```bash
pnpm add @copilotkit/react-core @copilotkit/react-ui @copilotkit/runtime
```

## Notes
- `@copilotkit/react-core` — core hooks (`useCopilotAction`, `useCopilotReadable`, `useDefaultTool`)
- `@copilotkit/react-ui` — UI components (`CopilotSidebar`, `CopilotPopup`) + styles
- `@copilotkit/runtime` — server-side runtime for the API route (`CopilotRuntime`, `LangGraphAgent`)

## Tests
- Packages install without conflicts
- Frontend builds successfully
- Typecheck passes
