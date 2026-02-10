#!/usr/bin/env tsx
/**
 * End-to-end validation script for @ruska/agent-ts (Pure LLM Mode)
 *
 * Validates that the agent runs in pure LLM mode against the live Ruska backend:
 * 1. singleTurn mode — sends exactly 1 request with tools:[], exits cleanly
 * 2. Multi-turn mode (maxIterations: 3) — at most 3 backend requests, all with tools:[]
 *
 * Pure LLM mode means:
 * - Backend acts as text-in/text-out inference layer only
 * - All tools described in system_prompt, dispatched locally
 * - Request body always has tools: [] (empty array)
 * - Exactly 1 HTTP request per agent turn (no backend-side looping)
 *
 * Usage:
 *   npm run e2e
 *   RUSKA_API_URL=http://localhost:8000 RUSKA_API_KEY=... npm run e2e
 */

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig } from "../src/config.js";
import { runAgent, StructuredOutputError, MaxIterationsError } from "../src/agent.js";
import { registerWebSearch } from "../src/tools/web-search.js";
import { registerNoteTaker } from "../src/tools/note-taker.js";
import { registerFileWriter } from "../src/tools/file-writer.js";
import { registerHumanContact } from "../src/tools/human-contact.js";
import { createDynamicPromptMiddleware } from "../src/middleware/dynamic-prompt.js";
import type { Config } from "../src/config.js";
import type { ResearchResult } from "../src/schemas.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function printHeader(title: string): void {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"═".repeat(60)}\n`);
}

function printResult(label: string, value: string): void {
  console.log(`  ${label.padEnd(24)} ${value}`);
}

interface TestResult {
  test: "singleTurn" | "multiTurn";
  timestamp: string;
  requestCount: number;
  success: boolean;
  result: ResearchResult | null;
  rawText: string | null;
  error: string | null;
  toolsInPayload: string[];
}

async function writeTestResult(
  testResult: TestResult,
  outputDir: string,
): Promise<string> {
  await mkdir(outputDir, { recursive: true });
  const ts = testResult.timestamp.replace(/[:.]/g, "-");
  const prefix = testResult.test === "singleTurn" ? "e2e-singleturn" : "e2e-multiturn";
  const filename = `${prefix}-${ts}.json`;
  const filePath = resolve(outputDir, filename);
  await writeFile(filePath, JSON.stringify(testResult, null, 2) + "\n");
  return filePath;
}

// ── Test 1: singleTurn ───────────────────────────────────────────────────────

async function testSingleTurn(config: Config): Promise<{ pass: boolean; testResult: TestResult }> {
  printHeader("Test 1: singleTurn mode (expect exactly 1 backend request, tools: [])");

  let chunkCount = 0;
  let requestCount = 0;
  const toolsInPayload: string[] = [];
  const timestamp = new Date().toISOString();

  // Intercept fetch to count requests and verify tools: []
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (...args: Parameters<typeof fetch>) => {
    const url = typeof args[0] === "string" ? args[0] : (args[0] as Request).url;
    if (url.includes("/api/llm/stream")) {
      requestCount++;
      const init = args[1];
      if (init?.body) {
        const bodyText = typeof init.body === "string" ? init.body : "[non-string body]";
        try {
          const parsed = JSON.parse(bodyText);
          toolsInPayload.push(JSON.stringify(parsed.tools));
        } catch {
          toolsInPayload.push("[parse error]");
        }
      }
      console.log(`  [fetch] Request #${requestCount} → ${url} (tools: [])`);
    }
    return originalFetch(...args);
  };

  // Use dynamicPromptMiddleware so the LLM gets a system prompt with ResearchResult schema
  // singleTurn uses maxIterations: 1 which triggers output phase via detectPhase()
  const topic = "What is TypeScript?";
  const dynamicPrompt = createDynamicPromptMiddleware({ topic, maxIterations: 1 });

  try {
    const result = await runAgent(topic, config, {
      singleTurn: true,
      middlewares: [dynamicPrompt],
      onChunk: () => {
        chunkCount++;
      },
    });

    printResult("Status:", "SUCCESS (ResearchResult)");
    printResult("Title:", result.title);
    printResult("Confidence:", String(result.confidence));
    printResult("Sources:", String(result.sources.length));
    printResult("Chunks received:", String(chunkCount));
    printResult("Backend requests:", String(requestCount));
    printResult("Tools in payload:", toolsInPayload.join(", ") || "none");

    const allToolsEmpty = toolsInPayload.every((t) => t === "[]");
    const pass = requestCount === 1 && allToolsEmpty;
    console.log(`\n  Result: ${pass ? "PASS" : "FAIL"} — ${requestCount} request(s), tools: ${allToolsEmpty ? "[] (pure LLM)" : "NOT EMPTY"}`);
    return {
      pass,
      testResult: { test: "singleTurn", timestamp, requestCount, success: true, result, rawText: null, error: null, toolsInPayload },
    };
  } catch (err) {
    if (err instanceof StructuredOutputError) {
      printResult("Status:", "StructuredOutputError (acceptable)");
      printResult("Raw text:", err.rawText.slice(0, 100) + (err.rawText.length > 100 ? "..." : ""));
      printResult("Backend requests:", String(requestCount));
      printResult("Tools in payload:", toolsInPayload.join(", ") || "none");

      const allToolsEmpty = toolsInPayload.every((t) => t === "[]");
      const pass = requestCount === 1 && allToolsEmpty;
      console.log(`\n  Result: ${pass ? "PASS" : "FAIL"} — ${requestCount} request(s), tools: ${allToolsEmpty ? "[] (pure LLM)" : "NOT EMPTY"}`);
      return {
        pass,
        testResult: { test: "singleTurn", timestamp, requestCount, success: false, result: null, rawText: err.rawText, error: null, toolsInPayload },
      };
    }

    if (err instanceof MaxIterationsError) {
      printResult("Status:", "MaxIterationsError (loop bounded — 1 iteration)");
      printResult("Backend requests:", String(requestCount));
      printResult("Tools in payload:", toolsInPayload.join(", ") || "none");

      const allToolsEmpty = toolsInPayload.every((t) => t === "[]");
      const pass = requestCount === 1 && allToolsEmpty;
      console.log(`\n  Result: ${pass ? "PASS" : "FAIL"} — ${requestCount} request(s), tools: ${allToolsEmpty ? "[] (pure LLM)" : "NOT EMPTY"}`);
      return {
        pass,
        testResult: { test: "singleTurn", timestamp, requestCount, success: false, result: null, rawText: null, error: (err as Error).message, toolsInPayload },
      };
    }

    console.error(`  UNEXPECTED ERROR: ${err}`);
    printResult("Backend requests:", String(requestCount));
    return {
      pass: false,
      testResult: { test: "singleTurn", timestamp, requestCount, success: false, result: null, rawText: null, error: String(err), toolsInPayload },
    };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// ── Test 2: multi-turn with maxIterations: 3 ────────────────────────────────

async function testMultiTurn(config: Config): Promise<{ pass: boolean; testResult: TestResult }> {
  printHeader("Test 2: multi-turn mode (maxIterations: 3, expect at most 3 requests, all tools: [])");

  const multiTurnConfig: Config = { ...config, maxIterations: 3 };

  let chunkCount = 0;
  let requestCount = 0;
  const toolsInPayload: string[] = [];
  const requestPayloads: string[] = [];
  const timestamp = new Date().toISOString();

  // Intercept fetch to count requests, capture payloads, verify tools: []
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (...args: Parameters<typeof fetch>) => {
    const url = typeof args[0] === "string" ? args[0] : (args[0] as Request).url;
    if (url.includes("/api/llm/stream")) {
      requestCount++;
      const init = args[1];
      if (init?.body) {
        const bodyText = typeof init.body === "string" ? init.body : "[non-string body]";
        requestPayloads.push(bodyText);
        try {
          const parsed = JSON.parse(bodyText);
          toolsInPayload.push(JSON.stringify(parsed.tools));
        } catch {
          toolsInPayload.push("[parse error]");
        }
        const hasNudge = bodyText.includes("not valid JSON");
        console.log(
          `  [fetch] Request #${requestCount} → ${url} (tools: [])${hasNudge ? " (contains nudge)" : ""}`,
        );
      } else {
        console.log(`  [fetch] Request #${requestCount} → ${url}`);
      }
    }
    return originalFetch(...args);
  };

  // Use dynamicPromptMiddleware so the LLM gets a system prompt with ResearchResult schema
  const topic = "What is TypeScript?";
  const dynamicPrompt = createDynamicPromptMiddleware({ topic, maxIterations: 3 });

  try {
    const result = await runAgent(topic, multiTurnConfig, {
      middlewares: [dynamicPrompt],
      onChunk: () => {
        chunkCount++;
      },
    });

    printResult("Status:", "SUCCESS (ResearchResult)");
    printResult("Title:", result.title);
    printResult("Confidence:", String(result.confidence));
    printResult("Chunks received:", String(chunkCount));
    printResult("Backend requests:", String(requestCount));
    printResult("Tools in payload:", toolsInPayload.join(", ") || "none");

    const nudgeCount = requestPayloads.filter((p) => p.includes("not valid JSON")).length;
    printResult("Nudge messages:", String(nudgeCount));

    const allToolsEmpty = toolsInPayload.every((t) => t === "[]");
    const pass = requestCount <= 3 && allToolsEmpty;
    console.log(`\n  Result: ${pass ? "PASS" : "FAIL"} — ${requestCount} request(s) (max 3), tools: ${allToolsEmpty ? "[] (pure LLM)" : "NOT EMPTY"}`);
    return {
      pass,
      testResult: { test: "multiTurn", timestamp, requestCount, success: true, result, rawText: null, error: null, toolsInPayload },
    };
  } catch (err) {
    if (err instanceof StructuredOutputError) {
      printResult("Status:", "StructuredOutputError (retry exhausted)");
      printResult("Raw text:", err.rawText.slice(0, 100) + (err.rawText.length > 100 ? "..." : ""));
      printResult("Backend requests:", String(requestCount));
      printResult("Tools in payload:", toolsInPayload.join(", ") || "none");

      const nudgeCount = requestPayloads.filter((p) => p.includes("not valid JSON")).length;
      printResult("Nudge messages:", String(nudgeCount));

      const allToolsEmpty = toolsInPayload.every((t) => t === "[]");
      const pass = requestCount <= 3 && allToolsEmpty;
      console.log(`\n  Result: ${pass ? "PASS" : "FAIL"} — ${requestCount} request(s) (max 3), tools: ${allToolsEmpty ? "[] (pure LLM)" : "NOT EMPTY"}`);
      return {
        pass,
        testResult: { test: "multiTurn", timestamp, requestCount, success: false, result: null, rawText: err.rawText, error: null, toolsInPayload },
      };
    }

    if (err instanceof Error && err.name === "MaxIterationsError") {
      printResult("Status:", "MaxIterationsError (loop bounded correctly)");
      printResult("Backend requests:", String(requestCount));
      printResult("Tools in payload:", toolsInPayload.join(", ") || "none");

      const allToolsEmpty = toolsInPayload.every((t) => t === "[]");
      const pass = requestCount <= 3 && allToolsEmpty;
      console.log(`\n  Result: ${pass ? "PASS" : "FAIL"} — ${requestCount} request(s) (max 3), tools: ${allToolsEmpty ? "[] (pure LLM)" : "NOT EMPTY"}`);
      return {
        pass,
        testResult: { test: "multiTurn", timestamp, requestCount, success: false, result: null, rawText: null, error: (err as Error).message, toolsInPayload },
      };
    }

    console.error(`  UNEXPECTED ERROR: ${err}`);
    printResult("Backend requests:", String(requestCount));
    return {
      pass: false,
      testResult: { test: "multiTurn", timestamp, requestCount, success: false, result: null, rawText: null, error: String(err), toolsInPayload },
    };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("@ruska/agent-ts — E2E Validation (Pure LLM Mode)");
  console.log(`Validates pure LLM mode (US-026): tools:[] in all requests, local tool dispatch\n`);

  let config: Config;
  try {
    config = loadConfig();
    printResult("API URL:", config.apiUrl);
    printResult("Model:", config.model);
    printResult("Max iterations:", String(config.maxIterations));
  } catch (err) {
    console.error("Failed to load config. Make sure RUSKA_API_KEY is set.");
    console.error(err);
    process.exit(1);
  }

  // Register all tools locally (pure LLM mode — no server-delegated tools)
  registerWebSearch();
  registerNoteTaker();
  registerFileWriter();
  registerHumanContact();

  const outputDir = resolve(config.outputDir);
  const results: { name: string; pass: boolean }[] = [];

  // Test 1: singleTurn
  try {
    const { pass, testResult } = await testSingleTurn(config);
    results.push({ name: "singleTurn (1 request, tools: [])", pass });
    const filePath = await writeTestResult(testResult, outputDir);
    console.log(`  Output saved: ${filePath}`);
  } catch (err) {
    console.error(`  Test 1 crashed: ${err}`);
    results.push({ name: "singleTurn", pass: false });
    const crashResult: TestResult = {
      test: "singleTurn",
      timestamp: new Date().toISOString(),
      requestCount: 0,
      success: false,
      result: null,
      rawText: null,
      error: String(err),
      toolsInPayload: [],
    };
    const filePath = await writeTestResult(crashResult, outputDir);
    console.log(`  Output saved: ${filePath}`);
  }

  // Test 2: multi-turn
  try {
    const { pass, testResult } = await testMultiTurn(config);
    results.push({ name: "multi-turn (maxIterations: 3, tools: [])", pass });
    const filePath = await writeTestResult(testResult, outputDir);
    console.log(`  Output saved: ${filePath}`);
  } catch (err) {
    console.error(`  Test 2 crashed: ${err}`);
    results.push({ name: "multi-turn (maxIterations: 3)", pass: false });
    const crashResult: TestResult = {
      test: "multiTurn",
      timestamp: new Date().toISOString(),
      requestCount: 0,
      success: false,
      result: null,
      rawText: null,
      error: String(err),
      toolsInPayload: [],
    };
    const filePath = await writeTestResult(crashResult, outputDir);
    console.log(`  Output saved: ${filePath}`);
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  printHeader("Validation Summary");

  for (const r of results) {
    console.log(`  ${r.pass ? "PASS" : "FAIL"}  ${r.name}`);
  }

  const allPass = results.every((r) => r.pass);
  console.log(`\n  Overall: ${allPass ? "ALL TESTS PASSED" : "SOME TESTS FAILED"}`);

  if (!allPass) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
