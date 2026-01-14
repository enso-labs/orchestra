# AWS Bedrock Support Proposal - Guardian Analysis

**Feature:** Support AWS Bedrock models via init_chat_model
**Analyst:** GUARDIAN (Security, Error Handling, Edge Cases, Testing)
**Date:** 2026-01-14
**PR Reference:** #668

---

## 1. Executive Summary

This proposal provides a comprehensive security, error handling, and testing analysis for integrating AWS Bedrock models into the Orchestra backend. The integration requires careful credential management distinct from existing API key patterns, robust error handling for AWS-specific failure modes, and thorough testing to ensure reliability across different authentication scenarios. The implementation complexity is **MEDIUM-HIGH** due to AWS credential diversity and region-specific service availability.

---

## 2. Security Analysis

### 2.1 Credential Handling Architecture

AWS Bedrock authentication differs fundamentally from the existing provider pattern (simple API keys). The system must support multiple credential sources:

| Source | Priority | Use Case |
|--------|----------|----------|
| Environment Variables | 1 | CI/CD, Container deployments |
| IAM Instance Profile | 2 | EC2/ECS/EKS deployments |
| AWS Profile (Named) | 3 | Local development |
| Explicit Credentials | 4 | Per-user configuration |

**Required Environment Variables:**
```
AWS_ACCESS_KEY_ID          - Access key identifier
AWS_SECRET_ACCESS_KEY      - Secret access key
AWS_SESSION_TOKEN          - Optional session token (for STS/assumed roles)
AWS_REGION                 - Default region (e.g., us-east-1)
AWS_BEDROCK_REGION         - Bedrock-specific region override
AWS_PROFILE                - Named profile for local dev
```

### 2.2 Security Recommendations

#### CRITICAL: Credential Isolation
```python
# RECOMMENDED: Separate Bedrock credentials from S3 credentials
# Current S3 creds in constants/__init__.py (lines 87-89):
#   S3_REGION, ACCESS_KEY_ID, ACCESS_SECRET_KEY

# NEW: Dedicated Bedrock credentials
AWS_BEDROCK_ACCESS_KEY_ID = os.getenv("AWS_BEDROCK_ACCESS_KEY_ID")
AWS_BEDROCK_SECRET_ACCESS_KEY = os.getenv("AWS_BEDROCK_SECRET_ACCESS_KEY")
AWS_BEDROCK_SESSION_TOKEN = os.getenv("AWS_BEDROCK_SESSION_TOKEN")
AWS_BEDROCK_REGION = os.getenv("AWS_BEDROCK_REGION", "us-east-1")
AWS_BEDROCK_PROFILE = os.getenv("AWS_BEDROCK_PROFILE")
```

**Rationale:** Separating credentials enables:
1. Least-privilege IAM policies (Bedrock-only access)
2. Independent rotation schedules
3. Easier audit trail
4. Reduced blast radius if credentials leak

#### HIGH: Never Log Credentials
```python
# In src/utils/logger.py or middleware
SENSITIVE_PATTERNS = [
    r"AWS_SECRET_ACCESS_KEY",
    r"aws_secret_access_key",
    r"AKIA[A-Z0-9]{16}",  # AWS Access Key ID pattern
]
```

#### HIGH: UserTokenKey Enum Extension
The existing `UserTokenKey` enum in `/home/ryaneggz/ruska-ai/orchestra/backend/src/constants/__init__.py` should be extended to support user-specific AWS credentials:

```python
class UserTokenKey(Enum):
    # ... existing keys ...
    AWS_BEDROCK_ACCESS_KEY_ID = "AWS_BEDROCK_ACCESS_KEY_ID"
    AWS_BEDROCK_SECRET_ACCESS_KEY = "AWS_BEDROCK_SECRET_ACCESS_KEY"
    AWS_BEDROCK_SESSION_TOKEN = "AWS_BEDROCK_SESSION_TOKEN"
    AWS_BEDROCK_REGION = "AWS_BEDROCK_REGION"
```

### 2.3 IAM Policy Requirements

Minimum required IAM permissions for Bedrock access:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "BedrockInvokeModel",
            "Effect": "Allow",
            "Action": [
                "bedrock:InvokeModel",
                "bedrock:InvokeModelWithResponseStream"
            ],
            "Resource": [
                "arn:aws:bedrock:*::foundation-model/anthropic.*",
                "arn:aws:bedrock:*::foundation-model/amazon.*",
                "arn:aws:bedrock:*::foundation-model/meta.*",
                "arn:aws:bedrock:*::foundation-model/cohere.*",
                "arn:aws:bedrock:*::foundation-model/mistral.*"
            ]
        }
    ]
}
```

---

## 3. Error Handling Strategy

### 3.1 AWS-Specific Exception Taxonomy

The following exceptions must be caught and translated to user-friendly errors:

| AWS Exception | HTTP Status | User Message | Recovery Action |
|---------------|-------------|--------------|-----------------|
| `NoCredentialsError` | 401 | "AWS credentials not configured" | Check environment/profile |
| `InvalidRegionError` | 400 | "Invalid AWS region specified" | Verify region name |
| `AccessDeniedException` | 403 | "Insufficient IAM permissions" | Review IAM policy |
| `ResourceNotFoundException` | 404 | "Model not available in region" | Try different region |
| `ThrottlingException` | 429 | "Rate limit exceeded" | Implement backoff |
| `ServiceQuotaExceededException` | 429 | "Quota exceeded" | Request limit increase |
| `ValidationException` | 400 | "Invalid model parameters" | Check model ID format |
| `ModelTimeoutException` | 504 | "Model request timed out" | Retry with backoff |
| `ModelNotReadyException` | 503 | "Model warming up" | Retry after delay |
| `ModelStreamErrorException` | 500 | "Streaming interrupted" | Retry stream |

### 3.2 Exception Handler Implementation

```python
# Proposed: src/utils/aws_errors.py

from botocore.exceptions import (
    NoCredentialsError,
    ClientError,
    EndpointConnectionError,
)
from fastapi import HTTPException
from src.utils.logger import logger


class BedrockErrorHandler:
    """Centralized error handling for AWS Bedrock operations."""

    ERROR_MAP = {
        "AccessDeniedException": (403, "Insufficient IAM permissions for Bedrock"),
        "ResourceNotFoundException": (404, "Bedrock model not found in region"),
        "ThrottlingException": (429, "Bedrock rate limit exceeded"),
        "ServiceQuotaExceededException": (429, "Bedrock quota exceeded"),
        "ValidationException": (400, "Invalid Bedrock model parameters"),
        "ModelTimeoutException": (504, "Bedrock model request timed out"),
        "ModelNotReadyException": (503, "Bedrock model is warming up"),
        "ModelStreamErrorException": (500, "Bedrock streaming error"),
        "ExpiredTokenException": (401, "AWS session token expired"),
        "UnrecognizedClientException": (401, "Invalid AWS credentials"),
    }

    @classmethod
    def handle(cls, error: Exception) -> HTTPException:
        """Convert AWS exception to HTTPException."""

        if isinstance(error, NoCredentialsError):
            logger.error("AWS credentials not found")
            return HTTPException(
                status_code=401,
                detail="AWS Bedrock credentials not configured"
            )

        if isinstance(error, EndpointConnectionError):
            logger.error(f"Cannot connect to Bedrock endpoint: {error}")
            return HTTPException(
                status_code=503,
                detail="Cannot connect to AWS Bedrock service"
            )

        if isinstance(error, ClientError):
            error_code = error.response.get("Error", {}).get("Code", "Unknown")
            status, message = cls.ERROR_MAP.get(
                error_code,
                (500, f"AWS Bedrock error: {error_code}")
            )
            logger.error(f"Bedrock ClientError: {error_code} - {error}")
            return HTTPException(status_code=status, detail=message)

        # Fallback for unknown errors
        logger.exception(f"Unexpected Bedrock error: {error}")
        return HTTPException(
            status_code=500,
            detail="Unexpected error communicating with AWS Bedrock"
        )
```

### 3.3 Retry Strategy for Transient Failures

```python
# Integration with existing retry_model middleware in src/utils/middleware.py

BEDROCK_RETRYABLE_ERRORS = {
    "ThrottlingException",
    "ServiceUnavailable",
    "ModelTimeoutException",
    "ModelNotReadyException",
}

BEDROCK_RETRY_CONFIG = {
    "max_attempts": 3,
    "base_delay": 1.0,  # seconds
    "max_delay": 10.0,
    "exponential_base": 2,
}
```

---

## 4. Testing Requirements

### 4.1 Test Categories

#### Unit Tests (Mocked AWS)

Location: `/home/ryaneggz/ruska-ai/orchestra/backend/tests/unit/services/test_bedrock_service.py`

```python
import pytest
from unittest.mock import Mock, patch, MagicMock
from botocore.exceptions import ClientError, NoCredentialsError


class TestBedrockCredentials:
    """Test AWS credential resolution."""

    def test_credentials_from_environment(self):
        """Verify env vars are read correctly."""
        pass

    def test_credentials_from_profile(self):
        """Verify named profile resolution."""
        pass

    def test_no_credentials_raises_error(self):
        """Verify clear error when credentials missing."""
        pass

    def test_expired_session_token(self):
        """Verify handling of expired STS tokens."""
        pass


class TestBedrockModelSelection:
    """Test Bedrock model availability checks."""

    def test_valid_bedrock_model_id(self):
        """Verify valid model IDs are accepted."""
        pass

    def test_invalid_bedrock_model_id(self):
        """Verify invalid model IDs raise ValidationError."""
        pass

    def test_model_not_in_region(self):
        """Verify region-specific model availability."""
        pass


class TestBedrockErrorHandling:
    """Test AWS exception translation."""

    @pytest.mark.parametrize("error_code,expected_status", [
        ("AccessDeniedException", 403),
        ("ResourceNotFoundException", 404),
        ("ThrottlingException", 429),
        ("ValidationException", 400),
    ])
    def test_client_error_mapping(self, error_code, expected_status):
        """Verify AWS errors map to correct HTTP status."""
        pass
```

#### Integration Tests (Optional - Requires AWS Credentials)

Location: `/home/ryaneggz/ruska-ai/orchestra/backend/tests/integration/test_bedrock_integration.py`

```python
import pytest
import os


@pytest.mark.skipif(
    not os.getenv("AWS_BEDROCK_ACCESS_KEY_ID"),
    reason="AWS Bedrock credentials not configured"
)
class TestBedrockIntegration:
    """Integration tests requiring real AWS credentials."""

    async def test_invoke_bedrock_model(self):
        """Test actual model invocation."""
        pass

    async def test_bedrock_streaming(self):
        """Test streaming response from Bedrock."""
        pass
```

### 4.2 Mock Configuration for conftest.py

Add to `/home/ryaneggz/ruska-ai/orchestra/backend/tests/conftest.py`:

```python
@pytest.fixture(autouse=True)
async def mock_external_services():
    """Mock external services to prevent real API calls during tests."""
    with respx.mock:
        # ... existing mocks ...

        # Mock AWS Bedrock Converse API
        respx.post(
            url__regex=r"^https://bedrock-runtime\..*\.amazonaws\.com/model/.*/converse$"
        ).mock(
            return_value=respx.MockResponse(
                status_code=200,
                json={
                    "output": {
                        "message": {
                            "role": "assistant",
                            "content": [{"text": "Mock Bedrock response"}]
                        }
                    },
                    "stopReason": "end_turn",
                    "usage": {
                        "inputTokens": 10,
                        "outputTokens": 20,
                        "totalTokens": 30
                    }
                },
            )
        )

        # Mock Bedrock streaming endpoint
        respx.post(
            url__regex=r"^https://bedrock-runtime\..*\.amazonaws\.com/model/.*/converse-stream$"
        ).mock(
            return_value=respx.MockResponse(
                status_code=200,
                content=b'{"contentBlockStart":{"contentBlockIndex":0}}',
            )
        )

        yield


@pytest.fixture
def mock_bedrock_credentials(monkeypatch):
    """Provide mock AWS credentials for tests."""
    monkeypatch.setenv("AWS_BEDROCK_ACCESS_KEY_ID", "AKIAIOSFODNN7EXAMPLE")
    monkeypatch.setenv("AWS_BEDROCK_SECRET_ACCESS_KEY", "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY")
    monkeypatch.setenv("AWS_BEDROCK_REGION", "us-east-1")


@pytest.fixture
def sample_bedrock_request_dict():
    """Provide sample LLMRequest for Bedrock testing."""
    return {
        "input": {"messages": [{"role": "user", "content": "Hello, Bedrock!"}]},
        "model": "bedrock_converse:anthropic.claude-3-sonnet-20240229-v1:0",
        "metadata": {"user_id": None, "thread_id": None},
    }
```

### 4.3 Test Coverage Requirements

| Component | Coverage Target | Priority |
|-----------|-----------------|----------|
| Credential Resolution | 95% | CRITICAL |
| Error Handler | 90% | HIGH |
| Model ID Validation | 90% | HIGH |
| init_chat_model Integration | 85% | MEDIUM |
| Streaming Support | 80% | MEDIUM |

---

## 5. Edge Cases and Mitigation

### 5.1 Critical Edge Cases

| Edge Case | Scenario | Mitigation |
|-----------|----------|------------|
| **Missing Region** | User configures access key but forgets region | Default to `us-east-1` with warning log |
| **Model Not Enabled** | User tries model not enabled in their AWS account | Clear error message with link to Bedrock console |
| **Cross-Region Models** | Some models only available in specific regions | Validate model+region compatibility |
| **Token Expiration** | STS session tokens expire mid-conversation | Detect `ExpiredTokenException`, prompt re-auth |
| **Credential Priority** | Multiple credential sources conflict | Document explicit priority order |
| **Profile Not Found** | Named profile doesn't exist | Graceful fallback with warning |
| **VPC Endpoints** | Private VPC without internet access | Support custom endpoint_url configuration |
| **Guardrails Block** | Bedrock Guardrails reject content | Return 400 with guardrail violation details |

### 5.2 Model ID Validation

Bedrock model IDs follow specific patterns:

```python
# Valid Bedrock model ID patterns
BEDROCK_MODEL_PATTERNS = [
    r"^anthropic\.claude-.*$",
    r"^amazon\.titan-.*$",
    r"^meta\.llama.*$",
    r"^cohere\.command.*$",
    r"^mistral\.mistral-.*$",
    r"^ai21\..*$",
    # Cross-region inference pattern
    r"^(us|eu|ap)\.\w+\..*$",
]

def validate_bedrock_model_id(model_id: str) -> bool:
    """Validate Bedrock model ID format."""
    import re
    return any(re.match(pattern, model_id) for pattern in BEDROCK_MODEL_PATTERNS)
```

### 5.3 Region-Model Compatibility Matrix

Not all models are available in all regions. The system should validate:

```python
# Partial availability matrix (simplified)
BEDROCK_MODEL_REGIONS = {
    "anthropic.claude-3-opus": ["us-east-1", "us-west-2", "eu-west-1"],
    "anthropic.claude-3-sonnet": ["us-east-1", "us-west-2", "eu-west-1", "ap-northeast-1"],
    "amazon.titan-text-premier": ["us-east-1", "us-west-2"],
    "meta.llama3-70b": ["us-east-1", "us-west-2"],
}
```

---

## 6. Risk Assessment

### 6.1 Risk Matrix

| Risk | Likelihood | Impact | Mitigation | Residual Risk |
|------|------------|--------|------------|---------------|
| Credential Leak | LOW | CRITICAL | Separate credentials, no logging | VERY LOW |
| IAM Misconfiguration | MEDIUM | HIGH | Document minimum permissions | LOW |
| Region Unavailability | LOW | MEDIUM | Multi-region fallback | VERY LOW |
| Rate Limiting | MEDIUM | MEDIUM | Exponential backoff | LOW |
| Model Deprecation | LOW | LOW | Version-agnostic model IDs | VERY LOW |
| Cost Overruns | MEDIUM | MEDIUM | Usage monitoring, quotas | LOW |

### 6.2 Security Threat Model

```
THREAT: Credential Exposure
  - Vector: Log files, error messages, stack traces
  - Mitigation: Sanitize all AWS credential patterns
  - Detection: Secret scanning in CI/CD

THREAT: Privilege Escalation
  - Vector: Overly permissive IAM policy
  - Mitigation: Least-privilege policy template
  - Detection: AWS IAM Access Analyzer

THREAT: Man-in-the-Middle
  - Vector: Non-HTTPS endpoint connection
  - Mitigation: Enforce HTTPS (default), certificate validation
  - Detection: Network monitoring

THREAT: Denial of Service (Cost)
  - Vector: Malicious high-volume requests
  - Mitigation: Rate limiting, budget alerts
  - Detection: CloudWatch billing alarms
```

---

## 7. Implementation Complexity Assessment

### 7.1 Effort Estimation

| Component | Complexity | Effort (hours) | Dependencies |
|-----------|------------|----------------|--------------|
| Constants/Config | LOW | 2 | None |
| ChatModels Enum | LOW | 2 | Constants |
| Credential Resolver | MEDIUM | 4 | Constants |
| Error Handler | MEDIUM | 4 | Logger |
| Model Validation | LOW | 2 | None |
| Unit Tests | MEDIUM | 6 | Mocks |
| Integration Tests | MEDIUM | 4 | AWS Account |
| Documentation | LOW | 2 | All |

**Total Estimated Effort:** 26 hours (3-4 developer days)

### 7.2 Complexity Factors

1. **AWS SDK Complexity:** The `boto3`/`botocore` SDK has many configuration options; `langchain-aws` abstracts most of this but edge cases remain.

2. **Credential Chain:** AWS credential resolution involves multiple fallback sources, each with different behaviors.

3. **Regional Variation:** Model availability, pricing, and latency vary by region.

4. **Testing Without AWS:** Comprehensive mocking requires understanding of AWS API response formats.

### 7.3 Overall Complexity Rating

**MEDIUM-HIGH**

The integration is more complex than adding a simple API key provider due to:
- Multiple credential sources and priority logic
- Region-specific service availability
- AWS-specific error codes and retry logic
- IAM permission complexity

However, `langchain-aws` with `init_chat_model` abstracts most boto3 complexity, reducing implementation burden.

---

## 8. Recommended Implementation Order

1. **Phase 1: Foundation** (Day 1)
   - Add Bedrock constants to `src/constants/__init__.py`
   - Create credential validation utility
   - Implement error handler

2. **Phase 2: Integration** (Day 2)
   - Extend `ChatModels` enum in `src/constants/llm.py`
   - Update `get_all_models()` and related functions
   - Test `init_chat_model` with `bedrock_converse` provider

3. **Phase 3: Testing** (Day 3)
   - Add mock fixtures to `conftest.py`
   - Write unit tests for credential resolution
   - Write unit tests for error handling

4. **Phase 4: Documentation & Polish** (Day 4)
   - Update `.example.env` with Bedrock variables
   - Add IAM policy template to documentation
   - Integration testing with real AWS account

---

## 9. References

- [LangChain AWS Documentation](https://docs.langchain.com/oss/javascript/integrations/chat/bedrock_converse)
- [ChatBedrockConverse Source Code](https://github.com/langchain-ai/langchain-aws/blob/main/libs/aws/langchain_aws/chat_models/bedrock_converse.py)
- [AWS Bedrock API Reference](https://reference.langchain.com/python/integrations/langchain_aws/)
- [LangChain init_chat_model with Bedrock](https://docs.langchain.com/oss/python/langchain/models)
- [GitHub Issue: AWS API Keys Support](https://github.com/langchain-ai/langchain-aws/issues/582)

---

## 10. Approval Checklist

- [ ] Security review completed
- [ ] Error handling strategy approved
- [ ] Test plan approved
- [ ] IAM policy template created
- [ ] Documentation updated
- [ ] Cost impact assessed

---

**Prepared by:** GUARDIAN Agent
**Review Status:** PENDING
