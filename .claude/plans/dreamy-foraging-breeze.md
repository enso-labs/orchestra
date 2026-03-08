# Fix: Duplicate ChatInput on Chat Page

## Context
When navigating to `/chat` while logged in with no messages, two ChatInput components render:
1. One inside `AgentSection` (centered, under the ORCHESTRA logo) — this is the **correct** one for the initial page
2. One inside `ChatComposer` (at the bottom, with Sandbox/Files toolbar) — this should **not** appear on the initial empty state

The previous (wrong) fix removed ChatInput from AgentSection. The correct fix is the opposite: keep the centered ChatInput in AgentSection and remove ChatComposer from the no-messages initial state.

## Step 1: Revert agent-section.tsx changes

### File: `frontend/src/components/sections/agent-section.tsx`
- Re-add `ChatInput` import
- Re-add `showAgentMenu` to `AgentSectionProps` interface
- Re-add the `ChatInput` wrapper div after the links section

### File: `frontend/src/pages/chat/ChatPanel.tsx` (line 41)
- Re-add `showAgentMenu={showAgentMenu}` prop to `<AgentSection>`

## Step 2: Remove ChatComposer from the no-messages state

### File: `frontend/src/pages/chat/ChatPanel.tsx` (lines 36-48)
Remove the `<ChatComposer>` from the first `if` block (no-messages state). The block should become:
```tsx
if (agent && messages.length === 0 && viewMode === "chat") {
    return (
        <ChatLayout>
            {chatNav}
            <div className="flex-1 flex flex-col items-center justify-center bg-background p-6">
                <AgentSection agent={agent} showAgentMenu={showAgentMenu} />
            </div>
        </ChatLayout>
    );
}
```

## Step 3: Update test

### File: `frontend/src/pages/chat/ChatPanel.test.tsx` (lines 137-163)
Update the "renders ChatComposer on first-load" test to reflect the new behavior:
- ChatComposer should **not** be in the document on the initial empty state
- AgentSection should still be present
- Rename the test to reflect it tests the initial empty state without ChatComposer

## Verification
1. `cd frontend && npm run test` — ensure tests pass
2. Navigate to `/chat` — confirm only one centered ChatInput appears (from AgentSection), no bottom ChatComposer
3. Send a message — confirm ChatComposer appears once messages exist
