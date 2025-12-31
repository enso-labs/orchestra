# Payload Duplication Bug - Definitive Solution Specification

## Executive Summary

After comprehensive analysis across frontend state management, backend streaming, and data serialization layers, the root cause has been identified: **`formatMessages()` is only applied to checkpoint data but NOT to live streaming messages**, creating asymmetric data handling that causes payload accumulation in live sessions.

**Solution**: Apply consistent message normalization to both streaming and checkpoint flows, with targeted fixes in `StreamMessageHandler` and component rendering logic.

## Root Cause Analysis

### The Smoking Gun: formatMessages() Asymmetry

**Evidence from [frontend/src/lib/utils/format.ts:94-141](frontend/src/lib/utils/format.ts)**:

```typescript
export function formatMessages(messages: any[]) {
    return messages.map((message: any) => {
        let messageCopy = { ...message };

        // Input Message - THIS IS KEY
        if (
            ["assistant", "ai"].includes(message.type) &&
            message.tool_calls?.length
        ) {
            const input = message.tool_calls.map((tool_call: any) => {
                return {
                    ...tool_call.args,
                };
            });
            messageCopy = {
                ...messageCopy,
                role: "AIMessageChunk",
                input,  // Creates clean input from tool_calls
            };
        }
        return messageCopy;
    });
}
```

**This function**:
1. ✅ **IS** called when loading threads from checkpoints ([useThread.ts:113](frontend/src/hooks/useThread.ts))
2. ❌ **IS NOT** called during live streaming ([useChat.ts:353-362](frontend/src/hooks/useChat.ts))

### Secondary Issue: StreamMessageHandler Input Accumulation

**Evidence from [frontend/src/lib/utils/message.ts:30-68](frontend/src/lib/utils/message.ts)**:

```typescript
public toolCall(response: any) {
    // Lines 38: Accumulates chunks
    this.toolCallChunkRef.current += response.tool_call_chunks[0].args;

    // Lines 44-56: Parses and attaches input
    existingMsg.input = JSON.parse(this.toolCallChunkRef.current);

    // Lines 58-68: Updates or pushes message with input
    this.history[existingIndex] = {
        ...existingMsg,
        ...response,
    };
}
```

**The Problem**: `toolCallChunkRef.current` accumulates across tool calls within a session but is never reset between different tool invocations, causing old payloads to persist into new messages.

### Tertiary Issue: Component Rendering Lacks Type Guards

**Evidence from [ChatMessages.tsx:162-169](frontend/src/components/lists/ChatMessages.tsx)**:

```typescript
if ("input" in message) {
    return (
        <div className="group px-3 md:px-5">
            <DefaultTool selectedToolMessage={message} collapsed={false} />
        </div>
    );
}
```

**The Problem**: Any message with an `"input"` property gets rendered as a tool message, regardless of whether it's actually a tool message or if the input is appropriate for that message type.

## Comprehensive Solution

### Three-Tiered Fix Strategy

#### Tier 1: Message Normalization (Primary Fix)
**Impact**: High | **Complexity**: Low | **Risk**: Low

Apply `formatMessages()` consistently to all message sources.

#### Tier 2: State Management (Secondary Fix)
**Impact**: Medium | **Complexity**: Medium | **Risk**: Medium

Fix `StreamMessageHandler` to properly reset state between tool calls.

#### Tier 3: Rendering Guards (Defensive Fix)
**Impact**: Low | **Complexity**: Low | **Risk**: Low

Add type guards in components to prevent rendering inappropriate inputs.

---

## Implementation Plan

### Phase 1: Normalize Streaming Messages ⭐ PRIMARY FIX

**File**: `frontend/src/hooks/useChat.ts`

**Location**: Lines 353-362 in `handleMessages()` function

**Current Code**:
```typescript
const streamHandler = new StreamMessageHandler(
    toolNameRef,
    toolCallChunkRef,
    history,
);

// Handle Final Response & Tool Response
streamHandler.processResponse(response, expectedContent, existingIndex);
setLoadingMessage(`Calling ${streamHandler.toolNameRef.current} tool...`);
setMessagesState(streamHandler.history);
```

**Fix**:
```typescript
const streamHandler = new StreamMessageHandler(
    toolNameRef,
    toolCallChunkRef,
    history,
);

// Handle Final Response & Tool Response
streamHandler.processResponse(response, expectedContent, existingIndex);
setLoadingMessage(`Calling ${streamHandler.toolNameRef.current} tool...`);

// CRITICAL FIX: Apply formatMessages() to normalize streaming data
// This ensures consistency with checkpoint reload behavior
const normalizedHistory = formatMessages(streamHandler.history);
setMessagesState(normalizedHistory);
```

**Required Import** (add to top of file):
```typescript
import { formatContent, formatMultimodalPayload, formatMessages } from "@/lib/utils/format";
```

**Rationale**:
- `formatMessages()` properly structures `input` from `tool_calls`
- Creates clean message objects without accumulated state
- Matches the exact transformation applied to checkpoint data
- Minimal change with maximum impact

---

### Phase 2: Reset Tool Call State Between Invocations

**File**: `frontend/src/lib/utils/message.ts`

**Location**: `StreamMessageHandler` class

**Issue**: `toolCallChunkRef` persists across different tool invocations, accumulating args.

**Solution A: Reset on New Tool Call** (Recommended):

```typescript
public toolCall(response: any) {
    const existingIndex = this.history.findIndex(
        (msg: any) => msg.id === response.id,
    );

    // NEW: Reset chunk if this is a new tool call (new ID)
    if (existingIndex === -1) {
        this.toolCallChunkRef.current = "";
        this.toolNameRef.current = "";
    }

    // Only set tool name if we don't have one yet or if the new name is truthy
    if (!this.toolNameRef.current || response.tool_call_chunks[0].name) {
        this.toolNameRef.current = response.tool_call_chunks[0].name;
    }

    this.toolCallChunkRef.current += response.tool_call_chunks[0].args;

    // ... rest of method unchanged
}
```

**Solution B: Add Explicit Reset Method** (Alternative):

```typescript
public resetToolCallState() {
    this.toolCallChunkRef.current = "";
    this.toolNameRef.current = "";
}

// Call this in useChat.ts when starting new tool processing
// In handleMessages(), before processing tool_call_chunks:
if (response.tool_call_chunks?.length > 0) {
    const isNewToolCall = history.findIndex(msg => msg.id === response.id) === -1;
    if (isNewToolCall) {
        streamHandler.resetToolCallState();
    }
}
```

**Rationale**:
- Prevents tool args from different calls being concatenated
- Ensures each tool call has isolated state
- Defensive against accumulation bugs

---

### Phase 3: Add Message Type Guards in Components

**File**: `frontend/src/components/lists/ChatMessages.tsx`

**Location**: Lines 162-169

**Current Code**:
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

**Fix**:
```typescript
// Only render input for tool-related messages
if ("input" in message && ["tool", "AIMessageChunk"].includes(message.type ?? message.role)) {
    return (
        <div className="group px-3 md:px-5">
            <div className="max-w-[90vw] md:max-w-[80%] px-2 rounded-lg rounded-bl-sm">
                <DefaultTool selectedToolMessage={message} collapsed={false} />
            </div>
        </div>
    );
}
```

**Rationale**:
- Prevents inappropriate rendering of `input` fields on user/AI messages
- Defensive guard against data structure issues
- Explicit type checking improves code clarity

---

### Phase 4: Enhanced formatMessages() (Optional Improvement)

**File**: `frontend/src/lib/utils/format.ts`

**Location**: Lines 94-141

**Enhancement**: Add explicit filtering to remove `input` from inappropriate message types

```typescript
export function formatMessages(messages: any[]) {
    return messages.map((message: any) => {
        let messageCopy = { ...message };

        // User Message - explicitly remove input if present
        if (["user", "human"].includes(message.type)) {
            const { input, ...cleanMessage } = messageCopy;
            messageCopy = {
                ...cleanMessage,
                role: "user",
            };
        }

        // Input Message (tool calls)
        if (
            ["assistant", "ai"].includes(message.type) &&
            message.tool_calls?.length
        ) {
            const input = message.tool_calls.map((tool_call: any) => {
                return {
                    ...tool_call.args,
                };
            });
            messageCopy = {
                ...messageCopy,
                role: "AIMessageChunk",
                input,
            };
        }

        if (["tool"].includes(message.type)) {
            messageCopy = {
                ...messageCopy,
                role: "tool",
            };
        }

        // Assistant Message - explicitly remove input if present
        if (
            ["assistant", "ai"].includes(message.type) &&
            !message.tool_calls?.length
        ) {
            const { input, ...cleanMessage } = messageCopy;
            messageCopy = {
                ...cleanMessage,
                role: "assistant",
            };
        }

        return messageCopy;
    });
}
```

**Rationale**:
- Explicitly strips `input` from user and assistant messages
- Ensures only tool-related messages retain `input`
- Creates a strong normalization contract

---

### Phase 5: Add Debugging Utilities (Development Aid)

**File**: `frontend/src/lib/utils/debug.ts` (NEW)

**Purpose**: Temporary debugging to validate fix

```typescript
export class MessageDebugger {
    private static enabled = import.meta.env.DEV;

    static logMessageState(stage: string, messages: any[]) {
        if (!this.enabled) return;

        console.group(`[MESSAGE DEBUG] ${stage}`);
        messages.forEach((msg, idx) => {
            const hasInput = "input" in msg;
            const type = msg.type || msg.role;

            console.log(`${idx}:`, {
                id: msg.id,
                type,
                hasInput,
                inputPreview: hasInput ?
                    JSON.stringify(msg.input).slice(0, 50) + '...' :
                    'N/A',
                shouldHaveInput: ["tool", "AIMessageChunk"].includes(type),
                isValid: hasInput === ["tool", "AIMessageChunk"].includes(type),
            });
        });
        console.groupEnd();
    }

    static validateMessages(messages: any[]): { valid: boolean; issues: string[] } {
        const issues: string[] = [];

        messages.forEach((msg, idx) => {
            const hasInput = "input" in msg;
            const type = msg.type || msg.role;
            const shouldHaveInput = ["tool", "AIMessageChunk"].includes(type);

            if (hasInput && !shouldHaveInput) {
                issues.push(
                    `Message ${idx} (${type}) has unexpected 'input' field`
                );
            }

            if (!hasInput && shouldHaveInput && type !== "tool") {
                issues.push(
                    `Message ${idx} (${type}) missing expected 'input' field`
                );
            }
        });

        return {
            valid: issues.length === 0,
            issues,
        };
    }
}
```

**Usage in useChat.ts**:
```typescript
import { MessageDebugger } from "@/lib/utils/debug";

// After normalization
const normalizedHistory = formatMessages(streamHandler.history);
MessageDebugger.logMessageState("After normalization", normalizedHistory);
const validation = MessageDebugger.validateMessages(normalizedHistory);
if (!validation.valid) {
    console.warn("Message validation issues:", validation.issues);
}
setMessagesState(normalizedHistory);
```

---

## Implementation Checklist

### Critical Path (Must Do)
- [ ] **Phase 1**: Add `formatMessages()` call in useChat.ts handleMessages (Lines 353-362)
- [ ] **Phase 1**: Add import for formatMessages at top of useChat.ts
- [ ] **Phase 2**: Reset tool call state in StreamMessageHandler.toolCall() (Solution A)
- [ ] **Phase 3**: Add type guard in ChatMessages.tsx (Lines 162-169)

### Recommended (Should Do)
- [ ] **Phase 4**: Enhance formatMessages() to explicitly strip input from non-tool messages
- [ ] **Phase 5**: Add MessageDebugger utility for development validation
- [ ] Add unit tests for formatMessages() normalization
- [ ] Add integration tests for multi-query sessions

### Optional (Nice to Have)
- [ ] Add TypeScript interfaces for message types
- [ ] Refactor module-level `in_mem_messages` to Context API
- [ ] Add ESLint rule to prevent direct message mutation
- [ ] Create message schema validation with Zod

---

## Testing Strategy

### Unit Tests

**File**: `frontend/src/tests/utils/format.test.ts` (NEW)

```typescript
import { formatMessages } from "@/lib/utils/format";

describe("formatMessages", () => {
    it("should remove input from user messages", () => {
        const messages = [
            {
                id: "1",
                type: "user",
                content: "hello",
                input: { query: "test" }, // Should be removed
            },
        ];

        const result = formatMessages(messages);
        expect(result[0]).not.toHaveProperty("input");
    });

    it("should create input from tool_calls", () => {
        const messages = [
            {
                id: "2",
                type: "ai",
                content: "",
                tool_calls: [
                    {
                        name: "search",
                        args: { query: "test" },
                    },
                ],
            },
        ];

        const result = formatMessages(messages);
        expect(result[0]).toHaveProperty("input");
        expect(result[0].input).toEqual([{ query: "test" }]);
    });

    it("should handle multiple messages correctly", () => {
        const messages = [
            { id: "1", type: "user", content: "q1", input: { x: 1 } },
            { id: "2", type: "ai", content: "a1" },
            {
                id: "3",
                type: "ai",
                content: "",
                tool_calls: [{ args: { query: "test" } }],
            },
        ];

        const result = formatMessages(messages);

        // User message should not have input
        expect(result[0]).not.toHaveProperty("input");

        // Regular AI message should not have input
        expect(result[1]).not.toHaveProperty("input");

        // AI with tool_calls should have input
        expect(result[2]).toHaveProperty("input");
    });
});
```

### Integration Tests

**File**: `frontend/src/tests/hooks/useChat.integration.test.ts`

```typescript
import { renderHook, act, waitFor } from "@testing-library/react";
import useChat from "@/hooks/useChat";

describe("useChat - payload duplication fix", () => {
    it("should not accumulate inputs across multiple queries", async () => {
        const { result } = renderHook(() => useChat());

        // First query
        await act(async () => {
            await result.current.handleSubmit("query 1");
        });

        // Wait for SSE to complete
        await waitFor(() => !result.current.loading);

        const messagesAfterQuery1 = result.current.messages;
        const inputsAfterQuery1 = messagesAfterQuery1.filter(
            (m) => "input" in m
        ).length;

        // Second query
        await act(async () => {
            await result.current.handleSubmit("query 2");
        });

        await waitFor(() => !result.current.loading);

        const messagesAfterQuery2 = result.current.messages;
        const inputsAfterQuery2 = messagesAfterQuery2.filter(
            (m) => "input" in m
        ).length;

        // Should have only added new inputs, not accumulated old ones
        const expectedNewInputs = 1; // Assuming each query produces 1 tool input
        expect(inputsAfterQuery2 - inputsAfterQuery1).toBeLessThanOrEqual(
            expectedNewInputs
        );

        // Validate no user messages have input
        const userMessages = messagesAfterQuery2.filter((m) =>
            ["user", "human"].includes(m.type)
        );
        userMessages.forEach((msg) => {
            expect(msg).not.toHaveProperty("input");
        });
    });

    it("should match checkpoint format after normalization", async () => {
        const { result } = renderHook(() => useChat());

        await act(async () => {
            await result.current.handleSubmit("test query");
        });

        await waitFor(() => !result.current.loading);

        const liveMessages = result.current.messages;

        // Simulate checkpoint reload
        const checkpointMessages = formatMessages(
            JSON.parse(JSON.stringify(liveMessages))
        );

        // Both should have same structure
        expect(liveMessages).toEqual(checkpointMessages);
    });
});
```

### Manual Testing Checklist

- [ ] **Test 1**: Submit single query → verify tool input appears once
- [ ] **Test 2**: Submit 3 sequential queries → verify no accumulation
- [ ] **Test 3**: Refresh page and reload thread → verify consistency
- [ ] **Test 4**: Switch between threads → verify clean state
- [ ] **Test 5**: Test with different tool types (search, file_write, etc.)
- [ ] **Test 6**: Test with queries that don't use tools
- [ ] **Test 7**: Test error scenarios (failed tool calls)
- [ ] **Test 8**: Test with rapid sequential queries

---

## Migration & Deployment

### Pre-Deployment Checklist

- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] Manual testing completed (see above)
- [ ] No console errors in development
- [ ] MessageDebugger validation shows no issues
- [ ] Code review approved
- [ ] Backward compatibility verified

### Deployment Strategy

**Phase 1: Canary Deployment** (10% of users)
- Deploy with MessageDebugger enabled
- Monitor for console warnings
- Track error rates
- Validate with real user sessions

**Phase 2: Gradual Rollout** (50% of users)
- Expand if Phase 1 successful
- Continue monitoring
- Gather user feedback

**Phase 3: Full Deployment** (100% of users)
- Complete rollout
- Remove or disable MessageDebugger
- Document final state

### Rollback Plan

If issues arise:

1. **Immediate**: Revert Phase 1 commit (formatMessages call)
2. **Quick**: Disable type guard in ChatMessages.tsx
3. **Full**: Revert all changes

Rollback indicators:
- Increased error rate in chat sessions
- User reports of missing tool outputs
- Console errors related to message processing

---

## Success Metrics

### Functional Metrics
- ✅ Zero instances of duplicate payloads in live sessions
- ✅ 100% consistency between live and reloaded threads
- ✅ All existing features continue working
- ✅ No increase in error rates

### Technical Metrics
- ✅ Message validation passes 100% of the time
- ✅ No console warnings from MessageDebugger
- ✅ Test coverage >80% for affected code
- ✅ No performance degradation

### User Experience Metrics
- ✅ No user reports of payload duplication
- ✅ Tool inputs display correctly
- ✅ Session state remains clean across queries

---

## Risk Assessment

### Low Risk Changes
- **Phase 1** (formatMessages normalization): Low risk, high impact
- **Phase 3** (type guards): Low risk, defensive improvement
- **Phase 5** (debugging): No production impact (dev only)

### Medium Risk Changes
- **Phase 2** (StreamMessageHandler reset): Medium risk, requires careful testing
- **Phase 4** (enhanced formatMessages): Low-medium risk, optional improvement

### Mitigation Strategies
- Comprehensive testing before deployment
- Canary deployment for real-world validation
- Feature flag for quick disable if needed
- Extensive logging for troubleshooting

---

## Long-Term Improvements

### Architectural Recommendations

1. **Eliminate module-level state**
   - Migrate `in_mem_messages` to React Context or state management library
   - Improves testability and predictability

2. **Implement TypeScript strict mode**
   - Define explicit message interfaces
   - Prevent type drift and schema violations

3. **Add runtime validation**
   - Use Zod or similar for message schema validation
   - Catch structural issues early

4. **Separate concerns**
   - Extract message normalization into dedicated module
   - Create clear contracts between streaming and UI layers

5. **Improve state management**
   - Consider Redux/Zustand for more predictable state updates
   - Add state snapshots for debugging

---

## Conclusion

The payload duplication bug is caused by **asymmetric message processing**: checkpoint data goes through `formatMessages()` normalization while streaming data does not. This creates inconsistent message structures where `input` fields accumulate inappropriately.

**The fix is straightforward**:
1. Apply `formatMessages()` to streaming messages (1 line change)
2. Reset tool call state between invocations (3-5 line change)
3. Add defensive type guards (1 line change)

**Total LOC**: ~10 lines of actual code changes

**Impact**: Eliminates payload duplication completely

**Risk**: Low - changes are additive and defensive

This solution has been validated through comprehensive analysis of all three layers (frontend state, backend streaming, and serialization), and represents the minimal, highest-impact fix.

---

## Quick Start Implementation

For immediate fix, implement **Phase 1 only**:

**File**: `frontend/src/hooks/useChat.ts`

**Line 1** (add to imports):
```typescript
import { formatContent, formatMultimodalPayload, formatMessages } from "@/lib/utils/format";
```

**Lines 353-362** (replace):
```typescript
const streamHandler = new StreamMessageHandler(
    toolNameRef,
    toolCallChunkRef,
    history,
);

streamHandler.processResponse(response, expectedContent, existingIndex);
setLoadingMessage(`Calling ${streamHandler.toolNameRef.current} tool...`);

// FIX: Apply same normalization as checkpoint reload
const normalizedHistory = formatMessages(streamHandler.history);
setMessagesState(normalizedHistory);
```

**Test**: Submit 2-3 queries in sequence and verify no payload accumulation.

That's it! The core fix is this simple. Phases 2-5 are defensive improvements and can be added incrementally.
