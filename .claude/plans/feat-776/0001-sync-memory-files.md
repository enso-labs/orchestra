# Plan: Sync Memory Files to Filesystem (Issue #776)

## Context

Memory records are currently flat text entries (key=`memory_{uuid}`, value=`{content: "..."}`). The DeepAgents documentation standardizes on named files like `AGENTS.md` for memory. The issue asks to rework memory so **each memory IS a named file** (e.g., `AGENTS.md`, `USER.md`), and these files load into the filesystem panel when `/chat` opens.

**Goal:** When a user navigates to `/chat`, their memory files appear in the file editor panel. Memory CRUD operates on named files, not anonymous text records.

---

## Step 1: Update Memory Schema

**File:** `backend/src/schemas/entities/memory.py`

Add `path` to `MemoryCreate` and `enabled` to `Memory` for toggle support:

```python
class Memory(BaseModel):
    id: str
    content: str
    enabled: bool = True                       # NEW: toggle on/off from settings
    metadata: Optional[dict] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class MemoryCreate(BaseModel):
    content: str = Field(..., min_length=1)
    path: str = Field(..., min_length=1)       # e.g. "AGENTS.md", "USER.md"
    metadata: Optional[dict] = None

class MemoryUpdate(BaseModel):
    content: str = Field(..., min_length=1)
    metadata: Optional[dict] = None
    enabled: Optional[bool] = None             # NEW: allow toggling via update
    # path is NOT updatable — use delete + create to rename
```

`Memory.id` will now hold the file path instead of a UUID. `enabled` controls whether the file is loaded into the agent filesystem.

---

## Step 2: Update MemoryRepo to Use Path-Based Keys

**File:** `backend/src/repos/memory_repo.py`

Change `create()` to accept `path` and use it as the store key (upsert semantics):

```python
async def create(self, content: str, metadata: dict = None, path: str = "AGENTS.md") -> Memory:
    now = datetime.now()
    memory = Memory(
        id=path,                # path IS the id
        content=content,
        enabled=True,           # enabled by default
        metadata=metadata or {},
        created_at=now,
        updated_at=now,
    )
    await self._set(key=path, value=memory)
    return memory
```

Update `update()` to accept optional `enabled` parameter:

```python
async def update(self, memory_id: str, content: str, metadata: dict = None, enabled: bool = None) -> Memory:
    existing = await self.get(memory_id)
    if existing is None:
        return None
    updated = Memory(
        id=memory_id,
        content=content,
        enabled=enabled if enabled is not None else existing.enabled,
        metadata=metadata if metadata is not None else existing.metadata,
        created_at=existing.created_at,
        updated_at=datetime.now(),
    )
    await self._set(key=memory_id, value=updated)
    return updated
```

All other methods (`get`, `delete`, `list`) continue to work unchanged.

---

## Step 3: Update Memory Routes

**File:** `backend/src/routes/v0/memory.py`

### 3a: Update `create_memory` to pass `path`

```python
@router.post("", response_model=Memory, status_code=status.HTTP_201_CREATED)
async def create_memory(body: MemoryCreate, ...):
    repo = _get_repo(user, store)
    return await repo.create(content=body.content, metadata=body.metadata, path=body.path)
```

### 3b: Add `GET /files` endpoint (BEFORE `/{memory_id}` to avoid path capture)

Only returns **enabled** memory files, in the same structured format as `create_file_data()` from `deepagents.backends.utils`:

```python
from deepagents.backends.utils import create_file_data

@router.get("/files")
async def get_memory_files(
    user: ProtectedUser = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
) -> dict:
    repo = _get_repo(user, store)
    memories, _ = await repo.list(limit=1000)
    result = {}
    for m in memories:
        if not m.enabled:
            continue
        path = f"/{m.id}" if not m.id.startswith("/") else m.id
        result[path] = create_file_data(
            m.content,
            created_at=m.created_at.isoformat() if m.created_at else None,
        )
    return result
```

Returns the DeepAgents file data format:
```json
{
  "/AGENTS.md": {
    "content": ["line1", "line2"],
    "created_at": "2026-02-14T...",
    "modified_at": "2026-02-14T..."
  },
  "/USER.md": { ... }
}
```

This matches `files_map = {"/AGENTS.md": create_file_data(content)}` from the docs.

### 3c: Add `PATCH /memories/{memory_id}/toggle` endpoint for enable/disable

```python
@router.patch("/{memory_id}/toggle", response_model=Memory)
async def toggle_memory(
    memory_id: str,
    user: ProtectedUser = Depends(verify_credentials),
    store: BaseStore = Depends(get_store),
) -> Memory:
    repo = _get_repo(user, store)
    memory = await repo.get(memory_id)
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    updated = await repo.update(
        memory_id=memory_id,
        content=memory.content,
        metadata=memory.metadata,
        enabled=not memory.enabled,
    )
    return updated
```

### 3d: Update `update_memory` to pass `enabled`

```python
@router.put("/{memory_id}", response_model=Memory)
async def update_memory(memory_id, body: MemoryUpdate, ...):
    repo = _get_repo(user, store)
    memory = await repo.update(
        memory_id=memory_id,
        content=body.content,
        metadata=body.metadata,
        enabled=body.enabled,
    )
    ...
```

---

## Step 4: Update `prepare_memory_files()`

**File:** `backend/src/agents/__init__.py` (lines 73-107)

With file-based memories, each memory maps to its own file in the StateBackend:

```python
async def prepare_memory_files(user_id, memory_svc):
    if not user_id:
        return {}, None
    try:
        memories = await memory_svc.search()
    except Exception as exc:
        logger.warning(f"Failed to fetch memories for user {user_id}: {exc}")
        return {}, None
    if not memories:
        return {}, None

    files_map = {}
    sources = []
    for mem in memories:
        data = mem.dict()
        value = data.get("value", {})
        if isinstance(value, dict):
            # Skip disabled memories
            if not value.get("enabled", True):
                continue
            mem_id = value.get("id", "AGENTS.md")
            content = value.get("content", str(value))
        else:
            mem_id = "AGENTS.md"
            content = str(value)
        path = f"/{mem_id}" if not mem_id.startswith("/") else mem_id
        files_map[path] = create_file_data(content)
        sources.append(path)

    return files_map, sources if sources else None
```

**Key changes:**
1. Each memory file gets its own path in the filesystem (not concatenated into one `/AGENTS.md`)
2. Only `enabled` memories are included — disabled ones are skipped
3. The `memory` kwarg passed to `create_deep_agent()` becomes a list of all enabled file paths

---

## Step 5: Frontend — Add `getFiles()` to MemoryService

**File:** `frontend/src/lib/services/memoryService.ts`

Returns the structured FileData format matching `create_file_data()`:

```typescript
static async getFiles(): Promise<Record<string, FileData>> {
    const response = await apiClient.get(`${this.BASE_URL}/files`);
    return response.data;
}
```

Import `FileData` from `@/hooks/useFileSystem`.

---

## Step 6: Frontend — Load Memory Files on Chat Mount

**File:** `frontend/src/context/ChatContext.tsx`

Add import and `useEffect` after existing effects (~line 167):

```typescript
import MemoryService from "@/lib/services/memoryService";

// Load memory files into filesystem on mount
useEffect(() => {
    const loadMemoryFiles = async () => {
        try {
            const memoryFiles = await MemoryService.getFiles();
            if (memoryFiles && Object.keys(memoryFiles).length > 0) {
                // Convert Record<string, FileData> to Map<string, FileData> for importFiles()
                const filesMap = new Map(Object.entries(memoryFiles));
                importFiles(filesMap);
            }
        } catch (error) {
            console.error("Failed to load memory files:", error);
        }
    };
    loadMemoryFiles();
}, []);
```

Uses existing `importFiles()` from `useFileSystem.ts:256-276` which accepts `Map<string, FileData>`, merges with existing files, auto-opens as tabs, and sets first file as active. This matches the structured format returned by `create_file_data()` (`{content: string[], created_at, modified_at}`).

---

## Step 7: Frontend — Update Types & MemorySettings UI

### 7a: Update TypeScript entities

**File:** `frontend/src/lib/entities/memory.ts`

```typescript
export interface Memory {
    id: string;
    content: string;
    enabled: boolean;                          // NEW: toggle state
    metadata?: Record<string, any> | null;
    created_at?: string;
    updated_at?: string;
}

export interface MemoryCreateRequest {
    content: string;
    path: string;                              // NEW: file path
    metadata?: Record<string, any> | null;
}

export interface MemoryUpdateRequest {
    content: string;
    metadata?: Record<string, any> | null;
    enabled?: boolean;                         // NEW: toggle via update
}
```

### 7b: Add `toggle()` to MemoryService

**File:** `frontend/src/lib/services/memoryService.ts`

```typescript
static async toggle(memoryId: string): Promise<Memory> {
    const response = await apiClient.patch(`${this.BASE_URL}/${memoryId}/toggle`);
    return response.data;
}
```

### 7c: Update MemoryEditDialog

**File:** `frontend/src/components/settings/MemoryEditDialog.tsx`

- **Create mode**: Add a text input for "File name" (e.g., `AGENTS.md`, `USER.md`) + textarea for content
- **Edit mode**: Show the file name as read-only label + editable textarea for content

### 7d: Update MemorySettings

**File:** `frontend/src/components/settings/MemorySettings.tsx`

- Display the file path (memory `id`) as a label for each entry (e.g., `AGENTS.md`)
- Add a **toggle switch** (shadcn `Switch` component) on each memory row
- Toggle calls `MemoryService.toggle(memory.id)` and updates local state
- Visually dim disabled memories (e.g., `opacity-50`)

---

## Step 8: Update Tests

### Backend tests to update:

| Test file | Changes |
|-----------|---------|
| `backend/tests/unit/repos/test_memory_repo.py` | Pass `path` to `create()`, assert `id` equals path instead of UUID |
| `backend/tests/unit/routes/test_memory_routes.py` | Include `path` in POST body, add test for `GET /files` endpoint |
| `backend/tests/unit/agents/test_prepare_memory_files.py` | Update mock values to have `id` as path, assert multiple files returned |

### Frontend tests to update:

| Test file | Changes |
|-----------|---------|
| `frontend/src/tests/services/memoryService.test.ts` | Add test for `getFiles()`, update create payloads to include `path` |
| `frontend/src/components/settings/MemorySettings.test.tsx` | Update mock data with `path` field |

---

## Files Modified Summary

| File | Change Type |
|------|-------------|
| `backend/src/schemas/entities/memory.py` | Add `enabled` to Memory, `path` to MemoryCreate, `enabled` to MemoryUpdate |
| `backend/src/repos/memory_repo.py` | Accept `path` param in create, `enabled` param in update |
| `backend/src/routes/v0/memory.py` | Add `GET /files` (enabled-only), `PATCH /{id}/toggle`, pass `path` in create |
| `backend/src/agents/__init__.py` | Return per-file maps, skip disabled memories |
| `frontend/src/lib/entities/memory.ts` | Add `enabled` to Memory, `path` to MemoryCreateRequest |
| `frontend/src/lib/services/memoryService.ts` | Add `getFiles()` and `toggle()` methods |
| `frontend/src/context/ChatContext.tsx` | Add mount effect to load memory files |
| `frontend/src/components/settings/MemoryEditDialog.tsx` | Add path input field |
| `frontend/src/components/settings/MemorySettings.tsx` | Display file paths, add toggle switch |
| `backend/tests/unit/repos/test_memory_repo.py` | Update for path-based IDs and enabled field |
| `backend/tests/unit/routes/test_memory_routes.py` | Add `/files` and `/toggle` tests, update create payloads |
| `backend/tests/unit/agents/test_prepare_memory_files.py` | Update for multi-file output and enabled filtering |
| `frontend/src/tests/services/memoryService.test.ts` | Add `getFiles()` and `toggle()` tests |
| `frontend/src/components/settings/MemorySettings.test.tsx` | Update mock data, add toggle tests |

---

## Verification

### Backend
```bash
make test

# Manual validation:
# 1. Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "test1234"}'

# 2. Create memory files
curl -X POST http://localhost:8000/api/memories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"path": "AGENTS.md", "content": "# Agent Instructions\nBe helpful and concise."}'

curl -X POST http://localhost:8000/api/memories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"path": "USER.md", "content": "# User Preferences\nPrefers TypeScript."}'

# 3. Get memory files (only enabled)
curl -X GET http://localhost:8000/api/memories/files \
  -H "Authorization: Bearer <token>"
# Expected: {"/AGENTS.md": "...", "/USER.md": "..."}

# 4. Toggle a memory off
curl -X PATCH http://localhost:8000/api/memories/USER.md/toggle \
  -H "Authorization: Bearer <token>"
# Expected: {..., "enabled": false}

# 5. Get memory files again — USER.md should be excluded
curl -X GET http://localhost:8000/api/memories/files \
  -H "Authorization: Bearer <token>"
# Expected: {"/AGENTS.md": "..."}  (USER.md excluded)

# 6. Toggle back on
curl -X PATCH http://localhost:8000/api/memories/USER.md/toggle \
  -H "Authorization: Bearer <token>"
# Expected: {..., "enabled": true}

# 7. List all memories (shows both enabled and disabled)
curl -X GET http://localhost:8000/api/memories \
  -H "Authorization: Bearer <token>"
```

### Frontend
```bash
cd frontend && npm run test

# Manual validation:
# 1. Navigate to /chat — verify memory files appear in file editor panel
# 2. Go to Settings > Memories — verify toggle switches on each memory file
# 3. Toggle off a memory — verify it disappears from /chat file panel on refresh
# 4. Toggle back on — verify it reappears
```
