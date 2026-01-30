import { useCallback, useEffect, useRef, useState } from "react";
import { useAppContext } from "@/context/AppContext";
import {
	formatContent,
	formatMultimodalPayload,
	formatMessages,
} from "@/lib/utils/format";
import { streamThread, initiateStream } from "@/lib/services";
import apiClient from "@/lib/utils/apiClient";
import { getAuthToken } from "@/lib/utils/auth";
import { useAgentContext } from "@/context/AgentContext";
import { StreamMessageHandler } from "@/lib/utils/message";
import type { Todo } from "@/components/lists/TodoList";
import type { StreamEvent } from "@/lib/entities/stream";
import type { StreamSource } from "@/lib/utils/streamSource";

type StreamMode = "messages" | "values" | "updates" | "debug" | "tasks";

let in_mem_messages: any[] = [];

export type ChatContextType = {
	responseRef: React.RefObject<string>;
	toolCallChunkRef: React.RefObject<string>;
	query: string;
	setQuery: (query: string) => void;
	appendToQuery: (text: string) => void;
	inputRef: React.RefObject<HTMLTextAreaElement>;
	handleSubmit: (query?: string, images?: File[], metadataOverrides?: Record<string, any>) => Promise<void>;
	sseHandler: (
		payload: any,
		messages: any[],
		stream_mode: StreamMode | Array<StreamMode>,
	) => void;
	clearContent: () => void;
	messages: any[];
	setMessages: (messages: any[]) => void;
	controller: AbortController | null;
	setController: (controller: AbortController | null) => void;
	metadata: {
		[key: string]: any;
	};
	setMetadata: (metadata: { [key: string]: any }) => void;
	abortQuery: () => void;
	deleteThread: (threadId: string) => void;
	// NEW
	handleTextareaResize: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
	clearMessages: () => void;
	resetMetadata: () => void;
	useEffectUpdateAssistantId: () => void;
	// tools
	arcade: {
		tools: string[];
		toolkit: string[];
	};
	setArcade: (arcade: { tools: string[]; toolkit: string[] }) => void;
	streamingRate: {
		count: number;
		startTime: number;
		rate: number | null;
	} | null;
	filesMap: Map<string, any>;
	setFilesMap: (filesMap: Map<string, any>) => void;
	todos: Todo[];
	setTodos: (todos: Todo[]) => void;
	viewMode: "chat" | "editor";
	setViewMode: (mode: "chat" | "editor") => void;
	ttft: number | null;
	submitStartTime: number | null;
	// File CRUD operations
	addFile: (path: string, content?: string) => void;
	updateFileContent: (path: string, content: string) => void;
	removeFile: (path: string) => void;
	renameFile: (oldPath: string, newPath: string) => void;
	getFilesForSubmission: () => Record<string, any>;
};

export default function useChat(): ChatContextType {
	const { setLoading, setLoadingMessage } = useAppContext();
	const { agent } = useAgentContext();
	const responseRef = useRef("");
	const toolNameRef = useRef("");
	const toolCallChunkRef = useRef("");
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const [query, setQuery] = useState("");
	const [messages, setMessagesState] = useState<any[]>([]);
	// const [state, setState] = useState<any[]>([]);

	const setMessages = (newMessages: any[]) => {
		in_mem_messages = [...newMessages];
		setMessagesState(newMessages);
	};
	const [metadata, setMetadata] = useState<any>(() => {
		const storedProjectId = localStorage.getItem("current_project_id");
		return {
			timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
			language: navigator.language,
			current_utc: undefined,
			...(storedProjectId ? { project_id: storedProjectId } : {}),
		};
	});

	const [controller, setController] = useState<AbortController | null>(null);

	const [streamingRate, setStreamingRate] = useState<{
		count: number;
		startTime: number;
		rate: number | null;
	} | null>(null);

	const [arcade, setArcade] = useState({
		tools: [] as string[],
		toolkit: [] as string[],
	});

	const [filesMap, setFilesMap] = useState<Map<string, any>>(new Map());
	const [todos, setTodos] = useState<Todo[]>([]);
	const [viewMode, setViewMode] = useState<"chat" | "editor">("chat");
	const [ttft, setTtft] = useState<number | null>(null);
	const [submitStartTime, setSubmitStartTime] = useState<number | null>(null);
	const submitStartTimeRef = useRef<number | null>(null);

	const abortQuery = async () => {
		// Send abort signal to backend for distributed mode (fire-and-forget for responsive UX)
		const threadId = metadata?.thread_id;
		if (threadId) {
			import("@/lib/services/threadService")
				.then(({ abortThread }) => abortThread(threadId))
				.then(() => console.log("Backend abort signal sent"))
				.catch((err) =>
					console.warn("Failed to send backend abort signal:", err),
				);
		}

		// Immediately close local connection for responsive UX
		if (controller) {
			controller.abort();
			setController(null);
		}

		setLoading(false);
		setLoadingMessage("");
	};

	const sseHandler = (payload: any, messages: any[]) => {
		handleMessages(payload, messages);
		return true;
	};

	/**
	 * Converts a StreamEvent to the legacy payload format for handleMessages().
	 * This allows reusing the existing message handling logic.
	 */
	const convertEventToLegacy = (event: StreamEvent): any[] | null => {
		switch (event.type) {
			case "metadata":
				return ["metadata", event.data];
			case "messages":
				return ["messages", event.data];
			case "values":
				return ["values", event.data];
			case "error":
				return ["error", event.data.error];
			case "aborted":
				return ["aborted", event.data];
			case "done":
				return null; // Handled separately
			default:
				return null;
		}
	};

	/**
	 * Handles SSE using the new unified stream abstraction.
	 * Supports both sync mode (direct SSE) and distributed mode (polling).
	 */
	const handleSSEUnified = async (
		query: string,
		images: File[],
		metadataOverrides?: Record<string, any>,
	): Promise<{ controller: AbortController; stream: StreamSource }> => {
		// Optimistic UI: Add user message immediately
		const userMessage = {
			id: `user-${Date.now()}`,
			model: agent.model,
			content: query,
			role: "user",
			type: "user",
		};

		const updatedMessages = [...messages, userMessage];
		setMessages(updatedMessages);

		clearContent();
		const formatedMessages = await formatMultimodalPayload(query, images);
		const enrichedMetadata = { ...getMetadata(), ...metadataOverrides };

		// Collect files from filesMap for submission
		const filesToSubmit: Record<string, any> = {};
		filesMap.forEach((files) => {
			Object.assign(filesToSubmit, files);
		});

		// Build payload based on agent type
		const payload = agent.public
			? {
					input: {
						messages: formatedMessages,
					},
					metadata: enrichedMetadata,
					model: "",
				}
			: {
					system_prompt: agent.prompt,
					input: {
						messages: formatedMessages,
						...(Object.keys(filesToSubmit).length > 0 && {
							files: filesToSubmit,
						}),
					},
					model: agent.model,
					metadata: enrichedMetadata,
					tools: agent.tools,
					a2a: agent.a2a,
					mcp: agent.mcp,
					subagents: agent.subagents,
				};

		// Show processing state for distributed mode
		setLoadingMessage("Processing request...");

		// Get unified stream source (handles both sync and distributed)
		const stream = await initiateStream(payload);

		// Create abort controller for cleanup
		const controller = new AbortController();

		// Handle events from the stream
		stream.onEvent((event: StreamEvent) => {
			if (event.type === "done") {
				setLoading(false);
				setController(null);
				return;
			}

			// Convert to legacy format and process
			const legacyPayload = convertEventToLegacy(event);
			if (legacyPayload) {
				sseHandler(legacyPayload, in_mem_messages);
			}
		});

		stream.onError((error: Error) => {
			console.error("Stream error:", error);
			alert(error.message);
			setLoading(false);
			setController(null);

			// Restore last message for retry
			const lastMessageIndex =
				in_mem_messages.length > 0 ? in_mem_messages.length - 1 : -1;
			if (lastMessageIndex >= 0) {
				setQuery(in_mem_messages[lastMessageIndex].content);
				clearMessages(lastMessageIndex);
			}
		});

		stream.onClose(() => {
			console.log("Stream connection closed");
		});

		// Handle abort
		controller.signal.addEventListener("abort", () => {
			console.log("Aborting stream connection");
			stream.close();
			setLoading(false);
		});

		// Start the stream
		stream.start();

		return { controller, stream };
	};

	const handleSSE = async (
		query: string,
		images: File[],
		abortController: AbortController | null = null,
		metadataOverrides?: Record<string, any>,
	) => {
		// Add user message to the existing messages state
		const userMessage = {
			id: `user-${Date.now()}`,
			model: agent.model,
			content: query,
			role: "user",
			type: "user",
		};

		const updatedMessages = [...messages, userMessage];
		setMessages(updatedMessages);

		clearContent();
		const controller = abortController || new AbortController();
		const formatedMessages = await formatMultimodalPayload(query, images);
		const enrichedMetadata = { ...getMetadata(), ...metadataOverrides };
		// Collect files from filesMap for submission
		const filesToSubmit: Record<string, any> = {};
		filesMap.forEach((files) => {
			Object.assign(filesToSubmit, files);
		});

		// For public agents, only send input and metadata (settings are server-side)
		const payload = agent.public
			? {
					input: {
						messages: formatedMessages,
					},
					metadata: enrichedMetadata,
					model: "", // Required by type but ignored server-side for public agents
				}
			: {
					system_prompt: agent.prompt,
					input: {
						messages: formatedMessages,
						...(Object.keys(filesToSubmit).length > 0 && {
							files: filesToSubmit,
						}),
					},
					model: agent.model,
					metadata: enrichedMetadata,
					tools: agent.tools,
					a2a: agent.a2a,
					mcp: agent.mcp,
					subagents: agent.subagents,
				};

		const source = streamThread(payload);
		source.stream();

		source.addEventListener("message", function (e: any) {
			// Check for [DONE] signal first (not valid JSON)
			if (e.data === "[DONE]") {
				console.log("Stream complete: [DONE] received");
				source.close();
				setController(null);
				setLoading(false);
				return;
			}

			// Parse JSON-encoded data payloads
			try {
				const payload = JSON.parse(e.data);
				sseHandler(payload, in_mem_messages);
			} catch (parseError) {
				console.warn("Failed to parse SSE message:", e.data);
			}
		});

		// Close handling
		source.addEventListener("close", () => {
			console.log("Connection closed");
			source.close();
			setController(null);
			setLoading(false);
		});

		source.addEventListener("error", (e: any) => {
			console.error("Error on stream:", e);
			const error = JSON.parse(e.data);
			alert(error.detail || error.error);
			source.close();
			setController(null);
			setLoading(false);
			const lastMessageIndex =
				in_mem_messages.length > 0 ? in_mem_messages.length - 1 : -1;
			if (lastMessageIndex >= 0) {
				setQuery(in_mem_messages[lastMessageIndex].content);
				clearMessages(lastMessageIndex);
			}
		});

		controller.signal.addEventListener("abort", () => {
			console.log("Aborting stream connection");
			source.close();
			setLoading(false);
		});

		return { controller, source };
	};

	const handleSubmit = async (argQuery?: string, images: File[] = [], metadataOverrides?: Record<string, any>) => {
		setLoadingMessage("Request submitted...");
		setLoading(true);
		setTtft(null);
		const now = Date.now();
		submitStartTimeRef.current = now;
		setSubmitStartTime(now);

		const queryToSubmit = argQuery || query;

		try {
			// Try unified handler (supports both sync and distributed modes)
			const { controller } = await handleSSEUnified(queryToSubmit, images, metadataOverrides);
			setController(controller);
		} catch (error) {
			// Fallback to legacy SSE handler if unified fails
			console.warn("Unified stream failed, falling back to legacy SSE:", error);
			const { controller } = await handleSSE(queryToSubmit, images, null, metadataOverrides);
			setController(controller);
		}

		setQuery("");
	};

	const clearContent = () => {
		if (responseRef.current) {
			responseRef.current = "";
		}
		if (toolCallChunkRef.current) {
			toolCallChunkRef.current = "";
		}
	};

	const getMetadata = () => {
		return {
			...metadata,
			assistant_id: agent.id,
			current_utc: new Date().toISOString(),
			timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
			language: Intl.DateTimeFormat().resolvedOptions().locale,
		};
	};

	const resetMetadata = () => {
		setMetadata({});
	};

	const clearMessages = (index?: number) => {
		if (
			typeof index === "number" &&
			index >= 0 &&
			index < in_mem_messages.length
		) {
			in_mem_messages = in_mem_messages.slice(0, index);
		} else {
			in_mem_messages = [];
			resetMetadata();
		}
		setMessages(in_mem_messages);
		setFilesMap(new Map());
		setTodos([]);
		setViewMode("chat");
		setTtft(null);
		submitStartTimeRef.current = null;
		setSubmitStartTime(null);
	};

	const handleMessages = (payload: any, history: any[]) => {
		// console.log(payload);
		const streamMode = payload[0];

		if (streamMode === "error") {
			alert("Error on stream: " + payload[1]);
			setLoading(false);
			setController(null);
			return;
		}

		// Handle aborted events from distributed workers
		if (streamMode === "aborted") {
			console.log("Stream aborted by server:", payload[1]?.reason);
			setLoading(false);
			setController(null);
			return;
		}

		// Handle metadata events (first event in distributed mode stream)
		// This captures thread_id early for multi-turn conversations
		if (streamMode === "metadata") {
			const metadataPayload = payload[1];
			setMetadata((prev: any) => ({
				...prev,
				thread_id: metadataPayload.thread_id,
				assistant_id: metadataPayload.assistant_id,
				project_id: metadataPayload.project_id,
			}));
			return;
		}

	if (streamMode === "values") {
		const valuesData = payload[1];

		// Get latest user message from valuesData.messages and history
		const latestUserFromValues = valuesData.messages
			?.slice()
			.reverse()
			.find((msg: any) => ["user", "human"].includes(msg.type ?? msg.role));

		const lastUserIndex = history.findLastIndex((item) => item.role === "user");

		if (latestUserFromValues && lastUserIndex !== -1) {
			history[lastUserIndex] = latestUserFromValues;
		}

		// Store files with message association
		if (valuesData.files && Object.keys(valuesData.files).length > 0) {
				// Associate files with the latest AI or tool message
				const latestAiMessage = history
					.slice()
					.reverse()
					.find((msg: any) =>
						["ai", "assistant", "tool"].includes(msg.type ?? msg.role),
					);

				if (latestAiMessage) {
					setFilesMap((prev) => {
						const newMap = new Map(prev);
						newMap.set(latestAiMessage.id, valuesData.files);
						return newMap;
					});
				}
			}

			// Store todos with message association
			if (valuesData.todos && Object.keys(valuesData.todos).length > 0) {
				// Associate todos with the latest AI or tool message
				setTodos(valuesData.todos);
			}

			return;
		}

		if (streamMode === "messages") {
			const response = payload[1][0];
			const responseMetadata = payload[1][1];
			setMetadata((prev: any) => ({
				...prev,
				thread_id: responseMetadata.thread_id,
			}));

			const expectedContent = formatContent(response.content);
			const existingIndex = history.findIndex(
				(msg: any) => msg.id === response.id,
			);

			// Calculate TTFT on first token
			if (existingIndex === -1 && submitStartTimeRef.current !== null) {
				const ttftValue = Date.now() - submitStartTimeRef.current;
				setTtft(ttftValue);
				submitStartTimeRef.current = null;
				setSubmitStartTime(null);
			}

			// Update streaming rate
			if (
				expectedContent &&
				(!response.tool_call_chunks || response.tool_call_chunks.length === 0)
			) {
				if (existingIndex === -1) {
					setStreamingRate({
						count: expectedContent.length,
						startTime: Date.now(),
						rate: null,
					});
				} else {
					setStreamingRate((prev: any) => {
						const now = Date.now();
						const startTime = prev?.startTime || now;
						const newCount = (prev?.count || 0) + expectedContent.length;
						const elapsed = (now - startTime) / 1000;

						return {
							count: newCount,
							startTime,
							rate: elapsed > 0.1 ? Math.round(newCount / elapsed / 4) : null,
						};
					});
				}
			}

			const streamHandler = new StreamMessageHandler(
				toolNameRef,
				toolCallChunkRef,
				history,
			);

			// Handle Final Response & Tool Response
			streamHandler.processResponse(response, expectedContent, existingIndex);
			setLoadingMessage(`Calling ${streamHandler.toolNameRef.current} tool...`);

			// CRITICAL FIX: Apply formatMessages() to normalize streaming data
			// This ensures consistency with checkpoint reload behavior
			const normalizedHistory = formatMessages(streamHandler.history);
			setMessagesState(normalizedHistory);
			// NOTE: Stream stop is now handled by the [DONE] signal in the event handler
			// The unified handler (handleSSEUnified) and legacy handler both check for [DONE]
			// Do NOT stop here based on streamStop() - wait for explicit [DONE] signal
		}
	};

	const handleTextareaResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const textarea = e.target;
		textarea.style.height = "auto";
		textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
		setQuery(e.target.value);
	};

	const appendToQuery = useCallback((text: string) => {
		const quotedText = `> ${text}\n\n`;
		setQuery((prev) => (prev ? `${quotedText}${prev}` : quotedText));
		// Focus input and position cursor after the quoted text
		setTimeout(() => {
			if (inputRef.current) {
				inputRef.current.focus();
				const cursorPosition = quotedText.length;
				inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
			}
		}, 0);
	}, []);

	const deleteThread = async (threadId: string) => {
		try {
			const response = await apiClient.delete(`/threads/${threadId}`, {
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					Authorization: `Bearer ${getAuthToken()}`,
				},
			});
			if (response.status >= 200 && response.status < 300) {
				return true;
			}
			return false;
		} catch (error: any) {
			console.error("Error deleting thread:", error);
			throw new Error(
				error.response?.data?.detail || "Failed to delete thread",
			);
		}
	};

	const useEffectUpdateAssistantId = () => {
		useEffect(() => {
			setMetadata((prev: any) => ({
				...prev,
				assistant_id: agent.id,
			}));
			return () => {
				setMetadata((prev: any) => ({
					...prev,
					assistant_id: undefined,
				}));
			};
		}, [agent.id]);
	};

	// File CRUD operations (wrapped in useCallback for stable references)
	const addFile = useCallback((path: string, content: string = "") => {
		const now = new Date().toISOString();
		const newFile = {
			content: content.split("\n"),
			created_at: now,
			modified_at: now,
		};
		setFilesMap((prev) => {
			const newMap = new Map(prev);
			const userFilesKey = "__user_files__";
			const userFiles = newMap.get(userFilesKey) || {};
			newMap.set(userFilesKey, { ...userFiles, [path]: newFile });
			return newMap;
		});
	}, []);

	const updateFileContent = useCallback((path: string, content: string) => {
		setFilesMap((prev) => {
			const newMap = new Map(prev);
			for (const [key, files] of newMap.entries()) {
				if (files && files[path]) {
					newMap.set(key, {
						...files,
						[path]: {
							...files[path],
							content: content.split("\n"),
							modified_at: new Date().toISOString(),
						},
					});
					return newMap;
				}
			}
			return newMap;
		});
	}, []);

	const removeFile = useCallback((path: string) => {
		setFilesMap((prev) => {
			const newMap = new Map(prev);
			for (const [key, files] of newMap.entries()) {
				if (files && files[path]) {
					const { [path]: _, ...rest } = files;
					if (Object.keys(rest).length === 0) {
						newMap.delete(key);
					} else {
						newMap.set(key, rest);
					}
					return newMap;
				}
			}
			return newMap;
		});
	}, []);

	const renameFile = useCallback((oldPath: string, newPath: string) => {
		setFilesMap((prev) => {
			const newMap = new Map(prev);
			for (const [key, files] of newMap.entries()) {
				if (files && files[oldPath]) {
					const { [oldPath]: fileData, ...rest } = files;
					newMap.set(key, {
						...rest,
						[newPath]: {
							...fileData,
							modified_at: new Date().toISOString(),
						},
					});
					return newMap;
				}
			}
			return newMap;
		});
	}, []);

	// Convert filesMap to backend format for submission
	const getFilesForSubmission = useCallback((): Record<string, any> => {
		const result: Record<string, any> = {};
		filesMap.forEach((files) => {
			Object.assign(result, files);
		});
		return result;
	}, [filesMap]);

	return {
		responseRef,
		toolCallChunkRef,
		handleSubmit,
		sseHandler,
		clearContent,
		query,
		setQuery,
		appendToQuery,
		inputRef,
		messages,
		setMessages,
		metadata,
		setMetadata,
		controller,
		setController,
		// model,
		// setModel,
		// state,
		// setState,
		// systemMessage,
		// setSystemMessage,
		// NEW
		handleTextareaResize,
		clearMessages,
		resetMetadata,
		abortQuery,
		deleteThread,
		// tools
		arcade,
		setArcade,
		useEffectUpdateAssistantId,
		streamingRate,
		filesMap,
		setFilesMap,
		todos,
		setTodos,
		viewMode,
		setViewMode,
		ttft,
		submitStartTime,
		// File CRUD
		addFile,
		updateFileContent,
		removeFile,
		renameFile,
		getFilesForSubmission,
	};
}
