# Feature: inference-dictation (654)

## Summary

Add an option to the FileEditorPanel that allows users to dictate a prompt via voice, which is then sent to an LLM to generate file content. This extends the existing dictation feature (which inserts transcribed text into files) by adding an "inference mode" where the transcribed text becomes a prompt for LLM generation, and the generated output is written to the file system.

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

**File**: `backend/tests/unit/controllers/test_llm_controller.py`

**Test Framework**: `unittest.IsolatedAsyncioTestCase`

#### Test 1.1: LLM controller accepts file generation prompt
```python
async def test_llm_invoke_with_file_generation_prompt(self):
    """Test that LLM controller can process a file generation prompt."""
    payload = {
        "query": "Create a Python script that prints hello world",
        "assistant_id": "test-assistant",
        "thread_id": "test-thread",
        "generate_files": True,
    }
    # Mock graph invocation
    result = await llm_invoke(payload, user_id="test-user")
    self.assertIn("files", result)
```

#### Test 1.2: File generation includes target file path
```python
async def test_file_generation_with_target_path(self):
    """Test that file generation respects target file path."""
    payload = {
        "query": "Write a README for this project",
        "target_file": "/README.md",
        "generate_files": True,
    }
    result = await llm_invoke(payload, user_id="test-user")
    self.assertIn("/README.md", result.get("files", {}))
```

**Run command**: `cd backend && uv run pytest tests/unit/controllers/test_llm_controller.py -v`

---

### Phase 2: Backend Integration Tests

**File**: `backend/tests/integration/test_llm_routes.py`

**Test Framework**: `pytest` with `AsyncClient`

#### Test 2.1: Stream endpoint accepts generate_files flag
```python
@pytest.mark.asyncio
async def test_stream_with_generate_files(async_client: AsyncClient):
    """Test that /llm/stream accepts generate_files parameter."""
    # Login
    login_data = {"email": "admin@example.com", "password": "test1234"}
    response = await async_client.post("/api/auth/login", json=login_data)
    if response.status_code != 200:
        pytest.skip("Login failed")

    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "query": "Create a hello world script",
        "assistant_id": "test-assistant",
        "thread_id": "test-thread",
        "generate_files": True,
    }

    async with async_client.stream(
        "POST", "/api/llm/stream", json=payload, headers=headers
    ) as response:
        assert response.status_code == 200
```

#### Test 2.2: Generated files appear in stream values
```python
@pytest.mark.asyncio
async def test_generated_files_in_stream_values(async_client: AsyncClient):
    """Test that generated files appear in stream 'values' events."""
    # ... setup ...

    files_received = False
    async with async_client.stream(
        "POST", "/api/llm/stream", json=payload, headers=headers
    ) as response:
        async for line in response.aiter_lines():
            if line.startswith("data:"):
                data = json.loads(line[5:])
                if "files" in data:
                    files_received = True
                    break

    assert files_received
```

**Run command**: `cd backend && uv run pytest tests/integration/test_llm_routes.py -v`

---

### Phase 3: Frontend Unit Tests

**File**: `frontend/src/tests/components/FileEditorPanel.test.tsx`

**Test Framework**: Vitest with `@testing-library/react`

#### Test 3.1: Inference mode toggle exists
```typescript
describe("FileEditorPanel Inference Dictation", () => {
  it("should render inference mode toggle button", () => {
    render(<FileEditorPanel />);

    const inferenceToggle = screen.getByRole("button", { name: /inference mode/i });
    expect(inferenceToggle).toBeInTheDocument();
  });
});
```

#### Test 3.2: Inference mode changes dictation behavior
```typescript
it("should show 'Generate' indicator when inference mode is active", async () => {
  render(<FileEditorPanel />);

  const inferenceToggle = screen.getByRole("button", { name: /inference mode/i });
  await userEvent.click(inferenceToggle);

  expect(screen.getByText(/generate from voice/i)).toBeInTheDocument();
});
```

#### Test 3.3: Transcribed text sent to LLM in inference mode
```typescript
it("should send transcribed text to LLM when inference mode is active", async () => {
  const mockStreamThread = vi.fn();
  vi.mock("@/services/thread", () => ({
    streamThread: mockStreamThread,
  }));

  render(<FileEditorPanel />);

  // Enable inference mode
  const inferenceToggle = screen.getByRole("button", { name: /inference mode/i });
  await userEvent.click(inferenceToggle);

  // Simulate transcription complete
  // ... trigger dictation flow ...

  expect(mockStreamThread).toHaveBeenCalledWith(
    expect.objectContaining({
      generate_files: true,
    })
  );
});
```

#### Test 3.4: Generated files appear in file system
```typescript
it("should add generated files to file system", async () => {
  const { result } = renderHook(() => useChatContext());

  // Simulate LLM stream with files
  act(() => {
    result.current.handleStreamValues({
      files: {
        "/generated.py": "print('hello')",
      },
    });
  });

  expect(result.current.fileSystem.has("/generated.py")).toBe(true);
});
```

**Run command**: `cd frontend && npm run test -- FileEditorPanel`

---

### Phase 4: Frontend Hook Tests

**File**: `frontend/src/tests/hooks/useInferenceDictation.test.ts`

**Test Framework**: Vitest with `@testing-library/react`

#### Test 4.1: Hook manages inference mode state
```typescript
describe("useInferenceDictation", () => {
  it("should toggle inference mode", () => {
    const { result } = renderHook(() => useInferenceDictation());

    expect(result.current.inferenceMode).toBe(false);

    act(() => {
      result.current.toggleInferenceMode();
    });

    expect(result.current.inferenceMode).toBe(true);
  });
});
```

#### Test 4.2: Hook provides target file context
```typescript
it("should include active file as context", () => {
  const { result } = renderHook(() => useInferenceDictation({
    activeFile: "/src/main.py",
    fileContent: "existing code here",
  }));

  const payload = result.current.buildPayload("Add error handling");

  expect(payload.context).toContain("/src/main.py");
  expect(payload.context).toContain("existing code here");
});
```

**Run command**: `cd frontend && npm run test -- useInferenceDictation`

---

### TDD Execution Order

| Order | Test File | Test Name | Status |
|-------|-----------|-----------|--------|
| 1 | `test_llm_controller.py` | `test_llm_invoke_with_file_generation_prompt` | [ ] |
| 2 | `test_llm_controller.py` | `test_file_generation_with_target_path` | [ ] |
| 3 | `test_llm_routes.py` | `test_stream_with_generate_files` | [ ] |
| 4 | `test_llm_routes.py` | `test_generated_files_in_stream_values` | [ ] |
| 5 | `FileEditorPanel.test.tsx` | `should render inference mode toggle button` | [ ] |
| 6 | `FileEditorPanel.test.tsx` | `should show Generate indicator when inference mode is active` | [ ] |
| 7 | `FileEditorPanel.test.tsx` | `should send transcribed text to LLM when inference mode is active` | [ ] |
| 8 | `FileEditorPanel.test.tsx` | `should add generated files to file system` | [ ] |
| 9 | `useInferenceDictation.test.ts` | `should toggle inference mode` | [ ] |
| 10 | `useInferenceDictation.test.ts` | `should include active file as context` | [ ] |

---

## User Stories

- As a user, I want to dictate what I want the LLM to generate so that I can create file content hands-free.
- As a user, I want the generated content to appear in my file editor so that I can review and edit it immediately.
- As a user, I want to provide context from my current file so that the LLM generates relevant content.

## Acceptance Criteria

- [ ] FileEditorPanel has an "Inference Mode" toggle next to the dictation button
- [ ] When inference mode is ON, dictated text is sent as a prompt to the LLM
- [ ] LLM-generated files appear in the file system and can be viewed/edited
- [ ] Active file content is included as context for generation
- [ ] User can specify a target file path for generated content
- [ ] Loading/generating state is clearly indicated to the user
- [ ] Errors during transcription or generation are handled gracefully

## Technical Requirements

### Frontend Changes

**FileEditorPanel** (`frontend/src/components/panels/FileEditorPanel.tsx`):
- Add `inferenceMode` state toggle
- Modify dictation flow to branch based on mode:
  - Normal mode: Insert transcribed text into active file (existing behavior)
  - Inference mode: Send transcribed text to LLM stream endpoint with `generate_files: true`
- Add UI indicator for inference mode (icon/badge on dictation button)

**New Hook** (`frontend/src/hooks/useInferenceDictation.ts`):
```typescript
interface UseInferenceDictationOptions {
  activeFile?: string;
  fileContent?: string;
}

interface UseInferenceDictationReturn {
  inferenceMode: boolean;
  toggleInferenceMode: () => void;
  buildPayload: (transcript: string) => StreamPayload;
  isGenerating: boolean;
}
```

**Chat/Stream Integration**:
- Leverage existing `streamThread()` service
- Use "values" stream mode to receive generated files
- Files sync through existing `filesMap` → `fileSystem` mechanism

### Backend Changes

**LLM Routes** (`backend/src/routes/v0/llm.py`):
- Add optional `generate_files: bool` parameter to stream payload
- Add optional `target_file: str` parameter for targeted generation
- Add optional `file_context: str` parameter for active file content

**LLM Controller** (`backend/src/controllers/llm.py`):
- When `generate_files=True`, modify system prompt to instruct file generation
- Ensure files are properly formatted in stream response

**Schema Updates** (`backend/src/schemas/`):
```python
class StreamPayload(BaseModel):
    # ... existing fields ...
    generate_files: Optional[bool] = False
    target_file: Optional[str] = None
    file_context: Optional[str] = None
```

## Implementation Notes

1. **Data Flow**:
   ```
   User speaks → Audio recorded → /llm/transcribe → Transcript
   → (if inference mode) → /llm/stream with generate_files=True
   → LLM generates → Files in stream values
   → filesMap updated → fileSystem synced → FileEditorPanel displays
   ```

2. **System Prompt for Generation**:
   - Include active file path and content as context
   - Instruct LLM to generate file content
   - Specify output format for file generation

3. **UX Considerations**:
   - Clear visual distinction between dictation modes
   - Progress indicator during generation
   - Option to cancel generation
   - Preview before accepting generated content (future enhancement)

## Dependencies

- Existing dictation infrastructure (`react-voice-visualizer`)
- Existing transcription endpoint (`/llm/transcribe`)
- Existing stream infrastructure (`/llm/stream`, SSE)
- Existing file sync mechanism (`filesMap` ↔ `fileSystem`)

## Out of Scope

- Multi-file generation from single prompt
- Voice commands for file operations (save, delete, rename)
- Real-time streaming of generated content (word-by-word)
- Voice-based editing commands (replace line X, delete function Y)
- Custom system prompts for generation
- Generation history/undo

## Success Metrics

- Users can successfully generate file content via voice dictation
- Generated content appears in file editor within 5 seconds of transcription
- Error rate for transcription + generation flow < 5%
- User satisfaction with generated content quality

## Additional Context

### Existing Code Locations

| Component | Path |
|-----------|------|
| FileEditorPanel | `frontend/src/components/panels/FileEditorPanel.tsx` |
| useFileSystem Hook | `frontend/src/hooks/useFileSystem.ts` |
| useChat Hook | `frontend/src/hooks/useChat.ts` |
| ChatContext | `frontend/src/contexts/ChatContext.tsx` |
| LLM Routes | `backend/src/routes/v0/llm.py` |
| LLM Controller | `backend/src/controllers/llm.py` |
| Transcription Utility | `backend/src/utils/llm.py` |
| Stream Schemas | `backend/src/schemas/routes/llm.py` |

### Existing Dictation Code (FileEditorPanel lines 124-210)

The current dictation flow:
1. User clicks dictation button
2. `react-voice-visualizer` records audio
3. On stop, audio blob sent to `/llm/transcribe`
4. Transcript text inserted at cursor in active file

### Related Branch

`origin/feat/646-add-dictation-file-panel` - Contains initial dictation implementation
