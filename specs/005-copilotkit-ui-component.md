# Spec 005: Add CopilotKit UI Surface

## Summary
Add a CopilotKit UI component so users can interact with the agent through the CopilotKit protocol. This is the critical missing piece identified in the implementation review.

## Changes

### Files
- `frontend/src/components/copilot/` (NEW) — CopilotKit UI wrapper
- Existing chat page or layout — integrate the component

### Details
1. Choose UI surface: `<CopilotSidebar>`, `<CopilotPopup>`, or embedded `<CopilotChat>`
2. Recommended: `<CopilotPopup>` for initial integration (least invasive, floating toggle)
3. Style to match Orchestra theme (green accent, dark/light mode)
4. Existing chat flow (`/api/llm/stream`) must remain unaffected

## Acceptance Criteria
- [ ] CopilotKit UI component rendered and accessible
- [ ] Can send messages through CopilotKit interface
- [ ] Agent responds correctly through AG-UI protocol
- [ ] Existing chat functionality unaffected
- [ ] Typecheck passes
- [ ] Verify in browser using agent-browser skill
