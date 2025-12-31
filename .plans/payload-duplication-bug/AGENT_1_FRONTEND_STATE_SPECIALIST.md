# AGENT 1: Frontend State Management Specialist

## Agent Identity
**Role**: React State Management & Data Flow Expert
**Specialization**: Frontend state lifecycle, React hooks, component re-rendering, and data persistence
**Focus Area**: Client-side state management and UI data flow

## Problem Analysis

### Issue Summary
In **Image 1** (when a query is JUST sent), the payloads are being appended to the input **for the entire session**. This creates a cumulative duplication where each new query includes all previous payloads from the session.

In **Image 2** (after page refresh and thread selection), the payloads display correctly, showing only the relevant data for each individual query.

### Root Cause Hypothesis
The issue manifests in the **frontend state management layer**, specifically:

1. **State Accumulation**: The `input` objects containing tool call payloads are being accumulated in a session-scoped state variable rather than being reset per message
2. **Message Formatting Logic**: The message display component is rendering accumulated state rather than extracting per-message payload data
3. **State Reset Gap**: When a new query is submitted, previous input/payload state is not being cleared before appending new data

### Evidence from Code Review

#### Critical Files Analyzed

**1. [frontend/src/hooks/useChat.ts](frontend/src/hooks/useChat.ts)**
- Lines 12-13: Module-level state `let in_mem_messages: any[] = [];` persists across component lifecycles
- Lines 78-81: `setMessages` function updates both module state and React state simultaneously
- Lines 128-141: `handleSSE` creates user messages and appends to existing messages array
- Lines 150-167: Payload construction for `streamThread` includes input with messages
- Lines 243-261: `clearMessages` function resets state but may not be called appropriately

**Key Finding**: The `in_mem_messages` module-level variable maintains state across multiple queries within a session, which could be contributing to payload accumulation.

**2. [frontend/src/components/lists/ChatMessages.tsx](frontend/src/components/lists/ChatMessages.tsx:162-169)**
```typescript
if ("input" in message) {
    return (
        <div className="group px-3 md:px-5">
            <div className="max-w-[90vw] md:max-w-[80%] px-2 rounded-lg rounded-bl-sm">
                <DefaultTool selectedToolMessage={message} collapsed={false} />
            </div>
        </div>
    );
}
```
**Issue**: Messages with `"input"` property are rendered as tool messages, showing whatever is in `message.input` without validation or scoping.

**3. [frontend/src/components/tools/Default.tsx](frontend/src/components/tools/Default.tsx:19-22)**
```typescript
const input =
    selectedToolMessage.args ||
    selectedToolMessage.input ||
    selectedToolMessage.content;
```
**Issue**: The component attempts multiple fallback properties, which could be picking up accumulated state from `selectedToolMessage.input`.

#### State Flow Analysis

```
User submits query
    ↓
handleSubmit() called
    ↓
handleSSE() creates userMessage with model/content
    ↓
updatedMessages = [...messages, userMessage]  // ← Appends to existing
    ↓
setMessages(updatedMessages)  // ← Updates both in_mem_messages and React state
    ↓
streamThread() called with formattedMessages
    ↓
SSE events arrive → sseHandler → handleMessages
    ↓
Messages rendered including "input" objects
```

**Problem**: Each submission accumulates onto `messages` array, and if `"input"` objects are being attached to messages (likely from backend response), they persist and compound across queries.

### Why Refresh Fixes It

When the page refreshes and a thread is loaded:

**[frontend/src/hooks/useThread.ts](frontend/src/hooks/useThread.ts:70-133)**
- Line 113: `const messages = formatMessages(checkpointsData[0].values.messages);`
- The thread is loaded fresh from backend checkpoint data
- Messages are reformatted via `formatMessages()` utility
- Module-level `in_mem_messages` is reset to empty array on page load
- No accumulated session state carries over

## Technical Investigation Required

### 1. Message Structure Audit
**Objective**: Identify where `"input"` property is being attached to messages

**Tasks**:
- [ ] Add console logging to track message objects before/after SSE events
- [ ] Inspect `handleMessages` function (lines 263-368) to see how payload data attaches to messages
- [ ] Verify StreamMessageHandler class behavior in processing responses
- [ ] Check backend response structure for unexpected `input` fields

### 2. State Lifecycle Analysis
**Objective**: Map the complete lifecycle of message state from submission to render

**Tasks**:
- [ ] Trace `in_mem_messages` mutations throughout chat session
- [ ] Verify `setMessages` is properly synchronizing module and React state
- [ ] Identify if any component is modifying message objects after initial creation
- [ ] Check for unintended shallow copies creating shared references

### 3. Payload Accumulation Detection
**Objective**: Determine exact mechanism causing payload duplication

**Tasks**:
- [ ] Add state snapshots before/after each query submission
- [ ] Compare message structures between first query and subsequent queries
- [ ] Identify if `input` objects are being mutated or recreated
- [ ] Check if SSE event handlers are appending vs replacing data

## Proposed Solution Strategy

### Phase 1: Immediate Diagnostic Instrumentation
```typescript
// Add to useChat.ts handleSubmit
const handleSubmit = async (argQuery?: string, images: File[] = []) => {
    console.log('[DEBUG] Pre-submit messages:', JSON.parse(JSON.stringify(messages)));
    console.log('[DEBUG] Pre-submit in_mem_messages:', JSON.parse(JSON.stringify(in_mem_messages)));

    // ... existing code ...

    console.log('[DEBUG] Post-submit messages:', JSON.parse(JSON.stringify(messages)));
};
```

### Phase 2: State Isolation
**Option A: Reset input state per query**
```typescript
// Before creating userMessage in handleSSE
const userMessage = {
    id: `user-${Date.now()}`,
    model: agent.model,
    content: query,
    role: "user",
    type: "user",
    // Explicitly exclude input to prevent accumulation
};
```

**Option B: Filter messages before rendering**
```typescript
// In ChatMessages.tsx, sanitize messages before display
const sanitizedMessages = messages.map(msg => {
    if (msg.type === 'user' || msg.type === 'human') {
        const { input, ...rest } = msg;
        return rest;
    }
    return msg;
});
```

**Option C: Scope input objects per message**
```typescript
// Ensure each message's input is isolated and not shared references
if ("input" in message && message.id) {
    // Only render input for this specific message, not accumulated
    const messageInput = extractInputForMessage(message.id, allInputs);
    return <DefaultTool selectedToolMessage={{ input: messageInput }} />;
}
```

### Phase 3: Message State Refactoring

**Recommended Approach**:
1. Separate user input messages from tool call messages more explicitly
2. Ensure `input` property is only present on tool-related messages
3. Add message type guards to prevent cross-contamination
4. Implement proper cleanup in `clearContent()` or add a `resetInputState()` function

### Phase 4: Validation & Testing

**Test Cases**:
- [ ] Submit single query → verify no duplicate payloads
- [ ] Submit multiple queries in sequence → verify each shows only its own payload
- [ ] Switch threads mid-session → verify state isolation
- [ ] Refresh and reload thread → verify consistency with live session
- [ ] Test with different tool types → verify payload structure

## Implementation Checklist

- [ ] Add diagnostic logging to track message state mutations
- [ ] Identify exact source of `input` property attachment to messages
- [ ] Determine if issue is in message creation, SSE handling, or rendering
- [ ] Implement state isolation fix (choose Option A, B, or C above)
- [ ] Add guards to prevent payload accumulation
- [ ] Ensure `clearMessages` properly resets all relevant state
- [ ] Add unit tests for message state management
- [ ] Add integration tests for multi-query sessions
- [ ] Verify fix doesn't break thread loading/refresh behavior
- [ ] Document message structure contract for future maintainers

## Success Criteria

✅ **Fixed State**: Each query displays only its own payload data
✅ **No Accumulation**: Subsequent queries don't inherit previous payloads
✅ **Consistency**: Live session behavior matches refresh/reload behavior
✅ **No Regressions**: Thread loading, switching, and refresh still work correctly
✅ **Clean State**: Module-level state properly scoped or eliminated

## Dependencies & Coordination

**Requires coordination with**:
- **Agent 2 (Backend API Specialist)**: Verify backend is not sending accumulated payloads
- **Agent 3 (Data Serialization Specialist)**: Ensure message format utilities aren't causing duplication

**Provides to other agents**:
- Frontend state flow documentation
- Message structure contracts
- State management patterns and pitfalls

## Notes & Observations

- The `in_mem_messages` module-level state is a potential anti-pattern that could be causing cross-component pollution
- Consider migrating to pure React state or Context API for better isolation
- The fallback property pattern in DefaultTool (`args || input || content`) might mask underlying structural issues
- Message type checking (`"input" in message`) is fragile and should be replaced with explicit type guards

## Risk Assessment

**High Risk Areas**:
- Changing message structure could break existing features
- Module-level state removal requires careful migration
- SSE event handling is complex and error-prone

**Mitigation Strategy**:
- Use feature flags for incremental rollout
- Maintain backward compatibility during transition
- Add extensive logging before making changes
- Test thoroughly with real backend data
