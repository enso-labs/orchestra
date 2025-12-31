# Test Coverage for "Invalid message" Bug Fix

## Overview

This document outlines the comprehensive test suite created to guard against the "Invalid message" error that occurs when loading checkpoint data with JSON string tool arguments.

## Test File Location

**File:** [`frontend/src/lib/utils/format.test.ts`](../../frontend/src/lib/utils/format.test.ts)

**Test Framework:** Vitest + @testing-library
**Total Tests:** 16 tests covering all scenarios

## Test Categories

### 1. Tool Call Normalization (Core Functionality)

These tests verify that `formatMessages()` correctly handles both streaming and checkpoint data formats:

#### ✅ Streaming Data with Object Args
- **Test:** `should handle streaming data with object args`
- **Scenario:** Tool calls from live streaming where `args` is already a JavaScript object
- **Example:**
  ```javascript
  tool_calls: [{ name: "search", args: { query: "test", limit: 10 } }]
  ```
- **Expected:** Correctly formatted as `AIMessageChunk` with `input` array

#### ✅ Checkpoint Data with JSON String Args
- **Test:** `should handle checkpoint data with JSON string args`
- **Scenario:** Tool calls from database checkpoints where `args` is a JSON string
- **Example:**
  ```javascript
  tool_calls: [{ name: "file_write", args: '{"file_path": "/test.txt"}' }]
  ```
- **Expected:** JSON parsed and formatted as `AIMessageChunk` with `input` array

#### ✅ Mixed Format Handling
- **Test:** `should handle multiple tool calls with mixed formats`
- **Scenario:** Multiple tool calls with both object and string formats
- **Expected:** Both formats correctly parsed and included in `input` array

#### ✅ Filtering Invalid Args
- **Test:** `should filter out tool calls with null or undefined args`
- **Test:** `should filter out tool calls with empty string args`
- **Expected:** Only valid tool calls included in output

#### ✅ Malformed JSON Handling
- **Test:** `should handle malformed JSON strings gracefully`
- **Scenario:** Tool calls with broken JSON strings
- **Expected:** Wrapped in `{ raw: ... }` object to prevent crashes

#### ✅ Fallback to Assistant Message
- **Test:** `should convert to regular assistant message when no valid tool calls exist`
- **Scenario:** Message has tool_calls array but all are invalid
- **Expected:** Message converted to regular `assistant` role

### 2. Regression Tests for "Invalid message" Bug

These tests specifically guard against the exact bug that was reported:

#### ✅ Checkpoint Tool Calls
- **Test:** `should NOT produce 'Invalid message' for checkpoint tool calls`
- **Scenario:** Simulates exact backend checkpoint structure with JSON string args
- **Validates:**
  - Message has `AIMessageChunk` role
  - `input` field is defined and populated
  - Message has either `content` or `input` (prevents "Invalid message")

#### ✅ Streaming Tool Calls
- **Test:** `should NOT produce 'Invalid message' for streaming tool calls`
- **Scenario:** Simulates live streaming with object args
- **Validates:** Same as above but with object format

#### ✅ Real Backend Checkpoint Structure
- **Test:** `should handle real checkpoint data structure from backend`
- **Scenario:** Complete message sequence from `useThread.ts` loadThread()
- **Structure:**
  ```javascript
  {
    values: {
      messages: [
        { type: "human", content: "..." },
        { type: "ai", tool_calls: [{ args: '{"pattern":"..."}' }] },
        { type: "tool", content: "..." },
        { type: "ai", content: "..." }
      ]
    }
  }
  ```
- **Validates:**
  - All messages formatted correctly
  - NO message would trigger "Invalid message" error
  - Tool call with JSON string args properly parsed

### 3. Edge Cases

#### ✅ Empty Messages Array
- **Test:** `should handle empty messages array`
- **Expected:** Returns empty array

#### ✅ Null/Undefined Messages
- **Test:** `should handle null/undefined messages`
- **Expected:** Returns empty array (function includes null guard)

#### ✅ Message Order Preservation
- **Test:** `should preserve message order`
- **Expected:** Output maintains input order

#### ✅ Complex Nested Arguments (Object)
- **Test:** `should handle complex nested tool arguments`
- **Scenario:** Deeply nested objects with arrays
- **Expected:** Structure preserved correctly

#### ✅ Complex Nested Arguments (JSON String)
- **Test:** `should handle complex nested JSON string arguments`
- **Scenario:** Deeply nested JSON string with arrays
- **Expected:** Parsed and structure preserved correctly

## Code Changes Made

### Added Null Guard in `formatMessages()`

**File:** [`frontend/src/lib/utils/format.ts`](../../frontend/src/lib/utils/format.ts#L94-L97)

```typescript
export function formatMessages(messages: any[]) {
	if (!messages || !Array.isArray(messages)) {
		return [];
	}
	return messages.map((message: any) => {
		// ... rest of function
	});
}
```

**Purpose:** Prevent crashes when `messages` is null/undefined

### Enhanced JSON String Parsing

**File:** [`frontend/src/lib/utils/format.ts`](../../frontend/src/lib/utils/format.ts#L105-L157)

**Changes:**
1. Added type checking for both objects and JSON strings
2. Parse JSON strings before including in `input` array
3. Graceful error handling for malformed JSON
4. Fallback to regular assistant message if no valid tool calls

```typescript
.filter((tool_call: any) => {
	// Accept both objects and valid JSON strings
	if (tool_call.args && typeof tool_call.args === 'object') {
		return true;
	}
	if (typeof tool_call.args === 'string' && tool_call.args.trim()) {
		return true;
	}
	return false;
})
.map((tool_call: any) => {
	// Parse JSON string if necessary
	let args = tool_call.args;
	if (typeof args === 'string') {
		try {
			args = JSON.parse(args);
		} catch {
			return { raw: args };
		}
	}
	return { ...args };
});
```

## Test Execution

### Run All Tests
```bash
cd frontend
npm run test
```

### Run Only Format Tests
```bash
npm run test -- src/lib/utils/format.test.ts
```

### Watch Mode
```bash
npm run test:watch
```

### With Coverage
```bash
npm run test:coverage
```

## Test Results

**Status:** ✅ All 16 tests passing

```
 ✓ src/lib/utils/format.test.ts (16 tests) 5ms

 Test Files  1 passed (1)
      Tests  16 passed (16)
```

## Manual Testing Checklist

After automated tests pass, perform these manual tests in the running application:

### Scenario 1: New Chat with Tool Usage
1. Start a new chat
2. Submit a query that triggers tool usage (e.g., "Search for formatMessages")
3. ✅ Verify tool inputs display correctly (not "Invalid message")
4. ✅ Verify tool results render properly

### Scenario 2: Load Existing Thread from Sidebar
1. Click on an existing thread in the sidebar that has tool usage
2. ✅ Verify NO "Invalid message" appears
3. ✅ Verify all tool inputs display with proper data
4. ✅ Verify message history loads correctly

### Scenario 3: Refresh and Reload
1. Start new chat with tool usage
2. Refresh the browser
3. Reload the thread from sidebar
4. ✅ Verify consistency between initial and reloaded state

### Scenario 4: Various Tool Types
Test different tool types to ensure broad compatibility:
- ✅ Search tools (Grep, WebSearch)
- ✅ File operations (Read, Write, Edit)
- ✅ Code execution (Bash)
- ✅ Custom tools

## What This Test Suite Guards Against

### ❌ Previous Bug Behavior
```
Clicking thread in sidebar → "Invalid message" for all tool inputs
```

**Root Cause:**
- Checkpoint data had `tool_calls[0].args` as JSON string
- Defensive filter rejected valid JSON strings
- Messages left without `content` or `input`
- ChatMessages.tsx rendered "Invalid message" fallback

### ✅ Current Protected Behavior
```
Clicking thread in sidebar → Proper tool input display with parsed data
```

**Protection:**
- JSON strings automatically detected and parsed
- Both object and string formats accepted
- Malformed JSON handled gracefully
- Comprehensive test coverage prevents regression

## CI/CD Integration

These tests run automatically:
- On every commit
- On pull requests
- Before deployment

**Build Command:** `npm run build`
**Test Command:** `npm run test`

Both must pass for deployment.

## Related Files

- **Implementation:** [`frontend/src/lib/utils/format.ts`](../../frontend/src/lib/utils/format.ts)
- **Tests:** [`frontend/src/lib/utils/format.test.ts`](../../frontend/src/lib/utils/format.test.ts)
- **Specification:** [`.plans/payload-duplication-bug/SPEC.md`](./SPEC.md)
- **Usage in Chat:** [`frontend/src/hooks/useChat.ts`](../../frontend/src/hooks/useChat.ts)
- **Usage in Threads:** [`frontend/src/hooks/useThread.ts`](../../frontend/src/hooks/useThread.ts)
- **Rendering:** [`frontend/src/components/lists/ChatMessages.tsx`](../../frontend/src/components/lists/ChatMessages.tsx)

## Maintenance Notes

### When Adding New Tool Types
1. Add test case with example tool call
2. Test both object and JSON string formats
3. Verify no "Invalid message" appears

### When Modifying formatMessages()
1. Run full test suite: `npm run test`
2. Manually test sidebar thread loading
3. Check console for warnings

### If "Invalid message" Appears Again
1. Check if new code bypasses `formatMessages()`
2. Verify checkpoint data structure hasn't changed
3. Add new test case for the specific scenario
4. Review ChatMessages.tsx type guards

## Success Criteria

✅ All automated tests pass
✅ No "Invalid message" in new chats
✅ No "Invalid message" in loaded threads
✅ Tool inputs display correctly in both scenarios
✅ No console errors or warnings
✅ Build succeeds without errors
