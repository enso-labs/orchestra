# Plan: Add Joyride Tour Steps for ChatComposer Sub-Components

## Context
The current onboarding tour (React Joyride) covers sidebar navigation, the chat input area as a whole, nav actions, settings, and the help button -- but skips over all the interactive controls **within** the ChatComposer: tools menu, agent selector, model picker, file panel toggle, sandbox selector, tasks, and submit/voice button. New users don't get guided through these features.

## Approach
Insert 7 new tour steps between the existing `chat-input` (step 5) and `chat-nav-actions` (step 6) steps. Add `data-tour` attributes to the targeted elements. The tour already handles missing targets gracefully (skips to next step), so conditional elements like tasks and sandbox are safe to include.

## New Steps (inserted after "chat-input", before "chat-nav-actions")

| # | Target | Content | Placement |
|---|--------|---------|-----------|
| 6 | `sandbox-selector` | Choose where your code runs -- local, cloud, or no sandbox. | top |
| 7 | `files-toggle-button` | Open the file editor to view and edit files alongside your conversation. | top |
| 8 | `tools-menu-button` | Attach images, toggle web search, and configure tools for your assistant. | top |
| 9 | `agent-selector-button` | Select a saved assistant to use its custom instructions and tool configuration. | top |
| 10 | `model-selector` | Switch between AI models to balance speed, cost, and capability. | top |
| 11 | `chat-submit-button` | Send your message, or use the microphone for voice input when the field is empty. | top |

**Note:** `tasks-button` excluded -- it only renders when todos exist, which never happens for new users on their first tour. The other conditional elements (sandbox, agent menu) are present on the ThreadPage where most users land.

## Files to Modify

### 1. `frontend/src/lib/config/onboardingSteps.ts`
Add 6 new step objects after the `chat-input` step (line 35). Total steps: 9 -> 15.

### 2. `frontend/src/components/status/ThreadSandboxStatus.tsx`
Add `data-tour="sandbox-selector"` to the outer wrapper `<div>` (around line 99).

### 3. `frontend/src/components/chat/ChatUtilityRow.tsx`
Add `data-tour="files-toggle-button"` to the Files `<Button>` at line 101.

### 4. `frontend/src/components/menus/BaseToolMenu.tsx`
Add `data-tour="tools-menu-button"` to the trigger `<Button>` (around line 141).

### 5. `frontend/src/components/menus/AgentMenu.tsx`
Wrap the desktop `<Popover>` in a `<div data-tour="agent-selector-button">` (around line 256). Use `className="contents"` or no class to avoid layout impact.

### 6. `frontend/src/components/inputs/ChatInput.tsx`
- Add `data-tour="model-selector"` to the model `<button>` at line 186.
- Wrap `<ChatSubmitButton>` (line 222) in `<div data-tour="chat-submit-button">` -- cleaner than modifying 3 return paths inside ChatSubmitButton.

## Verification
1. `npm run build` -- ensure no build errors
2. `npm run test` -- ensure no test regressions
3. Manual: Click the Help button to replay the tour on a ThreadPage -- all 15 steps should appear in sequence
4. Manual: Replay tour on a non-thread page (e.g., ChatPanel without sandbox/agent) -- conditional steps should be skipped gracefully
