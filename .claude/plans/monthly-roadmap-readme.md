# Plan: Monthly Roadmap in README.md

## Context

The README's Roadmap section is currently a single-item stub (line 208-211). The goal is to replace it with a structured monthly roadmap that:
- Details planned work each month so it can be promoted to audience (Discord, social)
- Tracks feature status (planned / in progress / shipped)
- Demonstrates project momentum to visitors
- Becomes a recurring monthly habit with low maintenance friction

## Approach

Replace the existing `## 🗺️ Roadmap` section (lines 208-211 of `README.md`) with a **rolling 3-month table format** using emoji status indicators.

### Format

```markdown
## 🗺️ Roadmap

Stay up to date on [Discord](https://discord.com/invite/QRfjg4YNzU). Full release history in [Changelog.md](./Changelog.md).

### March 2026

| Feature | Category | Status |
|---------|----------|--------|
| Feature Name | Category | 🔵 Planned |

### February 2026

| Feature | Category | Status |
|---------|----------|--------|
| [Search Threads](#) | UX | ✅ Shipped |
| [Migrate Memories Seeder](#) | Data | ✅ Shipped |
| [Docs Agent Guidance](#) | Docs | 🟡 In Progress |
| [Human-In-The-Loop](#) | Agent Control | 🔵 Planned |

### January 2026

| Feature | Category | Status |
|---------|----------|--------|
| [RLM Skill](#) | Skills | ✅ Shipped |
| [Distributed Workers (TaskIQ)](#) | Infra | ✅ Shipped |
| [Frontend Schedule Refactor](#) | Scheduling | ✅ Shipped |
| ... | | |

<details>
<summary>📦 Archive (Dec 2025 and earlier)</summary>

See [Changelog.md](./Changelog.md) for the full release history.

</details>
```

### Design Decisions

1. **Emoji status indicators** (`🔵 Planned`, `🟡 In Progress`, `✅ Shipped`) - three clear states, scannable in GitHub renders, Discord pastes, and social screenshots
2. **Category column** - gives quick context (Infra, UX, Skills, etc.) and makes social screenshots more informative
3. **Rolling 3 months visible** - enough to show momentum without bloating the README; older months collapse into `<details>` archive pointing to Changelog.md
4. **Issue links** - feature names link to GitHub issues (e.g., `[Search Threads](https://github.com/ruska-ai/orchestra/issues/801)`) when an issue exists
5. **Month headings as anchors** - `### February 2026` creates `#february-2026` for direct linking from Discord/social posts

### What Goes In vs. Stays Out

- **In the roadmap:** User-facing features, major capabilities, integrations, significant UX changes
- **Not in the roadmap:** Individual bug fixes, small refactors, internal tooling - those stay in Changelog.md only

### Monthly Maintenance Workflow

| When | Action | Time |
|------|--------|------|
| Start of month | Add new `### Month Year` section with 3-8 planned items as `🔵 Planned` | ~5 min |
| During month | Flip rows to `🟡 In Progress` when branch opens, `✅ Shipped` when PR merges | ~30 sec each |
| End of month | Carry forward any unshipped `🔵 Planned` items to new month; collapse oldest month into archive | ~2 min |

### Relationship to Changelog.md

- **Roadmap = promise** (human-readable names, status tracking, audience-facing)
- **Changelog = receipt** (branch names, dates, technical precision)
- No duplication: roadmap uses feature names, changelog uses branch names

## Implementation Steps

1. Read `Changelog.md` to extract notable features for Jan and Feb 2026
2. Map feature branch names (e.g., `feat/801-search-threads-tool`) to human-readable names and GitHub issue links (`https://github.com/ruska-ai/orchestra/issues/801`)
3. Replace lines 208-211 of `README.md` (the stub `## 🗺️ Roadmap` section) with the new format containing:
   - Intro line with Discord + Changelog links
   - `### March 2026` - empty template with planned items (you fill in)
   - `### February 2026` - backfilled from Changelog with issue links
   - `### January 2026` - backfilled from Changelog with issue links
   - `<details>` archive block for Dec 2025 and earlier
4. Keep the `---` separator and `## 🏢 Enterprise` section intact below

## Files to Modify

- **`/home/ryaneggz/ruska-ai/orchestra/README.md`** (lines 208-211) - Replace stub roadmap section with the new format, backfilling Jan and Feb 2026 from Changelog.md

## Verification

1. Render README.md on GitHub - confirm tables display correctly and emoji renders
2. Verify anchor links work (e.g., `#february-2026`)
3. Confirm `<details>` archive block collapses/expands properly
4. Visual check that the section fits naturally between `## 🤝 Integrations` and `## 🏢 Enterprise`
