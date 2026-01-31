# PROPOSAL: UI Architecture for MCP Server Configuration (Issue #709)

**Agent:** AGENT_3 - UI_CRAFTSMAN
**Date:** 2026-01-30
**Feature:** Users should be able to configure Servers (MCP)

---

## Executive Summary

This proposal covers the frontend architecture for allowing users to manage reusable MCP server configurations. Today, MCP servers are configured inline within the `ToolSelectionModal > McpServerPanel` each time an assistant is created or edited. The goal is to extract server configuration into a standalone CRUD system so configs can be saved once and reused across multiple assistants.

The existing codebase already has:
- A `Server` entity type in `frontend/src/lib/entities/index.ts`
- A complete `serverService.ts` with CRUD endpoints (`/servers`)
- A `useMcpHook.ts` with `fetchMyServers` and `fetchMCPServers` (public)
- The `McpServerPanel` component inside `ToolSelectionModal` with inline server config forms

The work is primarily about: (1) a new Servers management page, (2) a server picker component for the assistant config form, and (3) wiring saved servers into the existing tool-loading flow.

---

## Component Architecture

### New Components

```
frontend/src/
  pages/
    servers/
      index.tsx                    # ServersIndexPage - list/manage servers
  components/
    forms/
      servers/
        server-form.tsx            # ServerForm - create/edit form (reused)
    modals/
      ServerSelectionModal.tsx     # Pick saved servers to assign to assistant
    cards/
      ServerCard.tsx               # Display card for a single server config
```

### Modified Components

| File | Change |
|------|--------|
| `routes/AppRoutes.tsx` | Add `/servers` route |
| `components/forms/agents/agent-create-form.tsx` | Add "Servers" section with ServerSelectionModal trigger |
| `components/modals/ToolSelectionModal/McpServerPanel.tsx` | Add "Import from Saved" button that opens ServerSelectionModal |
| `components/modals/ToolSelectionModal/index.tsx` | Pass saved servers context through |

### Component Hierarchy

```
ServersIndexPage
  ChatLayout
    ChatNav
    ScrollArea
      ServerForm (inline create)
      ServerCard[] (list with edit/delete)

AgentCreateForm (modified)
  [existing sections...]
  ServerSection (new bordered section, same pattern as Tools/SubAgents)
    Button "Manage Servers" -> opens ServerSelectionModal
    Badge list of assigned servers
  [existing ToolSelectionModal - now pre-populated from assigned servers]

ServerSelectionModal
  Dialog
    Search/filter input
    Tabs: "My Servers" | "Public Servers"
      ServerCard[] (selectable, checkbox style)
    Action bar: Cancel | Apply

ServerForm
  Form (react-hook-form + zod)
    name, description, type (mcp|a2a), transport, url, headers (key-value pairs)
    Save button
```

---

## Page Layouts

### 1. Servers Management Page (`/servers`)

Follows the exact same layout pattern as `SettingsPage`:

```tsx
<ChatLayout>
  <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
    <ChatNav sidebarTrigger={<SidebarTrigger />} showModelSelector={false} />
    <ScrollArea className="h-full">
      <div className="container max-w-4xl mx-auto py-8 space-y-8 px-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Servers</h1>
            <p className="text-muted-foreground">
              Manage your MCP and A2A server configurations.
            </p>
          </div>
          <Button onClick={toggleCreateForm}>
            <Plus /> Add Server
          </Button>
        </div>

        {showCreateForm && <ServerForm onSave={handleCreate} />}

        {/* Server list */}
        <div className="space-y-4">
          {servers.map(server => (
            <ServerCard
              key={server.id}
              server={server}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </div>
    </ScrollArea>
  </div>
</ChatLayout>
```

### 2. Agent Create/Edit Form - Servers Section

Inserted between the "Tools" section and "SubAgents" section in the existing `agent-create-form.tsx`. Uses the identical bordered-section pattern (`border border-border rounded-lg p-6`):

```tsx
<div className="border border-border rounded-lg p-6">
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-3">
      <Server className="h-5 w-5 text-foreground" />
      <div>
        <h2 className="text-lg font-semibold">MCP Servers</h2>
        <p className="text-sm text-muted-foreground">
          Assign saved server configurations
        </p>
      </div>
    </div>
    <Button variant="outline" disabled={!isEditing}
      onClick={() => setIsServerModalOpen(true)}>
      <Server className="h-4 w-4 mr-2" />
      Manage Servers ({assignedServerCount})
    </Button>
  </div>
  {/* Badge list of assigned servers, same style as tools */}
  <div className="flex flex-wrap gap-2">
    {assignedServers.map(server => (
      <div key={server.id} className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-full text-sm">
        <span>{server.name}</span>
        <button onClick={() => removeServer(server.id)}>
          <X className="h-3 w-3" />
        </button>
      </div>
    ))}
  </div>
</div>
```

---

## Form Design

### ServerForm (Zod Schema)

```typescript
const serverFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().min(1, "Description is required"),
  type: z.enum(["mcp", "a2a"]),
  config: z.object({
    transport: z.enum(["sse", "streamable_http", "stdio"]).optional(),
    url: z.string().url("Must be a valid URL").optional(),
    base_url: z.string().url().optional(),
    headers: z.record(z.string()).optional(),
    agent_card_path: z.string().optional(),
  }),
  public: z.boolean().default(false),
});
```

The form uses `react-hook-form` with `zodResolver`, matching the existing `AgentCreateForm` pattern. For the headers field, use a dynamic key-value pair editor (add/remove rows), similar to how headers are handled in `McpServerPanel` but supporting multiple pairs.

### Form Fields Layout

- **Name** - Input
- **Description** - Textarea
- **Type** - Select (mcp | a2a), controls which config fields are visible
- **Transport** - Select (sse | streamable_http | stdio), shown when type=mcp
- **URL** - Input, shown when type=mcp
- **Base URL** - Input, shown when type=a2a
- **Agent Card Path** - Input, shown when type=a2a, default `/.well-known/agent.json`
- **Headers** - Dynamic key-value rows with add/remove
- **Public** - Switch toggle

---

## State Management

### New Hook: `useServerHook.ts` (already exists, needs extension)

The existing `useServerHook.ts` file should be extended (or the existing `useMcpHook.ts` patterns leveraged) to include:

```typescript
// frontend/src/hooks/useServerHook.ts
export default function useServerHook() {
  const [servers, setServers] = useState<Server[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchServers = async (type?: string) => { ... };
  const fetchPublicServers = async (type?: string) => { ... };
  const createServerConfig = async (server: Server) => { ... };
  const updateServerConfig = async (id: string, server: Server) => { ... };
  const deleteServerConfig = async (id: string) => { ... };

  return {
    servers, isLoading, error,
    fetchServers, fetchPublicServers,
    createServerConfig, updateServerConfig, deleteServerConfig,
  };
}
```

### Agent Context Integration

When servers are assigned to an assistant, convert them to the `mcp` config format that the agent already expects:

```typescript
// Convert Server[] to agent.mcp format
function serversToMcpConfig(servers: Server[]): Record<string, McpServerConfig> {
  const config: Record<string, McpServerConfig> = {};
  for (const server of servers) {
    const slug = server.slug || server.name.toLowerCase().replace(/\s+/g, '_');
    config[slug] = {
      transport: server.config.transport || 'sse',
      url: server.config.url || server.config.base_url || '',
      headers: server.config.headers || {},
    };
  }
  return config;
}
```

This means the existing `ToolSelectionModal` flow (which reads `agent.mcp` to fetch tools) works without modification. The servers section in the agent form simply writes to `agent.mcp`.

### Data Flow

```
User saves Server config (CRUD on /servers)
        |
User opens assistant create/edit
        |
User clicks "Manage Servers" -> ServerSelectionModal
        |
User selects saved servers -> converts to agent.mcp format
        |
User clicks "Manage Tools" -> ToolSelectionModal
        |  (McpServerPanel now pre-populated from agent.mcp)
        |
User clicks "Fetch Tools" -> loads tools from assigned servers
        |
User selects tools -> saved to agent.tools
        |
User saves assistant -> agent.mcp + agent.tools persisted
```

---

## API Integration

All API calls already exist in `frontend/src/lib/services/serverService.ts`:

| Operation | Service Method | Endpoint |
|-----------|---------------|----------|
| List my servers | `listServers(limit, offset, type)` | `GET /servers` |
| List public servers | `listPublicServers(limit, offset, type)` | `GET /servers/public` |
| Get server | `getServer(id)` | `GET /servers/:id` |
| Create server | `createServer(server)` | `POST /servers` |
| Update server | `updateServer(id, server)` | `PATCH /servers/:id` |
| Delete server | `deleteServer(id)` | `DELETE /servers/:id` |
| Get by slug | `getServerBySlug(slug)` | `GET /servers/slug/:slug` |

No new API endpoints are needed on the frontend side. The backend API surface already supports the full CRUD.

---

## Routing Changes

Add to `AppRoutes.tsx`:

```tsx
import ServersIndexPage from "@/pages/servers";

// Inside Private Routes:
<Route
  path="/servers"
  element={
    <PrivateRoute>
      <ServersIndexPage />
    </PrivateRoute>
  }
/>
```

Navigation link should be added to the sidebar/nav component (wherever Assistants, Prompts, Schedules links live).

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Breaking existing inline MCP config in ToolSelectionModal | High | Keep inline config working as-is. The "Import from Saved" button is additive, not replacing. |
| Agent.mcp format mismatch between saved Server entity and inline config | Medium | The conversion function `serversToMcpConfig` bridges the two formats. Both write to the same `agent.mcp` object. |
| Headers containing secrets stored in plain text | Medium | Headers are already stored in the Server entity config. Consider adding a note that secrets should use environment variable references. This is an existing concern, not new. |
| Public servers exposing private config | Low | The `public` flag on Server entity controls visibility. Headers/secrets should not be on public servers. |
| No backend changes needed | Low | The `serverService.ts` already has full CRUD. The `Server` entity type matches the backend schema. Verify backend routes exist and are functional. |

---

## Complexity Estimate

| Component | Effort | Notes |
|-----------|--------|-------|
| `ServersIndexPage` | **Small** (2-3 hrs) | Follows `SettingsPage` pattern exactly |
| `ServerForm` | **Small** (2-3 hrs) | Standard react-hook-form + zod, matches existing form patterns |
| `ServerCard` | **Trivial** (1 hr) | Display component with edit/delete actions |
| `ServerSelectionModal` | **Medium** (3-4 hrs) | Similar to `PromptSelectionModal` pattern, with search and tabs |
| Agent form "Servers" section | **Small** (2 hrs) | Identical pattern to existing "Tools" section |
| `useServerHook` extension | **Small** (1-2 hrs) | Wraps existing `serverService` calls |
| Routing + nav updates | **Trivial** (30 min) | One route, one nav link |
| Wiring servers-to-mcp conversion | **Small** (1-2 hrs) | Bridge function + integration in agent form submit |

**Total estimate: 12-16 hours of development work**

This is a low-to-medium complexity feature. The backend API and entity types already exist. The frontend patterns are well-established and can be followed directly. The main architectural decision -- converting saved `Server` entities into the existing `agent.mcp` inline format -- keeps the tool-loading flow unchanged and avoids cascading changes.

---

## Implementation Order

1. `ServerForm` component + Zod schema
2. `ServerCard` component
3. `ServersIndexPage` (page + route)
4. `useServerHook` extension
5. `ServerSelectionModal`
6. Agent form "Servers" section integration
7. `serversToMcpConfig` conversion wiring
8. Navigation link addition
9. Testing and validation
