# HITL (Human-In-The-Loop) Implementation Proposal for Orchestra

## Agent 5: THE INTEGRATOR - API Design & Frontend Integration Analysis

---

## 1. Executive Summary

This proposal recommends implementing HITL support through a **streaming interrupt pattern** that leverages the existing SSE infrastructure. When an agent requires human approval before executing a sensitive tool, the backend will emit a special `interrupt` event type through the stream, pause graph execution, and wait for a user decision via a new resume endpoint. The frontend will intercept these events and display an approval dialog, allowing users to approve, edit parameters, or reject the tool call before resuming execution.

---

## 2. API Design

### 2.1 New Endpoints

#### `POST /api/threads/{thread_id}/resume`

Resume a paused graph execution after human decision.

**Request Body:**
```python
class InterruptDecision(BaseModel):
    interrupt_id: str
    action: Literal["approve", "reject", "edit"]
    edited_args: Optional[dict] = None
    reason: Optional[str] = None
```

**Response (Success):**
```json
{
  "status": "resumed",
  "interrupt_id": "int_abc123",
  "thread_id": "thread_xyz789"
}
```

#### `GET /api/threads/{thread_id}/interrupts`

List pending interrupts for a thread.

**Response:**
```json
{
  "interrupts": [{
    "interrupt_id": "int_abc123",
    "tool_name": "execute_code",
    "tool_args": {"code": "..."},
    "reason": "Requires approval",
    "created_at": "2026-01-16T10:30:00Z",
    "status": "pending"
  }]
}
```

### 2.2 Schema Modifications

#### Extend Assistant Model

```python
class HITLConfig(BaseModel):
    enabled: bool = False
    tools_requiring_approval: list[str] = []
    auto_approve_threshold: Optional[float] = None  # 0-1
    timeout_seconds: int = 300
    default_action: Literal["approve", "reject", "timeout"] = "timeout"

class Assistant(BaseModel):
    # ... existing fields ...
    hitl: Optional[HITLConfig] = None
```

#### New Interrupt Entity

```python
class Interrupt(BaseModel):
    id: str
    thread_id: str
    checkpoint_id: str
    tool_name: str
    tool_args: dict[str, Any]
    tool_call_id: str
    reason: str
    status: Literal["pending", "approved", "rejected", "edited", "timeout"]
    created_at: datetime
    resolved_at: Optional[datetime] = None
    decision: Optional[dict] = None
```

### 2.3 SSE Response Format for Interrupts

```typescript
interface InterruptEvent {
  type: "interrupt";
  data: {
    interrupt_id: string;
    tool_name: string;
    tool_args: Record<string, unknown>;
    tool_description?: string;
    reason: string;
    timeout_at: string;  // ISO timestamp
    checkpoint_id: string;
  };
}
```

---

## 3. Frontend Integration

### 3.1 Component Changes

#### New: `InterruptApprovalDialog.tsx`

```typescript
interface InterruptApprovalDialogProps {
  interrupt: InterruptData | null;
  onApprove: () => void;
  onReject: (reason?: string) => void;
  onEdit: (editedArgs: Record<string, unknown>) => void;
  isOpen: boolean;
  onClose: () => void;
}
```

Features:
- Countdown timer to timeout
- JSON/form editor for args modification
- Approve/Edit/Reject buttons

### 3.2 State Management Updates

#### Extend ChatContext

```typescript
type ChatContextType = {
  // ... existing types ...

  // HITL state
  pendingInterrupt: InterruptData | null;
  setPendingInterrupt: (interrupt: InterruptData | null) => void;
  resolveInterrupt: (decision: InterruptDecision) => Promise<void>;
  interruptHistory: InterruptData[];
};
```

#### Extend useChat Hook

```typescript
// Handler for interrupt events
const handleInterruptEvent = (data: InterruptEventData) => {
  const interrupt: InterruptData = { ...data, receivedAt: new Date() };
  setPendingInterrupt(interrupt);
  setInterruptHistory(prev => [...prev, interrupt]);
  setLoadingMessage(`Awaiting approval for ${data.tool_name}...`);
};

// Resolve interrupt via API
const resolveInterrupt = async (decision: InterruptDecision) => {
  if (!pendingInterrupt) return;

  const response = await apiClient.post(
    `/threads/${metadata.thread_id}/resume`,
    decision
  );

  if (response.status === 200) {
    setPendingInterrupt(null);
    setLoadingMessage("Resuming execution...");
  }
};
```

### 3.3 User Flow Design

```
1. User sends message
       │
       ▼
2. Agent encounters tool requiring approval
       │
       ▼
3. Backend emits "interrupt" SSE event, pauses graph
       │
       ▼
4. Frontend shows InterruptApprovalDialog
   ┌──────────────────────────────────────────┐
   │  Tool: execute_code                       │
   │  ────────────────────────                 │
   │  Args:                                    │
   │  {                                        │
   │    "code": "import subprocess...",        │
   │    "language": "python"                   │
   │  }                                        │
   │                                           │
   │  Time remaining: 4:32                     │
   │                                           │
   │  [Approve] [Edit] [Reject]                │
   └──────────────────────────────────────────┘
       │
       ▼
5a. Approve → POST /resume {action: "approve"}
5b. Edit → User modifies → POST /resume {action: "edit", edited_args: {...}}
5c. Reject → POST /resume {action: "reject", reason: "..."}
5d. Timeout → Based on hitl.default_action
       │
       ▼
6. Stream continues with result
```

---

## 4. Implementation Approach

### 4.1 Backend Implementation Order

1. **Phase 1: Schema & Storage** (2-3 days)
   - Add `HITLConfig` to `Assistant` model
   - Create `Interrupt` entity and storage

2. **Phase 2: Graph Interrupt Logic** (3-4 days)
   - Interrupt detection in tool execution middleware
   - Checkpoint-aware pause mechanism
   - Timeout handling with background task

3. **Phase 3: API Endpoints** (2-3 days)
   - `POST /threads/{thread_id}/resume`
   - `GET /threads/{thread_id}/interrupts`
   - Update `stream_generator` for interrupt events

### 4.2 Frontend Implementation Order

1. **Phase 1: State Management** (1-2 days)
   - Extend `useChat.ts` with interrupt state
   - Add interrupt event handling

2. **Phase 2: UI Components** (2-3 days)
   - Create `InterruptApprovalDialog`
   - Add JSON/form editor for args

3. **Phase 3: Integration** (1-2 days)
   - Wire dialog into `ChatMessages`
   - Handle reconnection scenarios

---

## 5. Risk Assessment

### 5.1 Integration Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| SSE connection drops during interrupt | Medium | High | Store state server-side; poll `/interrupts` on reconnect |
| Race condition: user decides after timeout | Medium | Medium | Server validates status before processing |
| Checkpoint corruption on resume | Low | High | Validate integrity before resume; implement rollback |

### 5.2 Breaking Changes

**Minimal breaking changes expected:**
1. `Assistant` schema: Adding `hitl` field is additive
2. SSE Events: New `interrupt` type is additive
3. Stream Behavior: Only affects threads where `hitl.enabled = true`

---

## 6. Complexity Assessment

**Scope: Medium-Large**
**Risk Level: Medium**

### Key Files to Modify

**Backend:**
- `backend/src/schemas/entities/llm.py` - Add HITLConfig
- `backend/src/utils/stream.py` - Interrupt emission
- `backend/src/routes/v0/thread.py` - Resume endpoint
- `backend/src/flows/__init__.py` - Interrupt middleware

**Frontend:**
- `frontend/src/hooks/useChat.ts` - Interrupt state
- `frontend/src/lib/entities/stream.ts` - InterruptEvent type
- `frontend/src/components/lists/ChatMessages.tsx` - Dialog integration
- `frontend/src/context/ChatContext.tsx` - Interrupt state

### Estimated Timeline

| Phase | Duration |
|-------|----------|
| Backend Core | 5-7 days |
| Frontend Core | 3-5 days |
| UI Components | 2-3 days |
| Integration Testing | 2-3 days |
| **Total** | **12-18 days** |
