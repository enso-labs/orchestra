import apiClient from "@/lib/utils/apiClient";
import { ThreadPayload } from "@/lib/entities";
import { DEFAULT_OPTIMIZE_MODEL } from "@/lib/config/llm";
import { VITE_API_URL } from "@/lib/config";
import { getAuthToken } from "@/lib/utils/auth";
import { SSE } from "sse.js";

const SYSTEM_PROMPT = `GOAL:
Generate a system prompt for an AI Agent.

RETURN FORMAT:
Do no return anything except the final system.

WARNING:
Attention to formatting. Not adhering to return format will result in failure.

CONTEXT:
You are an expert prompt engineer who uses optimizes system prompts for AI agents. Your agents need to know they're EXPERTS!`;

const getSystemPrompt = (previousSystemPrompt?: string) => {
	if (previousSystemPrompt) {
		return SYSTEM_PROMPT + `\n\nPROMPT TO ALTER:\n${previousSystemPrompt}`;
	}

	return SYSTEM_PROMPT;
};

export const findThread = async (threadId: string) => {
	try {
		const response = await apiClient.get(`/llm/thread/${threadId}`);
		return response;
	} catch (error: any) {
		console.error("Error finding thread:", error);
		throw new Error(error.response?.data?.detail || "Failed to find thread");
	}
};

/**
 * Creates a new thread with the provided payload
 * @param payload - Thread configuration containing system prompt and other settings
 * @returns The created thread data
 */
export const createJsonThread = async (payload: ThreadPayload) => {
	try {
		const response = await apiClient.post("/llm/thread", payload, {
			headers: {
				Accept: "application/json",
			},
		});
		return response.data;
	} catch (error: any) {
		console.error("Error creating thread:", error);
		throw new Error(error.response?.data?.detail || "Failed to create thread");
	}
};

export const optimizeSystemPrompt = async (payload: ThreadPayload) => {
	payload.system = SYSTEM_PROMPT;
	payload.model = DEFAULT_OPTIMIZE_MODEL;
	try {
		const response = await apiClient.post("/llm/chat", payload);
		return response.data.answer.content;
	} catch (error: any) {
		console.error("Error optimizing system prompt:", error);
		throw new Error(
			error.response?.data?.detail || "Failed to optimize system prompt",
		);
	}
};

export const alterSystemPrompt = async (payload: ThreadPayload) => {
	payload.system = getSystemPrompt(payload.system);
	payload.model = DEFAULT_OPTIMIZE_MODEL;
	try {
		const response = await apiClient.post("/llm/chat", payload);
		return response.data.answer.content;
	} catch (error: any) {
		console.error("Error altering system prompt:", error);
		throw new Error(
			error.response?.data?.detail || "Failed to alter system prompt",
		);
	}
};

type MessageContent = string | Array<{ type: string; [key: string]: any }>;

interface StreamThreadPayload {
	system: string;
	messages: { role: string; content: MessageContent; [key: string]: any }[];
	model: string;
	metadata: { thread_id?: string; checkpoint_id?: string; [key: string]: any };
	stream_mode: string;
	a2a?: object;
	mcp?: object;
	tools?: string[];
}

export const streamThread = (payload: StreamThreadPayload): SSE => {
	try {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			Accept: "text/event-stream",
		};
		const token = getAuthToken();
		if (token) headers.Authorization = `Bearer ${token}`;

		const source = new SSE(`${VITE_API_URL}/llm/stream`, {
			headers: headers,
			payload: JSON.stringify(payload),
			method: "POST",
		});
		return source;
	} catch (error: unknown) {
		console.error("Error streaming thread:", error);
		throw error;
	}
};

export const searchThreads = async (
	action: "list_threads" | "list_checkpoints" | "get_checkpoint",
	metadata: { thread_id?: string; checkpoint_id?: string } = {},
	limit: number = 100,
	offset: number = 0,
) => {
	let payload;
	if (action === "list_threads") {
		payload = {
			limit: limit,
			offset: offset,
			metadata: metadata,
		};
	} else if (action === "list_checkpoints") {
		payload = {
			limit: limit,
			offset: offset,
			metadata: { thread_id: metadata.thread_id },
		};
	} else if (action === "get_checkpoint") {
		payload = {
			limit: limit,
			offset: offset,
			metadata: {
				thread_id: metadata.thread_id,
				checkpoint_id: metadata.checkpoint_id,
			},
		};
	}
	const response = await apiClient.post(`/threads/search`, payload, {
		headers: {
			"Content-Type": "application/json",
		},
	});
	const data = await response.data;

	if (action === "list_threads") {
		return data.threads;
	} else if (action === "list_checkpoints") {
		return data.checkpoints;
	} else if (action === "get_checkpoint") {
		return data.checkpoint;
	}
};

export const deleteThread = async (threadId: string) => {
	try {
		const response = await apiClient.delete(`/threads/${threadId}`, {
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				Authorization: `Bearer ${getAuthToken()}`,
			},
		});
		return response;
	} catch (error: any) {
		console.error("Error deleting thread:", error);
		throw new Error(error.response?.data?.detail || "Failed to delete thread");
	}
};
