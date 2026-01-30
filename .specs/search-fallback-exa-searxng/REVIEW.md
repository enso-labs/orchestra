# ELITE COUNCIL REVIEW: Exa Primary Search with SearXNG Fallback

**Date:** 2026-01-29
**Branch:** `bug/705-fallback-searxng-from-exa`
**Reviewers:** Search Architect, Fallback Strategist, Schema Unifier, Frontend Integrator, Config Sentinel

---

## 1. Proposal Comparison Matrix

| Criterion | Search Architect | Fallback Strategist | Schema Unifier | Frontend Integrator | Config Sentinel |
|-----------|:---:|:---:|:---:|:---:|:---:|
| **Architecture** | Good -- clean 3-phase fallback | Strong -- adds circuit breaker + quota detection | Good -- focuses on schema contract | Narrow -- frontend-only focus | Strong -- priority loop + registry pattern |
| **Maintainability** | High -- follows existing patterns | High -- explicit error classification | High -- proposes Pydantic model | Medium -- limited scope | High -- configurable priority chain |
| **Risk Coverage** | Good -- identifies sync SDK issue | Best -- quota exhaustion, race conditions, latency | Good -- schema mismatch risks | Good -- frontend crash risks | Good -- misconfiguration scenarios |
| **Completeness** | High -- end-to-end implementation | High -- includes circuit breaker | Medium -- schema focus, less on config | Low -- missing backend Exa integration | High -- deployment + migration covered |
| **Innovation** | Low -- straightforward | Medium -- circuit breaker flag | Medium -- Pydantic schema | Low -- defensive guards | High -- SEARCH_PROVIDER_PRIORITY env var |

---

## 2. Consensus Points

All five proposals agree on:

1. **Exa as primary, SearXNG as fallback, Tavily as tertiary** -- unanimous.
2. **New dependency: `exa-py`** -- all proposals specify this package.
3. **Add `EXA_API_KEY` to `UserTokenKey` enum and constants** -- unanimous.
4. **Follow existing `(results, error)` tuple pattern** for the new `_search_with_exa()` helper.
5. **Normalize Exa output** to `{title, link, snippet, engines[], score, source}` -- all agree on field mapping (`url` -> `link`, `highlights[0]` or `text[:300]` -> `snippet`, `engines: ["exa"]`).
6. **Fix pre-existing Tavily bug** -- add `"engines": ["tavily"]` to `_normalize_tavily_results()`.
7. **No major frontend changes required** -- backend normalization is the primary solution.
8. **Zero breaking changes** -- additive only, existing SearXNG/Tavily paths preserved.

---

## 3. Divergence Analysis

### 3.1 Exa API Call: `search()` vs `search_and_contents()`

- **Search Architect / Config Sentinel:** Use `exa.search()` (basic).
- **Fallback Strategist / Schema Unifier:** Use `exa.search_and_contents()` with `text=True, highlights=True`.

**Council Decision:** Use `search_and_contents()` with `highlights=True`. Without it, there is no snippet data, which is a required frontend field. This is critical for correctness.

### 3.2 Circuit Breaker for Quota Exhaustion

- **Fallback Strategist:** Proposes module-level `_exa_quota_exhausted` flag + `_is_exa_quota_error()` classifier.
- **All others:** No circuit breaker; rely on per-call fallback.

**Council Decision:** DEFER the circuit breaker. The per-call fallback already handles quota exhaustion correctly. The circuit breaker is an optimization that avoids one failed HTTP call per worker -- minimal benefit, adds global mutable state. Can be added later if latency becomes a concern.

### 3.3 `SEARCH_PROVIDER_PRIORITY` Configuration

- **Config Sentinel:** Proposes a `SEARCH_PROVIDER_PRIORITY` env var with a provider registry pattern.
- **All others:** Hardcode the priority order Exa -> SearXNG -> Tavily.

**Council Decision:** DEFER the priority env var. It adds complexity (registry, validation, startup logging) for a feature that has no immediate need. The hardcoded order matches the feature request. If operator customization is needed later, this can be added as a follow-up.

### 3.4 Remove SearXNG Default URL

- **Config Sentinel:** Proposes removing the `http://localhost:8080` default for `SEARX_SEARCH_HOST_URL`.
- **Others:** Do not address this.

**Council Decision:** DO NOT remove the default in this PR. It is a breaking change for dev environments. Out of scope for this feature.

### 3.5 Frontend Defensive Guard

- **Frontend Integrator / Schema Unifier / Fallback Strategist:** Add `(result.engines ?? []).map(...)` in `SearchEngine.tsx`.
- **Search Architect:** No frontend changes.

**Council Decision:** ADD the defensive guard. It is a one-line change that prevents runtime crashes from any future provider that might omit `engines`. Defense in depth.

### 3.6 Pydantic Schema Model

- **Schema Unifier:** Proposes a `SearchResult` Pydantic model in `backend/src/schemas/entities/search.py`.
- **Others:** Use plain dicts.

**Council Decision:** DEFER. The existing codebase uses plain dicts for search results. Adding Pydantic validation is a refactor that should be a separate PR.

### 3.7 TypeScript Interface

- **Frontend Integrator:** Proposes `SearchResult` TypeScript interface.
- **Others:** No mention.

**Council Decision:** DEFER. Nice-to-have but out of scope for this feature PR.

### 3.8 Async Handling of Sync Exa SDK

- **Search Architect:** Mentions `asyncio.to_thread()` wrapping.
- **Others:** Call sync Exa inside async function without wrapping.

**Council Decision:** USE `asyncio.to_thread()` to wrap the sync Exa SDK call. This prevents blocking the event loop, which is important in an async LangGraph pipeline.

---

## 4. Unified Implementation Plan

### Files to Modify

| File | Changes |
|------|---------|
| `backend/pyproject.toml` | Add `exa-py` dependency |
| `backend/.example.env` | Add `EXA_API_KEY=` |
| `backend/src/constants/__init__.py` | Add `EXA_API_KEY` to `UserTokenKey` enum + module-level var |
| `backend/src/tools/search.py` | Add `_search_with_exa()`, `_normalize_exa_results()`; reorder `web_search()` fallback chain; fix `_normalize_tavily_results()` to include `engines` |
| `frontend/src/components/tools/SearchEngine.tsx` | Add `?? []` guard on `result.engines` |

### Implementation Flow

1. Add `exa-py` dependency
2. Add `EXA_API_KEY` constant and enum entry
3. Add `_normalize_exa_results()` -- map Exa fields to canonical format
4. Add `_search_with_exa()` -- call `search_and_contents(highlights=True)`, wrap in `asyncio.to_thread()`
5. Reorder `web_search()`: Exa (primary) -> SearXNG (fallback) -> Tavily (tertiary)
6. Fix `_normalize_tavily_results()` to include `"engines": ["tavily"]`
7. Add `(result.engines ?? []).map(...)` guard in `SearchEngine.tsx`
8. Update `.example.env`

---

## 5. Risk Consolidation

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Exa `search_and_contents()` returns no highlights | Medium | Low | Fallback to `text[:300]` in normalizer |
| Exa free tier quota exhaustion | Medium | High | Fallback chain handles automatically |
| `exa-py` sync SDK blocks event loop | Medium | High | Wrap in `asyncio.to_thread()` |
| Tavily results missing `engines` (pre-existing bug) | High | Certain | Fixed in this PR |
| Frontend crash on missing `engines` | High | Medium | Defensive `?? []` guard added |
| Exa SDK import failure | Low | Low | Try/except on import; skip to SearXNG |
| SearXNG also fails after Exa | Medium | Medium | Tavily tertiary fallback preserved |

---

## 6. Final Verdict

**GO** -- Conditional on the following:

1. Use `search_and_contents(highlights=True)` (not bare `search()`)
2. Wrap sync Exa SDK in `asyncio.to_thread()`
3. Fix Tavily `engines` bug in same PR
4. Add frontend defensive guard

**Estimated effort:** 2-4 hours
**Files changed:** 5
**New dependencies:** 1 (`exa-py`)
**Breaking changes:** None
