---
name: roadmap
description: |
  Collaborative monthly roadmap update workflow for the Orchestra project README.md.
  Use when the user wants to update, roll forward, or maintain the rolling 3-month
  roadmap table in README.md. Triggers on: "update roadmap", "roadmap update",
  "monthly roadmap", "update the readme roadmap".
  This skill is ALWAYS interactive — it never auto-generates changes without user input.
---

# Roadmap

Guides a collaborative, step-by-step workflow to update the rolling 3-month roadmap table in `README.md`. Discovers merged features, asks the user which items belong on the roadmap, names and categorizes them, handles month rolling, and only edits files after the user approves a plan.

---

## Roadmap Format Reference

The roadmap lives under `## 🗺️ Roadmap` in `README.md`. It maintains three visible months plus an archive block:

```markdown
### March 2026          ← upcoming month (🔵 Planned items)

| Feature | Category | Status |
|---------|----------|--------|
| [Feature Name](https://github.com/ruska-ai/orchestra/issues/NNN) | Category | 🔵 Planned |

### February 2026       ← current month (mix of statuses)

| Feature | Category | Status |
|---------|----------|--------|
| [Feature Name](https://github.com/ruska-ai/orchestra/issues/NNN) | Category | ✅ Shipped |

### January 2026        ← previous month (mostly ✅ Shipped)

| Feature | Category | Status |
|---------|----------|--------|
| [Feature Name](https://github.com/ruska-ai/orchestra/issues/NNN) | Category | ✅ Shipped |

<details>
<summary>📦 Archive (Dec 2025 and earlier)</summary>

See [Changelog.md](./Changelog.md) for the full release history.

</details>
```

**Status emoji legend**:
- `🔵 Planned` — committed for the upcoming month
- `🟡 In Progress` — work started, not yet shipped
- `✅ Shipped` — merged and released

**Issue linking**: Branch `feat/801-search-threads-tool` → issue #801 → link `https://github.com/ruska-ai/orchestra/issues/801`

**Valid categories**: UX, Infra, Skills, Agents, Data, Scheduling, Integrations, Settings, Docs, Agent Control

---

## What Belongs on the Roadmap

**Include** (user-facing, meaningful scope):
- New features users can interact with directly
- Major infrastructure changes that unblock user scenarios
- New skills or agents that expand what Orchestra can do
- Significant data or settings improvements

**Exclude** (internal, minor, or invisible):
- Bug fixes and hotfixes
- Small refactors without user-visible impact
- Dev tooling updates (CI changes, linting, scripts)
- Documentation-only updates
- Dependency bumps

---

## Workflow

### Phase 1: Discover — Read Current State

1. Read `README.md` to capture the current roadmap section: which three months are visible, what items exist, and their current statuses.
2. Read `Changelog.md` to find recently merged branches since the last roadmap update.
3. Run `git log --oneline --merges origin/development -20` to find any recent merge commits not yet in Changelog.
4. Extract candidate features from branch names using the pattern `feat/<issue#>-<slug>` → issue number + human-readable slug.
5. Cross-reference candidates against existing roadmap items (skip anything already listed).
6. Present a discovery summary to the user:

```
## Roadmap Discovery

### Current Roadmap State
- Upcoming: [Month] — N items
- Current:  [Month] — N items
- Previous: [Month] — N items

### Candidate Features (merged since last update)
- feat/801-search-threads-tool → issue #801 "search-threads-tool"
- feat/787-migrate-memories-seeder → issue #787 "migrate-memories-seeder"
- [... more ...]

### Already on Roadmap (skip)
- [items already listed]
```

### Phase 2: Select — Ask Which Features Belong

Ask the user to select which candidate features are user-facing enough for the roadmap.

Present the list and ask:

```
Which of these merged features should appear on the roadmap?
Reply with the numbers (e.g. "1, 3, 4") or "all" or "none".
Also flag any I should skip with a reason if helpful.

1. feat/801 — search-threads-tool
2. feat/787 — migrate-memories-seeder
3. feat/724 — add-watcher-to-worker-reload
...
```

Wait for the user's selection before proceeding.

### Phase 3: Name & Categorize — Ask for Human-Readable Details

For each selected feature, ask the user to provide:
- A human-readable display name (e.g., "Search Threads" not "search-threads-tool")
- A category from the valid list (UX, Infra, Skills, Agents, Data, Scheduling, Integrations, Settings, Docs, Agent Control)

Present all selected items at once for efficient input:

```
For each selected feature, provide a display name and category.
Format: "1. Display Name | Category"

1. feat/801 — search-threads-tool
   Suggested: "Search Threads | UX"

2. feat/787 — migrate-memories-seeder
   Suggested: "Migrate Memories Seeder | Data"

Reply with corrections or "ok" to accept all suggestions.
```

Make reasonable name/category suggestions based on the branch slug so the user only needs to correct, not fill in from scratch.

Wait for the user's response before proceeding.

### Phase 4: Status & Month Assignment — Ask Where Items Go

Determine which month each item belongs to and what status it should have.

Ask the user:

```
For each item, confirm the target month and status.

Items to assign:
1. Search Threads (issue #801)
   - Merged: 2026-02-18 → Current month (February 2026)
   - Suggested status: ✅ Shipped
   - Correct? (y / specify different month or status)

2. Migrate Memories Seeder (issue #787)
   - Merged: 2026-02-18 → Current month (February 2026)
   - Suggested status: ✅ Shipped
   - Correct? (y / specify)

Also: Are there any status changes needed for EXISTING roadmap items?
(e.g., flip "🔵 Planned" → "🟡 In Progress", or "🟡 In Progress" → "✅ Shipped")
```

Wait for the user's response before proceeding.

### Phase 5: Planned Items — Ask About Upcoming Month

Ask the user about any new planned items for the upcoming month:

```
Do you have any new planned items to add for [Upcoming Month]?

If yes, provide each as:
  "Feature Name | Category | GitHub issue # (optional)"

Example:
  "Human-In-The-Loop | Agent Control | 812"

Reply "none" to skip.
```

Wait for the user's response before proceeding.

### Phase 6: Rank — Ask for Priority Order

Present all new items to be added and ask the user to rank them by impact (highest impact listed first in the table):

```
Please rank these new items by user impact (1 = highest impact, listed first in the table):

Items for [Month]:
A. Search Threads (UX) — ✅ Shipped
B. Migrate Memories Seeder (Data) — ✅ Shipped
C. [other items...]

Items for [Upcoming Month]:
D. Human-In-The-Loop (Agent Control) — 🔵 Planned

Reply with the order, e.g. "A, C, B, D" or "keep as listed".
```

Wait for the user's response before proceeding.

### Phase 7: Month Roll — Check if Roll-Forward Is Needed

Determine whether the oldest visible month should move to archive and a new upcoming month should be added.

**Roll-forward triggers** (ask the user to confirm):
- The current date is past the 15th of the month that is labeled "current"
- The user explicitly requests it

If roll-forward is needed, present:

```
Month roll-forward needed:
- Archive: [Oldest Month] moves into the <details> archive block
- Shift:   [Previous Month] becomes the new "previous"
- Shift:   [Current Month] becomes the new "previous"
- Add:     [New Upcoming Month] added at top with 🔵 Planned items

Confirm roll-forward? (y/n)
```

If the user declines, skip the roll.

### Phase 8: Plan Mode — Present Proposed Changes for Approval

Enter plan mode and present the complete set of proposed changes before touching any file.

Use this exact format:

```
## Proposed Roadmap Changes

### Month Structure
[Current] → [No change / Roll-forward applied]

### Items to Add

#### [Month]
| Feature | Category | Status |
|---------|----------|--------|
| [Search Threads](https://github.com/ruska-ai/orchestra/issues/801) | UX | ✅ Shipped |
| [Migrate Memories Seeder](https://github.com/ruska-ai/orchestra/issues/787) | Data | ✅ Shipped |

#### [Upcoming Month]
| Feature | Category | Status |
|---------|----------|--------|
| Human-In-The-Loop | Agent Control | 🔵 Planned |

### Status Updates to Existing Items
- "[Item Name]": 🔵 Planned → 🟡 In Progress
- "[Item Name]": 🟡 In Progress → ✅ Shipped

### Archive Changes
[None / "January 2026 moves to archive block"]

Approve these changes? (y / request edits)
```

Wait for explicit approval before editing README.md.

### Phase 9: Implement — Apply Approved Changes

After the user approves the plan:

1. Read the full `README.md` to locate the `## 🗺️ Roadmap` section precisely.
2. Apply changes in this order:
   - If rolling forward: move the oldest month into the `<details>` archive block and add the new upcoming month at top.
   - Update status of existing items as approved.
   - Insert new items in the user's ranked order within the correct month table.
3. Preserve all surrounding README.md content exactly — only modify the roadmap section.
4. Report what was changed:

```
## Roadmap Updated

- Added N new items to [Month]
- Added N planned items to [Upcoming Month]
- Updated N status flips
- [Month rolled forward / No roll]

README.md saved. Review the roadmap section to confirm it looks correct.
```

---

## Scenario Guides

### Start of Month (New Planned Items)

Focus is Phase 5 (planned items for upcoming month) and Phase 8-9 (add them). Status flips are minimal. No roll needed yet.

### Mid-Month (Status Flips)

Focus is Phase 4 (flip planned → in progress, in progress → shipped for merges in this month). Phase 5 may add more planned items. No roll yet.

### End of Month / Start of Next Month (Roll Forward)

All three phases active. Phase 7 (roll-forward) is triggered. Oldest month archives. New upcoming month added. Current month's items should be mostly ✅ Shipped.

---

## Examples

### Example 1: Mid-Month Update

User: "update roadmap"

Assistant discovers 2 merged branches not yet on the roadmap. Presents them. User selects both. Assistant suggests names/categories. User approves with one correction ("Agents" not "Data"). Assistant confirms both go in current month as Shipped. User adds one planned item for next month. User ranks items. Plan presented. User approves. README.md updated.

### Example 2: Month Roll-Forward

User: "monthly roadmap — roll forward to March"

Assistant reads roadmap: January (previous), February (current), March (upcoming). Detects roll is needed: January should archive, March becomes current, April becomes upcoming. Asks for any new April planned items. Presents full plan including archive action. User approves. README.md updated with January moved to archive, April added.

### Example 3: Status Flip Only

User: "flip Docs Agent Guidance to shipped on the roadmap"

Assistant reads current roadmap, finds `[Docs Agent Guidance]` at `🟡 In Progress`. Skips Phases 2-6 (no new items). Presents plan: flip one item to ✅ Shipped. User approves. README.md updated.

---

## Important Notes

- **Never auto-edit README.md** without explicit user approval in Phase 8.
- **Always read README.md fresh** at the start — never rely on memory of its contents.
- **Issue links are required** for items derived from `feat/<issue#>-<slug>` branches. Items without a known issue number (manually added planned items) may omit the link.
- **Preserve table alignment** — use the same pipe-aligned markdown table format as existing rows.
- **One roadmap section only** — do not create a second roadmap section; update the existing one under `## 🗺️ Roadmap`.
- **Archive block content** — the `<details>` block text reads "See [Changelog.md](./Changelog.md) for the full release history." — keep it pointing to Changelog, do not list individual months inside it.
- **Category spelling** — use exact casing from the valid categories list.
