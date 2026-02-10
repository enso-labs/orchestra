#!/usr/bin/env tsx
/**
 * End-to-end validation script for @ruska/agent-ts
 *
 * Validates that the recursive thread fix works against the live Ruska backend:
 * 1. singleTurn mode — sends exactly 1 request, exits cleanly
 * 2. Multi-turn mode (maxIterations: 3) — at most 3 backend requests with retry/nudge
 *
 * Usage:
 *   npm run e2e
 *   RUSKA_API_URL=http://localhost:8000 RUSKA_API_KEY=... npm run e2e
 */

import { loadConfig } from "../src/config.js";
import { runAgent, StructuredOutputError, MaxIterationsError } from "../src/agent.js";
import { registerWebSearch } from "../src/tools/web-search.js";
import type { Config } from "../src/config.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function printHeader(title: string): void {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"═".repeat(60)}\n`);
}

function printResult(label: string, value: string): void {
  console.log(`  ${label.padEnd(24)} ${value}`);
}

// ── Test 1: singleTurn ───────────────────────────────────────────────────────

async function testSingleTurn(config: Config): Promise<boolean> {
  printHeader("Test 1: singleTurn mode (expect exactly 1 backend request)");

  let chunkCount = 0;
  let requestCount = 0;

  // Intercept fetch to count requests to the backend
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (...args: Parameters<typeof fetch>) => {
    const url = typeof args[0] === "string" ? args[0] : (args[0] as Request).url;
    if (url.includes("/api/llm/stream")) {
      requestCount++;
      console.log(`  [fetch] Request #${requestCount} → ${url}`);
    }
    return originalFetch(...args);
  };

  try {
    const result = await runAgent("What is TypeScript?", config, {
      singleTurn: true,
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
    printResult("Thread count:", `${requestCount} (expected: 1)`);

    const pass = requestCount === 1;
    console.log(`\n  Result: ${pass ? "PASS" : "FAIL"} — ${requestCount} request(s) sent`);
    return pass;
  } catch (err) {
    if (err instanceof StructuredOutputError) {
      printResult("Status:", "StructuredOutputError (acceptable)");
      printResult("Raw text:", err.rawText.slice(0, 100) + (err.rawText.length > 100 ? "..." : ""));
      printResult("Backend requests:", String(requestCount));
      printResult("Thread count:", `${requestCount} (expected: 1)`);

      const pass = requestCount === 1;
      console.log(`\n  Result: ${pass ? "PASS" : "FAIL"} — ${requestCount} request(s) sent`);
      return pass;
    }

    // MaxIterationsError is acceptable — singleTurn sets effectiveMaxIterations=1,
    // so if the LLM returns empty text or only server-side tool calls, the loop
    // exhausts its single iteration and throws. The key assertion is request count.
    if (err instanceof MaxIterationsError) {
      printResult("Status:", "MaxIterationsError (loop bounded — 1 iteration)");
      printResult("Backend requests:", String(requestCount));
      printResult("Thread count:", `${requestCount} (expected: 1)`);

      const pass = requestCount === 1;
      console.log(`\n  Result: ${pass ? "PASS" : "FAIL"} — ${requestCount} request(s) sent`);
      return pass;
    }

    console.error(`  UNEXPECTED ERROR: ${err}`);
    printResult("Backend requests:", String(requestCount));
    return false;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// ── Test 2: multi-turn with maxIterations: 3 ────────────────────────────────

async function testMultiTurn(config: Config): Promise<boolean> {
  printHeader("Test 2: multi-turn mode (maxIterations: 3, expect at most 3 requests)");

  const multiTurnConfig: Config = { ...config, maxIterations: 3 };

  let chunkCount = 0;
  let requestCount = 0;
  const requestPayloads: string[] = [];

  // Intercept fetch to count requests and capture payloads
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (...args: Parameters<typeof fetch>) => {
    const url = typeof args[0] === "string" ? args[0] : (args[0] as Request).url;
    if (url.includes("/api/llm/stream")) {
      requestCount++;
      // Capture body to check for nudge messages
      const init = args[1];
      if (init?.body) {
        const bodyText = typeof init.body === "string" ? init.body : "[non-string body]";
        requestPayloads.push(bodyText);
        const hasNudge = bodyText.includes("not valid JSON");
        console.log(
          `  [fetch] Request #${requestCount} → ${url}${hasNudge ? " (contains nudge)" : ""}`,
        );
      } else {
        console.log(`  [fetch] Request #${requestCount} → ${url}`);
      }
    }
    return originalFetch(...args);
  };

  try {
    const result = await runAgent("What is TypeScript?", multiTurnConfig, {
      onChunk: () => {
        chunkCount++;
      },
    });

    printResult("Status:", "SUCCESS (ResearchResult)");
    printResult("Title:", result.title);
    printResult("Confidence:", String(result.confidence));
    printResult("Chunks received:", String(chunkCount));
    printResult("Backend requests:", String(requestCount));
    printResult("Thread operations:", `${requestCount} (expected: <= 3)`);

    // Check for nudge messages in payloads
    const nudgeCount = requestPayloads.filter((p) => p.includes("not valid JSON")).length;
    printResult("Nudge messages:", String(nudgeCount));

    const pass = requestCount <= 3;
    console.log(`\n  Result: ${pass ? "PASS" : "FAIL"} — ${requestCount} request(s) sent (max 3)`);
    return pass;
  } catch (err) {
    if (err instanceof StructuredOutputError) {
      printResult("Status:", "StructuredOutputError (retry exhausted)");
      printResult("Raw text:", err.rawText.slice(0, 100) + (err.rawText.length > 100 ? "..." : ""));
      printResult("Backend requests:", String(requestCount));
      printResult("Thread operations:", `${requestCount} (expected: <= 3)`);

      const nudgeCount = requestPayloads.filter((p) => p.includes("not valid JSON")).length;
      printResult("Nudge messages:", String(nudgeCount));

      const pass = requestCount <= 3;
      console.log(`\n  Result: ${pass ? "PASS" : "FAIL"} — ${requestCount} request(s) sent (max 3)`);
      return pass;
    }

    // MaxIterationsError is also acceptable — means loop bounded correctly
    if (err instanceof Error && err.name === "MaxIterationsError") {
      printResult("Status:", "MaxIterationsError (loop bounded correctly)");
      printResult("Backend requests:", String(requestCount));
      printResult("Thread operations:", `${requestCount} (expected: <= 3)`);

      const pass = requestCount <= 3;
      console.log(`\n  Result: ${pass ? "PASS" : "FAIL"} — ${requestCount} request(s) sent (max 3)`);
      return pass;
    }

    console.error(`  UNEXPECTED ERROR: ${err}`);
    printResult("Backend requests:", String(requestCount));
    return false;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("@ruska/agent-ts — E2E Validation");
  console.log(`Validates recursive thread fix (US-023) against live backend\n`);

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

  // Register web_search tool (server-delegated)
  registerWebSearch();

  const results: { name: string; pass: boolean }[] = [];

  // Test 1: singleTurn
  try {
    const pass = await testSingleTurn(config);
    results.push({ name: "singleTurn", pass });
  } catch (err) {
    console.error(`  Test 1 crashed: ${err}`);
    results.push({ name: "singleTurn", pass: false });
  }

  // Test 2: multi-turn
  try {
    const pass = await testMultiTurn(config);
    results.push({ name: "multi-turn (maxIterations: 3)", pass });
  } catch (err) {
    console.error(`  Test 2 crashed: ${err}`);
    results.push({ name: "multi-turn (maxIterations: 3)", pass: false });
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
