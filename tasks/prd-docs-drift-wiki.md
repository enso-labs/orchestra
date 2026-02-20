# PRD: Documentation Drift Fix — Wiki Pages

## Introduction

Address documentation drift across the Orchestra wiki. Several pages are outdated relative to the current application UI, and key features (schedules, projects, chat page) lack documentation entirely. This PRD covers updating existing pages and creating new ones to bring the wiki in sync with the app.

## Goals

- Bring assistants and memories docs up to date with current UI/features
- Create missing documentation for schedules, projects, and chat page
- Ensure all core features are represented in the sidebar navigation
- Provide step-by-step walkthroughs users can follow

## User Stories

### US-001: Update Assistants Documentation
**Description:** As a user, I want a walkthrough on how to configure and deploy assistants so that I can effectively use the feature.

**Acceptance Criteria:**
- [ ] Assistants page includes step-by-step guide for creating an assistant from the UI
- [ ] Documents how to set instructions via AGENTS.md files
- [ ] Documents tool attachment and model selection
- [ ] Documents using assistants via API
- [ ] Typecheck passes (docusaurus build)

### US-002: Update Memories Documentation
**Description:** As a user, I want the memories page to have a clear walkthrough so that I understand how to use memories effectively.

**Acceptance Criteria:**
- [ ] Memories page includes UI walkthrough for CRUD operations
- [ ] Documents relationship between AGENTS.md and memories
- [ ] Cross-references agents-md tutorial
- [ ] Typecheck passes (docusaurus build)

### US-003: Create Schedules Documentation
**Description:** As a user, I want documentation for the schedules/crons feature so that I can set up automated tasks.

**Acceptance Criteria:**
- [ ] New file `wiki/docs/schedules/index.md` created
- [ ] Documents creating, editing, and deleting schedules
- [ ] Documents viewing execution history
- [ ] Documents cron expression format
- [ ] Page added to Core Features in sidebars.ts
- [ ] Typecheck passes (docusaurus build)

### US-004: Create Projects Documentation
**Description:** As a user, I want documentation for the projects feature so that I can organize my work.

**Acceptance Criteria:**
- [ ] New file `wiki/docs/projects/index.md` created
- [ ] Documents creating and managing projects
- [ ] Documents associating threads with projects
- [ ] Documents project-scoped conversations from chat
- [ ] Page added to Core Features in sidebars.ts
- [ ] Typecheck passes (docusaurus build)

### US-005: Create Chat Page Documentation
**Description:** As a user, I want documentation for the main chat page so that I understand all available controls.

**Acceptance Criteria:**
- [ ] New file `wiki/docs/chat/index.md` created
- [ ] Documents ChatInput buttons left to right: Tools menu (+), File manager, Agent menu
- [ ] Documents right side controls: Model badge, Submit button
- [ ] Documents dictation mode (voice recording)
- [ ] Documents image paste/drop and keyboard shortcuts
- [ ] Documents queue panel
- [ ] Page added to Core Features in sidebars.ts
- [ ] Typecheck passes (docusaurus build)

### US-006: Update Sidebar Navigation
**Description:** As a user, I want all core features visible in the documentation sidebar.

**Acceptance Criteria:**
- [ ] sidebars.ts updated to include schedules, projects, and chat pages in Core Features
- [ ] Sidebar order is logical (chat, assistants, threads, projects, schedules, storage, memories, agents-md)
- [ ] Typecheck passes (docusaurus build)

## Functional Requirements

- FR-1: Update `wiki/docs/assistants/index.md` with configuration and deployment walkthrough
- FR-2: Update `wiki/docs/memories/index.md` with UI walkthrough and AGENTS.md relationship
- FR-3: Create `wiki/docs/schedules/index.md` documenting the schedules feature
- FR-4: Create `wiki/docs/projects/index.md` documenting the projects feature
- FR-5: Create `wiki/docs/chat/index.md` documenting the main chat page
- FR-6: Update `wiki/sidebars.ts` to include new pages in Core Features

## Non-Goals

- No changes to application code
- No new features — documentation only
- No screenshots (can be added in a follow-up)
- No tutorial pages (only core feature reference pages)

## Technical Considerations

- Wiki is a Docusaurus site in `wiki/` submodule
- All docs use markdown with frontmatter (title, slug, sidebar_position)
- New directories need an `index.md` file
- Build verification: `cd wiki && npm run build`

## Success Metrics

- All core features have corresponding documentation pages
- Users can follow walkthroughs to configure each feature
- Docusaurus builds without errors

## Open Questions

- Should memories be consolidated with agents-md into a single section? (Decision: keep separate, cross-reference)
