# Spec 001: Benchmark Setup

## Objective
Add pytest-benchmark as a dev dependency and create the benchmark infrastructure for the backend.

## Files Modified
- `backend/pyproject.toml` — add `pytest-benchmark` to dev dependencies
- `backend/tests/benchmarks/conftest.py` — shared fixtures for benchmarks
- `backend/tests/benchmarks/__init__.py` — package init

## Changes

### `pyproject.toml`
Add to dev dependencies:
```
pytest-benchmark>=4.0
```

### `backend/tests/benchmarks/conftest.py`
Create shared fixtures:
- Mock DB session fixture (reuse from existing `tests/conftest.py`)
- Sample data factories for assistants, threads, messages, memories
- Benchmark configuration (min_rounds=5, warmup=True)

### `backend/tests/benchmarks/__init__.py`
Empty init file.

## Acceptance Criteria
- `uv run pytest tests/benchmarks/ --benchmark-only` runs without errors
- Benchmark results output in table format with min/max/mean/stddev
