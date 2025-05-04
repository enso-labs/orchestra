import apiClient from '@/lib/utils/apiClient';
import { ThreadPayload } from '@/entities';
import { DEFAULT_OPTIMIZE_MODEL } from '@/config/llm';
import { VITE_API_URL } from '@/config';
import { constructPayload } from '@/lib/utils/llm';
import { getAuthToken } from '@/lib/utils/auth';
import { SSE } from 'sse.js';


const SYSTEM_PROMPT = `GOAL:
Generate a system prompt for an AI Agent.

RETURN FORMAT:
Do no return anything except the final system.

WARNING:
Attention to formatting. Not adhering to return format will result in failure.

CONTEXT:
You are an expert prompt engineer who uses optimizes system prompts for AI agents. Your agents need to know they're EXPERTS!`

const getSystemPrompt = (previousSystemPrompt?: string) => {
  if (previousSystemPrompt) {
    return SYSTEM_PROMPT + `\n\nPROMPT TO ALTER:\n${previousSystemPrompt}`;
  }

  return SYSTEM_PROMPT;
}


export const findThread = async (threadId: string) => {
  try {
    const response = await apiClient.get(`/threads/${threadId}`);
    return response;
  } catch (error: any) {
    console.error('Error finding thread:', error);
    throw new Error(error.response?.data?.detail || 'Failed to find thread');
  }
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
  payload.model = DEFAULT_OPTIMIZE_MODEL;
  try {
    const response = await apiClient.post('/llm/chat', payload);
    return response.data.answer.content;
  } catch (error: any) {
    console.error('Error optimizing system prompt:', error);
    throw new Error(error.response?.data?.detail || 'Failed to optimize system prompt');
  }
};

export const alterSystemPrompt = async (payload: ThreadPayload) => {
  payload.system = getSystemPrompt(payload.system);
  payload.model = DEFAULT_OPTIMIZE_MODEL;
  try {
    const response = await apiClient.post('/llm/chat', payload);
    return response.data.answer.content;
  } catch (error: any) {
    console.error('Error altering system prompt:', error);
    throw new Error(error.response?.data?.detail || 'Failed to alter system prompt');
  }
};

export const streamThread = (payload: ThreadPayload, agentId: string): SSE => {
  const responseData = constructPayload(payload, agentId);
  const url = agentId ? `/agents/${agentId}/threads` : '/threads';
  const source = new SSE(`${VITE_API_URL}${url}${payload.threadId ? `/${payload.threadId}` : ''}`,
  {
    headers: {
      'Content-Type': 'application/json', 
      'Accept': 'text/event-stream',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    payload: JSON.stringify(responseData),
    method: 'POST'
  });
  return source;
}
