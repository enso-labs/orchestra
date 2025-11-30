import apiClient from "@/lib/utils/apiClient";
import { ThreadPayload } from "@/lib/entities";
import { DEFAULT_OPTIMIZE_MODEL } from "@/lib/config/llm";
import { VITE_API_URL } from "@/lib/config";
import { getAuthToken } from "@/lib/utils/auth";
import { SSE, SSEOptions } from "sse.js";
import { Agent } from "./agentService";

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
type Messages = { role: string; content: MessageContent; [key: string]: any }[];
type Input = { messages: Messages };
// type Metadata = { thread_id?: string; checkpoint_id?: string; [key: string]: any };
type A2A = { [key: string]: any };
type MCP = { [key: string]: any };
type Tools = string[];
type Subagents = Agent[];
type Presidio = {
	analyze?: boolean;
	anonymize?: boolean;
	redact?: boolean;
};
interface StreamThreadPayload {
	system?: string;
	system_prompt?: string;
	instructions?: string;
	input: Input;
	model: string;
	metadata: any;
	a2a?: A2A;
	mcp?: MCP;
	tools?: Tools;
	subagents?: Subagents;
	presidio?: Presidio;
}

export const streamThread = (payload: StreamThreadPayload): SSE => {
	try {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			Accept: "text/event-stream",
		};
		const token = getAuthToken();
	if (token) headers.Authorization = `Bearer ${token}`;

	if (payload.system?.trim() === "") {
		delete payload.system;
	}
	if (payload.system_prompt?.trim() === "") {
		delete payload.system_prompt;
	}
	if (payload.instructions?.trim() === "") {
		delete payload.instructions;
	}
	const newConfig: SSEOptions = {
		headers: headers,
		payload: JSON.stringify(payload),
		method: "POST",
			start: false,
		};
		const source = new SSE(`${VITE_API_URL}/llm/stream`, newConfig);
		return source;
	} catch (error: unknown) {
		console.error("Error streaming thread:", error);
		throw error;
	}
};

export const searchThreads = async (
	action: "list_threads" | "list_checkpoints" | "get_checkpoint",
	filter: { thread_id?: string; checkpoint_id?: string } = {},
	limit: number = 20,
	offset: number = 0,
) => {
	let payload;
	if (action === "list_threads") {
		payload = {
			limit: limit,
			offset: offset,
			filter: filter,
		};
	} else if (action === "list_checkpoints") {
		payload = {
			limit: limit,
			offset: offset,
			filter: { thread_id: filter.thread_id },
		};
	} else if (action === "get_checkpoint") {
		payload = {
			limit: limit,
			offset: offset,
			filter: {
				thread_id: filter.thread_id,
				checkpoint_id: filter.checkpoint_id,
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

export const deleteThread = async (threadId: string, assistantId?: string) => {
	try {
		let url = `/threads/${threadId}`;
		if (assistantId) {
			url = `/a/${assistantId}/threads/${threadId}`;
		}
		const response = await apiClient.delete(url, {
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

export const searchThreadsByProject = async (
	projectId: string,
	limit: number = 20,
	offset: number = 0,
) => {
	try {
		const payload = {
			limit: limit,
			offset: offset,
			filter: { project_id: projectId },
		};
		const response = await apiClient.post(`/threads/search`, payload, {
			headers: {
				"Content-Type": "application/json",
			},
		});
		return response.data.threads || [];
	} catch (error: any) {
		console.error("Error searching threads by project:", error);
		throw new Error(
			error.response?.data?.detail || "Failed to search threads by project",
		);
	}
};

export const updateThreadProject = async (
	threadId: string,
	projectId: string | null,
) => {
	try {
		const response = await apiClient.patch(
			`/threads/${threadId}`,
			{ project_id: projectId },
			{
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${getAuthToken()}`,
				},
			},
		);
		return response.data;
	} catch (error: any) {
		console.error("Error updating thread project:", error);
		throw new Error(
			error.response?.data?.detail || "Failed to update thread project",
		);
	}
};
