# PRD: Search Threads Agent Tool

## Introduction

Create a LangChain agent tool that gives agents the ability to search past conversation threads — the same functionality available in the UI's "Search Threads" feature. When selected as a tool, agents can query historical conversation context to inform their responses.

## User Stories

### US-001: Create search_threads tool function
**Description:** As a developer, I need a LangChain tool that performs semantic search over past threads.

**Acceptance Criteria:**
- [ ] Create `backend/src/tools/thread_search.py` with a `@tool` decorated `search_threads` function
- [ ] Tool accepts `query` (str) and optional `limit` (int, default 5) parameters
- [ ] Tool uses `RunnableConfig` to get `user_id` from config
- [ ] Tool calls `thread_snapshot_repo.search()` (same as the `/threads/search/semantic` endpoint)
- [ ] Tool returns formatted results: thread_id, title, excerpt, score
- [ ] Export as `THREAD_SEARCH_TOOLS` list
- [ ] Typecheck passes

### US-002: Register tool in platform tools system
**Description:** As a developer, I need the search_threads tool registered so it appears in the platform tools list.

**Acceptance Criteria:**
- [ ] Add `THREAD_SEARCH_TOOLS` import to `backend/src/utils/tools.py`
- [ ] Add matching condition in `resolve_tool()` function for the new tool
- [ ] Tool appears in the `/tools` list endpoint response
- [ ] Tool name is `search_threads` matching the pattern of existing tools
- [ ] Typecheck passes

### US-003: Wire tool to use ServiceContext for DB access
**Description:** As a developer, I need the tool to access the database through the proper service layer.

**Acceptance Criteria:**
- [ ] Tool receives store/checkpointer via `RunnableConfig` metadata or context
- [ ] Uses `ServiceContext` pattern consistent with other tools (see memory.py, retrieval.py)
- [ ] Handles errors gracefully (returns error message string, doesn't crash the agent)
- [ ] Works with the existing tool injection pipeline in `construct_agent()`
- [ ] Typecheck passes

### US-004: Add tool to frontend platform tools display
**Description:** As a user, I want to see and select the search_threads tool in the ToolSelectionModal.

**Acceptance Criteria:**
- [ ] Tool appears in the PlatformToolsPanel when fetching tools
- [ ] Tool has appropriate name, description, and tags for discoverability
- [ ] Tool can be toggled on/off like other platform tools
- [ ] Selected tool is sent to backend with chat submissions
- [ ] Typecheck passes

### US-005: Verify workspace is clean and push final changes
**Description:** As a developer, I want to ensure all changes are committed and pushed.

**Acceptance Criteria:**
- [ ] Run git status to check for uncommitted changes
- [ ] If remaining changes exist, commit and push to branch
- [ ] All commits visible in GitHub PR
