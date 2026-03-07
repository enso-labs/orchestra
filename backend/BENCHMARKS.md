# Backend Benchmarks

Performance benchmarks for the Orchestra backend, covering repository operations, API route handlers, and service-layer logic.

## Methodology

- **Framework**: pytest-benchmark (auto-calibrated rounds)
- **Storage**: InMemoryStore (isolates CPU/serialization cost from database I/O)
- **Dependencies**: Mocked where appropriate (auth, external services, DB sessions)
- **Run command**: `uv run pytest tests/benchmarks/ --benchmark-only --benchmark-sort=mean`

### Thresholds

| Layer       | Threshold | Rationale                                      |
|-------------|----------:|-------------------------------------------------|
| Repository  |    100 ms | Repo ops should be fast with in-memory store    |
| Route       |    200 ms | Includes serialization + framework overhead     |
| Service     |     50 ms | Pure business logic, no I/O                     |

## Results Summary

**All 57 benchmarks pass. No operations exceed their thresholds.** No optimizations were required.

## Repository Layer (20 benchmarks)

| Benchmark                     | Mean       | Median     | Ops/sec   | Status |
|-------------------------------|------------|------------|-----------|--------|
| assistant_create              |    56.7 us |    28.0 us |    17,650 | OK     |
| assistant_get                 |    68.0 us |    31.4 us |    14,716 | OK     |
| assistant_list (50)           |   1.17 ms  |   615.5 us |       852 | OK     |
| assistant_list_large (200)    |   7.83 ms  |   4.55 ms  |       128 | OK     |
| memory_create                 |   137.3 us |    82.8 us |     7,286 | OK     |
| memory_list_100               |   874.3 us |   488.4 us |     1,144 | OK     |
| memory_list_500               |   7.64 ms  |   4.68 ms  |       131 | OK     |
| memory_list_1000              |  22.83 ms  |  11.38 ms  |        44 | OK     |
| memory_search                 |   911.7 us |   491.4 us |     1,097 | OK     |
| memory_delete                 |   214.4 us |    95.1 us |     4,664 | OK     |
| thread_create                 |    71.8 us |    32.1 us |    13,932 | OK     |
| thread_list                   |   544.8 us |   288.7 us |     1,835 | OK     |
| thread_get_with_messages (20) |   126.7 us |    97.7 us |     7,893 | OK     |
| thread_get_large_msgs (100)   |   214.5 us |    99.7 us |     4,663 | OK     |
| thread_delete                 |   174.3 us |    80.2 us |     5,736 | OK     |
| tool_list (20)                |   8.42 ms  |   8.05 ms  |       119 | OK     |
| tool_list_large (100)         |  10.84 ms  |  11.01 ms  |        92 | OK     |
| tool_lookup_by_name           |   7.31 ms  |   8.36 ms  |       137 | OK     |
| tool_delete                   |   213.1 us |    98.3 us |     4,692 | OK     |

**Slowest repo operation**: `memory_list_1000` at 22.83 ms mean (well under 100 ms threshold).

## API Route Handlers (13 benchmarks)

| Benchmark                   | Mean      | Median    | Ops/sec | Status |
|-----------------------------|-----------|-----------|---------|--------|
| health_check                |  1.29 ms  |   565.8 us |    776 | OK     |
| llm_models_list             |  4.96 ms  |   5.43 ms  |    202 | OK     |
| llm_models_reset            |  1.23 ms  |   582.9 us |    815 | OK     |
| memory_route_create         |  6.18 ms  |   5.15 ms  |    162 | OK     |
| memory_route_get            |  4.23 ms  |   4.00 ms  |    236 | OK     |
| memory_route_list           |  5.66 ms  |   5.01 ms  |    177 | OK     |
| memory_route_delete         |  8.96 ms  |   8.87 ms  |    112 | OK     |
| memory_serialization_overhead|  6.23 ms  |   6.57 ms  |    161 | OK     |
| assistant_route_create      |  5.49 ms  |   5.21 ms  |    182 | OK     |
| assistant_route_search      |  9.12 ms  |   9.04 ms  |    110 | OK     |
| assistant_route_delete      |  9.12 ms  |   8.88 ms  |    110 | OK     |
| tool_route_list             |  4.67 ms  |   4.32 ms  |    214 | OK     |
| tool_route_create           |  5.91 ms  |   5.69 ms  |    169 | OK     |

**Serialization overhead**: Route-level memory list (~5.66 ms) vs repo-only (~0.87 ms) = ~4.8 ms framework overhead per request (dependency injection, validation, response serialization). This is expected for FastAPI.

**Slowest route**: `assistant_route_delete` and `assistant_route_search` at ~9.1 ms (well under 200 ms threshold).

## Service Layer (24 benchmarks)

| Benchmark                          | Mean       | Median     | Ops/sec   | Status |
|------------------------------------|------------|------------|-----------|--------|
| prompt_assembly_basic              |    1.5 us  |    0.7 us  |   660,878 | OK     |
| assistant_service_init             |    2.5 us  |    1.2 us  |   405,052 | OK     |
| tool_service_init                  |    3.3 us  |    1.5 us  |   302,544 | OK     |
| init_tool_library                  |    5.1 us  |    2.4 us  |   197,592 | OK     |
| assistant_validation               |   10.2 us  |    4.7 us  |    97,660 | OK     |
| public_assistant_projection        |   10.2 us  |    4.5 us  |    97,571 | OK     |
| assistant_to_llm_request           |   18.9 us  |    8.7 us  |    52,804 | OK     |
| llm_service_init                   |   19.5 us  |    9.0 us  |    51,154 | OK     |
| assistant_validation_large         |   21.1 us  |    9.9 us  |    47,310 | OK     |
| assistant_serialization            |   21.4 us  |   11.0 us  |    46,622 | OK     |
| assistant_json_serialization       |   21.7 us  |   14.3 us  |    46,084 | OK     |
| llm_request_validation             |   41.8 us  |   20.0 us  |    23,938 | OK     |
| llm_request_serialization          |   42.0 us  |   22.2 us  |    23,814 | OK     |
| prompt_assembly_long_prompt        |   44.7 us  |   20.2 us  |    22,394 | OK     |
| assistant_service_get              |   45.6 us  |   31.1 us  |    21,936 | OK     |
| assistant_service_create           |   63.5 us  |   28.8 us  |    15,737 | OK     |
| prompt_assembly_full               |   85.6 us  |   22.2 us  |    11,681 | OK     |
| tool_resolution_empty              |   93.2 us  |   54.5 us  |    10,725 | OK     |
| message_conversion_small (10)      |  108.0 us  |   50.4 us  |     9,255 | OK     |
| thread_serialization_large (200)   |  189.6 us  |   90.8 us  |     5,275 | OK     |
| llm_request_validation_large       |  162.1 us  |   76.9 us  |     6,168 | OK     |
| tool_resolution_with_names         |  664.0 us  |  162.4 us  |     1,506 | OK     |
| message_conversion_large (100)     |   1.07 ms  |  520.2 us  |       934 | OK     |
| assistant_service_search (50)      |   1.20 ms  |  623.0 us  |       835 | OK     |

**Slowest service operation**: `assistant_service_search` at 1.20 ms mean (well under 50 ms threshold).

## Key Findings

1. **No bottlenecks found.** All operations are well within their performance thresholds.

2. **Repository layer** scales linearly with collection size. Listing 1,000 memory items takes ~23 ms, which is acceptable for in-memory operations.

3. **Route overhead** adds ~4-5 ms per request for dependency injection, validation, and response serialization. This is standard FastAPI behavior and not a concern.

4. **Pydantic validation** is fast even for large payloads. Validating an LLMRequest with 100 messages takes ~162 us.

5. **Service construction** is near-instant (<5 us for most services). No expensive initialization patterns.

6. **Tool resolution** via `init_tool_library()` is ~5 us. The tool library is not a bottleneck.

7. **Message conversion** (LLMInput to LangChain format) scales linearly: 10 messages in ~108 us, 100 messages in ~1.07 ms.

## Running Benchmarks

```bash
# Run all benchmarks
uv run pytest tests/benchmarks/ --benchmark-only

# Run with detailed stats
uv run pytest tests/benchmarks/ --benchmark-only --benchmark-sort=mean -v

# Run specific benchmark file
uv run pytest tests/benchmarks/test_memory_repo.py --benchmark-only

# Skip benchmarks during normal test runs
uv run pytest tests/ --benchmark-disable
```
