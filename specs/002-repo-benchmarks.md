# Spec 002: Repository Layer Benchmarks

## Objective
Benchmark all repository operations (CRUD) to identify slow database interaction patterns.

## Files Created
- `backend/tests/benchmarks/test_repo_benchmarks.py`

## Benchmarks to Implement

### Memory Repo
- `bench_create_memory` — single memory creation
- `bench_list_memories` — list with pagination (100, 500, 1000 records)
- `bench_search_memories` — vector similarity search if applicable
- `bench_delete_memory` — single deletion

### Thread Repo
- `bench_create_thread` — thread creation
- `bench_list_threads` — list with pagination
- `bench_get_thread_with_messages` — thread + message join

### Assistant Repo
- `bench_create_assistant` — assistant creation
- `bench_list_assistants` — list all for a user

### Tool Repo
- `bench_list_tools` — tool listing
- `bench_invoke_tool_lookup` — tool resolution by name

## Acceptance Criteria
- All repo benchmarks run against mocked/test DB
- Results table shows operations/sec for each benchmark
- Any operation >100ms flagged for investigation
