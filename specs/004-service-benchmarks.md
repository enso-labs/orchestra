# Spec 004: Service Layer & Agent Benchmarks

## Objective
Benchmark service-layer logic and agent initialization to find CPU-bound bottlenecks.

## Files Created
- `backend/tests/benchmarks/test_service_benchmarks.py`

## Benchmarks to Implement

### Agent Services
- `bench_agent_initialization` — time to set up an agent context
- `bench_tool_resolution` — resolving tools for an assistant
- `bench_prompt_assembly` — assembling system prompt from assistant config

### Streaming
- `bench_stream_setup` — time to initialize a streaming response (without LLM call)

### Serialization
- `bench_schema_serialization` — Pydantic model serialization for large payloads
- `bench_schema_validation` — Pydantic model validation for incoming requests

## Acceptance Criteria
- Service benchmarks isolate business logic from I/O
- Any operation >50ms flagged for investigation
