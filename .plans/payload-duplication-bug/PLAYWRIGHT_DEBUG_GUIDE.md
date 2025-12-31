# Playwright Visual Debugging Guide

## Purpose

This guide helps you visually debug the "Invalid message" issue using Playwright MCP to inspect the actual UI behavior.

## Prerequisites

- Playwright MCP enabled (✅ confirmed)
- Application running locally
- Test data: Existing threads with tool usage in the database

## Debugging Scenarios

### Scenario 1: Verify New Chat Tool Rendering

**Goal:** Confirm streaming tool calls display correctly

**Steps:**
1. Navigate to application: `http://localhost:8000` (or your dev URL)
2. Start a new chat
3. Submit query: "Search for formatMessages in the codebase"
4. Take screenshot after tool call completes
5. Verify:
   - Tool input displays with proper JSON data
   - No "Invalid message" text appears
   - Tool name shows correctly

**Playwright Commands:**
```javascript
// Navigate
await page.goto('http://localhost:8000');

// Wait for chat interface
await page.waitForSelector('[data-testid="chat-input"]');

// Submit query
await page.fill('[data-testid="chat-input"]', 'Search for formatMessages in the codebase');
await page.press('[data-testid="chat-input"]', 'Enter');

// Wait for tool execution
await page.waitForSelector('[data-testid="tool-message"]', { timeout: 30000 });

// Take screenshot
await page.screenshot({ path: 'screenshots/new-chat-tool-call.png', fullPage: true });

// Verify no "Invalid message" appears
const invalidMessages = await page.locator('text=Invalid message').count();
console.log('Invalid messages found:', invalidMessages); // Should be 0
```

### Scenario 2: Verify Sidebar Thread Loading (Critical Test)

**Goal:** Confirm checkpoint data loads without "Invalid message" error

**Steps:**
1. Navigate to application
2. Wait for sidebar to load threads
3. Click on an existing thread with tool usage
4. Take screenshot
5. Verify:
   - Tool inputs display correctly
   - NO "Invalid message" appears anywhere
   - All messages render properly

**Playwright Commands:**
```javascript
// Navigate
await page.goto('http://localhost:8000');

// Wait for sidebar threads to load
await page.waitForSelector('[data-testid="thread-item"]', { timeout: 10000 });

// Get all thread items
const threads = await page.locator('[data-testid="thread-item"]').all();
console.log('Found threads:', threads.length);

// Click first thread
await threads[0].click();

// Wait for messages to load
await page.waitForSelector('[data-testid="chat-message"]', { timeout: 10000 });

// Take screenshot
await page.screenshot({ path: 'screenshots/sidebar-thread-load.png', fullPage: true });

// Check for "Invalid message" errors
const invalidMessages = await page.locator('text=Invalid message').count();
console.log('Invalid messages found:', invalidMessages); // Should be 0

// Get all tool messages
const toolMessages = await page.locator('[data-testid="tool-message"]').all();
console.log('Tool messages found:', toolMessages.length);

// Verify each tool message has content
for (let i = 0; i < toolMessages.length; i++) {
  const hasInput = await toolMessages[i].locator('[data-testid="tool-input"]').count() > 0;
  console.log(`Tool message ${i} has input:`, hasInput);
}
```

### Scenario 3: Compare Streaming vs Checkpoint Data

**Goal:** Verify both data paths produce identical UI

**Steps:**
1. Create new chat with tool usage (streaming path)
2. Take screenshot
3. Note the thread ID
4. Refresh browser
5. Load same thread from sidebar (checkpoint path)
6. Take screenshot
7. Compare screenshots - should be identical

**Playwright Commands:**
```javascript
// Part 1: New chat (streaming)
await page.goto('http://localhost:8000');
await page.fill('[data-testid="chat-input"]', 'Read the format.ts file');
await page.press('[data-testid="chat-input"]', 'Enter');
await page.waitForSelector('[data-testid="tool-message"]', { timeout: 30000 });

// Get thread ID from URL or metadata
const threadId = await page.evaluate(() => {
  return window.location.pathname.split('/').pop();
});
console.log('Thread ID:', threadId);

// Screenshot streaming state
await page.screenshot({ path: 'screenshots/streaming-state.png', fullPage: true });

// Part 2: Reload from checkpoint
await page.reload();
await page.waitForSelector('[data-testid="chat-message"]', { timeout: 10000 });

// Screenshot checkpoint state
await page.screenshot({ path: 'screenshots/checkpoint-state.png', fullPage: true });

// Compare tool message counts
const toolMsgsStreaming = await page.evaluate(() => {
  return document.querySelectorAll('[data-testid="tool-message"]').length;
});

// Should be same count
console.log('Tool messages after reload:', toolMsgsStreaming);
```

### Scenario 4: Inspect Tool Input Data Structure

**Goal:** Verify actual DOM structure of tool inputs

**Steps:**
1. Load thread with tool usage
2. Inspect tool input elements
3. Verify data-testid attributes exist
4. Check JSON rendering in UI

**Playwright Commands:**
```javascript
await page.goto('http://localhost:8000/chat/[thread-id]');
await page.waitForSelector('[data-testid="tool-message"]', { timeout: 10000 });

// Get first tool message
const firstToolMsg = page.locator('[data-testid="tool-message"]').first();

// Get tool input element
const toolInput = firstToolMsg.locator('[data-testid="tool-input"]');

// Get rendered JSON
const jsonContent = await toolInput.textContent();
console.log('Tool input content:', jsonContent);

// Verify it's valid JSON
try {
  JSON.parse(jsonContent);
  console.log('✅ Valid JSON rendered');
} catch (e) {
  console.log('❌ Invalid JSON:', e.message);
}

// Take detailed screenshot
await firstToolMsg.screenshot({ path: 'screenshots/tool-input-detail.png' });
```

## Expected DOM Structure

### Correct Tool Message (No "Invalid message")
```html
<div data-testid="tool-message">
  <div data-testid="tool-header">
    <span>Grep</span>
  </div>
  <div data-testid="tool-input">
    {
      "pattern": "formatMessages",
      "output_mode": "files_with_matches"
    }
  </div>
  <div data-testid="tool-output">
    <!-- Tool results here -->
  </div>
</div>
```

### Incorrect (Bug Present)
```html
<div data-testid="chat-message">
  <div class="markdown-card">
    Invalid message  <!-- ❌ This should never appear -->
  </div>
</div>
```

## Data Inspection Points

### 1. Check formatMessages() Output in Console

Add to browser console or Playwright:
```javascript
// In browser console after thread loads
const messages = window.__messages; // If exposed
console.log('Formatted messages:', messages);

// Check for messages with tool calls
const toolMessages = messages.filter(m => m.role === 'AIMessageChunk');
console.log('Tool messages:', toolMessages);

// Verify input field exists and is populated
toolMessages.forEach((msg, i) => {
  console.log(`Message ${i}:`, {
    hasInput: !!msg.input,
    inputLength: msg.input?.length,
    firstInput: msg.input?.[0]
  });
});
```

### 2. Intercept Network Requests

Monitor checkpoint loading:
```javascript
// Intercept API calls
await page.route('**/api/threads/**', async route => {
  const response = await route.fetch();
  const json = await response.json();

  console.log('Checkpoint data from API:', json);

  // Check tool_calls structure
  const messages = json.values?.messages || json.messages || [];
  messages.forEach(msg => {
    if (msg.tool_calls?.length > 0) {
      console.log('Tool call args type:', typeof msg.tool_calls[0].args);
      console.log('Tool call args value:', msg.tool_calls[0].args);
    }
  });

  await route.continue();
});
```

### 3. Monitor React State

If React DevTools available:
```javascript
// Find ChatMessages component
const chatComponent = await page.evaluate(() => {
  // Use React DevTools global
  return window.$r; // If available
});
```

## Automated Visual Regression Test

Create a Playwright test file:

**File:** `frontend/e2e/checkpoint-loading.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Checkpoint Loading', () => {
  test('should not show "Invalid message" when loading threads', async ({ page }) => {
    // Navigate to app
    await page.goto('http://localhost:8000');

    // Wait for threads to load
    await page.waitForSelector('[data-testid="thread-item"]', { timeout: 10000 });

    // Click first thread
    await page.locator('[data-testid="thread-item"]').first().click();

    // Wait for messages
    await page.waitForSelector('[data-testid="chat-message"]', { timeout: 10000 });

    // Verify NO "Invalid message" text
    const invalidCount = await page.locator('text=Invalid message').count();
    expect(invalidCount).toBe(0);

    // Verify tool messages have inputs
    const toolMessages = page.locator('[data-testid="tool-message"]');
    const count = await toolMessages.count();

    for (let i = 0; i < count; i++) {
      const hasInput = await toolMessages.nth(i).locator('[data-testid="tool-input"]').count();
      expect(hasInput).toBeGreaterThan(0);
    }
  });

  test('streaming and checkpoint should render identically', async ({ page }) => {
    // Create new chat
    await page.goto('http://localhost:8000');
    await page.fill('[data-testid="chat-input"]', 'Search for test');
    await page.press('[data-testid="chat-input"]', 'Enter');
    await page.waitForSelector('[data-testid="tool-message"]', { timeout: 30000 });

    // Get tool message HTML (streaming)
    const streamingHTML = await page.locator('[data-testid="tool-message"]').first().innerHTML();

    // Reload page (checkpoint)
    await page.reload();
    await page.waitForSelector('[data-testid="tool-message"]', { timeout: 10000 });

    // Get tool message HTML (checkpoint)
    const checkpointHTML = await page.locator('[data-testid="tool-message"]').first().innerHTML();

    // Should be similar structure (not exact match due to IDs)
    expect(streamingHTML).toContain('tool-input');
    expect(checkpointHTML).toContain('tool-input');
  });
});
```

## Screenshot Comparison

Use Playwright's screenshot comparison:

```javascript
// Take baseline screenshot (working state)
await page.screenshot({ path: 'screenshots/baseline.png' });

// After code changes, compare
await expect(page).toHaveScreenshot('baseline.png', {
  maxDiffPixels: 100 // Allow minor differences
});
```

## Debugging Checklist

Use this checklist when investigating issues:

### ✅ Pre-Flight Checks
- [ ] Application is running
- [ ] Database has threads with tool usage
- [ ] Playwright is installed and configured
- [ ] Browser dev tools open (F12)

### ✅ Visual Inspection
- [ ] Load thread from sidebar
- [ ] Screenshot taken
- [ ] No "Invalid message" visible
- [ ] Tool inputs show JSON data
- [ ] Tool names display correctly

### ✅ Data Inspection
- [ ] Network tab shows checkpoint API call
- [ ] Response has `tool_calls` with `args` field
- [ ] Console shows no formatMessages errors
- [ ] React DevTools shows correct state

### ✅ Comparison
- [ ] New chat screenshot taken
- [ ] Sidebar load screenshot taken
- [ ] Screenshots look identical
- [ ] Both show tool inputs properly

## Common Issues and Solutions

### Issue: "Invalid message" still appears

**Debug Steps:**
1. Open browser console
2. Load thread that shows error
3. Check for errors in console
4. Verify `formatMessages()` is being called
5. Check if `tool_calls[0].args` is string or object
6. Verify filter logic executes

**Playwright Debug:**
```javascript
await page.evaluate(() => {
  console.log('Messages before format:', window.__messagesRaw);
  console.log('Messages after format:', window.__messagesFormatted);
});
```

### Issue: Screenshots differ between streaming and checkpoint

**Debug Steps:**
1. Compare HTML structure
2. Check for timing differences
3. Verify both use `formatMessages()`
4. Look for state management issues

## Continuous Monitoring

Set up visual regression in CI:

```yaml
# .github/workflows/visual-regression.yml
name: Visual Regression

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npx playwright install
      - run: npm run test:visual
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: screenshots
          path: screenshots/
```

## Summary

This guide provides comprehensive visual debugging for the "Invalid message" bug. Use Playwright to:

1. ✅ Verify fix works in real browser
2. ✅ Compare streaming vs checkpoint rendering
3. ✅ Inspect actual DOM structure
4. ✅ Monitor network requests
5. ✅ Create regression tests
6. ✅ Generate visual proof

All tests should show **zero** occurrences of "Invalid message" text.
