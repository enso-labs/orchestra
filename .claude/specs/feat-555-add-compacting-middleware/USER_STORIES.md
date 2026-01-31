# User Stories

## Issue #555: FEAT: Add Compacting Middleware

### Story 1: Automatic Context Compaction via Summarization
**As a** developer using DeepAgents for long-horizon tasks,
**I want** automatic context compaction when message history exceeds token limits,
**So that** my agent can continue operating without hitting context window limits.

**Acceptance Criteria:**
- [ ] SummarizationMiddleware is implemented and summarizes messages when context exceeds ~170k tokens
- [ ] Middleware is auto-applied by default in `create_deep_agent()`
- [ ] Summarized messages replace the originals with a summary AIMessage
- [ ] Agent continues functioning normally after compaction
- [ ] Typecheck passes

### Story 2: Custom Compacting Middleware Extension
**As a** developer building custom agents,
**I want** to extend or replace the default compacting middleware with custom logic,
**So that** I can control how and when context is compacted.

**Acceptance Criteria:**
- [ ] CompactingMiddleware base class is available for extension
- [ ] Custom middleware can be passed to `create_deep_agent(middleware=[...])`
- [ ] `on_messages_end` hook allows intercepting and modifying message lists
- [ ] Custom middleware integrates with existing LangGraph agent flow
- [ ] Typecheck passes

### Story 3: Configurable Compaction Thresholds
**As a** developer,
**I want** to configure the token threshold at which compaction triggers,
**So that** I can tune context management for different model context windows.

**Acceptance Criteria:**
- [ ] Token threshold is configurable (default ~170k)
- [ ] Number of recent messages to summarize is configurable
- [ ] Configuration can be passed via `create_deep_agent()` parameters
- [ ] Typecheck passes

## Notes
- DeepAgents is a LangGraph-based agent framework from LangChain
- The middleware pattern follows LangChain's `AgentMiddleware` base class
- Compaction should be transparent to the agent's operation
- Consider integration with existing Orchestra agent patterns
