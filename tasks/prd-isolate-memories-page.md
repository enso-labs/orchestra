# PRD: Isolate Memories Page + Default Memory Seeding

## Introduction

The `MemorySettings` component currently lives inside the Settings page alongside model, API key, and sandbox settings. Memories is a distinct feature with its own CRUD pages (create, edit, list) and deserves its own top-level page and sidebar navigation entry. This separation improves navigation UX and reduces Settings page clutter.

Additionally, new users currently start with an empty memory store. We need to seed 6 default memories on registration and provide a manual seeder script for existing users. The seeder should intelligently add only missing default memories, preserving any existing user content.

## Goals

- Give Memories its own top-level page accessible from the sidebar
- Remove Memories from the Settings page to reduce clutter
- Update memory create/edit back-navigation to point to `/memories` instead of `/settings`
- Automatically seed 6 default memories for new users on registration (including OAuth)
- Provide a manual seeder script to backfill missing default memories for existing users
- Seeder checks each default memory individually and only adds missing ones

## User Stories

### US-001: Create Memories index page
**Description:** As a user, I want a dedicated Memories page so that I can manage my AI memories without navigating through Settings.

**Acceptance Criteria:**
- [ ] New page at `/memories` wraps existing `MemorySettings` component in `ChatLayout` with `ChatNav`
- [ ] Page displays heading "Memories" and subheading "Manage what the AI remembers about you."
- [ ] Full memory list with search, pagination, and CRUD actions visible
- [ ] Page is only accessible to authenticated users (wrapped in `PrivateRoute`)
- [ ] Typecheck/lint passes (`npm run build`)
- [ ] Verify in browser using agent-browser skill

### US-002: Add Memories link to sidebar navigation
**Description:** As a user, I want a "Memories" link in the sidebar so that I can quickly navigate to my memories from anywhere in the app.

**Acceptance Criteria:**
- [ ] Sidebar shows "Memories" link with `Brain` icon from lucide-react
- [ ] Link navigates to `/memories`
- [ ] Link is placed after the Assistants link, before the Projects group
- [ ] Link follows the same `SidebarGroup` pattern as the Assistants link
- [ ] Typecheck/lint passes
- [ ] Verify in browser using agent-browser skill

### US-003: Add `/memories` route to the router
**Description:** As a developer, I need the `/memories` route registered in `AppRoutes.tsx` so the page is accessible.

**Acceptance Criteria:**
- [ ] `MemoriesIndexPage` imported from `@/pages/memories`
- [ ] `<Route path="/memories">` added, wrapped in `<PrivateRoute>`
- [ ] Route placed alongside existing `/memories/create` and `/memories/:memoryId/edit` routes
- [ ] Typecheck/lint passes

### US-004: Update memory create/edit back-navigation
**Description:** As a user, I want the "back" button on memory create and edit pages to return me to `/memories` instead of `/settings`.

**Acceptance Criteria:**
- [ ] In `memories/create.tsx`: all `navigate("/settings")` calls changed to `navigate("/memories")`
- [ ] In `memories/edit.tsx`: all `navigate("/settings")` calls changed to `navigate("/memories")`
- [ ] After creating a memory, user is redirected to `/memories`
- [ ] After editing a memory, user is redirected to `/memories`
- [ ] After deleting a memory, user is redirected to `/memories`
- [ ] Typecheck/lint passes

### US-005: Remove MemorySettings from Settings page
**Description:** As a user, I expect the Settings page to only contain settings (model, API keys, sandbox) — not memories.

**Acceptance Criteria:**
- [ ] `MemorySettings` component and its import removed from `pages/settings/index.tsx`
- [ ] Settings page renders without errors
- [ ] No broken references to `MemorySettings` in the Settings page
- [ ] Typecheck/lint passes
- [ ] Verify in browser using agent-browser skill

### US-006: Define default memories content
**Description:** As a developer, I need a module containing the 6 default memory definitions so they can be used by both auto-seeding and the manual seeder.

**Acceptance Criteria:**
- [ ] New file `backend/src/constants/default_memories.py` created
- [ ] Contains a list of 6 dicts, each with `id` (filename) and `content` (markdown body)
- [ ] Default memories: `SOUL.md`, `IDENTITY.md`, `MEMORY.md`, `USER.md`, `TOOLS.md`, `AGENTS.md`
- [ ] Content sourced from admin user's current memories
- [ ] Typecheck/lint passes

### US-007: Create seed utility that adds missing defaults
**Description:** As a developer, I need a reusable utility function that seeds default memories for a user, adding only the ones they're missing.

**Acceptance Criteria:**
- [ ] New file `backend/src/utils/memory_seed.py` created
- [ ] `seed_default_memories(user_id, store)` function defined
- [ ] Function checks each of the 6 default memories individually
- [ ] Only creates memories that don't already exist for the user (by path/id)
- [ ] Users with all 6 defaults already present get nothing added
- [ ] Users with some defaults get only the missing ones added
- [ ] Typecheck/lint passes

### US-008: Auto-seed memories on user registration
**Description:** As a new user, I want to start with useful default memories so I don't begin with an empty memory store.

**Acceptance Criteria:**
- [ ] `register` endpoint in `backend/src/routes/v0/auth.py` calls `seed_default_memories` after user creation
- [ ] OAuth callback endpoint calls `seed_default_memories` after new OAuth user creation
- [ ] Store dependency (`get_store`) added to both endpoints
- [ ] Seeding failure does not block registration (error is logged, not raised)
- [ ] New user gets all 6 default memories after registration
- [ ] Backend tests pass (`make test`)

### US-009: Create manual memory seeder script
**Description:** As an admin, I want a script to backfill default memories for existing users so that all users benefit from the defaults.

**Acceptance Criteria:**
- [ ] New file `backend/seeds/memory_seeder.py` created
- [ ] Script follows `user_seeder.py` pattern (uses `AsyncPostgresStore` directly)
- [ ] Iterates over all existing users
- [ ] For each user, calls `seed_default_memories` (adds only missing defaults)
- [ ] Reports how many users were processed and how many memories were added
- [ ] Script is runnable standalone

### US-010: Add Makefile target for memory seeder
**Description:** As a developer, I want a `make seeds.memory` command so I can easily run the memory seeder.

**Acceptance Criteria:**
- [ ] `seeds.memory` target added to `backend/Makefile`
- [ ] Target runs `uv run python -m seeds.memory_seeder --env-file $(ENV_FILE)`
- [ ] Target placed after existing `seeds.user` target
- [ ] `make seeds.memory` executes without errors

## Functional Requirements

- FR-1: The system must serve a dedicated Memories page at `/memories` that displays the existing `MemorySettings` component within `ChatLayout`
- FR-2: The `/memories` route must require authentication (wrapped in `PrivateRoute`)
- FR-3: The sidebar must display a "Memories" link with a Brain icon, placed after Assistants and before Projects
- FR-4: The Settings page (`/settings`) must no longer display the `MemorySettings` component
- FR-5: Memory create and edit pages must navigate back to `/memories` instead of `/settings`
- FR-6: The system must define 6 default memories: `SOUL.md`, `IDENTITY.md`, `MEMORY.md`, `USER.md`, `TOOLS.md`, `AGENTS.md`
- FR-7: On user registration (both standard and OAuth), the system must automatically seed default memories
- FR-8: The seed utility must check each default memory by path/id and only create ones the user is missing
- FR-9: Seeding failures must not block user registration — errors are logged gracefully
- FR-10: A standalone seeder script must iterate all existing users and add any missing default memories
- FR-11: A `make seeds.memory` target must be available to run the seeder script

## Non-Goals

- No UI for managing which memories are "default" (admin panel)
- No ability for users to reset their memories to defaults
- No versioning or updating of default memory content after initial seeding
- No changes to the memory CRUD API or `MemoryRepo` interface
- No changes to how memories are used in AI conversations

## Design Considerations

- Reuse the existing `MemorySettings` component as-is — no modifications needed
- Follow the `ChatLayout` + `ChatNav` + `ScrollArea` pattern used by the Settings page
- Sidebar link should use the same `SidebarGroup` pattern as the Assistants link (line 862-875 in `app-sidebar.tsx`)
- Use the `Brain` icon from lucide-react for the Memories nav item

## Technical Considerations

- **Existing components reused:**
  - `MemorySettings`: `frontend/src/components/settings/MemorySettings.tsx`
  - `MemoryRepo.create()`: `backend/src/repos/memory_repo.py:17`
  - `get_store` dependency: `backend/src/services/db.py:79`
  - Seeder script pattern: `backend/seeds/user_seeder.py`
- **Seeder logic change from original plan:** Instead of skipping users with any memories, the seeder checks each default memory individually and adds only missing ones. This requires querying existing memory paths for each user.
- **Error handling:** Memory seeding in registration endpoints should be wrapped in try/except to prevent registration failures if seeding fails
- **Database:** No schema changes needed — uses existing memory storage via `MemoryRepo`

## Success Metrics

- Memories page is accessible in under 2 clicks from any page via sidebar
- Settings page no longer contains memory-related UI
- 100% of new users receive all 6 default memories on registration
- `make seeds.memory` successfully backfills missing defaults for all existing users
- No regression in existing memory CRUD functionality
- Frontend builds without errors (`npm run build`)
- Backend tests pass (`make test`)

## Open Questions

- What is the exact content for each of the 6 default memories? (Need to copy from admin user's current memories)
> I've left the `development` branch api running on port 8000. Fetch the contents the write to a file to re-use.
- Should the seeder script have a dry-run mode to preview what would be added?
> The applying missing defaults should be sufficient. You should dry run in testing before validation.
- Should there be a log/audit trail of which memories were auto-seeded vs user-created?
> Sound good to me.
