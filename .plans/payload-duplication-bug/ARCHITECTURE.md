# Payload Duplication Bug - Architecture & Data Flow Analysis

## Data Flow Comparison

### Current State (Broken) - Live Streaming

```
┌──────────────────────────────────────────────────────────────────┐
│                          USER SUBMITS QUERY                       │
└─────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    frontend/src/hooks/useChat.ts                  │
│                          handleSubmit()                           │
├──────────────────────────────────────────────────────────────────┤
│  1. Create userMessage                                           │
│  2. Append to messages array                                     │
│  3. Call handleSSE()                                             │
└─────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                         streamThread() API                        │
│              Backend SSE Stream to Frontend                       │
└─────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    SSE Event Handler (useChat)                    │
│                       handleMessages()                            │
├──────────────────────────────────────────────────────────────────┤
│  payload[0] === "messages"                                       │
│  response = payload[1][0]                                        │
└─────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│              frontend/src/lib/utils/message.ts                    │
│                    StreamMessageHandler                           │
├──────────────────────────────────────────────────────────────────┤
│  processResponse(response, expectedContent, existingIndex)       │
│  ├─ If tool_call_chunks: toolCall()                             │
│  │  └─ toolCallChunkRef.current += args  ⚠️ ACCUMULATION        │
│  └─ If content: messageCreate() or messageUpdate()              │
└─────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    ❌ NO NORMALIZATION HERE ❌                    │
│                setMessagesState(streamHandler.history)            │
│                                                                   │
│  Result: Raw messages with accumulated state                     │
│          - toolCallChunkRef persists across tool calls           │
│          - Input objects not properly isolated                   │
│          - Messages may have inappropriate 'input' fields        │
└─────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│          frontend/src/components/lists/ChatMessages.tsx           │
│                      Message Rendering                            │
├──────────────────────────────────────────────────────────────────┤
│  if ("input" in message)  ⚠️ NO TYPE CHECK                       │
│    return <DefaultTool ... />                                    │
│                                                                   │
│  Result: Renders accumulated payloads from all previous queries  │
└──────────────────────────────────────────────────────────────────┘
```

---

### Current State (Working) - Checkpoint Reload

```
┌──────────────────────────────────────────────────────────────────┐
│                    USER REFRESHES & SELECTS THREAD                │
└─────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                   frontend/src/hooks/useThread.ts                 │
│                          loadThread()                             │
├──────────────────────────────────────────────────────────────────┤
│  1. Fetch checkpoints from API                                   │
│  2. Extract checkpoint data                                      │
└─────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                   ✅ NORMALIZATION APPLIED ✅                     │
│        const messages = formatMessages(checkpointData)           │
│                                                                   │
│  frontend/src/lib/utils/format.ts:formatMessages()              │
│  ├─ User messages: Remove 'input' field                         │
│  ├─ AI with tool_calls: Create clean 'input' from tool_calls    │
│  └─ AI without tool_calls: Remove 'input' field                 │
│                                                                   │
│  Result: Clean, isolated messages                                │
│          - Each message has appropriate fields only              │
│          - Input properly scoped to tool-related messages        │
│          - No accumulation                                       │
└─────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    setMessages(normalized)                        │
└─────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│          frontend/src/components/lists/ChatMessages.tsx           │
│                      Message Rendering                            │
├──────────────────────────────────────────────────────────────────┤
│  if ("input" in message)                                         │
│    return <DefaultTool ... />                                    │
│                                                                   │
│  Result: Clean display - each query shows only its own payload   │
└──────────────────────────────────────────────────────────────────┘
```

---

### Proposed Solution - Fixed Live Streaming

```
┌──────────────────────────────────────────────────────────────────┐
│                          USER SUBMITS QUERY                       │
└─────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    frontend/src/hooks/useChat.ts                  │
│                          handleSubmit()                           │
└─────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                         streamThread() API                        │
└─────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    SSE Event Handler (useChat)                    │
│                       handleMessages()                            │
└─────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│              frontend/src/lib/utils/message.ts                    │
│                    StreamMessageHandler                           │
│                   (WITH FIX: Phase 2)                            │
├──────────────────────────────────────────────────────────────────┤
│  processResponse(response, expectedContent, existingIndex)       │
│  ├─ If tool_call_chunks: toolCall()                             │
│  │  ├─ 🔧 NEW: if (existingIndex === -1) reset refs             │
│  │  └─ toolCallChunkRef.current += args  ✅ ISOLATED            │
│  └─ If content: messageCreate() or messageUpdate()              │
└─────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    ✅ NEW: NORMALIZATION ADDED ✅                 │
│         const normalized = formatMessages(history)               │
│              setMessagesState(normalized)                         │
│                                                                   │
│  Same normalization as checkpoint reload!                        │
│  frontend/src/lib/utils/format.ts:formatMessages()              │
│  ├─ User messages: Remove 'input' field                         │
│  ├─ AI with tool_calls: Create clean 'input' from tool_calls    │
│  └─ AI without tool_calls: Remove 'input' field                 │
│                                                                   │
│  Result: Clean, isolated messages (consistent with checkpoint)   │
└─────────────────────────────┬────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│          frontend/src/components/lists/ChatMessages.tsx           │
│                  (WITH FIX: Phase 3)                             │
├──────────────────────────────────────────────────────────────────┤
│  🔧 NEW: if ("input" in message &&                               │
│           ["tool", "AIMessageChunk"].includes(message.type))     │
│    return <DefaultTool ... />                                    │
│                                                                   │
│  Result: Type-safe rendering, defensive guard                    │
└──────────────────────────────────────────────────────────────────┘
```

---

## Message State Transformation

### Before formatMessages() (Raw Streaming Data)

```typescript
// Query 1 response:
[
  { id: "1", type: "user", content: "query 1", model: "gpt-4" },
  {
    id: "2",
    type: "ai",
    content: "",
    tool_calls: [{ name: "search", args: { query: "test1" } }],
    input: { query: "test1" }  // Added by StreamMessageHandler
  },
  { id: "3", type: "tool", name: "search", content: "result1" },
  { id: "4", type: "ai", content: "Response 1" }
]

// Query 2 response (BROKEN - accumulated):
[
  ... (messages from Query 1) ...,
  { id: "5", type: "user", content: "query 2", model: "gpt-4" },
  {
    id: "6",
    type: "ai",
    content: "",
    tool_calls: [{ name: "search", args: { query: "test2" } }],
    input: {
      query: "test1test2"  // ⚠️ ACCUMULATED from toolCallChunkRef
    }
  },
  { id: "7", type: "tool", name: "search", content: "result2" },
  { id: "8", type: "ai", content: "Response 2" }
]
```

### After formatMessages() (Normalized Data)

```typescript
// Query 1 response:
[
  { id: "1", type: "user", content: "query 1", model: "gpt-4", role: "user" },
  // ✅ No 'input' on user message
  {
    id: "2",
    type: "ai",
    content: "",
    tool_calls: [{ name: "search", args: { query: "test1" } }],
    role: "AIMessageChunk",
    input: [{ query: "test1" }]  // ✅ Clean extraction from tool_calls
  },
  { id: "3", type: "tool", name: "search", content: "result1", role: "tool" },
  { id: "4", type: "ai", content: "Response 1", role: "assistant" }
  // ✅ No 'input' on assistant message
]

// Query 2 response (FIXED):
[
  ... (normalized messages from Query 1) ...,
  { id: "5", type: "user", content: "query 2", model: "gpt-4", role: "user" },
  // ✅ No 'input' on user message
  {
    id: "6",
    type: "ai",
    content: "",
    tool_calls: [{ name: "search", args: { query: "test2" } }],
    role: "AIMessageChunk",
    input: [{ query: "test2" }]  // ✅ ISOLATED - only test2, not accumulated
  },
  { id: "7", type: "tool", name: "search", content: "result2", role: "tool" },
  { id: "8", type: "ai", content: "Response 2", role: "assistant" }
  // ✅ No 'input' on assistant message
]
```

---

## Component Hierarchy

```
ChatPage
  │
  ├─ ChatInput
  │    └─ Calls: handleSubmit(query)
  │
  └─ ChatMessages  ← Receives: messages[] from useChat
       │
       ├─ Virtualizer (TanStack Virtual)
       │
       └─ For each message:
            │
            ├─ if (type === "user" || "human")
            │    └─ UserMessageBubble
            │
            ├─ if ("input" in message)  ⚠️ ISSUE HERE
            │    └─ DefaultTool
            │         └─ JsonView (renders message.input)
            │
            ├─ if (type === "tool")
            │    └─ ToolTimeline
            │
            └─ if (type === "ai" || "assistant")
                 └─ AIMessageBubble
                      └─ MarkdownCard
```

**Problem**: The condition `if ("input" in message)` doesn't validate message type, so any message with an `input` property gets rendered as a tool message.

**Fix**: Add type guard: `if ("input" in message && ["tool", "AIMessageChunk"].includes(message.type))`

---

## State Management Flow

```
Module Scope (useChat.ts)
┌────────────────────────────────────────────┐
│  let in_mem_messages: any[] = [];          │ ⚠️ Persists across renders
└────────────────────────────────────────────┘
                   │
                   ▼
React Component Scope (ChatContext)
┌────────────────────────────────────────────┐
│  const [messages, setMessagesState] = ...  │
└────────────────────────────────────────────┘
                   │
                   ▼
Custom setMessages() Function
┌────────────────────────────────────────────┐
│  const setMessages = (newMessages) => {    │
│    in_mem_messages = [...newMessages];    │ ← Updates module state
│    setMessagesState(newMessages);         │ ← Updates React state
│  }                                         │
└────────────────────────────────────────────┘
                   │
                   ▼
handleMessages() receives: in_mem_messages as history
┌────────────────────────────────────────────┐
│  StreamMessageHandler(                     │
│    toolNameRef,      ← Ref, persists      │
│    toolCallChunkRef, ← Ref, persists ⚠️   │
│    history           ← in_mem_messages     │
│  )                                         │
└────────────────────────────────────────────┘
```

**Issue**: `toolCallChunkRef` is a React ref that persists across renders and never resets, causing accumulation.

**Fix**: Reset refs when processing a new tool call (new message ID).

---

## formatMessages() Logic Diagram

```
Input: messages[]
      │
      ▼
For each message:
      │
      ├─ type === "user" || "human"?
      │  └─ YES → { ...message, role: "user" }
      │           ✅ No 'input' field
      │
      ├─ type === "ai" && has tool_calls?
      │  └─ YES → {
      │             ...message,
      │             role: "AIMessageChunk",
      │             input: tool_calls.map(tc => tc.args)  ← Clean extraction
      │           }
      │
      ├─ type === "tool"?
      │  └─ YES → { ...message, role: "tool" }
      │
      └─ type === "ai" && NO tool_calls?
         └─ YES → { ...message, role: "assistant" }
                  ✅ No 'input' field
      │
      ▼
Output: normalized messages[]
```

**Key Behavior**:
- Only AI messages **with** `tool_calls` get an `input` field
- User and regular AI messages **never** have `input`
- Input is created fresh from `tool_calls`, not accumulated

---

## Timeline of Events (Broken Flow)

```
Time  Event                           State
──────────────────────────────────────────────────────────────
t0    Page load                       messages = []
                                      toolCallChunkRef = ""

t1    User submits "query 1"          messages = [userMsg1]

t2    SSE: AI response with           toolCallChunkRef = ""
      tool_call_chunks[0].args        + '{"query":"test1"}'
                                      = '{"query":"test1"}'

t3    Tool call processed             messages = [
                                        userMsg1,
                                        aiMsg1 { input: {query:"test1"} }
                                      ]

t4    SSE: Tool result                messages = [
                                        userMsg1,
                                        aiMsg1,
                                        toolMsg1
                                      ]

t5    SSE: Final AI response          messages = [
                                        userMsg1,
                                        aiMsg1,
                                        toolMsg1,
                                        aiMsg2
                                      ]
      ⚠️ toolCallChunkRef NOT RESET   toolCallChunkRef = '{"query":"test1"}'

t6    User submits "query 2"          messages = [...prev, userMsg2]

t7    SSE: AI response with           toolCallChunkRef = '{"query":"test1"}'
      tool_call_chunks[0].args        + '{"query":"test2"}'
                                      = '{"query":"test1"}{"query":"test2"}'
                                      ⚠️ ACCUMULATED!

t8    Tool call processed             messages = [...prev,
                                        aiMsg3 {
                                          input: '{"query":"test1"}{"query":"test2"}'
                                        }
                                      ]
                                      ⚠️ BROKEN JSON, accumulated payload
```

---

## Timeline of Events (Fixed Flow)

```
Time  Event                           State
──────────────────────────────────────────────────────────────
t0    Page load                       messages = []
                                      toolCallChunkRef = ""

t1    User submits "query 1"          messages = [userMsg1]

t2    SSE: AI response with           NEW: Check if new tool call
      tool_call_chunks               existingIndex = -1 (new)
                                      ✅ RESET: toolCallChunkRef = ""

                                      toolCallChunkRef = ""
                                      + '{"query":"test1"}'
                                      = '{"query":"test1"}'

t3    Tool call processed             raw_messages = [
                                        userMsg1,
                                        aiMsg1 { input: {query:"test1"} }
                                      ]

                                      ✅ NORMALIZE:
                                      normalized = formatMessages(raw_messages)

                                      messages = [
                                        { ...userMsg1, role:"user" },
                                        { ...aiMsg1, role:"AIMessageChunk",
                                          input: [{query:"test1"}] }
                                      ]

t4    SSE: Tool result                messages = [...prev, toolMsg1]
                                      (after normalization)

t5    SSE: Final AI response          messages = [...prev, aiMsg2]
                                      (after normalization)

t6    User submits "query 2"          messages = [...prev, userMsg2]

t7    SSE: AI response with           NEW: Check if new tool call
      tool_call_chunks               existingIndex = -1 (new)
                                      ✅ RESET: toolCallChunkRef = ""

                                      toolCallChunkRef = ""
                                      + '{"query":"test2"}'
                                      = '{"query":"test2"}'
                                      ✅ ISOLATED - no accumulation!

t8    Tool call processed             raw_messages = [...prev,
                                        aiMsg3 { input: {query:"test2"} }
                                      ]

                                      ✅ NORMALIZE:
                                      normalized = formatMessages(raw_messages)

                                      messages = [...prev,
                                        { ...aiMsg3, role:"AIMessageChunk",
                                          input: [{query:"test2"}] }
                                      ]
                                      ✅ CLEAN - only test2, not accumulated!
```

---

## Summary

The architecture reveals three issues working together:

1. **Primary**: `formatMessages()` not applied to streaming data
2. **Secondary**: `toolCallChunkRef` never reset between tool calls
3. **Tertiary**: Component rendering lacks type validation

The fix addresses all three with minimal changes:
- **Phase 1**: Add normalization (1 line)
- **Phase 2**: Reset refs (4 lines)
- **Phase 3**: Add type guard (1 line)

Total: **6 lines of code** to fix the entire issue.
