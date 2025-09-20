import { useRef, useState } from "react";
import { useAppContext } from "@/context/AppContext";
import { DEFAULT_CHAT_MODEL } from "@/lib/config/llm";
import { constructSystemPrompt } from "@/lib/utils/format";
import { streamThread } from "@/lib/services";

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
	model: string;
	setModel: (model: string) => void;
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
	const responseRef = useRef("");
	const toolNameRef = useRef("");
	const toolCallChunkRef = useRef("");
	const [query, setQuery] = useState("");
	const [model, setModel] = useState<string>(DEFAULT_CHAT_MODEL);
	const [messages, setMessagesState] = useState<any[]>([]);
	const [state, setState] = useState<any[]>([]);

	const setMessages = (newMessages: any[]) => {
		in_mem_messages = [...newMessages];
		setMessagesState(newMessages);
	};
	const [metadata, setMetadata] = useState(() => {
		const threadId = `thread_${Math.random().toString(36).substring(2, 15)}`;
		return JSON.stringify({ thread_id: threadId }, null, 2);
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

	const handleSSE = (
		query: string,
		abortController: AbortController | null = null,
	) => {
		// Add user message to the existing messages state
		const userMessage = {
			id: `user-${Date.now()}`,
			model: model,
			content: query,
			role: "user",
			type: "user",
		};

		const updatedMessages = [...messages, userMessage];
		setMessages(updatedMessages);

		clearContent();
		const controller = abortController || new AbortController();
		const source = streamThread({
			system: constructSystemPrompt("You are a helpful assistant."),
			messages: [{ role: "user", content: [{ type: "text", text: query }] }],
			model: model,
			metadata: JSON.parse(metadata),
			stream_mode: "messages",
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
		});

		controller.signal.addEventListener("abort", () => {
			console.log("Aborting stream connection");
			source.close();
			setLoading(false);
		});

		return { controller, source };
	};

	const handleSubmit = (argQuery?: string) => {
		setLoadingMessage("Request submitted...");
		setLoading(true);
		const { controller } = handleSSE(argQuery || query);
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

	// const handleMessages = (payload: any) => {
	// 	const streamMode = payload[0];

	// 	console.log(payload);
	// 	if (streamMode === "messages") {
	// 		const [response, metadata] = payload[1];

	// 		// Stop
	// 		const reason = response.response_metadata.finish_reason
	// 			|| response.response_metadata.stop_reason;

	// 		if (["stop", "end_turn"].includes(reason)) {
	// 			setLoading(false);
	// 			setController(null);
	// 			return;
	// 		}

	// 		// Tool Call Chunks
	// 		if (response.tool_call_chunks && response.tool_call_chunks.length > 0) {
	// 			if (!toolNameRef.current || response.tool_call_chunks[0].name) {
	// 				toolNameRef.current = response.tool_call_chunks[0].name;
	// 			}
	// 			setLoadingMessage(`Calling ${toolNameRef.current} tool...`);
	// 			toolCallChunkRef.current += response.tool_call_chunks[0].args;
	// 			const existingIndex = in_mem_messages.findIndex(
	// 				(msg: any) => msg.id === response.id,
	// 			);
	// 			if (existingIndex === -1) {
	// 				in_mem_messages.push({
	// 					...response,
	// 					input: toolCallChunkRef.current,
	// 					name: toolNameRef.current,
	// 				});
	// 			} else {
	// 				const existingMsg = in_mem_messages[existingIndex];
	// 				if (toolCallChunkRef.current) {
	// 					try {
	// 						existingMsg.input = JSON.parse(toolCallChunkRef.current);
	// 					} catch {
	// 						try {
	// 							const autoAddCommas =
	// 								"[" + toolCallChunkRef.current.replace(/}\s*{/g, "},{") + "]";
	// 							existingMsg.input = JSON.parse(autoAddCommas);
	// 						} catch {
	// 							existingMsg.input = toolCallChunkRef.current;
	// 						}
	// 					}
	// 				}
	// 				in_mem_messages[existingIndex] = {
	// 					...existingMsg,
	// 					...response,
	// 					input: toolCallChunkRef.current,
	// 					name: toolNameRef.current,
	// 				};
	// 			}
	// 			setMessages(in_mem_messages);
	// 			return;
	// 		}

	// 		if (
	// 			response.content &&
	// 			(!response.tool_call_chunks || response.tool_call_chunks.length === 0)
	// 		) {
	// 			const existingIndex = in_mem_messages.findIndex(
	// 				(msg: any) => msg.id === response.id,
	// 			);
	// 			if (existingIndex !== -1) {
	// 				// Always append to the related message content
	// 				const existingMsg = in_mem_messages[existingIndex];
	// 				const expectedContent =
	// 					typeof existingMsg.content === "string"
	// 						? existingMsg.content
	// 						: (existingMsg.content[0]?.text ?? "");
	// 				const updatedContent = (expectedContent || "") + response.content;
	// 				in_mem_messages[existingIndex] = {
	// 					...response,
	// 					...existingMsg,
	// 					content: updatedContent,
	// 				};
	// 				setMessagesState([...in_mem_messages]);
	// 				return;
	// 			} else {
	// 				const expectedContent =
	// 					typeof response.content === "string"
	// 						? response.content
	// 						: (response.content[0]?.text ?? "");
	// 				const updateMessage = {
	// 					...response,
	// 					content: expectedContent,
	// 					role: response.type === "tool" ? "tool" : "assistant",
	// 				};
	// 				if (metadata.ls_provider && metadata.ls_model_name) {
	// 					updateMessage.model = `${metadata.ls_provider}:${metadata.ls_model_name}`;
	// 				}
	// 				if (metadata.ls_temperature) {
	// 					updateMessage.temperature = metadata.ls_temperature;
	// 				}
	// 				if (metadata.thread_id) {
	// 					updateMessage.thread_id = metadata.thread_id;
	// 				}
	// 				if (metadata.checkpoint_ns && metadata.checkpoint_node) {
	// 					updateMessage.checkpoint_ns = metadata.checkpoint_ns;
	// 				}
	// 				in_mem_messages.push(updateMessage);
	// 				setMessagesState([...in_mem_messages]);
	// 				return;
	// 			}
	// 		}
	// 	}
	// 	// if (streamMode === "values") {
	// 	// 	setMessages(response.messages);
	// 	// }
	// };

	const handleMessages = (payload: any, history: any[]) => {
		const streamMode = payload[0];

		if (streamMode === "messages") {
			const response = payload[1][0];
			const responseMetadata = payload[1][1];
			const expectedContent =
				typeof response.content === "string"
					? response.content
					: (response.content[0]?.text ?? "");
			console.log(payload);
			// Handle Tool Input
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
				return;
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
					return;
				}
			}
		}
	};

	// function sseHandler(
	// 	payload: any,
	// 	messages: any[],
	// 	stream_mode: StreamMode | Array<StreamMode> = "messages",
	// ) {
	// 	if (stream_mode === "messages" || stream_mode.includes("messages")) {
	// 		handleMessages(payload, messages);
	// 	}
	// }

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
		model,
		setModel,
		state,
		setState,
		// NEW
		handleTextareaResize,
		clearMessages,
		resetMetadata,
		abortQuery,
		// tools
		arcade,
		setArcade,
	};
}
