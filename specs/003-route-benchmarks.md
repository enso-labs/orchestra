# Spec 003: Route/Endpoint Benchmarks

## Objective
Benchmark API route handlers to identify slow endpoints including serialization overhead.

## Files Created
- `backend/tests/benchmarks/test_route_benchmarks.py`

## Benchmarks to Implement

### Health & Info
- `bench_health_check` — `/v0/info/health` baseline

### Threads
- `bench_list_threads_route` — `GET /v0/threads`
- `bench_create_thread_route` — `POST /v0/threads`
- `bench_get_thread_route` — `GET /v0/threads/{id}`

### Assistants
- `bench_list_assistants_route` — `GET /v0/assistants`
- `bench_create_assistant_route` — `POST /v0/assistants`

### Memory
- `bench_list_memories_route` — `GET /v0/memories`
- `bench_create_memory_route` — `POST /v0/memories`

### LLM
- `bench_list_models_route` — `GET /v0/llm/models`

### Tools
- `bench_list_tools_route` — `GET /v0/tools`

## Approach
Use FastAPI TestClient with mocked dependencies for consistent results.

## Acceptance Criteria
- All route benchmarks produce timing data
- Serialization overhead measured (route time - repo time)
- Any endpoint >200ms flagged for investigation
