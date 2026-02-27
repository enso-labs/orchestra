# Spec 006: Integrate useDefaultTool for Tool Call Rendering

## Summary
Add `useDefaultTool` hook to render tool calls in the CopilotKit chat interface.

## Changes

### Files
- CopilotKit UI component from Spec 005 — add hook
- Tool rendering components if needed

### Details
1. Import and use `useDefaultTool` from `@copilotkit/react-core`
2. Render tool calls with appropriate UI (cards, collapsible sections)
3. Style tool cards to match Orchestra theme

## Acceptance Criteria
- [ ] `useDefaultTool` hook integrated
- [ ] Tool calls render visually in CopilotKit chat
- [ ] Tool cards match Orchestra styling
- [ ] Typecheck passes
- [ ] Verify in browser using agent-browser skill
