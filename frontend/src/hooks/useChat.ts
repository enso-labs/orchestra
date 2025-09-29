import { useRef, useState } from "react";
import { useAppContext } from "@/context/AppContext";
import {
	constructSystemPrompt,
	formatMultimodalPayload,
} from "@/lib/utils/format";
import { streamThread } from "@/lib/services";
import apiClient from "@/lib/utils/apiClient";
import { getAuthToken } from "@/lib/utils/auth";
import { useAgentContext } from "@/context/AgentContext";

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
	metadata: string;
	setMetadata: (metadata: string) => void;
	abortQuery: () => void;
	deleteThread: (threadId: string) => void;
	// NEW
	handleTextareaResize: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
	clearMessages: () => void;
	resetMetadata: () => void;
	state: any[];
	setState: (state: any[]) => void;
	// tools
	arcade: {
		tools: string[];
		toolkit: string[];
	};
	setArcade: (arcade: { tools: string[]; toolkit: string[] }) => void;
};

export default function useChat(): ChatContextType {
	const { setLoading, setLoadingMessage } = useAppContext();
	const { agent } = useAgentContext();
	const responseRef = useRef("");
	const toolNameRef = useRef("");
	const toolCallChunkRef = useRef("");
	const [query, setQuery] = useState("");
	const [messages, setMessagesState] = useState<any[]>([]);
	const [state, setState] = useState<any[]>([]);

	const setMessages = (newMessages: any[]) => {
		in_mem_messages = [...newMessages];
		setMessagesState(newMessages);
	};
	const [metadata, setMetadata] = useState(() => {
		const threadId = `thread_${Math.random().toString(36).substring(2, 15)}`;
		const graphId = `deepagent`;
		return JSON.stringify({ thread_id: threadId, graph_id: graphId }, null, 2);
	});

	const [controller, setController] = useState<AbortController | null>(null);

	const [arcade, setArcade] = useState({
		tools: [] as string[],
		toolkit: [] as string[],
	});

	const abortQuery = () => {
		if (controller) {
			controller.abort();
			setController(null);
		}
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
		const parsedMetadata = JSON.parse(metadata);
		parsedMetadata.graph_id = "react";
		const controller = abortController || new AbortController();
		const formatedMessages = await formatMultimodalPayload(query, images);
		const source = streamThread({
			system: constructSystemPrompt(agent.system),
			messages: formatedMessages,
			model: agent.model,
			metadata: parsedMetadata,
			stream_mode: "messages",
			tools: agent.tools,
			a2a: agent.a2a,
			mcp: agent.mcp,
		});

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

	const resetMetadata = () => {
		setMetadata(() => {
			const threadId = `thread_${Math.random().toString(36).substring(2, 15)}`;
			return JSON.stringify({ thread_id: threadId }, null, 2);
		});
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
	};

	const handleMessages = (payload: any, history: any[]) => {
		const streamMode = payload[0];
		if (streamMode === "error") {
			alert("Error on stream: " + payload[1]);
			setLoading(false);
			setController(null);
			return;
		}

		if (streamMode === "messages") {
			const response = payload[1][0];
			const responseMetadata = payload[1][1];
			const expectedContent =
				typeof response.content === "string"
					? response.content
					: (response.content[0]?.text ?? "");
			console.log(payload);
			// Handle Tool Input
			if (response.tool_call_chunks && response.tool_call_chunks.length > 0) {
				// Only set tool name if we don't have one yet or if the new name is truthy
				if (!toolNameRef.current || response.tool_call_chunks[0].name) {
					toolNameRef.current = response.tool_call_chunks[0].name;
				}
				setLoadingMessage(`Calling ${toolNameRef.current} tool...`);
				toolCallChunkRef.current += response.tool_call_chunks[0].args;
				const existingIndex = history.findIndex(
					(msg: any) => msg.id === response.id,
				);

				// If the message already exists, update it
				if (existingIndex !== -1) {
					// Consolidate tool_call_chunks for the message with matching id
					const existingMsg = history[existingIndex];
					if (toolCallChunkRef.current) {
						try {
							existingMsg.input = JSON.parse(toolCallChunkRef.current);
						} catch {
							try {
								const autoAddCommas =
									"[" + toolCallChunkRef.current.replace(/}\s*{/g, "},{") + "]";
								existingMsg.input = JSON.parse(autoAddCommas);
							} catch {
								existingMsg.input = toolCallChunkRef.current;
							}
						}
					}
					history[existingIndex] = {
						...existingMsg,
						...response,
					};
				} else {
					history.push({
						...response,
						input: toolCallChunkRef.current,
						name: toolNameRef.current,
					});
				}
				setMessagesState([...history]);
			}

			// Handle Final Response & Tool Response
			if (
				expectedContent &&
				(!response.tool_call_chunks || response.tool_call_chunks.length === 0)
			) {
				const existingIndex = history.findIndex(
					(msg: any) => msg.id === response.id,
				);
				if (existingIndex !== -1) {
					// Always append to the related message content
					const existingMsg = history[existingIndex];
					const updatedContent = (existingMsg.content || "") + expectedContent;
					history[existingIndex] = {
						...response,
						...existingMsg,
						content: updatedContent,
					};
					setMessagesState([...history]);
					return;
				} else {
					const updateMessage = {
						...response,
						content: expectedContent,
						role: response.type === "tool" ? "tool" : "assistant",
					};
					if (responseMetadata.ls_provider && responseMetadata.ls_model_name) {
						updateMessage.model = `${responseMetadata.ls_provider}:${responseMetadata.ls_model_name}`;
					}
					if (responseMetadata.ls_temperature) {
						updateMessage.temperature = responseMetadata.ls_temperature;
					}
					if (responseMetadata.thread_id) {
						updateMessage.thread_id = responseMetadata.thread_id;
					}
					if (
						responseMetadata.checkpoint_ns &&
						responseMetadata.checkpoint_node
					) {
						updateMessage.checkpoint_ns = responseMetadata.checkpoint_ns;
					}
					history.push(updateMessage);
					setMessagesState([...history]);
				}
			}

			if (
				["stop", "end_turn", "STOP"].includes(
					response.response_metadata?.finish_reason ||
						response.response_metadata.stop_reason,
				)
			) {
				setLoading(false);
				setController(null);
				return;
			}
		}
	};

	const sseHandler = (payload: any, messages: any[]) => {
		handleMessages(payload, messages);
		return true;
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
		state,
		setState,
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
	};
}
