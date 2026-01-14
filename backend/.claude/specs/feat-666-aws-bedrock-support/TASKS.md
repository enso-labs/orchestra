# Implementation Tasks: AWS Bedrock Support via init_chat_model

**Feature:** Issue #666 - Support AWS Bedrock models via init_chat_model
**PR:** #668
**Council Decision:** GO - High Confidence
**Date:** 2026-01-14

---

## Pre-Implementation

- [x] Verify `langchain[aws]>=1.2.0` in pyproject.toml
  - Files: `backend/pyproject.toml`
  - Acceptance: Dependency already present
  - Notes: Already completed by user

- [x] Review REVIEW.md council decisions
  - Files: `.claude/specs/feat-666-aws-bedrock-support/REVIEW.md`
  - Acceptance: Understand key decisions (bedrock_converse prefix, AWS_BEDROCK_REGION enablement)

---

## Core Implementation

### Task 1: Add AWS_BEDROCK_REGION to UserTokenKey enum
- [x] Add `AWS_BEDROCK_REGION` to `UserTokenKey` enum class
  - Files: `src/constants/__init__.py`
  - Acceptance: Enum member exists, accessible via `UserTokenKey.AWS_BEDROCK_REGION`

### Task 2: Add AWS_BEDROCK_REGION environment variable
- [x] Add environment variable loading for AWS_BEDROCK_REGION
  - Files: `src/constants/__init__.py`
  - Acceptance: `AWS_BEDROCK_REGION = os.getenv(UserTokenKey.AWS_BEDROCK_REGION.value)`

### Task 3: Import AWS_BEDROCK_REGION in llm.py
- [x] Import `AWS_BEDROCK_REGION` from constants
  - Files: `src/constants/llm.py`
  - Acceptance: Import statement added to existing imports

### Task 4: Add Bedrock models to ChatModels enum
- [x] Add conditional Bedrock model definitions with `bedrock_converse:` prefix
  - Files: `src/constants/llm.py`
  - Acceptance: When `AWS_BEDROCK_REGION` is set, ChatModels includes Bedrock models
  - Models added:
    - `BEDROCK_CLAUDE_3_5_SONNET` = `bedrock_converse:anthropic.claude-3-5-sonnet-20241022-v2:0`
    - `BEDROCK_CLAUDE_3_5_HAIKU` = `bedrock_converse:anthropic.claude-3-5-haiku-20241022-v1:0`
    - `BEDROCK_CLAUDE_3_SONNET` = `bedrock_converse:anthropic.claude-3-sonnet-20240229-v1:0`
    - `BEDROCK_CLAUDE_3_HAIKU` = `bedrock_converse:anthropic.claude-3-haiku-20240307-v1:0`
    - `BEDROCK_TITAN_TEXT_PREMIER` = `bedrock_converse:amazon.titan-text-premier-v1:0`
    - `BEDROCK_LLAMA_3_2_90B` = `bedrock_converse:meta.llama3-2-90b-instruct-v1:0`
    - `BEDROCK_MISTRAL_LARGE` = `bedrock_converse:mistral.mistral-large-2407-v1:0`

### Task 5: Update get_all_models() to include Bedrock
- [x] Add Bedrock to `get_all_models()` function
  - Files: `src/constants/llm.py`
  - Acceptance: When `AWS_BEDROCK_REGION` is set, Bedrock models appear in `get_all_models()` output
  - Implementation: Added `if AWS_BEDROCK_REGION:` block before Ollama using `amazon-bedrock` provider

---

## Configuration

### Task 6: Update .example.env with Bedrock configuration
- [x] Add AWS Bedrock configuration section to example env
  - Files: `backend/.example.env`
  - Acceptance: Contains `AWS_BEDROCK_REGION` with documentation
  - Content:
    ```
    # AWS Bedrock (requires AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in environment)
    # Set this to your preferred AWS region to enable Bedrock models
    # AWS_BEDROCK_REGION=us-east-1
    ```

---

## Verification

### Task 7: Run make format
- [x] Format code with Ruff
  - Files: All modified files
  - Acceptance: No formatting errors
  - Command: `make format`
  - Result: 1 file reformatted, 156 files left unchanged

### Task 8: Run make test
- [x] Verify no regressions in test suite
  - Files: All tests
  - Acceptance: All existing tests pass
  - Command: `make test`
  - Result: 120 passed, 2 skipped, 3 warnings in 6.18s

### Task 9: Manual verification (requires AWS credentials)
- [ ] Verify init_chat_model works with Bedrock
  - Acceptance: Can initialize a Bedrock model without errors
  - Test: `python -c "from langchain.chat_models import init_chat_model; m = init_chat_model('bedrock_converse:anthropic.claude-3-haiku-20240307-v1:0'); print(m)"`
  - Note: Requires AWS credentials configured (skipped - user can verify with their own credentials)

---

## Completion Signature

- **Total Tasks:** 9
- **Estimated Effort:** ~2-3 hours
- **Dependencies:** AWS credentials for manual verification only
- **Files Modified:**
  - `src/constants/__init__.py`
  - `src/constants/llm.py`
  - `.example.env`

---

## Progress Log

- [x] Task 1: Completed 2026-01-14 - Added `AWS_BEDROCK_REGION` to `UserTokenKey` enum
- [x] Task 2: Completed 2026-01-14 - Added `AWS_BEDROCK_REGION` environment variable
- [x] Task 3: Completed 2026-01-14 - Imported `AWS_BEDROCK_REGION` in llm.py
- [x] Task 4: Completed 2026-01-14 - Added 7 Bedrock models to `ChatModels` enum
- [x] Task 5: Completed 2026-01-14 - Updated `get_all_models()` with Bedrock support
- [x] Task 6: Completed 2026-01-14 - Updated `.example.env` with Bedrock documentation
- [x] Task 7: Completed 2026-01-14 - Formatted code with Ruff
- [x] Task 8: Completed 2026-01-14 - All tests passing (120 passed)

---

## Validation Results

**Status:** PASS

**Functional Verification:**
- [x] All acceptance criteria from TASKS.md met
- [x] Feature works as specified - Bedrock models conditionally added when AWS_BEDROCK_REGION is set
- [x] Follows existing patterns for provider enablement (matches OLLAMA_BASE_URL pattern)

**Code Quality:**
- [x] Follows codebase conventions
- [x] No linting errors (Ruff format passed)
- [x] Clean git history

**Test Coverage:**
- [x] All 120 tests passing, 2 skipped, 3 warnings (pre-existing deprecation warnings)
- [x] No regressions introduced

**Files Modified:**
- `src/constants/__init__.py` - Added UserTokenKey enum member and environment variable
- `src/constants/llm.py` - Added import, ChatModels enum members, get_all_models() update
- `.example.env` - Added AWS Bedrock configuration documentation

**Notes:**
- Task 9 (manual AWS verification) skipped - requires user's AWS credentials
- Used `bedrock_converse:` prefix as per council decision for better tool calling support
- Used `amazon-bedrock` provider in models.dev API for dynamic model discovery
