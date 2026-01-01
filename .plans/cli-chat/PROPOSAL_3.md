# PROPOSAL_3.md

## Agent 3: The Output Contract Specialist

**Focus**: How thread_id affects JSON output and downstream consumption patterns.

---

## Problem Statement

When using thread_id for conversation continuity, downstream consumers need:
1. Confirmation that thread_id was used
2. The thread_id in the output for logging/tracking
3. Consistent output format whether thread is new or continued

---

## Proposed Solution

### Enhanced DoneOutput Type

```typescript
// cli/source/types/output.ts

/**
 * Final complete response (from backend "values" event)
 * Enhanced with thread context
 */
export interface DoneOutput {
  type: 'done';
  response: ValuesPayload;
  context?: {
    thread_id?: string;    // Thread used for this request
    assistant_id: string;  // Assistant that handled request
  };
}
```

### Output Examples

#### New Conversation (no thread_id)
```json
{
  "type": "done",
  "response": { "messages": [...] }
}
```

#### Continued Conversation (with thread_id)
```json
{
  "type": "done",
  "response": { "messages": [...] },
  "context": {
    "thread_id": "abc-123",
    "assistant_id": "e5120..."
  }
}
```

---

## Implementation Updates

### 1. Update OutputFormatter

```typescript
// cli/source/lib/output/formatter.ts

export class OutputFormatter {
  private accumulated = '';
  private context?: { thread_id?: string; assistant_id?: string };

  /**
   * Set context for this formatter instance
   */
  setContext(ctx: { thread_id?: string; assistant_id?: string }): void {
    this.context = ctx;
  }

  /**
   * Format the final done event with values payload and context
   */
  done(valuesPayload: ValuesPayload): DoneOutput {
    const output: DoneOutput = {
      type: 'done',
      response: valuesPayload,
    };

    // Include context only if we have meaningful data
    if (this.context?.thread_id || this.context?.assistant_id) {
      output.context = {
        ...(this.context.assistant_id && { assistant_id: this.context.assistant_id }),
        ...(this.context.thread_id && { thread_id: this.context.thread_id }),
      };
    }

    return output;
  }

  // ... rest unchanged
}
```

### 2. Update runJsonMode

```typescript
async function runJsonMode(
  assistantId: string,
  message: string,
  threadId?: string,
): Promise<void> {
  // ...

  const formatter = new OutputFormatter();

  // Set context for output
  formatter.setContext({
    assistant_id: assistantId,
    thread_id: threadId,
  });

  // ... rest of streaming logic

  // Output final done event (context automatically included)
  if (finalResponse) {
    writeJson(formatter.done(finalResponse));
  }
}
```

---

## Downstream Consumption Patterns

### Extract Thread ID with jq

```bash
# Get thread_id from response
ruska chat <id> "Hello" -t abc-123 --json | jq -r '.context.thread_id // empty'

# Filter responses by thread
ruska chat <id> "Hello" -t abc-123 --json | jq 'select(.context.thread_id == "abc-123")'
```

### Scripting with Thread Context

```bash
#!/bin/bash
THREAD_ID="my-conversation-123"

# Send message and capture response
RESPONSE=$(ruska chat $ASSISTANT "Hello" -t $THREAD_ID --json | tail -1)

# Verify thread was used
USED_THREAD=$(echo "$RESPONSE" | jq -r '.context.thread_id // empty')
if [ "$USED_THREAD" != "$THREAD_ID" ]; then
  echo "Warning: Thread ID mismatch"
fi

# Extract content
echo "$RESPONSE" | jq -r '.response.messages[-1].content'
```

### Pipeline Processing

```bash
# Process multiple messages in same thread
for msg in "Hello" "Follow up" "Goodbye"; do
  ruska chat $ASSISTANT "$msg" -t $THREAD_ID --json
done | jq -c 'select(.type == "done") | {thread: .context.thread_id, msg: .response.messages[-1].content}'
```

---

## Error Output Enhancement

Also include context in error outputs for debugging:

```typescript
export interface ErrorOutput {
  type: 'error';
  code: ErrorCode;
  message: string;
  context?: {
    thread_id?: string;
    assistant_id?: string;
  };
}
```

Example error with context:
```json
{
  "type": "error",
  "code": "SERVER_ERROR",
  "message": "Thread not found",
  "context": {
    "thread_id": "invalid-thread",
    "assistant_id": "e5120..."
  }
}
```

---

## Minimal Change Option

If adding context to output is considered scope creep, the minimal change is:
- Just pass thread_id through to the request
- No output changes
- Downstream consumers use their own tracking

However, including context in output is recommended for:
- Debuggability
- Request/response correlation
- Audit logging

---

## Summary

This proposal enhances the output contract to include thread context:
1. Add optional `context` field to DoneOutput
2. Include thread_id and assistant_id when available
3. Update OutputFormatter with setContext method
4. Provide clear jq patterns for downstream consumption
5. Optionally extend to ErrorOutput for debugging
