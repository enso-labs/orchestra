import apiClient from '@/lib/utils/apiClient';
import { ThreadPayload } from '@/entities';

const SYSTEM_PROMPT = `GOAL:
Generate a system prompt for an AI Agent.

RETURN FORMAT:
Do no return anything except the final system.

WARNING:
Attention to formatting. Not adhering to return format will result in failure.

CONTEXT:
You are an expert prompt engineer who uses optimizes system prompts for AI agents. Your agents need to know they're EXPERTS!`

export const findThread = async (threadId: string) => {
  const response = await apiClient.get(`/thread/${threadId}`);
  return response.data;
};

/**
 * Creates a new thread with the provided payload
 * @param payload - Thread configuration containing system prompt and other settings
 * @returns The created thread data
 */
export const createJsonThread = async (payload: ThreadPayload) => {
  try {
    const response = await apiClient.post('/threads', payload, {
      headers: {
        'Accept': 'application/json',
      }
    });
    return response.data;
  } catch (error: any) {
    console.error('Error creating thread:', error);
    throw new Error(error.response?.data?.detail || 'Failed to create thread');
  }
};

export const optimizeSystemPrompt = async (payload: ThreadPayload) => {
  payload.system = SYSTEM_PROMPT;
  payload.model = 'anthropic:claude-3-7-sonnet-latest';
  // payload.model = 'openai:gpt-4o-mini';
  try {
    const response = await apiClient.post('/llm/chat', payload);
    return response.data.answer.content;
  } catch (error: any) {
    console.error('Error optimizing system prompt:', error);
    throw new Error(error.response?.data?.detail || 'Failed to optimize system prompt');
  }
};



