# PRD: Wiki Documentation for Memories Feature

## Introduction

Document the Memories feature in the Orchestra wiki (`docs.ruska.ai`). The Memories system allows users to store persistent personal context that agents automatically recall during conversations, enabling personalized responses without repeating information. This was implemented in PR #739 and needs user-facing documentation covering both the REST API (with curl examples) and a step-by-step UI tutorial with screenshots captured via `agent-browser`.

## Goals

- Create a main "Memories" documentation page explaining how memories work, with API/curl examples
- Create a separate tutorial page walking users through configuring memories via the Settings UI and verifying them in chat
- Capture full-workflow screenshots using `agent-browser` (light mode) against the local dev environment
- Link the tutorial from the main Memories page so users can easily find the visual walkthrough

## User Stories

### US-001: Add Memories page to wiki sidebar
**Description:** As a documentation reader, I want to find "Memories" in the wiki navigation so I can learn about the feature.

**Acceptance Criteria:**
- [ ] Add `memories/index` to the "Core Features" category in `wiki/sidebars.ts`
- [ ] Add `memories/tutorial` to the "Tutorials" category in `wiki/sidebars.ts`
- [ ] Navigation renders correctly in Docusaurus

### US-002: Write main Memories documentation page
**Description:** As a developer or API consumer, I want a reference page explaining how memories work and how to interact with them via the API so I can integrate memories into my workflow.

**Acceptance Criteria:**
- [ ] Create `wiki/docs/memories/index.md`
- [ ] Include an "Overview" section explaining what memories are and how they work (stored per-user, automatically injected into agent context as `/AGENTS.md`, namespaced by user ID)
- [ ] Include a "How It Works" section describing: memory storage via LangGraph BaseStore, automatic injection via `prepare_memory_files()` into streaming/worker/invoke entry points, markdown formatting of memories
- [ ] Include "API Reference" section with curl examples for all 5 endpoints:
  - `GET /api/memories` (list with pagination and search query)
  - `GET /api/memories/{memory_id}` (get single memory)
  - `POST /api/memories` (create with content and optional metadata)
  - `PUT /api/memories/{memory_id}` (update content)
  - `DELETE /api/memories/{memory_id}` (delete)
- [ ] Each curl example includes request and example response JSON
- [ ] Include authentication header (`Authorization: Bearer <token>`) in curl examples
- [ ] Include a "Configuration via UI" section at the bottom that links to the tutorial page
- [ ] Page uses Docusaurus frontmatter with appropriate title and sidebar_label

### US-003: Capture full workflow screenshots with agent-browser
**Description:** As a documentation author, I need screenshots of the memories workflow to include in the tutorial page.

**Acceptance Criteria:**
- [ ] Use `agent-browser` skill to navigate to local dev environment (localhost)
- [ ] Set browser to light mode
- [ ] Capture screenshot: Settings page showing the Memories section (empty state)
- [ ] Capture screenshot: "Add Memory" dialog with example content filled in
- [ ] Capture screenshot: Settings page showing a created memory in the list
- [ ] Capture screenshot: Chat page with a message that demonstrates the agent recalling a memory
- [ ] Save all screenshots to `wiki/static/img/memories/` directory
- [ ] Use descriptive filenames (e.g., `settings-memories-empty.png`, `settings-add-memory-dialog.png`, `settings-memories-list.png`, `chat-memory-recall.png`)

### US-004: Write Memories tutorial page (UI walkthrough)
**Description:** As a user, I want a step-by-step visual tutorial showing me how to add memories through the Settings page and see them working in chat.

**Acceptance Criteria:**
- [ ] Create `wiki/docs/memories/tutorial.md`
- [ ] Include Docusaurus frontmatter with title "Tutorial: Configuring Memories" and sidebar_label "Tutorial"
- [ ] Step 1: Navigate to Settings - describe how to reach the Settings page, include screenshot
- [ ] Step 2: Add a Memory - describe clicking "Add Memory", entering content, saving; include screenshot of dialog
- [ ] Step 3: Verify Memory Created - show the memories list with the new entry; include screenshot
- [ ] Step 4: Test in Chat - describe navigating to chat, sending a message that triggers memory recall, showing personalized response; include screenshot
- [ ] Step 5: Managing Memories - brief section on editing and deleting memories via the Settings UI
- [ ] Each step references the corresponding screenshot from `wiki/static/img/memories/`
- [ ] Include a link back to the main Memories page for API reference

### US-005: Update llm.txt with memories documentation
**Description:** As an external AI agent or search engine, I need the public `llm.txt` to reflect the current memories feature so that LLM search engines provide accurate information about Orchestra's capabilities.

**Acceptance Criteria:**
- [ ] Read `website/public/llm.txt` to understand current structure
- [ ] Add a "Memories" section describing: what memories are, that they persist per-user, how they are automatically injected into agent context, the API endpoints available, and that configuration is available via the Settings UI
- [ ] Keep the addition concise and consistent with existing llm.txt style

## Functional Requirements

- FR-1: The main Memories page (`memories/index.md`) must explain the memory lifecycle: create -> store -> automatic retrieval -> injection into agent context
- FR-2: All curl examples must use `localhost` base URL since documentation targets local dev environment
- FR-3: The curl examples must show the correct request/response schemas matching the backend implementation (`Memory`, `MemoryCreate`, `MemoryUpdate`, `MemoryListResponse`)
- FR-4: Screenshots must be captured in light mode using the `agent-browser` skill
- FR-5: The tutorial must follow a sequential workflow: Settings -> Add Memory -> Verify -> Chat -> Manage
- FR-6: Both new pages must be accessible from the wiki sidebar navigation
- FR-7: The `llm.txt` file must be updated to reflect the memories feature

## Non-Goals

- No documentation of internal implementation details (middleware stack, DeepAgents internals)
- No documentation of the `add_memories_to_system()` legacy function
- No video tutorials or animated GIFs
- No documentation of memory metadata schema beyond mentioning it's optional
- No changes to the backend or frontend code

## Design Considerations

- Follow existing wiki page structure (see `assistants/index.md`, `storage/index.md` for patterns)
- Use Docusaurus admonitions (:::tip, :::info, :::warning) where appropriate
- Screenshots should be saved at reasonable resolution for readability
- Use consistent image sizing via markdown or Docusaurus image components

## Technical Considerations

- Wiki is a git submodule — changes need to be committed in the submodule
- Docusaurus uses MDX — standard markdown with optional JSX support
- Screenshots go in `wiki/static/img/memories/` and are referenced as `/img/memories/filename.png`
- The `agent-browser` skill handles browser automation for screenshots
- Local dev environment must be running for screenshot capture (`make dev` for backend, `npm run dev` for frontend)

## Success Metrics

- Users can find and understand the Memories feature from the wiki navigation
- API consumers can copy curl examples and successfully interact with the memories API
- New users can follow the tutorial to configure their first memory in under 5 minutes
- The `llm.txt` accurately describes the memories capability

## Open Questions

- Should we include a "Troubleshooting" section for common memory issues?
- Should the API examples include pagination examples or just basic CRUD?
