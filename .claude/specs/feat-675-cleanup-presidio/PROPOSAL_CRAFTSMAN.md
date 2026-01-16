# PROPOSAL: CRAFTSMAN
## GitHub Issue #675: CLEANUP - Remove Presidio Service

---

## EXECUTIVE SUMMARY

The Presidio service has been completely replaced by the PIIMiddleware for PII detection and masking. This proposal outlines the systematic removal of all Presidio-related code across the backend Python services, frontend TypeScript components, and schemas while ensuring no orphaned code remains. The removal is low-risk because PIIMiddleware already handles all PII operations.

---

## CODE QUALITY ANALYSIS

### Dead Code Inventory

| Item | Location | Type | Impact |
|------|----------|------|--------|
| `PresidioService` class | `backend/src/services/presidio.py` | Unused service | Remove |
| `PresidioConfig` class | `backend/src/services/presidio.py` | Unused model | Remove |
| `PresidioException` class | `backend/src/services/presidio.py` | Unused exception | Remove |
| `process_presidio()` function | `backend/src/services/presidio.py` | Unused function | Remove |
| `PresidioRequest` schema | `backend/src/schemas/entities/llm.py` | Commented out | Remove |
| Presidio service import/init | `backend/src/contexts/service.py` | Unused | Remove |
| `PresidioException` handler | `backend/src/routes/v0/llm.py` | Dead handler | Remove |
| Presidio constants | `backend/src/constants/__init__.py` | Unused env vars | Remove |
| Empty schema file | `backend/src/schemas/entities/presidio.py` | Empty | Delete |
| Frontend Presidio type | `frontend/src/lib/services/threadService.ts` | Dead type | Remove |
| Agent presidio field | `frontend/src/lib/services/agentService.ts` | Dead field | Remove |
| Frontend state management | `frontend/src/hooks/useAgent.ts` | Dead state | Remove |
| Frontend payload field | `frontend/src/hooks/useChat.ts` | Dead field | Remove |

### Import Cleanup Needed

**Backend Python:**
- Remove: `from src.services.presidio import PresidioService` (in `service.py`)
- Remove: `from src.services.presidio import PresidioException` (in `llm.py`)

---

## IMPLEMENTATION STRATEGY

### Phase 1: Backend Python Cleanup

#### Step 1.1: Remove Presidio Service File
- **Action**: Delete `/backend/src/services/presidio.py`

#### Step 1.2: Delete Empty Presidio Schema File
- **Action**: Delete `/backend/src/schemas/entities/presidio.py`

#### Step 1.3: Clean Up Constants
- **File**: `/backend/src/constants/__init__.py`
- **Remove lines 97-100**:
```python
# Presidio
PRESIDIO_ANALYZE_HOST = os.getenv("PRESIDIO_ANALYZE_HOST")
PRESIDIO_ANONYMIZE_HOST = os.getenv("PRESIDIO_ANONYMIZE_HOST")
PRESIDIO_API_KEY = os.getenv("PRESIDIO_API_KEY")
```

#### Step 1.4: Remove Service Context Initialization
- **File**: `/backend/src/contexts/service.py`
- Remove line 12: `from src.services.presidio import PresidioService`
- Remove line 42: `self.presidio_service = PresidioService()`

#### Step 1.5: Remove Unused PresidioRequest Schema
- **File**: `/backend/src/schemas/entities/llm.py`
- Remove lines 25-31: `PresidioRequest` class definition
- Remove line 213: Commented presidio field

#### Step 1.6: Remove Dead Exception Handler
- **File**: `/backend/src/routes/v0/llm.py`
- Remove line 22: `from src.services.presidio import PresidioException`
- Remove lines 133-140: Exception handler block

### Phase 2: Frontend TypeScript Cleanup

#### Step 2.1: Remove Presidio Type from Thread Service
- **File**: `/frontend/src/lib/services/threadService.ts`
- Remove lines 105-109: `type Presidio` definition
- Remove line 123: `presidio?: Presidio;` from interface

#### Step 2.2: Remove Presidio Field from Agent Service
- **File**: `/frontend/src/lib/services/agentService.ts`
- Remove lines 29-33: `presidio?: {...}` field

#### Step 2.3: Clean Up Agent Hook State
- **File**: `/frontend/src/hooks/useAgent.ts`
- Remove lines 25-29: `presidio` from `INIT_AGENT_STATE`
- Remove presidio-related state management

#### Step 2.4: Clean Up Chat Hook Payload
- **File**: `/frontend/src/hooks/useChat.ts`
- Remove presidio field from payload construction

---

## DESIGN DECISIONS

### Decision 1: PIIMiddleware is the Replacement
The middleware.py file imports and uses `PIIMiddleware` from `langchain.agents.middleware`. It handles:
- Credit card masking
- API key blocking
- Applied via `init_default_middleware()`

### Decision 2: Complete File Deletion
Delete completely rather than keep empty files:
- Empty files create confusion
- No historical value (git preserves history)
- Cleaner codebase structure

### Decision 3: No Database Migrations Needed
Presidio fields were never persisted to database - they were request-time parameters only.

### Decision 4: No API Contract Breaking
Frontend still sends `presidio` fields but backend ignores them. Safe to remove frontend references.

---

## RISK ASSESSMENT

### Potential Breaking Changes: NONE

1. Presidio service is not called in active code flow
2. `PresidioException` handler is unreachable
3. Frontend's presidio fields are unused by backend
4. PIIMiddleware is already active
5. No database schema dependencies

### Verification Checklist

- [ ] Confirm PIIMiddleware is working
- [ ] Run full test suite
- [ ] Check for cached imports
- [ ] Verify no integration tests rely on Presidio

---

## ESTIMATED COMPLEXITY

### Scope: **SMALL**

**Total Changes**:
- Files deleted: 2
- Files modified: 6 (backend: 4, frontend: 2)
- Total lines removed: ~60-70 lines

### Risk Level: **LOW**

1. No code actively uses Presidio (dead code removal)
2. Replacement is already in place
3. No breaking API changes
4. No database schema changes
5. Well-isolated changes

---

## DELIVERABLES

After implementation:

- [ ] All Presidio imports removed from backend
- [ ] Both Presidio files deleted
- [ ] Frontend type definitions removed
- [ ] Frontend state management cleaned up
- [ ] Frontend payload fields removed
- [ ] Constants file cleaned up
- [ ] All tests pass
- [ ] Code formatted
