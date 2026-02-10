/**
 * Manual validation script for @ruska/agent-ts
 *
 * Requires: npm run build (compiles src/ to dist/)
 * Run:      node index.js
 */
import {
  runAgent,
  loadConfig,
  StructuredOutputError,
  MaxIterationsError,
  createDynamicPromptMiddleware,
} from "./dist/index.js";
import { registerWebSearch } from "./dist/tools/web-search.js";
import { registerNoteTaker } from "./dist/tools/note-taker.js";
import { registerFileWriter } from "./dist/tools/file-writer.js";
import { registerHumanContact } from "./dist/tools/human-contact.js";

const config = loadConfig();

// Register all tools locally (pure LLM mode)
registerWebSearch();
registerNoteTaker();
registerFileWriter();
registerHumanContact();

const topic = "What containers are running?";
const maxIterations = 5;

const dynamicPrompt = createDynamicPromptMiddleware({ topic, maxIterations });

try {
  const result = await runAgent(topic, { ...config, maxIterations }, {
    middlewares: [dynamicPrompt],
    onChunk: (chunk) => {
      process.stdout.write(chunk);
    },
  });

  console.log("\n\n--- ResearchResult ---");
  console.log(`Title:      ${result.title}`);
  console.log(`Summary:    ${result.summary}`);
  console.log(`Sources:    ${result.sources.join(", ") || "(none)"}`);
  console.log(`Confidence: ${result.confidence}`);
  console.log(`Follow-up:  ${result.followUpQuestions.join(", ") || "(none)"}`);
} catch (err) {
  if (err instanceof StructuredOutputError) {
    console.error("\n\n--- StructuredOutputError ---");
    console.error("Raw LLM response:");
    console.error(err.rawText);
  } else if (err instanceof MaxIterationsError) {
    console.error(`\n\n--- MaxIterationsError (${maxIterations} iterations) ---`);
    console.error(err.message);
  } else {
    console.error("\n\n--- Unexpected Error ---");
    console.error(err);
  }
  process.exit(1);
}
