# User Stories

## Issue #675: CLEANUP: Presidio service has been replaced by a deepagent middleware. Remove Presidio from all apps where used.

### Story 1: Remove Presidio Dependencies
**As a** developer maintaining the Orchestra codebase,
**I want** all Presidio-related dependencies removed from the project,
**So that** the codebase is cleaner and we don't have unused dependencies increasing bundle size and maintenance burden.

**Acceptance Criteria:**
- [ ] All Presidio packages removed from `pyproject.toml` or `requirements.txt`
- [ ] No Presidio imports remain in any Python files
- [ ] Application builds successfully without Presidio dependencies

### Story 2: Remove Presidio Service Code
**As a** developer maintaining the Orchestra codebase,
**I want** all Presidio service implementations removed,
**So that** there's no dead code that could confuse future developers.

**Acceptance Criteria:**
- [ ] All Presidio service files deleted
- [ ] All Presidio-related schemas removed
- [ ] All Presidio-related routes/endpoints removed
- [ ] All Presidio-related controllers removed

### Story 3: Clean Up Middleware Configuration
**As a** developer maintaining the Orchestra codebase,
**I want** any Presidio references in middleware configuration removed,
**So that** the middleware configuration only contains active, working components.

**Acceptance Criteria:**
- [ ] Any Presidio middleware imports removed
- [ ] Any Presidio middleware registration removed
- [ ] The PIIMiddleware (deepagent replacement) continues to function correctly

### Story 4: Update Tests and Documentation
**As a** developer maintaining the Orchestra codebase,
**I want** all Presidio-related tests and documentation updated or removed,
**So that** our test suite and docs accurately reflect the current codebase.

**Acceptance Criteria:**
- [ ] Presidio-related tests removed or updated
- [ ] Any documentation referencing Presidio updated
- [ ] All existing tests pass after cleanup

## Notes
- The `PIIMiddleware` in `middleware.py` has already replaced Presidio functionality
- The existing middleware handles credit card masking and API key blocking
- Some email/API key patterns are currently commented out and may need review
