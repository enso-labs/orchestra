import type { Config } from "./config.js";
import type { AgentState, ResearchResult } from "./schemas.js";
import { ResearchResult as ResearchResultSchema } from "./schemas.js";
import {
  streamChat,
  type StreamEvent,
  type StreamChatRequest,
} from "./stream-client.js";
import { executeTool } from "./tools/index.js";
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
  singleTurn?: boolean;
}

interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

// --- Constants ---

const MAX_NON_JSON_RETRIES = 2;

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

export class StructuredOutputError extends Error {
  rawText: string;

  constructor(rawText: string) {
    super(
      `LLM did not return valid JSON matching ResearchResult schema after retries. ` +
        `Last response: ${rawText.slice(0, 200)}${rawText.length > 200 ? "..." : ""}`,
    );
    this.name = "StructuredOutputError";
    this.rawText = rawText;
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

/** Extract tool_calls from a messages event data item (metadata-style) */
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

/**
 * Extract tool_calls from the assistant's text response.
 * In pure LLM mode the model outputs structured JSON tool calls in its text:
 *   { "tool_calls": [{ "id": "...", "name": "...", "args": {...} }] }
 */
function extractToolCallsFromText(text: string): ToolCall[] {
  const jsonStr = extractJSON(text);
  if (!jsonStr) return [];

  try {
    const parsed = JSON.parse(jsonStr);
    if (typeof parsed === "object" && parsed !== null && Array.isArray(parsed.tool_calls)) {
      return parsed.tool_calls
        .filter(
          (tc: unknown): tc is ToolCall =>
            typeof tc === "object" &&
            tc !== null &&
            typeof (tc as Record<string, unknown>).name === "string",
        )
        .map((tc: Record<string, unknown>, idx: number) => ({
          id: (typeof tc.id === "string" ? tc.id : `text-tc-${idx}`) as string,
          name: tc.name as string,
          args: (tc.args as Record<string, unknown>) ?? {},
        }));
    }
  } catch {
    // Not valid JSON or no tool_calls field
  }

  return [];
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
  const singleTurn = options?.singleTurn ?? false;

  // Initialize agent state
  let state: AgentState = {
    messages: [{ role: "user", content: topic }],
    notes: [],
    sources: [],
    iteration: 0,
    systemPrompt: undefined,
    threadId: undefined,
  };

  let nonJsonRetries = 0;
  const effectiveMaxIterations = singleTurn ? 1 : config.maxIterations;

  for (let iteration = 0; iteration < effectiveMaxIterations; iteration++) {
    state = { ...state, iteration };

    // --- Run beforeLLM middleware ---
    state = await runBeforeLLM(middlewares, state);

    // --- Build API request ---
    // Pure LLM mode: no tools sent to backend — all tools described in system_prompt
    const request: StreamChatRequest = {
      messages: state.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      model: config.model,
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
          // Extract tool_calls from message metadata (if backend passes them through)
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

    // --- Check for tool calls from message metadata ---
    // Also check for tool calls embedded in the assistant's text response
    // (pure LLM mode: the model outputs tool_calls as JSON in its text)
    if (toolCalls.length === 0 && assistantText) {
      const textToolCalls = extractToolCallsFromText(assistantText);
      toolCalls.push(...textToolCalls);
    }

    // All tool calls are local (pure LLM mode — no server-delegated tools)
    if (toolCalls.length > 0) {
      // Reset non-JSON retries after a successful tool call turn
      nonJsonRetries = 0;

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

      // Execute all tools locally
      for (const tc of toolCalls) {
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
    if (!assistantText) {
      // Empty response with no tool calls is not recoverable
      throw new StructuredOutputError("");
    }

    // Try to extract JSON from the assistant text
    const jsonText = extractJSON(assistantText);
    if (jsonText) {
      const parsed = JSON.parse(jsonText);
      return ResearchResultSchema.parse(parsed);
    }

    // Not valid JSON — handle with retry or throw
    if (singleTurn) {
      throw new StructuredOutputError(assistantText);
    }

    nonJsonRetries++;
    if (nonJsonRetries > MAX_NON_JSON_RETRIES) {
      throw new StructuredOutputError(assistantText);
    }

    // Append assistant text and nudge message asking for JSON output
    state = {
      ...state,
      messages: [
        ...state.messages,
        { role: "assistant", content: assistantText },
        {
          role: "user",
          content:
            "Your response was not valid JSON. Please respond with ONLY a JSON object matching this schema: " +
            '{ "title": string, "summary": string, "sources": string[], "confidence": number (0-1), "followUpQuestions": string[] }. ' +
            "Do not include any other text, markdown, or explanation — just the raw JSON object.",
        },
      ],
    };
    continue;
  }

  throw new MaxIterationsError(effectiveMaxIterations);
}

/** Try to extract a JSON object from text that may contain markdown/prose */
export function extractJSON(text: string): string | null {
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
