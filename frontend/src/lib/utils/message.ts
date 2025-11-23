import { formatContent, isEmpty } from "./format";


export function latestHumanMessage(messages: any[] | undefined | null) {
	if (!Array.isArray(messages) || messages.length === 0) {
		return null;
	}
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (msg && msg.type === "human") {
			return msg;
		}
	}
	return null;
}


export class StreamMessageHandler {
	private toolNameRef: React.MutableRefObject<string>;
	private toolCallChunkRef: React.MutableRefObject<string>;

	constructor(
		toolNameRef: React.MutableRefObject<string>,
		toolCallChunkRef: React.MutableRefObject<string>,
	) {
		this.toolNameRef = toolNameRef;
		this.toolCallChunkRef = toolCallChunkRef;
	}

	public toolCall(
		response: any,
		history: any[],
		existingIndex: number,
		setLoadingMessage: any,
	) {
		// Only set tool name if we don't have one yet or if the new name is truthy
		if (!this.toolNameRef.current || response.tool_call_chunks[0].name) {
			this.toolNameRef.current = response.tool_call_chunks[0].name;
		}
		setLoadingMessage(`Calling ${this.toolNameRef.current} tool...`);
		this.toolCallChunkRef.current += response.tool_call_chunks[0].args;
		// If the message already exists, update it
		if (existingIndex !== -1) {
			// Consolidate tool_call_chunks for the message with matching id
			const existingMsg = history[existingIndex];
			if (this.toolCallChunkRef.current) {
				try {
					existingMsg.input = JSON.parse(this.toolCallChunkRef.current);
				} catch {
					try {
						const autoAddCommas =
							"[" +
							this.toolCallChunkRef.current.replace(/}\s*{/g, "},{") +
							"]";
						existingMsg.input = JSON.parse(autoAddCommas);
					} catch {
						existingMsg.input = this.toolCallChunkRef.current;
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
				input: this.toolCallChunkRef.current,
				name: this.toolNameRef.current,
			});
		}
		return history;
	}

	public messageCreate(
		response: any, 
		history: any[], 
		setStreamingRate: any
	) {
		const expectedContent = formatContent(response.content);
		const responseMetadata = response.response_metadata;
		// Initialize streaming rate for new message
		setStreamingRate({
			count: expectedContent.length,
			startTime: Date.now(),
			rate: null,
		});

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
		if (responseMetadata.checkpoint_ns && responseMetadata.checkpoint_node) {
			updateMessage.checkpoint_ns = responseMetadata.checkpoint_ns;
		}
		history.push(updateMessage);
		return history;
	}

	public messageUpdate(
		response: any,
		history: any[],
		existingIndex: number,
		expectedContent: string,
		setStreamingRate: any,
	) {
		// Always append to the related message content
		const existingMsg = history[existingIndex];
		const updatedContent = formatContent(existingMsg.content) + expectedContent;

		// Track streaming rate
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

		history[existingIndex] = {
			...response,
			...existingMsg,
			content: updatedContent,
		};
		return history;
	}

	public streamStop(response: any, setLoading: any, setController: any) {
		if (
			["stop", "end_turn", "STOP"].includes(
				response.response_metadata?.finish_reason ||
					response.response_metadata.stop_reason,
			) &&
			response.tool_calls?.length === 0
		) {
			setLoading(false);
			setController(null);
			// Keep streamingRate state - don't clear it so it stays displayed
			return;
		}
	}
}