# AWS Bedrock Support via init_chat_model

**Agent:** CRAFTSMAN (Clean Code & Maintainability Expert)
**Date:** 2026-01-14
**Feature:** Support AWS Bedrock models via init_chat_model
**PR Reference:** #668

---

## 1. Executive Summary

This proposal outlines a clean, maintainable approach to add AWS Bedrock model support to Orchestra's LLM infrastructure. The implementation follows existing patterns exactly - adding conditional model loading based on AWS credentials, extending the `ChatModels` enum, and updating helper functions - requiring minimal code changes with zero architectural modifications.

---

## 2. Code Quality Analysis of Existing Patterns

### 2.1 Current Architecture Strengths

The existing codebase demonstrates excellent separation of concerns and consistent patterns:

**`src/constants/__init__.py` - Environment Variable Pattern**
```python
# LLM API Keys
ANTHROPIC_API_KEY = os.getenv(UserTokenKey.ANTHROPIC_API_KEY.value)
OPENAI_API_KEY = os.getenv(UserTokenKey.OPENAI_API_KEY.value)
# ... consistent pattern for all providers
```

- **Strength:** All API keys flow through `UserTokenKey` enum for centralized management
- **Strength:** Optional keys default to `None` via `os.getenv()`
- **Note:** AWS credentials (`ACCESS_KEY_ID`, `ACCESS_SECRET_KEY`) already exist for S3 storage

**`src/constants/llm.py` - Conditional Model Registration**
```python
class ChatModels(str, Enum):
    if OPENAI_API_KEY:
        OPENAI_GPT_4_1_MINI = "openai:gpt-4.1-mini"
    if ANTHROPIC_API_KEY:
        ANTHROPIC_CLAUDE_4_SONNET = "anthropic:claude-sonnet-4"
```

- **Pattern:** Conditional enum member registration based on credential presence
- **Convention:** `{PROVIDER}_{MODEL_NAME} = "{provider}:{model-id}"` naming
- **Provider prefix:** Uses LangChain's `init_chat_model` format (`provider:model`)

**`src/constants/llm.py` - Helper Function Pattern**
```python
def get_all_models():
    models = []
    if OPENAI_API_KEY:
        models.extend(llm_service.model_by_provider(provider="openai"))
    # ... same pattern for each provider
    return sorted(models)
```

- **Pattern:** Guard each provider with credential check
- **Pattern:** Aggregate from `model_by_provider()` which fetches from external API

### 2.2 Areas of Technical Debt (Pre-existing)

1. **Credential Naming Inconsistency:** S3 uses `ACCESS_KEY_ID` / `ACCESS_SECRET_KEY` while standard AWS SDK expects `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
2. **No `UserTokenKey` entry for AWS Bedrock:** Current enum doesn't include Bedrock-specific credentials
3. **Dynamic enum registration:** Using `if` statements inside class body is unconventional but works

### 2.3 init_chat_model Provider Mapping

LangChain's `init_chat_model` supports two Bedrock providers:

| Provider | Package | Use Case |
|----------|---------|----------|
| `bedrock` | `langchain-aws` | Legacy Bedrock API |
| `bedrock_converse` | `langchain-aws` | **Recommended** - Converse API with tool calling support |

**Recommendation:** Use `bedrock_converse` as it provides better tool calling support, which is essential for Orchestra's agent functionality.

---

## 3. Implementation Strategy Following Existing Conventions

### 3.1 Phase 1: Environment Variables (`src/constants/__init__.py`)

**Option A: Leverage Existing S3 Credentials (Minimal Change)**

The codebase already has AWS credentials for S3:
```python
ACCESS_KEY_ID = os.getenv("ACCESS_KEY_ID")
ACCESS_SECRET_KEY = os.getenv("ACCESS_SECRET_KEY")
S3_REGION = os.getenv("S3_REGION", "us-east-2")
```

However, `langchain-aws` expects standard AWS SDK environment variables (`AWS_ACCESS_KEY_ID`, etc.) which boto3 auto-discovers.

**Option B: Add Dedicated Bedrock Credentials (Recommended)**

Add to `UserTokenKey` enum:
```python
class UserTokenKey(Enum):
    # ... existing keys ...
    AWS_BEDROCK_REGION = "AWS_BEDROCK_REGION"
```

Add environment variable:
```python
# AWS Bedrock (uses standard AWS SDK credentials from environment)
AWS_BEDROCK_REGION = os.getenv("AWS_BEDROCK_REGION")
```

**Rationale:** The `langchain-aws` package automatically discovers credentials via:
1. Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`)
2. AWS credentials file (`~/.aws/credentials`)
3. IAM roles (ECS/EC2/Lambda)

We only need to expose a region variable to indicate Bedrock is enabled. This follows the principle of least privilege - don't duplicate credential management.

### 3.2 Phase 2: Model Enum (`src/constants/llm.py`)

**Add imports:**
```python
from src.constants import (
    # ... existing imports ...
    AWS_BEDROCK_REGION,
)
```

**Add conditional models:**
```python
class ChatModels(str, Enum):
    # ... existing providers ...

    if AWS_BEDROCK_REGION:
        # Claude models via Bedrock
        BEDROCK_CLAUDE_3_5_SONNET = "bedrock_converse:anthropic.claude-3-5-sonnet-20241022-v1:0"
        BEDROCK_CLAUDE_3_5_HAIKU = "bedrock_converse:anthropic.claude-3-5-haiku-20241022-v1:0"
        BEDROCK_CLAUDE_3_SONNET = "bedrock_converse:anthropic.claude-3-sonnet-20240229-v1:0"
        BEDROCK_CLAUDE_3_HAIKU = "bedrock_converse:anthropic.claude-3-haiku-20240307-v1:0"
        # Amazon Titan models
        BEDROCK_TITAN_TEXT_PREMIER = "bedrock_converse:amazon.titan-text-premier-v1:0"
        # Meta Llama models
        BEDROCK_LLAMA_3_2_90B = "bedrock_converse:meta.llama3-2-90b-instruct-v1:0"
        BEDROCK_LLAMA_3_1_70B = "bedrock_converse:meta.llama3-1-70b-instruct-v1:0"
        # Mistral models
        BEDROCK_MISTRAL_LARGE = "bedrock_converse:mistral.mistral-large-2407-v1:0"
```

**Naming Convention Analysis:**
- Follows existing pattern: `{PROVIDER}_{MODEL_NAME}`
- Uses `BEDROCK_` prefix to distinguish from direct Anthropic API
- Model IDs match AWS Bedrock's exact naming (e.g., `anthropic.claude-3-5-sonnet-20241022-v1:0`)

### 3.3 Phase 3: Helper Functions (`src/constants/llm.py`)

**Update `get_all_models()`:**
```python
def get_all_models():
    models = []
    # ... existing providers ...
    if AWS_BEDROCK_REGION:
        models.extend(llm_service.model_by_provider(provider="bedrock"))
    return sorted(models)
```

**Update `get_free_models()` (if applicable):**
```python
def get_free_models():
    models = []
    # ... existing free tier models ...
    # Note: Bedrock has no free tier, so no additions here
    return sorted(models)
```

### 3.4 Phase 4: LLM Service (`src/services/llm.py`)

**Update `model_by_provider()` method:**

The current implementation fetches from `https://models.dev/api.json`. If Bedrock is not in this API, we need to handle it:

```python
def model_by_provider(self, provider: str):
    """Get tool-calling models for a given provider."""
    all_models = self._fetch_models()

    # Special handling for Bedrock (may not be in models.dev API)
    if provider == "bedrock":
        # Return statically defined Bedrock models or fetch from AWS
        return self._get_bedrock_models()

    provider_data = all_models.get(provider, {}) or {}
    # ... rest of existing implementation
```

**Alternative:** If models.dev includes Bedrock, no changes needed.

### 3.5 Phase 5: Utility Functions (`src/utils/llm.py`)

**Update `get_api_key()` function:**
```python
def get_api_key(model_name: str):
    if "openai" in model_name:
        return OPENAI_API_KEY
    elif "anthropic" in model_name:
        return ANTHROPIC_API_KEY
    elif "bedrock" in model_name:
        return None  # Bedrock uses AWS SDK credential chain
    # ... rest of existing providers
```

### 3.6 Phase 6: Example Environment File (`.example.env`)

```ini
#########################################################
## AI Providers (Model Secrets)
#########################################################
OPENAI_API_KEY=
GROQ_API_KEY=
ANTHROPIC_API_KEY=
XAI_API_KEY=
OLLAMA_BASE_URL=
# AWS Bedrock (requires AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in environment)
AWS_BEDROCK_REGION=
```

---

## 4. Design Decisions Focused on Maintainability

### 4.1 Decision Matrix

| Decision | Option A | Option B | Chosen | Rationale |
|----------|----------|----------|--------|-----------|
| Provider name | `bedrock` | `bedrock_converse` | B | Better tool calling support, recommended by LangChain |
| Credential handling | Duplicate AWS vars | Use SDK auto-discovery | B | DRY principle, fewer secrets to manage |
| Enable flag | Check all 3 AWS vars | Single `AWS_BEDROCK_REGION` | B | Simpler UX, matches Ollama pattern |
| Model list | Static enum only | Dynamic + enum | Static | Matches existing pattern, predictable |

### 4.2 Provider Prefix Justification

Using `bedrock_converse:` instead of `bedrock:`:

1. **Tool Calling:** `bedrock_converse` supports LangChain's tool calling interface, critical for Orchestra's agent architecture
2. **Future-Proof:** LangChain documentation indicates `ChatBedrockConverse` will replace `ChatBedrock`
3. **Consistency:** Aligns with Orchestra's use of modern LangChain patterns

### 4.3 Credential Detection Strategy

Rather than requiring users to duplicate AWS credentials:

```python
# Bad: Requires duplication
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")

# Good: Use presence of region to enable, let SDK find credentials
AWS_BEDROCK_REGION = os.getenv("AWS_BEDROCK_REGION")  # Setting this enables Bedrock
```

This mirrors the `OLLAMA_BASE_URL` pattern - a single variable enables the provider.

### 4.4 Model Selection Rationale

Proposed initial models based on:
1. **Popularity:** Most commonly used Bedrock models
2. **Tool Calling:** Models with confirmed Converse API tool support
3. **Diversity:** Mix of Claude, Titan, Llama, and Mistral

---

## 5. Risk Assessment for Code Quality

### 5.1 Low Risk

| Risk | Mitigation | Impact |
|------|------------|--------|
| New dependency conflicts | `langchain[aws]>=1.2.0` already in pyproject.toml | None |
| API changes | Using stable `init_chat_model` interface | Minimal |
| Testing coverage | Follow existing test patterns | Low |

### 5.2 Medium Risk

| Risk | Mitigation | Impact |
|------|------------|--------|
| Regional model availability | Document required region in `.example.env` | User education |
| Credential misconfiguration | Clear error messages from boto3 | User support |
| Model ID changes | Use versioned model IDs (v1:0 suffix) | Future maintenance |

### 5.3 Architectural Concerns

1. **No architectural risk:** Implementation follows existing patterns exactly
2. **No new patterns introduced:** All changes are additive to existing conventions
3. **Backward compatible:** No changes to existing provider behavior

---

## 6. Estimated Complexity

### 6.1 Lines of Code Impact

| File | Lines Added | Lines Modified |
|------|-------------|----------------|
| `src/constants/__init__.py` | ~5 | 0 |
| `src/constants/llm.py` | ~20 | ~5 |
| `src/utils/llm.py` | ~3 | 0 |
| `.example.env` | ~3 | 0 |
| **Total** | ~31 | ~5 |

### 6.2 Test Requirements

| Test Type | Scope | Effort |
|-----------|-------|--------|
| Unit tests | ChatModels enum registration | Low |
| Unit tests | `get_all_models()` with Bedrock | Low |
| Integration tests | `init_chat_model` with Bedrock | Medium (requires AWS creds) |

### 6.3 Implementation Timeline

| Phase | Task | Estimate |
|-------|------|----------|
| 1 | Add environment variables | 15 min |
| 2 | Update ChatModels enum | 30 min |
| 3 | Update helper functions | 15 min |
| 4 | Update utils | 15 min |
| 5 | Update .example.env | 5 min |
| 6 | Unit tests | 30 min |
| 7 | Documentation | 15 min |
| **Total** | | ~2 hours |

---

## 7. Implementation Checklist

```markdown
- [ ] Add `AWS_BEDROCK_REGION` to `UserTokenKey` enum in `src/constants/__init__.py`
- [ ] Add `AWS_BEDROCK_REGION` environment variable in `src/constants/__init__.py`
- [ ] Import `AWS_BEDROCK_REGION` in `src/constants/llm.py`
- [ ] Add Bedrock models to `ChatModels` enum with `bedrock_converse:` prefix
- [ ] Update `get_all_models()` to include Bedrock when enabled
- [ ] Update `get_api_key()` in `src/utils/llm.py` to handle Bedrock
- [ ] Update `.example.env` with AWS Bedrock configuration
- [ ] Add unit tests for Bedrock model registration
- [ ] Test with live AWS Bedrock credentials (manual verification)
- [ ] Run `make format` to ensure code style compliance
- [ ] Run `make test` to verify no regressions
```

---

## 8. Code Examples

### 8.1 Final `src/constants/__init__.py` Changes

```python
class UserTokenKey(Enum):
    # ... existing keys ...
    AWS_BEDROCK_REGION = "AWS_BEDROCK_REGION"

# AWS Bedrock (uses standard AWS SDK credential chain)
AWS_BEDROCK_REGION = os.getenv(UserTokenKey.AWS_BEDROCK_REGION.value)
```

### 8.2 Final `src/constants/llm.py` Changes

```python
from src.constants import (
    OPENAI_API_KEY,
    ANTHROPIC_API_KEY,
    OLLAMA_BASE_URL,
    GROQ_API_KEY,
    GOOGLE_API_KEY,
    XAI_API_KEY,
    AWS_BEDROCK_REGION,
)

class ChatModels(str, Enum):
    # ... existing providers ...

    if AWS_BEDROCK_REGION:
        BEDROCK_CLAUDE_3_5_SONNET = "bedrock_converse:anthropic.claude-3-5-sonnet-20241022-v1:0"
        BEDROCK_CLAUDE_3_5_HAIKU = "bedrock_converse:anthropic.claude-3-5-haiku-20241022-v1:0"
        BEDROCK_CLAUDE_3_SONNET = "bedrock_converse:anthropic.claude-3-sonnet-20240229-v1:0"
        BEDROCK_CLAUDE_3_HAIKU = "bedrock_converse:anthropic.claude-3-haiku-20240307-v1:0"
        BEDROCK_TITAN_TEXT_PREMIER = "bedrock_converse:amazon.titan-text-premier-v1:0"
        BEDROCK_LLAMA_3_2_90B = "bedrock_converse:meta.llama3-2-90b-instruct-v1:0"
        BEDROCK_MISTRAL_LARGE = "bedrock_converse:mistral.mistral-large-2407-v1:0"


def get_all_models():
    from src.services.llm import llm_service

    models = []
    if OPENAI_API_KEY:
        models.extend(llm_service.model_by_provider(provider="openai"))
    if ANTHROPIC_API_KEY:
        models.extend(llm_service.model_by_provider(provider="anthropic"))
    if GOOGLE_API_KEY:
        models.extend(llm_service.model_by_provider(provider="google"))
    if GROQ_API_KEY:
        models.extend(llm_service.model_by_provider(provider="groq"))
    if XAI_API_KEY:
        models.extend(llm_service.model_by_provider(provider="xai"))
    if AWS_BEDROCK_REGION:
        models.extend(llm_service.model_by_provider(provider="bedrock"))
    if OLLAMA_BASE_URL:
        models.extend(get_ollama_models())
    return sorted(models)
```

### 8.3 Usage Example

Once implemented, users can use Bedrock models like any other provider:

```python
# Via init_chat_model (internal)
from langchain.chat_models import init_chat_model
model = init_chat_model("bedrock_converse:anthropic.claude-3-5-sonnet-20241022-v1:0")

# Via Orchestra API (external)
{
    "model": "bedrock_converse:anthropic.claude-3-5-sonnet-20241022-v1:0",
    "input": {
        "messages": [{"role": "user", "content": "Hello"}]
    }
}
```

---

## 9. References

- [LangChain init_chat_model Documentation](https://python.langchain.com/api_reference/langchain/chat_models/langchain.chat_models.base.init_chat_model.html)
- [ChatBedrockConverse Documentation](https://api.python.langchain.com/en/latest/aws/chat_models/langchain_aws.chat_models.bedrock_converse.ChatBedrockConverse.html)
- [AWS Bedrock Model IDs](https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids.html)
- [langchain-aws GitHub Repository](https://github.com/langchain-ai/langchain-aws)

---

**Prepared by:** CRAFTSMAN Agent
**Review Status:** Ready for MAESTRO synthesis
