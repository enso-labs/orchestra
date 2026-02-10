import {
  type ToolDef,
  toolDescriptionBlock,
  toolCallFormatInstructions,
  researchInstructions,
  synthesisInstructions,
  outputInstructions,
  errorRecoveryGuidance,
} from "./templates.js";

export type Phase = "research" | "synthesis" | "output";

export interface BuildSystemPromptOptions {
  topic: string;
  phase: Phase;
  noteCount: number;
  tools: ToolDef[];
}

export function buildSystemPrompt(options: BuildSystemPromptOptions): string {
  const { topic, phase, noteCount, tools } = options;

  const phaseBlock =
    phase === "research"
      ? researchInstructions()
      : phase === "synthesis"
        ? synthesisInstructions()
        : outputInstructions();

  const toolBlock = toolDescriptionBlock(tools);
  const errorBlock = errorRecoveryGuidance();

  const parts = [
    `# Research Agent`,
    ``,
    `You are a research agent investigating the following topic:`,
    `**${topic}**`,
    ``,
    `You have accumulated **${noteCount}** research note${noteCount !== 1 ? "s" : ""} so far.`,
    ``,
    phaseBlock,
  ];

  if (toolBlock) {
    parts.push("", toolBlock);
    // Include tool call format instructions when tools are available
    parts.push("", toolCallFormatInstructions());
  }

  parts.push("", errorBlock);

  return parts.join("\n");
}
