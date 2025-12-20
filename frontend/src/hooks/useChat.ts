import { useEffect, useRef, useState } from "react";
import { useAppContext } from "@/context/AppContext";
import { formatContent, formatMultimodalPayload } from "@/lib/utils/format";
import { streamThread } from "@/lib/services";
import apiClient from "@/lib/utils/apiClient";
import { getAuthToken } from "@/lib/utils/auth";
import { useAgentContext } from "@/context/AgentContext";
import { StreamMessageHandler } from "@/lib/utils/message";

type StreamMode = "messages" | "values" | "updates" | "debug" | "tasks";

let in_mem_messages: any[] = [];

export type ChatContextType = {
	responseRef: React.RefObject<string>;
	toolCallChunkRef: React.RefObject<string>;
	query: string;
	setQuery: (query: string) => void;
	handleSubmit: (query: string) => void;
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
	setFilesMap: (map: Map<string, any>) => void;
	todos: any[];
	setTodos: (todos: any[]) => void;
	viewMode: "chat" | "editor";
	setViewMode: (mode: "chat" | "editor") => void;
	ttft: number | null;
	submitStartTime: number | null;
};

export default function useChat(): ChatContextType {
	const { setLoading, setLoadingMessage } = useAppContext();
	const { agent } = useAgentContext();
	const responseRef = useRef("");
	const toolNameRef = useRef("");
	const toolCallChunkRef = useRef("");
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
	const [todos, setTodos] = useState<any[]>([]);
	const [viewMode, setViewMode] = useState<"chat" | "editor">("chat");
	const [ttft, setTtft] = useState<number | null>(null);
	const [submitStartTime, setSubmitStartTime] = useState<number | null>(null);
	const submitStartTimeRef = useRef<number | null>(null);

	const abortQuery = () => {
		if (controller) {
			controller.abort();
			setController(null);
		}
	};

	const sseHandler = (payload: any, messages: any[]) => {
		handleMessages(payload, messages);
		return true;
	};

	const handleSSE = async (
		query: string,
		images: File[],
		abortController: AbortController | null = null,
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
		const enrichedMetadata = getMetadata();
		const source = streamThread({
			system_prompt: agent.prompt,
			input: { messages: formatedMessages },
			model: agent.model,
			metadata: enrichedMetadata,
			tools: agent.tools,
			a2a: agent.a2a,
			mcp: agent.mcp,
			subagents: agent.subagents,
			presidio: {
				analyze: localStorage.getItem("enso:tool:pii_analyze") === "true",
				anonymize: localStorage.getItem("enso:tool:pii_anonymize") === "true",
				// redact: false,
			},
		});
		source.stream();

		source.addEventListener("message", function (e: any) {
			// Assuming we receive JSON-encoded data payloads:
			const payload = JSON.parse(e.data);
			sseHandler(payload, in_mem_messages);
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

	const handleSubmit = async (argQuery?: string, images: File[] = []) => {
		setLoadingMessage("Request submitted...");
		setLoading(true);
		setTtft(null);
		const now = Date.now();
		submitStartTimeRef.current = now;
		setSubmitStartTime(now);
		const { controller } = await handleSSE(argQuery || query, images);
		setController(controller);
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

		if (streamMode === "values") {
			const valuesData = payload[1];

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
			setMessagesState(streamHandler.history);
			if (streamHandler.streamStop(response)) {
				setLoading(false);
				setController(null);
			} else {
				setLoading(false);
				setController(controller);
			}
		}
	};

	const handleTextareaResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const textarea = e.target;
		textarea.style.height = "auto";
		textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
		setQuery(e.target.value);
	};

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

	return {
		responseRef,
		toolCallChunkRef,
		handleSubmit,
		sseHandler,
		clearContent,
		query,
		setQuery,
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
	};
}
