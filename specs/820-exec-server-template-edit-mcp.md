# Spec: Add exec server template and edit capability for MCP servers (#820)

## Overview

Two improvements to the MCP Servers panel in the "Manage Tools" modal (`McpServerPanel.tsx`):

1. **Exec server template**: Add a pre-configured template for local exec/stdio MCP servers to the Template dropdown, alongside Custom, Ruska MCP, and GitHub MCP.

2. **Edit server capability**: Add an edit button (pencil icon) to each configured server card so users can modify existing servers in-place instead of deleting and re-adding them.

---

## Key File

- `frontend/src/components/modals/ToolSelectionModal/McpServerPanel.tsx`

## Current State

- **Templates**: `MCP_TEMPLATES` object has 3 entries: `custom`, `ruska`, `github` — all use `sse` transport
- **Server cards**: Each card shows server name, transport, URL, and a single delete button (Trash2 icon)
- **Form**: The add form supports `sse`, `streamable_http`, and `stdio` transports, but no template defaults to `stdio`
- **Types**: `McpServerConfig` has `transport`, `url`, and `headers` fields
- **Props**: `onAddServer(name, config)` and `onRemoveServer(name)` — no update/edit callback exists

---

## User Stories

### US-001: Exec server template in Template dropdown

**As a** user setting up a local execution MCP server,
**I want** an "Exec Server" template in the Template dropdown,
**So that** I can quickly configure a stdio-based server without manually switching transport and entering a command.

#### Acceptance Criteria

- [ ] A new `exec` entry is added to `MCP_TEMPLATES` with:
  - `name`: `"Exec Server"`
  - `transport`: `"stdio"`
  - `url`: pre-filled with a sensible default command (e.g. `npx -y @anthropic/mcp-server` or left empty with placeholder guidance)
  - `headers`: `{}` (not applicable for stdio)
- [ ] Selecting "Exec Server" from the Template dropdown sets transport to `stdio`
- [ ] The URL field label/placeholder should contextually update for stdio (e.g. "Command" instead of "URL") — _nice-to-have, not blocking_
- [ ] The template appears in the dropdown alongside existing templates
- [ ] Typecheck passes (`npx tsc --noEmit` from `frontend/`)

#### Implementation Notes

Add to the `MCP_TEMPLATES` object:

```typescript
exec: {
  name: "Exec Server",
  transport: "stdio" as const,
  url: "",
  headers: {},
},
```

Consider: when `transport === "stdio"`, the `url` field semantically represents a command. Updating the label is a UX improvement but can be a follow-up.

---

### US-002: Edit button on configured server cards

**As a** user who has already configured an MCP server,
**I want** an edit button on the server card,
**So that** I can modify the server's URL, transport, or headers without deleting and re-creating it.

#### Acceptance Criteria

- [ ] Each server card shows a pencil icon button (Pencil/Edit2 from lucide-react) alongside the existing delete button
- [ ] Clicking edit opens the add form pre-populated with the server's current config:
  - Server name (read-only or editable — see notes)
  - Transport
  - URL
  - First header key/value (if any)
- [ ] The form submit button text changes from "Add Server" to "Save" when editing
- [ ] Saving an edited server calls `onAddServer(name, updatedConfig)` which overwrites the existing entry (since `mcpServers` is a `Record<string, McpServerConfig>`, same key = update)
- [ ] After saving, the form resets and closes
- [ ] Clicking "Cancel" while editing discards changes and resets the form
- [ ] Only one server can be edited at a time
- [ ] Typecheck passes

#### Implementation Notes

**State additions:**
```typescript
const [editingServer, setEditingServer] = useState<string | null>(null);
```

**Edit handler:**
```typescript
const handleEditServer = (name: string) => {
  const config = mcpServers[name];
  setServerName(name);
  setTransport(config.transport);
  setUrl(config.url);
  const firstHeader = Object.entries(config.headers)[0];
  if (firstHeader) {
    setHeaderKey(firstHeader[0]);
    setHeaderValue(firstHeader[1]);
  } else {
    setHeaderKey("");
    setHeaderValue("");
  }
  setEditingServer(name);
  setShowAddForm(true);
};
```

**Form submit changes:**
- When `editingServer` is set, the submit calls `onAddServer(editingServer, config)` (overwrite) then clears `editingServer`
- If the name changed during edit: call `onRemoveServer(editingServer)` first, then `onAddServer(newName, config)`

**Server card button addition:**
```tsx
<div className="flex items-center gap-1">
  <Button size="icon" variant="ghost" onClick={() => handleEditServer(name)}>
    <Pencil className="h-4 w-4 text-muted-foreground" />
  </Button>
  <Button size="icon" variant="ghost" onClick={() => onRemoveServer(name)}>
    <Trash2 className="h-4 w-4 text-destructive" />
  </Button>
</div>
```

**No new props needed**: Since `mcpServers` is a `Record<string, McpServerConfig>`, calling `onAddServer` with the same name effectively updates. If name changes, we need `onRemoveServer` + `onAddServer`. No new callback needed on the parent.

---

## Testing

### Manual Testing Checklist

- [ ] Open Manage Tools modal → MCP Servers tab
- [ ] Verify "Exec Server" appears in Template dropdown
- [ ] Select "Exec Server" → transport should be "STDIO", URL empty
- [ ] Add an exec server with a name and command
- [ ] Verify server card appears with pencil + trash icons
- [ ] Click pencil → form opens pre-populated with server config
- [ ] Modify URL → click Save → card updates in place
- [ ] Click pencil on one server, then pencil on another → form switches to second server
- [ ] Click Cancel while editing → form closes, no changes saved
- [ ] Delete still works independently of edit

### Automated

- [ ] `npx tsc --noEmit` passes from `frontend/`
- [ ] `npm run lint` passes from `frontend/`

---

## Out of Scope

- **Multiple headers**: Current form only supports one header key/value pair. Multi-header support is a separate enhancement.
- **Stdio-specific form fields**: Contextual labels ("Command" vs "URL") or additional fields (args, env vars) for stdio transport — follow-up issue.
- **Server rename**: Allowing name changes during edit is supported by the implementation but not a primary requirement. If name field is editable, old entry must be removed.
- **Backend changes**: None needed — MCP server config is managed entirely in frontend state / settings API.
