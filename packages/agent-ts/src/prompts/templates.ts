// Reusable prompt template fragments

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

// --- Tool description block ---

export function toolDescriptionBlock(tools: ToolDef[]): string {
  if (tools.length === 0) return "";

  const lines = tools.map(
    (t) =>
      `- **${t.name}**: ${t.description}\n  Parameters: ${JSON.stringify(t.parameters)}`,
  );

  return `## Available Tools\n\n${lines.join("\n\n")}`;
}

// --- Tool call format instructions ---

export function toolCallFormatInstructions(): string {
  return `## How to Call Tools

When you want to use a tool, respond with ONLY a JSON object in this exact format:
\`\`\`json
{
  "tool_calls": [
    {
      "id": "call-1",
      "name": "tool_name",
      "args": { "param": "value" }
    }
  ]
}
\`\`\`

Rules:
- Output ONLY the JSON object — no prose, no markdown wrapping, no explanation before or after
- You may call multiple tools in one response by adding more entries to the tool_calls array
- Each tool call must have a unique "id" string, a "name" matching one of the available tools, and "args" matching the tool's parameter schema
- After you receive tool results, use them to continue your research or produce the final output`;
}

// --- Phase-specific instructions ---

export function researchInstructions(): string {
  return `## Phase: Research

You are in the **research** phase. Your goal is to gather information about the topic.

- Use web_search to find relevant sources
- Use note_taker to save key findings with categories
- Use human_contact if you need clarification from the user
- Focus on breadth: explore multiple angles and sources
- Do NOT produce a final ResearchResult yet`;
}

export function synthesisInstructions(): string {
  return `## Phase: Synthesis

You are in the **synthesis** phase. You have gathered research notes and should now combine them.

- Review your accumulated notes and sources
- Identify patterns, contradictions, and key themes
- Use web_search to fill any remaining gaps
- Use note_taker to record synthesized insights
- Begin forming your conclusions but do NOT output the final result yet`;
}

export function outputInstructions(): string {
  return `## Phase: Output

You are in the **output** phase. Produce your final structured result NOW.

Respond with a JSON object matching this exact schema:
\`\`\`json
{
  "title": "string — concise title summarizing the research",
  "summary": "string — comprehensive summary of findings",
  "sources": ["string — URLs or references used"],
  "confidence": 0.0 to 1.0,
  "followUpQuestions": ["string — suggested follow-up questions"]
}
\`\`\`

Do NOT call any tools. Output ONLY the JSON object.`;
}

// --- Error recovery guidance ---

export function errorRecoveryGuidance(): string {
  return `## Error Recovery

If a tool call fails, you will receive an error message. When this happens:
1. Read the error message carefully
2. Adjust your parameters and retry with corrected input
3. If a tool is unavailable, use an alternative approach
4. Never repeat the exact same failing call more than once`;
}
