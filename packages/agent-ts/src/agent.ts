import type { Config } from "./config.js";
import type { AgentState, ResearchResult } from "./schemas.js";
import { ResearchResult as ResearchResultSchema } from "./schemas.js";
import {
  streamChat,
  type StreamEvent,
  type StreamChatRequest,
} from "./stream-client.js";
import { executeTool, getServerToolNames } from "./tools/index.js";
import type { ToolDefinition } from "./tools/index.js";
import {
  runBeforeLLM,
  runAfterLLM,
  runBeforeTool,
  runAfterTool,
} from "./middleware/index.js";
import type { Middleware } from "./middleware/index.js";

// --- Types ---

export interface RunAgentOptions {
  middlewares?: Middleware[];
  tools?: ToolDefinition[];
  onChunk?: (chunk: string) => void;
  promptFn?: (question: string) => Promise<string>;
}

interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

// --- Errors ---

export class MaxIterationsError extends Error {
  constructor(maxIterations: number) {
    super(
      `Agent loop exceeded maximum iterations (${maxIterations}). ` +
        `The agent did not produce a final result within the allowed turns.`,
    );
    this.name = "MaxIterationsError";
  }
}

// --- Helpers ---

/** Extract text content from a messages event data item */
function extractTextContent(item: unknown): string | undefined {
  if (typeof item === "object" && item !== null) {
    const msg = item as Record<string, unknown>;
    if (typeof msg.content === "string") {
      return msg.content;
    }
    // Multi-modal content blocks
    if (Array.isArray(msg.content)) {
      const textBlock = msg.content.find(
        (b: unknown) =>
          typeof b === "object" &&
          b !== null &&
          (b as Record<string, unknown>).type === "text",
      );
      if (textBlock && typeof (textBlock as Record<string, unknown>).text === "string") {
        return (textBlock as Record<string, unknown>).text as string;
      }
    }
  }
  return undefined;
}

/** Extract tool_calls from a messages event data item */
function extractToolCalls(item: unknown): ToolCall[] {
  if (typeof item !== "object" || item === null) return [];
  const msg = item as Record<string, unknown>;
  if (!Array.isArray(msg.tool_calls)) return [];
  return msg.tool_calls
    .filter(
      (tc: unknown): tc is ToolCall =>
        typeof tc === "object" &&
        tc !== null &&
        typeof (tc as Record<string, unknown>).id === "string" &&
        typeof (tc as Record<string, unknown>).name === "string",
    )
    .map((tc) => ({
      id: tc.id,
      name: tc.name,
      args: (tc.args as Record<string, unknown>) ?? {},
    }));
}

// --- Core Agent Loop ---

export async function runAgent(
  topic: string,
  config: Config,
  options?: RunAgentOptions,
): Promise<ResearchResult> {
  const middlewares = options?.middlewares ?? [];
  const onChunk = options?.onChunk;
  const promptFn = options?.promptFn;

  const serverToolNames = getServerToolNames();

  // Initialize agent state
  let state: AgentState = {
    messages: [{ role: "user", content: topic }],
    notes: [],
    sources: [],
    iteration: 0,
    systemPrompt: undefined,
    threadId: undefined,
  };

  for (let iteration = 0; iteration < config.maxIterations; iteration++) {
    state = { ...state, iteration };

    // --- Run beforeLLM middleware ---
    state = await runBeforeLLM(middlewares, state);

    // --- Build API request ---
    const request: StreamChatRequest = {
      messages: state.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      model: config.model,
      tools: serverToolNames.length > 0 ? serverToolNames : undefined,
      metadata: state.threadId ? { thread_id: state.threadId } : undefined,
    };

    if (state.systemPrompt) {
      request.system_prompt = state.systemPrompt;
    }

    // --- Stream LLM response ---
    const events: StreamEvent[] = [];
    let assistantText = "";
    const toolCalls: ToolCall[] = [];

    for await (const event of streamChat(request, config)) {
      events.push(event);

      if (event.type === "metadata" && event.data.thread_id) {
        state = { ...state, threadId: event.data.thread_id };
      }

      if (event.type === "messages") {
        // messages event data is an array of message chunks
        const items = Array.isArray(event.data) ? event.data : [event.data];
        for (const item of items) {
          const text = extractTextContent(item);
          if (text) {
            assistantText += text;
            if (onChunk) {
              onChunk(text);
            }
          }
          const tcs = extractToolCalls(item);
          toolCalls.push(...tcs);
        }
      }

      if (event.type === "error") {
        throw new Error(`Stream error from backend: ${event.data}`);
      }

      if (event.type === "done") {
        break;
      }
    }

    // --- Run afterLLM middleware ---
    await runAfterLLM(middlewares, state, events);

    // --- Check for tool calls ---
    // Filter to only local tool calls (server tools are handled by backend)
    const localToolCalls = toolCalls.filter(
      (tc) => !serverToolNames.includes(tc.name),
    );

    if (localToolCalls.length > 0) {
      // Append assistant message with tool calls before results
      if (assistantText) {
        state = {
          ...state,
          messages: [
            ...state.messages,
            { role: "assistant", content: assistantText },
          ],
        };
      }

      // Execute local tools
      for (const tc of localToolCalls) {
        // Run beforeTool middleware
        const processedArgs = await runBeforeTool(
          middlewares,
          tc.name,
          tc.args,
        );

        let result: unknown;
        let error: Error | undefined;
        try {
          result = await executeTool(tc.name, processedArgs, state, {
            outputDir: config.outputDir,
            promptFn,
          });
        } catch (err) {
          error = err instanceof Error ? err : new Error(String(err));
          result = undefined;
        }

        // Run afterTool middleware
        const processedResult = await runAfterTool(
          middlewares,
          tc.name,
          result,
          error,
        );

        // Append tool result as a message for the next turn
        const resultContent =
          typeof processedResult === "string"
            ? processedResult
            : JSON.stringify(processedResult ?? { error: true, message: error?.message });

        state = {
          ...state,
          messages: [
            ...state.messages,
            {
              role: "tool",
              content: `[Tool: ${tc.name}] ${resultContent}`,
            },
          ],
        };
      }

      // Continue loop — need another LLM turn to process tool results
      continue;
    }

    // --- No tool calls — try to parse final result ---
    if (assistantText) {
      // Try to extract JSON from the assistant text
      const jsonText = extractJSON(assistantText);
      if (jsonText) {
        const parsed = JSON.parse(jsonText);
        return ResearchResultSchema.parse(parsed);
      }

      // Not valid JSON — append as assistant message and continue loop
      state = {
        ...state,
        messages: [
          ...state.messages,
          { role: "assistant", content: assistantText },
        ],
      };
    }
  }

  throw new MaxIterationsError(config.maxIterations);
}

/** Try to extract a JSON object from text that may contain markdown/prose */
function extractJSON(text: string): string | null {
  // Try the whole string first
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      // Not valid JSON, try other strategies
    }
  }

  // Try to find JSON inside code fences
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch?.[1]) {
    const inner = fenceMatch[1].trim();
    try {
      JSON.parse(inner);
      return inner;
    } catch {
      // Not valid JSON
    }
  }

  // Try to find first { ... } block
  const braceStart = trimmed.indexOf("{");
  const braceEnd = trimmed.lastIndexOf("}");
  if (braceStart >= 0 && braceEnd > braceStart) {
    const substr = trimmed.slice(braceStart, braceEnd + 1);
    try {
      JSON.parse(substr);
      return substr;
    } catch {
      // Not valid JSON
    }
  }

  return null;
}
