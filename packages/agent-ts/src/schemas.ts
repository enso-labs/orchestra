import { z } from "zod";

// --- ResearchResult: structured output from the agent ---

export const ResearchResult = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  sources: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  followUpQuestions: z.array(z.string()),
});

export type ResearchResult = z.infer<typeof ResearchResult>;

// --- AgentState: in-memory state for the agent loop ---

const NoteEntry = z.object({
  note: z.string(),
  category: z.string().optional(),
  source: z.string().optional(),
  timestamp: z.string().optional(),
});

const Message = z.object({
  role: z.string(),
  content: z.string(),
});

export const AgentState = z.object({
  messages: z.array(Message),
  notes: z.array(NoteEntry),
  sources: z.array(z.string()),
  threadId: z.string().optional(),
  iteration: z.number().int().nonnegative(),
  systemPrompt: z.string().optional(),
});

export type AgentState = z.infer<typeof AgentState>;

// --- Tool input schemas ---

export const WebSearchInput = z.object({
  query: z.string().min(1),
});

export type WebSearchInput = z.infer<typeof WebSearchInput>;

export const FileWriterInput = z.object({
  filename: z.string().min(1),
  content: z.string(),
  format: z.string().optional(),
});

export type FileWriterInput = z.infer<typeof FileWriterInput>;

export const HumanContactInput = z.object({
  question: z.string().min(1),
  context: z.string().optional(),
});

export type HumanContactInput = z.infer<typeof HumanContactInput>;

export const NoteTakerInput = z.object({
  note: z.string().min(1),
  category: z.string().optional(),
  source: z.string().optional(),
});

export type NoteTakerInput = z.infer<typeof NoteTakerInput>;
