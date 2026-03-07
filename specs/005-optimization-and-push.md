# Spec 005: Optimization & Push

## Objective
Fix any slow operations found in benchmarks, document results, and push all changes.

## Steps

1. **Analyze benchmark results** — identify any operation exceeding thresholds:
   - Repo operations: >100ms
   - Route handlers: >200ms
   - Service logic: >50ms

2. **Root cause analysis** — for each slow operation:
   - Profile with cProfile or line_profiler
   - Document the bottleneck (N+1 queries, missing indexes, unnecessary serialization, etc.)
   - Record findings in `backend/BENCHMARKS.md`

3. **Implement fixes** — common patterns:
   - Add eager loading for N+1 query issues
   - Add database indexes
   - Cache frequently accessed data
   - Optimize serialization (use `.model_dump()` with `exclude` instead of full serialization)
   - Reduce unnecessary async overhead

4. **Re-run benchmarks** — verify improvements with before/after comparison

5. **Document results** — create `backend/BENCHMARKS.md` with:
   - Benchmark methodology
   - Before/after results table
   - Optimizations applied

6. **Commit and push** — all changes pushed to `feat/838-backend-benchmarks` for review

## Acceptance Criteria
- All slow operations have documented root causes
- Fixes verified with improved benchmark numbers
- All changes committed and pushed to the PR branch
