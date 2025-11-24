import { useEffect, useRef, useState } from "react";
import { useAppContext } from "@/context/AppContext";
import { formatContent, formatMultimodalPayload } from "@/lib/utils/format";
import { useAgentContext } from "@/context/AgentContext";
import { StreamMessageHandler } from "@/lib/utils/message";
import { useMessageQueue } from "./useMessageQueue";
import { SourceStream } from "@/lib/utils/stream";
import useThread from "./useThread";

type StreamMode = "messages" | "values" | "updates" | "debug" | "tasks";

export interface QueuedMessage {
	id: string;
	content: string;
	images: File[];
}

let in_mem_messages: any[] = [];

export type ChatContextType = {
	responseRef: React.RefObject<string>;
	toolCallChunkRef: React.RefObject<string>;
	query: string;
	setQuery: (query: string) => void;
	hanleLLMStream: (
		query: string,
		images?: File[],
		clearImages?: () => void,
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
	// NEW
	handleTextareaResize: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
	clearMessages: () => void;
	resetMetadata: () => void;
	state: any[];
	setState: (state: any[]) => void;
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
	// Queue
	messageQueue: QueuedMessage[];
	addToQueue: (content: string, images: File[]) => void;
	removeFromQueue: (id: string) => void;
	clearQueue: () => void;
};

export default function useChat(): ChatContextType {
	const { setLoading, setLoadingMessage } = useAppContext();
	const { agent } = useAgentContext();
	const responseRef = useRef("");
	const toolNameRef = useRef("");
	const threadIdRef = useRef<string>("");
	const toolCallChunkRef = useRef("");
	const [query, setQuery] = useState("");
	const [messages, setMessagesState] = useState<any[]>([]);
	const [state, setState] = useState<any[]>([]);
	const { useListThreadsEffect } = useThread();
	const {
		messageQueue,
		addToQueue,
		removeFromQueue,
		clearQueue,
		nextQueueMessage,
		controller,
		setController,
		controllerRef,
		abortQuery,
		resetController,
	} = useMessageQueue();

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

	const handleSSE = async (
		query: string,
		images: File[],
	) => {
		// Add user message to the existing messages state
		const userMessage = {
			id: `user-${Date.now()}`,
			model: agent.model,
			content: query,
			role: "user",
			type: "user",
		};

		const updatedMessages = [...in_mem_messages, userMessage];
		setMessages(updatedMessages);

		clearContent();

		const formatedMessages = await formatMultimodalPayload(query, images);
		const enrichedMetadata = getMetadata();
		const sourceStream = new SourceStream();
		const source = sourceStream.createSource({
			system: agent.prompt,
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
		sourceStream.source.stream();
		// Message handling
		sourceStream.onMessage(function (e: any) {
			const payload = JSON.parse(e.data);
			handleMessages(payload, in_mem_messages, source);
		});
		// Error handling
		sourceStream.onError(function (e: any) {
			console.error("Error on stream:", e);
			const error = JSON.parse(e.data);
			alert(error.detail || error.error);
			source.close();
			resetController();
			setLoading(false);
			const lastMessageIndex =
				in_mem_messages.length > 0 ? in_mem_messages.length - 1 : -1;
			if (lastMessageIndex >= 0) {
				setQuery(in_mem_messages[lastMessageIndex].content);
				clearMessages(lastMessageIndex);
			}
		});
		// Abort handling
		sourceStream.onAbort(function () {
			console.log("Aborting stream connection");
			source.close();
			setLoading(false);
		});

		return sourceStream;
	};

	const hanleLLMStream = async (
		argQuery?: string,
		images: File[] = [],
		clearImages?: () => void,
	) => {
		const messageContent = argQuery || query;

		// If controller is active (LLM is processing), queue the message
		if (controllerRef.current) {
			addToQueue(messageContent, images);
			setQuery("");
			clearImages?.();
			return;
		}

		setLoadingMessage("Request submitted...");
		setLoading(true);
		const { controller: newController } = await handleSSE(
			messageContent,
			images,
		);
		controllerRef.current = newController;
		setController(newController);
		setQuery("");
		clearImages?.();
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
			thread_id: threadIdRef.current,
			current_utc: new Date().toISOString(),
			timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
			language: navigator.language,
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
	};

	const handleMessages = (payload: any, history: any[], source: any) => {
		// console.log(payload);
		const streamMode = payload[0];

		if (streamMode === "error") {
			alert("Error on stream: " + payload[1]);
			setLoading(false);
			setController(null);
			source.close();
			return;
		}

		if (streamMode === "values") {
			const valuesData = payload[1];

			// setMessagesState((prev) => [...prev, ...valuesData.messages]);

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
			threadIdRef.current = responseMetadata.thread_id;

			const expectedContent = formatContent(response.content);
			const existingIndex = history.findIndex(
				(msg: any) => msg.id === response.id,
			);

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
				controllerRef.current = null;
				setController(null);
				source.close();
				const nextMessage = nextQueueMessage();
				if (nextMessage) {
					hanleLLMStream(nextMessage.content, nextMessage.images);
					return;
				}
				useListThreadsEffect();
				threadIdRef.current = "";
			}
		}
	};

	const handleTextareaResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const textarea = e.target;
		textarea.style.height = "auto";
		textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
		setQuery(e.target.value);
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
		hanleLLMStream,
		clearContent,
		query,
		setQuery,
		messages,
		setMessages,
		metadata,
		setMetadata,
		controller,
		setController,
		state,
		setState,
		handleTextareaResize,
		clearMessages,
		resetMetadata,
		abortQuery,
		// TOOLS
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
		// QUEUE
		messageQueue,
		addToQueue,
		removeFromQueue,
		clearQueue,
	};
}
