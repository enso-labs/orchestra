# PROPOSAL_2.md

## Agent 2: The Data Flow Architect

**Focus**: How thread_id flows through the system and impacts StreamRequest/metadata.

---

## Problem Statement

The `StreamRequest` interface already defines `thread_id` in metadata:

```typescript
// cli/source/types/stream.ts:62-66
metadata?: {
  assistant_id?: string;
  thread_id?: string;     // Already defined!
  project_id?: string;
};
```

But the chat command doesn't populate it:

```typescript
// cli/source/commands/chat.tsx:158-161
const request: StreamRequest = {
  input: {messages: [{role: 'user', content: message}]},
  metadata: {assistant_id: assistantId},  // Missing thread_id!
};
```

---

## Proposed Solution

### 1. Update ChatCommandProps

```typescript
interface ChatCommandProps {
  readonly assistantId: string;
  readonly message: string;
  readonly jsonMode: boolean;
  readonly threadId?: string;  // NEW
}
```

### 2. Update TUI Mode Component

```typescript
function ChatCommandTUI({
  assistantId,
  message,
  threadId  // NEW
}: Omit<ChatCommandProps, 'jsonMode'>) {
  // ...

  const request = useMemo<StreamRequest | undefined>(
    () =>
      config
        ? {
            input: {messages: [{role: 'user' as const, content: message}]},
            metadata: {
              assistant_id: assistantId,
              ...(threadId && {thread_id: threadId}),  // NEW: Conditional inclusion
            },
          }
        : undefined,
    [config, assistantId, message, threadId],
  );

  // ...
}
```

### 3. Update JSON Mode Function

```typescript
async function runJsonMode(
  assistantId: string,
  message: string,
  threadId?: string,  // NEW
): Promise<void> {
  // ...

  const request: StreamRequest = {
    input: {messages: [{role: 'user', content: message}]},
    metadata: {
      assistant_id: assistantId,
      ...(threadId && {thread_id: threadId}),  // NEW
    },
  };

  // ...
}
```

### 4. Update Main Component and Export

```typescript
function ChatCommand({assistantId, message, jsonMode, threadId}: ChatCommandProps) {
  // ...

  useEffect(() => {
    if (jsonMode) {
      runJsonMode(assistantId, message, threadId).finally(() => {  // Pass threadId
        exit();
      });
    }
  }, [assistantId, message, jsonMode, threadId, exit]);

  if (jsonMode) {
    return null;
  }

  return <ChatCommandTUI assistantId={assistantId} message={message} threadId={threadId} />;
}

export async function runChatCommand(
  assistantId: string,
  message: string,
  options: {json?: boolean; threadId?: string} = {},  // Extended options
): Promise<void> {
  const jsonMode = options.json ?? !isTTY();

  const {waitUntilExit} = render(
    <ChatCommand
      assistantId={assistantId}
      message={message}
      jsonMode={jsonMode}
      threadId={options.threadId}  // NEW
    />,
  );
  await waitUntilExit();
}
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Thread ID Data Flow                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CLI Input                                                                   │
│  ─────────                                                                   │
│  ruska chat <assistant-id> "msg" --thread <thread-id>                       │
│                                    │                                         │
│                                    ▼                                         │
│  cli.tsx                                                                     │
│  ────────                                                                    │
│  cli.flags.thread ──────────────────────────────┐                           │
│                                                  │                           │
│                                                  ▼                           │
│  runChatCommand(assistantId, message, {threadId}) ◄─────────────────────────┤
│                                                  │                           │
│                                                  ▼                           │
│  commands/chat.tsx                                                           │
│  ─────────────────                                                           │
│  ChatCommandProps.threadId ─────────────────────┐                           │
│                                                  │                           │
│                             ┌────────────────────┴────────────────────┐     │
│                             │                                         │     │
│                             ▼                                         ▼     │
│                   TUI Mode (useStream)                      JSON Mode       │
│                             │                                         │     │
│                             ▼                                         ▼     │
│  StreamRequest.metadata.thread_id ◄─────────────────────────────────────────┤
│                                                                              │
│                                    ▼                                         │
│  Backend /api/llm/stream                                                     │
│  ───────────────────────                                                     │
│  LLMRequest.metadata.thread_id received by init_config()                    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Conditional Metadata Pattern

Use spread operator for clean optional inclusion:

```typescript
// Clean pattern for optional metadata fields
metadata: {
  assistant_id: assistantId,
  ...(threadId && {thread_id: threadId}),
  ...(projectId && {project_id: projectId}),  // Future: project support
}
```

This ensures:
- Only defined values are included
- No `thread_id: undefined` in the request
- Clean JSON serialization

---

## Type Safety

The existing `StreamRequest` type already supports `thread_id`:

```typescript
// No type changes needed - already defined
export interface StreamRequest {
  // ...
  metadata?: {
    assistant_id?: string;
    thread_id?: string;  // ✓ Already exists
    project_id?: string;
  };
}
```

---

## Summary

This proposal focuses on the data flow:
1. Thread ID enters via CLI flag
2. Flows through runChatCommand options
3. Injected into StreamRequest.metadata
4. Sent to backend in POST body
5. No type changes needed - infrastructure already exists
