# @ruska/agent-ts

12 Factor Agent TypeScript library — own the agent loop locally, delegate LLM inference to the Ruska backend via `POST /api/llm/stream`.

## 12 Factor Agent Mapping

| # | Factor | Implementation |
|---|--------|---------------|
| 1 | Natural language to tool calls | `runAgent` loop parses LLM responses into typed `ToolCall` objects and dispatches them |
| 2 | Own your prompts | `buildSystemPrompt()` + `dynamicPromptMiddleware` — prompts adapt per turn based on phase |
| 3 | Own your context window | `contextManagerMiddleware` — trims old messages, keeps system prompt + last N |
| 4 | Tools are just structured output | `ToolDefinition` with Zod schemas — LLM returns `tool_calls[]`, validated before execution |
| 5 | Unify tool results and user input | Tool results appended as `{ role: "tool" }` messages alongside user messages in state |
| 6 | Bring your own client | `streamChat()` SSE client — no framework lock-in, works in any JS/TS runtime |
| 7 | Agent loop owns the control flow | `runAgent()` runs the loop locally: prompt → stream → tool dispatch → repeat |
| 8 | Let the LLM handle errors | `errorHandlerMiddleware` wraps tool errors into LLM-readable JSON for self-recovery |
| 9 | Small, focused agents | Single `runAgent(topic)` call per research task — one agent, one goal |
| 10 | Structured output from day one | `ResearchResult` Zod schema validates every final response |
| 11 | Config via environment | `loadConfig()` with Zod validation — fail fast on misconfigured env vars |
| 12 | Observe everything | `observabilityMiddleware` logs every LLM call and tool execution with timing |

## Quick Start

### Install

```bash
npm install @ruska/agent-ts
```

### Configure

Copy `.env.example` and fill in your API key:

```bash
cp .env.example .env
```

```env
RUSKA_API_URL=http://localhost:8000
RUSKA_API_KEY=your-api-key-here
MODEL=openai:gpt-4.1-mini
LOG_LEVEL=info
OUTPUT_DIR=./output
MAX_ITERATIONS=15
```

### Run

```typescript
import { runAgent, loadConfig } from "@ruska/agent-ts";

const config = loadConfig();

const result = await runAgent("What are the latest trends in AI agents?", config, {
  onChunk: (text) => process.stdout.write(text),
});

console.log(result.title);
console.log(result.summary);
console.log(`Confidence: ${result.confidence}`);
console.log(`Sources: ${result.sources.join(", ")}`);
```

## Adding Custom Tools

Register local tools that execute client-side:

```typescript
import { z } from "zod";
import { runAgent, loadConfig, registerTool } from "@ruska/agent-ts";

registerTool(
  {
    name: "calculator",
    description: "Evaluate a math expression",
    parameters: z.object({ expression: z.string() }),
    local: true,
  },
  async (args) => {
    const { expression } = args as { expression: string };
    return { result: eval(expression) };
  },
);

const config = loadConfig();
const result = await runAgent("Calculate the compound interest on $10,000", config);
```

## Adding Custom Middleware

Middleware hooks run at four points in the agent loop:

```typescript
import type { Middleware } from "@ruska/agent-ts/middleware";
import { runAgent, loadConfig } from "@ruska/agent-ts";

const timingMiddleware: Middleware = {
  name: "timing",
  beforeLLM: (state) => {
    console.log(`Iteration ${state.iteration} starting...`);
    return state;
  },
  afterTool: (toolName, result) => {
    console.log(`Tool ${toolName} completed`);
    return result;
  },
};

const config = loadConfig();
const result = await runAgent("Research topic", config, {
  middlewares: [timingMiddleware],
});
```

### Built-in Middleware

```typescript
import {
  errorHandlerMiddleware,
  createObservabilityMiddleware,
  createContextManagerMiddleware,
  createDynamicPromptMiddleware,
  createLogger,
} from "@ruska/agent-ts";

const logger = createLogger("info");

const middlewares = [
  createDynamicPromptMiddleware(),           // Adapts prompt per phase
  createContextManagerMiddleware(20, 10),    // Trim after 20 msgs, keep last 10
  createObservabilityMiddleware(logger),     // Log every LLM + tool call
  errorHandlerMiddleware,                    // Wrap tool errors for LLM recovery
];
```

## Swapping Models

Change the `MODEL` environment variable to use any model supported by the Ruska backend:

```env
MODEL=openai:gpt-4.1-mini
MODEL=anthropic:claude-sonnet-4-5-20250929
MODEL=openai:gpt-4o
```

No code changes required — `loadConfig()` reads the `MODEL` env var and passes it to the API.

## Architecture

```
Consumer (CLI / App / Script)
  │
  ▼
runAgent(topic, config, options)
  │
  ├─► beforeLLM middleware
  │     └─ dynamic prompt, context trimming
  │
  ├─► streamChat(request, config)
  │     └─ POST /api/llm/stream ──► Ruska Backend
  │           │                        ├─ LLM inference
  │           │                        └─ Server tools (web_search)
  │           ▼
  │     SSE events (metadata, messages, values, done)
  │
  ├─► afterLLM middleware
  │     └─ observability logging
  │
  ├─► Local tool dispatch (if tool_calls detected)
  │     ├─ beforeTool middleware
  │     ├─ executeTool(name, args, state)
  │     │   ├─ file_writer   → write to disk
  │     │   ├─ note_taker    → accumulate notes
  │     │   └─ human_contact → ask user via promptFn
  │     └─ afterTool middleware (error handler)
  │
  └─► Loop until ResearchResult or maxIterations
        └─ ResearchResult.parse() validates final JSON output
```

## Package Exports

### Main entry point — `@ruska/agent-ts`

```typescript
import {
  // Agent
  runAgent,
  MaxIterationsError,
  // Config
  loadConfig,
  // Logger
  createLogger,
  // Schemas (runtime + types)
  ResearchResult,
  AgentState,
  WebSearchInput,
  FileWriterInput,
  HumanContactInput,
  NoteTakerInput,
  // Stream client
  streamChat,
  StreamConnectionError,
  // Prompts
  buildSystemPrompt,
  // Tools
  registerTool,
  executeTool,
  getServerToolNames,
  getToolDefinitions,
  ToolNotFoundError,
  // Middleware
  runBeforeLLM,
  runAfterLLM,
  runBeforeTool,
  runAfterTool,
  errorHandlerMiddleware,
  createObservabilityMiddleware,
  createContextManagerMiddleware,
  createDynamicPromptMiddleware,
  dynamicPromptMiddleware,
} from "@ruska/agent-ts";

// Types
import type {
  Config,
  Logger,
  LogLevel,
  RunAgentOptions,
  StreamEvent,
  StreamChatRequest,
  Phase,
  BuildSystemPromptOptions,
  ToolDef,
  ToolDefinition,
  ToolHandler,
  Middleware,
  DynamicPromptOptions,
} from "@ruska/agent-ts";
```

### Tools sub-path — `@ruska/agent-ts/tools`

```typescript
import {
  registerTool,
  executeTool,
  getServerToolNames,
  getToolDefinitions,
  TOOL_DEFINITIONS,
  ToolNotFoundError,
  _resetRegistry,
} from "@ruska/agent-ts/tools";

import type { ToolDefinition, ToolHandler } from "@ruska/agent-ts/tools";
```

### Middleware sub-path — `@ruska/agent-ts/middleware`

```typescript
import {
  runBeforeLLM,
  runAfterLLM,
  runBeforeTool,
  runAfterTool,
} from "@ruska/agent-ts/middleware";

import type { Middleware } from "@ruska/agent-ts/middleware";
```

## Development

```bash
npm run typecheck   # Type-check without emitting
npm run build       # Compile to dist/
npm run test        # Run vitest
```

## Requirements

- Node.js 18+ (native `fetch`, `ReadableStream`, `TextDecoderStream`)
- Ruska backend running at `RUSKA_API_URL`
- Valid `RUSKA_API_KEY` for authentication

## License

MIT
