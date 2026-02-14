# PRD: Skills CRUD (Issue #773)

## Metadata

```yml
pull_request_title: "FROM feat/773-skills-crud TO development"
branch: "feat/773-skills-crud"
worktree_path: "$WORKSPACE/.worktrees/feat-773"
```

## Introduction

Add full CRUD management for **skills** — reusable agent capabilities that bundle instructions and metadata into SKILL.md files. Users can create, list, toggle (enable/disable), edit, and delete skills through both API and UI using editor-based approaches. Enabled skills are automatically loaded into agent context at invocation time via the existing `create_deep_agent(skills=...)` parameter.

This builds on the native DeepAgents skills wiring (see `prd-native-deepagents-skills.md`) which threaded the `skills` parameter through the agent construction chain. This PRD adds the persistence layer (LangGraph Store), CRUD API, frontend management pages, and chat-level skill toggling.

**Reference documentation:** [DeepAgents Skills Spec](https://docs.langchain.com/oss/python/deepagents/skills)

**Design principles:** Simplicity is beauty, complexity is pain. Always look at the current codebase and question how to best achieve the goal in the least amount of changes, then apply a TDD approach.

## Goals

- Allow any user to create, read, update, toggle, and delete skills via REST API
- Persist skills as Pydantic models in LangGraph Store under `(user_id, "skills")` namespace
- Automatically materialize enabled skills into agent context at invocation time (streaming, invoke, and worker paths)
- Provide a frontend management UI at `/skills` with list, create, and edit pages
- Integrate skill toggling into the existing `+` button (BaseToolMenu) in the chat input
- Establish the pattern for server-persisted feature configuration (moving away from localStorage)
- Document the skills feature in the project wiki

## User Stories

### US-001: Create SavedSkill data model
**Description:** As a developer, I need a Pydantic model for skills so they can be validated, serialized, and stored consistently.

**Acceptance Criteria:**
- [ ] New file `backend/src/schemas/entities/skill.py` with `SavedSkill(BaseModel)`
- [ ] Fields: `name` (str), `description` (str, max 1024), `content` (str, SKILL.md body), `tags` (list[str]), `disabled` (bool, default False), `metadata` (dict), `allowed_tools` (list[str]), `license` (Optional[str]), `compatibility` (Optional[str]), `created_at` (datetime), `updated_at` (datetime)
- [ ] Name validation regex: `^[a-z0-9]+(-[a-z0-9]+)*$` (kebab-case)
- [ ] `to_skill_md()` method that reconstructs full SKILL.md content with YAML frontmatter from model fields
- [ ] Typecheck/lint passes (`make format`)

### US-002: Create SkillRepo for LangGraph Store persistence
**Description:** As a developer, I need a repository layer for skills that follows the existing `BaseRepo`/`MemoryRepo` pattern so skill data is persisted in LangGraph Store.

**Acceptance Criteria:**
- [ ] New file `backend/src/repos/skill_repo.py` with `SkillRepo(BaseRepo)`
- [ ] Constructor: `__init__(self, user_id: str, store: Optional[BaseStore] = None)` calling `super().__init__(user_id=user_id, store=store, entity_type="skills")`
- [ ] Methods: `create(skill: SavedSkill)`, `get(skill_name: str)`, `update(skill_name: str, ...)`, `delete(skill_name: str)`, `list(limit, offset, query)`
- [ ] Uses `(user_id, "skills")` namespace via BaseRepo
- [ ] Returns `SavedSkill` instances (no encryption needed, unlike ToolRepo)
- [ ] Typecheck/lint passes (`make format`)

### US-003: Create SkillService business logic layer
**Description:** As a developer, I need a service layer that wraps the repo and adds business logic like toggle and enabled-skill filtering.

**Acceptance Criteria:**
- [ ] New file `backend/src/services/skill.py` with `SkillService`
- [ ] Constructor: `__init__(self, user_id: str, store: BaseStore)` creating internal `SkillRepo`
- [ ] Methods: `create()`, `get()`, `update()`, `toggle()` (flips `disabled` field), `search()`, `search_enabled()` (filters `disabled=False`), `delete()`
- [ ] `toggle()` returns the updated skill with flipped disabled state
- [ ] `search_enabled()` returns only skills where `disabled=False`
- [ ] Typecheck/lint passes (`make format`)

### US-004: Wire SkillService into ServiceContext
**Description:** As a developer, I need SkillService available through ServiceContext so routes and controllers can access it.

**Acceptance Criteria:**
- [ ] Edit `backend/src/contexts/service.py`
- [ ] Add import: `from src.services.skill import SkillService`
- [ ] Add in `__init__()`: `self.skill_service = SkillService(user_id=self.user_id, store=store)`
- [ ] Typecheck/lint passes (`make format`)

### US-005: Create skill CRUD API routes
**Description:** As a user, I want REST API endpoints to manage my skills so I can create, read, update, toggle, and delete skills programmatically.

**Acceptance Criteria:**
- [ ] New file `backend/src/routes/v0/skill.py` with FastAPI router
- [ ] `POST /skills/search` — List/search skills (query, limit, offset params)
- [ ] `POST /skills` — Create a new skill (201 response)
- [ ] `GET /skills/{skill_name}` — Get a single skill by name
- [ ] `PUT /skills/{skill_name}` — Update an existing skill
- [ ] `PATCH /skills/{skill_name}/toggle` — Toggle the disabled flag
- [ ] `DELETE /skills/{skill_name}` — Delete a skill (204 response)
- [ ] All endpoints use `Depends(verify_credentials)` and `Depends(get_store)` with `ServiceContext`
- [ ] Router registered in `backend/src/routes/v0/__init__.py`
- [ ] Typecheck/lint passes (`make format`)

### US-006: Integrate skills into agent invocation
**Description:** As a user, I want my enabled skills to be automatically available to the agent when I chat, so the agent can discover and use relevant skills.

**Acceptance Criteria:**
- [ ] Add `prepare_skill_files()` function in `backend/src/agents/__init__.py`
- [ ] Function fetches enabled skills via `skill_svc.search_enabled()`
- [ ] Creates files map: `{"/skills/<name>/SKILL.md": create_file_data(skill.to_skill_md())}`
- [ ] Returns `(files_map, ["/skills/"])` or `({}, None)` when no enabled skills
- [ ] Skill files merged into agent context in `backend/src/controllers/llm.py` → `llm_invoke()` path
- [ ] Skill files merged into agent context in `backend/src/utils/stream.py` → `stream_generator()` path (called from `llm_stream()`)
- [ ] `skills` parameter passed to `construct_agent()` in both `llm_invoke` and `llm_stream` paths
- [ ] Agent works normally when no skills are enabled
- [ ] Typecheck/lint passes (`make format`)

### US-007: Write backend unit tests (TDD)
**Description:** As a developer, I need comprehensive unit tests for the skills backend so I can verify correctness before and during implementation.

**Acceptance Criteria:**
- [ ] New file `backend/tests/unit/repos/test_skill_repo.py` — Tests CRUD operations with InMemoryStore
- [ ] New file `backend/tests/unit/services/test_skill_service.py` — Tests service logic, toggle behavior, search_enabled filtering
- [ ] New file `backend/tests/unit/agents/test_prepare_skill_files.py` — Tests file generation, disabled skill exclusion, SKILL.md format output
- [ ] All tests pass (`make test`)
- [ ] Validate full flow end-to-end using `agent-browser` CLI

### US-008: Create frontend SkillService API client
**Description:** As a frontend developer, I need a TypeScript service class to communicate with the skills API endpoints.

**Acceptance Criteria:**
- [ ] New file `frontend/src/lib/services/skillService.ts`
- [ ] `Skill` type with fields: `name`, `description`, `content`, `tags`, `disabled`, `metadata`, `allowed_tools`, `license?`, `compatibility?`, `created_at?`, `updated_at?`
- [ ] `SkillService` class with static methods: `search()`, `create()`, `get()`, `update()`, `toggle()` (PATCH), `delete()`
- [ ] Follows existing service patterns (e.g., `memoryService.ts`)
- [ ] Typecheck passes

### US-009: Create useSkill hook and SkillContext provider
**Description:** As a frontend developer, I need React state management for skills that fetches from the backend (not localStorage) so skill state is consistent across the app.

**Acceptance Criteria:**
- [ ] New file `frontend/src/hooks/useSkill.ts` with `useSkill()` hook
- [ ] State: `skill`, `skills`, `isLoadingSkills`
- [ ] Methods: `handleGetSkills`, `handleToggleSkill`, `useEffectGetSkills`, `useEffectGetSkill`
- [ ] `handleToggleSkill(name)` calls `SkillService.toggle()` then refreshes from backend
- [ ] New file `frontend/src/context/SkillContext.tsx` with `SkillProvider` and `useSkillContext()`
- [ ] Follows existing context pattern (e.g., `AgentContext.tsx`)
- [ ] Typecheck passes

### US-010: Add Skills section to BaseToolMenu (+ button)
**Description:** As a user, I want to see and toggle my skills directly from the chat input's `+` button so I can quickly enable/disable skills without leaving the conversation.

**Acceptance Criteria:**
- [ ] Edit `frontend/src/components/menus/BaseToolMenu.tsx`
- [ ] Add `DropdownMenuSeparator` + "Skills" `DropdownMenuGroup` after existing menu items
- [ ] Each skill shown as `DropdownMenuItem` with name + `Switch` toggle
- [ ] Switch `onCheckedChange` calls `SkillService.toggle(name)` and refreshes state
- [ ] "Manage Skills" link item with `ChevronRight` icon navigating to `/skills`
- [ ] Add "Tools" `DropdownMenuGroup` with "Manage Tools" placeholder link
- [ ] Active skill count shown as badge on the `+` trigger button
- [ ] Typecheck passes
- [ ] Verify in browser using agent-browser skill

### US-011: Create Skills list page
**Description:** As a user, I want a `/skills` page that lists all my skills with search, toggle, and action controls so I can manage my skill library.

**Acceptance Criteria:**
- [ ] New file `frontend/src/pages/skills/index.tsx`
- [ ] Header with "Skills" title, subtitle, and "Create Skill" button
- [ ] Search/filter text input to filter by name/description, with skill count display
- [ ] Each skill row shows: name, description (truncated), tag badges, Switch toggle, Edit/Delete action buttons
- [ ] Toggle calls `SkillService.toggle()` and refreshes list from backend
- [ ] Delete shows confirmation before calling `SkillService.delete()`
- [ ] Wrapped in `ChatLayout` component (follows `pages/agents/index.tsx` pattern)
- [ ] Typecheck passes
- [ ] Verify in browser using agent-browser skill

### US-012: Create Skill editor page (create + edit)
**Description:** As a user, I want editor-based pages to create and edit skills with a markdown editor for SKILL.md content and a settings form for metadata.

**Acceptance Criteria:**
- [ ] New file `frontend/src/pages/skills/create.tsx` — Create page
- [ ] New file `frontend/src/pages/skills/edit.tsx` — Edit page (loads existing skill by `skillName` param)
- [ ] Two-tab layout: "Editor" tab (MonacoEditor in markdown mode for SKILL.md content) + "Settings" tab (form fields for name, description, tags, allowed_tools, license, disabled toggle)
- [ ] Zod validation, react-hook-form, shadcn FormField components
- [ ] Edit page pre-populates with existing skill data
- [ ] Edit page includes toggle and delete buttons in header
- [ ] Typecheck passes
- [ ] Verify in browser using agent-browser skill

### US-013: Add frontend routing and navigation
**Description:** As a user, I want to navigate to skill pages from the sidebar and via URL so skills are accessible throughout the app.

**Acceptance Criteria:**
- [ ] Edit `frontend/src/routes/AppRoutes.tsx` with 3 new routes:
  - `/skills` -> `SkillsIndexPage` (PrivateRoute)
  - `/skills/create` -> `SkillCreatePage` (PrivateRoute)
  - `/skills/:skillName/edit` -> `SkillEditPage` (PrivateRoute)
- [ ] Edit `frontend/src/components/drawers/app-sidebar.tsx` — Add "Skills" nav link with `Sparkles` icon after Assistants SidebarGroup
- [ ] Typecheck passes
- [ ] Verify in browser using agent-browser skill

### US-014: Create wiki documentation
**Description:** As a user or developer, I want documentation explaining what skills are, how to use the API, and how to manage skills in the UI.

**Acceptance Criteria:**
- [ ] New file `wiki/docs/skills/index.md`
- [ ] Sections: What are Skills, API curl examples for all CRUD operations, Using Skills with Agents, UI Guide, Best Practices
- [ ] Follows pattern from `wiki/docs/tools/tools.md`
- [ ] Edit `wiki/sidebars.ts` — Add `"skills/index"` to "Core Features" category
- [ ] Wiki builds successfully (`cd wiki && npm run build`)
- [ ] **IMPORTANT:** Wiki changes must be committed directly to the wiki repo (not the main Orchestra repo)

## Functional Requirements

- FR-1: The system must store skills as Pydantic models in LangGraph Store under `(user_id, "skills")` namespace
- FR-2: Skill names must match `^[a-z0-9]+(-[a-z0-9]+)*$` (kebab-case)
- FR-3: The system must provide REST endpoints for skill CRUD (create, read, update, toggle, delete, search)
- FR-4: All skill endpoints must require authentication via `verify_credentials`
- FR-5: The `toggle` endpoint must flip the `disabled` boolean and return the updated skill
- FR-6: The system must automatically load enabled skills into agent context at invocation time
- FR-7: Enabled skills must be materialized as `/skills/<name>/SKILL.md` files in the agent's virtual filesystem
- FR-8: The `skills` parameter (list of source paths) must be passed to `create_deep_agent()` for progressive disclosure
- FR-9: Skills must load in both streaming (`stream_generator`) and direct invoke (`llm_invoke`) paths
- FR-10: The frontend must fetch skill state from the backend (not localStorage)
- FR-11: The `+` button in chat input must display user's skills with inline toggle switches
- FR-12: The `/skills` management page must support search/filter, per-skill toggle, edit, and delete
- FR-13: Skill create/edit pages must provide a markdown editor for SKILL.md content
- FR-14: The sidebar must include a "Skills" navigation link

## Non-Goals

- No skill marketplace or sharing between users
- No automatic skill discovery from external sources
- No versioning or rollback of skill content
- No skill execution sandboxing beyond what DeepAgents provides
- No changes to the DeepAgents library or SKILL.md spec
- No skill import/export functionality
- No collaborative editing of skills
- No skill analytics or usage tracking
- No changes to SSE events, Redis streaming, or abort handling

## Design Considerations

- **BaseToolMenu extension:** The existing `+` dropdown (Image Upload, Web Search, PII toggles) gets two new sections separated by dividers: "Skills" (with inline toggles + "Manage Skills" link) and "Tools" (placeholder for future tool management)
- **Skills list page:** Inspired by OpenClaw's skills interface — card/row layout with search bar, category badges, and per-skill Switch toggles
- **Editor pages:** Two-tab layout ("Editor" + "Settings") using MonacoEditor for markdown and shadcn form components for metadata
- **Reuse existing components:** ChatLayout wrapper, shadcn Switch/DropdownMenu/Tabs/FormField, MonacoEditor, Sparkles icon from lucide-react

## Development Setup

Dependencies must be running before validation:
- **Redis:** `localhost:6379` (via Docker container)
- **Postgres:** `localhost:5432` (via Docker container)

Commands:
```bash
# Backend setup & run
cd backend && source .venv/bin/activate
make dev          # Start API
make dev.worker   # Start Worker (separate terminal)

# Frontend setup & run
cd frontend && npm i && npm run dev
```

## Technical Considerations

- **BaseRepo pattern:** SkillRepo extends `BaseRepo` (like `MemoryRepo`) with `entity_type="skills"`, providing `_set`, `_get`, `_delete`, `_search` helpers
- **MemoryService pattern:** SkillService follows `MemoryService` structure — constructor takes `(user_id, store)`, creates internal repo instance
- **Memory route pattern:** Skill routes follow `memory.py` route pattern — helper `_get_repo()` function, same auth/store dependency injection
- **ServiceContext wiring:** Two lines added to `service.py` — import + instance creation in `__init__()` (same pattern as existing services)
- **Agent integration:** `prepare_skill_files()` follows `prepare_memory_files()` pattern at `agents/__init__.py` lines 73-107
- **Agent entry points:** Skills must load in `llm_stream()` (via `stream_generator()` in `backend/src/utils/stream.py`) and `llm_invoke()` (in `backend/src/controllers/llm.py`) — both defined in `backend/src/routes/v0/llm.py`
- **File merge order:** Skill files are the base layer, request-level files override: `{**skill_files, **existing_files}`
- **Frontend service pattern:** Static class methods with axios calls, following `memoryService.ts` pattern
- **Frontend context pattern:** Provider + hook + context accessor, following `AgentContext.tsx` pattern

## Success Metrics

- All previous and new tests pass (`make test`) with no regressions
- All tests validated end-to-end using `agent-browser` CLI
- Skills CRUD operations work end-to-end via curl (create, get, update, toggle, delete, search)
- Enabled skills appear in agent context when chatting (verified via agent response referencing skill content)
- Skills toggle persists across page reloads (backend-persisted, not localStorage)
- Frontend management pages render correctly and all CRUD operations work from UI
- Skill toggling from chat `+` menu works without page navigation
- Design patterns achieve superior scores for maintainability and extensibility, ensuring improved future development cycles
- Wiki documentation builds and renders correctly

## Open Questions

- Should there be a maximum number of skills per user?
> No
- Should skill content size be limited (e.g., max 50KB per SKILL.md)?
> Yes
- Should we support bulk enable/disable of skills?
> Yes, would need to be well-thought out.
- Should the skill editor include a preview pane for rendered markdown?
> Yes, ideally default mode is preview to optimize readability. Edit more is rendered markdown mode.
- Should skills be scoped per-assistant or global per-user? (Current design: global per-user)
> Global per-user for now. We will perform changes for assistant scope in later PR.
