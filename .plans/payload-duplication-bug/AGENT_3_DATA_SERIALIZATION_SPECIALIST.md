# AGENT 3: Data Serialization & Message Format Specialist

## Agent Identity
**Role**: Data Transformation & Message Format Expert
**Specialization**: Message serialization, data structure mapping, format conversion, and cross-boundary data integrity
**Focus Area**: Data transformation layer between backend streaming and frontend rendering

## Problem Analysis

### Issue Summary
The UI displays duplicated/accumulated payload data during live sessions (**Image 1**) but shows correct data after page refresh (**Image 2**). This discrepancy suggests a **serialization or transformation mismatch** between:

1. **Real-time streaming data format** → Frontend state
2. **Persisted checkpoint format** → Frontend state

### Root Cause Hypothesis
The issue likely stems from:

1. **Asymmetric serialization**: Live stream messages are serialized differently than checkpoint messages
2. **Format conversion gaps**: Utility functions like `formatMessages`, `formatContent`, or `formatMultimodalPayload` may be duplicating or incorrectly merging data
3. **Data structure normalization**: Missing or inconsistent normalization between different message sources
4. **Shallow vs deep copies**: Shared object references causing mutation side effects

### Evidence from Frontend Code

#### Critical Serialization Functions

**1. Format Utilities Location**
Based on imports from [frontend/src/components/lists/ChatMessages.tsx](frontend/src/components/lists/ChatMessages.tsx):
```typescript
import { formatContent } from "@/lib/utils/format";
```

From [frontend/src/hooks/useChat.ts](frontend/src/hooks/useChat.ts):
```typescript
import { formatContent, formatMultimodalPayload } from "@/lib/utils/format";
```

From [frontend/src/hooks/useThread.ts](frontend/src/hooks/useThread.ts):
```typescript
import { formatMessages } from "@/lib/utils/format";
```

**Key Files**:
- `frontend/src/lib/utils/format.ts` (or `.tsx`) - Primary serialization utilities
- `frontend/src/lib/utils/message.ts` - Message processing utilities
- `frontend/src/lib/services/threadService.ts` - Thread data fetching

#### Data Flow Through Serialization Layer

**Live Streaming Flow**:
```
Backend SSE Event
    ↓
JSON.parse(e.data)
    ↓
sseHandler(payload, in_mem_messages)
    ↓
handleMessages(payload, history)
    ↓
StreamMessageHandler.processResponse()
    ↓
setMessages(streamHandler.history)  ← Messages to state
    ↓
ChatMessages renders messages
    ↓
formatContent(message.content)  ← Display formatting
    ↓
DefaultTool renders message.input
```

**Thread Reload Flow**:
```
Load thread from backend
    ↓
checkpointsData from API
    ↓
formatMessages(checkpointsData[0].values.messages)  ← KEY DIFFERENCE
    ↓
setMessages(messages)
    ↓
ChatMessages renders messages
    ↓
formatContent(message.content)
    ↓
DefaultTool renders message.input
```

**Critical Difference**: `formatMessages()` is called on checkpoint data but NOT on streaming data!

### Investigation Focus Areas

#### 1. Message Formatting Asymmetry

**Hypothesis**: `formatMessages()` normalizes/cleans data in a way that removes duplicates, but streaming data bypasses this normalization.

**Tasks**:
- [ ] Analyze `formatMessages()` implementation
- [ ] Check if it filters or deduplicates input objects
- [ ] Verify if it restructures message objects
- [ ] Compare output of `formatMessages()` vs raw streaming messages

#### 2. StreamMessageHandler Analysis

**From** [frontend/src/hooks/useChat.ts:353-362](frontend/src/hooks/useChat.ts):
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

**Tasks**:
- [ ] Find `StreamMessageHandler` class definition (likely in `@/lib/utils/message`)
- [ ] Analyze `processResponse()` method
- [ ] Check if it's mutating message objects
- [ ] Verify if it's creating proper deep copies
- [ ] Look for accumulation logic in history management

#### 3. Payload Construction Analysis

**From** [frontend/src/hooks/useChat.ts:143-154](frontend/src/hooks/useChat.ts):
```typescript
const formatedMessages = await formatMultimodalPayload(query, images);
const enrichedMetadata = getMetadata();
const filesToSubmit: Record<string, any> = {};
filesMap.forEach((files) => {
    Object.assign(filesToSubmit, files);
});
const source = streamThread({
    system_prompt: agent.prompt,
    input: {
        messages: formatedMessages,
        ...(Object.keys(filesToSubmit).length > 0 && { files: filesToSubmit }),
    },
    // ...
});
```

**Questions**:
- Does `formatMultimodalPayload()` properly isolate each message's data?
- Is `filesToSubmit` accumulating data across queries?
- Does the `input` object structure match backend expectations?

## Technical Investigation Required

### 1. Format Utilities Deep Dive

**Objective**: Understand all message transformation functions

**Files to Analyze**:
```
frontend/src/lib/utils/format.ts
frontend/src/lib/utils/message.ts
frontend/src/lib/services/threadService.ts
```

**Tasks**:
- [ ] Document `formatMessages()` - what does it do?
- [ ] Document `formatContent()` - is it just string formatting or does it transform structure?
- [ ] Document `formatMultimodalPayload()` - how does it build message payloads?
- [ ] Check for any filtering, deduplication, or normalization logic
- [ ] Verify deep vs shallow copying behavior

**Expected Patterns**:
```typescript
// formatMessages might be doing something like:
export function formatMessages(rawMessages: any[]): Message[] {
    return rawMessages.map(msg => ({
        id: msg.id,
        type: msg.type,
        content: msg.content,
        // Explicitly extract only needed fields, filtering out accumulated data
    }));
}
```

### 2. Message Object Structure Audit

**Objective**: Define the canonical message structure at each stage

**Tasks**:
- [ ] Document message structure from backend SSE
- [ ] Document message structure from checkpoint API
- [ ] Document message structure in `in_mem_messages`
- [ ] Document message structure in React state
- [ ] Document message structure passed to components
- [ ] Identify where `input` field is added/removed/duplicated

**Create Schema Documentation**:
```typescript
// Expected message schema
interface BaseMessage {
    id: string;
    type: 'user' | 'ai' | 'tool' | 'human' | 'assistant';
    content: string;
}

interface UserMessage extends BaseMessage {
    type: 'user' | 'human';
    model: string;
    // Should NOT have 'input' field
}

interface ToolMessage extends BaseMessage {
    type: 'tool';
    name: string;
    input: Record<string, any>;  // Only for tool messages
    output?: any;
}

interface AIMessage extends BaseMessage {
    type: 'ai' | 'assistant';
    model?: string;
    // Should NOT have 'input' field
}
```

### 3. Data Flow Trace

**Objective**: Track a single message through entire serialization pipeline

**Method**: Add comprehensive logging at each transformation point

```typescript
// In useChat.ts
const handleSSE = async (...) => {
    const userMessage = {
        id: `user-${Date.now()}`,
        model: agent.model,
        content: query,
        role: "user",
        type: "user",
    };
    console.log('[SERIALIZE] 1. User message created:', JSON.stringify(userMessage));

    const updatedMessages = [...messages, userMessage];
    console.log('[SERIALIZE] 2. Updated messages:', JSON.stringify(updatedMessages));

    const formatedMessages = await formatMultimodalPayload(query, images);
    console.log('[SERIALIZE] 3. Formatted for backend:', JSON.stringify(formatedMessages));
};

const handleMessages = (payload: any, history: any[]) => {
    console.log('[SERIALIZE] 4. Raw SSE payload:', JSON.stringify(payload));

    if (streamMode === "messages") {
        const response = payload[1][0];
        console.log('[SERIALIZE] 5. Extracted response:', JSON.stringify(response));

        streamHandler.processResponse(response, expectedContent, existingIndex);
        console.log('[SERIALIZE] 6. After StreamMessageHandler:', JSON.stringify(streamHandler.history));
    }
};
```

### 4. Reference vs Copy Analysis

**Objective**: Identify unintended object mutation through shared references

**Tasks**:
- [ ] Check if message objects are properly deep-copied
- [ ] Verify `in_mem_messages` and React state don't share references
- [ ] Ensure `filesMap` entries don't leak between messages
- [ ] Confirm `input` objects aren't being mutated after creation

**Test Pattern**:
```typescript
// Add to useChat.ts for testing
const testReferenceIsolation = () => {
    const msg1 = messages[0];
    const msg2 = in_mem_messages[0];
    console.log('Same reference?', msg1 === msg2); // Should be false

    if (msg1.input && msg2.input) {
        console.log('Input same reference?', msg1.input === msg2.input); // Should be false
    }
};
```

### 5. Checkpoint vs Stream Format Comparison

**Objective**: Document exact structural differences

**Tasks**:
- [ ] Capture raw checkpoint JSON from backend
- [ ] Capture raw SSE event JSON from backend
- [ ] Compare field-by-field
- [ ] Identify any extra/missing fields
- [ ] Check for nested structure differences

**Comparison Template**:
```typescript
// Checkpoint format (from backend/checkpoints)
{
    "id": "msg_123",
    "type": "ai",
    "content": "...",
    // What else?
}

// Streaming format (from SSE events)
{
    "id": "msg_123",
    "type": "ai",
    "content": "...",
    "input": {...},  // Is this extra?
    // What else?
}
```

## Proposed Solution Strategy

### Phase 1: Diagnostic Instrumentation

**Add comprehensive serialization logging**:

```typescript
// Create a serialization debugging utility
// frontend/src/lib/utils/serializationDebug.ts

export class SerializationTracer {
    private static logs: any[] = [];

    static trace(stage: string, data: any) {
        const snapshot = {
            timestamp: Date.now(),
            stage,
            data: JSON.parse(JSON.stringify(data)), // Deep copy
        };
        this.logs.push(snapshot);
        console.log(`[SERIALIZATION:${stage}]`, snapshot.data);
    }

    static compare(stage1: string, stage2: string) {
        const log1 = this.logs.find(l => l.stage === stage1);
        const log2 = this.logs.find(l => l.stage === stage2);

        if (log1 && log2) {
            const diff = deepDiff(log1.data, log2.data);
            console.log(`Diff between ${stage1} and ${stage2}:`, diff);
            return diff;
        }
    }

    static export() {
        return this.logs;
    }
}
```

### Phase 2: Normalize All Message Sources

**Create a unified message normalization function**:

```typescript
// frontend/src/lib/utils/messageNormalizer.ts

export interface NormalizedMessage {
    id: string;
    type: 'user' | 'ai' | 'tool' | 'human' | 'assistant';
    content: string;
    model?: string;
    // Tool-specific fields
    name?: string;
    input?: Record<string, any>;
    output?: any;
    // Metadata
    role?: string; // Legacy field
    created_at?: string;
}

export function normalizeMessage(raw: any): NormalizedMessage {
    const base = {
        id: raw.id,
        type: raw.type || raw.role, // Handle legacy
        content: raw.content || '',
    };

    // Only add input for tool messages
    if (base.type === 'tool' && raw.input) {
        return {
            ...base,
            name: raw.name,
            input: raw.input,
            output: raw.output,
        };
    }

    // User/AI messages should not have input
    if (['user', 'human'].includes(base.type)) {
        return {
            ...base,
            model: raw.model,
        };
    }

    if (['ai', 'assistant'].includes(base.type)) {
        return {
            ...base,
            model: raw.model,
        };
    }

    return base as NormalizedMessage;
}

export function normalizeMessages(messages: any[]): NormalizedMessage[] {
    return messages.map(normalizeMessage);
}
```

**Apply normalization consistently**:

```typescript
// In useChat.ts - handleMessages
const handleMessages = (payload: any, history: any[]) => {
    // ...
    if (streamMode === "messages") {
        const response = payload[1][0];

        // Normalize before processing
        const normalizedResponse = normalizeMessage(response);

        streamHandler.processResponse(normalizedResponse, expectedContent, existingIndex);

        // Normalize entire history before setting state
        setMessagesState(normalizeMessages(streamHandler.history));
    }
};

// In useThread.ts - loadThread
const messages = normalizeMessages(
    formatMessages(checkpointsData[0].values.messages)
);
```

### Phase 3: Fix formatMessages() Asymmetry

**Ensure streaming messages go through same processing**:

```typescript
// In useChat.ts
import { formatMessages } from "@/lib/utils/format";

const handleMessages = (payload: any, history: any[]) => {
    if (streamMode === "messages") {
        const response = payload[1][0];

        // Create temporary array with new message
        const tempHistory = [...history, response];

        // Apply same formatting as checkpoint reload
        const formattedHistory = formatMessages(tempHistory);

        // Extract the processed message
        const processedResponse = formattedHistory[formattedHistory.length - 1];

        // Continue with normalized message
        streamHandler.processResponse(processedResponse, expectedContent, existingIndex);
        setMessagesState(streamHandler.history);
    }
};
```

### Phase 4: Deep Copy Enforcement

**Prevent shared references**:

```typescript
// Utility for deep copying
import { cloneDeep } from 'lodash';

// In useChat.ts - setMessages
const setMessages = (newMessages: any[]) => {
    // Ensure complete isolation
    in_mem_messages = cloneDeep(newMessages);
    setMessagesState(cloneDeep(newMessages));
};

// In handleSSE
const userMessage = {
    id: `user-${Date.now()}`,
    model: agent.model,
    content: query,
    role: "user",
    type: "user",
    // Explicitly no input field
};

const updatedMessages = [...messages, cloneDeep(userMessage)];
```

### Phase 5: Input Field Scoping

**Ensure `input` only exists on appropriate messages**:

```typescript
// In ChatMessages.tsx
const Message = memo(function Message({ message, ... }) {
    // Guard against inappropriate input rendering
    if ("input" in message && !["tool"].includes(message.type)) {
        console.warn(`Unexpected 'input' field on ${message.type} message:`, message);
        // Strip it out
        const { input, ...cleanMessage } = message;
        message = cleanMessage;
    }

    if ("input" in message) {
        return (
            <div className="group px-3 md:px-5">
                <div className="max-w-[90vw] md:max-w-[80%] px-2 rounded-lg rounded-bl-sm">
                    <DefaultTool selectedToolMessage={message} collapsed={false} />
                </div>
            </div>
        );
    }

    // ... rest of component
});
```

## Implementation Checklist

- [ ] Locate and analyze all format utility functions
- [ ] Document message structure at each transformation stage
- [ ] Add serialization tracing/logging infrastructure
- [ ] Create message normalization utilities
- [ ] Apply normalization to both streaming and checkpoint flows
- [ ] Ensure deep copying where needed
- [ ] Add guards against inappropriate `input` fields
- [ ] Create message structure validation
- [ ] Add unit tests for normalization functions
- [ ] Add integration tests for data flow
- [ ] Document canonical message schemas
- [ ] Create migration guide if changing message structure

## Success Criteria

✅ **Consistent Serialization**: Same normalization applied to all message sources
✅ **No Reference Leaks**: All message objects properly isolated
✅ **Schema Compliance**: Messages conform to documented schemas
✅ **Format Symmetry**: Streaming and checkpoint messages structurally identical
✅ **Clean Input Fields**: `input` only present on tool messages

## Dependencies & Coordination

**Requires coordination with**:
- **Agent 1 (Frontend Specialist)**: Integrate normalization into state management
- **Agent 2 (Backend Specialist)**: Align on message schema contracts

**Provides to other agents**:
- Message normalization utilities
- Schema documentation
- Serialization debugging tools
- Format comparison analysis

## Files to Create/Modify

**New Files**:
- `frontend/src/lib/utils/messageNormalizer.ts` - Normalization functions
- `frontend/src/lib/utils/serializationDebug.ts` - Debugging utilities
- `frontend/src/types/messages.ts` - TypeScript message interfaces
- `frontend/src/tests/utils/messageNormalizer.test.ts` - Unit tests

**Files to Modify**:
- `frontend/src/hooks/useChat.ts` - Apply normalization
- `frontend/src/hooks/useThread.ts` - Apply normalization
- `frontend/src/lib/utils/format.ts` - Fix asymmetry
- `frontend/src/lib/utils/message.ts` - Update StreamMessageHandler
- `frontend/src/components/lists/ChatMessages.tsx` - Add guards

## Testing Strategy

### Unit Tests

```typescript
// frontend/src/tests/utils/messageNormalizer.test.ts
import { normalizeMessage, normalizeMessages } from '@/lib/utils/messageNormalizer';

describe('normalizeMessage', () => {
    it('should remove input from user messages', () => {
        const raw = {
            id: '1',
            type: 'user',
            content: 'hello',
            input: { query: 'test' }, // Should be removed
        };

        const result = normalizeMessage(raw);
        expect(result).not.toHaveProperty('input');
    });

    it('should preserve input for tool messages', () => {
        const raw = {
            id: '2',
            type: 'tool',
            name: 'search',
            content: '',
            input: { query: 'test' },
        };

        const result = normalizeMessage(raw);
        expect(result.input).toEqual({ query: 'test' });
    });

    it('should handle legacy role field', () => {
        const raw = {
            id: '3',
            role: 'human', // Legacy field
            content: 'hello',
        };

        const result = normalizeMessage(raw);
        expect(result.type).toBe('human');
    });
});
```

### Integration Tests

```typescript
// frontend/src/tests/hooks/useChat.test.ts
import { renderHook, act } from '@testing-library/react';
import useChat from '@/hooks/useChat';

describe('useChat message normalization', () => {
    it('should not accumulate input fields across queries', async () => {
        const { result } = renderHook(() => useChat());

        // First query
        await act(async () => {
            await result.current.handleSubmit('query 1');
        });

        const messages1 = result.current.messages;

        // Second query
        await act(async () => {
            await result.current.handleSubmit('query 2');
        });

        const messages2 = result.current.messages;

        // Check that user messages don't have input
        const userMessages = messages2.filter(m => m.type === 'user');
        userMessages.forEach(msg => {
            expect(msg).not.toHaveProperty('input');
        });
    });
});
```

## Risk Assessment

**High Risk Areas**:
- Changing message structure could break existing components
- Normalization might remove necessary data if not carefully designed
- Deep copying has performance implications for large message histories

**Mitigation Strategy**:
- Start with additive changes (normalization) before removing anything
- Add extensive validation to catch missing fields
- Benchmark performance impact of deep copying
- Use feature flags to enable normalization incrementally

## Notes & Observations

- The asymmetry between `formatMessages()` (used for checkpoints) and raw streaming data is likely the smoking gun
- Need to verify whether `StreamMessageHandler` is creating the duplication or just passing it through
- TypeScript interfaces would help enforce message structure contracts
- Consider using a state management library (Redux, Zustand) for better predictability
- The mix of `type` and `role` fields suggests legacy code that needs cleanup
