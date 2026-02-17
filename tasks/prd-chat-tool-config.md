# PRD: Better Tool Configuration UI for Super Agent Chat Session

## Introduction

The Super Agent chat page currently only offers basic tool toggles (web search, PII) via a simple dropdown menu. The full ToolSelectionModal with platform tools, custom API tools, MCP servers, and A2A agents exists on the Assistant Create/Edit pages but is not accessible from the chat. This feature integrates that modal into the chat page for session-scoped tool configuration.

## Goals

- Give chat users access to all tool types (platform, API, MCP, A2A) during a session
- Reuse existing ToolSelectionModal — no UI duplication
- Improve BaseToolMenu layout and discoverability

## User Stories

### US-001: Add Configure Tools option to BaseToolMenu
**Description:** As a user, I want a "Configure Tools" option in the chat menu that opens the full tool selection modal.

**Acceptance Criteria:**
- [ ] BaseToolMenu in `frontend/src/components/menus/BaseToolMenu.tsx` imports and renders ToolSelectionModal
- [ ] New "Configure Tools" menu item with Wrench icon added to the dropdown
- [ ] Clicking it opens ToolSelectionModal with current agent tools pre-selected
- [ ] Modal receives `initialSelectedTools`, `initialMcpConfig`, `initialA2aConfig` from AgentContext
- [ ] Typecheck passes

### US-002: Wire modal apply to update AgentContext
**Description:** As a user, I want my tool selections from the modal to apply to the current chat session immediately.

**Acceptance Criteria:**
- [ ] `onApply` callback updates `agent.tools` in AgentContext
- [ ] MCP and A2A config changes persist in AgentContext (already handled by modal internals)
- [ ] Subsequent chat messages include the updated tool list
- [ ] Typecheck passes

### US-003: Add active tools indicator
**Description:** As a user, I want to see how many tools are currently active so I know my configuration state.

**Acceptance Criteria:**
- [ ] Badge or count shown on the `+` button or in the dropdown header indicating active tool count
- [ ] Count updates when tools are added/removed via the modal
- [ ] Count excludes default tools OR shows total — consistent with UX expectations
- [ ] Typecheck passes

### US-004: Improve BaseToolMenu layout
**Description:** As a user, I want the tool menu organized into logical sections for quick toggles vs advanced configuration.

**Acceptance Criteria:**
- [ ] Menu has section headers: "Quick Toggles" (web search, PII) and "Advanced" (Configure Tools)
- [ ] Image upload remains at top
- [ ] Visual separation between sections (dividers or headers)
- [ ] Existing functionality preserved (web search toggle, PII toggles, image upload)
- [ ] Typecheck passes

### US-005: Verify chat submission includes all tool config
**Description:** As a developer, I need to verify that the chat payload includes tools, MCP, and A2A config from AgentContext.

**Acceptance Criteria:**
- [ ] Review `useChat.ts` handleSSEUnified to confirm agent context tools are sent
- [ ] If not already sent, add MCP and A2A config to the submission payload
- [ ] Stream works correctly with tools configured via the modal
- [ ] Typecheck passes

### US-006: Handle default tools conflict
**Description:** As a developer, I need to ensure the DEFAULT_AGENT_TOOLS useEffect in BaseToolMenu doesn't conflict with modal selections.

**Acceptance Criteria:**
- [ ] Default tools are only added on initial mount, not after modal changes
- [ ] If user removes a default tool via modal, it stays removed
- [ ] Re-opening the menu doesn't reset tools to defaults
- [ ] Typecheck passes

### US-007: End-to-end browser validation
**Description:** As a user, I want the full flow to work: open chat, configure tools, send a message that uses a configured tool.

**Acceptance Criteria:**
- [ ] Open chat page, click `+` menu, click "Configure Tools"
- [ ] Modal opens with correct pre-selected tools
- [ ] Toggle some tools, click Apply
- [ ] Tool count indicator updates
- [ ] Send a chat message — tools are available to the agent
- [ ] Verified using agent-browser CLI with screenshots

### US-008: Verify workspace is clean and push final changes
**Description:** As a developer, I want to ensure all changes are committed and pushed.

**Acceptance Criteria:**
- [ ] `git status` shows clean workspace (no uncommitted changes)
- [ ] If remaining changes exist, commit and push to branch
- [ ] All commits visible in GitHub PR
