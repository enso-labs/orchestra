# Spec 005: Integrate useDefaultTool for Tool Call Rendering

## Objective
Add `useDefaultTool` hook to render tool calls in the chat interface via CopilotKit.

## Files Modified
- Chat page or chat component that renders the conversation

## Implementation
```tsx
import { useDefaultTool } from "@copilotkit/react-core";

// Inside the chat component:
useDefaultTool({
  render: ({ name, status, args, result }) => (
    <details>
      <summary>
        {status === "complete" ? `Called ${name}` : `Calling ${name}`}
      </summary>
      <p>Args: {JSON.stringify(args)}</p>
      <p>Result: {JSON.stringify(result)}</p>
    </details>
  ),
});
```

## Notes
- This adds a default renderer for ALL tool calls that go through CopilotKit
- Can be customized per-tool later with `useCopilotAction`
- Should integrate with existing tool rendering UI if any
- Style the tool call cards to match the existing chat theme

## Tests
- Tool calls render in chat when agent uses tools
- Loading state shows during tool execution
- Completed tool calls show results
- Typecheck passes
- Verify in browser using agent-browser skill
