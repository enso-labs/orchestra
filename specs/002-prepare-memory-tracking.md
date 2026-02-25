# Spec 002: Track Original Memory Content for Diffing

## Objective
Modify `prepare_memory_files()` to also return original content for each memory file, enabling change detection.

## Files Modified
- `backend/src/agents/__init__.py` — `prepare_memory_files()` return type

## Changes

### Current return
```python
tuple[dict, list[str] | None]  # (files_map, sources)
```

### New return
```python
tuple[dict, list[str] | None, dict[str, str]]  # (files_map, sources, original_content)
```

Where `original_content` maps path → content string for diffing later.

## Notes
- `original_content` is used by `MemorySyncMiddleware` to detect which files actually changed
- Only memory-sourced paths are tracked; other StateBackend files are ignored
- Content is stored as plain strings (before `create_file_data()` wrapping)

## Tests
- `prepare_memory_files()` returns original content dict
- Content matches what was loaded from MemoryRepo
- Typecheck passes
