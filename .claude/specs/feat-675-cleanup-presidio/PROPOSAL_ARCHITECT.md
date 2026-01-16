# PROPOSAL: ARCHITECT
## GitHub Issue #675: CLEANUP - Remove Presidio Service

---

## EXECUTIVE SUMMARY

Presidio has been fully replaced by the LangChain `PIIMiddleware` that handles PII detection and blocking at the middleware layer. This proposal outlines a clean removal of all Presidio dependencies, service files, schema definitions, environment variables, and frontend integrations. The migration is **low-risk** because the replacement middleware is already integrated and Presidio code is not actively used.

---

## ARCHITECTURAL ANALYSIS

### Current State Assessment

**Presidio Implementation:**
- **Files:** 2 core files
  - `/backend/src/services/presidio.py` (137 lines) - Contains `PresidioService`, `PresidioConfig`, `PresidioException`
  - `/backend/src/schemas/entities/presidio.py` (1 line - empty file)

- **Dependencies:** Referenced in 6 locations
  1. `/backend/src/contexts/service.py` - Instantiates `PresidioService` (lines 12, 42)
  2. `/backend/src/routes/v0/llm.py` - Imports `PresidioException` (lines 22, 133-140)
  3. `/backend/src/constants/__init__.py` - Defines PRESIDIO_* constants (lines 97-100)
  4. `/backend/src/schemas/entities/llm.py` - Defines `PresidioRequest` class (lines 25-31, 213)
  5. `/frontend/src/lib/services/agentService.ts` - Type definition for `presidio` property
  6. `/frontend/src/hooks/useAgent.ts` - Test data includes presidio config

- **Middleware Replacement:** `/backend/src/utils/middleware.py`
  - Contains `pii_middleware()` function (lines 41-68)
  - Uses LangChain's `PIIMiddleware` class
  - Configured with credit card masking and API key blocking
  - Integrated into `init_default_middleware()` (lines 260-265)

### Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│  Incoming Request                               │
└────────────┬────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────┐
│  PIIMiddleware (ACTIVE - replacement)           │
│  • Credit card masking                          │
│  • API key blocking (sk-* pattern)              │
└────────────┬────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────┐
│  LLM Model Invocation                           │
│  (Data already sanitized)                       │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  DEAD CODE (to be removed)                      │
│  • PresidioService - never instantiated         │
│  • process_presidio() - never called            │
│  • PresidioRequest - commented out              │
│  • PresidioException - unused handler           │
└─────────────────────────────────────────────────┘
```

---

## IMPLEMENTATION STRATEGY

### Phase 1: Backend Removal

| Step | File | Action | Lines |
|------|------|--------|-------|
| 1.1 | `/backend/src/services/presidio.py` | DELETE | All (137) |
| 1.2 | `/backend/src/schemas/entities/presidio.py` | DELETE | All (1) |
| 1.3 | `/backend/src/contexts/service.py` | MODIFY | 12, 42 |
| 1.4 | `/backend/src/routes/v0/llm.py` | MODIFY | 22, 133-140 |
| 1.5 | `/backend/src/constants/__init__.py` | MODIFY | 97-100 |
| 1.6 | `/backend/src/schemas/entities/llm.py` | MODIFY | 25-31, 213 |

### Phase 2: Frontend Removal

| Step | File | Action |
|------|------|--------|
| 2.1 | `/frontend/src/lib/services/agentService.ts` | Remove presidio property |
| 2.2 | `/frontend/src/lib/services/threadService.ts` | Remove Presidio type |
| 2.3 | `/frontend/src/hooks/useAgent.ts` | Remove presidio test data |
| 2.4 | `/frontend/src/hooks/useChat.ts` | Remove presidio payload |

### Phase 3: Documentation

- Update README files to remove Presidio environment variables
- Update Changelog

---

## DESIGN DECISIONS

### Why Complete Removal is Safe

1. **Middleware-based approach is superior** - operates at model invocation layer
2. **Presidio code path is dead** - `process_presidio()` is never called
3. **No breaking changes** - presidio fields are optional and ignored
4. **Clear replacement** - PIIMiddleware is already active

### Alignment with Codebase Patterns

- Service Architecture: Consistent with removing unused service layers
- Schema Cleanup: Follows pattern of removing unused Pydantic models
- Middleware Pattern: Aligns with LangChain's recommended approach

---

## RISK ASSESSMENT

### Low-Risk Factors

1. Minimal active dependencies - only 6 import locations, none in critical path
2. No public API contracts - Presidio not exposed as endpoint parameters
3. Comprehensive test coverage
4. Dead code removal - reducing technical debt

### Potential Pitfalls

| Risk | Mitigation |
|------|-----------|
| Miss a hidden import | Grep thoroughly before/after |
| Break type checking | Run `npm run lint` |
| Environment dependencies | Update `.env.example` files |

---

## ESTIMATED COMPLEXITY

### Scope: **SMALL**

- Files to delete: 2
- Files to modify: 9
- Lines removed: ~200 total

### Risk Level: **LOW**

- No breaking schema changes
- No database migrations
- No active code depends on Presidio
- Full test coverage available
