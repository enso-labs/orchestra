# AWS Bedrock Support Implementation Proposal

## Executive Summary

This proposal outlines the integration of AWS Bedrock as a model provider in Orchestra. The implementation leverages the existing `init_chat_model` pattern and the models.dev API which already includes `amazon-bedrock` as a provider with 67 models (58 supporting tool-calling). The core changes involve adding AWS credential detection in constants, extending the `ChatModels` enum with Bedrock models, and mapping the provider name from `amazon-bedrock` (models.dev) to `bedrock` (LangChain).

---

## 1. Architectural Analysis

### 1.1 Current Provider Architecture

The system uses a layered architecture for model management:

```
+------------------+     +------------------+     +------------------+
|  constants/      |     |  services/       |     |  flows/          |
|  __init__.py     |---->|  llm.py          |---->|  __init__.py     |
|  (env vars)      |     |  (models.dev API)|     |  (init_chat_model)|
+------------------+     +------------------+     +------------------+
        |                        |                        |
        v                        v                        v
+------------------+     +------------------+     +------------------+
|  constants/      |     |  utils/          |     |  utils/          |
|  llm.py          |     |  llm.py          |     |  middleware.py   |
|  (ChatModels)    |     |  (filter models) |     |  (dynamic model) |
+------------------+     +------------------+     +------------------+
```

**Key Files and Their Responsibilities:**

| File | Purpose | Bedrock Impact |
|------|---------|----------------|
| `src/constants/__init__.py` | Environment variable loading | Add AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION |
| `src/constants/llm.py` | ChatModels enum, `get_all_models()`, `get_default_chat_model()` | Add Bedrock models to enum, extend `get_all_models()` |
| `src/services/llm.py` | `model_by_provider()` fetches from models.dev API | Map `amazon-bedrock` to `bedrock` provider format |
| `src/flows/__init__.py` | `init_chat_model(model=model)` invocation | No changes required (auto-infers provider) |
| `src/utils/middleware.py` | Dynamic model selection middleware | No changes required |

### 1.2 Authentication Pattern Analysis

**Current Pattern:** Each provider uses a single API key:
```python
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
```

**AWS Bedrock Pattern:** AWS requires multiple credentials:
```python
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION")
```

**Design Decision:** AWS credentials are detected by checking for `AWS_ACCESS_KEY_ID` presence, consistent with boto3's credential chain and the models.dev API's `env` field specification.

### 1.3 Model Naming Convention Analysis

**models.dev API Format:**
```
Provider: amazon-bedrock
Model IDs: anthropic.claude-3-7-sonnet-20250219-v1:0
           meta.llama3-2-90b-instruct-v1:0
           mistral.mistral-large-2402-v1:0
```

**LangChain init_chat_model Format:**
```
bedrock:anthropic.claude-3-7-sonnet-20250219-v1:0
bedrock_converse:meta.llama3-2-90b-instruct-v1:0
```

The system needs to map `amazon-bedrock` -> `bedrock` for LangChain compatibility.

---

## 2. Implementation Strategy

### 2.1 Phase 1: Environment Configuration (Low Risk)

**File: `src/constants/__init__.py`**

Add AWS credential environment variables and extend `UserTokenKey` enum:

```python
# In UserTokenKey enum
class UserTokenKey(Enum):
    # ... existing keys ...
    AWS_ACCESS_KEY_ID = "AWS_ACCESS_KEY_ID"
    AWS_SECRET_ACCESS_KEY = "AWS_SECRET_ACCESS_KEY"
    AWS_REGION = "AWS_REGION"

# AWS Credentials (Bedrock)
AWS_ACCESS_KEY_ID = os.getenv(UserTokenKey.AWS_ACCESS_KEY_ID.value)
AWS_SECRET_ACCESS_KEY = os.getenv(UserTokenKey.AWS_SECRET_ACCESS_KEY.value)
AWS_REGION = os.getenv(UserTokenKey.AWS_REGION.value) or os.getenv("AWS_DEFAULT_REGION", "us-east-1")
```

### 2.2 Phase 2: Model Enum Extension (Medium Risk)

**File: `src/constants/llm.py`**

Add Bedrock models to `ChatModels` enum with conditional loading:

```python
from src.constants import (
    # ... existing imports ...
    AWS_ACCESS_KEY_ID,
)

class ChatModels(str, Enum):
    # ... existing models ...
    if AWS_ACCESS_KEY_ID:
        BEDROCK_CLAUDE_3_7_SONNET = "bedrock:anthropic.claude-3-7-sonnet-20250219-v1:0"
        BEDROCK_CLAUDE_SONNET_4 = "bedrock:anthropic.claude-sonnet-4-20250514-v1:0"
        BEDROCK_CLAUDE_OPUS_4_5 = "bedrock:anthropic.claude-opus-4-5-20251101-v1:0"
        BEDROCK_LLAMA_3_2_90B = "bedrock:meta.llama3-2-90b-instruct-v1:0"
        BEDROCK_MISTRAL_LARGE = "bedrock:mistral.mistral-large-2402-v1:0"
```

### 2.3 Phase 3: LLM Service Integration (Medium Risk)

**File: `src/services/llm.py`**

Extend `model_by_provider()` to handle the `amazon-bedrock` -> `bedrock` mapping:

```python
def model_by_provider(self, provider: str):
    """Get tool-calling models for a given provider."""
    all_models = self._fetch_models()

    # Map provider names between models.dev and LangChain
    api_provider = provider
    if provider == "bedrock":
        api_provider = "amazon-bedrock"

    provider_data = all_models.get(api_provider, {}) or {}
    provider_models = provider_data.get("models", []) or []

    if not provider_models:
        logger.info(f"No models found for provider: {provider}")
        return []

    # Filter for tool-calling models
    tool_models = filter_tool_call_models(provider_models)
    logger.info(f"Found {len(tool_models)} tool calling models for {provider}")

    # Normalize provider name for LangChain
    normalized_provider = {
        "google": "google_genai",
        "amazon-bedrock": "bedrock",
    }.get(provider, provider)

    return [f"{normalized_provider}:{model}" for model in tool_models]
```

**File: `src/constants/llm.py`**

Extend `get_all_models()`:

```python
def get_all_models():
    from src.services.llm import llm_service

    models = []
    # ... existing providers ...
    if AWS_ACCESS_KEY_ID:
        models.extend(llm_service.model_by_provider(provider="bedrock"))
    if OLLAMA_BASE_URL:
        models.extend(get_ollama_models())
    return sorted(models)
```

### 2.4 Phase 4: Optional Enhancements

**A. Default Model Fallback Chain:**

Extend `get_default_chat_model()` to include Bedrock as a fallback:

```python
def get_default_chat_model():
    """Get the default chat model based on available API keys."""
    if OPENAI_API_KEY:
        return ChatModels.OPENAI_GPT_4_1_MINI.value
    if GOOGLE_API_KEY:
        return ChatModels.GOOGLE_GEMINI_3_FLASH_PREVIEW.value
    if XAI_API_KEY:
        return ChatModels.XAI_GROK_4_1_FAST.value
    if ANTHROPIC_API_KEY:
        return ChatModels.ANTHROPIC_CLAUDE_4_5_HAIKU.value
    if AWS_ACCESS_KEY_ID:  # New fallback
        return ChatModels.BEDROCK_CLAUDE_3_7_SONNET.value
    if GROQ_API_KEY:
        return ChatModels.GROQ_LLAMA_3_3_70B_VERSATILE.value
    return None
```

**B. Free Tier Models:**

If Bedrock should have free-tier options (depends on AWS pricing):

```python
def get_free_models():
    # ... existing logic ...
    if AWS_ACCESS_KEY_ID:
        models.append(ChatModels.BEDROCK_LLAMA_3_2_90B.value)  # Example
    # ...
```

---

## 3. Design Decisions and Trade-offs

### 3.1 Provider Name Mapping

| Decision | `amazon-bedrock` (models.dev) -> `bedrock` (LangChain) |
|----------|-------------------------------------------------------|
| **Rationale** | LangChain's `init_chat_model` expects `bedrock:model-id` format |
| **Alternative** | Use `amazon-bedrock` prefix and modify init_chat_model calls |
| **Trade-off** | Requires mapping logic in `model_by_provider()` but maintains LangChain conventions |

### 3.2 Credential Detection Strategy

| Decision | Use `AWS_ACCESS_KEY_ID` as the sentinel value |
|----------|----------------------------------------------|
| **Rationale** | Consistent with models.dev API's `env` field and boto3 default credential chain |
| **Alternative** | Check all three credentials (access key, secret, region) |
| **Trade-off** | Simpler detection but relies on boto3's default region fallback if AWS_REGION not set |

### 3.3 bedrock vs bedrock_converse Provider

| Decision | Use `bedrock` as the default provider prefix |
|----------|---------------------------------------------|
| **Rationale** | `bedrock` is the standard prefix; `bedrock_converse` uses a different API |
| **Alternative** | Support both via configuration |
| **Trade-off** | Simpler implementation; users can manually specify `bedrock_converse:` prefix if needed |

### 3.4 Static vs Dynamic Model List

| Decision | Leverage models.dev API for dynamic model discovery |
|----------|---------------------------------------------------|
| **Rationale** | Consistent with existing providers; API already includes amazon-bedrock with 58 tool-calling models |
| **Alternative** | Hardcode a static list of Bedrock models |
| **Trade-off** | Requires API availability but ensures up-to-date model list |

---

## 4. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              REQUEST FLOW                                    │
└─────────────────────────────────────────────────────────────────────────────┘

User Request: model="bedrock:anthropic.claude-3-7-sonnet-20250219-v1:0"
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  flows/__init__.py: graph_builder()                                          │
│                                                                              │
│  llm = init_chat_model(model="bedrock:anthropic.claude-3-7-sonnet...")      │
│         │                                                                    │
│         ├── Provider: "bedrock" (auto-inferred from prefix)                  │
│         ├── Model ID: "anthropic.claude-3-7-sonnet-20250219-v1:0"           │
│         └── Package: langchain-aws (already installed)                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  langchain-aws: ChatBedrock                                                  │
│                                                                              │
│  AWS Credentials (from environment or boto3 credential chain):               │
│  ├── AWS_ACCESS_KEY_ID                                                       │
│  ├── AWS_SECRET_ACCESS_KEY                                                   │
│  └── AWS_REGION / AWS_DEFAULT_REGION                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  AWS Bedrock API                                                             │
│  Endpoint: bedrock-runtime.{region}.amazonaws.com                            │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                           MODEL DISCOVERY FLOW                               │
└─────────────────────────────────────────────────────────────────────────────┘

                          constants/__init__.py
                                    │
                    AWS_ACCESS_KEY_ID detected?
                          /                  \
                        Yes                   No
                         │                     │
                         ▼                     ▼
               constants/llm.py          (Skip Bedrock)
               get_all_models()
                         │
                         ▼
               services/llm.py
               model_by_provider("bedrock")
                         │
                         ├── Map "bedrock" -> "amazon-bedrock" for API
                         │
                         ▼
               https://models.dev/api.json
               Provider: amazon-bedrock
               Models: 67 total, 58 tool-calling
                         │
                         ├── Map "amazon-bedrock" -> "bedrock" for LangChain
                         │
                         ▼
               Return: ["bedrock:model-id", ...]
```

---

## 5. File Change Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `src/constants/__init__.py` | Modify | Add AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION env vars; extend UserTokenKey enum |
| `src/constants/llm.py` | Modify | Import AWS_ACCESS_KEY_ID; add Bedrock models to ChatModels enum; extend get_all_models(), get_free_models(), get_default_chat_model() |
| `src/services/llm.py` | Modify | Add provider name mapping in model_by_provider() for amazon-bedrock <-> bedrock |
| `src/utils/llm.py` | Optional | Could add Bedrock to get_api_key() but not required since AWS uses credential chain |

---

## 6. Risk Assessment

### 6.1 Low Risk

| Risk | Mitigation |
|------|------------|
| **Dependency already installed** | `langchain[aws]>=1.2.0` is in pyproject.toml |
| **API compatibility** | models.dev already includes amazon-bedrock provider |
| **Existing pattern** | Implementation follows established provider pattern |

### 6.2 Medium Risk

| Risk | Mitigation |
|------|------------|
| **AWS credential validation** | boto3 handles credential chain; invalid credentials will fail at runtime with clear error |
| **Region configuration** | Default to `us-east-1` if AWS_REGION not set; document requirement |
| **Model availability by region** | Not all Bedrock models available in all regions; rely on AWS API errors |

### 6.3 Low-Medium Risk

| Risk | Mitigation |
|------|------------|
| **Enum conditional loading** | Python enums with conditional members are established pattern in this codebase |
| **Provider name mapping** | Simple dictionary lookup with fallback |

---

## 7. Estimated Complexity

| Component | Lines of Code | Complexity | Time Estimate |
|-----------|---------------|------------|---------------|
| constants/__init__.py | ~10 | Low | 15 min |
| constants/llm.py | ~20 | Medium | 30 min |
| services/llm.py | ~10 | Low | 15 min |
| Testing | ~50 | Medium | 45 min |
| Documentation | ~20 | Low | 15 min |
| **Total** | **~110** | **Low-Medium** | **~2 hours** |

---

## 8. Testing Strategy

### 8.1 Unit Tests

```python
# tests/unit/constants/test_llm_bedrock.py

def test_bedrock_models_in_enum_when_credentials_present(monkeypatch):
    """Verify Bedrock models are available when AWS credentials are set."""
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "test-key")
    # Re-import to trigger conditional enum loading
    from importlib import reload
    from src.constants import llm
    reload(llm)
    assert hasattr(llm.ChatModels, "BEDROCK_CLAUDE_3_7_SONNET")

def test_get_all_models_includes_bedrock(monkeypatch, mock_models_api):
    """Verify get_all_models() includes Bedrock models."""
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "test-key")
    models = get_all_models()
    assert any("bedrock:" in m for m in models)

def test_model_by_provider_maps_bedrock(mock_models_api):
    """Verify amazon-bedrock -> bedrock mapping."""
    service = LLMService()
    models = service.model_by_provider("bedrock")
    assert all(m.startswith("bedrock:") for m in models)
```

### 8.2 Integration Tests

```python
# tests/integration/test_bedrock_integration.py

@pytest.mark.skipif(not os.getenv("AWS_ACCESS_KEY_ID"), reason="AWS credentials required")
def test_bedrock_model_initialization():
    """Verify Bedrock model can be initialized via init_chat_model."""
    from langchain.chat_models import init_chat_model
    llm = init_chat_model("bedrock:anthropic.claude-3-haiku-20240307-v1:0")
    assert llm is not None
```

---

## 9. Documentation Requirements

### 9.1 Environment Variables

Add to `.example.env` or documentation:

```bash
# AWS Bedrock Configuration
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1  # or us-west-2, eu-west-1, etc.
```

### 9.2 Model ID Format

Document the Bedrock model ID format for users:

```
bedrock:anthropic.claude-3-7-sonnet-20250219-v1:0
bedrock:meta.llama3-2-90b-instruct-v1:0
bedrock:mistral.mistral-large-2402-v1:0
```

---

## 10. Conclusion

The AWS Bedrock integration is a low-to-medium complexity feature that aligns well with Orchestra's existing architecture. Key success factors:

1. **Leverage existing infrastructure:** The models.dev API already includes amazon-bedrock with 58 tool-calling models
2. **Follow established patterns:** Conditional enum loading and provider detection are proven patterns
3. **Minimal code changes:** ~110 lines across 3-4 files
4. **Dependency ready:** `langchain[aws]>=1.2.0` is already installed

**Recommended Implementation Order:**
1. Add AWS env vars to `constants/__init__.py`
2. Extend `ChatModels` enum in `constants/llm.py`
3. Add provider mapping in `services/llm.py`
4. Update `get_all_models()` and helper functions
5. Add unit tests
6. Update documentation

---

*Proposal prepared by: AGENT_1 (ARCHITECT)*
*Date: 2026-01-14*
*PR Reference: #668*
*Feature Issue: #666*
