import { describe, it, expect } from "vitest";

// --- Main entry point: '@ruska/agent-ts' (src/index.ts) ---

import {
  // Agent loop
  runAgent,
  MaxIterationsError,
  // Config
  loadConfig,
  // Logger
  createLogger,
  // Schemas (values)
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
  // Middleware runners
  runBeforeLLM,
  runAfterLLM,
  runBeforeTool,
  runAfterTool,
  // Middleware implementations
  errorHandlerMiddleware,
  createObservabilityMiddleware,
  createContextManagerMiddleware,
  createDynamicPromptMiddleware,
  dynamicPromptMiddleware,
} from "./index.js";

// Type-only imports (verify they compile)
import type {
  RunAgentOptions,
  Config,
  Logger,
  LogLevel,
  StreamEvent,
  StreamChatRequest,
  Phase,
  BuildSystemPromptOptions,
  ToolDef,
  ToolDefinition,
  ToolHandler,
  Middleware,
  DynamicPromptOptions,
} from "./index.js";

describe("Main entry point exports (@ruska/agent-ts)", () => {
  it("exports runAgent function", () => {
    expect(typeof runAgent).toBe("function");
  });

  it("exports MaxIterationsError class", () => {
    const err = new MaxIterationsError(10);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("MaxIterationsError");
  });

  it("exports loadConfig function", () => {
    expect(typeof loadConfig).toBe("function");
  });

  it("exports createLogger function", () => {
    expect(typeof createLogger).toBe("function");
  });

  it("exports Zod schemas as values", () => {
    // Zod schemas have a .parse method
    expect(typeof ResearchResult.parse).toBe("function");
    expect(typeof AgentState.parse).toBe("function");
    expect(typeof WebSearchInput.parse).toBe("function");
    expect(typeof FileWriterInput.parse).toBe("function");
    expect(typeof HumanContactInput.parse).toBe("function");
    expect(typeof NoteTakerInput.parse).toBe("function");
  });

  it("exports streamChat function", () => {
    expect(typeof streamChat).toBe("function");
  });

  it("exports StreamConnectionError class", () => {
    const err = new StreamConnectionError(500, "test");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("StreamConnectionError");
  });

  it("exports buildSystemPrompt function", () => {
    expect(typeof buildSystemPrompt).toBe("function");
  });

  it("exports tool registry functions", () => {
    expect(typeof registerTool).toBe("function");
    expect(typeof executeTool).toBe("function");
    expect(typeof getServerToolNames).toBe("function");
    expect(typeof getToolDefinitions).toBe("function");
  });

  it("exports ToolNotFoundError class", () => {
    const err = new ToolNotFoundError("unknown");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ToolNotFoundError");
  });

  it("exports middleware runner functions", () => {
    expect(typeof runBeforeLLM).toBe("function");
    expect(typeof runAfterLLM).toBe("function");
    expect(typeof runBeforeTool).toBe("function");
    expect(typeof runAfterTool).toBe("function");
  });

  it("exports middleware implementations", () => {
    expect(errorHandlerMiddleware).toBeDefined();
    expect(errorHandlerMiddleware.name).toBe("error-handler");
    expect(typeof createObservabilityMiddleware).toBe("function");
    expect(typeof createContextManagerMiddleware).toBe("function");
    expect(typeof createDynamicPromptMiddleware).toBe("function");
    expect(typeof dynamicPromptMiddleware).toBe("function");
  });

  it("type-checks public types (compile-time verification)", () => {
    // These type assertions verify the types exist and are usable.
    // If any type were missing from exports, this file would fail typecheck.
    const _runAgentOpts: RunAgentOptions = {};
    const _config: Partial<Config> = {};
    const _logLevel: LogLevel = "info";
    const _phase: Phase = "research";
    const _middleware: Partial<Middleware> = {};
    const _toolDef: Partial<ToolDefinition> = {};
    const _dynamicOpts: DynamicPromptOptions = { topic: "test", maxIterations: 5 };

    // StreamEvent is a union — verify one variant
    const _event: StreamEvent = { type: "done" };

    // StreamChatRequest
    const _request: StreamChatRequest = {
      messages: [{ role: "user", content: "hello" }],
      model: "test",
    };

    // BuildSystemPromptOptions
    const _buildOpts: BuildSystemPromptOptions = {
      topic: "test",
      phase: "research",
      noteCount: 0,
      tools: [],
    };

    // ToolDef
    const _toolDefPrompt: ToolDef = {
      name: "test",
      description: "test",
      parameters: {},
    };

    // Logger interface
    const _logger: Logger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };

    // ToolHandler type
    const _handler: ToolHandler = async () => ({});

    expect(true).toBe(true); // If we get here, all types compiled
  });
});

// --- Tools sub-path: '@ruska/agent-ts/tools' (src/tools/index.ts) ---

import {
  registerTool as toolRegister,
  executeTool as toolExecute,
  getServerToolNames as toolServerNames,
  getToolDefinitions as toolGetDefs,
  ToolNotFoundError as ToolErr,
  _resetRegistry,
} from "./tools/index.js";

import type {
  ToolDefinition as ToolDef2,
  ToolHandler as ToolHandler2,
} from "./tools/index.js";

describe("Tools sub-path exports (@ruska/agent-ts/tools)", () => {
  it("exports registerTool", () => {
    expect(typeof toolRegister).toBe("function");
  });

  it("exports executeTool", () => {
    expect(typeof toolExecute).toBe("function");
  });

  it("exports getServerToolNames", () => {
    expect(typeof toolServerNames).toBe("function");
  });

  it("exports getToolDefinitions", () => {
    expect(typeof toolGetDefs).toBe("function");
  });

  it("exports ToolNotFoundError", () => {
    const err = new ToolErr("test");
    expect(err).toBeInstanceOf(Error);
  });

  it("exports _resetRegistry for testing", () => {
    expect(typeof _resetRegistry).toBe("function");
  });

  it("type-checks ToolDefinition and ToolHandler (compile-time)", () => {
    const _def: Partial<ToolDef2> = { name: "test" };
    const _handler: ToolHandler2 = async () => ({});
    expect(true).toBe(true);
  });
});

// --- Middleware sub-path: '@ruska/agent-ts/middleware' (src/middleware/index.ts) ---

import {
  runBeforeLLM as mwRunBefore,
  runAfterLLM as mwRunAfter,
  runBeforeTool as mwRunBeforeTool,
  runAfterTool as mwRunAfterTool,
} from "./middleware/index.js";

import type { Middleware as Mw } from "./middleware/index.js";

describe("Middleware sub-path exports (@ruska/agent-ts/middleware)", () => {
  it("exports runBeforeLLM", () => {
    expect(typeof mwRunBefore).toBe("function");
  });

  it("exports runAfterLLM", () => {
    expect(typeof mwRunAfter).toBe("function");
  });

  it("exports runBeforeTool", () => {
    expect(typeof mwRunBeforeTool).toBe("function");
  });

  it("exports runAfterTool", () => {
    expect(typeof mwRunAfterTool).toBe("function");
  });

  it("type-checks Middleware interface (compile-time)", () => {
    const mw: Mw = {
      name: "test",
      beforeLLM: (state) => state,
    };
    expect(mw.name).toBe("test");
  });
});
