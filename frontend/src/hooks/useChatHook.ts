import debug from "debug";
import { useEffect, useRef, useState } from "react";
import apiClient from "@/lib/utils/apiClient";
import { listModels, Model } from "@/lib/services/modelService";
import { listTools } from "@/lib/services/toolService";
import { useChatReducer } from "@/lib/reducers/chatReducer";
import { DEFAULT_CHAT_MODEL, isValidModelName } from "@/lib/config/llm";
import { getAuthToken } from "@/lib/utils/auth";
import { getMemory, getModel, getSystemPrompt } from "@/lib/utils/storage";

const KEY_NAME = "config:mcp";

debug.enable("hooks:*");
const logger = debug("hooks:useChatHook");

const initChatState = {
	response: null,
	responseRef: "",
	toolCallRef: "",
	messagesEndRef: null,
	messages: [],
	settings: [],
	preset: null,
	toolCallMessage: null,
	payload: {
		agent: null,
		threadId: "",
		images: [] as string[],
		query: "",
		system: getSystemPrompt(),
		tools: [] as any[],
		visualize: false,
		model: getModel(),
		memory: getMemory(),
		mcp: null,
		a2a: null,
		collection: null,
		// arcade: {
		//     tools: [] as string[],
		//     toolkit: [] as string[],
		// }
	},
	history: {
		threads: [],
		page: 1,
		per_page: 20,
		total: 0,
		next_page: "",
	},
	models: [],
	isToolCallInProgress: false,
	currentToolCall: null,
	selectedToolMessage: null,
};

export default function useChatHook() {
	const { state, actions } = useChatReducer();
	const {
		response,
		models,
		availableTools,
		toolCallMessage,
		isToolCallInProgress,
		currentToolCall,
		selectedToolMessage,
		history,
		preset,
		toolCall,
	} = state;
	const {
		setResponse,
		setModels,
		setAvailableTools,
		setToolCallMessage,
		setIsToolCallInProgress,
		setCurrentToolCall,
		setSelectedToolMessage,
		setHistory,
		setPreset,
		setToolCall,
		setMessages,
	} = actions;
	const token = getAuthToken();
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const responseRef = useRef(initChatState.responseRef);
	const [payload, setPayload] = useState(initChatState.payload);

	const currentModel = models.find(
		(model: Model) => model.id === payload.model,
	);
	const enabledTools = availableTools.filter((tool: any) =>
		payload.tools.includes(tool.id),
	);

	const [controller, setController] = useState<AbortController | null>(null);

	// const handleQuery = (agentId: string = '') => {
	// const { controller } = queryThread(payload, agentId, messages);
	// setController(controller);
	// }

	const abortQuery = () => {
		if (controller) {
			controller.abort();
			setController(null);
		}
	};

	const getHistory = async (
		page: number = 1,
		perPage: number = 20,
		agentId: string = "",
	) => {
		try {
			const url = agentId ? `/agents/${agentId}/threads` : "/threads";
			const params = { page, per_page: perPage };
			const res = await apiClient.get(url, {
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					Authorization: `Bearer ${token}`,
				},
				method: "GET",
				params,
			});
			setHistory(res.data);
		} catch (error: any) {
			logger("Error listing threads:", error);
			throw new Error(error.response?.data?.detail || "Failed to list threads");
		}
	};

	const useGetHistoryEffect = (agentId: string = "") => {
		useEffect(() => {
			getHistory(history.page, history.per_page, agentId);

			return () => {
				// Cleanup logic if needed
			};
		}, []);
	};

	const useMCPEffect = () => {
		useEffect(() => {
			// Check if mcp payload is not set and set it from localStorage if it exists
			if (!payload.mcp) {
				const storedMCP = localStorage.getItem(KEY_NAME);
				if (storedMCP) {
					setPayload((prev: any) => ({ ...prev, mcp: JSON.parse(storedMCP) }));
				}
			}
			// When payload.mcp changes, update localStorage
			else {
				localStorage.setItem(KEY_NAME, JSON.stringify(payload.mcp));
			}
		}, [payload.mcp]);
	};

	const useA2AEffect = () => {
		useEffect(() => {
			// When payload.mcp changes, update localStorage
			if (payload.a2a) {
				localStorage.setItem("config:a2a", JSON.stringify(payload.a2a));
			} else {
				localStorage.removeItem("config:a2a");
			}
		}, [payload.a2a]);
	};

	const useSelectModelEffect = (currentModel: string = DEFAULT_CHAT_MODEL) => {
		useEffect(() => {
			if (!isValidModelName(currentModel)) {
				setPayload({ ...payload, model: DEFAULT_CHAT_MODEL });
			} else {
				setPayload({ ...payload, model: currentModel });
			}
		}, [currentModel]);

		return () => {
			// Cleanup logic if needed
		};
	};

	const fetchTools = async () => {
		try {
			const response = await listTools();
			setAvailableTools(response.tools);
		} catch (error) {
			console.error("Failed to fetch tools:", error);
		}
	};

	const useToolsEffect = () => {
		useEffect(() => {
			fetchTools();
		}, []);
	};

	const deleteThread = async (threadId: string) => {
		try {
			await apiClient.delete(`/threads/${threadId}`, {
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					Authorization: `Bearer ${token}`,
				},
			});
			// Refresh the thread list after deletion
			getHistory(history.page, history.per_page);
			// handleNewChat();
		} catch (error: any) {
			console.error("Error deleting thread:", error);
			throw new Error(
				error.response?.data?.detail || "Failed to delete thread",
			);
		}
	};

	return {
		...initChatState,
		messagesEndRef,
		// messages,
		setMessages,
		responseRef,
		response,
		setResponse,
		// handleQuery,
		payload,
		setPayload,
		toolCallMessage,
		setToolCallMessage,
		getHistory,
		history,
		setHistory,
		useGetHistoryEffect,
		models,
		setModels,
		useSelectModelEffect,
		// handleNewChat,
		availableTools,
		setAvailableTools,
		useToolsEffect,
		deleteThread,
		isToolCallInProgress,
		setIsToolCallInProgress,
		currentToolCall,
		setCurrentToolCall,
		preset,
		setPreset,
		currentModel,
		enabledTools,
		useMCPEffect,
		selectedToolMessage,
		setSelectedToolMessage,
		toolCall,
		setToolCall,
		useA2AEffect,
		// abortQuery,
		// controller,
		// setController,
		// handleTextareaResize,
	};
}
