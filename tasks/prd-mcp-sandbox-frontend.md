# PRD: Frontend MCP Sandbox Option + Health + Fallback UX (Phase 3 — Feature #890)

## Ralph Story Mapping

> This PRD covers **Ralph US-036 through US-045** (Phase 3 — Frontend MCP sandbox UI).

## Introduction

Add MCP Sandbox as a selectable option in the frontend sandbox selector with a live health indicator (green/red dot) and a user-approved fallback toast when the sandbox is unreachable. This phase is strictly frontend-only: it extends the type system, sandbox configuration UI, health-check UX, and SSE error handling to support the MCP sandbox backend wired in Phase 2. The MCP option is only visible when the user has configured a non-empty `mcp_sandbox_url` in their settings, following the same gating pattern used for Daytona (provider key check).

**Independent:** This phase can be implemented in parallel with Phases 1 (McpSandboxBackend class) and 4 (exec_server structured tools). It depends only on the API schema contract defined in Phase 2 (`mcp_sandbox_url` field on `DefaultsResponse` and `patchDefaults`), which can be stubbed or mocked during frontend development.

## Goals

- Extend `SandboxType`, `DefaultsResponse`, and `patchDefaults` types to include MCP sandbox support
- Add an MCP entry to `SANDBOX_OPTIONS` and update `normalizeSandboxValue()` to recognize `"mcp"`
- Provide a text input for configuring `mcp_sandbox_url` in the SandboxSettings component
- Gate MCP option visibility on the presence of a non-empty `mcp_sandbox_url`
- Create a `useSandboxHealth` hook that pings the derived health endpoint on mount and on dropdown open
- Display a green/red health dot in both `SandboxSettings.tsx` and `ThreadSandboxStatus.tsx`
- Handle the `mcp_sandbox_unreachable` SSE event with a toast that offers a one-time "Use State for this message" retry action, keeping MCP as the user's default
- Maintain full backward compatibility — existing State and Daytona options must be completely unaffected

## User Stories

### US-001: Extend SandboxType union and normalize function

**Description:** As a developer, I need the `SandboxType` union extended with `"mcp"` and `normalizeSandboxValue()` updated to recognize it, so the type system and value normalization are MCP-aware.

**Acceptance Criteria:**
- [ ] `SandboxType` in `frontend/src/lib/services/userSettingsService.ts` changed from `"daytona" | "state"` to `"daytona" | "state" | "mcp"`
- [ ] `normalizeSandboxValue()` in `frontend/src/lib/config/sandbox.ts` returns `"mcp"` when passed `"mcp"`
- [ ] Existing normalization for `"daytona"`, `"state"`, `null`, `undefined`, and unknown values is unchanged
- [ ] `npm run test` passes

### US-002: Add mcp_sandbox_url to API type interfaces

**Description:** As a developer, I need `mcp_sandbox_url` on the `DefaultsResponse` interface and the `patchDefaults` data type so the frontend can read and write the MCP sandbox URL through the settings API.

**Acceptance Criteria:**
- [ ] `mcp_sandbox_url: string | null` added to `DefaultsResponse` in `frontend/src/lib/services/userSettingsService.ts`
- [ ] `mcp_sandbox_url: string | null` added to the `patchDefaults` data parameter type
- [ ] No runtime behavior changes — types only
- [ ] `npm run test` passes

### US-003: Add MCP entry to SANDBOX_OPTIONS

**Description:** As a developer, I need an MCP entry in the `SANDBOX_OPTIONS` array so the sandbox selector dropdown can render an MCP choice.

**Acceptance Criteria:**
- [ ] MCP entry added to `SANDBOX_OPTIONS` in `frontend/src/lib/config/sandbox.ts` with `value: "mcp"`, `label: "MCP Sandbox"`, `shortLabel: "MCP"`, `description: "Run agent code in an isolated MCP sandbox container."`
- [ ] `getSandboxOption("mcp")` returns the MCP option
- [ ] Existing State and Daytona entries are unchanged
- [ ] `npm run test` passes

### US-004: Add MCP Sandbox URL input field in SandboxSettings

**Description:** As a user, I want a text input field in the Sandbox Settings card where I can enter and persist my MCP sandbox URL, so the system knows where my MCP sandbox server is running.

**Acceptance Criteria:**
- [ ] A labeled "MCP Sandbox URL" text input is rendered below the sandbox selector dropdown in `SandboxSettings.tsx`
- [ ] Input has placeholder text `http://localhost:3005/mcp`
- [ ] On page load, the input displays the current saved URL from `settings.defaults.mcp_sandbox_url`
- [ ] On blur or Enter key press, the URL is persisted via `patchDefaults({ mcp_sandbox_url: value })`
- [ ] A success toast "MCP sandbox URL updated" is shown on save; an error toast on failure
- [ ] An empty input clears the URL by sending `patchDefaults({ mcp_sandbox_url: null })`
- [ ] Verify in browser using agent-browser skill
- [ ] `npm run test` passes

### US-005: MCP option visibility gating

**Description:** As a user, I only want to see the MCP Sandbox option in the sandbox dropdown when I have configured a non-empty `mcp_sandbox_url`, so the UI does not present options that cannot work.

**Acceptance Criteria:**
- [ ] In `SandboxSettings.tsx`, the `visibleOptions` memo filters out the MCP option when `mcp_sandbox_url` is empty or null
- [ ] In `ThreadSandboxStatus.tsx`, the `visibleOptions` memo applies the same MCP filtering logic
- [ ] When a user enters and saves a non-empty MCP URL, the MCP option immediately appears in the dropdown without a page reload
- [ ] When a user clears the MCP URL, the MCP option disappears from the dropdown and the sandbox reverts to State if MCP was selected
- [ ] Daytona visibility gating (provider key check) continues to work independently and is unaffected
- [ ] Verify in browser using agent-browser skill
- [ ] `npm run test` passes

### US-006: Create useSandboxHealth hook

**Description:** As a developer, I need a `useSandboxHealth` hook that pings the health endpoint derived from the user's `mcp_sandbox_url` so both the settings page and the thread status bar can display live reachability status.

**Acceptance Criteria:**
- [ ] New file `frontend/src/hooks/useSandboxHealth.ts` created
- [ ] Hook signature: `useSandboxHealth(mcpSandboxUrl: string | null)` returning `{ isHealthy: boolean | null, isLoading: boolean, refresh: () => void }`
- [ ] Health endpoint derivation: strip trailing `/mcp` suffix from the URL (if present), then append `/health`. Examples:
  - `http://localhost:3005/mcp` -> `http://localhost:3005/health`
  - `http://localhost:3005` -> `http://localhost:3005/health`
  - `http://host:3005/mcp/` -> `http://host:3005/health`
- [ ] Pings on initial mount when `mcpSandboxUrl` is non-null
- [ ] `refresh()` triggers a new ping (used when dropdown opens)
- [ ] `isHealthy` is `null` before first check, `true` when GET returns 2xx, `false` on any error or non-2xx
- [ ] `isLoading` is `true` during the fetch, `false` otherwise
- [ ] When `mcpSandboxUrl` is `null` or empty, hook returns `{ isHealthy: null, isLoading: false, refresh: noop }`
- [ ] No background polling — checks are on-demand only (mount + explicit refresh)
- [ ] Fetch uses a short timeout (3 seconds) to avoid blocking UI
- [ ] Aborts in-flight request on unmount or when URL changes (cleanup via `AbortController`)
- [ ] `npm run test` passes

### US-007: Health dot in SandboxSettings

**Description:** As a user, I want to see a green or red dot next to the MCP Sandbox option in the settings dropdown so I know whether my sandbox server is reachable before selecting it.

**Acceptance Criteria:**
- [ ] `useSandboxHealth` is called in `SandboxSettings.tsx` with the current `mcp_sandbox_url`
- [ ] A green dot (`bg-green-500`, `h-2 w-2 rounded-full`) is rendered next to the MCP option label when `isHealthy === true`
- [ ] A red dot (`bg-red-500`, `h-2 w-2 rounded-full`) is rendered when `isHealthy === false`
- [ ] No dot is rendered when `isHealthy === null`
- [ ] Health is refreshed when the sandbox selector dropdown opens
- [ ] The health dot only appears on the MCP option row — State and Daytona rows are unaffected
- [ ] Verify in browser using agent-browser skill
- [ ] `npm run test` passes

### US-008: Health dot in ThreadSandboxStatus

**Description:** As a user, I want to see the same green/red health dot in the thread-level sandbox selector popover so I have reachability info without navigating to Settings.

**Acceptance Criteria:**
- [ ] `useSandboxHealth` is called in `ThreadSandboxStatus.tsx` with the current `mcp_sandbox_url`
- [ ] `mcp_sandbox_url` is read from the `getSettings()` response (already fetched on mount)
- [ ] Green/red dot displayed next to the MCP option row in the popover, using the same visual pattern as US-007
- [ ] `refresh()` is called when the popover opens (`onOpenChange` handler)
- [ ] The health dot only appears on the MCP option row
- [ ] Verify in browser using agent-browser skill
- [ ] `npm run test` passes

### US-009: Handle mcp_sandbox_unreachable SSE event with fallback toast

**Description:** As a user, when my MCP sandbox is unreachable during a message I want to see a clear toast notification with the option to retry using the State backend for just that one message, without changing my default sandbox preference.

**Acceptance Criteria:**
- [ ] The `mcp_sandbox_unreachable` event type is recognized in the stream event handler (both `convertEventToLegacy` in the unified handler and `handleMessages` in the legacy handler)
- [ ] When the event fires, a toast is displayed with:
  - Message: "MCP sandbox unreachable"
  - Description: The error detail from the SSE payload (e.g., "Connection refused")
  - Action button labeled: "Use State for this message"
  - Duration: persistent until dismissed or action taken (no auto-dismiss)
- [ ] Clicking "Use State for this message" retries the same user message by calling `handleSubmit()` with a one-time `sandbox_type=state` override. The override is NOT persisted to settings — only applied for that single retry.
- [ ] After the retry, MCP remains the user's selected default sandbox (no `patchDefaults` call for the override)
- [ ] The loading state is cleared when the `mcp_sandbox_unreachable` event is received (before the toast is shown), so the UI is not stuck in a loading spinner
- [ ] The last user message is preserved in the input field or message queue for the retry
- [ ] `npm run test` passes

### US-010: Integration validation with agent-browser

**Description:** As a developer, I need to verify the full frontend MCP sandbox UX end-to-end in a browser to confirm settings, visibility gating, health indicators, and the fallback toast all work together.

**Acceptance Criteria:**
- [ ] `npm run test` passes (all existing tests green, no regressions)
- [ ] `npm run lint` passes
- [ ] `npm run format` produces no changes
- [ ] Verify in browser using agent-browser skill with these steps:
  1. Navigate to Settings page
  2. Scroll to Default Sandbox card
  3. Verify MCP option is NOT visible in dropdown (no URL configured)
  4. Enter `http://localhost:3005/mcp` in MCP Sandbox URL input, press Enter
  5. Verify toast confirms save
  6. Open sandbox dropdown — verify "MCP Sandbox" now appears
  7. Verify health dot color (green if exec_server running, red if not)
  8. Select "MCP Sandbox" — verify selection persists after dropdown closes
  9. Refresh page — verify both URL and MCP selection persist
  10. Navigate to Chat page
  11. Click sandbox selector in the utility row
  12. Verify "MCP Sandbox" option with health dot in popover
  13. Select MCP — verify button updates to show "MCP" short label
  14. Clear the MCP URL in Settings — verify MCP option disappears from both dropdowns and sandbox reverts to State

## Functional Requirements

- **FR-1:** `SandboxType` must be `"daytona" | "state" | "mcp"` in `userSettingsService.ts`
- **FR-2:** `DefaultsResponse` must include `mcp_sandbox_url: string | null`
- **FR-3:** `patchDefaults` must accept `mcp_sandbox_url: string | null` in its data parameter
- **FR-4:** `SANDBOX_OPTIONS` must include an MCP entry with value `"mcp"`, label `"MCP Sandbox"`, shortLabel `"MCP"`, and description `"Run agent code in an isolated MCP sandbox container."`
- **FR-5:** `normalizeSandboxValue("mcp")` must return `"mcp"`
- **FR-6:** The SandboxSettings component must render an "MCP Sandbox URL" text input below the sandbox dropdown, persisting on blur/Enter via `patchDefaults({ mcp_sandbox_url: value })`
- **FR-7:** The MCP option must only be visible in both `SandboxSettings` and `ThreadSandboxStatus` dropdowns when `mcp_sandbox_url` is a non-empty string
- **FR-8:** `useSandboxHealth` must derive the health endpoint by stripping `/mcp` (and trailing slash) from the URL and appending `/health`
- **FR-9:** `useSandboxHealth` must ping on mount and on explicit `refresh()` calls — no background polling
- **FR-10:** A green dot (`bg-green-500`) must display next to the MCP option when healthy; a red dot (`bg-red-500`) when unhealthy; no dot when health is unknown (`null`)
- **FR-11:** The `mcp_sandbox_unreachable` SSE event must trigger a persistent toast with "Use State for this message" action button
- **FR-12:** The toast retry must re-send the same message with a one-time `sandbox_type=state` override without changing the user's default sandbox setting
- **FR-13:** After using the State fallback button, MCP must remain the user's selected default sandbox for future messages
- **FR-14:** Existing State and Daytona sandbox options must be completely unaffected by all changes

## Non-Goals (Out of Scope)

- **No backend changes** — this phase is frontend-only; the API contract (`mcp_sandbox_url` on DefaultsResponse and PatchDefaults) is delivered by Phase 2
- **No exec_server changes** — the MCP sandbox server itself is not modified
- **No MCP protocol work** — no MCP tool discovery, registration, or JSON-RPC implementation in the frontend
- **No per-agent or per-thread MCP URL overrides** — the URL is a global user setting only
- **No URL validation** — the input accepts any string; connectivity is tested by the health check and at execution time
- **No background health polling** — health checks are on-demand (mount + dropdown open) to avoid unnecessary network traffic
- **No automatic fallback** — the user must explicitly click "Use State for this message" to retry; the system does not silently switch backends
- **No migration of existing user data** — the `mcp_sandbox_url` field defaults to `null` which hides the MCP option

## Design Considerations

### Settings Page Layout

The Default Sandbox card in `SandboxSettings.tsx` gains a new input field below the existing dropdown:

```
┌─────────────────────────────────────────────────────────────┐
│ Default Sandbox                                             │
│ Choose the sandbox backend for agent code execution.        │
│                                                             │
│ ┌─────────────────────────────────────────────────┐         │
│ │ MCP Sandbox                                  ▼  │         │
│ └─────────────────────────────────────────────────┘         │
│                                                             │
│ MCP Sandbox URL                                             │
│ ┌─────────────────────────────────────────────────┐         │
│ │ http://localhost:3005/mcp                        │         │
│ └─────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

The URL input is always visible (not gated), since entering a URL is how the user enables the MCP option. The input label should be a subtle `text-sm text-muted-foreground` label.

### Dropdown with Health Dots

Both `SandboxSettings` and `ThreadSandboxStatus` dropdown/popover menus render a small health dot inline with the MCP option label:

```
┌─────────────────────────────────────────┐
│ ✓ State (Default)                       │
│   Run agent code with the state sandbox │
│                                         │
│   Daytona                               │
│   Run agent code in the Daytona sandbox │
│                                         │
│   MCP Sandbox  ●                        │
│   Run agent code in an isolated MCP     │
│   sandbox container.                    │
└─────────────────────────────────────────┘
```

The dot is a `span` with `h-2 w-2 rounded-full inline-block ml-1.5` and `bg-green-500` or `bg-red-500`. It appears only on the MCP row.

### Fallback Toast

The toast uses sonner's `toast.error()` with an `action` configuration:

```
┌─────────────────────────────────────────────────────┐
│ ✕  MCP sandbox unreachable                          │
│    Connection refused to http://localhost:3005/mcp   │
│                                                     │
│                    [ Use State for this message ]    │
└─────────────────────────────────────────────────────┘
```

The toast is persistent (no auto-dismiss timeout) so the user has time to decide. Clicking the action button dismisses the toast and retries.

## Technical Considerations

### Health Endpoint Derivation

The `useSandboxHealth` hook derives the health URL from `mcp_sandbox_url` using this algorithm:

1. Remove trailing slashes from the URL
2. If the URL ends with `/mcp`, strip the `/mcp` suffix
3. Append `/health`

Examples:
- `http://localhost:3005/mcp` -> `http://localhost:3005/health`
- `http://localhost:3005/mcp/` -> `http://localhost:3005/health`
- `http://localhost:3005` -> `http://localhost:3005/health`
- `https://sandbox.example.com/mcp` -> `https://sandbox.example.com/health`

Implementation:
```typescript
function deriveHealthUrl(mcpUrl: string): string {
  let base = mcpUrl.replace(/\/+$/, "");    // strip trailing slashes
  base = base.replace(/\/mcp$/, "");         // strip /mcp suffix
  return `${base}/health`;
}
```

The health check is a simple `fetch(healthUrl, { signal, method: "GET" })` with a 3-second timeout via `AbortController.timeout()`. CORS may block the request from the browser — if so, the hook catches the error and sets `isHealthy = false`. A future improvement could proxy the health check through the backend API, but for Phase 3 the direct fetch is sufficient.

### SSE Event Handling Pattern

The backend (Phase 2) emits `mcp_sandbox_unreachable` events in the SSE stream as:

```
data: ["mcp_sandbox_unreachable", "Connection refused"]
```

**Note**: This follows the existing `("error", str(e))` tuple pattern — the first element is the event type string, the second is a plain error message string (not a nested object).

This is parsed by `FetchStreamReader.parseEvent()` and `ResponseBodyReader.parseEvent()` in the stream readers. A new case must be added to:

1. **`parseEvent()` in both readers** (`fetchStreamReader.ts`): recognize `"mcp_sandbox_unreachable"` as a valid event type and return a typed event
2. **`SSEEvent` type** (`stream.ts`): add `McpSandboxUnreachableEvent` to the union
3. **`convertEventToLegacy()`** in `useChat.ts`: map the event to legacy format
4. **`handleMessages()`** in `useChat.ts`: handle the `"mcp_sandbox_unreachable"` stream mode by showing the toast and stopping the loading state

For the legacy SSE handler (`handleSSE`), the `sseHandler` -> `handleMessages` path already processes all parsed JSON payloads, so adding a case for `"mcp_sandbox_unreachable"` in `handleMessages` covers both code paths.

### Toast Retry Mechanism

When the user clicks "Use State for this message":

1. The toast is dismissed
2. The last user message is re-sent via `handleSubmit()` (the message content is still available in the messages array)
3. A one-time override is applied so this specific request uses `sandbox_type=state` instead of the user's default `"mcp"`
4. The override is NOT persisted — `patchDefaults` is NOT called
5. After the retry completes, future messages continue to use MCP as the default

Implementation approach: The `handleSubmit` function (or a new retry-specific function) can accept an optional `sandboxOverride` parameter. When present, this override is included in the stream request payload (e.g., as a metadata field `sandbox_type_override: "state"`). The backend dispatch layer (Phase 2) should respect this override for the single request.

Alternatively, if the backend does not support per-request overrides, the frontend can:
1. Temporarily patch the sandbox to `"state"` via `patchDefaults`
2. Send the message
3. Immediately restore `"mcp"` via another `patchDefaults` call

The first approach (per-request override in payload) is cleaner and avoids race conditions. Coordinate with Phase 2 to ensure the backend accepts a `sandbox_type` field in the stream request body or metadata.

### Visibility Gating Approach

The MCP option uses URL-based gating, distinct from Daytona's provider-key gating:

```typescript
const visibleOptions = useMemo(
  () =>
    SANDBOX_OPTIONS.filter((opt) => {
      if (opt.value === "daytona") {
        return providerKeys.some(
          (k) => k.provider === "DAYTONA_API_KEY" && k.is_set,
        );
      }
      if (opt.value === "mcp") {
        return !!mcpSandboxUrl;
      }
      return true;
    }),
  [providerKeys, mcpSandboxUrl],
);
```

Both `SandboxSettings.tsx` and `ThreadSandboxStatus.tsx` must maintain `mcpSandboxUrl` state derived from the `getSettings()` response. In `SandboxSettings`, the URL input on-save handler should update this state immediately (optimistic update) so the dropdown reflects the new visibility without requiring a page reload.

### Files Changed

| File | Action | Changes |
|------|--------|---------|
| `frontend/src/lib/services/userSettingsService.ts` | MODIFY | Extend `SandboxType` union, add `mcp_sandbox_url` to `DefaultsResponse` and `patchDefaults` |
| `frontend/src/lib/config/sandbox.ts` | MODIFY | Add MCP to `SANDBOX_OPTIONS`, update `normalizeSandboxValue()` |
| `frontend/src/hooks/useSandboxHealth.ts` | CREATE | New health-check hook |
| `frontend/src/components/settings/SandboxSettings.tsx` | MODIFY | Add MCP URL input, visibility gating, health dot |
| `frontend/src/components/status/ThreadSandboxStatus.tsx` | MODIFY | Add visibility gating, health dot, refresh on popover open |
| `frontend/src/lib/entities/stream.ts` | MODIFY | Add `McpSandboxUnreachableEvent` to `SSEEvent` union |
| `frontend/src/lib/utils/fetchStreamReader.ts` | MODIFY | Add `mcp_sandbox_unreachable` case to `parseEvent()` in both `FetchStreamReader` and `ResponseBodyReader` |
| `frontend/src/hooks/useChat.ts` | MODIFY | Handle `mcp_sandbox_unreachable` in `convertEventToLegacy()` and `handleMessages()`, implement toast retry |

## Success Metrics

- `SandboxType` includes `"mcp"` and `normalizeSandboxValue("mcp")` returns `"mcp"`
- MCP option appears in dropdown only when `mcp_sandbox_url` is non-empty
- MCP option disappears when URL is cleared
- MCP Sandbox URL input persists values via `patchDefaults` and loads saved values on page mount
- Health dot is green when exec_server is reachable, red when unreachable, absent when unchecked
- Health refreshes on dropdown/popover open
- `mcp_sandbox_unreachable` SSE event triggers a persistent toast with the action button
- Clicking "Use State for this message" retries the message with the State backend
- After retry, MCP remains the user's default sandbox
- All existing frontend tests pass (`npm run test`) with no regressions
- `npm run lint` and `npm run format` produce no changes
- State and Daytona sandbox flows are completely unaffected

## Open Questions

- Should the MCP Sandbox URL input be visible at all times, or only when MCP is the currently selected sandbox? (Current design: always visible, since entering a URL is the prerequisite for enabling MCP.)
- Should the health check be proxied through the backend API (`GET /api/v0/sandbox/health?url=...`) to avoid CORS issues with direct browser-to-exec_server requests? If CORS is blocked, the health dot will always show red even when the server is reachable.
- How should the per-request `sandbox_type=state` override be communicated to the backend for the toast retry? Options: (a) metadata field in stream request payload, (b) query parameter on the stream URL, (c) temporary patchDefaults round-trip. Option (a) is preferred — confirm with Phase 2 implementation.
- Should the health dot animate (pulse) while the health check is in-flight, or remain hidden until the result is known? (Current design: no dot when `isHealthy === null`, which covers both unchecked and in-flight states.)
- If the user has `sandbox=mcp` selected but then clears the `mcp_sandbox_url`, should the frontend automatically switch the sandbox back to `"state"` via `patchDefaults`, or just hide the MCP option and let the backend fallback handle it?
