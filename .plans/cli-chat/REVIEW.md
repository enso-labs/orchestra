# REVIEW.md (REVISED)

## Council Review: Thread ID Support for CLI Chat Command

**Date**: 2026-01-01
**Revision**: R2 - Thread ID Support
**Context**: User feedback requesting `--thread` flag for conversation continuity
**Primary Goal**: Maintain final JSON object capture while adding thread_id support

---

## Revision Summary

**User Request**:
> The CLI command does not consider that a thread_id would be necessary for continued conversation. We will need flags to support this.

**Key Finding**: The infrastructure already exists:
- `StreamRequest.metadata.thread_id` is defined in `types/stream.ts:64`
- Backend accepts `thread_id` in `LLMRequest.metadata`
- Only the CLI flag and data flow are missing

---

## Proposal Analysis

### Proposal 1: CLI Ergonomics
| Aspect | Decision |
|--------|----------|
| Flag name | `--thread` / `-t` (adopted) |
| Short flag | `-t` (adopted) |
| Help text | Updated with examples (adopted) |

### Proposal 2: Data Flow
| Aspect | Decision |
|--------|----------|
| Conditional metadata | Spread pattern `...(threadId && {thread_id})` (adopted) |
| Type changes | None needed - types already support it (confirmed) |
| Both modes | TUI and JSON modes updated (adopted) |

### Proposal 3: Output Contract
| Aspect | Decision |
|--------|----------|
| Context in output | **Deferred** - scope creep for this revision |
| Minimal change | Thread flows to backend, no output changes (adopted) |

---

## Golden Path (Revised)

### Changes Required

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Thread ID Implementation                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. cli.tsx                                                                  │
│     ├── Add `thread` flag to meow config                                    │
│     ├── Update help text with --thread examples                             │
│     └── Pass cli.flags.thread to runChatCommand                             │
│                                                                              │
│  2. commands/chat.tsx                                                        │
│     ├── Add threadId to ChatCommandProps                                    │
│     ├── Update ChatCommandTUI to accept threadId                            │
│     ├── Update request metadata in both modes                               │
│     └── Update runChatCommand options interface                             │
│                                                                              │
│  No changes needed:                                                          │
│     • types/stream.ts (thread_id already defined)                           │
│     • types/output.ts (no output changes)                                   │
│     • lib/services/* (passes through transparently)                         │
│     • lib/output/* (no changes)                                             │
│     • hooks/useStream.ts (receives request as-is)                           │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### 1. CLI Flag Addition (cli.tsx)

```typescript
// Add to flags config
thread: {
  type: 'string',
  shortFlag: 't',
},

// Update case 'chat':
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

### 2. Command Updates (chat.tsx)

```typescript
// Props
interface ChatCommandProps {
  readonly assistantId: string;
  readonly message: string;
  readonly jsonMode: boolean;
  readonly threadId?: string;  // NEW
}

// Request building (both modes)
metadata: {
  assistant_id: assistantId,
  ...(threadId && {thread_id: threadId}),  // NEW
}

// Export
export async function runChatCommand(
  assistantId: string,
  message: string,
  options: {json?: boolean; threadId?: string} = {},  // Extended
): Promise<void>
```

---

## Help Text Update

```
Chat Options
  --json            Output as newline-delimited JSON (auto-enabled when piped)
  -m, --message     Message to send (alternative to positional arg)
  -t, --thread      Thread ID for continuing a conversation

Examples
  $ ruska chat <id> "Hello"                         # New conversation
  $ ruska chat <id> "Follow up" --thread abc-123    # Continue conversation
  $ ruska chat <id> "Query" -t abc-123 --json       # Continue + JSON output
```

---

## Scope Boundaries

### In Scope (This Revision)
- Add `--thread` / `-t` flag
- Pass thread_id to backend via metadata
- Update help text and examples

### Out of Scope (Future Revisions)
- Adding context to JSON output (Proposal 3 deferred)
- Thread listing command (`ruska threads`)
- Auto-continue mode (`--continue` flag)
- Project ID support (`--project` flag)

---

## Testing Requirements

1. **New conversation** (no thread): Works as before
2. **Continue conversation**: `ruska chat <id> "msg" -t <thread-id>`
3. **JSON mode with thread**: `ruska chat <id> "msg" -t <thread-id> --json`
4. **Verify backend receives**: Check request contains `metadata.thread_id`

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking existing usage | Thread is optional, default unchanged |
| Invalid thread_id | Backend handles validation |
| Type mismatches | No type changes needed |

---

## Conclusion

This is a **minimal, low-risk change** that:
1. Adds one CLI flag
2. Passes it through existing infrastructure
3. Requires no type changes
4. Maintains backward compatibility

The infrastructure was already built to support thread_id - we're simply exposing it to CLI users.
