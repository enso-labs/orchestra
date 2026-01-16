# Human-In-The-Loop (HITL) Implementation Proposal

## Agent 2: THE CRAFTSMAN - Clean Code Perspective

---

## 1. Executive Summary

This proposal recommends implementing HITL support through a **Strategy-based Interrupt Handler Pattern** that cleanly separates interrupt detection, user decision capture, and graph resumption. The design adheres to SOLID principles, integrates seamlessly with the existing service layer architecture, and introduces minimal breaking changes while providing maximum extensibility for future interrupt types.

---

## 2. Architectural Analysis

### 2.1 Current Code Quality Assessment

**Strengths Identified:**
1. Well-structured service layer with `ServiceContext` dependency injection
2. Existing `add_human_in_the_loop()` wrapper foundation
3. Clean Pydantic schema design with computed fields and validators
4. Robust streaming architecture with proper mode multiplexing
5. Well-organized React context providers

**Areas for Improvement:**
1. Incomplete interrupt flow - wrapper exists but not wired to configuration
2. Missing resume endpoint
3. No interrupt state persistence
4. Frontend SSE handler doesn't recognize interrupt events

### 2.2 Proposed Clean Code Patterns

| Pattern | Application | Rationale |
|---------|-------------|-----------|
| **Strategy Pattern** | Interrupt handlers (per decision type) | Different decisions require different processing logic |
| **Factory Pattern** | Tool wrapping with HITL | Consistent tool decoration |
| **Observer Pattern** | Frontend interrupt event subscription | Decouple detection from UI |
| **Repository Pattern** | Interrupt state persistence | Consistent data access |

---

## 3. Implementation Strategy

### 3.1 Code Organization

```
backend/
├── src/
│   ├── schemas/entities/
│   │   └── interrupt.py    # NEW: Interrupt-specific schemas
│   ├── services/
│   │   └── interrupt.py    # NEW: InterruptService
│   └── routes/v0/
│       └── thread.py       # Add resume endpoint

frontend/
├── src/
│   ├── components/modals/
│   │   └── InterruptModal/ # NEW: HITL decision UI
│   ├── hooks/
│   │   └── useInterrupt.ts # NEW: Interrupt state
│   └── lib/entities/
│       └── interrupt.ts    # NEW: TypeScript interfaces
```

### 3.2 Interface Definitions

#### Backend Schemas

```python
class InterruptTrigger(str, Enum):
    TOOL_CALL = "tool_call"
    SUBAGENT_HANDOFF = "subagent_handoff"
    HIGH_STAKES_ACTION = "high_stakes_action"

class DecisionType(str, Enum):
    APPROVE = "approve"
    EDIT = "edit"
    REJECT = "reject"
    RESPOND = "respond"

class InterruptConfig(BaseModel):
    triggers: list[InterruptTrigger]
    tool_names: Optional[list[str]]
    allow_approve: bool = True
    allow_edit: bool = True
    allow_reject: bool = True
```

#### Strategy Pattern for Handlers

```python
class InterruptHandler(ABC):
    @abstractmethod
    async def handle(self, interrupt, response, graph, config) -> dict:
        pass

class ApproveHandler(InterruptHandler):
    async def handle(self, interrupt, response, graph, config):
        return await graph.aupdate_state(config, values={"type": "accept"})

class EditHandler(InterruptHandler):
    async def handle(self, interrupt, response, graph, config):
        return await graph.aupdate_state(
            config,
            values={"type": "edit", "args": {"args": response.edited_args}}
        )

class RejectHandler(InterruptHandler):
    async def handle(self, interrupt, response, graph, config):
        return await graph.aupdate_state(
            config,
            values={"type": "response", "args": response.feedback}
        )
```

---

## 4. Design Decisions

### 4.1 Pattern Selections and Rationale

**Decision 1: Strategy Pattern for Interrupt Handlers**
- **Single Responsibility**: Each handler focuses on one decision type
- **Open/Closed Principle**: New decision types can be added without modifying existing handlers
- **Testability**: Each strategy can be unit tested in isolation

**Decision 2: Factory Pattern for Tool Wrapping**
- **Dependency Inversion**: Tools don't know about HITL
- **Liskov Substitution**: Wrapped tools remain interchangeable
- **Interface Segregation**: Tools only expose core functionality

**Decision 3: Observer Pattern for Frontend Events**
- **Loose Coupling**: Stream handler doesn't know about UI components
- **Single Point of Truth**: All interrupt state flows through `useInterrupt` hook
- **Reusability**: Same hook can be used in different UI contexts

### 4.2 Naming Conventions

| Domain | Convention | Examples |
|--------|------------|----------|
| Backend Schemas | `PascalCase` | `InterruptConfig` |
| Backend Services | `snake_case` | `handle_interrupt()` |
| Frontend Types | `PascalCase` | `InterruptRequest` |
| Frontend Hooks | `camelCase` with `use` | `useInterrupt` |

---

## 5. Risk Assessment

### 5.1 Code Smell Risks

| Risk | Mitigation |
|------|------------|
| God Object in ServiceContext | Create separate `InterruptService` |
| Primitive Obsession | Use Pydantic models throughout |
| Feature Envy | Keep controller thin, delegate to service |
| Shotgun Surgery | Centralize interrupt logic |

### 5.2 Refactoring Needs

**Required:**
1. Extend `CheckpointService.list_checkpoints()` with interrupt data
2. Modify `stream_generator()` to emit interrupt events
3. Extend `LLMRequest` schema with `resume_interrupt` field

---

## 6. Complexity Assessment

**Overall Scope: Medium**
**Overall Risk: Medium**

### Priority Order
1. Foundation schemas and storage
2. Service with handler strategies
3. API endpoints
4. Graph integration
5. Frontend components
6. Testing & documentation
