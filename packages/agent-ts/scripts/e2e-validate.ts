#!/usr/bin/env tsx
/**
 * Functional E2E validation for @ruska/agent-ts
 *
 * Runs the agent against the live Ruska backend with a real topic,
 * prints the full ResearchResult to stdout, and saves it to output/.
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function printHeader(title: string): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(60)}\n`);
}

function printField(label: string, value: string): void {
  console.log(`  ${label.padEnd(16)} ${value}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("@ruska/agent-ts — Functional E2E Validation\n");

  // Load config
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    console.error("Failed to load config. Make sure RUSKA_API_KEY is set.");
    console.error(err);
    process.exit(1);
  }

  // Register all tools locally (pure LLM mode)
  registerWebSearch();
  registerNoteTaker();
  registerFileWriter();
  registerHumanContact();

  const topic = "What are the main features of TypeScript?";
  const maxIterations = 5;

  printField("Topic:", topic);
  printField("Model:", config.model);
  printField("Max iterations:", String(maxIterations));
  printField("API URL:", config.apiUrl);

  console.log("\n[Streaming output...]");

  const dynamicPrompt = createDynamicPromptMiddleware({ topic, maxIterations });

  try {
    const result = await runAgent(topic, { ...config, maxIterations }, {
      middlewares: [dynamicPrompt],
      onChunk: (chunk) => {
        process.stdout.write(chunk);
      },
    });

    // Print structured result
    printHeader("RESULT");
    printField("Title:", result.title);
    printField("Summary:", result.summary.length > 200 ? result.summary.slice(0, 200) + "..." : result.summary);
    printField("Sources:", result.sources.join(", ") || "(none)");
    printField("Confidence:", String(result.confidence));
    printField("Follow-up:", result.followUpQuestions.join(", ") || "(none)");

    // Save to output
    const outputDir = resolve(config.outputDir);
    await mkdir(outputDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const filePath = resolve(outputDir, `e2e-functional-${ts}.json`);
    await writeFile(filePath, JSON.stringify(result, null, 2) + "\n");

    console.log(`\n  Output saved: ${filePath}`);
  } catch (err) {
    printHeader("ERROR");

    if (err instanceof StructuredOutputError) {
      console.log("  StructuredOutputError: LLM did not return valid ResearchResult JSON\n");
      console.log("  Raw LLM response:");
      console.log("  " + "-".repeat(56));
      console.log(err.rawText);
      console.log("  " + "-".repeat(56));

      // Save raw text to output
      const outputDir = resolve(config.outputDir);
      await mkdir(outputDir, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const filePath = resolve(outputDir, `e2e-functional-error-${ts}.json`);
      await writeFile(filePath, JSON.stringify({ error: "StructuredOutputError", rawText: err.rawText }, null, 2) + "\n");
      console.log(`\n  Error output saved: ${filePath}`);
      process.exit(1);
    }

    if (err instanceof MaxIterationsError) {
      console.log(`  MaxIterationsError: Agent did not produce a result within ${maxIterations} iterations`);
      process.exit(1);
    }

    console.error("  Unexpected error:", err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
