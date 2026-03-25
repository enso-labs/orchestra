# Spec 002: Frontend — MCP Server Enable/Disable Toggle

## Overview
Add a toggle switch to each MCP server card in the ToolSelectionModal to enable/disable servers.

## Changes

### `frontend/src/components/modals/ToolSelectionModal/types.ts`
- Add `enabled?: boolean` to `McpServerConfig` interface

### `frontend/src/components/modals/ToolSelectionModal/McpServerPanel.tsx`
- Add a `Switch` toggle to each server card (between edit and delete buttons)
- Toggle calls a new `onToggleServer(name: string)` callback
- Disabled servers should have muted/dimmed visual styling
- Disabled servers should NOT load tools when "Fetch Tools" is clicked

### Parent component (`index.tsx` / hooks)
- `onToggleServer` sets `enabled: false` on the server config and persists it
- When fetching tools, filter out disabled servers

## Visual Design
- Use shadcn `Switch` component
- Enabled: normal card appearance
- Disabled: reduced opacity, muted text, switch off
- Server name and URL still visible when disabled
