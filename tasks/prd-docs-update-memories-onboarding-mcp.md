# PRD: Documentation Update — Memories, Getting Started, MCP

## Introduction

Update and consolidate Orchestra documentation. Merge the AGENTS.md tutorial into the memories docs (since AGENTS.md content is now stored as memories), rewrite the getting started page with a proper onboarding walkthrough, and update the MCP tools page with the current "Manage Tools" modal UI.

## Goals

- Consolidate AGENTS.md documentation into the memories section
- Provide a clear onboarding experience for new users
- Keep MCP documentation current with the latest UI

## User Stories

### US-001: Update memories tutorial with AGENTS.md content
**Description:** As a developer, I want the memories tutorial to include AGENTS.md workflow so users understand that AGENTS.md is stored as a memory.

**Acceptance Criteria:**
- [ ] Update `wiki/docs/memories/tutorial.md` to include steps for creating and storing AGENTS.md as a memory
- [ ] Update `wiki/docs/memories/index.md` to mention AGENTS.md integration in the overview
- [ ] Commit changes inside the wiki submodule
- [ ] Verify changes render correctly

### US-002: Update AGENTS.md docs to reference memories
**Description:** As a developer, I want the AGENTS.md section to reference the memories system so users are directed to the consolidated docs.

**Acceptance Criteria:**
- [ ] Update `wiki/docs/agents-md/index.md` to explain that AGENTS.md is now stored via the memories system
- [ ] Update `wiki/docs/agents-md/tutorial.md` to cross-reference the memories tutorial
- [ ] Update `wiki/sidebars.ts` to reorganize — move AGENTS.md tutorial under memories or add clear cross-references in "Core Features"
- [ ] Commit changes inside the wiki submodule

### US-003: Rewrite getting started page with onboarding flow
**Description:** As a user, I want the getting started page to walk me through the complete onboarding process.

**Acceptance Criteria:**
- [ ] Rewrite `wiki/docs/getting-started.md` with detailed onboarding steps: login, UI overview, configuring settings (model selection, API keys), creating first memory, adding AGENTS.md as a memory
- [ ] Include references to the memories tutorial and AGENTS.md docs
- [ ] Take screenshots of the onboarding flow using agent-browser skill
- [ ] Commit changes inside the wiki submodule

### US-004: Update MCP tools page with Manage Tools modal
**Description:** As a user, I want the MCP tools page to document the current "Manage Tools" modal.

**Acceptance Criteria:**
- [ ] Update `wiki/docs/tools/mcp.md` with current UI flow for the "Manage Tools" modal
- [ ] Document tool selection, MCP configuration, and enabling/disabling tools
- [ ] Take screenshots of the Manage Tools modal using agent-browser skill
- [ ] Replace outdated GIF/images with current screenshots
- [ ] Commit changes inside the wiki submodule

### US-005: Update orchestra submodule reference and push
**Description:** As a developer, I want all wiki changes committed and the submodule reference updated in orchestra.

**Acceptance Criteria:**
- [ ] All wiki submodule commits pushed to origin
- [ ] Update wiki submodule reference in orchestra repo (`git add wiki`)
- [ ] Run git status to verify no remaining changes
- [ ] If remaining changes exist, commit and push to branch
