# Feature: persist-files-to-agent Frontend Integration (637)

## Summary

Integrate the frontend `useFileSystem` hook with the backend `file_system` property on agents. This enables users to persist files created in the FileEditorPanel directly to their agent, with files loading automatically when the agent is opened.

---

## Prerequisites

- Backend `file_system: Dict[str, str]` field already exists on Assistant model
- `useFileSystem` hook already has `toBackendFormat()` and `fromBackendFormat()` functions
- Backend tests passing (see `feature-637-persist-files-to-agent.md`)

---

## TDD Implementation Plan

### Phase 1: Type Definitions

**File**: `frontend/src/lib/services/agentService.ts`

#### Test 1.1: Agent type includes file_system field
```typescript
// In agentService.test.ts or type checking
it("should accept file_system field on Agent type", () => {
  const agent: Agent = {
    name: "Test",
    description: "Test",
    model: "openai:gpt-4",
    tools: [],
    file_system: {
      "/README.md": "# Hello",
      "/src/main.py": "print('hi')",
    },
  };
  expect(agent.file_system).toBeDefined();
});
```

**Implementation**:
```typescript
// Add after line 32 in agentService.ts
export type Agent = {
  id?: string;
  name: string;
  description: string;
  model: string;
  prompt?: string;
  system_prompt?: string;
  instructions?: string;
  tools: string[];
  subagents?: Agent[];
  mcp?: {...};
  a2a?: {...};
  file_system?: Record<string, string>;  // ADD THIS
  metadata?: object;
  // ... rest
}
```

---

### Phase 2: Loading Flow (Agent → FileSystem)

**File**: `frontend/src/pages/agents/edit.tsx`

#### Test 2.1: Files load from agent.file_system on mount
```typescript
// In edit.test.tsx
it("should load agent file_system into fileSystem hook", async () => {
  // Mock agent with file_system
  const mockAgent = {
    id: "123",
    name: "Test Agent",
    file_system: {
      "/config.json": '{"key": "value"}',
    },
  };

  // Render edit page
  render(<AgentEditPage />);

  // Wait for agent to load
  await waitFor(() => {
    expect(screen.getByText("config.json")).toBeInTheDocument();
  });
});
```

**Implementation** (insert after line 21 in edit.tsx):
```typescript
function AgentEditPage() {
  const { agentId } = useParams();
  const { agent, setAgent, useEffectGetAgent, useEffectGetAgents } = useAgentContext();
  const { fromBackendFormat, clearFileSystem } = useChatContext();

  useEffectGetAgent(agentId);
  useEffectGetAgents();

  // Sync agent.file_system → fileSystem when agent loads
  useEffect(() => {
    if (agent?.file_system && Object.keys(agent.file_system).length > 0) {
      fromBackendFormat(agent.file_system);
    }
  }, [agent?.id, fromBackendFormat]);

  // Clear fileSystem when unmounting or changing agents
  useEffect(() => {
    return () => {
      clearFileSystem();
    };
  }, [agentId, clearFileSystem]);

  // ... rest
}
```

---

### Phase 3: Saving Flow (FileSystem → Agent)

**File**: `frontend/src/components/forms/agents/agent-create-form.tsx`

#### Test 3.1: file_system included in save payload
```typescript
// In agent-create-form.test.tsx
it("should include file_system when saving agent", async () => {
  const mockUpdate = vi.spyOn(agentService, "update");

  // Create file in editor
  act(() => {
    result.current.createFile("/test.txt", "content");
  });

  // Submit form
  fireEvent.click(screen.getByText("Save"));

  await waitFor(() => {
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        file_system: { "/test.txt": "content" },
      })
    );
  });
});
```

**Implementation** (modify onSubmit in agent-create-form.tsx):
```typescript
export function AgentCreateForm() {
  const { agent, ... } = useAgentContext();
  const { toBackendFormat } = useChatContext();

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    // Collect file_system from fileSystem hook
    const fileSystemData = toBackendFormat();

    const configData: Agent = {
      name: values.name.trim(),
      description: values.description.trim(),
      model: values.model.trim(),
      mcp: agent.mcp,
      a2a: agent.a2a,
      tools: agent.tools,
      subagents: agent.subagents,
      // Include file_system only if there are files
      ...(Object.keys(fileSystemData).length > 0 && {
        file_system: fileSystemData
      }),
    };

    // ... rest of submit logic
  };
}
```

---

### Phase 4: Thread Page Integration

**File**: `frontend/src/pages/agents/thread.tsx`

#### Test 4.1: Files load on thread page
```typescript
it("should load agent file_system on thread page", async () => {
  // Similar to edit page test
});
```

**Implementation** (insert after line 37):
```typescript
function AgentThreadPage() {
  const { agentId, threadId } = useParams();
  const { agent } = useAgentContext();
  const { fromBackendFormat, clearFileSystem } = useChatContext();

  // Sync agent.file_system → fileSystem
  useEffect(() => {
    if (agent?.file_system && Object.keys(agent.file_system).length > 0) {
      fromBackendFormat(agent.file_system);
    }
  }, [agent?.id, fromBackendFormat]);

  // ... rest
}
```

---

## TDD Execution Order

| Order | Test File | Test Name | Status |
|-------|-----------|-----------|--------|
| 1 | `agentService.ts` | Type includes file_system | [x] |
| 2 | `edit.tsx` | Files load from agent.file_system | [x] |
| 3 | `agent-create-form.tsx` | file_system in save payload | [x] |
| 4 | `thread.tsx` | Files load on thread page | [x] |
| 5 | `edit.tsx` | Files clear on unmount | [x] |

---

## Acceptance Criteria

- [x] Agent type in `agentService.ts` includes `file_system?: Record<string, string>`
- [x] Loading agent on edit page syncs `file_system` to `useFileSystem` hook
- [x] Saving agent includes `file_system` from `toBackendFormat()` in payload
- [x] Thread page loads `file_system` when agent loads
- [x] FileSystem clears when navigating between agents
- [x] Empty file_system does not break loading/saving

---

## Files to Modify

| Priority | File | Changes |
|----------|------|---------|
| P0 | `frontend/src/lib/services/agentService.ts` | Add `file_system` to Agent type |
| P0 | `frontend/src/pages/agents/edit.tsx` | Add `fromBackendFormat` effect + cleanup |
| P0 | `frontend/src/components/forms/agents/agent-create-form.tsx` | Add `file_system` to save payload |
| P1 | `frontend/src/pages/agents/thread.tsx` | Add `fromBackendFormat` effect |

---

## Data Flow

```
USER CREATES FILES IN EDITOR
         |
  useFileSystem.createFile()
         |
  fileSystem: Map<path, FileData>
         |
  [USER SAVES AGENT]
         |
  toBackendFormat() -> Record<path, string>
         |
  agentService.update(agent.id, { file_system })
         |
  BACKEND: PostgreSQL assistants.file_system


USER LOADS AGENT
         |
  agentService.search({ id })
         |
  agent.file_system: Record<path, string>
         |
  fromBackendFormat(agent.file_system)
         |
  fileSystem: Map<path, FileData>
         |
  FileEditorPanel displays files
```

---

## Testing Scenarios

### Test 1: Create Agent with Files
1. Navigate to `/a/new`
2. Enter agent name/description
3. Open FileEditorPanel -> Create file `test.txt` with content "Hello"
4. Save agent
5. **Expected:** Backend receives `{ file_system: { "/test.txt": "Hello" } }`

### Test 2: Load Agent with Files
1. Create agent with file (Test 1)
2. Navigate away
3. Navigate to `/a/:agentId/edit`
4. **Expected:** FileEditorPanel shows `test.txt` with content "Hello"

### Test 3: Update Agent Files
1. Load agent (Test 2)
2. Edit `test.txt` -> "Hello World"
3. Create new file `config.json`
4. Save agent
5. **Expected:** Backend `file_system` has both files with updated content

### Test 4: Navigate Between Agents
1. Load agent A with files
2. Navigate to agent B (no files)
3. **Expected:** FileEditorPanel is empty (files from A are cleared)

---

## Edge Cases

1. **Agent with no file_system field** - Should not crash, treat as empty
2. **Empty file_system `{}`** - Should work, no files displayed
3. **Large files** - Consider size validation (future: max 1MB per file)
4. **Special characters in paths** - Paths should handle `/`, spaces, unicode

---

## Security Notes

- Public agents do NOT expose `file_system` (enforced by backend `PublicAssistant` model)
- Only authenticated owner can read/write agent's `file_system`
- `file_system` data is excluded from `/api/assistants/public/:id` endpoint

---

## Dependencies

- `useFileSystem` hook with `toBackendFormat()` and `fromBackendFormat()` (already implemented)
- Backend `file_system` field on Assistant model (already implemented)
- `useChatContext()` for accessing fileSystem methods in components

---

## Estimated Effort

| Task | Time |
|------|------|
| Add type definition | 5 min |
| Loading flow (edit.tsx) | 15 min |
| Saving flow (agent-create-form.tsx) | 15 min |
| Thread page integration | 10 min |
| Cleanup effects | 10 min |
| Testing | 30 min |
| **Total** | ~1.5 hours |
