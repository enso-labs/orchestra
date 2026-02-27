# Spec 004: Wrap App with CopilotKit Provider

## Objective
Add the `<CopilotKit>` provider to the app layout so all components can use CopilotKit hooks.

## Files Modified
- App layout file (find the root layout that wraps all pages)

## Implementation
```tsx
import { CopilotKit } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";

// Wrap children with CopilotKit provider:
<CopilotKit runtimeUrl="/api/copilotkit" agent="deepagent">
  {children}
</CopilotKit>
```

## Notes
- Provider should wrap inside existing providers (auth, theme, etc.) but outside chat components
- `agent="deepagent"` must match the key in the runtime route's agents config
- Import CopilotKit styles for UI components to render correctly
- This is a non-breaking change — provider is passive when no CopilotKit hooks are used

## Tests
- App renders successfully with provider
- No visual regressions
- Typecheck passes
- Verify in browser using agent-browser skill
