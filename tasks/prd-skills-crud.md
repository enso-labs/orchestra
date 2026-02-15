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

---

## Iteration 2: Skills Auto-Sync & Progressive Disclosure

Iteration 1 (US-001 through US-019) delivered the full Skills CRUD feature: backend model/repo/service/routes, frontend pages/hooks/context, agent invocation integration, tests, and wiki docs.

However, iteration 1 only supports skills created via the `/skills` UI pages. The **super agent** (DeepAgent) can write files to `/skills/<name>/SKILL.md` during a chat session using `write_file`/`edit_file` tools, but those files live only in ephemeral `StateBackend` memory and don't persist to LangGraph Store across sessions.

This iteration adds:
1. **Auto-sync**: Agent-created skills auto-persist to LangGraph Store at session end
2. **Skills parameter separation**: Use `create_deep_agent(skills=...)` for progressive disclosure via `SkillsMiddleware` instead of lumping skills into `memory=`
3. **UI cleanup**: Remove broken "Manage Tools" link and redundant sidebar nav

### US-020: Auto-sync agent-created skills to LangGraph Store
**Description:** As a developer, I need agent-created skill files to automatically persist to LangGraph Store when a session ends, so skills created during chat are available in future sessions.

**Acceptance Criteria:**
- [ ] Add `sync_skill_files_to_store()` async function in `backend/src/agents/__init__.py`
- [ ] Function scans `files_map` for paths matching `/skills/<name>/SKILL.md` pattern
- [ ] Parses YAML frontmatter via `split_front_matter()`, creates/updates skills via `SkillService`
- [ ] Wired into `stream_generator()` finally block in `backend/src/utils/stream.py`
- [ ] Wired into `llm_invoke()` finally block in `backend/src/controllers/llm.py`
- [ ] Returns count of synced skills, logged when > 0
- [ ] Typecheck/lint passes (`make format`)

### US-021: Separate skills parameter from memory parameter
**Description:** As a developer, I need the `skills` parameter separated from `memory` in the agent construction chain so DeepAgent uses `SkillsMiddleware` for progressive disclosure instead of loading skills as flat memory.

**Acceptance Criteria:**
- [ ] Add `skills: list[str] | None = None` parameter to `init_graph()`, `construct_agent()`, `Orchestra.__init__()`
- [ ] Thread `skills=skills` through the chain: `Orchestra.__init__` -> `init_graph()` -> `create_deep_agent()`
- [ ] In `llm_invoke()`: pass `memory=memory_sources, skills=skill_sources` (not combined)
- [ ] In `stream_generator()`: same separation of memory and skills parameters
- [ ] Typecheck/lint passes (`make format`)

### US-022: Remove "Manage Tools" link from BaseToolMenu
**Description:** As a user, I should not see a broken "Manage Tools" link in the + menu since the `/tools` route does not exist.

**Acceptance Criteria:**
- [ ] Delete the entire "Tools Section" block from `frontend/src/components/menus/BaseToolMenu.tsx`
- [ ] Remove the `Wrench` import from lucide-react if no longer used elsewhere
- [ ] Typecheck passes (`npx tsc --noEmit`)

### US-023: Remove Skills sidebar nav link
**Description:** As a user, I should access skills only through the BaseToolMenu's "Manage Skills" link, not a redundant sidebar entry.

**Acceptance Criteria:**
- [ ] Delete the Skills `SidebarGroup` block from `frontend/src/components/drawers/app-sidebar.tsx`
- [ ] Remove the `Sparkles` import from lucide-react if no longer used elsewhere
- [ ] The `/skills` routes remain accessible via BaseToolMenu's "Manage Skills" link
- [ ] Typecheck passes (`npx tsc --noEmit`)

### US-024: Unit tests for sync_skill_files_to_store
**Description:** As a developer, I need comprehensive unit tests for the auto-sync function to verify correctness of skill file detection, parsing, and persistence.

**Acceptance Criteria:**
- [ ] New file `backend/tests/unit/agents/test_sync_skill_files.py`
- [ ] Test: empty files_map returns 0 synced
- [ ] Test: files not matching `/skills/<name>/SKILL.md` pattern are ignored
- [ ] Test: valid SKILL.md with frontmatter creates new skill via SkillService
- [ ] Test: existing skill is updated (not duplicated)
- [ ] Test: invalid YAML frontmatter is skipped with warning
- [ ] Test: empty content files are skipped
- [ ] Test: multiple skills in files_map are all synced
- [ ] Test: skill name extracted correctly from path
- [ ] Uses `InMemoryStore` + real `SkillService` (same pattern as `test_prepare_skill_files.py`)
- [ ] All tests pass (`make test`)

### US-025: E2E validation with agent-browser
**Description:** As a developer, I need to validate the full auto-sync flow end-to-end using the agent-browser skill.

**Acceptance Criteria:**
- [ ] Create a skill via chat: tell agent to "create a skill called test-auto-sync at /skills/test-auto-sync/SKILL.md"
- [ ] Verify agent writes the file (check agent response)
- [ ] After session ends, verify skill appears in `/skills` list page
- [ ] Start a new chat session, verify the skill is loaded (agent can reference it)
- [ ] Delete the test skill via UI
- [ ] Regression: existing skill CRUD (create/edit/toggle/delete via UI) still works

---

## Iteration 3: Auto-Sync Fix & AI-Powered Skill Generation

Iteration 2 (US-020 through US-025) added auto-sync of agent-created skills, skills parameter separation, UI cleanup, and unit tests.

However, a bug was discovered: agent-generated skills don't appear on the `/skills` page after a chat session ends. Additionally, a feature request was raised for "Generate with AI" — using a skill-builder-agent pattern to generate best-practice SKILL.md templates from the create page.

**PR comment:** [#774 (comment)](https://github.com/ruska-ai/orchestra/pull/774#issuecomment-3903208976)

This iteration adds:
1. **Bug fix**: Auto-sync uses final agent state instead of incomplete streaming-accumulated files
2. **Feature**: AI-powered skill template generation from the create page

### US-026: Fix auto-sync to use final agent state in stream path
**Description:** As a developer, I need the auto-sync function in `stream_generator()` to use the authoritative final agent state instead of the streaming-accumulated `files_map`, which may be incomplete if the agent writes a skill file in its last tool call.

**Acceptance Criteria:**
- [ ] In `stream_generator()` finally block in `backend/src/utils/stream.py`: use `final_state.values.get("files", {})` for sync instead of accumulated `files_map`
- [ ] Guard with check that `final_state` is available; fall back to `files_map` if not
- [ ] Add debug log showing file count difference between accumulated and final state
- [ ] `llm_invoke()` path already correct — no changes needed
- [ ] Typecheck/lint passes (`make format`)

### US-027: Unit test for stream sync using final_state files
**Description:** As a developer, I need unit tests that verify the auto-sync function correctly prefers final agent state files over accumulated streaming files.

**Acceptance Criteria:**
- [ ] Add tests to `backend/tests/unit/agents/test_sync_skill_files.py`
- [ ] Test: accumulated `files_map` empty but `final_state` files contain SKILL.md — sync persists the skill
- [ ] Test: `files_map` has stale content, `final_state` has correct version — sync uses final state version
- [ ] Test: `final_state` unavailable — sync falls back to `files_map`
- [ ] All tests pass (`make test`)

### US-028: E2E validation of auto-sync fix
**Description:** As a developer, I need to validate that the auto-sync bug fix works end-to-end using the agent-browser skill.

**Acceptance Criteria:**
- [ ] Tell agent to create skill at `/skills/test-sync-fix/SKILL.md`
- [ ] Verify skill appears on `/skills` page after session ends
- [ ] Verify skill loads in next chat session
- [ ] Regression: manual CRUD still works

### US-029: Create skill template generation service
**Description:** As a developer, I need a backend service that uses an LLM to generate best-practice SKILL.md templates based on a name, description, and tags, following the skill-builder-agent pattern.

**Acceptance Criteria:**
- [ ] New file `backend/src/services/skill_generator.py` with `SkillGeneratorService`
- [ ] Uses `init_chat_model()` with `DEFAULT_CHAT_MODEL_BASIC`
- [ ] System prompt embeds skill-builder-agent best practices (SKILL.md structure, conciseness <5000 words, imperative form, progressive disclosure, realistic examples)
- [ ] Method: `async generate(name, description, tags) -> dict` returning `{content, description, tags}`
- [ ] Follow pattern from `backend/src/services/prompt/optimize.py`
- [ ] Typecheck/lint passes (`make format`)

### US-030: Create skill generation API endpoint
**Description:** As a user, I want an API endpoint that generates a SKILL.md template using AI so I can get a high-quality starting point for new skills.

**Acceptance Criteria:**
- [ ] New schemas: `SkillGenerateRequest`, `SkillGenerateResponse` in `backend/src/schemas/entities/skill.py`
- [ ] New endpoint: `POST /skills/generate` in `backend/src/routes/v0/skill.py`
- [ ] Route declared BEFORE `/{skill_name}` catch-all to avoid path conflicts
- [ ] Endpoint does NOT persist — returns generated content for user review
- [ ] Endpoint uses `Depends(verify_credentials)` and `Depends(get_store)`
- [ ] Typecheck/lint passes (`make format`)

### US-031: Add "Generate with AI" button to skill create page
**Description:** As a user, I want a "Generate with AI" button on the skill create page so I can get a high-quality SKILL.md template generated from my name and description.

**Acceptance Criteria:**
- [ ] Add `generate()` static method to `frontend/src/lib/services/skillService.ts`
- [ ] Add button with `Sparkles` icon in create page header (secondary variant)
- [ ] Button enabled only when name + description fields are filled in
- [ ] On click: calls `SkillService.generate()`, populates content field, auto-fills tags if empty
- [ ] Loading spinner shown during generation, error toast on failure
- [ ] Confirmation dialog if editor already has content (to prevent accidental overwrite)
- [ ] Typecheck passes

### US-032: Unit tests for SkillGeneratorService
**Description:** As a developer, I need unit tests for the skill generator service to verify correct SKILL.md generation with proper structure and content.

**Acceptance Criteria:**
- [ ] New file `backend/tests/unit/services/test_skill_generator.py`
- [ ] Mock LLM via `unittest.mock.patch` on `init_chat_model`
- [ ] Test: generated content includes YAML frontmatter with skill metadata
- [ ] Test: generated content includes expected sections
- [ ] Test: skill name is included in output
- [ ] Test: tags are passed through to output
- [ ] Test: content respects word count limit (<5000 words)
- [ ] All tests pass (`make test`)

### US-033: E2E validation of AI-powered skill generation
**Description:** As a developer, I need to validate the full AI-powered skill generation flow end-to-end using the agent-browser skill.

**Acceptance Criteria:**
- [ ] Navigate to `/skills/create` page
- [ ] Enter skill name and description
- [ ] Click "Generate with AI" button
- [ ] Verify generated content appears in the editor
- [ ] Save the skill and verify it appears on `/skills` list page
- [ ] Regression: manual skill creation still works without using generate
