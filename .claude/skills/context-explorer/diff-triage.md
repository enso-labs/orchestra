# Skill: Diff Triage

## Purpose
Prioritize diff files by signal value to focus analysis on high-information sources first.

## Inputs
- [ ] Git diff output (file list with change stats)
- [ ] Branch/commit range
- [ ] Repository context (language, framework)

## Outputs
- [ ] Prioritized file list (P0/P1/P2)
- [ ] Signal value score per file
- [ ] Recommended analysis order
- [ ] Low-signal files to skip

## Execution Checklist

1. [ ] Get diff stat summary
   ```bash
   git diff --stat <base>...<head>
   ```

2. [ ] Classify each file by signal value
   - Documentation changes (`.md`, `README`, `PROPOSAL`) → **P0**
   - Test files (`*.test.*`, `*.spec.*`, `test_*`) → **P0**
   - Type definitions (`*.d.ts`, `schemas/`, `models/`) → **P1**
   - Configuration (`.env.example`, `config/`) → **P1**
   - Source code (business logic) → **P1**
   - Build/infra (`Dockerfile`, `.yml`, `package.json`) → **P2**
   - Generated files (`package-lock.json`, `*.min.js`) → **SKIP**

3. [ ] Score by change type
   - New file (+) → Higher signal (reveals intent)
   - Deleted file (-) → Medium signal (reveals scope)
   - Modified file (±) → Variable (depends on size)

4. [ ] Score by change size
   - Small changes (1-10 lines) → May be low signal
   - Medium changes (10-100 lines) → High signal
   - Large changes (100+ lines) → May be refactor/noise

5. [ ] Output prioritized list
   ```
   P0: High-signal sources
   - docs/PROPOSAL.md (+150 lines) - NEW PROPOSAL
   - src/auth/auth.test.ts (+80 lines) - TEST COVERAGE

   P1: Medium-signal sources
   - src/auth/types.ts (+25 lines) - TYPE DEFINITIONS
   - src/auth/service.ts (+120 lines) - BUSINESS LOGIC

   P2: Low-signal sources
   - package.json (+2 lines) - DEPENDENCY

   SKIP: No-signal sources
   - package-lock.json (+1500 lines) - GENERATED
   ```

## Failure Signals

- **No diff output** → Verify git range is correct
- **All files marked P2** → Re-evaluate scoring criteria
- **Only generated files** → Look for branch with source changes
- **Too many P0 files (>10)** → Further prioritize within P0

## Quality Gates

- [ ] At least one P0 file identified (docs or tests)
- [ ] Generated files marked SKIP
- [ ] Files sorted by priority
- [ ] Rationale provided for priority assignment
- [ ] Analysis order recommendation included

## Signal Value Heuristics

### High-Signal Patterns (P0)
- `*PROPOSAL*.md` - Explicit intent documentation
- `*SPEC*.md` - Specification documents
- `*.test.*` - Behavioral contracts
- `README.md` - User-facing changes
- `CHANGELOG.md` - Release intent

### Medium-Signal Patterns (P1)
- `*/schemas/*` - Data contracts
- `*/types/*` - Type definitions
- `*/models/*` - Data models
- `*/config/*` - Configuration
- `.env.example` - Environment changes

### Low-Signal Patterns (P2)
- `Dockerfile` - Infrastructure
- `docker-compose.yml` - Service config
- `*.yml` (CI/CD) - Build process
- `package.json` (minimal changes) - Dependencies

### Skip Patterns
- `package-lock.json`
- `*.min.js`
- `*.bundle.js`
- `dist/*`
- `build/*`
- `.next/*`
