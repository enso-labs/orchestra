# Council Review: Enable Default Tools for `ruska chat`

## Context

**Feature Under Review:** Enable Default Tools for `ruska chat`

The `ruska chat` command needs to send default tools (`web_search`, `web_scrape`, `math_calculator`, `think_tool`, `python_sandbox`) to the API by default, with options to disable all tools (`--tools=disabled`) or specify a custom subset (`--tools=tool1,tool2`).

## Proposals Reviewed

1. **AGENT_1: ARCHITECT** - System design and scalability focus
2. **AGENT_2: CRAFTSMAN** - Clean code and SOLID principles focus
3. **AGENT_3: GUARDIAN** - Security, error handling, and testing focus

---

## 1. Proposal Comparison Matrix

| Aspect | ARCHITECT | CRAFTSMAN | GUARDIAN | Council Verdict |
|--------|-----------|-----------|----------|-----------------|
| **Constants Location** | `constants/tools.ts` (new) | `types/index.ts` | `lib/tools.ts` | **`lib/tools.ts`** - Single file for constants + parser |
| **Parser Function** | `parseToolsFlag()` with mode metadata | `parseTools()` simple | `parseToolsFlag()` | **`parseToolsFlag()`** - Clear naming |
| **Return Type** | `{ tools: string[], mode: 'default'|'disabled'|'custom' }` | `string[]` | `string[] \| undefined` | **`string[]`** - Simple, sufficient |
| **Empty String Handling** | Custom mode with empty array | Empty array | Defaults | **Defaults** - Aligns with undefined |
| **Test Count** | ~8 tests | ~15 tests | ~16 tests | **~12 core tests** - Comprehensive but focused |
| **File Organization** | 3 new files | 2 new files | 2 new files | **2 new files** - Minimal footprint |

---

## 2. Consensus Points

All proposals agree on:

1. **`DEFAULT_AGENT_TOOLS`** constant matching frontend:
   ```typescript
   ["web_search", "web_scrape", "math_calculator", "think_tool", "python_sandbox"]
   ```

2. **Three tool modes:**
   - Undefined/omitted: Use default tools
   - `disabled`: Empty array
   - Comma-separated: Custom list

3. **Case-insensitive `disabled`** keyword handling

4. **Parsing logic pattern** from `create-assistant.tsx`:
   ```typescript
   value.split(',').map(t => t.trim()).filter(Boolean)
   ```

5. **Files to modify:**
   - `cli.tsx` - Route tools to chat command
   - `chat.tsx` - Include tools in StreamRequest

6. **StreamRequest.tools** already exists - no type changes needed

7. **Backend validates tool names** - CLI should not whitelist

8. **Complexity: Small, Risk: Low** - estimated 2-4 hours

---

## 3. Divergence Analysis

### 3.1 Constants File Location

| Proposal | Location | Trade-off |
|----------|----------|-----------|
| ARCHITECT | `constants/tools.ts` | New directory, clear separation |
| CRAFTSMAN | `types/index.ts` | Reuse existing exports |
| GUARDIAN | `lib/tools.ts` | Co-locate with parser |

**Council Decision:** `lib/tools.ts`
- Keeps constant near its only consumer
- Avoids creating new directory structure
- Export through `types/index.ts` if needed elsewhere

### 3.2 Parser Return Type

| Proposal | Return Type | Trade-off |
|----------|-------------|-----------|
| ARCHITECT | `{ tools, mode }` | Rich metadata for logging |
| CRAFTSMAN | `string[]` | Simple, direct |
| GUARDIAN | `string[]` | Simple, no undefined |

**Council Decision:** `string[]`
- Mode metadata is over-engineering for current needs
- Can be added later if logging requirements emerge
- Simpler contract for consumers

### 3.3 Empty String Handling

| Proposal | `parseToolsFlag("")` Returns | Rationale |
|----------|------------------------------|-----------|
| ARCHITECT | `[]` (custom mode) | Explicit empty |
| CRAFTSMAN | `[]` | Parsed as empty list |
| GUARDIAN | `DEFAULT_AGENT_TOOLS` | Aligns with undefined |

**Council Decision:** `DEFAULT_AGENT_TOOLS`
- User intent unclear with empty string - safe default
- Consistent with undefined behavior
- Use `disabled` for explicit no-tools

### 3.4 Helper Function `isDefaultTools()`

| Proposal | Include? | Use Case |
|----------|----------|----------|
| CRAFTSMAN | Yes | Display logic |
| Others | No | YAGNI |

**Council Decision:** No - YAGNI
- No current display requirement
- Can be added when needed
- Reduces initial scope

---

## 4. Unified Implementation Plan

### 4.1 Recommended Architecture

```
cli/source/
├── lib/
│   └── tools.ts          # NEW: DEFAULT_AGENT_TOOLS + parseToolsFlag()
├── __tests__/
│   └── tools.test.ts     # NEW: Unit tests
├── cli.tsx               # MODIFY: Route tools to chat
├── commands/
│   └── chat.tsx          # MODIFY: Include tools in StreamRequest
└── types/
    └── stream.ts         # READ ONLY: StreamRequest.tools exists
```

### 4.2 Implementation Sequence

**Step 1: Create `lib/tools.ts`**
```typescript
/**
 * Default tools and parsing for chat command
 */

export const DEFAULT_AGENT_TOOLS = [
  'web_search',
  'web_scrape',
  'math_calculator',
  'think_tool',
  'python_sandbox',
] as const;

export type DefaultAgentTool = typeof DEFAULT_AGENT_TOOLS[number];

/**
 * Parse --tools flag value into array of tool names
 *
 * @param value - Raw flag value (undefined, 'disabled', or comma-separated)
 * @returns Array of tool names to send to API
 */
export function parseToolsFlag(value: string | undefined): string[] {
  // No flag or empty string: use defaults
  if (value === undefined || value.trim() === '') {
    return [...DEFAULT_AGENT_TOOLS];
  }

  // Explicit disable
  if (value.toLowerCase() === 'disabled') {
    return [];
  }

  // Parse comma-separated list
  return value
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);
}
```

**Step 2: Create `__tests__/tools.test.ts`**
- Test undefined returns defaults
- Test empty string returns defaults
- Test whitespace-only returns defaults
- Test 'disabled' returns empty array
- Test 'DISABLED' returns empty array (case-insensitive)
- Test single tool
- Test comma-separated tools
- Test whitespace trimming
- Test empty element filtering
- Test trailing/leading commas
- Test DEFAULT_AGENT_TOOLS has expected values

**Step 3: Modify `cli.tsx`**
- Update help text to document `--tools` for chat
- Pass `cli.flags.tools` to `runChatCommand`

**Step 4: Modify `chat.tsx`**
- Import `parseToolsFlag` from `../lib/tools.js`
- Add `tools?: string` to options type in `runChatCommand`
- Parse tools in `runChatCommand`: `const parsedTools = parseToolsFlag(options.tools)`
- Pass `tools` to `ChatCommand` component
- Add `tools` to `ChatCommandProps` type
- Include `tools` in both TUI and JSON mode `StreamRequest` objects

**Step 5: Update `README.md`**
- Add `--tools` to Chat Options table
- Add examples for default, disabled, and custom tools

**Step 6: Update help text in `cli.tsx`**
- Add under Chat Options:
  ```
  --tools           Tools to enable (default: web_search,web_scrape,math_calculator,think_tool,python_sandbox)
                    Use --tools=disabled to disable all tools
                    Use --tools=tool1,tool2 for specific tools
  ```

### 4.3 Critical Path Items

1. `lib/tools.ts` - Foundation (must be first)
2. `__tests__/tools.test.ts` - Validate before integration
3. `chat.tsx` - Core integration
4. `cli.tsx` - Wire it together
5. Documentation - Can be parallel

### 4.4 Non-Negotiable Requirements

- [ ] `DEFAULT_AGENT_TOOLS` must match frontend exactly
- [ ] Empty string and undefined must return defaults
- [ ] `disabled` must be case-insensitive
- [ ] `StreamRequest.tools` field must be used (already typed)
- [ ] All unit tests must pass
- [ ] README must document the flag

---

## 5. Risk Consolidation

### 5.1 Combined Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Backend rejects unknown tools | Low | Low | Document valid tools; backend handles gracefully |
| Breaking change for scripts | Very Low | Medium | Default adds capability; explicit opt-out available |
| Tool name case sensitivity | Low | Low | Pass as-is; backend is source of truth |
| Empty string ambiguity | Low | Low | Council decision: treat as defaults |

### 5.2 Mitigation Strategies

1. **Backend compatibility:** Don't validate tool names client-side
2. **Backward compatibility:** Default behavior enhances (adds tools)
3. **User confusion:** Clear help text and README documentation
4. **Testing gaps:** Comprehensive unit tests before integration

---

## 6. Final Verdict

| Criterion | Assessment |
|-----------|------------|
| **Recommendation** | **GO** |
| **Confidence Level** | **High** |
| **Scope** | Small |
| **Risk Level** | Low |
| **Estimated Effort** | 2-4 hours |
| **Files Changed** | 5 (2 new, 3 modified) |
| **Lines of Code** | ~150 (including tests) |

### Conditions for Success

1. All unit tests pass
2. Manual testing of three modes:
   - `ruska chat "Hello"` - uses default tools
   - `ruska chat "Hello" --tools=disabled` - no tools
   - `ruska chat "Hello" --tools=web_search` - single tool
3. README documentation is complete
4. Help text is accurate
5. Existing tests continue to pass

### Implementation Order

| Phase | Component | Priority |
|-------|-----------|----------|
| 1 | `lib/tools.ts` | Critical |
| 2 | `__tests__/tools.test.ts` | Critical |
| 3 | `chat.tsx` modifications | High |
| 4 | `cli.tsx` modifications | High |
| 5 | README.md updates | Medium |

---

## Council Signatures

- **ARCHITECT**: Approved - architecture is minimal and extensible
- **CRAFTSMAN**: Approved - code is clean and follows established patterns
- **GUARDIAN**: Approved - edge cases handled, tests specified
