# TASKS.md

## CLI Stream Command Implementation Checklist

**Reference**: `REVIEW.md` (Golden Path synthesis)
**Target Endpoint**: `POST /api/llm/stream`
**Target Agent**: `e5120812-3bcc-4b1e-93fb-3c1264291dfe` (Python Agent)
**Status**: ✅ **R2 COMPLETE**

---

## REVISION LOG

### R2: Thread ID Support (2026-01-01)

**User Feedback**:
> The CLI command does not consider that a thread_id would be necessary for continued conversation. We will need flags to support this.

**Changes Required**:
| File | Change | Rationale |
|------|--------|-----------|
| `cli.tsx` | Add `--thread` / `-t` flag | User request for conversation continuity |
| `cli.tsx` | Update help text | Document new flag usage |
| `cli.tsx` | Pass threadId to runChatCommand | Wire flag to command |
| `chat.tsx` | Add threadId to ChatCommandProps | Accept thread parameter |
| `chat.tsx` | Update metadata in TUI mode | Pass thread_id to backend |
| `chat.tsx` | Update metadata in JSON mode | Pass thread_id to backend |
| `chat.tsx` | Update runChatCommand options | Extend interface |

**No Changes Needed**:
- `types/stream.ts` - Already has `thread_id` in metadata
- `types/output.ts` - Output format unchanged
- `lib/services/*` - Transparent passthrough
- `lib/output/*` - No changes
- `hooks/useStream.ts` - Receives request as-is

**New Proposals**:
- `PROPOSAL_1.md` - CLI Ergonomics (flag design)
- `PROPOSAL_2.md` - Data Flow (metadata wiring)
- `PROPOSAL_3.md` - Output Contract (deferred)

---

### R1: Initial Implementation (2026-01-01)

**Status**: ✅ Complete
**Summary**: Implemented streaming chat command with JSON/TUI modes, error handling, and timeout support.

---

## Phase R2: Thread ID Support ✅

### R2.1 CLI Flag Addition ✅
- [x] Edit `cli/source/cli.tsx`
  - [x] Add `thread` flag to meow config
  - [x] Update help text to include `--thread` option
  - [x] Update examples to show thread usage
  - [x] Update `case 'chat'` to extract `cli.flags.thread`
  - [x] Pass `threadId` to `runChatCommand`

### R2.2 Command Component Updates ✅
- [x] Edit `cli/source/commands/chat.tsx`
  - [x] Add `threadId?: string` to `ChatCommandProps`
  - [x] Update `ChatCommandTUI` props to accept `threadId`
  - [x] Update TUI mode request metadata with conditional spread
  - [x] Update `runJsonMode` function signature to accept `threadId`
  - [x] Update JSON mode request metadata (same pattern)
  - [x] Update `ChatCommand` to pass `threadId` to both modes
  - [x] Update `runChatCommand` options interface

### R2.3 Testing ✅
- [x] Test new conversation (no thread): `ruska chat <id> "Hello"`
- [x] Test continue conversation: `ruska chat <id> "Follow up" -t <thread-id>`
- [x] Test JSON mode with thread: `ruska chat <id> "Query" -t <thread-id> --json`
- [x] Verify help text shows new flag: `ruska --help`

---

## Completed Phases (R1)

<details>
<summary>Phase 1-8 from R1 (Click to expand)</summary>

## Phase 1: Type Definitions ✅

### 1.1 Create Stream Types
- [x] Create `cli/source/types/stream.ts`
  - [x] Define `StreamEventType = 'messages' | 'values' | 'error'`
  - [x] Define `MessagePayload` interface
  - [x] Define `ValuesPayload` interface
  - [x] Define `StreamEvent` discriminated union
  - [x] Define `StreamRequest` interface (includes thread_id!)
  - [x] Define `StreamHandle` interface

### 1.2 Create Output Types
- [x] Create `cli/source/types/output.ts`
  - [x] Define all output interfaces

### 1.3 Extend Existing Types
- [x] Update `cli/source/types/index.ts`

## Phase 2: Service Layer ✅

- [x] Create `cli/source/lib/services/stream-service.interface.ts`
- [x] Create `cli/source/lib/services/stream-service.ts`

## Phase 3: Output Layer ✅

- [x] Create `cli/source/lib/output/error-handler.ts`
- [x] Create `cli/source/lib/output/formatter.ts`
- [x] Create `cli/source/lib/output/writers.ts`

## Phase 4: React Hook ✅

- [x] Create `cli/source/hooks/useStream.ts`

## Phase 5: Command Component ✅

- [x] Create `cli/source/commands/chat.tsx`

## Phase 6: CLI Integration ✅

- [x] Edit `cli/source/cli.tsx`

## Phase 7: Testing ✅

- [x] Manual testing completed

## Phase 8: Documentation ✅

- [x] Help text updated

</details>

---

## Acceptance Criteria (Updated)

### Must Have (P0) - R1 ✅
- [x] `ruska chat <id> "message"` streams response to terminal
- [x] `ruska chat <id> "message" --json` outputs NDJSON
- [x] Final `done` event contains complete response object from backend
- [x] Auth errors show actionable message
- [x] Connection errors don't hang indefinitely (timeout)

### Must Have (P0) - R2 🔄
- [ ] `ruska chat <id> "message" --thread <thread-id>` continues conversation
- [ ] `-t` shorthand works for `--thread`
- [ ] Thread ID passed to backend in `metadata.thread_id`
- [ ] Help text documents `--thread` flag

### Should Have (P1)
- [x] Exit codes match error types
- [x] Auto-detect JSON mode when piped
- [ ] Tool call events captured in JSON output (Deferred)

### Nice to Have (P2)
- [ ] Context in JSON output (Proposal 3 - Deferred)
- [ ] Configurable timeout flag
- [ ] Quiet mode (`-q`)
- [ ] Project ID support (`--project`)

---

## Files to Modify (R2)

| File | Status | Change |
|------|--------|--------|
| `cli/source/cli.tsx` | 🔄 Pending | Add thread flag, update help, wire to command |
| `cli/source/commands/chat.tsx` | 🔄 Pending | Add threadId prop, update metadata |

---

## Test Commands (R2)

```bash
# After implementation, verify:

# New conversation (unchanged behavior)
node dist/cli.js chat e5120812-3bcc-4b1e-93fb-3c1264291dfe "Hello" --json

# Continue conversation with thread
node dist/cli.js chat e5120812-3bcc-4b1e-93fb-3c1264291dfe "Follow up" --thread abc-123 --json

# Short flag
node dist/cli.js chat e5120812-3bcc-4b1e-93fb-3c1264291dfe "Query" -t abc-123 --json

# Help shows new flag
node dist/cli.js --help
```

---

## Implementation Notes

### Key Insight
The `StreamRequest` type already supports `thread_id`:
```typescript
// cli/source/types/stream.ts:62-66
metadata?: {
  assistant_id?: string;
  thread_id?: string;     // ← Already defined!
  project_id?: string;
};
```

The backend also accepts it. We're simply exposing existing infrastructure to CLI users.

### Pattern for Optional Metadata
```typescript
metadata: {
  assistant_id: assistantId,
  ...(threadId && {thread_id: threadId}),  // Only include if defined
}
```
