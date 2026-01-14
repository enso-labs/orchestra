# Council Review: AWS Bedrock Support Implementation

**Feature:** Support AWS Bedrock models via init_chat_model
**Issue:** #666
**PR:** #668
**Date:** 2026-01-14

---

## 1. Proposal Comparison Matrix

| Aspect | ARCHITECT | CRAFTSMAN | GUARDIAN | **Council Verdict** |
|--------|-----------|-----------|----------|---------------------|
| Provider Prefix | `bedrock:` | `bedrock_converse:` | `bedrock_converse:` | **`bedrock_converse:`** - better tool calling support |
| Credential Detection | `AWS_ACCESS_KEY_ID` | `AWS_BEDROCK_REGION` | `AWS_BEDROCK_*` (separate) | **`AWS_BEDROCK_REGION`** - simpler, follows Ollama pattern |
| Model Discovery | Dynamic (models.dev) | Static enum | Static enum | **Static enum** - matches existing patterns |
| Complexity | Low-Medium (~2hrs) | Low (~2hrs) | Medium-High (~26hrs) | **Low-Medium (~3hrs)** - minimal implementation |
| Error Handling | boto3 defaults | boto3 defaults | Custom handler | **boto3 defaults** - defer advanced handling |
| UserTokenKey Changes | Add all AWS vars | Add region only | Add all Bedrock vars | **Add region only** - minimal change |

---

## 2. Consensus Points

All proposals agree on the following:

1. **Dependency Ready:** `langchain[aws]>=1.2.0` is already installed in `pyproject.toml` - no changes needed
2. **Follow Existing Patterns:** Use conditional enum loading in `ChatModels` class
3. **No Architectural Changes:** Implementation is purely additive to existing code
4. **Files to Modify:**
   - `src/constants/__init__.py` - Add env variable(s)
   - `src/constants/llm.py` - Extend ChatModels enum, update `get_all_models()`
5. **Update `.example.env`:** Document required AWS configuration

---

## 3. Divergence Analysis and Council Decisions

### 3.1 Provider Prefix: `bedrock:` vs `bedrock_converse:`

| Agent | Recommendation | Rationale |
|-------|----------------|-----------|
| ARCHITECT | `bedrock:` | Standard prefix, simpler |
| CRAFTSMAN | `bedrock_converse:` | Better tool calling, future-proof |
| GUARDIAN | `bedrock_converse:` | Better tool calling support |

**Council Decision:** Use **`bedrock_converse:`**

**Reasoning:**
- Orchestra heavily relies on tool calling for its agent architecture
- `bedrock_converse` uses the Converse API which has better tool calling support
- LangChain documentation indicates `ChatBedrockConverse` will replace `ChatBedrock`
- The `init_chat_model` help text shows both providers are supported

### 3.2 Credential Detection Strategy

| Agent | Recommendation | Rationale |
|-------|----------------|-----------|
| ARCHITECT | `AWS_ACCESS_KEY_ID` | Consistent with boto3 credential chain |
| CRAFTSMAN | `AWS_BEDROCK_REGION` only | Simpler UX, matches Ollama pattern |
| GUARDIAN | Separate `AWS_BEDROCK_*` vars | Security isolation, least privilege |

**Council Decision:** Use **`AWS_BEDROCK_REGION`** as the single enablement flag

**Reasoning:**
- Follows the existing `OLLAMA_BASE_URL` pattern - a single variable enables the provider
- `langchain-aws` automatically discovers credentials via boto3 credential chain
- Users already have AWS credentials configured for S3 or other services
- Avoids credential duplication and reduces configuration burden
- If users need separate Bedrock credentials, they can use AWS profiles

### 3.3 Model List Strategy

| Agent | Recommendation | Rationale |
|-------|----------------|-----------|
| ARCHITECT | Dynamic (models.dev API) | Consistent with other providers |
| CRAFTSMAN | Static enum list | Predictable, matches existing pattern |
| GUARDIAN | Static enum list | Testable, controlled |

**Council Decision:** Use **static enum list** for initial implementation

**Reasoning:**
- Matches existing pattern for other providers in `ChatModels` enum
- More predictable behavior
- Can add dynamic discovery later if needed
- The `get_all_models()` function can still use `model_by_provider("bedrock")` if models.dev supports it

### 3.4 Complexity and Scope

| Agent | Estimate | Scope |
|-------|----------|-------|
| ARCHITECT | ~2 hours | Core integration only |
| CRAFTSMAN | ~2 hours | Core integration only |
| GUARDIAN | ~26 hours | Full implementation with error handling, testing |

**Council Decision:** **~3 hours** for Phase 1 (MVP), defer advanced features

**Reasoning:**
- Initial implementation should be minimal and focused
- Error handling can rely on boto3/langchain-aws defaults
- Advanced error handling and comprehensive testing can be Phase 2
- Goal: Get Bedrock models working in the UI with minimal code changes

---

## 4. Unified Implementation Plan

### Phase 1: Core Implementation (MVP) - ~3 hours

**Files to modify:**

1. **`src/constants/__init__.py`**
   - Add `AWS_BEDROCK_REGION` to `UserTokenKey` enum
   - Add `AWS_BEDROCK_REGION` environment variable

2. **`src/constants/llm.py`**
   - Import `AWS_BEDROCK_REGION`
   - Add Bedrock models to `ChatModels` enum with `bedrock_converse:` prefix
   - Update `get_all_models()` to include Bedrock when enabled

3. **`.example.env`**
   - Add `AWS_BEDROCK_REGION` configuration with documentation

### Phase 2: Testing & Documentation (Optional/Future)

- Add unit tests for Bedrock model registration
- Add integration tests (skipped without AWS credentials)
- Add mock fixtures to `conftest.py`
- Document IAM policy requirements

### Phase 3: Advanced Features (Future)

- Custom error handler for AWS-specific exceptions
- Model ID validation
- Region-model compatibility checking

---

## 5. Recommended Models for Initial Release

Based on popularity and tool-calling support:

```python
if AWS_BEDROCK_REGION:
    # Claude models via Bedrock (most popular)
    BEDROCK_CLAUDE_3_5_SONNET = "bedrock_converse:anthropic.claude-3-5-sonnet-20241022-v1:0"
    BEDROCK_CLAUDE_3_5_HAIKU = "bedrock_converse:anthropic.claude-3-5-haiku-20241022-v1:0"
    BEDROCK_CLAUDE_3_SONNET = "bedrock_converse:anthropic.claude-3-sonnet-20240229-v1:0"
    BEDROCK_CLAUDE_3_HAIKU = "bedrock_converse:anthropic.claude-3-haiku-20240307-v1:0"
    # Amazon Titan
    BEDROCK_TITAN_TEXT_PREMIER = "bedrock_converse:amazon.titan-text-premier-v1:0"
    # Meta Llama
    BEDROCK_LLAMA_3_2_90B = "bedrock_converse:meta.llama3-2-90b-instruct-v1:0"
    # Mistral
    BEDROCK_MISTRAL_LARGE = "bedrock_converse:mistral.mistral-large-2407-v1:0"
```

---

## 6. Risk Consolidation

### Low Risk (Proceed with confidence)
- Dependency already installed
- Implementation follows established patterns
- No architectural changes required

### Medium Risk (Monitor and document)
- Regional model availability varies - document common models by region
- AWS credential chain behavior - rely on boto3/langchain-aws error messages
- Model ID versioning - use stable versioned IDs (v1:0 suffix)

### Deferred (Phase 2+)
- Custom error handling for AWS-specific exceptions
- Credential isolation for multi-tenant scenarios
- Comprehensive integration testing

---

## 7. Final Verdict

**GO** - Proceed with implementation

**Confidence Level:** HIGH

**Conditions:**
1. Use `bedrock_converse:` provider prefix
2. Use `AWS_BEDROCK_REGION` as single enablement flag
3. Start with static model list in ChatModels enum
4. Rely on boto3/langchain-aws for credential resolution and error handling
5. Document AWS configuration requirements in `.example.env`

---

## 8. Council Signatures

- **ARCHITECT:** Approved implementation approach
- **CRAFTSMAN:** Approved code quality standards
- **GUARDIAN:** Approved security baseline (defer advanced handling to Phase 2)

---

*Council Review completed: 2026-01-14*
