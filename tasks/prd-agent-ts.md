# PRD: @ruska/agent-ts — 12 Factor Agent Library

## Introduction

Create a publishable npm package (`@ruska/agent-ts`) that implements the 12 Factor Agent methodology as a reusable TypeScript library. The library owns the agent loop locally — controlling prompts, context window, tool execution, error handling, and observability — while delegating LLM inference to the Ruska backend via `POST /api/llm/stream`.

This is a **library-first** package. There is no interactive readline entry point. Consumers (CLI, frontend, other services) import the agent core, tools, and middleware to build their own experiences on top.

### Problem

The current Orchestra CLI (`@ruska/cli`) delegates the entire agent loop to the Python backend. This couples the client to the server's tool execution, prompt management, and error handling. There is no way for JS/TS consumers to own their agent loop, add local-only tools, or customize middleware without modifying the backend.

### Solution

A zero-dependency-on-LangChain TypeScript library that:
- Runs the agent loop locally with full control over prompts, context, and iteration
- Uses the Ruska backend purely as an LLM inference endpoint (SSE streaming)
- Executes local tools (file_writer, human_contact, note_taker) client-side
- Delegates server tools (web_search) to the backend
- Enforces structured output via Zod schema validation
- Provides middleware hooks for observability, error handling, context management, and dynamic prompts

## Goals

- Provide a reusable, importable agent loop for any JS/TS consumer
- Implement all 12 Factor Agent principles with clear mapping
- Enforce structured output (`ResearchResult`) via strict Zod validation
- Use hybrid tool strategy: server tools on backend, local tools client-side
- Ship with full test coverage using TDD approach
- Publish to npm as `@ruska/agent-ts` with granular exports (agent, tools, middleware)

## User Stories

### US-001: Project scaffolding and build pipeline
**Description:** As a library consumer, I need the package to compile, typecheck, and export correctly so I can install and import it.

**Acceptance Criteria:**
- [ ] `packages/agent-ts/` exists with `package.json`, `tsconfig.json`, `.env.example`
- [ ] `package.json` has name `@ruska/agent-ts`, type `module`, exports for `.`, `./agent`, `./tools`, `./middleware`
- [ ] Dependencies: `zod`, `dotenv` only. DevDeps: `typescript`, `tsx`, `@types/node`, `vitest`
- [ ] `npm run typecheck` exits with zero errors
- [ ] `npm run build` produces `dist/` with `.js`, `.d.ts`, `.js.map` files
- [ ] `npm run test` runs vitest and exits clean

---

### US-002: Zod-validated configuration from environment
**Description:** As a library consumer, I need typed, validated config from env vars so the agent fails fast on misconfiguration.

**Acceptance Criteria:**
- [ ] `src/config.ts` exports a `loadConfig()` function returning typed `Config` object
- [ ] Validates: `apiUrl` (string, default `http://localhost:8000`), `apiKey` (required string), `model` (string, default `openai:gpt-4.1-mini`), `tavilyApiKey` (optional), `logLevel` (enum, default `info`), `outputDir` (string, default `./output`), `maxIterations` (number, default `15`)
- [ ] Throws `ZodError` with clear message when `RUSKA_API_KEY` is missing
- [ ] Loads `.env` via dotenv
- [ ] **Tests:** unit tests for valid config, missing required fields, default values, type coercion

---

### US-003: Structured JSON logger
**Description:** As a library consumer, I need structured logs so I can pipe agent observability into any log aggregator.

**Acceptance Criteria:**
- [ ] `src/logger.ts` exports `createLogger(level)` returning `{ debug, info, warn, error }` methods
- [ ] Each method writes JSON lines to stderr: `{ timestamp, level, message, ...metadata }`
- [ ] Respects `LOG_LEVEL` — messages below threshold are suppressed
- [ ] Zero external dependencies
- [ ] **Tests:** unit tests for each level, suppression, metadata passthrough, JSON format

---

### US-004: Zod schemas for agent state and structured output
**Description:** As a library consumer, I need well-defined schemas so the agent's inputs, outputs, and state are type-safe.

**Acceptance Criteria:**
- [ ] `src/schemas.ts` exports:
  - `ResearchResult` schema: `{ title, summary, sources[], confidence, followUpQuestions[] }`
  - `AgentState` schema: `{ messages[], notes[], sources[], threadId?, iteration }`
  - Tool input schemas: `WebSearchInput`, `FileWriterInput`, `HumanContactInput`, `NoteTakerInput`
- [ ] `ResearchResult.parse()` throws on invalid data with descriptive errors
- [ ] **Tests:** unit tests for valid parse, invalid parse, edge cases (empty arrays, missing optional fields)

---

### US-005: SSE stream client for /api/llm/stream
**Description:** As a library consumer, I need a typed SSE client that streams LLM responses from the Ruska backend.

**Acceptance Criteria:**
- [ ] `src/stream-client.ts` exports `streamChat(request, config): AsyncGenerator<StreamEvent>`
- [ ] Sends `POST /api/llm/stream` with `x-api-key` header, JSON body
- [ ] Parses SSE events: `metadata`, `messages`, `values`, `error`, `done`
- [ ] Yields typed `StreamEvent` objects as they arrive
- [ ] Throws `StreamConnectionError` on HTTP errors (401, 500, network failure)
- [ ] Supports continuation via `thread_id` in metadata
- [ ] **Tests:** unit tests with mocked fetch — valid stream, error responses, malformed SSE, connection timeout

---

### US-006: System prompt builder with dynamic adjustment
**Description:** As a library consumer, I need composable prompts so the agent's behavior adapts per turn.

**Acceptance Criteria:**
- [ ] `src/prompts/system.ts` exports `buildSystemPrompt({ topic, phase, noteCount, tools })` returning a string
- [ ] `src/prompts/templates.ts` exports reusable fragments: tool descriptions, error recovery guidance, phase instructions
- [ ] System prompt includes local tool definitions (name, description, parameters) so the LLM knows how to call them
- [ ] Prompt varies by phase: `research`, `synthesis`, `output`
- [ ] **Tests:** unit tests for each phase, tool inclusion, template composition

---

### US-007: Tool registry and local tool execution
**Description:** As a library consumer, I need a tool registry so I can dispatch tool calls and register custom tools.

**Acceptance Criteria:**
- [ ] `src/tools/index.ts` exports:
  - `TOOL_DEFINITIONS`: array of `{ name, description, parameters }` for API requests
  - `executeTool(name, args, state): Promise<unknown>` dispatcher
  - `registerTool(definition, handler)` for consumer-defined tools
- [ ] Each tool input validated with its Zod schema before execution
- [ ] Unknown tool names throw `ToolNotFoundError`
- [ ] **Tests:** unit tests for dispatch, unknown tool, schema validation failure

---

### US-008: web_search tool (server-delegated)
**Description:** As a library consumer, I need web search to run on the backend so results come from the server's tool infrastructure.

**Acceptance Criteria:**
- [ ] `src/tools/web-search.ts` exports the tool definition (name, description, Zod schema)
- [ ] Tool is marked as `local: false` in the registry — it is NOT executed client-side
- [ ] Tool name `web_search` is included in the API request's `tools` array
- [ ] When `TAVILY_API_KEY` is set, a local fallback `tavily_search` tool is also registered as `local: true`
- [ ] **Tests:** unit tests for tool definition shape, local flag, Tavily fallback registration

---

### US-009: file_writer tool (local)
**Description:** As a library consumer, I need a local file_writer tool so the agent can save structured output to disk.

**Acceptance Criteria:**
- [ ] `src/tools/file-writer.ts` exports handler and definition
- [ ] Input: `{ filename, content, format? }` — validated with Zod
- [ ] Writes to `config.outputDir` (creates directory if missing)
- [ ] Returns `{ success: true, path, size_bytes }`
- [ ] Rejects path traversal attempts (e.g. `../etc/passwd`)
- [ ] Marked `local: true` in registry
- [ ] **Tests:** unit tests for write, path traversal rejection, directory creation, return shape

---

### US-010: note_taker tool (local)
**Description:** As a library consumer, I need a note_taker tool so the agent can accumulate research notes in local state.

**Acceptance Criteria:**
- [ ] `src/tools/note-taker.ts` exports handler and definition
- [ ] Input: `{ note, category?, source? }` — validated with Zod
- [ ] Pushes note to `AgentState.notes[]`
- [ ] Returns `{ success: true, note_count, category }`
- [ ] Marked `local: true` in registry
- [ ] **Tests:** unit tests for note addition, category handling, count increment

---

### US-011: human_contact tool (local)
**Description:** As a library consumer, I need a human_contact tool so the agent can ask the user a question mid-loop.

**Acceptance Criteria:**
- [ ] `src/tools/human-contact.ts` exports handler and definition
- [ ] Input: `{ question, context? }` — validated with Zod
- [ ] Handler accepts a `promptFn: (question: string) => Promise<string>` callback (dependency injection — no hardcoded readline)
- [ ] Returns `{ human_response, timestamp }`
- [ ] Marked `local: true` in registry
- [ ] **Tests:** unit tests with mock promptFn

---

### US-012: Middleware system with before/after hooks
**Description:** As a library consumer, I need composable middleware so I can inject observability, error handling, and context management into the agent loop.

**Acceptance Criteria:**
- [ ] `src/middleware/index.ts` exports:
  - `Middleware` type: `{ name, beforeLLM?, afterLLM?, beforeTool?, afterTool? }`
  - `runBeforeLLM(middlewares, state): AgentState`
  - `runAfterLLM(middlewares, state, events): void`
  - `runBeforeTool(middlewares, toolName, args): unknown`
  - `runAfterTool(middlewares, toolName, result, error?): unknown`
- [ ] Middleware runs in registration order
- [ ] **Tests:** unit tests for ordering, each hook type, middleware that mutates state

---

### US-013: Error handler middleware (Factor 8/9)
**Description:** As a library consumer, I need tool errors wrapped into LLM-readable context so the agent can recover.

**Acceptance Criteria:**
- [ ] `src/middleware/error-handler.ts` exports `errorHandlerMiddleware`
- [ ] `afterTool`: catches thrown errors, returns `{ error: true, message, tool, suggestion }` string
- [ ] Error messages are compact and actionable for the LLM
- [ ] **Tests:** unit tests for caught error, no-error passthrough

---

### US-014: Observability middleware (Factor 12)
**Description:** As a library consumer, I need every LLM call and tool execution logged with timing.

**Acceptance Criteria:**
- [ ] `src/middleware/observability.ts` exports `observabilityMiddleware`
- [ ] `beforeLLM`: logs iteration number, message count, model
- [ ] `afterLLM`: logs duration, event count, token estimate
- [ ] `beforeTool`/`afterTool`: logs tool name, args summary, duration, success/failure
- [ ] Uses the structured logger from US-003
- [ ] **Tests:** unit tests verifying log calls with expected metadata

---

### US-015: Context manager middleware (Factor 3)
**Description:** As a library consumer, I need automatic context window management so long conversations don't exceed token limits.

**Acceptance Criteria:**
- [ ] `src/middleware/context-manager.ts` exports `contextManagerMiddleware`
- [ ] `beforeLLM`: if `messages.length > 20`, trims oldest messages (keeps system + last N)
- [ ] Trimmed messages are replaced with a summary message
- [ ] Threshold is configurable
- [ ] **Tests:** unit tests for under-threshold (no-op), over-threshold (trim), summary message format

---

### US-016: Dynamic prompt middleware (Factor 2)
**Description:** As a library consumer, I need the system prompt to adapt per turn based on agent state.

**Acceptance Criteria:**
- [ ] `src/middleware/dynamic-prompt.ts` exports `dynamicPromptMiddleware`
- [ ] `beforeLLM`: detects phase (`research` if few notes, `synthesis` if many, `output` if near max iterations)
- [ ] Adjusts the `systemPrompt` field on `AgentState` accordingly
- [ ] **Tests:** unit tests for each phase transition

---

### US-017: Agent loop — the core engine
**Description:** As a library consumer, I need `runAgent(topic, config)` to orchestrate the full agent loop and return a validated `ResearchResult`.

**Acceptance Criteria:**
- [ ] `src/agent.ts` exports `runAgent(topic, config, options?): Promise<ResearchResult>`
- [ ] Options: `{ middlewares?, tools?, onChunk?, promptFn? }`
- [ ] Loop: build request → stream LLM → detect tool calls → execute local tools → append results → repeat
- [ ] Server tools (`web_search`) are sent in API `tools` array — backend executes them
- [ ] Local tools (`file_writer`, `human_contact`, `note_taker`) are dispatched client-side
- [ ] Final text response is parsed with `ResearchResult.parse()` — throws if invalid
- [ ] Respects `maxIterations` — throws if exceeded
- [ ] Calls `onChunk` callback for each streaming token (for UI consumers)
- [ ] Thread ID from metadata event is preserved across turns
- [ ] **Tests:** unit tests with mocked stream client — single turn (no tools), multi-turn (tool call + result), max iterations exceeded, invalid structured output, middleware integration

---

### US-018: Package exports and public API
**Description:** As a library consumer, I need clean entry points so I can import exactly what I need.

**Acceptance Criteria:**
- [ ] `src/index.ts` re-exports: `runAgent`, `loadConfig`, `createLogger`, schemas, types
- [ ] `import { runAgent } from "@ruska/agent-ts"` works
- [ ] `import { executeTool } from "@ruska/agent-ts/tools"` works
- [ ] `import { runBeforeLLM } from "@ruska/agent-ts/middleware"` works
- [ ] All public types are exported (Config, AgentState, ResearchResult, StreamEvent, Middleware, ToolDefinition)
- [ ] **Tests:** import resolution tests verifying each export path

---

### US-019: CI pipeline
**Description:** As a maintainer, I need CI to run typecheck, build, and tests on every PR.

**Acceptance Criteria:**
- [ ] GitHub Actions workflow at `.github/workflows/agent-ts.yml`
- [ ] Triggers on push/PR to `development` when `packages/agent-ts/**` changes
- [ ] Steps: install → typecheck → build → test
- [ ] Fails the PR check if any step fails
- [ ] Uses Node.js 18 and 20 matrix

---

### US-020: README with 12 Factor mapping and usage guide
**Description:** As a library consumer, I need documentation to understand the API, add tools, and swap models.

**Acceptance Criteria:**
- [ ] `packages/agent-ts/README.md` includes:
  - 12 Factor → implementation mapping table
  - Quick start: install, configure `.env`, `runAgent()` example
  - How to add custom tools
  - How to add custom middleware
  - How to swap models (change `MODEL` env var)
  - Architecture diagram (text-based) showing local loop + backend API call
  - Package exports reference
- [ ] All code examples typecheck

## Functional Requirements

- FR-1: The library must export `runAgent(topic, config, options?)` that returns a `Promise<ResearchResult>`
- FR-2: The stream client must POST to `/api/llm/stream` with `x-api-key` auth and parse SSE events
- FR-3: Server tools (e.g. `web_search`) must be sent in the API request `tools` array for backend execution
- FR-4: Local tools (`file_writer`, `human_contact`, `note_taker`) must execute client-side and return results to the LLM via tool messages
- FR-5: The final LLM response must be parsed with `ResearchResult.parse()` — throw `ZodError` on invalid output
- FR-6: The agent loop must respect `maxIterations` and throw a descriptive error when exceeded
- FR-7: Middleware hooks (`beforeLLM`, `afterLLM`, `beforeTool`, `afterTool`) must run in registration order
- FR-8: Configuration must be validated with Zod on load — fail fast with clear errors
- FR-9: The `onChunk` callback must be invoked for each streaming SSE token for real-time UI consumption
- FR-10: The `file_writer` tool must reject path traversal attempts
- FR-11: The `human_contact` tool must accept a `promptFn` callback — no hardcoded I/O
- FR-12: The tool registry must support `registerTool()` for consumer-defined tools
- FR-13: All logs must be structured JSON on stderr via the logger

## Non-Goals (Out of Scope)

- No interactive readline/CLI entry point (consumers build their own)
- No React/Ink integration (that stays in `@ruska/cli`)
- No persistent state between runs (in-memory `AgentState` only)
- No multi-agent orchestration (single focused agent per `runAgent` call)
- No LangChain or AI SDK dependency
- No backend modifications — this package is a pure client-side consumer
- No authentication/RBAC beyond API key
- No WebSocket transport — SSE only (matching existing backend)

## Technical Considerations

- **Runtime:** Node.js 18+ (uses native `fetch`, `ReadableStream`, `TextDecoderStream`)
- **Module system:** ESM only (`"type": "module"`)
- **Build:** `tsc` with `declaration: true`, `sourceMap: true`, target `ES2022`
- **Test framework:** vitest (fast, ESM-native, built-in mocking)
- **Zero heavy deps:** Only `zod` and `dotenv` at runtime
- **SSE parsing:** Adapted from existing `cli/source/lib/services/stream-service.ts` — proven pattern
- **Path safety:** `file_writer` must resolve paths within `outputDir` only — use `path.resolve` + startsWith check

### Integration Points

| Component | Role |
|-----------|------|
| `POST /api/llm/stream` | LLM inference endpoint (backend) |
| `x-api-key` header | Authentication |
| SSE event format | `data: ["type", payload]\n\n` |
| `thread_id` in metadata | Conversation continuity |
| Backend `tools` array | Server-executed tools (web_search) |

## Success Metrics

- `npm run typecheck` exits zero with no errors
- `npm run build` produces correct dist output
- `npm run test` passes all unit tests with >80% coverage
- Library can be imported and `runAgent()` called from external project
- Streaming tokens arrive in real-time via `onChunk` callback
- Local tools execute and return results without backend involvement
- Structured `ResearchResult` is Zod-validated on every run

## Open Questions

1. Should the context manager middleware use a token-counting heuristic or just message count for trimming?
2. Should `registerTool()` support async tool definition loading for lazy initialization?
3. Should the library export a `createAgent()` factory that pre-binds config + middleware for repeated use?
4. What is the exact SSE event format for tool_calls from the backend — does `values.messages[]` contain them or are they in `messages` events?
