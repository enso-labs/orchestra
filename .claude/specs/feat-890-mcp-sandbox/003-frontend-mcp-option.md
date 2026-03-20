---
task: Frontend MCP Sandbox Option + Health + Fallback UX (Feature #890)
test_command: "cd frontend && npm run test"
---

# Task: Frontend MCP Sandbox Option + Health Indicator + Fallback UX (Feature #890)

> **IMPORTANT**: Before implementing this feature, READ `/CLAUDE.md` first.

Add MCP Sandbox as a selectable option in the frontend sandbox selector with live health indicator (green/red dot) and user-approved fallback toast when the sandbox is unreachable. MCP option is only visible when the user has configured `mcp_sandbox_url` in their settings.

**Independent**: Can be implemented in parallel with Specs 001 and 004.

## Requirements

### Type & Config Changes

1. **Extend `SandboxType` union** in `frontend/src/lib/services/userSettingsService.ts`:
   - Change from `"daytona" | "state"` to `"daytona" | "state" | "mcp"`
2. **Add `mcp_sandbox_url` to `DefaultsResponse`** interface:
   - `mcp_sandbox_url: string | null;`
3. **Add `mcp_sandbox_url` to `patchDefaults` data type**:
   - `mcp_sandbox_url: string | null;`
4. **Add MCP entry to `SANDBOX_OPTIONS`** in `frontend/src/lib/config/sandbox.ts`:
   ```typescript
   {
     value: "mcp",
     label: "MCP Sandbox",
     shortLabel: "MCP",
     description: "Run agent code in an isolated MCP sandbox container.",
   }
   ```
5. **Update `normalizeSandboxValue()`** to recognize `"mcp"` as a valid value

### MCP Sandbox URL Configuration

6. **Add "MCP Sandbox URL" input field in settings page**:
   - Located in the SandboxSettings component, below the sandbox selector dropdown
   - Text input with placeholder `http://localhost:3005/mcp`
   - On blur or enter, persists via `patchDefaults({ mcp_sandbox_url: value })`
   - Shows current saved URL on page load from `settings.defaults.mcp_sandbox_url`

### Visibility Gating

7. **MCP option visibility gating**:
   - MCP Sandbox option ONLY appears in the sandbox selector dropdown when `mcp_sandbox_url` is set and non-empty in user settings
   - Filter `SANDBOX_OPTIONS` based on user's configured `mcp_sandbox_url`
   - Same pattern as Daytona (only shows when API key is set)

### Health Indicator

8. **Create `useSandboxHealth` hook** in `frontend/src/hooks/useSandboxHealth.ts`:
   - Accepts the user's `mcp_sandbox_url` string
   - Derives health endpoint: strip `/mcp` suffix from URL, append `/health`
   - Pings health endpoint on:
     - Page load (initial mount)
     - When sandbox selector dropdown is opened
   - Returns `{ isHealthy: boolean | null, isLoading: boolean, refresh: () => void }`
   - `null` means not yet checked; `true` = reachable; `false` = unreachable
   - No background polling — only on-demand checks
9. **Display health dot** in `SandboxSettings.tsx`:
   - Green dot (bg-green-500) next to "MCP Sandbox" label when `isHealthy === true`
   - Red dot (bg-red-500) when `isHealthy === false`
   - No dot when `isHealthy === null` (still loading or not checked)
10. **Display health dot** in `ThreadSandboxStatus.tsx`:
    - Same green/red dot pattern as settings page
    - Refresh health when the sandbox selector popover is opened

### User-Approved Fallback Toast

11. **Handle `mcp_sandbox_unreachable` SSE event**:
    - When the backend sends `("mcp_sandbox_unreachable", "<error message>")` via SSE stream
    - Show a toast notification: "MCP sandbox unreachable"
    - Toast includes an action button: "Use State for this message"
    - Clicking the button retries the same user message with `sandbox_type=state` override (one-time)
    - MCP stays selected as the default for future messages
12. **SSE event handler integration**:
    - Add `mcp_sandbox_unreachable` case to the existing stream event handler (wherever `"error"` events are handled)
    - The retry with state override can be done by re-sending the message with a query param or request body field that forces `sandbox_type=state`

## Existing Patterns to Follow

### SandboxSettings component:
- Located at `frontend/src/components/settings/SandboxSettings.tsx`
- Uses `SANDBOX_OPTIONS` from `@/lib/config/sandbox`
- Calls `patchDefaults({ sandbox: value })` on selection change
- Shows toast on success/error

### ThreadSandboxStatus component:
- Located at `frontend/src/components/status/ThreadSandboxStatus.tsx`
- Shows current sandbox in a popover with selection options
- Uses `getSandboxOption()` to resolve display label

### Stream error handling:
- SSE events are parsed in the chat stream handler
- Existing pattern handles `("error", "message")` tuples
- Add parallel handling for `("mcp_sandbox_unreachable", "message")` tuples

## Success Criteria

1. [ ] `SandboxType` union includes `"mcp"` in `userSettingsService.ts`
2. [ ] `DefaultsResponse` interface includes `mcp_sandbox_url: string | null`
3. [ ] `patchDefaults` data type includes `mcp_sandbox_url` field
4. [ ] `SANDBOX_OPTIONS` array includes MCP entry with label "MCP Sandbox", shortLabel "MCP"
5. [ ] `normalizeSandboxValue()` recognizes `"mcp"` and returns it as-is
6. [ ] MCP Sandbox URL input field exists in SandboxSettings component
7. [ ] MCP Sandbox URL is persisted via `patchDefaults({ mcp_sandbox_url: value })`
8. [ ] MCP option only visible in dropdown when `mcp_sandbox_url` is configured
9. [ ] `useSandboxHealth` hook pings health endpoint on mount and dropdown open
10. [ ] Green dot displayed when exec_server is reachable, red dot when not
11. [ ] Health dot visible in both `SandboxSettings.tsx` and `ThreadSandboxStatus.tsx`
12. [ ] `mcp_sandbox_unreachable` SSE event triggers toast with "Use State for this message" action
13. [ ] Clicking "Use State" retries the message with state backend (one-time override)
14. [ ] MCP stays selected as default after using the State fallback button
15. [ ] Existing State and Daytona options are unaffected
16. [ ] All frontend tests pass: `npm run test`

## Example Output

### Settings page with MCP URL configured:
```
Default Sandbox
┌─────────────────────────────────────────────┐
│ MCP Sandbox                              ▼  │
│ Run agent code in an isolated MCP sandbox   │
│ container.                                  │
└─────────────────────────────────────────────┘

MCP Sandbox URL
┌─────────────────────────────────────────────┐
│ http://localhost:3005/mcp                    │
└─────────────────────────────────────────────┘
```

### Dropdown with health indicator:
```
┌─────────────────────────────────────────┐
│ ○ State (Default)                       │
│   Run agent code with the state sandbox │
│                                         │
│ ○ Daytona                               │
│   Run agent code in the Daytona sandbox │
│                                         │
│ ● MCP Sandbox  🟢                       │
│   Run agent code in an isolated MCP     │
│   sandbox container.                    │
└─────────────────────────────────────────┘
```

### Fallback toast:
```
┌─────────────────────────────────────────┐
│ ⚠ MCP sandbox unreachable              │
│                    [Use State for this   │
│                     message]            │
└─────────────────────────────────────────┘
```

## QA Validation

### Frontend unit tests:
```bash
cd frontend && npm run test
```

### agent-browser UI validation (step-by-step):

**Story 1: User configures MCP URL and selects MCP sandbox**
1. Navigate to `http://localhost:5173/settings`
2. Scroll to "Default Sandbox" card
3. Verify MCP option is NOT visible (no URL configured yet)
4. Enter `http://localhost:3005/mcp` in the MCP Sandbox URL input
5. Save — verify toast confirms save
6. Click sandbox selector dropdown — verify "MCP Sandbox" now appears
7. Verify green dot next to MCP (exec_server running)
8. Select "MCP Sandbox" — verify selection persists
9. Refresh page — verify both URL and MCP selection persist

**Story 2: Thread status bar MCP selector**
1. Navigate to chat page
2. Click sandbox selector button in utility row
3. Verify "MCP Sandbox" option listed with green dot
4. Select it — verify button updates to "Sandbox MCP"

**Story 3: Fallback toast when unreachable**
1. Stop exec_server
2. Send a message with MCP selected
3. Verify toast: "MCP sandbox unreachable" with "Use State for this message" button
4. Click the button — verify message processes with state backend
5. Verify MCP still selected as default

## Files

| File | Action |
|------|--------|
| `frontend/src/lib/services/userSettingsService.ts` | MODIFY (SandboxType union, DefaultsResponse, patchDefaults) |
| `frontend/src/lib/config/sandbox.ts` | MODIFY (SANDBOX_OPTIONS, normalizeSandboxValue) |
| `frontend/src/hooks/useSandboxHealth.ts` | CREATE |
| `frontend/src/components/settings/SandboxSettings.tsx` | MODIFY (MCP URL input, health dot, visibility gating) |
| `frontend/src/components/tools/ThreadSandboxStatus.tsx` | MODIFY (health dot, MCP option) |
| Chat stream event handler (locate existing SSE handler) | MODIFY (mcp_sandbox_unreachable event) |

---

## Ralph Instructions

1. Work on the next incomplete criterion (marked [ ])
2. Check off completed criteria (change [ ] to [x])
3. Run tests after changes: `cd frontend && npm run test`
4. Run format after changes: `cd frontend && npm run format`
5. Commit your changes frequently
6. When ALL criteria are [x], output: `<ralph>COMPLETE</ralph>`
7. If stuck on the same issue 3+ times, output: `<ralph>GUTTER</ralph>`
