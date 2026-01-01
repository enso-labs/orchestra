# PROPOSAL_1.md

## Agent 1: The CLI Ergonomics Specialist

**Focus**: Flag design, UX patterns, and backward compatibility for adding `--thread` support.

---

## Problem Statement

The current CLI command signature:
```bash
ruska chat <assistant-id> "message"
```

Does not support conversation continuity. Users cannot specify a `thread_id` to continue an existing conversation.

---

## Proposed Solution

### Flag Design Options

| Option | Syntax | Pros | Cons |
|--------|--------|------|------|
| A | `--thread <id>` | Explicit, clear | Verbose |
| B | `-t <id>` | Compact | May conflict with future `-t` uses |
| C | `--thread-id <id>` | Self-documenting | Very verbose |

**Recommendation**: Option A + B combined (`--thread` / `-t` shorthand)

### CLI Signature Updates

```bash
# New conversation (default)
ruska chat <assistant-id> "message"

# Continue existing conversation
ruska chat <assistant-id> "message" --thread <thread-id>
ruska chat <assistant-id> "message" -t <thread-id>

# With JSON output
ruska chat <assistant-id> "message" --thread <thread-id> --json
```

### Implementation Details

#### 1. Flag Definition (cli.tsx)

```typescript
// Add to meow flags config
thread: {
  type: 'string',
  shortFlag: 't',
  description: 'Thread ID for conversation continuity',
},
```

#### 2. Command Handler Update

```typescript
case 'chat': {
  const assistantId = args[0];
  const message = args.slice(1).join(' ') || cli.flags.message;
  const threadId = cli.flags.thread;  // NEW

  if (!assistantId || !message) {
    console.error('Usage: ruska chat <assistant-id> "<message>" [--thread <id>]');
    process.exit(1);
  }

  await runChatCommand(assistantId, message, {
    json: cli.flags.json,
    threadId,  // NEW
  });
  break;
}
```

#### 3. Options Interface Update

```typescript
// In commands/chat.tsx
export interface ChatOptions {
  json?: boolean;
  threadId?: string;  // NEW
}

export async function runChatCommand(
  assistantId: string,
  message: string,
  options: ChatOptions = {},
): Promise<void> {
  // ...
}
```

---

## JSON Output Enhancement

When a thread_id is used, include it in the `done` output for reference:

```json
{
  "type": "done",
  "thread_id": "abc-123",
  "response": { "messages": [...] }
}
```

This allows downstream consumers to track which thread the response belongs to.

---

## Help Text Updates

```
Chat Options
  --json            Output as newline-delimited JSON (auto-enabled when piped)
  -m, --message     Message to send (alternative to positional arg)
  -t, --thread      Thread ID for continuing a conversation

Examples
  $ ruska chat <id> "Hello"                         # New conversation
  $ ruska chat <id> "Follow up" --thread abc-123    # Continue thread
  $ ruska chat <id> "Query" -t abc-123 --json       # Continue + JSON output
```

---

## Backward Compatibility

- **No breaking changes**: Thread ID is optional
- **Default behavior unchanged**: Without `--thread`, starts new conversation
- **Existing scripts work**: No modifications needed for current usage

---

## Future Considerations

1. **Auto-thread mode**: Could add `--continue` flag that remembers last thread
2. **Thread listing**: Future `ruska threads` command to list conversations
3. **Thread naming**: Allow `--thread-name` for human-readable identifiers

---

## Summary

This proposal adds the `--thread` / `-t` flag with minimal disruption:
- Simple flag addition to meow config
- Thread ID passed through options to runChatCommand
- Included in StreamRequest metadata
- Optional enhancement to JSON output
