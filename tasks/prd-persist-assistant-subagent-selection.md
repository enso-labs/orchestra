# PRD: Persist Assistant Settings + Per-Session Subagent Selection

## Introduction

Add two features to the chat page: (1) ability to save current chat settings (model, tools, system prompt, MCP, A2A, subagents) as a new named assistant, and (2) per-session subagent selection similar to how tools are currently toggled.

## Goals

- Allow users to persist their current chat configuration as a reusable assistant
- Enable per-session subagent selection from the chat page
- Follow existing patterns (tool selection UX, agent service API)

## User Stories

### US-001: Save as Assistant dialog component
**Description:** As a user, I want a dialog that prompts me for a name and description when saving current settings as an assistant.

**Acceptance Criteria:**
- [ ] Create `frontend/src/components/dialogs/SaveAsAssistantDialog.tsx` with name (required) and description inputs
- [ ] Dialog has Save and Cancel buttons
- [ ] Name field validates non-empty
- [ ] Dialog accepts an `onSave` callback with name and description
- [ ] Typecheck passes

### US-002: Wire Save as Assistant to chat page
**Description:** As a user, from the chat page I want to persist the current state of settings as an assistant.

**Acceptance Criteria:**
- [ ] Add "Save as Assistant" action accessible from the chat page (e.g., in ChatNav or agent-section)
- [ ] On click, open SaveAsAssistantDialog
- [ ] On save, collect current agent state (model, tools, system_prompt/prompt, mcp, a2a, subagents, files) and POST to /assistants via AgentService
- [ ] On success, show toast notification and refresh agent list
- [ ] On error, show error toast
- [ ] Typecheck passes
- [ ] Verify in browser using agent-browser skill

### US-003: Subagent selection modal component
**Description:** As a user, I want a modal to select which subagents to use in my current session.

**Acceptance Criteria:**
- [ ] Create subagent selection UI (new modal or new tab in ToolSelectionModal)
- [ ] Display available agents from the agents list with name, description, and model
- [ ] Each agent has a toggle to add/remove as a subagent for the current session
- [ ] Show currently selected subagents with visual indicator
- [ ] Typecheck passes

### US-004: Wire subagent selection to chat page
**Description:** As a user, I want to select subagents from the chat page and have them included in my LLM requests.

**Acceptance Criteria:**
- [ ] Add subagent selection trigger in BaseToolMenu or adjacent to it
- [ ] Wire selection to existing useAgent toggleSubagent/addAgentToSubagents/removeAgentFromSubagents
- [ ] Verify selected subagents are included in the LLM request payload (useChat sends agent.subagents)
- [ ] Typecheck passes
- [ ] Verify in browser using agent-browser skill

### US-005: Update issue description with integration details
**Description:** As a developer, I want the GitHub issue #803 description updated with the key integration points, storage, and architectural decisions discovered during implementation.

**Acceptance Criteria:**
- [ ] Update issue #803 body with: Key Integration Points table, UI Integration Points table, Storage section, Architectural Decisions
- [ ] Include file paths and function names for all changed files

### US-006: Check docs for drift and update wiki
**Description:** As a developer, I want to check the wiki docs for any drift or additions needed based on these features.

**Acceptance Criteria:**
- [ ] Review wiki/docs/assistants/index.md for coverage of "Save as Assistant" feature
- [ ] Review wiki/docs/ for any subagent documentation that needs updating
- [ ] If docs changes needed, update the relevant markdown files in wiki/
- [ ] Commit any wiki changes

### US-007: Final verification and push
**Description:** As a developer, I want all changes committed and verified.

**Acceptance Criteria:**
- [ ] Run git status to verify no remaining changes in the workspace
- [ ] If remaining changes exist, commit and push to branch so they will be visible in the GitHub PR
- [ ] Provide a final report assessing: remaining steps that should have been in scope, improvements extracted, scored and ranked by probability of being outlined in future iterations
