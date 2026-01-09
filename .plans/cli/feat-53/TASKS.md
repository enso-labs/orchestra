# Implementation Tasks: Enable Default Tools for `ruska chat`

## Pre-Implementation

- [x] Verify development environment setup
- [x] Review REVIEW.md council decisions

## Core Implementation

### Task 1: Create tools.ts utility module
- Files: `cli/source/lib/tools.ts`
- Acceptance:
  - [x] `defaultAgentTools` constant defined with 5 tools (renamed from DEFAULT_AGENT_TOOLS per lint rules)
  - [x] `parseToolsFlag()` function implemented
  - [x] TypeScript types exported

### Task 2: Create unit tests for tools parsing
- Files: `cli/source/__tests__/tools.test.ts`
- Acceptance:
  - [x] Test undefined returns defaults
  - [x] Test empty string returns defaults
  - [x] Test whitespace-only returns defaults
  - [x] Test 'disabled' returns empty array
  - [x] Test 'DISABLED' case-insensitive
  - [x] Test single tool parsing
  - [x] Test comma-separated tools
  - [x] Test whitespace trimming
  - [x] Test empty element filtering
  - [x] Test defaultAgentTools values
  - [x] All tests pass (20 new tools tests added)

### Task 3: Modify chat.tsx to accept and use tools
- Files: `cli/source/commands/chat.tsx`
- Acceptance:
  - [x] Import `parseToolsFlag` from lib/tools.js
  - [x] Add `tools?: string` to runChatCommand options
  - [x] Add `tools?: string[]` to ChatCommandProps
  - [x] Parse tools in runChatCommand
  - [x] Pass tools to ChatCommand component
  - [x] Include tools in TUI mode StreamRequest
  - [x] Include tools in JSON mode StreamRequest

### Task 4: Modify cli.tsx to route tools flag
- Files: `cli/source/cli.tsx`
- Acceptance:
  - [x] Pass `tools: cli.flags.tools` to runChatCommand in chat case
  - [x] Help text updated with --tools documentation
  - [x] Examples updated with tools usage

## Documentation

### Task 5: Update CLI README
- Files: `cli/README.md`
- Acceptance:
  - [x] `--tools` added to Chat Options table
  - [x] Tool modes documented (default, disabled, custom)
  - [x] Examples added for each mode

## Verification

- [x] Run `npm run build` - no TypeScript errors
- [x] Run `npm run test` - all 84 tests pass
- [ ] Manual test: `ruska chat "Hello"` - uses default tools
- [ ] Manual test: `ruska chat "Hello" --tools=disabled` - no tools
- [ ] Manual test: `ruska chat "Hello" --tools=web_search` - single tool
- [ ] Help text displays correctly: `ruska --help`
- [x] Ready for PR

## Completion Signature

- Total Tasks: 5
- Estimated Effort: 2-4 hours
- Dependencies: None (uses existing StreamRequest.tools)

---

## Progress Log

### 2026-01-08
- Created `cli/source/lib/tools.ts` with `defaultAgentTools` constant and `parseToolsFlag()` function
- Created `cli/source/__tests__/tools.test.ts` with 20 comprehensive unit tests
- Modified `cli/source/commands/chat.tsx` to accept and pass tools to StreamRequest
- Modified `cli/source/cli.tsx` to route tools flag and update help text
- Updated `cli/README.md` with new documentation
- Fixed lint issues (renamed constant to camelCase per lint rules)
- All 84 tests pass

## Validation Results
- **Status**: PASS
- **Build**: TypeScript compilation successful
- **Tests**: 84/84 passing (20 new tools tests)
- **Lint**: 0 errors (1 pre-existing warning in error-handler.ts)
- **Deviations**: Renamed `DEFAULT_AGENT_TOOLS` to `defaultAgentTools` per XO lint requirements
