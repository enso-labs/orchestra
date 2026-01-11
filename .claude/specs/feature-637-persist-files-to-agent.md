# Feature: persist-files-to-agent (637)

## Summary

Enable users to persist files directly to an agent/assistant. Files are stored as a `file_system` property on the Assistant model, where the key is the file path and the value is the file content. This allows agents to maintain file context across conversations and sessions.

---

## TDD Implementation Plan

> **START HERE**: Write failing tests first, then implement minimal code to pass.

### TDD Process

```
1. Write failing test for next requirement
2. Implement minimal code to pass
3. Run tests
4. If failing, fix and retry
5. Refactor if needed
6. Repeat for all requirements
```

---

### Phase 1: Backend Unit Tests (Start Here)

**File**: `backend/tests/unit/services/test_assistant_service.py`

**Test Framework**: `unittest.IsolatedAsyncioTestCase` with `InMemoryStore`

#### Test 1.1: Assistant model accepts file_system property
```python
async def test_assistant_with_file_system_property(self):
    """Test that Assistant model accepts file_system property."""
    assistant_data = {
        "name": "Test Assistant",
        "description": "Test",
        "tools": [],
        "file_system": {
            "/README.md": "# Hello World",
            "/src/main.py": "print('hello')",
        },
    }
    assistant = Assistant(**assistant_data)
    self.assertEqual(assistant.file_system["/README.md"], "# Hello World")
    self.assertEqual(assistant.file_system["/src/main.py"], "print('hello')")
```

#### Test 1.2: file_system defaults to empty dict
```python
async def test_assistant_file_system_defaults_to_empty_dict(self):
    """Test that file_system defaults to empty dict when not provided."""
    assistant_data = {
        "name": "Test Assistant",
        "description": "Test",
        "tools": [],
    }
    assistant = Assistant(**assistant_data)
    self.assertEqual(assistant.file_system, {})
```

#### Test 1.3: file_system persists on update
```python
async def test_update_persists_file_system(self):
    """Test that file_system is persisted when updating assistant."""
    assistant_id = str(uuid4())
    assistant_data = {
        **self.assistant_data,
        "file_system": {"/test.txt": "test content"},
    }

    await self.service.update(assistant_id, assistant_data)

    retrieved = await self.service.get(assistant_id)
    self.assertIsNotNone(retrieved)
    self.assertEqual(retrieved.file_system["/test.txt"], "test content")
```

#### Test 1.4: file_system returned on get
```python
async def test_get_returns_file_system(self):
    """Test that get() returns assistant with file_system intact."""
    assistant_id = str(uuid4())
    files = {
        "/app.py": "import flask",
        "/requirements.txt": "flask==2.0",
    }
    assistant_data = {**self.assistant_data, "file_system": files}

    await self.service.update(assistant_id, assistant_data)
    retrieved = await self.service.get(assistant_id)

    self.assertEqual(retrieved.file_system, files)
```

#### Test 1.5: file_system syncs to public namespace on publish
```python
async def test_publish_syncs_file_system_to_public(self):
    """Test that publishing syncs file_system to public namespace."""
    assistant_id = str(uuid4())
    files = {"/public.md": "# Public Docs"}
    assistant_data = {**self.assistant_data, "file_system": files}

    await self.service.update(assistant_id, assistant_data)
    await self.service.publish(assistant_id)

    public_assistant = await self.service.get_public(assistant_id)
    self.assertEqual(public_assistant.file_system, files)
```

**Run command**: `cd backend && uv run pytest tests/unit/services/test_assistant_service.py -v`

---

### Phase 2: Backend Integration Tests

**File**: `backend/tests/integration/test_public_assistants.py`

**Test Framework**: `pytest` with `AsyncClient`

#### Test 2.1: Create assistant with file_system via API
```python
@pytest.mark.asyncio
async def test_create_assistant_with_file_system(async_client: AsyncClient):
    """Test creating assistant with file_system via API."""
    # Login
    login_data = {"email": "admin@example.com", "password": "test1234"}
    response = await async_client.post("/api/auth/login", json=login_data)
    if response.status_code != 200:
        pytest.skip("Login failed")

    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create with file_system
    assistant_data = {
        "name": "File System Test Agent",
        "description": "Has files",
        "tools": [],
        "file_system": {
            "/config.json": '{"key": "value"}',
            "/script.py": "print('hello')",
        },
    }

    response = await async_client.post(
        "/api/assistants", json=assistant_data, headers=headers
    )
    assert response.status_code == 200
    assistant_id = response.json()["assistant_id"]

    try:
        # Verify by fetching
        response = await async_client.post(
            "/api/assistants/search",
            json={"filter": {"id": assistant_id}},
            headers=headers,
        )
        assert response.status_code == 200
        assistants = response.json()["assistants"]
        assert len(assistants) == 1
        assert assistants[0]["file_system"]["/config.json"] == '{"key": "value"}'
    finally:
        await async_client.delete(f"/api/assistants/{assistant_id}", headers=headers)
```

#### Test 2.2: Update assistant file_system via API
```python
@pytest.mark.asyncio
async def test_update_assistant_file_system(async_client: AsyncClient):
    """Test updating assistant's file_system via API."""
    # Login and create assistant...

    # Update file_system
    updated_data = {
        "name": "Updated Agent",
        "description": "Updated",
        "tools": [],
        "file_system": {
            "/new_file.txt": "new content",
        },
    }

    response = await async_client.put(
        f"/api/assistants/{assistant_id}",
        json=updated_data,
        headers=headers,
    )
    assert response.status_code == 200

    # Verify update
    response = await async_client.post(
        "/api/assistants/search",
        json={"filter": {"id": assistant_id}},
        headers=headers,
    )
    assert response.json()["assistants"][0]["file_system"]["/new_file.txt"] == "new content"
```

#### Test 2.3: Public assistant includes file_system (if desired)
```python
@pytest.mark.asyncio
async def test_public_assistant_includes_file_system(async_client: AsyncClient):
    """Test that public assistants include file_system."""
    # Create, add file_system, publish...

    response = await async_client.get(f"/api/assistants/public/{assistant_id}")
    assert response.status_code == 200
    # Note: Decide if file_system should be exposed publicly
    # If yes: assert "file_system" in response.json()["assistant"]
    # If no: assert "file_system" not in response.json()["assistant"]
```

**Run command**: `cd backend && uv run pytest tests/integration/test_public_assistants.py -v`

---

### Phase 3: Frontend Unit Tests

**File**: `frontend/src/tests/hooks/useFileSystem.test.ts`

**Test Framework**: Vitest with `@testing-library/react`

#### Test 3.1: Convert FileData to backend format
```typescript
describe("Backend Sync", () => {
  describe("toBackendFormat", () => {
    it("should convert FileData map to Dict[str, str]", () => {
      const { result } = renderHook(() => useFileSystem());

      act(() => {
        result.current.createFile("/test.txt", "line1\nline2");
        result.current.createFile("/app.py", "print('hi')");
      });

      // New function to implement
      const backendFormat = result.current.toBackendFormat();

      expect(backendFormat["/test.txt"]).toBe("line1\nline2");
      expect(backendFormat["/app.py"]).toBe("print('hi')");
    });
  });
});
```

#### Test 3.2: Import from backend format
```typescript
describe("fromBackendFormat", () => {
  it("should convert Dict[str, str] to FileData map", () => {
    const { result } = renderHook(() => useFileSystem());

    const backendData = {
      "/test.txt": "line1\nline2",
      "/app.py": "print('hi')",
    };

    act(() => {
      // New function to implement
      result.current.fromBackendFormat(backendData);
    });

    expect(result.current.fileSystem.has("/test.txt")).toBe(true);
    expect(result.current.fileSystem.get("/test.txt")?.content).toEqual(["line1", "line2"]);
    expect(result.current.fileSystem.get("/app.py")?.content).toEqual(["print('hi')"]);
  });
});
```

#### Test 3.3: Round-trip conversion preserves content
```typescript
it("should preserve content through round-trip conversion", () => {
  const { result } = renderHook(() => useFileSystem());

  const originalContent = "function hello() {\n  return 'world';\n}";

  act(() => {
    result.current.createFile("/index.js", originalContent);
  });

  const backendFormat = result.current.toBackendFormat();

  act(() => {
    result.current.clearFileSystem();
    result.current.fromBackendFormat(backendFormat);
  });

  const file = result.current.fileSystem.get("/index.js");
  expect(file?.content.join("\n")).toBe(originalContent);
});
```

**Run command**: `cd frontend && npm run test -- useFileSystem`

---

### TDD Execution Order

| Order | Test File | Test Name | Status |
|-------|-----------|-----------|--------|
| 1 | `test_assistant_service.py` | `test_assistant_with_file_system_property` | [x] |
| 2 | `test_assistant_service.py` | `test_assistant_file_system_defaults_to_empty_dict` | [x] |
| 3 | `test_assistant_service.py` | `test_update_persists_file_system` | [x] |
| 4 | `test_assistant_service.py` | `test_get_returns_file_system` | [x] |
| 5 | `test_assistant_service.py` | `test_publish_syncs_file_system_to_public` | [x] |
| 6 | `test_public_assistants.py` | `test_create_assistant_with_file_system` | [x] |
| 7 | `test_public_assistants.py` | `test_update_assistant_file_system` | [x] |
| 8 | `useFileSystem.test.ts` | `toBackendFormat` | [x] |
| 9 | `useFileSystem.test.ts` | `fromBackendFormat` | [x] |
| 10 | `useFileSystem.test.ts` | `round-trip conversion` | [x] |

---

## User Stories

- As a user, I want to attach files to my agent so that the agent has persistent context across conversations.
- As a user, I want to edit files associated with my agent so that I can update the agent's file-based knowledge.
- As a developer, I want to retrieve files from an agent so that I can display or manipulate them in the UI.

## Acceptance Criteria

- [x] Backend: `Assistant` model includes `file_system: Dict[str, str]` property (path -> content)
- [x] Backend: `AssistantService.update()` persists `file_system` to the store
- [x] Frontend: `useFileSystem` hook can sync files to/from the assistant's `file_system`
- [x] API: Create/Update assistant endpoints accept and persist `file_system` data
- [x] API: Search/Get assistant endpoints return `file_system` data
- [x] Files persist across sessions when associated with an assistant

## Technical Requirements

### Backend Schema (`backend/src/schemas/entities/llm.py`)

The `Assistant` model now includes:
```python
file_system: Optional[Dict[str, str]] = Field(
    default_factory=dict,
    description="File system storage for the assistant. Key is the file path, value is the file content.",
)
```

### Backend Service (`backend/src/services/assistant.py`)

- `AssistantService.update()` already handles arbitrary dict data via `assistant.model_dump()`
- Files are stored in the LangGraph store under the assistant's namespace
- Public assistants sync `file_system` to the public namespace when published

### Frontend Hook (`frontend/src/hooks/useFileSystem.ts`)

Existing `FileData` interface:
```typescript
interface FileData {
  content: string[];      // Lines of file content
  created_at: string;
  modified_at: string;
  source?: string;        // Message ID that generated this file
}
```

New functions needed:
```typescript
// Convert frontend format to backend format
toBackendFormat(): Record<string, string>

// Import from backend format
fromBackendFormat(data: Record<string, string>): void
```

### API Routes (`backend/src/routes/v0/assistant.py`)

- `POST /assistants` - Create with `file_system`
- `PUT /assistants/{id}` - Update with `file_system`
- `POST /assistants/search` - Returns `file_system` in response

## Implementation Notes

1. **Data Flow**:
   - Frontend collects files via `useFileSystem.toBackendFormat()`
   - API persists `file_system` dict on assistant
   - On load, `useFileSystem.fromBackendFormat()` converts back

2. **Storage**: Uses LangGraph's `AsyncPostgresStore` with namespace `(user_id, "assistants")`

3. **Size Considerations**: Large file systems may impact performance; consider size limits for future iterations.

## Dependencies

- LangGraph store infrastructure (already in place)
- Frontend `useFileSystem` hook (already implemented)
- Backend `AssistantService` (already implemented)

## Out of Scope

- Binary file support (images, PDFs, etc.)
- File versioning/history
- File size limits enforcement
- Shared file systems between assistants
- File compression or chunking

## Success Metrics

- Users can save files to an assistant and retrieve them in subsequent sessions
- File data round-trips correctly between frontend and backend
- No performance degradation for assistants with reasonable file counts

## Additional Context

### Existing Code Locations

| Component | Path |
|-----------|------|
| Assistant Model | `backend/src/schemas/entities/llm.py:92` |
| Assistant Service | `backend/src/services/assistant.py:18` |
| Assistant Routes | `backend/src/routes/v0/assistant.py` |
| useFileSystem Hook | `frontend/src/hooks/useFileSystem.ts` |
| Backend Unit Tests | `backend/tests/unit/services/test_assistant_service.py` |
| Backend Integration Tests | `backend/tests/integration/test_public_assistants.py` |
| Frontend Hook Tests | `frontend/src/tests/hooks/useFileSystem.test.ts` |

### Related Frontend State

The `ChatContext` already manages file system state via `useFileSystem` hook. Files marked with `source: "__user_files__"` are user-created and should sync to the assistant.

Output <promise>DONE</promise> when all tests green." --max-iterations 50 --completion-promise "DONE"